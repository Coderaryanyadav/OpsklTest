-- ==============================================================================
-- OPSKL MIGRATION: 20261015000005_enforce_kyc_on_application.sql
-- Enforces mandatory admin-approved KYC verification before applying for shifts.
-- ==============================================================================

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
  v_worker RECORD;
  v_existing_app RECORD;
  v_app_id UUID;
BEGIN
  IF v_worker_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'UNAUTHENTICATED');
  END IF;

  -- Require worker profile completed and KYC approved
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

  SELECT * INTO v_job FROM jobs WHERE id = p_job_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'JOB_NOT_FOUND');
  END IF;

  IF v_job.status NOT IN ('open', 'filling') THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'JOB_CLOSED', 'message', 'This shift is no longer open for applications.');
  END IF;

  IF v_job.date < (now() AT TIME ZONE 'Asia/Kolkata')::date THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'PAST_DATE', 'message', 'Shift date has already passed.');
  END IF;

  IF v_job.application_deadline IS NOT NULL AND v_job.application_deadline < now() THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'DEADLINE_PASSED');
  END IF;

  IF v_job.slots_filled >= v_job.slots_total THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'SLOTS_FULL');
  END IF;

  SELECT id, status INTO v_existing_app
  FROM job_applications
  WHERE job_id = p_job_id AND worker_id = v_worker_id;

  IF FOUND THEN
    IF v_existing_app.status = 'withdrawn' THEN
      UPDATE job_applications
      SET status = 'applied', updated_at = now()
      WHERE id = v_existing_app.id;

      RETURN jsonb_build_object('success', true, 'application_id', v_existing_app.id, 'status', 'applied', 'reapplied', true);
    ELSE
      RETURN jsonb_build_object('success', false, 'error_code', 'ALREADY_APPLIED', 'message', 'You have already applied for this shift.');
    END IF;
  END IF;

  INSERT INTO job_applications (
    job_id, worker_id, status
  ) VALUES (
    p_job_id, v_worker_id, 'applied'
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
