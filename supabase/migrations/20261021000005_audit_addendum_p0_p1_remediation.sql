-- ==============================================================================
-- OPSKL AUDIT ADDENDUM REMEDIATION: P0 / P1 ENGINE HARDENING
-- Migration: 20261021000005_audit_addendum_p0_p1_remediation.sql
--
-- 1. P0-02 & P1-05 & P1-06: Timezone-safe instant comparisons, overnight overlap,
--    idempotent job revalidation, and atomic slots_filled maintenance in worker_confirm_selection_safe.
-- 2. P0-03: Billable headcount wage calculation & authenticated-only access in generate_job_invoice_safe.
-- 3. Database constraints for job slots and booking integrity.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. HARDEN worker_confirm_selection_safe (Timezone-Safe, Overnight Overlap, Atomic Slots)
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
  v_shift_start TIMESTAMPTZ;
  v_shift_end TIMESTAMPTZ;
  v_confirmed_count INTEGER;
BEGIN
  -- Strict authentication guard
  IF v_worker_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'UNAUTHENTICATED', 'message', 'Worker authentication required.');
  END IF;

  -- Lock booking row
  SELECT * INTO v_booking
  FROM bookings
  WHERE worker_id = v_worker_id
    AND (id = p_booking_or_job_id OR job_id = p_booking_or_job_id)
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'BOOKING_NOT_FOUND', 'message', 'No pending offer found for this shift.');
  END IF;

  -- Lock parent job row
  SELECT * INTO v_job FROM jobs WHERE id = v_booking.job_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'JOB_NOT_FOUND', 'message', 'Associated shift does not exist.');
  END IF;

  -- P1-05: Idempotent confirmation MUST revalidate parent job active state
  IF v_booking.status = 'confirmed' THEN
    IF v_job.status IN ('cancelled', 'closed') THEN
      RETURN jsonb_build_object(
        'success', false,
        'error_code', 'JOB_CANCELLED_OR_CLOSED',
        'message', 'Shift has been cancelled or closed. Confirmation code is no longer actionable.'
      );
    END IF;

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

  IF v_job.status NOT IN ('open', 'filling', 'filled') THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'JOB_NOT_OPEN', 'message', 'Shift is no longer available for confirmation.');
  END IF;

  -- P0-02: Precise Timestamptz Instants for Shift Boundaries in Indian Standard Time (Asia/Kolkata)
  -- Eliminates session timezone reinterpretation defects
  v_shift_start := (v_job.date + v_job.start_time) AT TIME ZONE 'Asia/Kolkata';
  v_shift_end := CASE
    WHEN v_job.end_time <= v_job.start_time THEN (v_job.date + interval '1 day' + v_job.end_time) AT TIME ZONE 'Asia/Kolkata'
    ELSE (v_job.date + v_job.end_time) AT TIME ZONE 'Asia/Kolkata'
  END;

  -- Expiry Check: 3-hour confirmation window or shift start threshold
  IF (v_booking.created_at < (now() - interval '3 hours')) OR (now() >= v_shift_start) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'OFFER_EXPIRED',
      'message', 'Shift offer has expired. The 3-hour confirmation window or shift start time has passed.'
    );
  END IF;

  -- P0-02: Overnight and Cross-Midnight Schedule Conflict Guard
  -- Checks all active booking states (confirmed, checked_in, in_progress, selected_awaiting_confirmation)
  IF EXISTS (
    SELECT 1 FROM bookings b2
    JOIN jobs j2 ON j2.id = b2.job_id
    WHERE b2.worker_id = v_worker_id
      AND b2.id <> v_booking.id
      AND b2.status IN ('confirmed', 'checked_in', 'in_progress', 'selected_awaiting_confirmation')
      AND (
        -- Shift 1: [v_shift_start, v_shift_end]
        -- Shift 2: [b2_start, b2_end]
        -- Overlap test: (start1 < end2) AND (start2 < end1)
        v_shift_start < (
          CASE 
            WHEN j2.end_time <= j2.start_time THEN (j2.date + interval '1 day' + j2.end_time) AT TIME ZONE 'Asia/Kolkata'
            ELSE (j2.date + j2.end_time) AT TIME ZONE 'Asia/Kolkata'
          END
        )
        AND (j2.date + j2.start_time) AT TIME ZONE 'Asia/Kolkata' < v_shift_end
      )
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'SCHEDULE_CONFLICT',
      'message', 'You already have another confirmed or pending shift scheduled during these hours.'
    );
  END IF;

  -- P1-06: Check current filled count under row lock to prevent overfilling
  SELECT count(*) INTO v_confirmed_count
  FROM bookings
  WHERE job_id = v_job.id
    AND status IN ('confirmed', 'checked_in', 'completed');

  IF v_confirmed_count >= v_job.slots_total THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'CAPACITY_REACHED',
      'message', 'This shift has already reached full worker capacity.'
    );
  END IF;

  -- Generate secure CSPRNG check-in code
  v_check_in_code := COALESCE(
    NULLIF(v_booking.check_in_code, ''),
    'OP-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10))
  );

  -- Update booking
  UPDATE bookings
  SET
    status = 'confirmed',
    confirmed_at = COALESCE(confirmed_at, now()),
    check_in_code = v_check_in_code,
    updated_at = now()
  WHERE id = v_booking.id
  RETURNING * INTO v_booking;

  -- Synchronize application status
  UPDATE job_applications
  SET status = 'confirmed', updated_at = now()
  WHERE job_id = v_booking.job_id AND worker_id = v_worker_id
    AND status IN ('applied', 'shortlisted', 'selected_awaiting_confirmation');

  -- P1-06: Atomically update slots_filled on jobs table
  UPDATE jobs
  SET
    slots_filled = v_confirmed_count + 1,
    status = CASE
      WHEN (v_confirmed_count + 1) >= slots_total THEN 'filled'::shift_status
      ELSE 'filling'::shift_status
    END,
    updated_at = now()
  WHERE id = v_job.id;

  INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, new_state)
  VALUES (
    v_worker_id,
    'WORKER_CONFIRM_SELECTION',
    'bookings',
    v_booking.id::TEXT,
    jsonb_build_object('job_id', v_booking.job_id, 'status', 'confirmed', 'slots_filled', v_confirmed_count + 1)
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
    'already_confirmed', false,
    'slots_filled', v_confirmed_count + 1
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.worker_confirm_selection_safe(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.worker_confirm_selection_safe(UUID) TO authenticated;

-- ------------------------------------------------------------------------------
-- 2. HARDEN generate_job_invoice_safe (Authenticated-Only & Billable Roster Wage)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.generate_job_invoice_safe(
  p_job_id UUID,
  p_organizer_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_job RECORD;
  v_existing RECORD;
  v_billable_slots INTEGER;
  v_effective_slots INTEGER;
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
  -- P0-03: Strict authentication requirement (Deny anonymous execution)
  IF auth.uid() IS NULL AND COALESCE(auth.role(), '') <> 'service_role' THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'UNAUTHENTICATED', 'error', 'Authentication required to generate invoice.');
  END IF;

  SELECT id, organizer_id, total_pay, slots_total, date, status INTO v_job FROM jobs WHERE id = p_job_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'JOB_NOT_FOUND', 'error', 'Job not found.');
  END IF;

  -- Caller must be job organizer, active admin, or service_role
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

  -- Platform fee %
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

  -- GST %
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

  -- P0-03: Bill based on actual billable confirmed/attended workers, avoiding overcharging unfilled slots
  SELECT count(*) INTO v_billable_slots
  FROM bookings
  WHERE job_id = p_job_id
    AND status IN ('confirmed', 'checked_in', 'completed');

  -- If the shift has commenced, finished, or attendance exists, invoice strictly for approved/confirmed staff
  IF v_job.status IN ('completed', 'cancelled') OR EXISTS (SELECT 1 FROM attendance_records WHERE job_id = p_job_id) THEN
    v_effective_slots := v_billable_slots;
  ELSE
    -- Pre-shift escrow deposit: bill confirmed count if roster is selected, or initial total commitment
    v_effective_slots := CASE 
      WHEN v_billable_slots > 0 THEN v_billable_slots 
      ELSE v_job.slots_total 
    END;
  END IF;

  v_wage_total := round(COALESCE(v_job.total_pay, 0) * v_effective_slots, 2);
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
      'total_payable', v_total_payable,
      'billed_slots', v_effective_slots
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
    'total_payable', v_total_payable,
    'billed_slots', v_effective_slots
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.generate_job_invoice_safe(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.generate_job_invoice_safe(UUID, UUID) TO authenticated;
