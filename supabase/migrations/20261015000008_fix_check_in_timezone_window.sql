-- Migration: 20261015000008_fix_check_in_timezone_window.sql
-- Description: Fix check_in_worker_safe now() comparison to avoid double-offsetting TIMESTAMPTZ

CREATE OR REPLACE FUNCTION check_in_worker_safe(
  p_booking_id UUID,
  p_code TEXT,
  p_lat NUMERIC DEFAULT NULL,
  p_lng NUMERIC DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_booking RECORD;
  v_job RECORD;
  v_is_supervisor BOOLEAN := false;
  v_distance NUMERIC;
  v_radius_m NUMERIC := 300.0;
  v_shift_start TIMESTAMPTZ;
  v_shift_end TIMESTAMPTZ;
  v_now TIMESTAMPTZ := now();
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'UNAUTHENTICATED');
  END IF;

  SELECT * INTO v_booking FROM bookings WHERE id = p_booking_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'BOOKING_NOT_FOUND');
  END IF;

  SELECT * INTO v_job FROM jobs WHERE id = v_booking.job_id;

  v_is_supervisor := (v_user_id = v_booking.organizer_id OR is_current_admin());

  IF NOT v_is_supervisor AND v_user_id != v_booking.worker_id THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'UNAUTHORIZED');
  END IF;

  IF NOT validate_booking_transition(v_booking.status, 'checked_in') THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'INVALID_TRANSITION', 'message', 'Cannot check in from status ' || v_booking.status);
  END IF;

  -- Time window calculations in IST timezone converted to TIMESTAMPTZ
  v_shift_start := (v_job.date + v_job.start_time) AT TIME ZONE 'Asia/Kolkata';
  v_shift_end := (v_job.date + v_job.end_time + CASE WHEN v_job.end_time <= v_job.start_time THEN interval '1 day' ELSE interval '0' END) AT TIME ZONE 'Asia/Kolkata';

  IF NOT v_is_supervisor THEN
    -- Worker self check-in window: [start - 60 min, start + 120 min]
    IF v_now < (v_shift_start - interval '60 minutes') OR v_now > (v_shift_start + interval '120 minutes') THEN
      RETURN jsonb_build_object(
        'success', false,
        'error_code', 'OUTSIDE_CHECKIN_WINDOW',
        'message', 'Self check-in is permitted between 60 minutes before and 120 minutes after shift call time.'
      );
    END IF;
  ELSE
    -- Supervisor check-in window: [start - 4 hours, end]
    IF v_now < (v_shift_start - interval '4 hours') OR v_now > v_shift_end THEN
      RETURN jsonb_build_object(
        'success', false,
        'error_code', 'OUTSIDE_CHECKIN_WINDOW',
        'message', 'Supervisor check-in permitted only on shift day within operational window.'
      );
    END IF;
  END IF;

  -- Verification credential check
  IF trim(COALESCE(p_code, '')) != trim(COALESCE(v_booking.check_in_code, '')) THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'INVALID_CHECK_IN_CODE', 'message', 'Verification code does not match shift booking.');
  END IF;

  -- GPS and Geofence enforcement
  IF NOT v_is_supervisor THEN
    IF p_lat IS NULL OR p_lng IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error_code', 'LOCATION_REQUIRED', 'message', 'GPS coordinates are required for worker self check-in.');
    END IF;

    IF v_job.latitude IS NULL OR v_job.longitude IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error_code', 'VENUE_COORDINATES_MISSING', 'message', 'Venue coordinates not configured. Supervisor check-in required.');
    END IF;

    -- Haversine calculation in km
    v_distance := round(
      (6371 * acos(
        least(1.0, greatest(-1.0,
          cos(radians(p_lat)) * cos(radians(v_job.latitude)) *
          cos(radians(v_job.longitude) - radians(p_lng)) +
          sin(radians(p_lat)) * sin(radians(v_job.latitude))
        ))
      ))::numeric, 3
    );

    SELECT COALESCE((value->>'checkin_radius_m')::numeric, 300.0) INTO v_radius_m
    FROM platform_settings WHERE key = 'checkin_radius_m';

    IF (v_distance * 1000.0) > v_radius_m THEN
      RETURN jsonb_build_object(
        'success', false,
        'error_code', 'OUT_OF_GEOFENCE_RANGE',
        'message', 'You are outside the venue check-in area (' || round(v_distance * 1000.0) || 'm away, max ' || v_radius_m || 'm allowed).'
      );
    END IF;
  ELSE
    IF p_lat IS NOT NULL AND p_lng IS NOT NULL AND v_job.latitude IS NOT NULL AND v_job.longitude IS NOT NULL THEN
      v_distance := round(
        (6371 * acos(
          least(1.0, greatest(-1.0,
            cos(radians(p_lat)) * cos(radians(v_job.latitude)) *
            cos(radians(v_job.longitude) - radians(p_lng)) +
            sin(radians(p_lat)) * sin(radians(v_job.latitude))
          ))
        ))::numeric, 3
      );
    END IF;
  END IF;

  UPDATE bookings
  SET status = 'checked_in', check_in_time = now()
  WHERE id = p_booking_id;

  INSERT INTO attendance_records (
    booking_id, job_id, worker_id, supervisor_id,
    check_in_time, check_in_code, verified_by_supervisor,
    latitude, longitude, distance_to_venue_km
  ) VALUES (
    p_booking_id, v_booking.job_id, v_booking.worker_id, v_booking.organizer_id,
    now(), p_code, v_is_supervisor,
    p_lat, p_lng, LEAST(v_distance, 999.99)
  );

  PERFORM _notify(
    v_booking.organizer_id,
    'Worker Checked In',
    'Worker has checked in on-site for ' || v_job.title,
    'check_in',
    '/shift/' || v_job.id,
    jsonb_build_object('booking_id', p_booking_id, 'job_id', v_job.id)
  );

  INSERT INTO audit_logs (
    actor_id, action, entity_type, entity_id, new_state
  ) VALUES (
    v_user_id, 'CHECK_IN_WORKER', 'booking', p_booking_id::TEXT,
    jsonb_build_object('distance_km', v_distance, 'supervisor_verified', v_is_supervisor)
  );

  RETURN jsonb_build_object(
    'success', true,
    'status', 'checked_in',
    'check_in_time', now(),
    'distance_km', v_distance
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION check_in_worker_safe(UUID, TEXT, NUMERIC, NUMERIC) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION check_in_worker_safe(UUID, TEXT, NUMERIC, NUMERIC) TO authenticated;
