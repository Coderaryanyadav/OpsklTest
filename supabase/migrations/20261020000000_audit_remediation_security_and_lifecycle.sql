-- ==============================================================================
-- OPSKL SECURITY, LIFECYCLE & PRIVACY AUDIT REMEDIATION
-- Migration: 20261020000000_audit_remediation_security_and_lifecycle.sql
-- 
-- Fixes Identified During Due Diligence Audit:
-- 1. SEC-001: Prevent admin privilege escalation via client auth metadata
-- 2. SEC-002: Shield event supervisor contact phone from base jobs table SELECT
-- 3. SEC-004: Enforce 300-metre attendance geofence on backend RPC check_in_worker_safe
-- 4. SEC-005: Drop legacy open direct UPDATE policy on job_applications
-- 5. FLOW-001: Allow partially-filled shifts (open, filling) to start and conclude
-- 6. FLOW-004: Restore public organizer card visibility across discovery feed
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. SEC-001: PREVENT ADMIN PRIVILEGE ESCALATION VIA AUTH METADATA
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user_provisioning()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_role user_role;
  v_phone TEXT;
  v_name TEXT;
  v_email TEXT;
BEGIN
  -- Authoritative restriction: 'admin' role can NEVER be assigned via client metadata.
  -- Only 'organizer' or 'worker' can be self-requested. Platform administrators
  -- must be provisioned exclusively via migrations or PostgreSQL superuser.
  v_role := CASE
    WHEN (NEW.raw_user_meta_data->>'role') = 'organizer' THEN 'organizer'::user_role
    ELSE 'worker'::user_role
  END;

  v_email := NEW.email;
  v_phone := COALESCE(NEW.phone, NEW.raw_user_meta_data->>'phone');
  v_name := COALESCE(
    NEW.raw_user_meta_data->>'full_name', 
    NEW.raw_user_meta_data->>'name', 
    CASE WHEN v_email IS NOT NULL THEN split_part(v_email, '@', 1) ELSE 'User ' || substr(NEW.id::text, 1, 6) END
  );

  INSERT INTO public.profiles (
    id, role, phone, full_name, email, city, is_active
  ) VALUES (
    NEW.id, v_role, v_phone, v_name, v_email, 'Mumbai', true
  )
  ON CONFLICT (id) DO UPDATE SET
    role = CASE WHEN EXCLUDED.role = 'organizer' THEN 'organizer'::user_role ELSE profiles.role END,
    phone = COALESCE(EXCLUDED.phone, profiles.phone),
    full_name = COALESCE(EXCLUDED.full_name, profiles.full_name),
    email = COALESCE(EXCLUDED.email, profiles.email),
    updated_at = now();

  IF v_role = 'organizer' THEN
    INSERT INTO public.organizer_profiles (
      id, business_name, business_contact_phone, business_contact_email, business_type, profile_completion_status, verification_status
    ) VALUES (
      NEW.id,
      v_name,
      COALESCE(v_phone, ''),
      v_email,
      'event_agency',
      'incomplete',
      'unverified'
    )
    ON CONFLICT (id) DO UPDATE SET
      business_contact_email = COALESCE(organizer_profiles.business_contact_email, EXCLUDED.business_contact_email);
  ELSE
    INSERT INTO public.worker_profiles (
      id, preferred_locality, skills, availability_status, profile_completion_status, verification_status
    ) VALUES (
      NEW.id, 'Mumbai', '{}', 'available', 'incomplete', 'unverified'
    )
    ON CONFLICT (id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$function$;

-- ------------------------------------------------------------------------------
-- 2. SEC-002: SHIELD SUPERVISOR CONTACT PHONE FROM BASE JOBS TABLE
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Anyone can view open public jobs" ON public.jobs;
DROP POLICY IF EXISTS "Anyone authenticated can view open jobs" ON public.jobs;
DROP POLICY IF EXISTS "Organizers and confirmed crew view full jobs" ON public.jobs;

CREATE POLICY "Organizers and confirmed crew view full jobs"
  ON public.jobs FOR SELECT TO authenticated
  USING (
    organizer_id = auth.uid()
    OR is_current_admin()
    OR EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.job_id = jobs.id
        AND b.worker_id = auth.uid()
        AND b.status IN ('confirmed', 'checked_in', 'completed_awaiting_review', 'completed')
    )
  );

-- Ensure public discovery exclusively projects non-sensitive fields
GRANT SELECT ON public.public_jobs TO anon, authenticated;

-- ------------------------------------------------------------------------------
-- 3. SEC-005: DROP LEGACY OPEN DIRECT UPDATE POLICY ON JOB_APPLICATIONS
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Organizers update application status" ON public.job_applications;

-- ------------------------------------------------------------------------------
-- 4. FLOW-001: PERMIT PARTIALLY-FILLED SHIFTS TO START & CONCLUDE
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.validate_job_transition(
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

  -- Draft shifts can be published or cancelled
  IF p_current_status = 'draft' AND p_new_status IN ('open', 'cancelled') THEN
    RETURN true;
  -- Active recruitment shifts (open, filling, filled) can transition to in_progress, paused, cancelled, or filling/filled
  ELSIF p_current_status IN ('open', 'filling', 'filled') AND p_new_status IN ('open', 'filling', 'filled', 'in_progress', 'paused', 'cancelled') THEN
    RETURN true;
  -- Paused shifts can be reopened, restarted, or cancelled
  ELSIF p_current_status = 'paused' AND p_new_status IN ('open', 'filling', 'in_progress', 'cancelled') THEN
    RETURN true;
  -- Live shifts in progress can be completed or cancelled
  ELSIF p_current_status = 'in_progress' AND p_new_status IN ('completed', 'cancelled') THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$function$;

-- ------------------------------------------------------------------------------
-- 5. SEC-004: ENFORCE 300-METRE ATTENDANCE GEOFENCE ON CHECK-IN RPC
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
BEGIN
  -- 0. Authentication requirement
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'UNAUTHENTICATED', 'message', 'Authentication required.');
  END IF;

  -- 1. Lock and validate booking
  SELECT * INTO v_booking
  FROM bookings
  WHERE id = p_booking_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'BOOKING_NOT_FOUND', 'message', 'Booking record not found');
  END IF;

  -- 2. State machine validation
  IF NOT validate_booking_transition(v_booking.status, 'checked_in') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'INVALID_TRANSITION',
      'message', 'Cannot check in. Current booking status is ' || v_booking.status
    );
  END IF;

  -- 3. Lock job
  SELECT * INTO v_job FROM jobs WHERE id = v_booking.job_id;

  -- 4. Authorization check
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

  -- 5. Server-side verification requirement: worker identity must be active & verified
  IF NOT v_is_supervisor THEN
    IF NOT EXISTS (
      SELECT 1 FROM worker_profiles wp
      JOIN profiles p ON p.id = wp.id
      WHERE wp.id = v_booking.worker_id
        AND (wp.verification_status = 'verified' OR is_current_admin())
        AND p.is_active = true
    ) THEN
      RETURN jsonb_build_object(
        'success', false,
        'error_code', 'WORKER_NOT_VERIFIED',
        'message', 'Worker identity verification must be active and approved to check in.'
      );
    END IF;
  END IF;

  -- 6. Require a valid check-in code
  IF p_code IS NULL OR length(trim(p_code)) < 4 OR length(trim(p_code)) > 32 THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'INVALID_CODE', 'message', 'A valid shift check-in code or pass credential is required.');
  END IF;

  -- For worker self-check-in, require provisioned credential and exact match
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

  -- 7. Shift Timing & IST Check-In Window (Allowed from 2 hours before scheduled shift start)
  v_shift_start_ist := (v_job.date + v_job.start_time) AT TIME ZONE 'Asia/Kolkata';
  IF v_now < (v_shift_start_ist - interval '2 hours') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'CHECK_IN_TOO_EARLY',
      'message', 'Check-in opens 2 hours before scheduled shift start time.'
    );
  END IF;

  -- 8. Geolocation verification & 300m boundary enforcement
  IF NOT v_is_supervisor THEN
    IF v_job.latitude IS NOT NULL AND v_job.longitude IS NOT NULL THEN
      IF p_lat IS NULL OR p_lng IS NULL THEN
        RETURN jsonb_build_object(
          'success', false,
          'error_code', 'GPS_COORDINATES_REQUIRED',
          'message', 'GPS coordinates are required to verify on-site arrival.'
        );
      END IF;

      v_distance := round((
        6371 * acos(
          least(1.0, greatest(-1.0,
            cos(radians(v_job.latitude)) * cos(radians(p_lat)) *
            cos(radians(p_lng) - radians(v_job.longitude)) +
            sin(radians(v_job.latitude)) * sin(radians(p_lat))
          ))
        )
      )::NUMERIC, 2);

      -- Enforce 300-metre geofence boundary (0.30 km)
      IF v_distance > 0.30 THEN
        RETURN jsonb_build_object(
          'success', false,
          'error_code', 'OUT_OF_GEOFENCE_RANGE',
          'message', 'You are ' || round(v_distance * 1000) || 'm away from the venue. You must be within 300m to check in.'
        );
      END IF;
    END IF;
  ELSE
    -- Supervisor manual override allows check-in regardless of distance
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
    END IF;
  END IF;

  -- 9. Execute check-in mutation
  UPDATE bookings
  SET
    status = 'checked_in',
    check_in_time = v_now,
    updated_at = v_now
  WHERE id = p_booking_id;

  INSERT INTO attendance_records (
    booking_id, check_in_time, check_in_code, verified_by_supervisor,
    worker_latitude, worker_longitude, distance_to_venue_km, status
  ) VALUES (
    p_booking_id, v_now, upper(trim(p_code)), v_is_supervisor,
    p_lat, p_lng, v_distance, 'checked_in'
  );

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
    'distance_km', v_distance
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.check_in_worker_safe(UUID, TEXT, NUMERIC, NUMERIC) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.check_in_worker_safe(UUID, TEXT, NUMERIC, NUMERIC) TO authenticated;

-- ------------------------------------------------------------------------------
-- 6. FLOW-004: RESTORE PUBLIC ORGANIZER CARD VISIBILITY FOR DISCOVERY FEED
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Public organizer card read access" ON public.organizer_profiles;

CREATE POLICY "Public organizer card read access"
  ON public.organizer_profiles FOR SELECT TO authenticated, anon
  USING (
    verification_status = 'verified'
    OR id = auth.uid()
    OR is_current_admin()
    OR EXISTS (
      SELECT 1 FROM public.jobs
      WHERE jobs.organizer_id = organizer_profiles.id
        AND jobs.status IN ('open', 'filling', 'in_progress', 'completed')
    )
  );
