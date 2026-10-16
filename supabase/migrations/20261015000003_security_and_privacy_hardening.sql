-- ==============================================================================
-- OPSKIL DATABASE MIGRATION: 20261015000003_security_and_privacy_hardening.sql
-- Resolution for Audit P0/P1 Security, Privacy, and Data Exposure Findings:
--   1. Secure process_payment_webhook_safe: enforce service_role caller
--   2. Fix process_account_deletion_purge_safe authorization check
--   3. Revoke broad SELECT on admin views; expose strictly via admin-guarded RPCs
--   4. Filter public_jobs view to active/upcoming shifts (status in open/filling & date >= CURRENT_DATE)
--   5. Support guest discovery safely on public_jobs and get_discovery_feed
--   6. Initialize verification-documents private storage bucket and RLS policies
--   7. Standardize user-scoped KYC storage path validation
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. SECURE PAYMENT WEBHOOK: RESTRICT TO SERVICE_ROLE & REJECT CLIENT EXECUTION
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION process_payment_webhook_safe(
  p_provider TEXT,
  p_event_id TEXT,
  p_event_type TEXT,
  p_payload JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_jwt_role TEXT := current_setting('request.jwt.claim.role', true);
  v_existing_event RECORD;
  v_order_id TEXT;
  v_payment_id TEXT;
  v_amount NUMERIC(10, 2);
  v_invoice RECORD;
  v_gateway_mode TEXT := 'sandbox';
BEGIN
  -- Strict caller authorization: Must be service_role or superuser
  IF v_jwt_role IS NOT NULL AND v_jwt_role != 'service_role' AND session_user NOT IN ('postgres', 'service_role') THEN
    RAISE EXCEPTION 'Unauthorized: Webhook processing is restricted to service_role credentials';
  END IF;

  -- Idempotency check
  SELECT id, status INTO v_existing_event
  FROM payment_webhook_events
  WHERE event_id = p_event_id;

  IF FOUND THEN
    IF v_existing_event.status = 'processed' THEN
      RETURN jsonb_build_object('success', true, 'duplicate', true, 'event_id', p_event_id);
    END IF;
  ELSE
    INSERT INTO payment_webhook_events (
      provider, event_id, event_type, payload, status
    ) VALUES (
      p_provider, p_event_id, p_event_type, p_payload, 'pending'
    );
  END IF;

  -- Razorpay / Sandbox payload parsing
  IF p_provider = 'razorpay' THEN
    v_order_id := p_payload->'payload'->'payment'->'entity'->>'order_id';
    v_payment_id := p_payload->'payload'->'payment'->'entity'->>'id';
    -- Razorpay amounts arrive in paise; convert safely to INR
    v_amount := (COALESCE((p_payload->'payload'->'payment'->'entity'->>'amount')::NUMERIC, 0.00)) / 100.00;
  ELSE
    -- Generic / Mock test provider
    v_order_id := p_payload->>'order_id';
    v_payment_id := p_payload->>'payment_id';
    v_amount := COALESCE((p_payload->>'amount')::NUMERIC, 0.00);
  END IF;

  -- Reconcile matching invoice
  SELECT * INTO v_invoice
  FROM organizer_invoices
  WHERE invoice_number = v_order_id OR id::TEXT = v_order_id;

  IF NOT FOUND THEN
    UPDATE payment_webhook_events
    SET status = 'failed', error_message = 'Invoice not found for order ' || COALESCE(v_order_id, 'null')
    WHERE event_id = p_event_id;

    RETURN jsonb_build_object('success', false, 'error', 'Invoice not found');
  END IF;

  IF p_event_type = 'payment.captured' OR p_event_type = 'payment_success' THEN
    IF v_amount >= v_invoice.total_payable THEN
      -- Fund escrow
      UPDATE organizer_invoices
      SET
        status = 'escrow_funded',
        escrow_funded_at = now(),
        payment_reference = v_payment_id,
        updated_at = now()
      WHERE id = v_invoice.id;

      UPDATE payment_webhook_events
      SET status = 'processed', processed_at = now()
      WHERE event_id = p_event_id;

      INSERT INTO payment_reconciliation_logs (
        invoice_id, event_type, expected_amount, received_amount, status, metadata
      ) VALUES (
        v_invoice.id, p_event_type, v_invoice.total_payable, v_amount, 'reconciled',
        jsonb_build_object('provider', p_provider, 'payment_id', v_payment_id)
      );

      RETURN jsonb_build_object('success', true, 'invoice_id', v_invoice.id, 'status', 'escrow_funded');
    ELSE
      -- Discrepancy: underpaid
      UPDATE payment_webhook_events
      SET status = 'discrepancy', error_message = 'Underpaid amount'
      WHERE event_id = p_event_id;

      INSERT INTO payment_reconciliation_logs (
        invoice_id, event_type, expected_amount, received_amount, status, metadata
      ) VALUES (
        v_invoice.id, p_event_type, v_invoice.total_payable, v_amount, 'discrepancy',
        jsonb_build_object('provider', p_provider, 'payment_id', v_payment_id, 'shortfall', v_invoice.total_payable - v_amount)
      );

      RETURN jsonb_build_object('success', false, 'error', 'Payment amount discrepancy recorded');
    END IF;
  END IF;

  UPDATE payment_webhook_events
  SET status = 'processed', processed_at = now()
  WHERE event_id = p_event_id;

  RETURN jsonb_build_object('success', true, 'event_id', p_event_id);
END;
$$;

REVOKE EXECUTE ON FUNCTION process_payment_webhook_safe(TEXT, TEXT, TEXT, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION process_payment_webhook_safe(TEXT, TEXT, TEXT, JSONB) TO service_role;

-- ------------------------------------------------------------------------------
-- 2. FIX ACCOUNT DELETION PURGE AUTHORIZATION CHECK
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION process_account_deletion_purge_safe(p_batch_size INT DEFAULT 50)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_jwt_role TEXT := current_setting('request.jwt.claim.role', true);
  v_rec RECORD;
  v_purged_count INT := 0;
BEGIN
  -- Strict caller verification: service_role or admin user only
  IF NOT (
    is_current_admin()
    OR v_jwt_role = 'service_role'
    OR session_user IN ('postgres', 'service_role')
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized. Requires service role or admin credentials.');
  END IF;

  PERFORM set_config('opskl.trusted', '1', true);

  FOR v_rec IN
    SELECT user_id FROM account_deletion_requests
    WHERE status = 'queued' AND scheduled_purge_at <= now()
    ORDER BY scheduled_purge_at ASC
    LIMIT p_batch_size
  LOOP
    -- Null GPS and location data in attendance records
    UPDATE attendance_records
    SET latitude = NULL, longitude = NULL, distance_to_venue_km = NULL
    WHERE worker_id = v_rec.user_id;

    -- Redact sensitive text in disputes, reviews, and safety reports
    UPDATE reviews SET comment = '[Redacted pursuant to user account deletion]' WHERE reviewer_id = v_rec.user_id;
    UPDATE disputes SET details = '[Redacted]' WHERE raised_by = v_rec.user_id;
    UPDATE safety_reports SET description = '[Redacted]' WHERE reporter_id = v_rec.user_id;

    -- Delete user push tokens
    DELETE FROM user_push_tokens WHERE user_id = v_rec.user_id;

    -- Anonymize core profile
    UPDATE profiles
    SET
      full_name = 'Deleted User ' || substr(v_rec.user_id::TEXT, 1, 6),
      phone = NULL,
      email = 'deleted_' || substr(v_rec.user_id::TEXT, 1, 8) || '@deleted.opskil.internal',
      avatar_url = NULL,
      is_active = false,
      updated_at = now()
    WHERE id = v_rec.user_id;

    -- Anonymize worker / organizer details
    UPDATE worker_profiles SET upi_id = NULL, bio = NULL WHERE id = v_rec.user_id;
    UPDATE organizer_profiles SET gstin = NULL, billing_address = NULL, business_contact_phone = NULL WHERE id = v_rec.user_id;

    UPDATE account_deletion_requests SET status = 'purged', updated_at = now() WHERE user_id = v_rec.user_id;
    v_purged_count := v_purged_count + 1;
  END LOOP;

  RETURN jsonb_build_object('success', true, 'purged_count', v_purged_count);
END;
$$;

REVOKE EXECUTE ON FUNCTION process_account_deletion_purge_safe(INT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION process_account_deletion_purge_safe(INT) TO service_role;

-- ------------------------------------------------------------------------------
-- 3. REVOKE BROAD VIEW ACCESS & RESTRICT ADMIN REPORTING TO AUTHORIZED RPCS
-- ------------------------------------------------------------------------------

-- Revoke direct view access from normal users
REVOKE SELECT ON public.admin_overview_metrics FROM PUBLIC, anon, authenticated;
REVOKE SELECT ON public.admin_audit_logs_view FROM PUBLIC, anon, authenticated;

-- Create admin-guarded overview metrics RPC
CREATE OR REPLACE FUNCTION get_admin_overview_metrics()
RETURNS TABLE (
  gmv_inr NUMERIC,
  platform_fees_inr NUMERIC,
  escrow_held_inr NUMERIC,
  active_shifts BIGINT,
  total_workers BIGINT,
  pending_verifications BIGINT,
  open_disputes BIGINT,
  open_safety_reports BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT is_current_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Only platform administrators can view overview metrics';
  END IF;

  RETURN QUERY SELECT * FROM public.admin_overview_metrics;
END;
$$;

REVOKE EXECUTE ON FUNCTION get_admin_overview_metrics() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION get_admin_overview_metrics() TO authenticated;

-- Create admin-guarded audit logs RPC with pagination
CREATE OR REPLACE FUNCTION get_admin_audit_logs(p_limit INT DEFAULT 50, p_offset INT DEFAULT 0)
RETURNS TABLE (
  id UUID,
  actor_id UUID,
  actor_email TEXT,
  actor_role TEXT,
  action TEXT,
  entity_type TEXT,
  entity_id TEXT,
  old_state JSONB,
  payload JSONB,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT is_current_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Only platform administrators can view audit logs';
  END IF;

  RETURN QUERY
    SELECT
      al.id,
      al.actor_id,
      p.email AS actor_email,
      p.role AS actor_role,
      al.action,
      al.entity_type,
      al.entity_id,
      al.old_state,
      COALESCE(al.changes, al.new_state) AS payload,
      al.created_at
    FROM audit_logs al
    LEFT JOIN profiles p ON p.id = al.actor_id
    ORDER BY al.created_at DESC
    LIMIT p_limit OFFSET p_offset;
END;
$$;

REVOKE EXECUTE ON FUNCTION get_admin_audit_logs(INT, INT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION get_admin_audit_logs(INT, INT) TO authenticated;

-- ------------------------------------------------------------------------------
-- 4. PUBLIC_JOBS VIEW: FILTER OUT DRAFT, CANCELLED, AND PAST-DATED SHIFTS
-- ------------------------------------------------------------------------------

DROP VIEW IF EXISTS public.public_jobs CASCADE;
CREATE OR REPLACE VIEW public.public_jobs WITH (security_invoker = true) AS
  SELECT
    id,
    organizer_id,
    title,
    category,
    venue_name,
    venue_address,
    landmark,
    city,
    zone,
    date,
    start_time,
    end_time,
    duration_hours,
    hourly_rate,
    total_pay,
    wage_per_worker,
    slots_total,
    slots_filled,
    dress_code,
    duties,
    perks,
    required_skills,
    eligibility_criteria,
    application_deadline,
    breaks_minutes,
    meal_provided,
    transport_provided,
    overtime_policy,
    latitude,
    longitude,
    status,
    created_at,
    updated_at
  FROM jobs
  WHERE status IN ('open', 'filling')
    AND date >= CURRENT_DATE;

GRANT SELECT ON public.public_jobs TO anon, authenticated;

-- Ensure underlying table allows anon guest discovery on public_jobs
DROP POLICY IF EXISTS "Anyone can view open public jobs" ON jobs;
CREATE POLICY "Anyone can view open public jobs"
  ON jobs FOR SELECT TO anon, authenticated
  USING (status IN ('open', 'filling') AND date >= CURRENT_DATE);

-- Permit guest discovery feed RPC
GRANT EXECUTE ON FUNCTION get_discovery_feed(JSONB, INT, JSONB) TO anon, authenticated;

-- ------------------------------------------------------------------------------
-- 5. INITIALIZE VERIFICATION-DOCUMENTS PRIVATE STORAGE BUCKET & RLS POLICIES
-- ------------------------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'verification-documents',
  'verification-documents',
  false,
  10485760, -- 10MB
  ARRAY['application/pdf', 'image/jpeg', 'image/png']
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 10485760,
  allowed_mime_types = ARRAY['application/pdf', 'image/jpeg', 'image/png'];

DROP POLICY IF EXISTS "Users upload own verification documents" ON storage.objects;
CREATE POLICY "Users upload own verification documents"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'verification-documents'
    AND (
      (storage.foldername(name))[1] = auth.uid()::TEXT
      OR name LIKE (auth.uid()::TEXT || '/%')
      OR name LIKE ('kyc/' || auth.uid()::TEXT || '/%')
      OR name LIKE ('verification/' || auth.uid()::TEXT || '/%')
    )
  );

DROP POLICY IF EXISTS "Users read own verification documents" ON storage.objects;
CREATE POLICY "Users read own verification documents"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'verification-documents'
    AND (
      (storage.foldername(name))[1] = auth.uid()::TEXT
      OR name LIKE (auth.uid()::TEXT || '/%')
      OR name LIKE ('kyc/' || auth.uid()::TEXT || '/%')
      OR name LIKE ('verification/' || auth.uid()::TEXT || '/%')
      OR is_current_admin()
    )
  );

DROP POLICY IF EXISTS "Admins full manage verification documents" ON storage.objects;
CREATE POLICY "Admins full manage verification documents"
  ON storage.objects FOR ALL TO authenticated
  USING (
    bucket_id = 'verification-documents'
    AND is_current_admin()
  );

-- ------------------------------------------------------------------------------
-- 6. STANDARDIZE KYC STORAGE PATH VALIDATION IN SUBMIT_VERIFICATION_CASE_SAFE
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION submit_verification_case_safe(
  p_document_type TEXT,
  p_masked_id TEXT,
  p_storage_path TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_case_id UUID;
  v_user_str TEXT;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Authentication required.');
  END IF;

  v_user_str := v_user_id::TEXT;

  IF p_document_type NOT IN ('aadhaar', 'pan', 'gstin') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Document type must be aadhaar, pan, or gstin.');
  END IF;

  -- Storage path security: must be strictly scoped to caller's user directory
  IF NOT (
    p_storage_path LIKE (v_user_str || '/%')
    OR p_storage_path LIKE ('kyc/' || v_user_str || '/%')
    OR p_storage_path LIKE ('verification/' || v_user_str || '/%')
    OR p_storage_path LIKE ('verification/%/' || v_user_str || '.%')
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Storage path must be scoped to your authenticated user directory.');
  END IF;

  -- Reject if pending case already exists for this document type
  IF EXISTS (
    SELECT 1 FROM verification_cases
    WHERE profile_id = v_user_id AND document_type = p_document_type AND status = 'pending'
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'A verification case is already pending review for this document type.');
  END IF;

  INSERT INTO verification_cases (
    profile_id, document_type, document_number_masked, document_storage_path, status
  ) VALUES (
    v_user_id, p_document_type, p_masked_id, p_storage_path, 'pending'
  ) RETURNING id INTO v_case_id;

  -- Update profile status to pending
  PERFORM set_config('opskl.trusted', '1', true);
  UPDATE worker_profiles SET verification_status = 'pending', updated_at = now() WHERE id = v_user_id;
  UPDATE organizer_profiles SET verification_status = 'pending', updated_at = now() WHERE id = v_user_id;

  RETURN jsonb_build_object('success', true, 'case_id', v_case_id, 'status', 'pending');
END;
$$;

REVOKE EXECUTE ON FUNCTION submit_verification_case_safe(TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION submit_verification_case_safe(TEXT, TEXT, TEXT) TO authenticated;
