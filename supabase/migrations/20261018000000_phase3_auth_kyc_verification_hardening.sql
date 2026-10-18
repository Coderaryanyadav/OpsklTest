-- ==============================================================================
-- OPSKL MIGRATION: 20261018000000_phase3_auth_kyc_verification_hardening.sql
-- PHASE 3: AUTHENTICATION, AUTHORIZATION, WORKER KYC & ORGANIZER VERIFICATION
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. HARDEN SUBMIT_VERIFICATION_CASE_SAFE WITH PRIVACY MASKING & STORAGE SCOPING
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.submit_verification_case_safe(
  p_document_type TEXT,
  p_masked_id TEXT,
  p_storage_path TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_case_id UUID;
  v_user_str TEXT;
  v_sanitized_masked_id TEXT;
  v_raw_id TEXT;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'UNAUTHENTICATED', 'error', 'Authentication required.');
  END IF;

  v_user_str := v_user_id::TEXT;

  IF p_document_type NOT IN ('aadhaar', 'pan', 'gstin') THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'INVALID_DOCUMENT_TYPE', 'error', 'Document type must be aadhaar, pan, or gstin.');
  END IF;

  IF p_storage_path IS NULL OR trim(p_storage_path) = '' THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'MISSING_STORAGE_PATH', 'error', 'Storage path to verification document is required.');
  END IF;

  -- Storage path security: must be strictly scoped to caller's authenticated user directory
  IF NOT (
    p_storage_path LIKE (v_user_str || '/%')
    OR p_storage_path LIKE ('kyc/' || v_user_str || '/%')
    OR p_storage_path LIKE ('verification/' || v_user_str || '/%')
    OR p_storage_path LIKE ('verification/%/' || v_user_str || '.%')
  ) THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'UNAUTHORIZED_STORAGE_PATH', 'error', 'Storage path must be scoped to your authenticated user directory.');
  END IF;

  -- Enforce server-side privacy masking: raw document numbers must never be stored unmasked
  v_raw_id := trim(COALESCE(p_masked_id, ''));
  IF v_raw_id = '' THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'INVALID_DOCUMENT_ID', 'error', 'Document number or identifier is required.');
  END IF;

  IF p_document_type = 'aadhaar' THEN
    -- If 12-digit raw Aadhaar is provided, mask first 8 digits (UIDAI compliance)
    IF v_raw_id ~ '^[0-9]{12}$' THEN
      v_sanitized_masked_id := 'XXXX-XXXX-' || right(v_raw_id, 4);
    ELSIF v_raw_id ~ '^[X*]{4}-[X*]{4}-[0-9]{4}$' OR v_raw_id ~ '^[X*]{8}[0-9]{4}$' THEN
      v_sanitized_masked_id := v_raw_id;
    ELSE
      -- Extract last 4 digits and mask prefix
      DECLARE
        v_digits TEXT := regexp_replace(v_raw_id, '[^0-9]', '', 'g');
      BEGIN
        IF length(v_digits) < 4 THEN
          RETURN jsonb_build_object('success', false, 'error_code', 'INVALID_DOCUMENT_ID', 'error', 'Aadhaar must include at least the last 4 digits.');
        END IF;
        v_sanitized_masked_id := 'XXXX-XXXX-' || right(v_digits, 4);
      END;
    END IF;
  ELSIF p_document_type = 'pan' THEN
    -- PAN format: 5 letters, 4 digits, 1 letter. Mask the 4 digits: ABCDE****F
    IF length(v_raw_id) = 10 AND upper(v_raw_id) ~ '^[A-Z]{5}[0-9]{4}[A-Z]{1}$' THEN
      v_sanitized_masked_id := upper(left(v_raw_id, 5)) || '****' || upper(right(v_raw_id, 1));
    ELSIF upper(v_raw_id) ~ '^[A-Z]{5}[*X]{4}[A-Z]{1}$' THEN
      v_sanitized_masked_id := upper(v_raw_id);
    ELSE
      IF length(v_raw_id) < 5 THEN
        RETURN jsonb_build_object('success', false, 'error_code', 'INVALID_DOCUMENT_ID', 'error', 'Invalid PAN document number.');
      END IF;
      v_sanitized_masked_id := upper(left(v_raw_id, 2)) || '******' || upper(right(v_raw_id, 2));
    END IF;
  ELSIF p_document_type = 'gstin' THEN
    -- GSTIN format: 2-digit state code + 10-char PAN + 3 entity chars (15 total)
    IF length(v_raw_id) = 15 THEN
      v_sanitized_masked_id := left(v_raw_id, 2) || '*****' || right(v_raw_id, 4);
    ELSE
      v_sanitized_masked_id := v_raw_id;
    END IF;
  END IF;

  -- Resubmission rule: Reject only if an active case is already pending review
  IF EXISTS (
    SELECT 1 FROM verification_cases
    WHERE profile_id = v_user_id AND document_type = p_document_type AND status = 'pending'
  ) THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'CASE_ALREADY_PENDING', 'error', 'A verification case is already pending review for this document type.');
  END IF;

  INSERT INTO verification_cases (
    profile_id, document_type, document_masked_id, document_storage_path, status
  ) VALUES (
    v_user_id, p_document_type, v_sanitized_masked_id, p_storage_path, 'pending'
  ) RETURNING id INTO v_case_id;

  -- Update profile status to pending under trusted bypass
  PERFORM set_config('opskl.trusted', '1', true);
  UPDATE worker_profiles SET verification_status = 'pending', updated_at = now() WHERE id = v_user_id;
  UPDATE organizer_profiles SET verification_status = 'pending', updated_at = now() WHERE id = v_user_id;

  RETURN jsonb_build_object('success', true, 'case_id', v_case_id, 'status', 'pending');
END;
$$;

REVOKE EXECUTE ON FUNCTION public.submit_verification_case_safe(TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_verification_case_safe(TEXT, TEXT, TEXT) TO authenticated;

-- ------------------------------------------------------------------------------
-- 2. HARDEN ADMIN_VERIFY_CASE_SAFE WITH MANDATORY REASON, REVOCATION & EXPIRY
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.admin_verify_case_safe(
  p_case_id UUID,
  p_status TEXT,
  p_rejection_reason TEXT DEFAULT NULL,
  p_admin_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_case RECORD;
  v_admin_id UUID := auth.uid();
  v_w_profile RECORD;
  v_o_profile RECORD;
BEGIN
  IF NOT is_current_admin() THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'UNAUTHORIZED', 'error', 'Administrative authorization required.');
  END IF;

  IF p_status NOT IN ('approved', 'rejected', 'revoked', 'expired') THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'INVALID_STATUS', 'error', 'Status must be approved, rejected, revoked, or expired.');
  END IF;

  -- Rejection requires an explanatory reason
  IF p_status = 'rejected' AND (p_rejection_reason IS NULL OR length(trim(p_rejection_reason)) < 5) THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'REASON_REQUIRED', 'error', 'A specific rejection reason (at least 5 characters) is required.');
  END IF;

  SELECT * INTO v_case FROM verification_cases WHERE id = p_case_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'CASE_NOT_FOUND', 'error', 'Verification case not found.');
  END IF;

  -- For approval or initial rejection, case must be pending
  -- For revocation or expiry, case can be previously approved
  IF p_status IN ('approved', 'rejected') AND v_case.status <> 'pending' THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'INVALID_TRANSITION', 'error', 'Only pending verification cases can be approved or rejected.');
  END IF;

  IF p_status IN ('revoked', 'expired') AND v_case.status <> 'approved' THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'INVALID_TRANSITION', 'error', 'Only approved verification cases can be revoked or expired.');
  END IF;

  UPDATE verification_cases
  SET
    status = p_status,
    rejection_reason = CASE WHEN p_status IN ('rejected', 'revoked', 'expired') THEN p_rejection_reason ELSE NULL END,
    reviewed_by = COALESCE(v_admin_id, p_admin_id),
    reviewed_at = now()
  WHERE id = p_case_id;

  PERFORM set_config('opskl.trusted', '1', true);

  IF p_status = 'approved' THEN
    -- Check and update worker profile
    SELECT * INTO v_w_profile FROM worker_profiles WHERE id = v_case.profile_id;
    IF FOUND THEN
      UPDATE worker_profiles
      SET
        is_aadhaar_verified = CASE WHEN v_case.document_type = 'aadhaar' THEN true ELSE is_aadhaar_verified END,
        is_pan_verified = CASE WHEN v_case.document_type = 'pan' THEN true ELSE is_pan_verified END,
        verification_status = 'verified',
        updated_at = now()
      WHERE id = v_case.profile_id;
    END IF;

    -- Check and update organizer profile
    SELECT * INTO v_o_profile FROM organizer_profiles WHERE id = v_case.profile_id;
    IF FOUND THEN
      UPDATE organizer_profiles
      SET
        is_gstin_verified = CASE WHEN v_case.document_type = 'gstin' THEN true ELSE is_gstin_verified END,
        verification_status = 'verified',
        updated_at = now()
      WHERE id = v_case.profile_id;
    END IF;

    PERFORM _notify(v_case.profile_id, 'Verification Approved', 'Your document verification has been successfully approved.', 'verification_update');

  ELSIF p_status = 'rejected' THEN
    UPDATE worker_profiles SET verification_status = 'rejected', updated_at = now() WHERE id = v_case.profile_id;
    UPDATE organizer_profiles SET verification_status = 'rejected', updated_at = now() WHERE id = v_case.profile_id;

    PERFORM _notify(v_case.profile_id, 'Verification Update', 'Document verification was rejected: ' || p_rejection_reason, 'verification_update');

  ELSIF p_status IN ('revoked', 'expired') THEN
    UPDATE worker_profiles
    SET
      verification_status = 'rejected',
      is_aadhaar_verified = false,
      is_pan_verified = false,
      updated_at = now()
    WHERE id = v_case.profile_id;

    UPDATE organizer_profiles
    SET
      verification_status = 'rejected',
      is_gstin_verified = false,
      updated_at = now()
    WHERE id = v_case.profile_id;

    PERFORM _notify(
      v_case.profile_id,
      'Verification ' || initcap(p_status),
      'Your verified status has been ' || p_status || ': ' || COALESCE(p_rejection_reason, 'Administrative review update'),
      'verification_update'
    );
  END IF;

  INSERT INTO audit_logs (
    actor_id, action, entity_type, entity_id, new_state
  ) VALUES (
    COALESCE(v_admin_id, p_admin_id),
    'ADMIN_VERIFY_CASE',
    'verification_cases',
    p_case_id::TEXT,
    jsonb_build_object(
      'status', p_status,
      'document_type', v_case.document_type,
      'rejection_reason', p_rejection_reason,
      'profile_id', v_case.profile_id
    )
  );

  RETURN jsonb_build_object('success', true, 'case_id', p_case_id, 'status', p_status);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_verify_case_safe(UUID, TEXT, TEXT, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_verify_case_safe(UUID, TEXT, TEXT, UUID) TO authenticated;

-- ------------------------------------------------------------------------------
-- 3. SERVER-ENFORCED ACCOUNT SUSPENSION & ACTIVATION (ADMIN_SET_USER_STATUS_SAFE)
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.admin_set_user_status_safe(
  p_user_id UUID,
  p_is_active BOOLEAN,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_admin_id UUID := auth.uid();
  v_prev_active BOOLEAN;
BEGIN
  IF NOT is_current_admin() THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'UNAUTHORIZED', 'error', 'Administrative authorization required.');
  END IF;

  IF p_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'MISSING_USER_ID', 'error', 'Target user ID is required.');
  END IF;

  SELECT is_active INTO v_prev_active FROM profiles WHERE id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'USER_NOT_FOUND', 'error', 'User profile not found.');
  END IF;

  UPDATE profiles
  SET is_active = p_is_active, updated_at = now()
  WHERE id = p_user_id;

  INSERT INTO audit_logs (
    actor_id, action, entity_type, entity_id, new_state
  ) VALUES (
    v_admin_id,
    CASE WHEN p_is_active THEN 'ADMIN_ACTIVATE_USER' ELSE 'ADMIN_SUSPEND_USER' END,
    'profiles',
    p_user_id::TEXT,
    jsonb_build_object(
      'previous_is_active', v_prev_active,
      'new_is_active', p_is_active,
      'reason', p_reason
    )
  );

  RETURN jsonb_build_object('success', true, 'user_id', p_user_id, 'is_active', p_is_active);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_set_user_status_safe(UUID, BOOLEAN, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_user_status_safe(UUID, BOOLEAN, TEXT) TO authenticated;

-- ------------------------------------------------------------------------------
-- 4. HARDEN CHECK_IN_WORKER_SAFE: ENFORCE VERIFIED WORKER IDENTITY
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

  -- 8. Geolocation verification (if venue coordinates and worker GPS are present)
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
-- 5. HARDEN CONFIRM_WORKER_BOOKING_SAFE: ENFORCE VERIFIED WORKER IDENTITY
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

  -- Require worker active & verified (or admin)
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

  -- Generate cryptographically robust booking code (OP-XXXXXXXXXX)
  v_check_in_code := 'OP-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));

  -- Insert booking record
  INSERT INTO bookings (
    job_id, worker_id, organizer_id, status,
    agreed_rate, total_payout, check_in_code, notes
  ) VALUES (
    p_job_id, p_worker_id, v_job.organizer_id, 'confirmed',
    v_job.hourly_rate, v_job.total_pay, v_check_in_code, p_notes
  )
  RETURNING * INTO v_new_booking;

  -- Update application status
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
    'status', 'confirmed'
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.confirm_worker_booking_safe(UUID, UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.confirm_worker_booking_safe(UUID, UUID, TEXT) TO authenticated;

-- ------------------------------------------------------------------------------
-- 6. ORGANIZER DATA ISOLATION RLS POLICY ON ORGANIZER_PROFILES
-- ------------------------------------------------------------------------------

DROP POLICY IF EXISTS "Organizers view own business profile" ON public.organizer_profiles;
DROP POLICY IF EXISTS "Organizers and team members view business profile" ON public.organizer_profiles;

CREATE POLICY "Organizers and team members view business profile"
  ON public.organizer_profiles FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR is_current_admin()
    OR EXISTS (
      SELECT 1 FROM organizer_memberships
      WHERE organizer_id = organizer_profiles.id
        AND user_id = auth.uid()
        AND role IN ('owner', 'admin', 'manager', 'member')
    )
  );
