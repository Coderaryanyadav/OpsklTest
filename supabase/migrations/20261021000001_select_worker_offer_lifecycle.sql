-- ==============================================================================
-- OPSKL: Organizer "Send Offer" must create selected_awaiting_confirmation,
-- NOT confirmed. Worker acceptance (workerConfirmSelectionSafe / future RPC)
-- transitions to confirmed. Aligns DB with application/booking lifecycle types.
-- ==============================================================================

-- 1) Allow application status used by TypeScript + screening UI
ALTER TYPE application_status ADD VALUE IF NOT EXISTS 'selected_awaiting_confirmation';

-- 2) Authoritative offer RPC (does not confirm; holds capacity via slots_filled)
CREATE OR REPLACE FUNCTION public.select_worker_offer_safe(
  p_job_id UUID,
  p_worker_id UUID,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_organizer_id UUID := auth.uid();
  v_job RECORD;
  v_app RECORD;
  v_existing_booking RECORD;
  v_check_in_code TEXT;
  v_new_booking RECORD;
  v_worker RECORD;
  v_held_until TIMESTAMPTZ := now() + interval '3 hours';
BEGIN
  IF v_organizer_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'UNAUTHENTICATED');
  END IF;

  SELECT * INTO v_job FROM jobs WHERE id = p_job_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'JOB_NOT_FOUND', 'message', 'Shift listing not found.');
  END IF;

  IF v_job.organizer_id != v_organizer_id
     AND NOT is_current_admin()
     AND NOT EXISTS (
       SELECT 1 FROM organizer_memberships
       WHERE organizer_id = v_job.organizer_id
         AND user_id = v_organizer_id
         AND role IN ('owner', 'admin')
     ) THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'UNAUTHORIZED', 'message', 'Not authorized to manage this shift.');
  END IF;

  IF v_job.status NOT IN ('open', 'filling') THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'JOB_NOT_OPEN', 'message', 'Shift is not open for offers.');
  END IF;

  IF (v_job.date < (now() AT TIME ZONE 'Asia/Kolkata')::date)
     OR (v_job.date = (now() AT TIME ZONE 'Asia/Kolkata')::date AND v_job.start_time <= (now() AT TIME ZONE 'Asia/Kolkata')::time) THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'SHIFT_ALREADY_STARTED', 'message', 'Cannot offer workers for a shift whose start time has passed.');
  END IF;

  SELECT p.is_active, wp.verification_status INTO v_worker
  FROM profiles p
  JOIN worker_profiles wp ON wp.id = p.id
  WHERE p.id = p_worker_id;

  IF NOT FOUND OR v_worker.is_active = false THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'INELIGIBLE_WORKER', 'message', 'Worker account is inactive or not found.');
  END IF;

  IF v_worker.verification_status != 'verified' AND NOT is_current_admin() THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'WORKER_NOT_VERIFIED', 'message', 'Worker identity KYC has not been verified.');
  END IF;

  SELECT id, status, check_in_code INTO v_existing_booking
  FROM bookings
  WHERE job_id = p_job_id AND worker_id = p_worker_id;

  IF FOUND THEN
    IF v_existing_booking.status = 'selected_awaiting_confirmation' THEN
      RETURN jsonb_build_object(
        'success', true,
        'booking_id', v_existing_booking.id,
        'check_in_code', v_existing_booking.check_in_code,
        'status', 'selected_awaiting_confirmation',
        'already_offered', true,
        'held_until', v_held_until
      );
    END IF;
    IF v_existing_booking.status = 'confirmed' THEN
      RETURN jsonb_build_object(
        'success', false,
        'error_code', 'ALREADY_CONFIRMED',
        'message', 'Worker is already confirmed for this shift.'
      );
    END IF;
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'EXISTING_BOOKING_STATUS',
      'message', 'Worker already has a booking with status: ' || v_existing_booking.status
    );
  END IF;

  IF v_job.slots_filled >= v_job.slots_total THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'CAPACITY_REACHED', 'message', 'All openings for this shift have already been filled or held.');
  END IF;

  SELECT id, status INTO v_app
  FROM job_applications
  WHERE job_id = p_job_id AND worker_id = p_worker_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'APPLICATION_REQUIRED', 'message', 'Worker must apply before an offer can be sent.');
  END IF;

  IF v_app.status NOT IN ('applied', 'shortlisted') THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'INVALID_APPLICATION_STATUS', 'message', 'Application must be applied or shortlisted to receive an offer.');
  END IF;

  v_check_in_code := 'OP-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));

  INSERT INTO bookings (
    job_id, worker_id, organizer_id, status,
    agreed_hourly_rate, agreed_total_pay, check_in_code
  ) VALUES (
    p_job_id, p_worker_id, v_job.organizer_id, 'selected_awaiting_confirmation',
    v_job.hourly_rate, v_job.total_pay, v_check_in_code
  )
  RETURNING * INTO v_new_booking;

  UPDATE job_applications
  SET status = 'selected_awaiting_confirmation', updated_at = now()
  WHERE id = v_app.id;

  -- Hold capacity until worker accepts or offer is revoked
  UPDATE jobs
  SET
    slots_filled = slots_filled + 1,
    status = CASE WHEN slots_filled + 1 >= slots_total THEN 'filled'::shift_status ELSE 'filling'::shift_status END,
    updated_at = now()
  WHERE id = p_job_id;

  INSERT INTO audit_logs (
    actor_id, action, entity_type, entity_id, new_state
  ) VALUES (
    v_organizer_id, 'SELECT_WORKER_OFFER', 'bookings', v_new_booking.id::TEXT,
    jsonb_build_object(
      'job_id', p_job_id,
      'worker_id', p_worker_id,
      'status', 'selected_awaiting_confirmation',
      'held_until', v_held_until,
      'notes', p_notes
    )
  );

  PERFORM _notify(
    p_worker_id,
    'Shift offer pending your confirmation',
    'You have been selected for: ' || v_job.title || '. Open the app to accept or decline within 3 hours.',
    'worker_selected'
  );

  RETURN jsonb_build_object(
    'success', true,
    'booking_id', v_new_booking.id,
    'check_in_code', v_check_in_code,
    'status', 'selected_awaiting_confirmation',
    'already_offered', false,
    'held_until', v_held_until
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.select_worker_offer_safe(UUID, UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.select_worker_offer_safe(UUID, UUID, TEXT) TO authenticated;
