-- ==============================================================================
-- OPSKIL DATABASE MIGRATION: 20261017000001_shift_creation_and_rpc_hardening.sql
-- Phase 2: Database and RPC Correctness
-- Resolves:
--   1. Shift creation authoritative signature and validation hardening in create_job_safe
--   2. Enforce organizer team membership authorization (organizer_memberships)
--   3. Duplicate shift publication throttle guard (30-second window)
--   4. Venue name/address and supervisor contact minimum requirements
--   5. Consistent search_path = public, pg_temp on SECURITY DEFINER functions
--   6. Enforce centralized is_current_admin() authorization in admin moderation RPCs
--   7. Revoke unnecessary execute permissions from anon role
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. AUTHORITATIVE create_job_safe DEFINITION
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
SET search_path = public, pg_temp
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
  v_raw_status TEXT := lower(trim(COALESCE(p_job->>'status', 'open')));
  v_status shift_status;
  v_app_deadline TIMESTAMPTZ;
  v_payment_deadline TIMESTAMPTZ;
  v_shift_start_timestamptz TIMESTAMPTZ;
  v_crosses_midnight BOOLEAN;
  v_end_date DATE;
  v_duration_hours NUMERIC;
  v_total_pay NUMERIC;
  v_org_verified TEXT;
  v_org_active BOOLEAN;
  v_min_wage NUMERIC := 100.0;
BEGIN
  -- Authentication check: must have an authenticated user (bypassed only for service_role / postgres superuser)
  IF auth.uid() IS NULL AND COALESCE(auth.role(), '') <> 'service_role' AND current_user <> 'postgres' THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'UNAUTHENTICATED', 'message', 'Please sign in to publish shifts.');
  END IF;

  IF v_effective_org_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'ORGANIZER_REQUIRED', 'message', 'Organizer identity is required.');
  END IF;

  -- Authorization: Caller must be the organizer, an authorized team member (owner/admin), or platform admin
  IF auth.uid() IS NOT NULL 
     AND auth.uid() <> v_effective_org_id 
     AND NOT is_current_admin()
     AND NOT EXISTS (
       SELECT 1 FROM organizer_memberships
       WHERE organizer_id = v_effective_org_id
         AND user_id = auth.uid()
         AND role IN ('owner', 'admin')
     ) THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'UNAUTHORIZED', 'message', 'You are not authorized to post shifts on behalf of this organizer.');
  END IF;

  -- Lifecycle status check: Only 'draft' and 'open' are permitted at creation
  IF v_raw_status NOT IN ('draft', 'open') THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'INVALID_INITIAL_STATUS', 'message', 'Initial shift status must be either "draft" or "open". Status "' || v_raw_status || '" is prohibited at creation.');
  END IF;
  v_status := v_raw_status::shift_status;

  -- Organizer verification and account status checks
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

  -- Safe category enum casting
  BEGIN
    v_category := v_raw_cat::shift_category;
  EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'INVALID_CATEGORY', 'message', 'Invalid shift category: ' || COALESCE(p_job->>'category', 'none'));
  END;

  -- Title length validation: 5 to 80 chars
  IF length(v_title) < 5 OR length(v_title) > 80 THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'INVALID_TITLE', 'message', 'Shift title must be between 5 and 80 characters.');
  END IF;

  -- Venue and on-site supervisor validation
  IF length(v_venue_name) < 2 OR length(v_venue_addr) < 5 THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'INVALID_VENUE', 'message', 'Venue name (min 2 chars) and complete address (min 5 chars) are required.');
  END IF;

  IF length(v_supervisor_name) < 2 OR length(v_supervisor_phone) < 8 THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'INVALID_SUPERVISOR', 'message', 'On-site supervisor name and a valid contact phone number are required.');
  END IF;

  -- Read min wage from settings with safe fallback if configuration row is missing
  v_min_wage := 100.0;
  SELECT COALESCE(
    CASE 
      WHEN jsonb_typeof(value) = 'object' THEN (value->>'min_hourly_wage_inr')::numeric
      WHEN jsonb_typeof(value) = 'number' THEN (value)::text::numeric
      ELSE NULL
    END,
    100.0
  ) INTO v_min_wage
  FROM platform_settings 
  WHERE key IN ('min_wage', 'min_hourly_wage_inr')
  ORDER BY CASE WHEN key = 'min_hourly_wage_inr' THEN 1 ELSE 2 END
  LIMIT 1;

  v_min_wage := GREATEST(COALESCE(v_min_wage, 100.0), 100.0);

  -- Rate limits: ₹100 to ₹2000/hr
  IF v_hourly_rate < v_min_wage OR v_hourly_rate > 2000 THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'INVALID_WAGE', 'message', 'Hourly rate must be between ₹' || v_min_wage || ' and ₹2,000/hr.');
  END IF;

  -- Slots limit: 1 to 50 workers
  IF v_slots_total < 1 OR v_slots_total > 50 THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'INVALID_SLOTS', 'message', 'Headcount must be between 1 and 50 workers.');
  END IF;

  -- Schedule validation
  IF v_date IS NULL OR v_start_time IS NULL OR v_end_time IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'INVALID_SCHEDULE', 'message', 'Shift date, start time, and end time are required.');
  END IF;

  -- Date check in IST
  IF v_date < (now() AT TIME ZONE 'Asia/Kolkata')::date THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'PAST_DATE', 'message', 'Shift date cannot be in the past.');
  END IF;

  -- Same-day start time check in IST
  v_shift_start_timestamptz := (v_date + v_start_time) AT TIME ZONE 'Asia/Kolkata';
  IF v_shift_start_timestamptz <= now() THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'PAST_START_TIME', 'message', 'Shift start time has already passed for the scheduled date.');
  END IF;

  -- Overnight and duration calculation
  IF v_end_time <= v_start_time THEN
    v_crosses_midnight := true;
    v_end_date := v_date + 1;
    v_duration_hours := round((EXTRACT(EPOCH FROM (v_end_time - v_start_time + interval '24 hours')) / 3600.0)::numeric, 2);
  ELSE
    v_crosses_midnight := false;
    v_end_date := v_date;
    v_duration_hours := round((EXTRACT(EPOCH FROM (v_end_time - v_start_time)) / 3600.0)::numeric, 2);
  END IF;

  -- Duration boundaries: 1.0 to 14.0 hours
  IF v_duration_hours < 1.0 OR v_duration_hours > 14.0 THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'INVALID_DURATION', 'message', 'Shift duration must be between 1 and 14 hours.');
  END IF;

  -- Break duration bounds: 0 to 120 mins and strictly less than total shift duration
  IF v_breaks_mins < 0 OR v_breaks_mins > 120 THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'INVALID_BREAK_DURATION', 'message', 'Break duration must be between 0 and 120 minutes.');
  END IF;

  IF (v_breaks_mins / 60.0) >= v_duration_hours THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'BREAK_EXCEEDS_DURATION', 'message', 'Break duration cannot equal or exceed total shift duration.');
  END IF;

  -- Deadlines parsing & validation
  IF p_job->>'application_deadline' IS NOT NULL AND trim(p_job->>'application_deadline') <> '' THEN
    BEGIN
      v_app_deadline := (p_job->>'application_deadline')::timestamptz;
    EXCEPTION WHEN OTHERS THEN
      RETURN jsonb_build_object('success', false, 'error_code', 'INVALID_APPLICATION_DEADLINE', 'message', 'Invalid application deadline format.');
    END;

    IF v_app_deadline <= now() THEN
      RETURN jsonb_build_object('success', false, 'error_code', 'INVALID_APPLICATION_DEADLINE', 'message', 'Application deadline must be in the future.');
    END IF;

    IF v_app_deadline > v_shift_start_timestamptz THEN
      RETURN jsonb_build_object('success', false, 'error_code', 'INVALID_APPLICATION_DEADLINE', 'message', 'Application deadline cannot be after the shift start time.');
    END IF;
  END IF;

  IF p_job->>'payment_deadline' IS NOT NULL AND trim(p_job->>'payment_deadline') <> '' THEN
    BEGIN
      v_payment_deadline := (p_job->>'payment_deadline')::timestamptz;
    EXCEPTION WHEN OTHERS THEN
      RETURN jsonb_build_object('success', false, 'error_code', 'INVALID_PAYMENT_DEADLINE', 'message', 'Invalid payment deadline format.');
    END;

    IF v_payment_deadline < now() THEN
      RETURN jsonb_build_object('success', false, 'error_code', 'INVALID_PAYMENT_DEADLINE', 'message', 'Payment deadline cannot be in the past.');
    END IF;
  END IF;

  -- Require BOTH coordinates to be present together or BOTH omitted
  IF (v_lat IS NULL AND v_lng IS NOT NULL) OR (v_lat IS NOT NULL AND v_lng IS NULL) THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'INCOMPLETE_COORDINATES', 'message', 'Both latitude and longitude must be provided together or omitted.');
  END IF;

  -- India geographic coordinate bounds check (Lat: 6–38°N, Lng: 68–98°E)
  IF v_lat IS NOT NULL AND v_lng IS NOT NULL THEN
    IF v_lat < 6.0 OR v_lat > 38.0 OR v_lng < 68.0 OR v_lng > 98.0 THEN
      RETURN jsonb_build_object('success', false, 'error_code', 'INVALID_COORDINATES', 'message', 'Coordinates must fall within the sovereign territory of India (6–38°N, 68–98°E).');
    END IF;
  END IF;

  -- Duplicate publication guard: detect rapid identical reposts (within 30 seconds)
  IF EXISTS (
    SELECT 1 FROM jobs
    WHERE organizer_id = v_effective_org_id
      AND title = v_title
      AND date = v_date
      AND start_time = v_start_time
      AND venue_name = v_venue_name
      AND status <> 'cancelled'
      AND created_at >= (now() - interval '30 seconds')
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'DUPLICATE_PUBLICATION',
      'message', 'A shift with the same title, venue, and timing was just published. Please wait before reposting.'
    );
  END IF;

  -- Authoritative payable-hours rule:
  -- In Indian event and exhibition commercial staffing, shifts are scheduled as full on-site engagement blocks.
  -- Scheduled rest breaks (up to 120 minutes) are paid rest periods included in the on-site engagement duration.
  -- Total pay is calculated directly from scheduled engagement duration: hourly_rate * duration_hours.
  v_total_pay := round(v_hourly_rate * v_duration_hours, 2);

  -- Insert shift with all supported fields persisted
  INSERT INTO jobs (
    organizer_id, title, category, venue_name, venue_address,
    landmark, city, zone, latitude, longitude,
    date, start_time, end_time, duration_hours,
    hourly_rate, total_pay, slots_total, slots_filled,
    dress_code, duties, perks, required_skills, eligibility_criteria,
    breaks_minutes, meal_provided, transport_provided, overtime_policy,
    reporting_instructions, cancellation_policy,
    application_deadline, payment_deadline,
    supervisor_name, supervisor_phone, status, crosses_midnight, end_date
  ) VALUES (
    v_effective_org_id, v_title, v_category, v_venue_name, v_venue_addr,
    v_landmark, v_city, v_zone, v_lat, v_lng,
    v_date, v_start_time, v_end_time, v_duration_hours,
    v_hourly_rate, v_total_pay, v_slots_total, 0,
    v_dress_code, v_duties, v_perks, v_required_skills, v_eligibility,
    v_breaks_mins, v_meal_provided, v_transport_provided, v_overtime_policy,
    v_reporting_instructions, v_cancellation_policy,
    v_app_deadline, v_payment_deadline,
    v_supervisor_name, v_supervisor_phone, v_status, v_crosses_midnight, v_end_date
  ) RETURNING id INTO v_job_id;

  -- Immutable audit log entry
  INSERT INTO audit_logs (
    actor_id, action, entity_type, entity_id, new_state
  ) VALUES (
    COALESCE(auth.uid(), v_effective_org_id),
    'CREATE_JOB',
    'jobs',
    v_job_id::TEXT,
    jsonb_build_object(
      'title', v_title,
      'status', v_status,
      'slots_total', v_slots_total,
      'hourly_rate', v_hourly_rate,
      'total_pay', v_total_pay,
      'duration_hours', v_duration_hours
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'job_id', v_job_id,
    'title', v_title,
    'total_pay', v_total_pay,
    'duration_hours', v_duration_hours,
    'crosses_midnight', v_crosses_midnight,
    'application_deadline', v_app_deadline,
    'payment_deadline', v_payment_deadline
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_job_safe(JSONB, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_job_safe(JSONB, UUID) TO authenticated;

-- ------------------------------------------------------------------------------
-- 2. HARDEN confirm_worker_booking_safe FOR ORGANIZER TEAM MEMBERS
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.confirm_worker_booking_safe(
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
  v_new_booking RECORD;
  v_check_in_code TEXT;
  v_allow_direct BOOLEAN := false;
  v_job_start TIMESTAMPTZ;
  v_job_end TIMESTAMPTZ;
BEGIN
  IF v_organizer_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'UNAUTHENTICATED');
  END IF;

  SELECT id, organizer_id, title, date, start_time, end_time, status, slots_total, slots_filled, hourly_rate, total_pay
  INTO v_job
  FROM jobs
  WHERE id = p_job_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'JOB_NOT_FOUND', 'message', 'Shift listing not found');
  END IF;

  -- Permissions check: must be shift organizer, authorized team member (owner/admin), or platform admin
  IF v_job.organizer_id <> v_organizer_id 
     AND NOT is_current_admin() 
     AND NOT EXISTS (
       SELECT 1 FROM organizer_memberships
       WHERE organizer_id = v_job.organizer_id
         AND user_id = v_organizer_id
         AND role IN ('owner', 'admin')
     ) THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'UNAUTHORIZED', 'message', 'Not authorized to hire for this shift');
  END IF;

  -- Platform Killswitch Check
  IF EXISTS (
    SELECT 1 FROM platform_settings
    WHERE key = 'booking_killswitch' AND (value->>'is_paused')::BOOLEAN = true
  ) THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'BOOKINGS_PAUSED', 'message', 'Shift bookings are temporarily paused platform-wide.');
  END IF;

  -- Require organizer verified (or admin)
  IF NOT EXISTS (
    SELECT 1 FROM organizer_profiles
    WHERE id = v_job.organizer_id AND (verification_status = 'verified' OR is_current_admin())
  ) THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'UNVERIFIED_ORGANIZER', 'message', 'Organizer identity verification required before hiring.');
  END IF;

  -- Require shift status in open/filling and date >= today IST
  IF v_job.status NOT IN ('open', 'filling') THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'JOB_NOT_OPEN', 'message', 'Shift is not open for hiring.');
  END IF;

  IF v_job.date < (now() AT TIME ZONE 'Asia/Kolkata')::date THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'PAST_DATE', 'message', 'Cannot hire workers for past shifts.');
  END IF;

  -- Capacity check
  IF v_job.slots_filled >= v_job.slots_total THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'SLOTS_FULL', 'message', 'All openings for this shift have already been filled.');
  END IF;

  -- Application requirement check
  SELECT COALESCE((value->>'allow_direct_invites')::boolean, false) INTO v_allow_direct
  FROM platform_settings WHERE key = 'allow_direct_invites';

  SELECT id, status INTO v_app
  FROM job_applications
  WHERE job_id = p_job_id AND worker_id = p_worker_id;

  IF NOT FOUND THEN
    IF NOT v_allow_direct THEN
      RETURN jsonb_build_object('success', false, 'error_code', 'APPLICATION_REQUIRED', 'message', 'Worker must apply to shift before being confirmed.');
    END IF;
  ELSE
    IF v_app.status NOT IN ('applied', 'shortlisted') THEN
      RETURN jsonb_build_object('success', false, 'error_code', 'INVALID_APPLICATION_STATUS', 'message', 'Application must be applied or shortlisted.');
    END IF;
  END IF;

  -- Check for double-booking / overlapping confirmed/checked_in shifts on the same date
  v_job_start := (v_job.date + v_job.start_time) AT TIME ZONE 'Asia/Kolkata';
  v_job_end := (v_job.date + v_job.end_time + CASE WHEN v_job.end_time <= v_job.start_time THEN interval '1 day' ELSE interval '0' END) AT TIME ZONE 'Asia/Kolkata';

  IF EXISTS (
    SELECT 1 FROM bookings b
    JOIN jobs j ON j.id = b.job_id
    WHERE b.worker_id = p_worker_id
      AND b.status IN ('confirmed', 'checked_in')
      AND (
        ( (j.date + j.start_time) AT TIME ZONE 'Asia/Kolkata' ) < v_job_end
        AND
        ( (j.date + j.end_time + CASE WHEN j.end_time <= j.start_time THEN interval '1 day' ELSE interval '0' END) AT TIME ZONE 'Asia/Kolkata' ) > v_job_start
      )
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'OVERLAPPING_SHIFT_SCHEDULE',
      'message', 'Worker is already confirmed for an overlapping shift during these hours.'
    );
  END IF;

  -- CSPRNG check-in code
  v_check_in_code := 'OP-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));

  -- Create or update booking record
  INSERT INTO bookings (
    job_id, worker_id, organizer_id, status,
    agreed_hourly_rate, agreed_total_pay, approved_total_pay, check_in_code
  ) VALUES (
    p_job_id, p_worker_id, v_job.organizer_id, 'confirmed',
    v_job.hourly_rate, v_job.total_pay, v_job.total_pay, v_check_in_code
  )
  ON CONFLICT (job_id, worker_id) DO UPDATE SET
    status = 'confirmed',
    agreed_hourly_rate = EXCLUDED.agreed_hourly_rate,
    agreed_total_pay = EXCLUDED.agreed_total_pay,
    approved_total_pay = EXCLUDED.approved_total_pay,
    check_in_code = EXCLUDED.check_in_code
  RETURNING * INTO v_new_booking;

  -- Update application status
  IF v_app.id IS NOT NULL THEN
    UPDATE job_applications
    SET status = 'confirmed', updated_at = now()
    WHERE id = v_app.id;
  END IF;

  -- Increment filled slots atomically
  UPDATE jobs
  SET
    slots_filled = slots_filled + 1,
    status = CASE WHEN slots_filled + 1 >= slots_total THEN 'filled'::shift_status ELSE 'filling'::shift_status END,
    updated_at = now()
  WHERE id = p_job_id;

  -- Automatically generate idempotent job invoice for escrow funding on first confirmed booking
  PERFORM generate_job_invoice_safe(p_job_id);

  -- Send worker notification
  PERFORM _notify(
    p_worker_id,
    'Shift Booking Confirmed!',
    'You have been confirmed for ' || v_job.title || '. Check details and venue instructions.',
    'booking_confirmed',
    '/shift/' || p_job_id,
    jsonb_build_object('job_id', p_job_id, 'booking_id', v_new_booking.id)
  );

  INSERT INTO audit_logs (
    actor_id, action, entity_type, entity_id, new_state
  ) VALUES (
    v_organizer_id, 'CONFIRM_WORKER_BOOKING', 'booking', v_new_booking.id::TEXT,
    jsonb_build_object('job_id', p_job_id, 'worker_id', p_worker_id, 'agreed_pay', v_job.total_pay)
  );

  RETURN jsonb_build_object(
    'success', true,
    'booking_id', v_new_booking.id,
    'status', 'confirmed',
    'check_in_code', v_check_in_code
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.confirm_worker_booking_safe(UUID, UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.confirm_worker_booking_safe(UUID, UUID, TEXT) TO authenticated;

-- ------------------------------------------------------------------------------
-- 3. ALIGN ADMIN MODERATION FUNCTIONS TO is_current_admin()
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.admin_moderate_job_safe(
  p_job_id UUID,
  p_new_status shift_status,
  p_moderation_reason TEXT,
  p_admin_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_job RECORD;
  v_admin_id UUID := auth.uid();
BEGIN
  IF v_admin_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Authentication required.');
  END IF;

  IF p_admin_id IS NOT NULL AND p_admin_id <> v_admin_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized. Caller cannot specify a different administrator identity.');
  END IF;

  IF NOT is_current_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized. Requires administrator role.');
  END IF;

  SELECT * INTO v_job
  FROM jobs
  WHERE id = p_job_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Job not found');
  END IF;

  UPDATE jobs
  SET
    status = p_new_status,
    updated_at = now()
  WHERE id = p_job_id;

  -- Immutable audit log
  INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, changes)
  VALUES (
    v_admin_id,
    'admin_moderate_job',
    'jobs',
    p_job_id,
    jsonb_build_object(
      'old_status', v_job.status,
      'new_status', p_new_status,
      'moderation_reason', p_moderation_reason
    )
  );

  RETURN jsonb_build_object('success', true, 'job_id', p_job_id, 'status', p_new_status);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_moderate_job_safe(UUID, shift_status, TEXT, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_moderate_job_safe(UUID, shift_status, TEXT, UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_resolve_safety_report_safe(
  p_report_id UUID,
  p_status TEXT,
  p_action_taken TEXT,
  p_staff_notes TEXT,
  p_admin_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_report RECORD;
  v_admin_id UUID := auth.uid();
BEGIN
  IF v_admin_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Authentication required.');
  END IF;

  IF p_admin_id IS NOT NULL AND p_admin_id <> v_admin_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized. Caller cannot specify a different administrator identity.');
  END IF;

  IF NOT is_current_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized. Requires administrator role.');
  END IF;

  SELECT * INTO v_report
  FROM safety_reports
  WHERE id = p_report_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Safety report not found');
  END IF;

  UPDATE safety_reports
  SET
    status = p_status,
    action_taken = p_action_taken,
    staff_notes = p_staff_notes,
    resolved_by = v_admin_id,
    resolved_at = now()
  WHERE id = p_report_id;

  -- Immutable audit log
  INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, changes)
  VALUES (
    v_admin_id,
    'admin_resolve_safety_report',
    'safety_reports',
    p_report_id,
    jsonb_build_object(
      'status', p_status,
      'action_taken', p_action_taken,
      'severity', v_report.severity
    )
  );

  RETURN jsonb_build_object('success', true, 'report_id', p_report_id, 'status', p_status);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_resolve_safety_report_safe(UUID, TEXT, TEXT, TEXT, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_resolve_safety_report_safe(UUID, TEXT, TEXT, TEXT, UUID) TO authenticated;

-- ------------------------------------------------------------------------------
-- 4. REVOKE UNPRIVILEGED ROLE SWITCHING FROM anon
-- ------------------------------------------------------------------------------

REVOKE EXECUTE ON FUNCTION public.switch_user_role_safe(user_role, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.switch_user_role_safe(user_role, TEXT, TEXT) TO authenticated;
