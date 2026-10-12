-- ============================================================================
-- OPSKL MARKETPLACE DISCOVERY & SWIPE TRANSACTIONS (PHASE 3)
-- Enhanced shift attributes, server-side eligibility checks & atomic application RPC
-- ============================================================================

-- 1. Extend jobs table with richer discovery metadata
ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS required_skills TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS eligibility_criteria TEXT,
  ADD COLUMN IF NOT EXISTS application_deadline TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS breaks_minutes INTEGER NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS meal_provided BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS transport_provided BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS overtime_policy TEXT,
  ADD COLUMN IF NOT EXISTS latitude NUMERIC(9, 6),
  ADD COLUMN IF NOT EXISTS longitude NUMERIC(9, 6);

-- 2. Update shifts backward-compatibility view
CREATE OR REPLACE VIEW shifts AS SELECT * FROM jobs;

-- 3. Enhance RLS for organizer profiles so workers can view verified organizer info on active jobs
CREATE POLICY "Workers view organizer on active jobs"
  ON organizer_profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM jobs
      WHERE jobs.organizer_id = organizer_profiles.id
        AND jobs.status IN ('open', 'filling')
    )
  );

-- 4. Atomic RPC: Safe Application with Server-side Eligibility Validation
-- Enforces:
--  - Authenticated worker caller
--  - Job is open or filling
--  - Application deadline has not elapsed
--  - Open slots remain (slots_filled < slots_total)
--  - Worker has not already applied (prevents duplicate applications)
--  - Concurrency safety with row-level locking (SELECT ... FOR UPDATE)
CREATE OR REPLACE FUNCTION apply_for_job_safe(
  p_job_id UUID,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_worker_id UUID := auth.uid();
  v_job RECORD;
  v_existing_app RECORD;
  v_new_app RECORD;
BEGIN
  -- 1. Authentication check
  IF v_worker_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'UNAUTHENTICATED',
      'message', 'User must be authenticated to apply'
    );
  END IF;

  -- 2. Lock job row to prevent concurrent race conditions
  SELECT id, status, slots_total, slots_filled, application_deadline, date
  INTO v_job
  FROM jobs
  WHERE id = p_job_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'JOB_NOT_FOUND',
      'message', 'The requested shift listing does not exist'
    );
  END IF;

  -- 3. Validate status
  IF v_job.status NOT IN ('open', 'filling') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'JOB_CLOSED',
      'message', 'This shift is no longer open for applications'
    );
  END IF;

  -- 4. Validate application deadline
  IF v_job.application_deadline IS NOT NULL AND v_job.application_deadline < now() THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'DEADLINE_PASSED',
      'message', 'The application deadline for this shift has passed'
    );
  END IF;

  -- 5. Validate capacity
  IF v_job.slots_filled >= v_job.slots_total THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'SLOTS_FULL',
      'message', 'All openings for this shift have already been filled'
    );
  END IF;

  -- 6. Check for duplicate application
  SELECT id, status INTO v_existing_app
  FROM job_applications
  WHERE job_id = p_job_id AND worker_id = v_worker_id;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'ALREADY_APPLIED',
      'message', 'You have already expressed interest in this shift',
      'application_id', v_existing_app.id,
      'application_status', v_existing_app.status
    );
  END IF;

  -- 7. Insert application
  INSERT INTO job_applications (job_id, worker_id, status, notes)
  VALUES (p_job_id, v_worker_id, 'applied', p_notes)
  RETURNING id, job_id, worker_id, status, applied_at, notes
  INTO v_new_app;

  -- 8. Record right swipe event (upsert)
  INSERT INTO swipe_events (worker_id, job_id, direction)
  VALUES (v_worker_id, p_job_id, 'right')
  ON CONFLICT (worker_id, job_id)
  DO UPDATE SET direction = 'right', created_at = now();

  -- 9. Return success
  RETURN jsonb_build_object(
    'success', true,
    'application', jsonb_build_object(
      'id', v_new_app.id,
      'job_id', v_new_app.job_id,
      'worker_id', v_new_app.worker_id,
      'status', v_new_app.status,
      'applied_at', v_new_app.applied_at,
      'notes', v_new_app.notes
    )
  );
END;
$$;

-- 5. RPC: Record Left Swipe (Pass)
CREATE OR REPLACE FUNCTION record_swipe_pass(
  p_job_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_worker_id UUID := auth.uid();
BEGIN
  IF v_worker_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'UNAUTHENTICATED');
  END IF;

  INSERT INTO swipe_events (worker_id, job_id, direction)
  VALUES (v_worker_id, p_job_id, 'left')
  ON CONFLICT (worker_id, job_id)
  DO UPDATE SET direction = 'left', created_at = now();

  RETURN jsonb_build_object('success', true);
END;
$$;

-- 6. RPC: Undo Left Swipe (Skip Undo)
CREATE OR REPLACE FUNCTION undo_swipe_event(
  p_job_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_worker_id UUID := auth.uid();
BEGIN
  IF v_worker_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'UNAUTHENTICATED');
  END IF;

  DELETE FROM swipe_events
  WHERE worker_id = v_worker_id
    AND job_id = p_job_id
    AND direction = 'left';

  RETURN jsonb_build_object('success', true);
END;
$$;
