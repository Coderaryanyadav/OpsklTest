-- ==============================================================================
-- OPSKL MIGRATION: 20261018000001_phase4_marketplace_business_logic.sql
-- Hardens marketplace discovery, atomic worker confirmation, idempotency,
-- application withdrawal, shift editing, and capacity concurrency locks.
-- ==============================================================================

-- 1. HARDEN GET_DISCOVERY_FEED WITH COMPOSABLE FILTERS & EXCLUSIONS
CREATE OR REPLACE FUNCTION public.get_discovery_feed(
  p_filters JSONB DEFAULT '{}',
  p_limit INT DEFAULT 20,
  p_cursor JSONB DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  organizer_id UUID,
  title TEXT,
  category shift_category,
  venue_name TEXT,
  venue_address TEXT,
  landmark TEXT,
  city TEXT,
  zone TEXT,
  date DATE,
  start_time TIME,
  end_time TIME,
  duration_hours NUMERIC,
  hourly_rate NUMERIC,
  total_pay NUMERIC,
  wage_per_worker NUMERIC,
  slots_total INTEGER,
  slots_filled INTEGER,
  dress_code TEXT,
  duties TEXT[],
  perks TEXT[],
  required_skills TEXT[],
  eligibility_criteria TEXT,
  breaks_minutes INTEGER,
  meal_provided BOOLEAN,
  transport_provided BOOLEAN,
  overtime_policy TEXT,
  latitude NUMERIC,
  longitude NUMERIC,
  status shift_status,
  created_at TIMESTAMPTZ,
  organizer_business_name TEXT,
  organizer_rating NUMERIC,
  organizer_verified BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_zone TEXT := NULLIF(trim(p_filters->>'zone'), '');
  v_city TEXT := NULLIF(trim(p_filters->>'city'), '');
  v_category TEXT := NULLIF(trim(p_filters->>'category'), '');
  v_min_hourly NUMERIC := COALESCE((p_filters->>'min_hourly_rate')::NUMERIC, (p_filters->>'min_hourly_wage')::NUMERIC);
  v_min_pay NUMERIC := COALESCE((p_filters->>'min_total_pay')::NUMERIC, (p_filters->>'min_pay')::NUMERIC);
  v_date DATE := (p_filters->>'date')::DATE;
  v_date_from DATE := (p_filters->>'date_from')::DATE;
  v_date_to DATE := (p_filters->>'date_to')::DATE;
  v_search TEXT := NULLIF(trim(p_filters->>'search_query'), '');
  v_user_lat NUMERIC := (p_filters->>'latitude')::NUMERIC;
  v_user_lng NUMERIC := (p_filters->>'longitude')::NUMERIC;
  v_radius_km NUMERIC := COALESCE((p_filters->>'radius_km')::NUMERIC, (p_filters->>'distance_km')::NUMERIC);

  v_cursor_date DATE;
  v_cursor_time TIME;
  v_cursor_id UUID;
BEGIN
  IF p_cursor IS NOT NULL THEN
    v_cursor_date := (p_cursor->>'date')::DATE;
    v_cursor_time := (p_cursor->>'start_time')::TIME;
    v_cursor_id := (p_cursor->>'id')::UUID;
  END IF;

  RETURN QUERY
  SELECT
    j.id,
    j.organizer_id,
    j.title,
    j.category,
    j.venue_name,
    j.venue_address,
    j.landmark,
    j.city,
    j.zone,
    j.date,
    j.start_time,
    j.end_time,
    j.duration_hours,
    j.hourly_rate,
    j.total_pay,
    j.wage_per_worker,
    j.slots_total,
    j.slots_filled,
    j.dress_code,
    j.duties,
    j.perks,
    j.required_skills,
    j.eligibility_criteria,
    j.breaks_minutes,
    j.meal_provided,
    j.transport_provided,
    j.overtime_policy,
    j.latitude,
    j.longitude,
    j.status,
    j.created_at,
    op.business_name,
    op.rating,
    (op.verification_status = 'verified')
  FROM jobs j
  JOIN organizer_profiles op ON op.id = j.organizer_id
  WHERE j.status IN ('open', 'filling')
    -- Require organizer to be verified
    AND op.verification_status = 'verified'
    -- Strictly exclude shifts whose start time in IST has already passed
    AND (
      j.date > (now() AT TIME ZONE 'Asia/Kolkata')::date
      OR (
        j.date = (now() AT TIME ZONE 'Asia/Kolkata')::date
        AND j.start_time > (now() AT TIME ZONE 'Asia/Kolkata')::time
      )
    )
    -- Must have available openings
    AND j.slots_filled < j.slots_total
    -- Application deadline check
    AND (j.application_deadline IS NULL OR j.application_deadline > now())
    -- Composable Zone / City filter
    AND (v_zone IS NULL OR v_zone = 'all' OR j.zone = v_zone OR j.city = v_zone)
    AND (v_city IS NULL OR v_city = 'all' OR j.city = v_city)
    -- Composable Category filter
    AND (v_category IS NULL OR v_category = 'all' OR j.category::TEXT = v_category)
    -- Hourly Rate filter
    AND (v_min_hourly IS NULL OR j.hourly_rate >= v_min_hourly)
    -- Total Pay filter
    AND (v_min_pay IS NULL OR j.total_pay >= v_min_pay)
    -- Date filters
    AND (v_date IS NULL OR j.date = v_date)
    AND (v_date_from IS NULL OR j.date >= v_date_from)
    AND (v_date_to IS NULL OR j.date <= v_date_to)
    -- Search Query filter
    AND (
      v_search IS NULL
      OR j.title ILIKE '%' || v_search || '%'
      OR j.venue_name ILIKE '%' || v_search || '%'
      OR j.venue_address ILIKE '%' || v_search || '%'
      OR j.category::TEXT ILIKE '%' || v_search || '%'
    )
    -- Distance / Radius Filter (Haversine formula approximation)
    AND (
      v_user_lat IS NULL OR v_user_lng IS NULL OR v_radius_km IS NULL
      OR (
        j.latitude IS NOT NULL AND j.longitude IS NOT NULL AND
        (
          6371 * acos(
            least(1.0, greatest(-1.0,
              cos(radians(v_user_lat)) * cos(radians(j.latitude)) *
              cos(radians(j.longitude) - radians(v_user_lng)) +
              sin(radians(v_user_lat)) * sin(radians(j.latitude))
            ))
          )
        ) <= v_radius_km
      )
    )
    -- Exclude shifts with existing applications (applied, shortlisted, hired, confirmed, rejected)
    AND (v_user_id IS NULL OR NOT EXISTS (
      SELECT 1 FROM job_applications ja
      WHERE ja.job_id = j.id
        AND ja.worker_id = v_user_id
        AND ja.status IN ('applied', 'shortlisted', 'hired', 'confirmed', 'rejected')
    ))
    -- Exclude left swipe passes
    AND (v_user_id IS NULL OR NOT EXISTS (
      SELECT 1 FROM swipe_events se
      WHERE se.job_id = j.id
        AND se.worker_id = v_user_id
        AND se.direction = 'left'
    ))
    -- Keyset cursor condition: (date ASC, start_time ASC, id ASC)
    AND (
      p_cursor IS NULL OR
      (j.date > v_cursor_date) OR
      (j.date = v_cursor_date AND j.start_time > v_cursor_time) OR
      (j.date = v_cursor_date AND j.start_time = v_cursor_time AND j.id > v_cursor_id)
    )
  ORDER BY j.date ASC, j.start_time ASC, j.id ASC
  LIMIT LEAST(p_limit, 50);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_discovery_feed(JSONB, INT, JSONB) TO anon, authenticated;

-- 2. HARDEN APPLY_FOR_JOB_SAFE (EXCLUDE PAST START TIME & ENFORCE DEADLINES)
CREATE OR REPLACE FUNCTION public.apply_for_job_safe(
  p_job_id UUID,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_worker_id UUID := auth.uid();
  v_job RECORD;
  v_worker RECORD;
  v_existing_app RECORD;
  v_app_id UUID;
BEGIN
  IF v_worker_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'UNAUTHENTICATED');
  END IF;

  -- Require active worker profile with completed onboarding & verified KYC
  SELECT p.is_active, wp.profile_completion_status, wp.verification_status INTO v_worker
  FROM profiles p
  JOIN worker_profiles wp ON wp.id = p.id
  WHERE p.id = v_worker_id;

  IF NOT FOUND OR v_worker.is_active = false THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'INELIGIBLE_WORKER', 'message', 'Active worker account required.');
  END IF;

  IF v_worker.profile_completion_status != 'completed' THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'PROFILE_INCOMPLETE', 'message', 'Please complete your onboarding profile before applying.');
  END IF;

  IF v_worker.verification_status != 'verified' AND NOT is_current_admin() THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'KYC_NOT_VERIFIED', 'message', 'KYC identity verification must be approved by an administrator before applying for shifts.');
  END IF;

  -- Concurrency lock on job row
  SELECT * INTO v_job FROM jobs WHERE id = p_job_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'JOB_NOT_FOUND', 'message', 'Shift listing not found.');
  END IF;

  IF v_job.status NOT IN ('open', 'filling') THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'JOB_CLOSED', 'message', 'This shift is no longer open for applications.');
  END IF;

  -- Strict start time check in Indian Standard Time
  IF (v_job.date < (now() AT TIME ZONE 'Asia/Kolkata')::date)
     OR (v_job.date = (now() AT TIME ZONE 'Asia/Kolkata')::date AND v_job.start_time <= (now() AT TIME ZONE 'Asia/Kolkata')::time) THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'SHIFT_ALREADY_STARTED', 'message', 'Shift date and start time have already passed.');
  END IF;

  IF v_job.application_deadline IS NOT NULL AND v_job.application_deadline < now() THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'DEADLINE_PASSED', 'message', 'Application deadline for this shift has expired.');
  END IF;

  IF v_job.slots_filled >= v_job.slots_total THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'SLOTS_FULL', 'message', 'All openings for this shift have been filled.');
  END IF;

  SELECT id, status INTO v_existing_app
  FROM job_applications
  WHERE job_id = p_job_id AND worker_id = v_worker_id;

  IF FOUND THEN
    IF v_existing_app.status = 'withdrawn' THEN
      UPDATE job_applications
      SET status = 'applied', notes = COALESCE(p_notes, notes), updated_at = now()
      WHERE id = v_existing_app.id;

      RETURN jsonb_build_object('success', true, 'application_id', v_existing_app.id, 'status', 'applied', 'reapplied', true);
    ELSE
      RETURN jsonb_build_object('success', false, 'error_code', 'ALREADY_APPLIED', 'message', 'You have already applied for this shift.');
    END IF;
  END IF;

  INSERT INTO job_applications (
    job_id, worker_id, status, notes
  ) VALUES (
    p_job_id, v_worker_id, 'applied', p_notes
  ) RETURNING id INTO v_app_id;

  INSERT INTO audit_logs (
    actor_id, action, entity_type, entity_id, new_state
  ) VALUES (
    v_worker_id, 'APPLY_FOR_JOB', 'application', v_app_id::TEXT,
    jsonb_build_object('job_id', p_job_id, 'status', 'applied')
  );

  -- Send real-time notification to organizer
  PERFORM _notify(v_job.organizer_id, 'New Applicant for Shift', 'A verified worker has applied for ' || v_job.title, 'new_applicant');

  RETURN jsonb_build_object(
    'success', true,
    'application_id', v_app_id,
    'status', 'applied'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.apply_for_job_safe(UUID, TEXT) TO authenticated;

-- 3. APPLICATION WITHDRAWAL RPC (AUTHORITATIVE BUSINESS RULE ENFORCEMENT)
CREATE OR REPLACE FUNCTION public.withdraw_job_application_safe(
  p_application_id UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_worker_id UUID := auth.uid();
  v_app RECORD;
  v_job RECORD;
  v_shift_start TIMESTAMPTZ;
BEGIN
  IF v_worker_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'UNAUTHENTICATED');
  END IF;

  SELECT ja.id, ja.job_id, ja.worker_id, ja.status
  INTO v_app
  FROM job_applications ja
  WHERE ja.id = p_application_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'APPLICATION_NOT_FOUND', 'message', 'Application record not found.');
  END IF;

  -- Worker ownership or admin check
  IF v_app.worker_id != v_worker_id AND NOT is_current_admin() THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'UNAUTHORIZED', 'message', 'Not authorized to withdraw this application.');
  END IF;

  IF v_app.status = 'withdrawn' THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'ALREADY_WITHDRAWN', 'message', 'Application is already withdrawn.');
  END IF;

  IF v_app.status NOT IN ('applied', 'shortlisted') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'CANNOT_WITHDRAW_CONFIRMED',
      'message', 'Cannot withdraw an application that has already been confirmed or processed.'
    );
  END IF;

  -- Check shift cutoff window (cannot withdraw within 2 hours of start time)
  SELECT j.id, j.title, j.organizer_id, j.date, j.start_time
  INTO v_job
  FROM jobs j
  WHERE j.id = v_app.job_id;

  IF FOUND THEN
    v_shift_start := (v_job.date + v_job.start_time) AT TIME ZONE 'Asia/Kolkata';
    IF v_shift_start <= (now() AT TIME ZONE 'Asia/Kolkata') + INTERVAL '2 hours' THEN
      RETURN jsonb_build_object(
        'success', false,
        'error_code', 'WITHDRAWAL_DEADLINE_EXPIRED',
        'message', 'Applications cannot be withdrawn within 2 hours of shift start time.'
      );
    END IF;
  END IF;

  UPDATE job_applications
  SET status = 'withdrawn', updated_at = now()
  WHERE id = p_application_id;

  INSERT INTO audit_logs (
    actor_id, action, entity_type, entity_id, new_state
  ) VALUES (
    v_worker_id, 'WITHDRAW_APPLICATION', 'application', p_application_id::TEXT,
    jsonb_build_object('status', 'withdrawn', 'reason', p_reason)
  );

  IF v_job.organizer_id IS NOT NULL THEN
    PERFORM _notify(
      v_job.organizer_id,
      'Application Withdrawn',
      'A worker has withdrawn their application for ' || v_job.title,
      'application_withdrawn'
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'application_id', p_application_id,
    'status', 'withdrawn'
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.withdraw_job_application_safe(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.withdraw_job_application_safe(UUID, TEXT) TO authenticated;

-- 4. HARDEN CONFIRM_WORKER_BOOKING_SAFE (IDEMPOTENCY & STRICT CAPACITY LOCK)
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
  v_existing_booking RECORD;
  v_new_booking RECORD;
  v_check_in_code TEXT;
  v_allow_direct BOOLEAN := false;
  v_job_start TIMESTAMPTZ;
  v_job_end TIMESTAMPTZ;
BEGIN
  IF v_organizer_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'UNAUTHENTICATED');
  END IF;

  -- 1. Idempotency Check: If worker is already confirmed for this shift, return existing booking cleanly
  SELECT id, check_in_code, status INTO v_existing_booking
  FROM bookings
  WHERE job_id = p_job_id AND worker_id = p_worker_id AND status IN ('confirmed', 'checked_in');

  IF FOUND THEN
    RETURN jsonb_build_object(
      'success', true,
      'booking_id', v_existing_booking.id,
      'check_in_code', v_existing_booking.check_in_code,
      'status', v_existing_booking.status,
      'already_confirmed', true
    );
  END IF;

  -- 2. Concurrency Lock on Shift Listing
  SELECT id, organizer_id, title, date, start_time, end_time, status, slots_total, slots_filled, hourly_rate, total_pay
  INTO v_job
  FROM jobs
  WHERE id = p_job_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'JOB_NOT_FOUND', 'message', 'Shift listing not found');
  END IF;

  -- 3. Authorization Check: must be shift organizer, team admin/owner, or platform admin
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

  -- 4. Platform Killswitch Check
  IF EXISTS (
    SELECT 1 FROM platform_settings
    WHERE key = 'booking_killswitch' AND (value->>'is_paused')::BOOLEAN = true
  ) THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'BOOKINGS_PAUSED', 'message', 'Shift bookings are temporarily paused platform-wide.');
  END IF;

  -- 5. Require Organizer Identity Verification
  IF NOT EXISTS (
    SELECT 1 FROM organizer_profiles
    WHERE id = v_job.organizer_id AND (verification_status = 'verified' OR is_current_admin())
  ) THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'UNVERIFIED_ORGANIZER', 'message', 'Organizer identity verification required before hiring.');
  END IF;

  -- 6. Require Worker Active & KYC Verified
  IF NOT EXISTS (
    SELECT 1 FROM worker_profiles wp
    JOIN profiles p ON p.id = wp.id
    WHERE wp.id = p_worker_id
      AND (wp.verification_status = 'verified' OR is_current_admin())
      AND p.is_active = true
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'UNVERIFIED_WORKER',
      'message', 'Worker identity verification must be approved before booking can be confirmed.'
    );
  END IF;

  -- 7. Shift Status & Time Validity
  IF v_job.status NOT IN ('open', 'filling') THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'JOB_NOT_OPEN', 'message', 'Shift is not open for hiring.');
  END IF;

  IF (v_job.date < (now() AT TIME ZONE 'Asia/Kolkata')::date)
     OR (v_job.date = (now() AT TIME ZONE 'Asia/Kolkata')::date AND v_job.start_time <= (now() AT TIME ZONE 'Asia/Kolkata')::time) THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'PAST_DATE', 'message', 'Cannot hire workers for shifts that have already started.');
  END IF;

  -- 8. Capacity Check: Atomic & Strict
  IF v_job.slots_filled >= v_job.slots_total THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'CAPACITY_REACHED', 'message', 'All openings for this shift have already been filled.');
  END IF;

  -- 9. Application Requirement Check
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
      RETURN jsonb_build_object('success', false, 'error_code', 'INVALID_APPLICATION_STATUS', 'message', 'Application must be in applied or shortlisted state.');
    END IF;
  END IF;

  -- 10. Check for Overlapping Shifts on Schedule
  v_job_start := (v_job.date + v_job.start_time) AT TIME ZONE 'Asia/Kolkata';
  v_job_end := (v_job.date + v_job.end_time + CASE WHEN v_job.end_time <= v_job.start_time THEN interval '1 day' ELSE interval '0' END) AT TIME ZONE 'Asia/Kolkata';

  IF EXISTS (
    SELECT 1 FROM bookings b
    JOIN jobs other_j ON other_j.id = b.job_id
    WHERE b.worker_id = p_worker_id
      AND b.status IN ('confirmed', 'checked_in')
      AND other_j.id <> p_job_id
      AND (
        ((other_j.date + other_j.start_time) AT TIME ZONE 'Asia/Kolkata') < v_job_end
        AND
        ((other_j.date + other_j.end_time + CASE WHEN other_j.end_time <= other_j.start_time THEN interval '1 day' ELSE interval '0' END) AT TIME ZONE 'Asia/Kolkata') > v_job_start
      )
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'OVERLAPPING_SHIFT_SCHEDULE',
      'message', 'Worker is already confirmed for another overlapping shift on this schedule.'
    );
  END IF;

  -- Generate cryptographically robust booking code
  v_check_in_code := 'OP-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));

  -- Insert Booking
  INSERT INTO bookings (
    job_id, worker_id, organizer_id, status,
    agreed_rate, total_payout, check_in_code, notes
  ) VALUES (
    p_job_id, p_worker_id, v_job.organizer_id, 'confirmed',
    v_job.hourly_rate, v_job.total_pay, v_check_in_code, p_notes
  )
  RETURNING * INTO v_new_booking;

  -- Update Application status to hired
  IF v_app.id IS NOT NULL THEN
    UPDATE job_applications
    SET status = 'hired', updated_at = now()
    WHERE id = v_app.id;
  END IF;

  -- Increment filled slots count and update job status
  UPDATE jobs
  SET
    slots_filled = slots_filled + 1,
    status = CASE WHEN slots_filled + 1 >= slots_total THEN 'filled'::job_status ELSE 'filling'::job_status END,
    updated_at = now()
  WHERE id = p_job_id;

  INSERT INTO audit_logs (
    actor_id, action, entity_type, entity_id, new_state
  ) VALUES (
    v_organizer_id, 'CONFIRM_WORKER_BOOKING', 'bookings', v_new_booking.id::TEXT,
    jsonb_build_object('job_id', p_job_id, 'worker_id', p_worker_id, 'status', 'confirmed')
  );

  PERFORM _notify(
    p_worker_id,
    'Booking Confirmed!',
    'You have been confirmed for: ' || v_job.title,
    'booking_confirmed'
  );

  RETURN jsonb_build_object(
    'success', true,
    'booking_id', v_new_booking.id,
    'check_in_code', v_check_in_code,
    'status', 'confirmed',
    'already_confirmed', false
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.confirm_worker_booking_safe(UUID, UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.confirm_worker_booking_safe(UUID, UUID, TEXT) TO authenticated;

-- 5. SHIFT EDITING RPC (PREVENT ALTERING COMPLETED SHIFTS OR REDUCING BELOW CONFIRMED)
CREATE OR REPLACE FUNCTION public.edit_job_safe(
  p_job_id UUID,
  p_job JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor_id UUID := auth.uid();
  v_job RECORD;
  v_new_slots INTEGER;
  v_new_hourly NUMERIC;
  v_new_date DATE;
  v_new_start TIME;
  v_new_end TIME;
  v_new_lat NUMERIC;
  v_new_lng NUMERIC;
BEGIN
  IF v_actor_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'UNAUTHENTICATED');
  END IF;

  SELECT * INTO v_job
  FROM jobs
  WHERE id = p_job_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'JOB_NOT_FOUND', 'message', 'Shift listing not found.');
  END IF;

  -- Authorization check
  IF v_job.organizer_id != v_actor_id
     AND NOT is_current_admin()
     AND NOT EXISTS (
       SELECT 1 FROM organizer_memberships
       WHERE organizer_id = v_job.organizer_id
         AND user_id = v_actor_id
         AND role IN ('owner', 'admin')
     ) THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'UNAUTHORIZED', 'message', 'Not authorized to edit this shift.');
  END IF;

  -- Cannot edit completed, cancelled, or in_progress shifts
  IF v_job.status IN ('completed', 'cancelled', 'in_progress') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'SHIFT_IMMUTABLE',
      'message', 'Cannot edit a shift that is ' || v_job.status || '.'
    );
  END IF;

  -- Parse fields
  v_new_slots := COALESCE((p_job->>'required_workers')::INTEGER, (p_job->>'slots_total')::INTEGER, v_job.slots_total);
  v_new_hourly := COALESCE((p_job->>'hourly_rate')::NUMERIC, v_job.hourly_rate);
  v_new_date := COALESCE((p_job->>'date')::DATE, v_job.date);
  v_new_start := COALESCE((p_job->>'start_time')::TIME, v_job.start_time);
  v_new_end := COALESCE((p_job->>'end_time')::TIME, v_job.end_time);
  v_new_lat := CASE WHEN p_job ? 'latitude' THEN (p_job->>'latitude')::NUMERIC ELSE v_job.latitude END;
  v_new_lng := CASE WHEN p_job ? 'longitude' THEN (p_job->>'longitude')::NUMERIC ELSE v_job.longitude END;

  -- Validation: Capacity cannot be reduced below already confirmed workers
  IF v_new_slots < v_job.slots_filled THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'CAPACITY_BELOW_CONFIRMED',
      'message', 'Capacity cannot be reduced below ' || v_job.slots_filled || ' currently confirmed workers.'
    );
  END IF;

  -- Validation: If workers are confirmed, cannot change dates/times or decrease hourly rate
  IF v_job.slots_filled > 0 THEN
    IF v_new_hourly < v_job.hourly_rate THEN
      RETURN jsonb_build_object(
        'success', false,
        'error_code', 'WAGE_REDUCTION_FORBIDDEN',
        'message', 'Cannot reduce hourly rate on a shift with confirmed workers.'
      );
    END IF;

    IF v_new_date != v_job.date OR v_new_start != v_job.start_time OR v_new_end != v_job.end_time THEN
      RETURN jsonb_build_object(
        'success', false,
        'error_code', 'SCHEDULE_LOCKED',
        'message', 'Shift date and schedule times cannot be altered after workers have been confirmed.'
      );
    END IF;
  END IF;

  -- Validation: Indian coordinates bounds
  IF (v_new_lat IS NOT NULL AND v_new_lng IS NULL) OR (v_new_lat IS NULL AND v_new_lng IS NOT NULL) THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'INVALID_COORDINATES', 'message', 'Both latitude and longitude must be provided.');
  END IF;

  IF v_new_lat IS NOT NULL AND (v_new_lat < 6.0 OR v_new_lat > 38.0 OR v_new_lng < 68.0 OR v_new_lng > 98.0) THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'COORDINATES_OUT_OF_BOUNDS', 'message', 'Venue coordinates must be within India (6–38°N, 68–98°E).');
  END IF;

  -- Validation: Minimum wage floor
  IF v_new_hourly < 100.0 THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'BELOW_MINIMUM_WAGE', 'message', 'Hourly rate cannot be below ₹100.');
  END IF;

  -- Update shift record
  UPDATE jobs
  SET
    title = COALESCE(NULLIF(trim(p_job->>'title'), ''), title),
    description = COALESCE(p_job->>'description', description),
    category = COALESCE((p_job->>'category')::shift_category, category),
    slots_total = v_new_slots,
    hourly_rate = v_new_hourly,
    total_pay = COALESCE((p_job->>'total_pay')::NUMERIC, ROUND(v_new_hourly * duration_hours, 2)),
    wage_per_worker = COALESCE((p_job->>'wage_per_worker')::NUMERIC, ROUND(v_new_hourly * duration_hours, 2)),
    venue_name = COALESCE(NULLIF(trim(p_job->>'venue_name'), ''), venue_name),
    venue_address = COALESCE(NULLIF(trim(p_job->>'venue_address'), ''), venue_address),
    landmark = COALESCE(p_job->>'landmark', landmark),
    city = COALESCE(p_job->>'city', city),
    zone = COALESCE(p_job->>'zone', zone),
    latitude = v_new_lat,
    longitude = v_new_lng,
    dress_code = COALESCE(p_job->>'dress_code', dress_code),
    duties = CASE WHEN p_job ? 'duties' THEN ARRAY(SELECT jsonb_array_elements_text(p_job->'duties')) ELSE duties END,
    perks = CASE WHEN p_job ? 'perks' THEN ARRAY(SELECT jsonb_array_elements_text(p_job->'perks')) ELSE perks END,
    required_skills = CASE WHEN p_job ? 'required_skills' THEN ARRAY(SELECT jsonb_array_elements_text(p_job->'required_skills')) ELSE required_skills END,
    eligibility_criteria = COALESCE(p_job->>'eligibility_criteria', eligibility_criteria),
    breaks_minutes = COALESCE((p_job->>'break_minutes')::INTEGER, (p_job->>'breaks_minutes')::INTEGER, breaks_minutes),
    application_deadline = CASE WHEN p_job ? 'application_deadline' THEN (p_job->>'application_deadline')::TIMESTAMPTZ ELSE application_deadline END,
    status = CASE WHEN slots_filled >= v_new_slots THEN 'filled'::job_status ELSE 'open'::job_status END,
    updated_at = now()
  WHERE id = p_job_id;

  INSERT INTO audit_logs (
    actor_id, action, entity_type, entity_id, new_state
  ) VALUES (
    v_actor_id, 'EDIT_JOB', 'jobs', p_job_id::TEXT,
    jsonb_build_object('job_id', p_job_id, 'slots_total', v_new_slots, 'hourly_rate', v_new_hourly)
  );

  RETURN jsonb_build_object(
    'success', true,
    'job_id', p_job_id
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.edit_job_safe(UUID, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.edit_job_safe(UUID, JSONB) TO authenticated;
