-- ==============================================================================
-- OPSKIL DATABASE MIGRATION: 20261021000003_organizer_applications_and_capacity_sweep.sql
-- Resolves:
--   1. Candidate profile visibility in organizer screening via get_organizer_applications_safe RPC
--   2. Enforce organizer team membership authorization in cancel_booking_safe
--   3. Automated sweep & release of expired worker selection offers (sweep_expired_worker_offers_safe)
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. AUTHORITATIVE get_organizer_applications_safe RPC
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_organizer_applications_safe(
  p_organizer_id UUID DEFAULT NULL,
  p_job_id UUID DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  job_id UUID,
  worker_id UUID,
  status TEXT,
  applied_at TIMESTAMPTZ,
  notes TEXT,
  job_title TEXT,
  job_organizer_id UUID,
  job_date DATE,
  job_start_time TIME,
  job_end_time TIME,
  job_hourly_rate NUMERIC,
  job_total_pay NUMERIC,
  job_slots_total INT,
  job_slots_filled INT,
  worker_full_name TEXT,
  worker_phone TEXT,
  worker_avatar_url TEXT,
  worker_rating NUMERIC,
  worker_shifts_completed INT,
  worker_preferred_locality TEXT,
  worker_skills TEXT[],
  worker_verification_status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_effective_org_id UUID := COALESCE(p_organizer_id, v_caller_id);
BEGIN
  IF v_caller_id IS NULL AND COALESCE(auth.role(), '') <> 'service_role' AND current_user <> 'postgres' THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    ja.id,
    ja.job_id,
    ja.worker_id,
    ja.status::TEXT,
    ja.applied_at,
    ja.notes,
    j.title AS job_title,
    j.organizer_id AS job_organizer_id,
    j.date AS job_date,
    j.start_time AS job_start_time,
    j.end_time AS job_end_time,
    j.hourly_rate AS job_hourly_rate,
    j.total_pay AS job_total_pay,
    j.slots_total AS job_slots_total,
    j.slots_filled AS job_slots_filled,
    COALESCE(p.full_name, 'Verified Candidate') AS worker_full_name,
    CASE
      -- Phone is only revealed once worker is confirmed on roster
      WHEN ja.status = 'confirmed' THEN COALESCE(p.phone, '')
      WHEN p.phone IS NOT NULL AND length(p.phone) >= 4 THEN
        '+91 ••••• •' || right(p.phone, 4)
      ELSE '+91 ••••• •••••'
    END AS worker_phone,
    p.avatar_url AS worker_avatar_url,
    COALESCE(wp.rating, 5.0) AS worker_rating,
    COALESCE(wp.shifts_completed, 0) AS worker_shifts_completed,
    COALESCE(wp.preferred_locality, 'Mumbai MMR') AS worker_preferred_locality,
    COALESCE(wp.skills, ARRAY[]::TEXT[]) AS worker_skills,
    COALESCE(wp.verification_status, 'unverified')::TEXT AS worker_verification_status
  FROM job_applications ja
  JOIN jobs j ON j.id = ja.job_id
  LEFT JOIN profiles p ON p.id = ja.worker_id
  LEFT JOIN worker_profiles wp ON wp.id = ja.worker_id
  WHERE (p_job_id IS NULL OR ja.job_id = p_job_id)
    AND (
      is_current_admin()
      OR j.organizer_id = v_caller_id
      OR EXISTS (
        SELECT 1 FROM organizer_memberships om
        WHERE om.organizer_id = j.organizer_id
          AND om.user_id = v_caller_id
          AND om.role IN ('owner', 'admin', 'manager')
      )
    )
  ORDER BY ja.applied_at DESC;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_organizer_applications_safe(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_organizer_applications_safe(UUID, UUID) TO authenticated;

-- ------------------------------------------------------------------------------
-- 2. HARDEN cancel_booking_safe: ENFORCE organizer_memberships AUTHORIZATION
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
  IF v_job.status IN ('filled', 'filling', 'open') AND v_job.date >= (now() AT TIME ZONE 'Asia/Kolkata')::date THEN
    UPDATE jobs
    SET
      slots_filled = GREATEST(0, slots_filled - 1),
      status = CASE WHEN slots_filled - 1 > 0 THEN 'filling'::shift_status ELSE 'open'::shift_status END,
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
-- 3. CAPACITY RECOVERY: sweep_expired_worker_offers_safe
-- Reclaims capacity held by offers awaiting confirmation older than 3 hours or past shift start
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
  v_now_ist TIMESTAMPTZ := now() AT TIME ZONE 'Asia/Kolkata';
BEGIN
  -- Authenticated user, organizer, admin, or background worker
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
        OR (j.date < v_now_ist::date)
        OR (j.date = v_now_ist::date AND j.start_time <= v_now_ist::time)
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

    -- Reopen held capacity on shift
    UPDATE jobs
    SET
      slots_filled = GREATEST(0, slots_filled - 1),
      status = CASE
        WHEN slots_filled - 1 > 0 THEN 'filling'::shift_status
        ELSE 'open'::shift_status
      END,
      updated_at = now()
    WHERE id = v_expired_rec.job_id;

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

  RETURN jsonb_build_object(
    'success', true,
    'swept_count', v_swept_count
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.sweep_expired_worker_offers_safe(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sweep_expired_worker_offers_safe(UUID) TO authenticated;
