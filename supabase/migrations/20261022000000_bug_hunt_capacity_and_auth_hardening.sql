-- ==============================================================================
-- OPSKIL MIGRATION: 20261022000000_bug_hunt_capacity_and_auth_hardening.sql
-- Description:
--   1. Authoritative capacity recalculation in cancel_booking_safe to prevent
--      capacity underflow and drift.
--   2. Authoritative capacity recalculation in worker_decline_selection_safe.
--   3. Correct canonical timestamptz instant comparison and batched capacity
--      rebalancing in sweep_expired_worker_offers_safe.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. HARDEN cancel_booking_safe: EXACT DERIVED CAPACITY CALCULATION
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cancel_booking_safe(
  p_booking_id UUID,
  p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_booking RECORD;
  v_job RECORD;
  v_standby RECORD;
  v_active_slots INT;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'UNAUTHENTICATED');
  END IF;

  SELECT * INTO v_booking FROM bookings WHERE id = p_booking_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'BOOKING_NOT_FOUND', 'message', 'Booking not found');
  END IF;

  -- Authorization check: worker, organizer, admin, or organizer team member
  IF v_user_id != v_booking.worker_id 
     AND v_user_id != v_booking.organizer_id 
     AND NOT is_current_admin()
     AND NOT EXISTS (
       SELECT 1 FROM organizer_memberships
       WHERE organizer_id = v_booking.organizer_id
         AND user_id = v_user_id
         AND role IN ('owner', 'admin', 'manager')
     ) THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'UNAUTHORIZED', 'message', 'Not authorized to cancel this booking');
  END IF;

  IF NOT validate_booking_transition(v_booking.status, 'cancelled') THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'INVALID_TRANSITION', 'message', 'Cannot cancel booking in status ' || v_booking.status);
  END IF;

  SELECT * INTO v_job FROM jobs WHERE id = v_booking.job_id FOR UPDATE;

  UPDATE bookings
  SET
    status = 'cancelled',
    cancellation_reason = p_reason,
    cancelled_by = v_user_id,
    updated_at = now()
  WHERE id = p_booking_id;

  -- Update application: withdrawn if worker cancelled, rejected if organizer cancelled
  UPDATE job_applications
  SET status = CASE WHEN v_user_id = v_booking.worker_id THEN 'withdrawn'::application_status ELSE 'rejected'::application_status END,
      updated_at = now()
  WHERE job_id = v_booking.job_id AND worker_id = v_booking.worker_id;

  -- Reopen slot only if job is not terminal, not paused, and date is today or future
  -- Authoritative capacity recalculation:
  SELECT count(*) INTO v_active_slots
  FROM bookings
  WHERE job_id = v_job.id
    AND id <> p_booking_id
    AND status IN ('selected_awaiting_confirmation', 'confirmed', 'checked_in', 'checked_out', 'completed_awaiting_review', 'completed');

  IF v_job.status IN ('filled', 'filling', 'open') AND v_job.date >= (now() AT TIME ZONE 'Asia/Kolkata')::date THEN
    UPDATE jobs
    SET
      slots_filled = v_active_slots,
      status = CASE
        WHEN v_active_slots >= slots_total THEN 'filled'::shift_status
        WHEN v_active_slots > 0 THEN 'filling'::shift_status
        ELSE 'open'::shift_status
      END,
      updated_at = now()
    WHERE id = v_booking.job_id;
  END IF;

  -- Replacement notify shortlisted
  FOR v_standby IN
    SELECT worker_id FROM job_applications WHERE job_id = v_booking.job_id AND status = 'shortlisted'
  LOOP
    PERFORM _notify(
      v_standby.worker_id,
      'Opening Available',
      'A confirmed spot just opened up for ' || v_job.title || '.',
      'standby_callout',
      '/shift/' || v_job.id,
      jsonb_build_object('job_id', v_job.id)
    );
  END LOOP;

  -- Notify other party
  IF v_user_id = v_booking.worker_id THEN
    PERFORM _notify(
      v_booking.organizer_id,
      'Worker Cancelled Booking',
      'A worker has cancelled their booking for ' || v_job.title || '. Reason: ' || p_reason,
      'booking_cancelled',
      '/shift/' || v_job.id,
      jsonb_build_object('job_id', v_job.id, 'booking_id', p_booking_id)
    );
  ELSE
    PERFORM _notify(
      v_booking.worker_id,
      'Booking Cancelled',
      'Your booking for ' || v_job.title || ' has been cancelled by the organizer. Reason: ' || p_reason,
      'booking_cancelled',
      '/shift/' || v_job.id,
      jsonb_build_object('job_id', v_job.id, 'booking_id', p_booking_id)
    );
  END IF;

  INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, new_state)
  VALUES (
    v_user_id,
    'CANCEL_BOOKING',
    'bookings',
    p_booking_id::TEXT,
    jsonb_build_object('job_id', v_booking.job_id, 'reason', p_reason, 'status', 'cancelled')
  );

  RETURN jsonb_build_object('success', true, 'booking_id', p_booking_id, 'status', 'cancelled');
END;
$$;

REVOKE EXECUTE ON FUNCTION public.cancel_booking_safe(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_booking_safe(UUID, TEXT) TO authenticated;

-- ------------------------------------------------------------------------------
-- 2. HARDEN worker_decline_selection_safe: EXACT DERIVED CAPACITY CALCULATION
-- ------------------------------------------------------------------------------
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
  v_active_slots INT;
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
    cancelled_by = v_worker_id,
    updated_at = now()
  WHERE id = v_booking.id;

  UPDATE job_applications
  SET status = 'withdrawn', notes = v_reason, updated_at = now()
  WHERE job_id = v_booking.job_id AND worker_id = v_worker_id;

  -- Release capacity authoritatively from true active bookings
  SELECT count(*) INTO v_active_slots
  FROM bookings
  WHERE job_id = v_job.id
    AND id <> v_booking.id
    AND status IN ('selected_awaiting_confirmation', 'confirmed', 'checked_in', 'checked_out', 'completed_awaiting_review', 'completed');

  IF v_job.id IS NOT NULL AND v_job.status IN ('filled', 'filling', 'open') THEN
    UPDATE jobs
    SET
      slots_filled = v_active_slots,
      status = CASE
        WHEN v_active_slots >= slots_total THEN 'filled'::shift_status
        WHEN v_active_slots > 0 THEN 'filling'::shift_status
        ELSE 'open'::shift_status
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

REVOKE EXECUTE ON FUNCTION public.worker_decline_selection_safe(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.worker_decline_selection_safe(UUID, TEXT) TO authenticated;

-- ------------------------------------------------------------------------------
-- 3. HARDEN sweep_expired_worker_offers_safe: CANONICAL TIME COMPARISONS & EXACT REBALANCING
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sweep_expired_worker_offers_safe(
  p_job_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_expired_rec RECORD;
  v_swept_count INT := 0;
  v_job_ids_affected UUID[] := '{}';
  v_iter_job_id UUID;
  v_active_slots INT;
  v_now_ist_date DATE := (now() AT TIME ZONE 'Asia/Kolkata')::date;
BEGIN
  -- Authenticated user, organizer, admin, or service role / postgres
  IF v_caller_id IS NULL AND COALESCE(auth.role(), '') <> 'service_role' AND current_user <> 'postgres' THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'UNAUTHENTICATED');
  END IF;

  FOR v_expired_rec IN
    SELECT b.id AS booking_id, b.job_id, b.worker_id, b.organizer_id, j.title AS job_title
    FROM bookings b
    JOIN jobs j ON j.id = b.job_id
    WHERE b.status = 'selected_awaiting_confirmation'
      AND (p_job_id IS NULL OR b.job_id = p_job_id)
      AND (
        b.created_at < (now() - interval '3 hours')
        OR (j.date < v_now_ist_date)
        OR (((j.date + j.start_time) AT TIME ZONE 'Asia/Kolkata') <= now())
      )
    FOR UPDATE OF b
  LOOP
    -- Transition booking to cancelled
    UPDATE bookings
    SET
      status = 'cancelled',
      cancellation_reason = 'Offer expired without worker confirmation (3h window exceeded)',
      cancelled_by = v_expired_rec.organizer_id,
      updated_at = now()
    WHERE id = v_expired_rec.booking_id;

    -- Return application to shortlisted state so organizer can reconsider or worker can be re-offered
    UPDATE job_applications
    SET
      status = 'shortlisted',
      updated_at = now()
    WHERE job_id = v_expired_rec.job_id AND worker_id = v_expired_rec.worker_id;

    -- Track affected jobs for atomic capacity recalculation
    IF NOT (v_expired_rec.job_id = ANY(v_job_ids_affected)) THEN
      v_job_ids_affected := array_append(v_job_ids_affected, v_expired_rec.job_id);
    END IF;

    -- Notify worker of offer expiry
    PERFORM _notify(
      v_expired_rec.worker_id,
      'Shift Offer Expired',
      'Your offer window for ' || v_expired_rec.job_title || ' has expired.',
      'offer_expired',
      '/shift/' || v_expired_rec.job_id,
      jsonb_build_object('job_id', v_expired_rec.job_id)
    );

    v_swept_count := v_swept_count + 1;
  END LOOP;

  -- Authoritatively rebalance capacity for all affected jobs
  FOREACH v_iter_job_id IN ARRAY v_job_ids_affected
  LOOP
    SELECT count(*) INTO v_active_slots
    FROM bookings
    WHERE job_id = v_iter_job_id
      AND status IN ('selected_awaiting_confirmation', 'confirmed', 'checked_in', 'checked_out', 'completed_awaiting_review', 'completed');

    UPDATE jobs
    SET
      slots_filled = v_active_slots,
      status = CASE
        WHEN v_active_slots >= slots_total THEN 'filled'::shift_status
        WHEN v_active_slots > 0 THEN 'filling'::shift_status
        ELSE 'open'::shift_status
      END,
      updated_at = now()
    WHERE id = v_iter_job_id;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'swept_count', v_swept_count
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.sweep_expired_worker_offers_safe(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sweep_expired_worker_offers_safe(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sweep_expired_worker_offers_safe(UUID) TO service_role;
