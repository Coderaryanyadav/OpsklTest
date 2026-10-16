-- ==============================================================================
-- OPSKIL DATABASE MIGRATION: 20261016000000_security_privacy_coordinate_hardening.sql
-- Resolves:
--   1. Finding 2: Supervisor contact privacy shield on raw jobs table & public_jobs view
--   2. Finding 4: Organizer GSTIN / billing address exposure shield on organizer_profiles
--   3. Finding 6: Venue coordinates partial pair validation in create_job_safe
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. HARDEN COORDINATE BOUNDS & INTEGRITY IN create_job_safe
-- ------------------------------------------------------------------------------

DROP FUNCTION IF EXISTS public.create_job_safe(JSONB, UUID);
DROP FUNCTION IF EXISTS public.create_job_safe(JSONB);

CREATE OR REPLACE FUNCTION public.create_job_safe(
  p_job JSONB,
  p_organizer_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_effective_org_id UUID := COALESCE(p_organizer_id, (p_job->>'organizer_id')::uuid, auth.uid());
  v_job_id UUID;
  v_title TEXT := trim(COALESCE(p_job->>'title', ''));
  v_raw_cat TEXT := lower(trim(COALESCE(p_job->>'category', 'conference')));
  v_category shift_category;
  v_venue_name TEXT := trim(COALESCE(p_job->>'venue_name', p_job->>'venueName', ''));
  v_venue_addr TEXT := trim(COALESCE(p_job->>'venue_address', p_job->>'venueAddress', ''));
  v_landmark TEXT := trim(COALESCE(p_job->>'landmark', ''));
  v_city TEXT := COALESCE(NULLIF(trim(p_job->>'city'), ''), 'Mumbai');
  v_zone TEXT := trim(COALESCE(p_job->>'zone', ''));
  v_lat NUMERIC := (p_job->>'latitude')::numeric;
  v_lng NUMERIC := (p_job->>'longitude')::numeric;
  v_date DATE := (p_job->>'date')::date;
  v_start_time TIME := (p_job->>'start_time')::time;
  v_end_time TIME := (p_job->>'end_time')::time;
  v_hourly_rate NUMERIC := COALESCE((p_job->>'hourly_rate')::numeric, (p_job->>'hourlyRate')::numeric, 0);
  v_slots_total INT := COALESCE((p_job->>'slots_total')::int, (p_job->>'slotsTotal')::int, 0);
  v_dress_code TEXT := trim(COALESCE(p_job->>'dress_code', p_job->>'dressCode', ''));
  v_duties TEXT[] := CASE 
    WHEN p_job->'duties' IS NOT NULL AND jsonb_typeof(p_job->'duties') = 'array' 
    THEN ARRAY(SELECT jsonb_array_elements_text(p_job->'duties'))
    ELSE ARRAY[]::TEXT[]
  END;
  v_required_skills TEXT[] := CASE 
    WHEN COALESCE(p_job->'required_skills', p_job->'requiredSkills') IS NOT NULL 
         AND jsonb_typeof(COALESCE(p_job->'required_skills', p_job->'requiredSkills')) = 'array'
    THEN ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_job->'required_skills', p_job->'requiredSkills')))
    ELSE ARRAY[]::TEXT[]
  END;
  v_perks TEXT[] := CASE 
    WHEN p_job->'perks' IS NOT NULL AND jsonb_typeof(p_job->'perks') = 'array' 
    THEN ARRAY(SELECT jsonb_array_elements_text(p_job->'perks'))
    ELSE ARRAY[]::TEXT[]
  END;
  v_eligibility TEXT := trim(COALESCE(p_job->>'eligibility_criteria', p_job->>'eligibilityCriteria', ''));
  v_breaks_mins INT := COALESCE((p_job->>'breaks_minutes')::int, (p_job->>'breaksMinutes')::int, 30);
  v_meal_provided BOOLEAN := COALESCE((p_job->>'meal_provided')::boolean, (p_job->>'mealProvided')::boolean, false);
  v_transport_provided BOOLEAN := COALESCE((p_job->>'transport_provided')::boolean, (p_job->>'transportProvided')::boolean, false);
  v_overtime_policy TEXT := trim(COALESCE(p_job->>'overtime_policy', p_job->>'overtimePolicy', ''));
  v_reporting_instructions TEXT := trim(COALESCE(p_job->>'reporting_instructions', p_job->>'reportingInstructions', ''));
  v_cancellation_policy TEXT := trim(COALESCE(p_job->>'cancellation_policy', p_job->>'cancellationPolicy', ''));
  v_supervisor_name TEXT := trim(COALESCE(p_job->>'supervisor_name', p_job->>'supervisorName', ''));
  v_supervisor_phone TEXT := trim(COALESCE(p_job->>'supervisor_phone', p_job->>'supervisorPhone', ''));
  v_status shift_status := COALESCE(p_job->>'status', 'open')::shift_status;
  v_crosses_midnight BOOLEAN;
  v_end_date DATE;
  v_duration_hours NUMERIC;
  v_total_pay NUMERIC;
  v_org_verified TEXT;
  v_org_active BOOLEAN;
  v_min_wage NUMERIC;
BEGIN
  -- Authentication check: must have an authenticated user (bypassed only for service_role / postgres superuser)
  IF auth.uid() IS NULL AND COALESCE(auth.role(), '') <> 'service_role' AND current_user <> 'postgres' THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'UNAUTHENTICATED', 'message', 'Please sign in to publish shifts.');
  END IF;

  IF v_effective_org_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'ORGANIZER_REQUIRED', 'message', 'Organizer identity is required.');
  END IF;

  -- Authorization: Caller must be the organizer or admin
  IF auth.uid() IS NOT NULL AND auth.uid() <> v_effective_org_id AND NOT is_current_admin() THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'UNAUTHORIZED', 'message', 'You are not authorized to post shifts on behalf of another organizer.');
  END IF;

  -- Organizer verification check
  SELECT verification_status INTO v_org_verified
  FROM organizer_profiles WHERE id = v_effective_org_id;

  SELECT is_active INTO v_org_active
  FROM profiles WHERE id = v_effective_org_id;

  IF v_org_active IS FALSE THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'ORGANIZER_INACTIVE', 'message', 'This organizer account has been suspended or deactivated.');
  END IF;

  -- Require existing organizer profile for publishing non-draft shifts
  IF v_status <> 'draft' AND v_org_verified IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'ORGANIZER_NOT_FOUND', 'message', 'Organizer profile not found.');
  END IF;

  -- Require verified organizer for publishing non-draft shifts (admins bypass)
  IF v_status <> 'draft' AND v_org_verified <> 'verified' AND NOT is_current_admin() THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'ORGANIZER_NOT_VERIFIED', 'message', 'Organizer identity verification required to post shifts.');
  END IF;

  -- Safe enum casting
  BEGIN
    v_category := v_raw_cat::shift_category;
  EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'INVALID_CATEGORY', 'message', 'Invalid shift category: ' || COALESCE(p_job->>'category', 'none'));
  END;

  -- Title length aligned: 5 to 80 chars
  IF length(v_title) < 5 OR length(v_title) > 80 THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'INVALID_TITLE', 'message', 'Shift title must be between 5 and 80 characters.');
  END IF;

  -- Read min wage from settings
  SELECT COALESCE((value->>'min_hourly_wage_inr')::numeric, 100.0) INTO v_min_wage
  FROM platform_settings WHERE key = 'min_wage';

  -- Rate limits: ₹100 to ₹2000/hr
  IF v_hourly_rate < v_min_wage OR v_hourly_rate > 2000 THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'INVALID_WAGE', 'message', 'Hourly rate must be between ₹' || v_min_wage || ' and ₹2,000/hr.');
  END IF;

  -- Slots limit: 1 to 50 workers (aligned with client schema)
  IF v_slots_total < 1 OR v_slots_total > 50 THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'INVALID_SLOTS', 'message', 'Headcount must be between 1 and 50 workers.');
  END IF;

  -- Date check in IST
  IF v_date < (now() AT TIME ZONE 'Asia/Kolkata')::date THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'PAST_DATE', 'message', 'Shift date cannot be in the past.');
  END IF;

  -- Overnight calculation
  IF v_end_time <= v_start_time THEN
    v_crosses_midnight := true;
    v_end_date := v_date + 1;
    v_duration_hours := round((EXTRACT(EPOCH FROM (v_end_time - v_start_time + interval '24 hours')) / 3600.0)::numeric, 2);
  ELSE
    v_crosses_midnight := false;
    v_end_date := v_date;
    v_duration_hours := round((EXTRACT(EPOCH FROM (v_end_time - v_start_time)) / 3600.0)::numeric, 2);
  END IF;

  -- Allow duration between 1.0 and 14.0 hours (aligned with client schema)
  IF v_duration_hours < 1.0 OR v_duration_hours > 14.0 THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'INVALID_DURATION', 'message', 'Shift duration must be between 1 and 14 hours.');
  END IF;

  -- Require BOTH coordinates to be present together or BOTH absent (Fix 6)
  IF (v_lat IS NULL AND v_lng IS NOT NULL) OR (v_lat IS NOT NULL AND v_lng IS NULL) THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'INCOMPLETE_COORDINATES', 'message', 'Both latitude and longitude must be provided together or omitted.');
  END IF;

  -- India geographic coordinate bounds check (Lat: 6–38 N, Lng: 68–98 E)
  IF v_lat IS NOT NULL AND v_lng IS NOT NULL THEN
    IF v_lat < 6.0 OR v_lat > 38.0 OR v_lng < 68.0 OR v_lng > 98.0 THEN
      RETURN jsonb_build_object('success', false, 'error_code', 'INVALID_COORDINATES', 'message', 'Coordinates must fall within the sovereign territory of India (6–38°N, 68–98°E).');
    END IF;
  END IF;

  v_total_pay := round(v_hourly_rate * v_duration_hours, 2);

  INSERT INTO jobs (
    organizer_id, title, category, venue_name, venue_address,
    landmark, city, zone, latitude, longitude,
    date, start_time, end_time, duration_hours,
    hourly_rate, total_pay, slots_total, slots_filled,
    dress_code, duties, perks, required_skills, eligibility_criteria,
    breaks_minutes, meal_provided, transport_provided, overtime_policy,
    reporting_instructions, cancellation_policy,
    supervisor_name, supervisor_phone, status, crosses_midnight, end_date
  ) VALUES (
    v_effective_org_id, v_title, v_category, v_venue_name, v_venue_addr,
    v_landmark, v_city, v_zone, v_lat, v_lng,
    v_date, v_start_time, v_end_time, v_duration_hours,
    v_hourly_rate, v_total_pay, v_slots_total, 0,
    v_dress_code, v_duties, v_perks, v_required_skills, v_eligibility,
    v_breaks_mins, v_meal_provided, v_transport_provided, v_overtime_policy,
    v_reporting_instructions, v_cancellation_policy,
    v_supervisor_name, v_supervisor_phone, v_status, v_crosses_midnight, v_end_date
  ) RETURNING id INTO v_job_id;

  RETURN jsonb_build_object(
    'success', true,
    'job_id', v_job_id,
    'title', v_title,
    'total_pay', v_total_pay,
    'duration_hours', v_duration_hours,
    'crosses_midnight', v_crosses_midnight
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_job_safe(JSONB, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_job_safe(JSONB, UUID) TO authenticated;

-- ------------------------------------------------------------------------------
-- 2. SHIELD SUPERVISOR CONTACTS ON JOBS TABLE (Fix 2)
-- ------------------------------------------------------------------------------

-- Drop and recreate public_jobs view with security_barrier = true
-- Omits supervisor_name and supervisor_phone
DROP VIEW IF EXISTS public.public_jobs CASCADE;

CREATE VIEW public.public_jobs
WITH (security_barrier = true) AS
  SELECT
    id,
    organizer_id,
    title,
    category,
    venue_name,
    venue_address,
    landmark,
    city,
    zone,
    date,
    start_time,
    end_time,
    duration_hours,
    hourly_rate,
    total_pay,
    wage_per_worker,
    slots_total,
    slots_filled,
    dress_code,
    duties,
    perks,
    required_skills,
    eligibility_criteria,
    application_deadline,
    breaks_minutes,
    meal_provided,
    transport_provided,
    overtime_policy,
    latitude,
    longitude,
    status,
    created_at,
    updated_at,
    crosses_midnight,
    end_date
  FROM public.jobs
  WHERE status IN ('open', 'filling')
    AND date >= CURRENT_DATE;

GRANT SELECT ON public.public_jobs TO anon, authenticated;

-- Restrict direct SELECT on jobs table:
-- Only job's organizer, confirmed workers for that shift, or admin can select raw jobs row
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

-- ------------------------------------------------------------------------------
-- 3. SHIELD SENSITIVE FIELDS (GSTIN, BILLING ADDRESS, PHONE) IN ORGANIZER PROFILES (Fix 4)
-- ------------------------------------------------------------------------------

-- Drop and recreate public organizer card view with security_barrier = true
DROP VIEW IF EXISTS public.public_organizer_cards CASCADE;

CREATE VIEW public.public_organizer_cards
WITH (security_barrier = true) AS
  SELECT
    id,
    business_name,
    business_type,
    profile_completion_status,
    verification_status,
    rating,
    total_events_hosted,
    created_at,
    updated_at
  FROM public.organizer_profiles;

GRANT SELECT ON public.public_organizer_cards TO anon, authenticated;

-- Restrict direct SELECT on organizer_profiles:
-- An organizer can only read their own profile; admins can read all profiles
DROP POLICY IF EXISTS "Public organizer card read access" ON public.organizer_profiles;
DROP POLICY IF EXISTS "Organizers view own business profile" ON public.organizer_profiles;

CREATE POLICY "Organizers view own business profile"
  ON public.organizer_profiles FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR is_current_admin()
  );
