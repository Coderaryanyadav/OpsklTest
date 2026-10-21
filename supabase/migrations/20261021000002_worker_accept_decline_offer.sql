-- ==============================================================================
-- Worker accept / decline of selected_awaiting_confirmation offers.
-- Client table updates are SELECT-only under RLS; these SECURITY DEFINER RPCs
-- are the authoritative mutation path.
-- ==============================================================================

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

  v_check_in_code := COALESCE(
    NULLIF(v_booking.check_in_code, ''),
    'OP-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10))
  );

  UPDATE bookings
  SET
    status = 'confirmed',
    confirmed_at = COALESCE(confirmed_at, now()),
    check_in_code = v_check_in_code
  WHERE id = v_booking.id
  RETURNING * INTO v_booking;

  UPDATE job_applications
  SET status = 'confirmed', updated_at = now()
  WHERE job_id = v_booking.job_id AND worker_id = v_worker_id
    AND status IN ('applied', 'shortlisted', 'selected_awaiting_confirmation');

  -- Capacity was already held at offer time; do not increment slots_filled again.
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

CREATE OR REPLACE FUNCTION public.worker_decline_selection_safe(
  p_booking_or_job_id UUID,
  p_reason TEXT DEFAULT 'Declined by worker'
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
  v_reason TEXT := NULLIF(trim(COALESCE(p_reason, '')), '');
BEGIN
  IF v_worker_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'UNAUTHENTICATED');
  END IF;

  IF v_reason IS NULL THEN
    v_reason := 'Declined by worker';
  END IF;

  SELECT * INTO v_booking
  FROM bookings
  WHERE worker_id = v_worker_id
    AND (id = p_booking_or_job_id OR job_id = p_booking_or_job_id)
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'BOOKING_NOT_FOUND', 'message', 'No pending offer found to decline.');
  END IF;

  IF v_booking.status NOT IN ('selected_awaiting_confirmation', 'confirmed') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'INVALID_BOOKING_STATUS',
      'message', 'Cannot decline booking in status: ' || v_booking.status
    );
  END IF;

  -- Confirmed bookings past check-in cannot be silently declined here
  IF v_booking.status = 'confirmed' AND v_booking.check_in_time IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'ALREADY_CHECKED_IN',
      'message', 'Cannot decline after check-in. Use cancellation / dispute flows.'
    );
  END IF;

  SELECT * INTO v_job FROM jobs WHERE id = v_booking.job_id FOR UPDATE;

  UPDATE bookings
  SET
    status = 'cancelled',
    cancellation_reason = v_reason,
    cancelled_by = v_worker_id
  WHERE id = v_booking.id;

  UPDATE job_applications
  SET status = 'withdrawn', notes = v_reason, updated_at = now()
  WHERE job_id = v_booking.job_id AND worker_id = v_worker_id;

  -- Release capacity held by the offer / confirmation
  IF v_job.id IS NOT NULL AND v_job.slots_filled > 0 THEN
    UPDATE jobs
    SET
      slots_filled = GREATEST(0, slots_filled - 1),
      status = CASE
        WHEN GREATEST(0, slots_filled - 1) = 0 AND status IN ('filling', 'filled') THEN 'open'::shift_status
        WHEN GREATEST(0, slots_filled - 1) < slots_total AND status = 'filled' THEN 'filling'::shift_status
        ELSE status
      END,
      updated_at = now()
    WHERE id = v_job.id;
  END IF;

  INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, new_state)
  VALUES (
    v_worker_id,
    'WORKER_DECLINE_SELECTION',
    'bookings',
    v_booking.id::TEXT,
    jsonb_build_object('job_id', v_booking.job_id, 'status', 'cancelled', 'reason', v_reason)
  );

  IF v_job.organizer_id IS NOT NULL THEN
    PERFORM _notify(
      v_job.organizer_id,
      'Worker declined shift offer',
      'A selected worker declined: ' || COALESCE(v_job.title, 'shift'),
      'booking_cancelled'
    );
  END IF;

  RETURN jsonb_build_object('success', true, 'booking_id', v_booking.id, 'status', 'cancelled');
END;
$$;

REVOKE EXECUTE ON FUNCTION public.worker_confirm_selection_safe(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.worker_confirm_selection_safe(UUID) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.worker_decline_selection_safe(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.worker_decline_selection_safe(UUID, TEXT) TO authenticated;
