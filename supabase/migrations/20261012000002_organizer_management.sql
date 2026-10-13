-- ============================================================================
-- OPSKL ORGANIZER JOB MANAGEMENT & HIRING ENGINE (PHASE 4)
-- Multi-step shift specs, atomic booking RPCs, notifications & audit trails
-- ============================================================================

-- 1. Extend shift_status enum to support 'paused'
DO $$
BEGIN
  ALTER TYPE shift_status ADD VALUE IF NOT EXISTS 'paused';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 2. Extend jobs table with Phase 4 terms
ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS reporting_instructions TEXT,
  ADD COLUMN IF NOT EXISTS cancellation_policy TEXT DEFAULT 'Free cancellation up to 24 hours prior to shift commencement.',
  ADD COLUMN IF NOT EXISTS payment_deadline TIMESTAMPTZ;

-- 3. Update shifts view
CREATE OR REPLACE VIEW shifts AS SELECT * FROM jobs;

-- 4. Enable notification and audit log insertion policies for authorized actions
CREATE POLICY "Users insert own notifications or admins"
  ON notifications FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND (user_id = auth.uid() OR is_current_admin()));

CREATE POLICY "Authenticated actors insert own audit logs"
  ON audit_logs FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND (actor_id = auth.uid() OR is_current_admin()));

-- 5. Atomic RPC: Create Job with Server-Side Validations & Audit Log
CREATE OR REPLACE FUNCTION create_job_safe(
  p_job JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_organizer_id UUID := auth.uid();
  v_title TEXT := p_job->>'title';
  v_category shift_category := (p_job->>'category')::shift_category;
  v_venue_name TEXT := p_job->>'venue_name';
  v_venue_address TEXT := p_job->>'venue_address';
  v_landmark TEXT := p_job->>'landmark';
  v_city TEXT := COALESCE(p_job->>'city', 'Mumbai');
  v_zone TEXT := p_job->>'zone';
  v_date DATE := (p_job->>'date')::DATE;
  v_start_time TIME := (p_job->>'start_time')::TIME;
  v_end_time TIME := (p_job->>'end_time')::TIME;
  v_duration_hours NUMERIC := (p_job->>'duration_hours')::NUMERIC;
  v_hourly_rate NUMERIC := (p_job->>'hourly_rate')::NUMERIC;
  v_total_pay NUMERIC := (p_job->>'total_pay')::NUMERIC;
  v_slots_total INTEGER := (p_job->>'slots_total')::INTEGER;
  v_status shift_status := COALESCE(p_job->>'status', 'open')::shift_status;
  v_dress_code TEXT := p_job->>'dress_code';
  v_supervisor_name TEXT := p_job->>'supervisor_name';
  v_supervisor_phone TEXT := p_job->>'supervisor_phone';
  v_reporting_instructions TEXT := p_job->>'reporting_instructions';
  v_cancellation_policy TEXT := p_job->>'cancellation_policy';
  v_application_deadline TIMESTAMPTZ := (p_job->>'application_deadline')::TIMESTAMPTZ;
  v_payment_deadline TIMESTAMPTZ := (p_job->>'payment_deadline')::TIMESTAMPTZ;
  v_duties TEXT[] := ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_job->'duties', '[]'::jsonb)));
  v_required_skills TEXT[] := ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_job->'required_skills', '[]'::jsonb)));
  v_perks TEXT[] := ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_job->'perks', '[]'::jsonb)));
  v_breaks_minutes INTEGER := COALESCE((p_job->>'breaks_minutes')::INTEGER, 30);
  v_meal_provided BOOLEAN := COALESCE((p_job->>'meal_provided')::BOOLEAN, false);
  v_transport_provided BOOLEAN := COALESCE((p_job->>'transport_provided')::BOOLEAN, false);
  v_overtime_policy TEXT := p_job->>'overtime_policy';
  v_new_id UUID;
BEGIN
  -- Authentication check
  IF v_organizer_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'UNAUTHENTICATED', 'message', 'Must be authenticated');
  END IF;

  -- Organizer role authorization check
  IF NOT EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = v_organizer_id AND role IN ('organizer', 'admin')
  ) OR NOT EXISTS (
    SELECT 1 FROM organizer_profiles 
    WHERE id = v_organizer_id
  ) THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error_code', 'FORBIDDEN_ROLE', 
      'message', 'Only verified organizers can create and publish shifts.'
    );
  END IF;

  -- Server-side validation: minimum wage
  IF v_hourly_rate < 100 THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'INVALID_WAGE', 'message', 'Hourly rate must be at least ₹100/hr');
  END IF;

  -- Server-side validation: slots total
  IF v_slots_total <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'INVALID_SLOTS', 'message', 'Headcount must be at least 1 worker');
  END IF;

  -- Server-side validation: date not in the past
  IF v_date < CURRENT_DATE THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'PAST_DATE', 'message', 'Shift date cannot be in the past');
  END IF;

  -- Calculate total pay
  IF v_total_pay IS NULL OR v_total_pay <= 0 THEN
    v_total_pay := v_hourly_rate * v_duration_hours;
  END IF;

  -- Insert Job
  INSERT INTO jobs (
    organizer_id, title, category, venue_name, venue_address, landmark,
    city, zone, date, start_time, end_time, duration_hours,
    hourly_rate, total_pay, slots_total, slots_filled, dress_code,
    duties, perks, required_skills, breaks_minutes, meal_provided,
    transport_provided, overtime_policy, reporting_instructions,
    cancellation_policy, application_deadline, payment_deadline,
    supervisor_name, supervisor_phone, status
  ) VALUES (
    v_organizer_id, v_title, v_category, v_venue_name, v_venue_address, v_landmark,
    v_city, v_zone, v_date, v_start_time, v_end_time, v_duration_hours,
    v_hourly_rate, v_total_pay, v_slots_total, 0, v_dress_code,
    v_duties, v_perks, v_required_skills, v_breaks_minutes, v_meal_provided,
    v_transport_provided, v_overtime_policy, v_reporting_instructions,
    v_cancellation_policy, v_application_deadline, v_payment_deadline,
    v_supervisor_name, v_supervisor_phone, v_status
  ) RETURNING id INTO v_new_id;

  -- Insert Audit Log
  INSERT INTO audit_logs (
    actor_id, action, entity_type, entity_id, new_state
  ) VALUES (
    v_organizer_id, 'CREATE_JOB', 'job', v_new_id::TEXT,
    jsonb_build_object('title', v_title, 'slots', v_slots_total, 'rate', v_hourly_rate, 'status', v_status)
  );

  RETURN jsonb_build_object(
    'success', true,
    'job_id', v_new_id
  );
END;
$$;

-- 6. Atomic RPC: Confirm Worker Booking (Hiring Engine)
-- Enforces:
--  - Authorized organizer
--  - Never exceed headcount (slots_filled < slots_total)
--  - Concurrency safe locking
--  - Unique booking prevention
--  - Worker notification
--  - Audit log recording
CREATE OR REPLACE FUNCTION confirm_worker_booking_safe(
  p_job_id UUID,
  p_worker_id UUID,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_organizer_id UUID := auth.uid();
  v_job RECORD;
  v_app RECORD;
  v_new_booking RECORD;
  v_check_in_code TEXT;
BEGIN
  -- 1. Check authorization
  IF v_organizer_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'UNAUTHENTICATED');
  END IF;

  -- 2. Lock and validate job
  SELECT id, organizer_id, title, status, slots_total, slots_filled, hourly_rate, total_pay
  INTO v_job
  FROM jobs
  WHERE id = p_job_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'JOB_NOT_FOUND', 'message', 'Shift listing not found');
  END IF;

  -- Check organizer permission
  IF v_job.organizer_id != v_organizer_id AND NOT EXISTS (
    SELECT 1 FROM organizer_memberships WHERE organizer_id = v_job.organizer_id AND user_id = v_organizer_id
  ) THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'UNAUTHORIZED', 'message', 'Not authorized to hire for this shift');
  END IF;

  -- 3. Enforce Headcount Capacity
  IF v_job.slots_filled >= v_job.slots_total THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'HEADCOUNT_FULL',
      'message', 'Headcount limit reached. All ' || v_job.slots_total || ' openings have already been filled.'
    );
  END IF;

  -- 4. Check for duplicate booking
  IF EXISTS (SELECT 1 FROM bookings WHERE job_id = p_job_id AND worker_id = p_worker_id) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'ALREADY_BOOKED',
      'message', 'Worker is already confirmed for this shift.'
    );
  END IF;

  -- 5. Lock and update application
  SELECT id, status INTO v_app
  FROM job_applications
  WHERE job_id = p_job_id AND worker_id = p_worker_id
  FOR UPDATE;

  IF FOUND THEN
    UPDATE job_applications
    SET status = 'confirmed'
    WHERE id = v_app.id;
  ELSE
    -- If organizer directly invites/books worker who hasn't swiped yet
    INSERT INTO job_applications (job_id, worker_id, status, notes)
    VALUES (p_job_id, p_worker_id, 'confirmed', p_notes);
  END IF;

  -- 6. Generate distinct, cryptographically secure per-booking check-in credential (CSPRNG via gen_random_bytes)
  v_check_in_code := 'OP-' || upper(substr(encode(gen_random_bytes(4), 'hex'), 1, 6));

  -- Insert Booking Record with provisioned credential
  INSERT INTO bookings (
    job_id, worker_id, organizer_id, status, agreed_hourly_rate, agreed_total_pay, check_in_code
  ) VALUES (
    p_job_id, p_worker_id, v_job.organizer_id, 'confirmed', v_job.hourly_rate, v_job.total_pay, v_check_in_code
  )
  RETURNING id, job_id, worker_id, organizer_id, status, agreed_hourly_rate, agreed_total_pay, confirmed_at
  INTO v_new_booking;

  -- 7. Increment headcount and update job status if full
  UPDATE jobs
  SET
    slots_filled = slots_filled + 1,
    status = CASE WHEN slots_filled + 1 >= slots_total THEN 'filled'::shift_status ELSE status END,
    updated_at = now()
  WHERE id = p_job_id;

  -- 8. Notify Worker
  INSERT INTO notifications (
    user_id, title, body, type, data
  ) VALUES (
    p_worker_id,
    '🎉 Shift Booking Confirmed!',
    'You have been selected for ' || v_job.title || '. Tap to view your shift ticket and reporting brief.',
    'booking_confirmed',
    jsonb_build_object('job_id', p_job_id, 'booking_id', v_new_booking.id)
  );

  -- 9. Audit Log
  INSERT INTO audit_logs (
    actor_id, action, entity_type, entity_id, new_state
  ) VALUES (
    v_organizer_id, 'CONFIRM_WORKER_BOOKING', 'booking', v_new_booking.id::TEXT,
    jsonb_build_object('job_id', p_job_id, 'worker_id', p_worker_id, 'total_pay', v_job.total_pay)
  );

  RETURN jsonb_build_object(
    'success', true,
    'booking', jsonb_build_object(
      'id', v_new_booking.id,
      'job_id', v_new_booking.job_id,
      'worker_id', v_new_booking.worker_id,
      'status', v_new_booking.status,
      'agreed_hourly_rate', v_new_booking.agreed_hourly_rate,
      'agreed_total_pay', v_new_booking.agreed_total_pay,
      'confirmed_at', v_new_booking.confirmed_at
    ),
    'slots_filled', v_job.slots_filled + 1,
    'slots_total', v_job.slots_total
  );
END;
$$;

-- 7. Atomic RPC: Update Applicant Status (Shortlist / Reject)
CREATE OR REPLACE FUNCTION update_application_status_safe(
  p_application_id UUID,
  p_new_status TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_organizer_id UUID := auth.uid();
  v_app RECORD;
  v_job RECORD;
BEGIN
  IF v_organizer_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'UNAUTHENTICATED');
  END IF;

  SELECT ja.id, ja.job_id, ja.worker_id, ja.status, j.organizer_id, j.title
  INTO v_app
  FROM job_applications ja
  JOIN jobs j ON j.id = ja.job_id
  WHERE ja.id = p_application_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'APPLICATION_NOT_FOUND');
  END IF;

  IF v_app.organizer_id != v_organizer_id THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'UNAUTHORIZED');
  END IF;

  -- Update status
  UPDATE job_applications
  SET status = p_new_status::application_status
  WHERE id = p_application_id;

  -- If shortlisted, send worker a notification
  IF p_new_status = 'shortlisted' THEN
    INSERT INTO notifications (
      user_id, title, body, type, data
    ) VALUES (
      v_app.worker_id,
      '⭐ Profile Shortlisted',
      'The organizer has shortlisted you for ' || v_app.title || '. Keep your schedule open.',
      'application_shortlisted',
      jsonb_build_object('job_id', v_app.job_id)
    );
  END IF;

  -- Audit Log
  INSERT INTO audit_logs (
    actor_id, action, entity_type, entity_id, old_state, new_state
  ) VALUES (
    v_organizer_id, 'UPDATE_APPLICATION_STATUS', 'application', p_application_id::TEXT,
    jsonb_build_object('old_status', v_app.status),
    jsonb_build_object('new_status', p_new_status)
  );

  RETURN jsonb_build_object('success', true, 'status', p_new_status);
END;
$$;
