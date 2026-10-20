-- ==============================================================================
-- OPSKL MANUAL ESCROW PILOT, SUPERVISOR OVERRIDE & FY INVOICE SEQUENCING
-- Migration: 20261020000001_manual_escrow_pilot_and_supervisor_override.sql
-- 
-- Fixes & Features:
-- 1. FLOW-002 (P2-1): Allow supervisor completion sign-off from checked_in
-- 2. FIN-001 (P1-3): In-app UTR payment slip submission for Manual Escrow Pilot SOP
-- 3. FIN-002 (P2-4): Dedicated fiscal-year sequential invoice table with April 1 reset
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. FLOW-002: PERMIT SUPERVISOR COMPLETION SIGN-OFF FROM CHECKED_IN
-- ------------------------------------------------------------------------------

-- Update validate_booking_transition to allow checked_in -> completed
CREATE OR REPLACE FUNCTION public.validate_booking_transition(
  p_current_status text,
  p_new_status text
)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
AS $function$
BEGIN
  IF p_current_status = p_new_status THEN
    RETURN true;
  END IF;

  -- Standard shift lifecycle transitions
  IF p_current_status = 'selected_awaiting_confirmation' AND p_new_status IN ('confirmed', 'cancelled') THEN
    RETURN true;
  ELSIF p_current_status = 'confirmed' AND p_new_status IN ('checked_in', 'cancelled', 'no_show') THEN
    RETURN true;
  -- checked_in can transition to checked_out, completed_awaiting_review, or directly to completed via supervisor sign-off
  ELSIF p_current_status = 'checked_in' AND p_new_status IN ('checked_out', 'completed_awaiting_review', 'completed', 'disputed') THEN
    RETURN true;
  ELSIF p_current_status = 'checked_out' AND p_new_status IN ('completed_awaiting_review', 'completed', 'disputed') THEN
    RETURN true;
  ELSIF p_current_status = 'completed_awaiting_review' AND p_new_status IN ('completed', 'disputed') THEN
    RETURN true;
  ELSIF p_current_status = 'completed' AND p_new_status = 'disputed' THEN
    RETURN true;
  ELSIF p_current_status = 'no_show' AND p_new_status = 'disputed' THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$function$;

-- Update complete_shift_and_approve_attendance to support supervisor sign-off override
CREATE OR REPLACE FUNCTION public.complete_shift_and_approve_attendance(
  p_booking_id UUID,
  p_verified_hours NUMERIC DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_booking RECORD;
  v_job RECORD;
  v_effective_hours NUMERIC;
  v_now TIMESTAMPTZ := now();
BEGIN
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'UNAUTHENTICATED', 'message', 'Authentication required.');
  END IF;

  SELECT * INTO v_booking FROM bookings WHERE id = p_booking_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'BOOKING_NOT_FOUND', 'message', 'Booking not found');
  END IF;

  -- Authorization check: Organizer owner, admin, or team member
  IF v_booking.organizer_id != v_caller_id 
     AND NOT is_current_admin()
     AND NOT EXISTS (
       SELECT 1 FROM organizer_memberships
       WHERE organizer_id = v_booking.organizer_id
         AND user_id = v_caller_id
         AND role IN ('owner', 'admin', 'manager')
     ) THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'UNAUTHORIZED', 'message', 'Only the shift organizer or administrator can approve attendance.');
  END IF;

  IF NOT validate_booking_transition(v_booking.status, 'completed') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'INVALID_TRANSITION',
      'message', 'Cannot approve completion from status ' || v_booking.status
    );
  END IF;

  SELECT * INTO v_job FROM jobs WHERE id = v_booking.job_id;

  -- Calculate effective payable hours
  IF p_verified_hours IS NOT NULL AND p_verified_hours > 0 THEN
    v_effective_hours := p_verified_hours;
  ELSIF v_booking.check_in_time IS NOT NULL THEN
    -- If worker forgot to check out, use shift duration or elapsed time capped at 16h
    v_effective_hours := LEAST(16.0, GREATEST(1.0, round(EXTRACT(EPOCH FROM (v_now - v_booking.check_in_time)) / 3600.0, 2)));
    IF v_job.duration_hours IS NOT NULL AND v_effective_hours > v_job.duration_hours THEN
      v_effective_hours := v_job.duration_hours;
    END IF;
  ELSE
    v_effective_hours := COALESCE(v_job.duration_hours, 8.0);
  END IF;

  -- Update booking with check_out_time and completed status
  UPDATE bookings
  SET
    status = 'completed',
    check_out_time = COALESCE(check_out_time, v_now),
    completed_at = v_now,
    updated_at = v_now
  WHERE id = p_booking_id;

  -- Record supervisor sign-off on attendance records
  UPDATE attendance_records
  SET
    verified_by_supervisor = true,
    supervisor_id = v_caller_id,
    check_out_time = COALESCE(check_out_time, v_now),
    hours_worked = v_effective_hours,
    status = 'completed'
  WHERE booking_id = p_booking_id;

  -- Audit log
  INSERT INTO audit_logs (
    actor_id, action, entity_type, entity_id, old_state, new_state
  ) VALUES (
    v_caller_id, 'SUPERVISOR_SIGN_OFF_ATTENDANCE', 'booking', p_booking_id::TEXT,
    jsonb_build_object('status', v_booking.status),
    jsonb_build_object('status', 'completed', 'verified_hours', v_effective_hours, 'supervisor_id', v_caller_id)
  );

  RETURN jsonb_build_object(
    'success', true,
    'status', 'completed',
    'verified_hours', v_effective_hours,
    'completed_at', v_now
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.complete_shift_and_approve_attendance(UUID, NUMERIC) TO authenticated;

-- ------------------------------------------------------------------------------
-- 2. FIN-001: IN-APP PAYMENT SLIP SUBMISSION FOR MANUAL ESCROW PILOT SOP
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.submit_invoice_payment_reference_safe(
  p_invoice_id UUID,
  p_reference TEXT,
  p_payment_method TEXT DEFAULT 'neft_rtgs'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_invoice RECORD;
  v_clean_ref TEXT := upper(trim(COALESCE(p_reference, '')));
BEGIN
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Authentication required.');
  END IF;

  IF length(v_clean_ref) < 6 OR length(v_clean_ref) > 64 THEN
    RETURN jsonb_build_object('success', false, 'error', 'A valid bank UTR or transaction reference number (6-64 characters) is required.');
  END IF;

  SELECT * INTO v_invoice FROM organizer_invoices WHERE id = p_invoice_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invoice record not found.');
  END IF;

  -- Authorization check: Organizer or admin
  IF v_invoice.organizer_id != v_caller_id 
     AND NOT is_current_admin()
     AND NOT EXISTS (
       SELECT 1 FROM organizer_memberships
       WHERE organizer_id = v_invoice.organizer_id
         AND user_id = v_caller_id
         AND role IN ('owner', 'admin', 'manager')
     ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authorized to submit payment reference for this invoice.');
  END IF;

  IF v_invoice.status NOT IN ('pending', 'overdue') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Payment slip can only be submitted for pending or overdue invoices.');
  END IF;

  -- Record payment reference and provider
  UPDATE organizer_invoices
  SET
    provider_payment_id = v_clean_ref,
    payment_method = CASE WHEN p_payment_method IN ('upi', 'neft_rtgs', 'netbanking') THEN p_payment_method ELSE 'neft_rtgs' END,
    payment_provider = 'manual_reconciliation',
    updated_at = now()
  WHERE id = p_invoice_id;

  INSERT INTO audit_logs (
    actor_id, action, entity_type, entity_id, new_state
  ) VALUES (
    v_caller_id, 'ORGANIZER_SUBMIT_PAYMENT_REF', 'organizer_invoices', p_invoice_id::TEXT,
    jsonb_build_object(
      'invoice_number', v_invoice.invoice_number,
      'reference', v_clean_ref,
      'payment_method', p_payment_method,
      'submitted_at', now()
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'invoice_id', p_invoice_id,
    'invoice_number', v_invoice.invoice_number,
    'reference', v_clean_ref,
    'message', 'Payment reference submitted. Admin will verify receipt and fund escrow.'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_invoice_payment_reference_safe(UUID, TEXT, TEXT) TO authenticated;

-- ------------------------------------------------------------------------------
-- 3. FIN-002: DEDICATED FISCAL-YEAR SEQUENTIAL INVOICE NUMBERING RESET ENGINE
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.invoice_fiscal_sequences (
  fiscal_year TEXT PRIMARY KEY,
  last_sequence INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, UPDATE, INSERT ON public.invoice_fiscal_sequences TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.generate_invoice_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_now TIMESTAMPTZ := now() AT TIME ZONE 'Asia/Kolkata';
  v_month INT := EXTRACT(MONTH FROM v_now);
  v_year INT := EXTRACT(YEAR FROM v_now);
  v_fy_start INT;
  v_fy_end INT;
  v_fy_str TEXT;
  v_seq INT;
BEGIN
  -- Determine Indian fiscal year (April 1 to March 31)
  IF v_month >= 4 THEN
    v_fy_start := v_year % 100;
    v_fy_end := (v_year + 1) % 100;
  ELSE
    v_fy_start := (v_year - 1) % 100;
    v_fy_end := v_year % 100;
  END IF;

  v_fy_str := LPAD(v_fy_start::TEXT, 2, '0') || '-' || LPAD(v_fy_end::TEXT, 2, '0');

  -- Atomic upsert allocating next monotonic sequence number for this fiscal year
  INSERT INTO public.invoice_fiscal_sequences (fiscal_year, last_sequence, updated_at)
  VALUES (v_fy_str, 1, now())
  ON CONFLICT (fiscal_year) DO UPDATE
    SET last_sequence = invoice_fiscal_sequences.last_sequence + 1,
        updated_at = now()
  RETURNING last_sequence INTO v_seq;

  RETURN 'OPS/' || v_fy_str || '/' || LPAD(v_seq::TEXT, 5, '0');
END;
$$;

GRANT EXECUTE ON FUNCTION public.generate_invoice_number() TO authenticated, service_role;
