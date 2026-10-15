-- Migration 20261015000012: Robust category and bounds handling in create_job_safe
-- 1. Normalizes category to lowercase trim before casting to shift_category
-- 2. Aligns duration checks to allow micro-shifts (min 0.5h up to 24h)
-- 3. Ensures clear descriptive errors for organizers

CREATE OR REPLACE FUNCTION public.create_job_safe(p_job JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_organizer_id UUID := auth.uid();
  v_title TEXT := trim(p_job->>'title');
  v_raw_cat TEXT := lower(trim(p_job->>'category'));
  v_category shift_category;
  v_venue_name TEXT := trim(p_job->>'venue_name');
  v_venue_address TEXT := trim(p_job->>'venue_address');
  v_landmark TEXT := p_job->>'landmark';
  v_city TEXT := COALESCE(p_job->>'city', 'Mumbai');
  v_zone TEXT := p_job->>'zone';
  v_date DATE := (p_job->>'date')::DATE;
  v_start_time TIME := (p_job->>'start_time')::TIME;
  v_end_time TIME := (p_job->>'end_time')::TIME;
  v_hourly_rate NUMERIC := (p_job->>'hourly_rate')::NUMERIC;
  v_slots_total INTEGER := (p_job->>'slots_total')::INTEGER;
  v_status shift_status := COALESCE(p_job->>'status', 'open')::shift_status;
  v_dress_code TEXT := p_job->>'dress_code';
  v_supervisor_name TEXT := trim(p_job->>'supervisor_name');
  v_supervisor_phone TEXT := trim(p_job->>'supervisor_phone');
  v_reporting_instructions TEXT := p_job->>'reporting_instructions';
  v_cancellation_policy TEXT := p_job->>'cancellation_policy';
  v_eligibility_criteria TEXT := p_job->>'eligibility_criteria';
  v_lat NUMERIC := (p_job->>'latitude')::NUMERIC;
  v_lng NUMERIC := (p_job->>'longitude')::NUMERIC;
  v_duties TEXT[] := ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_job->'duties', '[]'::jsonb)));
  v_required_skills TEXT[] := ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_job->'required_skills', '[]'::jsonb)));
  v_perks TEXT[] := ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_job->'perks', '[]'::jsonb)));
  v_breaks_minutes INTEGER := COALESCE((p_job->>'breaks_minutes')::INTEGER, 30);
  v_meal_provided BOOLEAN := COALESCE((p_job->>'meal_provided')::BOOLEAN, false);
  v_transport_provided BOOLEAN := COALESCE((p_job->>'transport_provided')::BOOLEAN, false);
  v_overtime_policy TEXT := p_job->>'overtime_policy';
  v_crosses_midnight BOOLEAN := false;
  v_end_date DATE;
  v_duration_hours NUMERIC;
  v_total_pay NUMERIC;
  v_min_wage NUMERIC := 100.0;
  v_new_id UUID;
BEGIN
  IF v_organizer_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'UNAUTHENTICATED');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM organizer_profiles
    WHERE id = v_organizer_id AND (verification_status = 'verified' OR is_current_admin())
  ) THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'ORGANIZER_NOT_VERIFIED', 'message', 'Organizer identity verification required to post shifts.');
  END IF;

  -- Safe enum casting
  BEGIN
    v_category := v_raw_cat::shift_category;
  EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'INVALID_CATEGORY', 'message', 'Invalid shift category: ' || COALESCE(p_job->>'category', 'none'));
  END;

  -- Title length aligned with client bounds: 5 to 80 chars
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

  -- Slots limit: 1 to 100 workers
  IF v_slots_total < 1 OR v_slots_total > 100 THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'INVALID_SLOTS', 'message', 'Headcount must be between 1 and 100 workers.');
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

  -- Allow duration between 0.5 and 24 hours
  IF v_duration_hours < 0.5 OR v_duration_hours > 24.0 THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'INVALID_DURATION', 'message', 'Shift duration must be between 0.5 and 24 hours.');
  END IF;

  -- India geographic coordinate bounds check (Lat: 6–38 N, Lng: 68–98 E)
  IF v_lat IS NOT NULL OR v_lng IS NOT NULL THEN
    IF v_lat < 6.0 OR v_lat > 38.0 OR v_lng < 68.0 OR v_lng > 98.0 THEN
      RETURN jsonb_build_object('success', false, 'error_code', 'INVALID_COORDINATES', 'message', 'Coordinates must fall within the sovereign territory of India (6–38°N, 68–98°E).');
    END IF;
  END IF;

  v_total_pay := round(v_hourly_rate * v_duration_hours, 2);

  INSERT INTO jobs (
    organizer_id, title, category, venue_name, venue_address, landmark,
    city, zone, date, start_time, end_time, duration_hours,
    hourly_rate, total_pay, slots_total, slots_filled, dress_code,
    duties, perks, required_skills, breaks_minutes, meal_provided,
    transport_provided, overtime_policy, reporting_instructions,
    cancellation_policy, eligibility_criteria, latitude, longitude,
    supervisor_name, supervisor_phone, status, crosses_midnight, end_date
  ) VALUES (
    v_organizer_id, v_title, v_category, v_venue_name, v_venue_address, v_landmark,
    v_city, v_zone, v_date, v_start_time, v_end_time, v_duration_hours,
    v_hourly_rate, v_total_pay, v_slots_total, 0, v_dress_code,
    v_duties, v_perks, v_required_skills, v_breaks_minutes, v_meal_provided,
    v_transport_provided, v_overtime_policy, v_reporting_instructions,
    v_cancellation_policy, v_eligibility_criteria, v_lat, v_lng,
    v_supervisor_name, v_supervisor_phone, v_status, v_crosses_midnight, v_end_date
  ) RETURNING id INTO v_new_id;

  INSERT INTO audit_logs (
    actor_id, action, entity_type, entity_id, new_state
  ) VALUES (
    v_organizer_id, 'CREATE_JOB', 'job', v_new_id::TEXT,
    jsonb_build_object('title', v_title, 'duration_hours', v_duration_hours, 'total_pay', v_total_pay, 'crosses_midnight', v_crosses_midnight)
  );

  RETURN jsonb_build_object('success', true, 'job_id', v_new_id, 'duration_hours', v_duration_hours, 'total_pay', v_total_pay);
END;
$$;
