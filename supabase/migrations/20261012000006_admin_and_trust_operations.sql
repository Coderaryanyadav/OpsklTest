-- ============================================================================
-- OPSKL ADMIN & TRUST OPERATIONS ENGINE (PHASE 8)
-- Trust & Safety escalation queue, verification review, dispute adjudication,
-- platform configuration, immutable audit logs, and strict server RBAC
-- ============================================================================

-- 1. SAFETY & INCIDENT REPORTS TABLE
CREATE TABLE IF NOT EXISTS safety_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reported_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  job_id UUID REFERENCES jobs(id) ON DELETE SET NULL,
  category TEXT NOT NULL CHECK (category IN ('safety', 'harassment', 'wage_theft', 'unsafe_conditions', 'fraud', 'other')),
  severity TEXT NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  description TEXT NOT NULL,
  evidence_urls TEXT[] DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'investigating', 'resolved', 'escalated', 'dismissed')),
  staff_notes TEXT,
  action_taken TEXT,
  resolved_by UUID REFERENCES profiles(id),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. PLATFORM CONFIGURATION TABLE
CREATE TABLE IF NOT EXISTS platform_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  description TEXT,
  updated_by UUID REFERENCES profiles(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed baseline configuration
INSERT INTO platform_settings (key, value, description)
VALUES 
  ('platform_fee_percent', '10.0'::jsonb, 'Standard Opskl marketplace service fee percentage charged to organizers'),
  ('gst_rate_percent', '18.0'::jsonb, 'Indian GST rate applied strictly to the platform service fee (SAC 998519)'),
  ('min_hourly_wage_inr', '100.0'::jsonb, 'Enforced minimum hourly wage floor in INR to protect workers from sub-minimum wages'),
  ('payment_gateway_mode', '"sandbox"'::jsonb, 'Payment gateway execution mode ("sandbox" or "live")'),
  ('dlt_sms_header', '"OPSKIL"'::jsonb, 'TRAI DLT-registered 6-character Alpha sender header')
ON CONFLICT (key) DO NOTHING;

-- 3. INDEXES
CREATE INDEX IF NOT EXISTS idx_safety_reports_status ON safety_reports(status);
CREATE INDEX IF NOT EXISTS idx_safety_reports_severity ON safety_reports(severity);
CREATE INDEX IF NOT EXISTS idx_disputes_status ON disputes(status);
CREATE INDEX IF NOT EXISTS idx_verification_cases_status ON verification_cases(status);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC);

-- 4. RLS POLICIES FOR SAFETY REPORTS & SETTINGS
ALTER TABLE safety_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can create safety reports"
  ON safety_reports FOR INSERT
  WITH CHECK (auth.uid() = reporter_id);

CREATE POLICY "Users can view their own filed safety reports"
  ON safety_reports FOR SELECT
  USING (auth.uid() = reporter_id);

CREATE POLICY "Admins have full access to safety reports"
  ON safety_reports FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Public read platform settings"
  ON platform_settings FOR SELECT
  USING (true);

CREATE POLICY "Admins manage platform settings"
  ON platform_settings FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- 5. RPC: ADMIN RESOLVE DISPUTE SAFE (WITH REASON & AUDIT)
CREATE OR REPLACE FUNCTION admin_resolve_dispute_safe(
  p_dispute_id UUID,
  p_status TEXT,
  p_resolution_notes TEXT,
  p_adjusted_payout NUMERIC DEFAULT NULL,
  p_admin_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dispute RECORD;
  v_booking RECORD;
  v_admin_id UUID := auth.uid();
  v_admin_role user_role;
BEGIN
  -- 1. Strictly derive caller identity from auth.uid()
  IF v_admin_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Authentication required.');
  END IF;

  -- Disallow caller spoofing another administrator identity
  IF p_admin_id IS NOT NULL AND p_admin_id != v_admin_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized. Caller cannot specify a different administrator identity.');
  END IF;

  -- Verify actual caller has administrator role
  SELECT role INTO v_admin_role
  FROM profiles
  WHERE id = v_admin_id;

  IF v_admin_role IS NULL OR v_admin_role != 'admin' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized. Requires administrator role.');
  END IF;

  SELECT * INTO v_dispute
  FROM disputes
  WHERE id = p_dispute_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Dispute not found');
  END IF;

  SELECT * INTO v_booking
  FROM bookings
  WHERE id = v_dispute.booking_id;

  -- Update dispute
  UPDATE disputes
  SET
    status = p_status,
    resolution_notes = p_resolution_notes,
    resolved_by = v_admin_id,
    resolved_at = now()
  WHERE id = p_dispute_id;

  -- If resolved, update booking status to completed
  IF p_status = 'resolved' THEN
    UPDATE bookings
    SET
      status = 'completed',
      completed_at = COALESCE(completed_at, now())
    WHERE id = v_dispute.booking_id;

    -- Update or adjust payout record if requested
    IF p_adjusted_payout IS NOT NULL AND p_adjusted_payout >= 0 THEN
      UPDATE payment_records
      SET
        amount = p_adjusted_payout,
        net_payout = p_adjusted_payout,
        status = 'escrow_locked'
      WHERE booking_id = v_dispute.booking_id;
    END IF;
  END IF;

  -- Immutable audit log
  INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, changes)
  VALUES (
    v_admin_id,
    'admin_resolve_dispute',
    'disputes',
    p_dispute_id,
    jsonb_build_object(
      'status', p_status,
      'resolution_notes', p_resolution_notes,
      'adjusted_payout', p_adjusted_payout
    )
  );

  RETURN jsonb_build_object('success', true, 'dispute_id', p_dispute_id, 'status', p_status);
END;
$$;

-- 6. RPC: ADMIN VERIFY CASE SAFE (WITH AUDIT)
CREATE OR REPLACE FUNCTION admin_verify_case_safe(
  p_case_id UUID,
  p_status TEXT,
  p_rejection_reason TEXT DEFAULT NULL,
  p_admin_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_case RECORD;
  v_admin_id UUID := auth.uid();
  v_admin_role user_role;
BEGIN
  IF v_admin_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Authentication required.');
  END IF;

  IF p_admin_id IS NOT NULL AND p_admin_id != v_admin_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized. Caller cannot specify a different administrator identity.');
  END IF;

  SELECT role INTO v_admin_role
  FROM profiles
  WHERE id = v_admin_id;

  IF v_admin_role IS NULL OR v_admin_role != 'admin' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized. Requires administrator role.');
  END IF;

  SELECT * INTO v_case
  FROM verification_cases
  WHERE id = p_case_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Verification case not found');
  END IF;

  UPDATE verification_cases
  SET
    status = p_status,
    rejection_reason = p_rejection_reason,
    reviewed_by = v_admin_id,
    reviewed_at = now()
  WHERE id = p_case_id;

  -- Update target profile verification status
  IF p_status = 'approved' THEN
    -- Check if worker profile
    UPDATE worker_profiles
    SET
      is_aadhaar_verified = CASE WHEN v_case.document_type = 'aadhaar' THEN true ELSE is_aadhaar_verified END,
      is_pan_verified = CASE WHEN v_case.document_type = 'pan' THEN true ELSE is_pan_verified END,
      verification_status = 'verified',
      updated_at = now()
    WHERE id = v_case.profile_id;

    -- Check if organizer profile
    UPDATE organizer_profiles
    SET
      is_gstin_verified = CASE WHEN v_case.document_type = 'gstin' THEN true ELSE is_gstin_verified END,
      verification_status = 'verified',
      updated_at = now()
    WHERE id = v_case.profile_id;
  END IF;

  -- Immutable audit log
  INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, changes)
  VALUES (
    v_admin_id,
    'admin_verify_document',
    'verification_cases',
    p_case_id,
    jsonb_build_object(
      'status', p_status,
      'document_type', v_case.document_type,
      'profile_id', v_case.profile_id,
      'rejection_reason', p_rejection_reason
    )
  );

  RETURN jsonb_build_object('success', true, 'case_id', p_case_id, 'status', p_status);
END;
$$;

-- 7. RPC: ADMIN MODERATE JOB SAFE (WITH REASON & AUDIT)
CREATE OR REPLACE FUNCTION admin_moderate_job_safe(
  p_job_id UUID,
  p_new_status shift_status,
  p_moderation_reason TEXT,
  p_admin_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job RECORD;
  v_admin_id UUID := auth.uid();
  v_admin_role user_role;
BEGIN
  IF v_admin_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Authentication required.');
  END IF;

  IF p_admin_id IS NOT NULL AND p_admin_id != v_admin_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized. Caller cannot specify a different administrator identity.');
  END IF;

  SELECT role INTO v_admin_role
  FROM profiles
  WHERE id = v_admin_id;

  IF v_admin_role IS NULL OR v_admin_role != 'admin' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized. Requires administrator role.');
  END IF;

  SELECT * INTO v_job
  FROM jobs
  WHERE id = p_job_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Job not found');
  END IF;

  UPDATE jobs
  SET
    status = p_new_status,
    updated_at = now()
  WHERE id = p_job_id;

  -- Immutable audit log
  INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, changes)
  VALUES (
    v_admin_id,
    'admin_moderate_job',
    'jobs',
    p_job_id,
    jsonb_build_object(
      'old_status', v_job.status,
      'new_status', p_new_status,
      'moderation_reason', p_moderation_reason
    )
  );

  RETURN jsonb_build_object('success', true, 'job_id', p_job_id, 'status', p_new_status);
END;
$$;

-- 8. RPC: ADMIN RESOLVE SAFETY REPORT SAFE (WITH AUDIT)
CREATE OR REPLACE FUNCTION admin_resolve_safety_report_safe(
  p_report_id UUID,
  p_status TEXT,
  p_action_taken TEXT,
  p_staff_notes TEXT,
  p_admin_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_report RECORD;
  v_admin_id UUID := auth.uid();
  v_admin_role user_role;
BEGIN
  IF v_admin_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Authentication required.');
  END IF;

  IF p_admin_id IS NOT NULL AND p_admin_id != v_admin_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized. Caller cannot specify a different administrator identity.');
  END IF;

  SELECT role INTO v_admin_role
  FROM profiles
  WHERE id = v_admin_id;

  IF v_admin_role IS NULL OR v_admin_role != 'admin' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized. Requires administrator role.');
  END IF;

  SELECT * INTO v_report
  FROM safety_reports
  WHERE id = p_report_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Safety report not found');
  END IF;

  UPDATE safety_reports
  SET
    status = p_status,
    action_taken = p_action_taken,
    staff_notes = p_staff_notes,
    resolved_by = v_admin_id,
    resolved_at = now()
  WHERE id = p_report_id;

  -- Immutable audit log
  INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, changes)
  VALUES (
    v_admin_id,
    'admin_resolve_safety_report',
    'safety_reports',
    p_report_id,
    jsonb_build_object(
      'status', p_status,
      'action_taken', p_action_taken,
      'severity', v_report.severity
    )
  );

  RETURN jsonb_build_object('success', true, 'report_id', p_report_id, 'status', p_status);
END;
$$;

-- 9. RESTRICT EXECUTION OF ADMINISTRATIVE FUNCTIONS
REVOKE EXECUTE ON FUNCTION admin_resolve_dispute_safe(UUID, TEXT, TEXT, NUMERIC, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION admin_resolve_dispute_safe(UUID, TEXT, TEXT, NUMERIC, UUID) TO authenticated;

REVOKE EXECUTE ON FUNCTION admin_verify_case_safe(UUID, TEXT, TEXT, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION admin_verify_case_safe(UUID, TEXT, TEXT, UUID) TO authenticated;

REVOKE EXECUTE ON FUNCTION admin_moderate_job_safe(UUID, shift_status, TEXT, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION admin_moderate_job_safe(UUID, shift_status, TEXT, UUID) TO authenticated;

REVOKE EXECUTE ON FUNCTION admin_resolve_safety_report_safe(UUID, TEXT, TEXT, TEXT, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION admin_resolve_safety_report_safe(UUID, TEXT, TEXT, TEXT, UUID) TO authenticated;

-- 10. RPC: USER REQUEST ACCOUNT DELETION SAFE (WITH COMPLIANCE AUDIT)
CREATE OR REPLACE FUNCTION request_account_deletion_safe(
  p_reason TEXT DEFAULT 'User requested account deletion in-app'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_now TIMESTAMPTZ := now();
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Authentication required.');
  END IF;

  -- Record authoritative audit record for compliance and archival
  INSERT INTO audit_logs (
    actor_id,
    action,
    entity_type,
    entity_id,
    changes,
    created_at
  ) VALUES (
    v_user_id,
    'account_deletion_requested',
    'profile',
    v_user_id::text,
    jsonb_build_object(
      'reason', p_reason,
      'requested_at', v_now,
      'source', 'mobile_app_in_app_action'
    ),
    v_now
  );

  RETURN jsonb_build_object('success', true, 'requested_at', v_now);
END;
$$;

REVOKE EXECUTE ON FUNCTION request_account_deletion_safe(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION request_account_deletion_safe(TEXT) TO authenticated;

