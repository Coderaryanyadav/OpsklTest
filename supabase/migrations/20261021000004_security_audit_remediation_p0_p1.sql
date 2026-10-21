-- ==============================================================================
-- OPSKL AUDIT REMEDIATION: P0 / P1 SECURITY & LIFECYCLE HARDENING
-- Migration: 20261021000004_security_audit_remediation_p0_p1.sql
--
-- 1. P1-01: Permanently drop dangerous register_organizer_direct_safe RPC
-- 2. P1-02: Enforce profiles.is_active = true inside is_current_admin()
-- 3. P1-03: Add offer expiry and schedule overlap checks to worker_confirm_selection_safe
-- 4. P1-05: Enforce organizer ownership / admin authorization in generate_job_invoice_safe
-- 5. P1-06: Authorize payout initiator and require approved attendance & zero active disputes
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. P1-01: REVOKE & DROP register_organizer_direct_safe (Prevents Account Takeover)
-- ------------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.register_organizer_direct_safe(TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
DROP FUNCTION IF EXISTS public.register_organizer_direct_safe(TEXT, TEXT, TEXT, TEXT);

-- ------------------------------------------------------------------------------
-- 2. P1-02: HARDEN is_current_admin() TO REQUIRE ACTIVE PROFILE STATUS
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_current_admin()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO "public"
AS $function$
  SELECT (
    COALESCE(auth.role(), '') = 'service_role'
    OR current_user IN ('postgres', 'service_role', 'supabase_admin')
    OR (current_setting('request.jwt.claim.role', true) = 'service_role')
    OR EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
        AND role = 'admin' 
        AND is_active = true
    )
  );
$function$;

GRANT EXECUTE ON FUNCTION public.is_current_admin() TO anon, authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 3. P1-03: HARDEN worker_confirm_selection_safe (Expiry & Schedule Overlap Guards)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.worker_confirm_selection_safe(
  p_booking_or_job_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_worker_id UUID := auth.uid();
  v_booking RECORD;
  v_job RECORD;
  v_check_in_code TEXT;
  v_now_ist TIMESTAMPTZ := now() AT TIME ZONE 'Asia/Kolkata';
BEGIN
  IF v_worker_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'UNAUTHENTICATED');
  END IF;

  SELECT * INTO v_booking
  FROM bookings
  WHERE worker_id = v_worker_id
    AND (id = p_booking_or_job_id OR job_id = p_booking_or_job_id)
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'BOOKING_NOT_FOUND', 'message', 'No pending offer found for this shift.');
  END IF;

  IF v_booking.status = 'confirmed' THEN
    RETURN jsonb_build_object(
      'success', true,
      'booking_id', v_booking.id,
      'status', 'confirmed',
      'check_in_code', v_booking.check_in_code,
      'already_confirmed', true
    );
  END IF;

  IF v_booking.status <> 'selected_awaiting_confirmation' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'INVALID_BOOKING_STATUS',
      'message', 'Only offers awaiting confirmation can be accepted. Current status: ' || v_booking.status
    );
  END IF;

  SELECT * INTO v_job FROM jobs WHERE id = v_booking.job_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'JOB_NOT_FOUND');
  END IF;

  IF v_job.status NOT IN ('open', 'filling', 'filled') THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'JOB_NOT_OPEN', 'message', 'Shift is no longer available for confirmation.');
  END IF;

  -- Gap O2 Guard: Enforce 3-hour offer expiry window and shift start threshold
  IF (v_booking.created_at < (now() - interval '3 hours'))
     OR (v_job.date < v_now_ist::date)
     OR (v_job.date = v_now_ist::date AND v_job.start_time <= v_now_ist::time) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'OFFER_EXPIRED',
      'message', 'Shift offer has expired. The 3-hour confirmation window or shift start time has passed.'
    );
  END IF;

  -- Gap O1 Guard: Prevent double-booking / schedule conflict
  IF EXISTS (
    SELECT 1 FROM bookings b2
    JOIN jobs j2 ON j2.id = b2.job_id
    WHERE b2.worker_id = v_worker_id
      AND b2.status IN ('confirmed', 'checked_in')
      AND b2.id <> v_booking.id
      AND j2.date = v_job.date
      AND (
        (j2.start_time, j2.end_time) OVERLAPS (v_job.start_time, v_job.end_time)
      )
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'SCHEDULE_CONFLICT',
      'message', 'You already have another confirmed shift scheduled during these hours.'
    );
  END IF;

  v_check_in_code := COALESCE(
    NULLIF(v_booking.check_in_code, ''),
    'OP-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10))
  );

  UPDATE bookings
  SET
    status = 'confirmed',
    confirmed_at = COALESCE(confirmed_at, now()),
    check_in_code = v_check_in_code,
    updated_at = now()
  WHERE id = v_booking.id
  RETURNING * INTO v_booking;

  UPDATE job_applications
  SET status = 'confirmed', updated_at = now()
  WHERE job_id = v_booking.job_id AND worker_id = v_worker_id
    AND status IN ('applied', 'shortlisted', 'selected_awaiting_confirmation');

  UPDATE jobs
  SET
    status = CASE
      WHEN slots_filled >= slots_total THEN 'filled'::shift_status
      WHEN slots_filled > 0 THEN 'filling'::shift_status
      ELSE status
    END,
    updated_at = now()
  WHERE id = v_job.id;

  INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, new_state)
  VALUES (
    v_worker_id,
    'WORKER_CONFIRM_SELECTION',
    'bookings',
    v_booking.id::TEXT,
    jsonb_build_object('job_id', v_booking.job_id, 'status', 'confirmed')
  );

  PERFORM _notify(
    v_job.organizer_id,
    'Worker accepted shift offer',
    'A selected worker confirmed: ' || v_job.title,
    'booking_confirmed'
  );

  RETURN jsonb_build_object(
    'success', true,
    'booking_id', v_booking.id,
    'status', 'confirmed',
    'check_in_code', v_check_in_code,
    'already_confirmed', false
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.worker_confirm_selection_safe(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.worker_confirm_selection_safe(UUID) TO authenticated;

-- ------------------------------------------------------------------------------
-- 4. P1-05: HARDEN generate_job_invoice_safe (Authorize Organizer / Admin)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION generate_job_invoice_safe(
  p_job_id UUID,
  p_organizer_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job RECORD;
  v_existing RECORD;
  v_wage_total NUMERIC(10, 2);
  v_fee_pct NUMERIC(5, 2);
  v_gst_pct NUMERIC(5, 2);
  v_platform_fee NUMERIC(10, 2);
  v_gst_amount NUMERIC(10, 2);
  v_total_payable NUMERIC(10, 2);
  v_invoice_number TEXT;
  v_invoice_id UUID;
  v_due_date TIMESTAMPTZ;
BEGIN
  SELECT id, organizer_id, total_pay, slots_total, date INTO v_job FROM jobs WHERE id = p_job_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Job not found.');
  END IF;

  -- Authorization check: Caller must be job organizer, admin, or service_role
  IF auth.uid() IS NOT NULL 
     AND auth.uid() <> v_job.organizer_id 
     AND NOT is_current_admin() 
     AND COALESCE(auth.role(), '') <> 'service_role' THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'UNAUTHORIZED', 'error', 'Not authorized to generate invoice for this shift.');
  END IF;

  -- Idempotency check: refuse to alter totals if already funded or settled
  SELECT * INTO v_existing FROM organizer_invoices WHERE job_id = p_job_id;
  IF FOUND THEN
    IF v_existing.status IN ('escrow_funded', 'settled') THEN
      RETURN jsonb_build_object(
        'success', true,
        'invoice_id', v_existing.id,
        'invoice_number', v_existing.invoice_number,
        'status', v_existing.status,
        'total_payable', v_existing.total_payable,
        'immutable', true
      );
    END IF;
  END IF;

  -- Dynamic fee & GST percentages
  SELECT COALESCE(
    CASE 
      WHEN jsonb_typeof(value) = 'number' THEN (value)::text::numeric
      WHEN jsonb_typeof(value) = 'string' THEN (value#>>'{}')::numeric
      ELSE (value->>'platform_fee_percent')::numeric
    END, 
    10.00
  ) INTO v_fee_pct
  FROM platform_settings WHERE key IN ('platform_fee_percent', 'platform_fee')
  LIMIT 1;

  IF v_fee_pct IS NULL THEN v_fee_pct := 10.00; END IF;

  SELECT COALESCE(
    CASE 
      WHEN jsonb_typeof(value) = 'number' THEN (value)::text::numeric
      WHEN jsonb_typeof(value) = 'string' THEN (value#>>'{}')::numeric
      ELSE (value->>'gst_rate_percent')::numeric
    END, 
    18.00
  ) INTO v_gst_pct
  FROM platform_settings WHERE key IN ('gst_rate_percent', 'gst_rate')
  LIMIT 1;

  IF v_gst_pct IS NULL THEN v_gst_pct := 18.00; END IF;

  v_wage_total := round(v_job.total_pay * v_job.slots_total, 2);
  v_platform_fee := round(v_wage_total * (v_fee_pct / 100.0), 2);
  v_gst_amount := round(v_platform_fee * (v_gst_pct / 100.0), 2);
  v_total_payable := v_wage_total + v_platform_fee + v_gst_amount;

  v_due_date := LEAST(
    now() + interval '3 days',
    (v_job.date - 1)::timestamp AT TIME ZONE 'Asia/Kolkata'
  );

  IF v_existing.id IS NOT NULL THEN
    UPDATE organizer_invoices
    SET
      wage_total = v_wage_total,
      platform_fee = v_platform_fee,
      gst_amount = v_gst_amount,
      total_payable = v_total_payable,
      due_date = v_due_date,
      status = 'issued',
      updated_at = now()
    WHERE id = v_existing.id
    RETURNING id INTO v_invoice_id;

    RETURN jsonb_build_object(
      'success', true,
      'invoice_id', v_invoice_id, 
      'invoice_number', v_existing.invoice_number,
      'wage_total', v_wage_total,
      'platform_fee', v_platform_fee,
      'gst_amount', v_gst_amount,
      'total_payable', v_total_payable
    );
  END IF;

  v_invoice_number := generate_invoice_number();

  INSERT INTO organizer_invoices (
    invoice_number, job_id, organizer_id,
    wage_total, platform_fee, gst_amount, total_payable,
    status, due_date
  ) VALUES (
    v_invoice_number, p_job_id, v_job.organizer_id,
    v_wage_total, v_platform_fee, v_gst_amount, v_total_payable,
    'issued', v_due_date
  )
  RETURNING id INTO v_invoice_id;

  RETURN jsonb_build_object(
    'success', true,
    'invoice_id', v_invoice_id,
    'invoice_number', v_invoice_number,
    'wage_total', v_wage_total,
    'platform_fee', v_platform_fee,
    'gst_amount', v_gst_amount,
    'total_payable', v_total_payable
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION generate_job_invoice_safe(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION generate_job_invoice_safe(UUID, UUID) TO authenticated;

-- ------------------------------------------------------------------------------
-- 5. P1-06: HARDEN initiate_worker_payout_safe (Ownership, Approved Pay & Dispute Block)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION initiate_worker_payout_safe(
  p_booking_id UUID,
  p_upi_id TEXT,
  p_idempotency_key TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_booking RECORD;
  v_job RECORD;
  v_invoice RECORD;
  v_existing RECORD;
  v_worker_upi TEXT;
  v_payout_amount NUMERIC(10, 2);
  v_payment_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Authentication required.');
  END IF;

  SELECT * INTO v_booking FROM bookings WHERE id = p_booking_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Booking not found.');
  END IF;

  -- Caller authorization: Must be the shift organizer, admin, or service_role
  IF auth.uid() <> v_booking.organizer_id 
     AND NOT is_current_admin() 
     AND COALESCE(auth.role(), '') <> 'service_role' THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'UNAUTHORIZED', 'error', 'Not authorized to initiate payout for this booking.');
  END IF;

  IF v_booking.status != 'completed' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Attendance must be completed before payout initiation.');
  END IF;

  -- Must have approved attendance pay (cannot fall back to unverified estimate)
  IF v_booking.approved_total_pay IS NULL OR v_booking.approved_total_pay <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Attendance hours and payout must be approved by organizer before initiation.');
  END IF;

  -- Disallow payout initiation if an open dispute exists
  IF EXISTS (
    SELECT 1 FROM disputes 
    WHERE booking_id = p_booking_id 
      AND status NOT IN ('resolved', 'dismissed')
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot initiate payout while an attendance dispute is under investigation.');
  END IF;

  -- Require invoice escrow funded
  SELECT * INTO v_invoice FROM organizer_invoices WHERE job_id = v_booking.job_id;
  IF NOT FOUND OR v_invoice.status != 'escrow_funded' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Job escrow invoice must be funded prior to initiating payouts.');
  END IF;

  SELECT upi_id INTO v_worker_upi FROM worker_profiles WHERE id = v_booking.worker_id;
  IF v_worker_upi IS NULL OR trim(v_worker_upi) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Worker has no verified UPI payout destination.');
  END IF;

  v_payout_amount := v_booking.approved_total_pay;

  SELECT * INTO v_existing FROM payment_records WHERE booking_id = p_booking_id;
  IF FOUND THEN
    IF v_existing.status NOT IN ('pending', 'failed') THEN
      RETURN jsonb_build_object('success', true, 'payment_id', v_existing.id, 'status', v_existing.status);
    END IF;

    UPDATE payment_records
    SET status = 'escrow_locked', amount = v_payout_amount, net_payout = v_payout_amount, updated_at = now()
    WHERE id = v_existing.id
    RETURNING id INTO v_payment_id;
  ELSE
    INSERT INTO payment_records (
      booking_id, job_id, worker_id, organizer_id,
      amount, platform_fee, net_payout, status, upi_id
    ) VALUES (
      p_booking_id, v_booking.job_id, v_booking.worker_id, v_booking.organizer_id,
      v_payout_amount, 0.00, v_payout_amount, 'escrow_locked', v_worker_upi
    ) RETURNING id INTO v_payment_id;
  END IF;

  INSERT INTO audit_logs (
    actor_id, action, entity_type, entity_id, new_state
  ) VALUES (
    auth.uid(), 'INITIATE_WORKER_PAYOUT', 'payment_records', v_payment_id::TEXT,
    jsonb_build_object('amount', v_payout_amount, 'status', 'escrow_locked')
  );

  RETURN jsonb_build_object(
    'success', true,
    'payment_id', v_payment_id,
    'amount', v_payout_amount,
    'status', 'escrow_locked'
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION initiate_worker_payout_safe(UUID, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION initiate_worker_payout_safe(UUID, TEXT, TEXT) TO authenticated;
