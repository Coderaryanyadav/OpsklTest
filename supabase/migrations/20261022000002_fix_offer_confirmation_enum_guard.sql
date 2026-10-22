-- ==============================================================================
-- OPSKL MIGRATION: 20261022000002_fix_offer_confirmation_enum_guard.sql
--
-- worker_confirm_selection_safe compared jobs.status against the literal
-- 'closed', which is not a member of the shift_status enum. Re-confirming an
-- already-confirmed booking therefore raised:
--   invalid input value for enum shift_status: "closed"
-- This recreates the function with only valid terminal states.
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
    IF v_job.status IN ('cancelled', 'completed') THEN
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
