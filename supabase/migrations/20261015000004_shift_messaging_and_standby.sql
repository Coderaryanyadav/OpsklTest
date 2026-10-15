-- ============================================================================
-- OPSKL MIGRATION: 20261015000004_shift_messaging_and_standby.sql
-- Shift-Specific Messaging, Standby Replacement, and Arrival Delay Alerts
-- ============================================================================

-- 1. SHIFT MESSAGES TABLE
CREATE TABLE IF NOT EXISTS public.shift_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  recipient_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  content TEXT NOT NULL CHECK (char_length(trim(content)) > 0 AND char_length(content) <= 2000),
  is_broadcast BOOLEAN NOT NULL DEFAULT false,
  is_reported BOOLEAN NOT NULL DEFAULT false,
  report_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shift_messages_job_id ON public.shift_messages(job_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_shift_messages_sender ON public.shift_messages(sender_id);

ALTER TABLE public.shift_messages ENABLE ROW LEVEL SECURITY;

-- Helper to check if caller is confirmed worker or supervisor on the job
CREATE OR REPLACE FUNCTION public.can_access_shift_messages(p_job_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.jobs j WHERE j.id = p_job_id AND j.organizer_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM public.bookings b WHERE b.job_id = p_job_id AND b.worker_id = auth.uid() AND b.status IN ('confirmed', 'checked_in', 'checked_out', 'completed', 'completed_awaiting_review')
  ) OR is_current_admin();
$$;

DROP POLICY IF EXISTS "Participants can view shift messages" ON public.shift_messages;
CREATE POLICY "Participants can view shift messages"
ON public.shift_messages FOR SELECT TO authenticated
USING (public.can_access_shift_messages(job_id));

DROP POLICY IF EXISTS "Participants can post shift messages" ON public.shift_messages;
CREATE POLICY "Participants can post shift messages"
ON public.shift_messages FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = sender_id AND public.can_access_shift_messages(job_id)
);

-- 2. REPORT WORKER DELAY RPC
CREATE OR REPLACE FUNCTION public.report_worker_delay_safe(
  p_booking_id UUID,
  p_minutes INTEGER,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_booking RECORD;
  v_job RECORD;
  v_worker_name TEXT;
  v_notif_title TEXT;
  v_notif_body TEXT;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'UNAUTHENTICATED');
  END IF;

  SELECT * INTO v_booking FROM public.bookings WHERE id = p_booking_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'BOOKING_NOT_FOUND');
  END IF;

  IF v_booking.worker_id != v_user_id AND NOT is_current_admin() THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'UNAUTHORIZED');
  END IF;

  IF v_booking.status != 'confirmed' THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'INVALID_STATUS', 'message', 'Delay alerts can only be logged for upcoming confirmed shifts.');
  END IF;

  SELECT * INTO v_job FROM public.jobs WHERE id = v_booking.job_id;
  SELECT full_name INTO v_worker_name FROM public.profiles WHERE id = v_booking.worker_id;

  -- Create late notice shift message broadcast
  INSERT INTO public.shift_messages (
    job_id,
    sender_id,
    content,
    is_broadcast
  ) VALUES (
    v_booking.job_id,
    v_user_id,
    '[DELAY ALERT] ' || COALESCE(v_worker_name, 'Worker') || ' reported expected delay of ' || p_minutes || ' minutes. Reason: ' || COALESCE(p_reason, 'Traffic/Transport delay'),
    true
  );

  -- Send high-priority notification to Organizer
  v_notif_title := 'Worker Running Late: ' || COALESCE(v_worker_name, 'Crew Member');
  v_notif_body := COALESCE(v_worker_name, 'Crew Member') || ' reported a ' || p_minutes || ' min delay for "' || v_job.title || '". Reason: ' || COALESCE(p_reason, 'Traffic/Transit');

  PERFORM public.send_notification_safe(
    v_job.organizer_id,
    v_notif_title,
    v_notif_body,
    'shift_reminder',
    'in_app',
    'delay_' || p_booking_id || '_' || (extract(epoch from now())::BIGINT / 300),
    jsonb_build_object(
      'booking_id', p_booking_id,
      'job_id', v_booking.job_id,
      'delay_minutes', p_minutes,
      'reason', p_reason
    ),
    '/shift/' || v_booking.job_id,
    'high'
  );

  RETURN jsonb_build_object(
    'success', true,
    'booking_id', p_booking_id,
    'delay_minutes', p_minutes,
    'message', 'Delay alert recorded and organizer notified.'
  );
END;
$$;

-- Explicit permissions
REVOKE ALL ON FUNCTION public.can_access_shift_messages(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_access_shift_messages(UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.report_worker_delay_safe(UUID, INTEGER, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.report_worker_delay_safe(UUID, INTEGER, TEXT) TO authenticated;
