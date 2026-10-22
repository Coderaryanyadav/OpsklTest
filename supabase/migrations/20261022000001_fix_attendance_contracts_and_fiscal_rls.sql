-- ==============================================================================
-- OPSKL MIGRATION: 20261022000001_fix_attendance_contracts_and_fiscal_rls.sql
--
-- Reproduced against a fresh disposable Postgres database:
--   1. bookings.updated_at is referenced by confirm/cancel/decline/sweep/
--      check-in/complete/dispute RPCs but never existed -> every lifecycle
--      mutation failed at runtime with SQLSTATE 42703.
--   2. check_in_worker_safe wrote non-existent attendance_records columns and
--      omitted NOT NULL job_id/worker_id.
--   3. complete_shift_and_approve_attendance had TWO overloads (uuid,numeric)
--      and (uuid,numeric,boolean,text), making a 2-argument call ambiguous
--      (PGRST203), and the newer body wrote non-existent columns while
--      dropping approved_total_pay calculation.
--   4. invoice_fiscal_sequences had RLS disabled and DML granted to
--      authenticated, allowing invoice sequence tampering.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. RESTORE bookings.updated_at (systemic lifecycle contract)
-- ------------------------------------------------------------------------------
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();

DROP TRIGGER IF EXISTS trg_bookings_updated_at ON public.bookings;
CREATE TRIGGER trg_bookings_updated_at
  BEFORE UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION update_timestamp();

ALTER TABLE public.payment_records
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

DROP TRIGGER IF EXISTS trg_payment_records_updated_at ON public.payment_records;
CREATE TRIGGER trg_payment_records_updated_at
  BEFORE UPDATE ON public.payment_records
  FOR EACH ROW EXECUTE FUNCTION update_timestamp();

-- ------------------------------------------------------------------------------
-- 1b. is_current_admin(): current_user inside SECURITY DEFINER is the function
-- owner (postgres), so the previous check made every caller an admin.
-- Authorization must derive only from the verified JWT role/claims.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_current_admin()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO "public", pg_temp
AS $function$
  SELECT (
    COALESCE(auth.role(), '') = 'service_role'
    OR COALESCE(current_setting('request.jwt.claim.role', true), '') = 'service_role'
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role = 'admin'
        AND is_active = true
    )
  );
$function$;

REVOKE EXECUTE ON FUNCTION public.is_current_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_current_admin() TO anon, authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 2. CHECK-IN: correct attendance columns, idempotent, NOT NULL identifiers
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.check_in_worker_safe(
  p_booking_id UUID,
  p_code TEXT,
  p_lat NUMERIC DEFAULT NULL,
  p_lng NUMERIC DEFAULT NULL
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
  v_distance NUMERIC := NULL;
  v_is_supervisor BOOLEAN := false;
  v_now TIMESTAMPTZ := now();
  v_shift_start_ist TIMESTAMPTZ;
  v_existing_attendance RECORD;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'UNAUTHENTICATED', 'message', 'Authentication required.');
  END IF;

  SELECT * INTO v_booking
  FROM bookings
  WHERE id = p_booking_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'BOOKING_NOT_FOUND', 'message', 'Booking record not found');
  END IF;

  -- Idempotent replay: never insert a second attendance row.
  IF v_booking.status = 'checked_in' THEN
    SELECT * INTO v_existing_attendance
    FROM attendance_records
    WHERE booking_id = p_booking_id
    ORDER BY created_at ASC
    LIMIT 1;

    RETURN jsonb_build_object(
      'success', true,
      'booking_id', p_booking_id,
      'status', 'checked_in',
      'check_in_time', COALESCE(v_existing_attendance.check_in_time, v_booking.check_in_time),
      'distance_km', v_existing_attendance.distance_to_venue_km,
      'already_checked_in', true
    );
  END IF;

  IF NOT validate_booking_transition(v_booking.status, 'checked_in') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'INVALID_TRANSITION',
      'message', 'Cannot check in. Current booking status is ' || v_booking.status
    );
  END IF;

  SELECT * INTO v_job FROM jobs WHERE id = v_booking.job_id;

  -- Authorization: worker, organizer, admin, or organizer team member
  IF v_user_id <> v_booking.worker_id
     AND v_user_id <> v_booking.organizer_id
     AND NOT is_current_admin()
     AND NOT EXISTS (
       SELECT 1 FROM organizer_memberships
       WHERE organizer_id = v_booking.organizer_id
         AND user_id = v_user_id
         AND role IN ('owner', 'admin', 'manager')
     ) THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'UNAUTHORIZED', 'message', 'Not authorized for this booking');
  END IF;

  v_is_supervisor := (
    v_user_id = v_booking.organizer_id
    OR is_current_admin()
    OR EXISTS (
      SELECT 1 FROM organizer_memberships
      WHERE organizer_id = v_booking.organizer_id
        AND user_id = v_user_id
        AND role IN ('owner', 'admin', 'manager')
    )
  );

  IF NOT v_is_supervisor THEN
    IF NOT EXISTS (
      SELECT 1 FROM worker_profiles wp
      JOIN profiles p ON p.id = wp.id
      WHERE wp.id = v_booking.worker_id
        AND wp.verification_status = 'verified'
        AND p.is_active = true
    ) THEN
      RETURN jsonb_build_object(
        'success', false,
        'error_code', 'WORKER_NOT_VERIFIED',
        'message', 'Worker identity verification must be active and approved to check in.'
      );
    END IF;
  END IF;

  IF p_code IS NULL OR length(trim(p_code)) < 4 OR length(trim(p_code)) > 32 THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'INVALID_CODE', 'message', 'A valid shift check-in code or pass credential is required.');
  END IF;

  IF NOT v_is_supervisor THEN
    IF v_booking.check_in_code IS NULL THEN
      RETURN jsonb_build_object(
        'success', false,
        'error_code', 'CHECK_IN_CREDENTIAL_NOT_PROVISIONED',
        'message', 'Shift credential has not been generated for this booking.'
      );
    END IF;

    IF upper(trim(p_code)) <> upper(trim(v_booking.check_in_code)) THEN
      RETURN jsonb_build_object(
        'success', false,
        'error_code', 'INVALID_CHECK_IN_CODE',
        'message', 'The check-in code entered does not match this booking.'
      );
    END IF;
  END IF;

  v_shift_start_ist := (v_job.date + v_job.start_time) AT TIME ZONE 'Asia/Kolkata';
  IF v_now < (v_shift_start_ist - interval '2 hours') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'CHECK_IN_TOO_EARLY',
      'message', 'Check-in opens 2 hours before scheduled shift start time.'
    );
  END IF;

  -- Geofence is mandatory for self check-in when the venue has coordinates.
  IF NOT v_is_supervisor AND v_job.latitude IS NOT NULL AND v_job.longitude IS NOT NULL THEN
    IF p_lat IS NULL OR p_lng IS NULL THEN
      RETURN jsonb_build_object(
        'success', false,
        'error_code', 'GPS_COORDINATES_REQUIRED',
        'message', 'GPS coordinates are required to verify on-site arrival.'
      );
    END IF;
  END IF;

  IF p_lat IS NOT NULL AND p_lng IS NOT NULL AND v_job.latitude IS NOT NULL AND v_job.longitude IS NOT NULL THEN
    v_distance := round((
      6371 * acos(
        least(1.0, greatest(-1.0,
          cos(radians(v_job.latitude)) * cos(radians(p_lat)) *
          cos(radians(p_lng) - radians(v_job.longitude)) +
          sin(radians(v_job.latitude)) * sin(radians(p_lat))
        ))
      )
    )::NUMERIC, 2);

    IF NOT v_is_supervisor AND v_distance > 0.30 THEN
      RETURN jsonb_build_object(
        'success', false,
        'error_code', 'OUT_OF_GEOFENCE_RANGE',
        'message', 'You are ' || round(v_distance * 1000) || 'm away from the venue. You must be within 300m to check in.'
      );
    END IF;
  END IF;

  UPDATE bookings
  SET
    status = 'checked_in',
    check_in_time = COALESCE(check_in_time, v_now)
  WHERE id = p_booking_id;

  -- attendance_records has latitude/longitude (not worker_*) and no status column.
  UPDATE attendance_records
  SET
    check_in_time = COALESCE(check_in_time, v_now),
    check_in_code = upper(trim(p_code)),
    latitude = COALESCE(p_lat, latitude),
    longitude = COALESCE(p_lng, longitude),
    distance_to_venue_km = COALESCE(v_distance, distance_to_venue_km),
    verified_by_supervisor = v_is_supervisor,
    supervisor_id = CASE WHEN v_is_supervisor THEN v_user_id ELSE supervisor_id END
  WHERE booking_id = p_booking_id;

  IF NOT FOUND THEN
    INSERT INTO attendance_records (
      booking_id, job_id, worker_id, check_in_time, check_in_code,
      latitude, longitude, distance_to_venue_km,
      verified_by_supervisor, supervisor_id
    ) VALUES (
      p_booking_id, v_booking.job_id, v_booking.worker_id, v_now, upper(trim(p_code)),
      p_lat, p_lng, v_distance,
      v_is_supervisor, CASE WHEN v_is_supervisor THEN v_user_id ELSE NULL END
    );
  END IF;

  INSERT INTO audit_logs (
    actor_id, action, entity_type, entity_id, new_state
  ) VALUES (
    v_user_id, 'CHECK_IN_WORKER', 'booking', p_booking_id::TEXT,
    jsonb_build_object(
      'status', 'checked_in',
      'check_in_time', v_now,
      'is_supervisor', v_is_supervisor,
      'distance_km', v_distance
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'booking_id', p_booking_id,
    'status', 'checked_in',
    'check_in_time', v_now,
    'distance_km', v_distance,
    'already_checked_in', false
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.check_in_worker_safe(UUID, TEXT, NUMERIC, NUMERIC) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.check_in_worker_safe(UUID, TEXT, NUMERIC, NUMERIC) TO authenticated;

-- ------------------------------------------------------------------------------
-- 3. COMPLETION: remove ambiguous overload, restore approved pay calculation
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.complete_shift_and_approve_attendance(UUID, NUMERIC);

CREATE OR REPLACE FUNCTION public.complete_shift_and_approve_attendance(
  p_booking_id UUID,
  p_verified_hours NUMERIC DEFAULT NULL,
  p_overtime_approved BOOLEAN DEFAULT false,
  p_notes TEXT DEFAULT NULL
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
  v_hourly_rate NUMERIC;
  v_base_pay NUMERIC;
  v_final_pay NUMERIC;
  v_now TIMESTAMPTZ := now();
  v_attendance_id UUID;
BEGIN
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'UNAUTHENTICATED', 'message', 'Authentication required.');
  END IF;

  SELECT * INTO v_booking FROM bookings WHERE id = p_booking_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'BOOKING_NOT_FOUND', 'message', 'Booking not found');
  END IF;

  IF v_booking.organizer_id <> v_caller_id
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
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'JOB_NOT_FOUND', 'message', 'Associated shift not found');
  END IF;

  IF p_verified_hours IS NOT NULL THEN
    v_effective_hours := round(p_verified_hours, 2);
  ELSIF v_booking.check_in_time IS NOT NULL THEN
    v_effective_hours := LEAST(
      COALESCE(v_job.duration_hours, 16.0),
      GREATEST(0.0, round(EXTRACT(EPOCH FROM (v_now - v_booking.check_in_time)) / 3600.0, 2))
    );
  ELSE
    v_effective_hours := COALESCE(v_job.duration_hours, 8.0);
  END IF;

  IF v_effective_hours < 0 OR v_effective_hours > (COALESCE(v_job.duration_hours, 8.0) * 1.5) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'INVALID_HOURS',
      'message', 'Verified hours must be between 0 and 1.5x the scheduled duration.'
    );
  END IF;

  -- Pay is derived from approved hours, capped at the agreed shift pay unless
  -- overtime was explicitly approved against a defined overtime policy.
  v_hourly_rate := COALESCE(v_booking.agreed_hourly_rate, v_job.hourly_rate, 0);
  v_base_pay := round(v_effective_hours * v_hourly_rate, 2);

  IF v_effective_hours > COALESCE(v_job.duration_hours, v_effective_hours)
     AND p_overtime_approved
     AND v_job.overtime_policy IS NOT NULL THEN
    v_final_pay := v_base_pay;
  ELSE
    v_final_pay := LEAST(v_base_pay, v_booking.agreed_total_pay);
  END IF;

  v_final_pay := round(GREATEST(0, v_final_pay), 2);

  UPDATE bookings
  SET
    status = 'completed',
    check_out_time = COALESCE(check_out_time, v_now),
    completed_at = v_now,
    approved_total_pay = v_final_pay
  WHERE id = p_booking_id;

  UPDATE attendance_records
  SET
    verified_by_supervisor = true,
    supervisor_id = v_caller_id,
    check_out_time = COALESCE(check_out_time, v_now),
    hours_worked = v_effective_hours,
    notes = COALESCE(p_notes, notes)
  WHERE booking_id = p_booking_id
  RETURNING id INTO v_attendance_id;

  IF v_attendance_id IS NULL THEN
    INSERT INTO attendance_records (
      booking_id, job_id, worker_id, check_in_time, check_out_time,
      hours_worked, verified_by_supervisor, supervisor_id, notes
    ) VALUES (
      p_booking_id, v_booking.job_id, v_booking.worker_id,
      COALESCE(v_booking.check_in_time, v_now), COALESCE(v_booking.check_out_time, v_now),
      v_effective_hours, true, v_caller_id, p_notes
    );
  END IF;

  INSERT INTO audit_logs (
    actor_id, action, entity_type, entity_id, old_state, new_state
  ) VALUES (
    v_caller_id, 'SUPERVISOR_SIGN_OFF_ATTENDANCE', 'booking', p_booking_id::TEXT,
    jsonb_build_object('status', v_booking.status),
    jsonb_build_object(
      'status', 'completed',
      'verified_hours', v_effective_hours,
      'approved_total_pay', v_final_pay,
      'supervisor_id', v_caller_id
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'status', 'completed',
    'verified_hours', v_effective_hours,
    'approved_total_pay', v_final_pay,
    'completed_at', v_now
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.complete_shift_and_approve_attendance(UUID, NUMERIC, BOOLEAN, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.complete_shift_and_approve_attendance(UUID, NUMERIC, BOOLEAN, TEXT) TO authenticated;

-- ------------------------------------------------------------------------------
-- 4. RESTORE dispute adjudication columns used by admin_resolve_dispute_safe
-- ------------------------------------------------------------------------------
ALTER TABLE public.disputes
  ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

DROP TRIGGER IF EXISTS trg_disputes_updated_at ON public.disputes;
CREATE TRIGGER trg_disputes_updated_at
  BEFORE UPDATE ON public.disputes
  FOR EACH ROW EXECUTE FUNCTION update_timestamp();

-- ------------------------------------------------------------------------------
-- 5. FISCAL SEQUENCE: deny direct client DML
-- ------------------------------------------------------------------------------
ALTER TABLE public.invoice_fiscal_sequences ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.invoice_fiscal_sequences FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.invoice_fiscal_sequences TO service_role;
