-- ============================================================================
-- OPSKL NOTIFICATIONS & REAL-TIME ENGINE (PHASE 7)
-- Multi-channel event-driven notifications (In-app, Expo Push, WhatsApp, SMS),
-- user preferences, device token lifecycle, idempotency & delivery audit logs
-- ============================================================================

-- 1. EXTEND NOTIFICATIONS TABLE
ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS channel TEXT NOT NULL DEFAULT 'in_app' CHECK (channel IN ('in_app', 'expo_push', 'whatsapp', 'sms')),
  ADD COLUMN IF NOT EXISTS delivery_status TEXT NOT NULL DEFAULT 'delivered' CHECK (delivery_status IN ('pending', 'delivered', 'failed', 'suppressed')),
  ADD COLUMN IF NOT EXISTS action_url TEXT,
  ADD COLUMN IF NOT EXISTS priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent'));

-- 2. USER PUSH TOKENS
CREATE TABLE IF NOT EXISTS user_push_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  expo_push_token TEXT NOT NULL,
  device_platform TEXT CHECK (device_platform IN ('ios', 'android', 'web')),
  device_name TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, expo_push_token)
);

-- 3. USER NOTIFICATION PREFERENCES
CREATE TABLE IF NOT EXISTS user_notification_preferences (
  user_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  push_enabled BOOLEAN NOT NULL DEFAULT true,
  in_app_enabled BOOLEAN NOT NULL DEFAULT true,
  whatsapp_enabled BOOLEAN NOT NULL DEFAULT false,
  sms_enabled BOOLEAN NOT NULL DEFAULT true,
  notify_shift_opportunities BOOLEAN NOT NULL DEFAULT true,
  notify_applications BOOLEAN NOT NULL DEFAULT true,
  notify_selection_and_confirmations BOOLEAN NOT NULL DEFAULT true,
  notify_shift_reminders BOOLEAN NOT NULL DEFAULT true,
  notify_attendance_updates BOOLEAN NOT NULL DEFAULT true,
  notify_payouts BOOLEAN NOT NULL DEFAULT true,
  notify_disputes BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. NOTIFICATION DELIVERY AUDIT LOGS
CREATE TABLE IF NOT EXISTS notification_delivery_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id UUID REFERENCES notifications(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK (channel IN ('in_app', 'expo_push', 'whatsapp', 'sms')),
  status TEXT NOT NULL CHECK (status IN ('delivered', 'failed', 'retrying', 'opted_out', 'duplicate')),
  provider_response JSONB,
  attempt_count INT NOT NULL DEFAULT 1,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. INDEXES
CREATE INDEX IF NOT EXISTS idx_push_tokens_user_active ON user_push_tokens(user_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_notifications_idempotency ON notifications(idempotency_key);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);
CREATE INDEX IF NOT EXISTS idx_delivery_logs_notif_id ON notification_delivery_logs(notification_id);

-- 6. RLS POLICIES
ALTER TABLE user_push_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_delivery_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own push tokens"
  ON user_push_tokens FOR ALL
  USING (user_id = auth.uid());

CREATE POLICY "Users can manage their own notification preferences"
  ON user_notification_preferences FOR ALL
  USING (user_id = auth.uid());

CREATE POLICY "Users can view their own delivery logs"
  ON notification_delivery_logs FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Admins can view all notification logs"
  ON notification_delivery_logs FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- 7. RPC: SAFE EVENT-DRIVEN NOTIFICATION DISPATCHER (WITH IDEMPOTENCY & PREFERENCES)
CREATE OR REPLACE FUNCTION send_notification_safe(
  p_user_id UUID,
  p_title TEXT,
  p_body TEXT,
  p_type TEXT,
  p_channel TEXT DEFAULT 'in_app',
  p_idempotency_key TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}',
  p_action_url TEXT DEFAULT NULL,
  p_priority TEXT DEFAULT 'normal'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing_id UUID;
  v_notif_id UUID;
  v_prefs RECORD;
  v_should_deliver BOOLEAN := true;
  v_delivery_status TEXT := 'delivered';
BEGIN
  -- 0. Authorization Guard: Only service_role, admin, or the user themselves
  IF auth.uid() IS NOT NULL AND auth.uid() != p_user_id AND NOT is_current_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized. Users cannot send notifications to other accounts.');
  END IF;

  -- 1. Idempotency Check
  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_existing_id
    FROM notifications
    WHERE idempotency_key = p_idempotency_key;

    IF FOUND THEN
      RETURN jsonb_build_object(
        'success', true,
        'duplicate', true,
        'notification_id', v_existing_id,
        'message', 'Notification already delivered'
      );
    END IF;
  END IF;

  -- 2. Check User Preferences
  SELECT * INTO v_prefs
  FROM user_notification_preferences
  WHERE user_id = p_user_id;

  IF FOUND THEN
    -- Channel check
    IF p_channel = 'expo_push' AND NOT v_prefs.push_enabled THEN
      v_should_deliver := false;
    ELSIF p_channel = 'whatsapp' AND NOT v_prefs.whatsapp_enabled THEN
      v_should_deliver := false;
    ELSIF p_channel = 'sms' AND NOT v_prefs.sms_enabled THEN
      v_should_deliver := false;
    END IF;

    -- Event category check
    IF p_type = 'job_opportunity' AND NOT v_prefs.notify_shift_opportunities THEN
      v_should_deliver := false;
    ELSIF p_type = 'application_status' AND NOT v_prefs.notify_applications THEN
      v_should_deliver := false;
    ELSIF p_type IN ('worker_selected', 'booking_confirmed') AND NOT v_prefs.notify_selection_and_confirmations THEN
      v_should_deliver := false;
    ELSIF p_type = 'shift_reminder' AND NOT v_prefs.notify_shift_reminders THEN
      v_should_deliver := false;
    ELSIF p_type IN ('check_in', 'check_out', 'attendance_approved') AND NOT v_prefs.notify_attendance_updates THEN
      v_should_deliver := false;
    ELSIF p_type IN ('payout_settled', 'payout_failed') AND NOT v_prefs.notify_payouts THEN
      v_should_deliver := false;
    ELSIF p_type = 'dispute_update' AND NOT v_prefs.notify_disputes THEN
      v_should_deliver := false;
    END IF;
  END IF;

  IF NOT v_should_deliver THEN
    v_delivery_status := 'suppressed';
  END IF;

  -- 3. Insert into notifications
  INSERT INTO notifications (
    user_id,
    title,
    body,
    type,
    channel,
    idempotency_key,
    delivery_status,
    metadata,
    action_url,
    priority,
    read
  ) VALUES (
    p_user_id,
    p_title,
    p_body,
    p_type,
    p_channel,
    p_idempotency_key,
    v_delivery_status,
    p_metadata,
    p_action_url,
    p_priority,
    false
  )
  RETURNING id INTO v_notif_id;

  -- 4. Delivery Audit Log
  INSERT INTO notification_delivery_logs (
    notification_id,
    user_id,
    channel,
    status,
    attempt_count
  ) VALUES (
    v_notif_id,
    p_user_id,
    p_channel,
    CASE WHEN v_should_deliver THEN 'delivered' ELSE 'opted_out' END,
    1
  );

  RETURN jsonb_build_object(
    'success', true,
    'duplicate', false,
    'suppressed', NOT v_should_deliver,
    'notification_id', v_notif_id,
    'delivery_status', v_delivery_status
  );
END;
$$;

-- 8. RPC: REGISTER PUSH TOKEN SAFE
CREATE OR REPLACE FUNCTION register_push_token_safe(
  p_user_id UUID,
  p_expo_token TEXT,
  p_platform TEXT,
  p_device_name TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_effective_id UUID;
BEGIN
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Authentication required to register device token.');
  END IF;

  -- Ensure caller can only register for themselves unless admin
  IF p_user_id IS NOT NULL AND p_user_id != v_caller_id THEN
    IF NOT is_current_admin() THEN
      RETURN jsonb_build_object('success', false, 'error', 'Unauthorized. Cannot register push tokens for another user.');
    END IF;
    v_effective_id := p_user_id;
  ELSE
    v_effective_id := v_caller_id;
  END IF;

  INSERT INTO user_push_tokens (
    user_id,
    expo_push_token,
    device_platform,
    device_name,
    is_active,
    updated_at
  ) VALUES (
    v_effective_id,
    p_expo_token,
    p_platform,
    p_device_name,
    true,
    now()
  )
  ON CONFLICT (user_id, expo_push_token)
  DO UPDATE SET
    is_active = true,
    updated_at = now();

  RETURN jsonb_build_object('success', true, 'token', p_expo_token);
END;
$$;

-- 9. RPC: REVOKE PUSH TOKEN SAFE (LOGOUT)
CREATE OR REPLACE FUNCTION revoke_push_token_safe(
  p_user_id UUID,
  p_expo_token TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_effective_id UUID;
BEGIN
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Authentication required to revoke device token.');
  END IF;

  IF p_user_id IS NOT NULL AND p_user_id != v_caller_id THEN
    IF NOT is_current_admin() THEN
      RETURN jsonb_build_object('success', false, 'error', 'Unauthorized. Cannot revoke push tokens for another user.');
    END IF;
    v_effective_id := p_user_id;
  ELSE
    v_effective_id := v_caller_id;
  END IF;

  UPDATE user_push_tokens
  SET
    is_active = false,
    updated_at = now()
  WHERE user_id = v_effective_id AND expo_push_token = p_expo_token;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- 10. ENABLE SUPABASE REALTIME PUBLICATION
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
  END IF;
EXCEPTION
  WHEN undefined_object THEN null;
  WHEN others THEN null;
END $$;

-- 11. RESTRICT RPC EXECUTION PRIVILEGES
REVOKE EXECUTE ON FUNCTION send_notification_safe(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION send_notification_safe(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, TEXT, TEXT) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION register_push_token_safe(UUID, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION register_push_token_safe(UUID, TEXT, TEXT, TEXT) TO authenticated;

REVOKE EXECUTE ON FUNCTION revoke_push_token_safe(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION revoke_push_token_safe(UUID, TEXT) TO authenticated;
