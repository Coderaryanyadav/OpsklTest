-- ==============================================================================
-- OPSKL MIGRATION: 20261018000002_fix_marketplace_application_status_enum.sql
-- Fixes application_status enum references in get_discovery_feed and confirm_worker_booking_safe
-- by replacing invalid 'hired' status with authoritative 'confirmed' status.
-- ==============================================================================

-- 1. FIX GET_DISCOVERY_FEED EXCLUSION FOR APPLICATION STATUS
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
  -- Parse cursor pagination if supplied
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
    -- Exclude shifts with existing applications (applied, shortlisted, confirmed, rejected)
    AND (v_user_id IS NULL OR NOT EXISTS (
      SELECT 1 FROM job_applications ja
      WHERE ja.job_id = j.id
        AND ja.worker_id = v_user_id
        AND ja.status IN ('applied', 'shortlisted', 'confirmed', 'rejected')
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

REVOKE EXECUTE ON FUNCTION public.get_discovery_feed(JSONB, INT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_discovery_feed(JSONB, INT, JSONB) TO authenticated, anon;

-- 2. FIX CONFIRM_WORKER_BOOKING_SAFE APPLICATION STATUS UPDATE
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
  v_check_in_code TEXT;
  v_new_booking RECORD;
  v_allow_direct BOOLEAN := false;
  v_worker RECORD;
  v_job_start TIMESTAMPTZ;
  v_job_end TIMESTAMPTZ;
BEGIN
  -- 1. Authorization: Verify caller is authenticated
  IF v_organizer_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'UNAUTHENTICATED');
  END IF;

  -- 2. Concurrency Lock: Lock shift record for update to prevent capacity races
  SELECT * INTO v_job
  FROM jobs
  WHERE id = p_job_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'JOB_NOT_FOUND', 'message', 'Shift listing not found.');
  END IF;

  -- 3. Verify Organizer Ownership or Admin Role or Authorized Team Member
  IF v_job.organizer_id != v_organizer_id
     AND NOT is_current_admin()
     AND NOT EXISTS (
       SELECT 1 FROM organizer_memberships
       WHERE organizer_id = v_job.organizer_id
         AND user_id = v_organizer_id
         AND role IN ('owner', 'admin')
     ) THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'UNAUTHORIZED', 'message', 'Not authorized to manage this shift.');
  END IF;

  -- 4. Shift State Validation
  IF v_job.status NOT IN ('open', 'filling') THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'JOB_NOT_OPEN', 'message', 'Shift is not open for confirmations.');
  END IF;

  -- 5. Strict Schedule Start Time Validation in Indian Standard Time
  IF (v_job.date < (now() AT TIME ZONE 'Asia/Kolkata')::date)
     OR (v_job.date = (now() AT TIME ZONE 'Asia/Kolkata')::date AND v_job.start_time <= (now() AT TIME ZONE 'Asia/Kolkata')::time) THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'SHIFT_ALREADY_STARTED', 'message', 'Cannot confirm workers for a shift whose start time has passed.');
  END IF;

  -- 6. Verify Worker Account & KYC Verification Status
  SELECT p.is_active, wp.verification_status, wp.profile_completion_status INTO v_worker
  FROM profiles p
  JOIN worker_profiles wp ON wp.id = p.id
  WHERE p.id = p_worker_id;

  IF NOT FOUND OR v_worker.is_active = false THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'INELIGIBLE_WORKER', 'message', 'Worker account is inactive or not found.');
  END IF;

  IF v_worker.verification_status != 'verified' AND NOT is_current_admin() THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'WORKER_NOT_VERIFIED', 'message', 'Worker identity KYC has not been verified.');
  END IF;

  -- 7. Idempotency Check: Existing Confirmed Booking
  SELECT id, status, check_in_code INTO v_existing_booking
  FROM bookings
  WHERE job_id = p_job_id AND worker_id = p_worker_id;

  IF FOUND THEN
    IF v_existing_booking.status = 'confirmed' THEN
      RETURN jsonb_build_object(
        'success', true,
        'booking_id', v_existing_booking.id,
        'check_in_code', v_existing_booking.check_in_code,
        'status', 'confirmed',
        'already_confirmed', true
      );
    ELSE
      RETURN jsonb_build_object(
        'success', false,
        'error_code', 'EXISTING_BOOKING_STATUS',
        'message', 'Worker already has a booking with status: ' || v_existing_booking.status
      );
    END IF;
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

  -- Update Application status to confirmed
  IF v_app.id IS NOT NULL THEN
    UPDATE job_applications
    SET status = 'confirmed', updated_at = now()
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
