-- ==============================================================================
-- OPSKL MIGRATION: 20261018000003_fix_confirm_worker_booking_columns.sql
-- Fixes bookings column names in confirm_worker_booking_safe:
-- agreed_hourly_rate, agreed_total_pay, check_in_code (replaces non-existent agreed_rate/notes)
-- and casts status to shift_status.
-- ==============================================================================

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

  -- Generate cryptographically robust booking code (CSPRNG 48-bit hex formatted)
  v_check_in_code := 'OP-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));

  -- Insert Booking with authoritative columns
  INSERT INTO bookings (
    job_id, worker_id, organizer_id, status,
    agreed_hourly_rate, agreed_total_pay, check_in_code
  ) VALUES (
    p_job_id, p_worker_id, v_job.organizer_id, 'confirmed',
    v_job.hourly_rate, v_job.total_pay, v_check_in_code
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
    status = CASE WHEN slots_filled + 1 >= slots_total THEN 'filled'::shift_status ELSE 'filling'::shift_status END,
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

-- Ensure edit_job_safe also casts to shift_status
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
    status = CASE WHEN slots_filled >= v_new_slots THEN 'filled'::shift_status ELSE 'open'::shift_status END,
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
