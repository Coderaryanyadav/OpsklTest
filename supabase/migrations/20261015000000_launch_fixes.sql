-- ==============================================================================
-- OPSKL LAUNCH FIXES & PRODUCTION MARKETPLACE ENGINE (PHASE 1)
-- Sequential Migration: 20261015000000_launch_fixes.sql
-- Enforces:
--  1.1 Trusted internal trigger bypass (set_config 'opskl.trusted')
--  1.2 Dispute detail handling & direct insert lockdown
--  1.3 Organizer signup phone relaxation & CSPRNG booking codes
--  1.4 RLS privacy hardening, public_jobs view & supervisor RPC
--  1.5 Job lifecycle state machine & non-resurrecting reopen guards
--  1.6 Overlapping booking guards & internal _notify helper
--  1.7 Application withdraw/re-apply & SQL keyset discovery feed
--  1.8 Check-in time window, geofencing & SQL hours adjustment
--  1.9 Admin dispute arbitration, KYC resolution & purge safety
--  1.10 FY sequential invoices, manual escrow & payout settlement
--  1.11 Overnight shifts, Indian coordinate bounds & realtime bindings
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1.1 TRIGGER BYPASS FOR TRUSTED INTERNAL UPDATES
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION check_worker_profile_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- 1. Allow trusted internal updates via transaction-local setting
  IF current_setting('opskl.trusted', true) = '1' THEN
    RETURN NEW;
  END IF;

  -- 2. Allow administrative role
  IF is_current_admin() THEN
    RETURN NEW;
  END IF;

  IF NEW.id IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION 'Unauthorized: Profile ID cannot be modified.';
  END IF;

  IF NEW.verification_status IS DISTINCT FROM OLD.verification_status OR
     NEW.rating IS DISTINCT FROM OLD.rating OR
     NEW.total_reviews IS DISTINCT FROM OLD.total_reviews OR
     NEW.shifts_completed IS DISTINCT FROM OLD.shifts_completed OR
     NEW.is_aadhaar_verified IS DISTINCT FROM OLD.is_aadhaar_verified OR
     NEW.is_pan_verified IS DISTINCT FROM OLD.is_pan_verified THEN
    RAISE EXCEPTION 'Unauthorized: Administrative and verification fields cannot be modified directly by workers.';
  END IF;

  IF NEW.upi_id IS DISTINCT FROM OLD.upi_id AND NEW.upi_id IS NOT NULL AND trim(NEW.upi_id) != '' THEN
    IF NEW.upi_id !~* '^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$' THEN
      RAISE EXCEPTION 'Invalid UPI ID format. Payout destination handle must be valid (e.g. name@bank).';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION check_organizer_profile_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- 1. Allow trusted internal updates via transaction-local setting
  IF current_setting('opskl.trusted', true) = '1' THEN
    RETURN NEW;
  END IF;

  -- 2. Allow administrative role
  IF is_current_admin() THEN
    RETURN NEW;
  END IF;

  IF NEW.id IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION 'Unauthorized: Organizer profile ID cannot be modified.';
  END IF;

  IF NEW.verification_status IS DISTINCT FROM OLD.verification_status OR
     NEW.rating IS DISTINCT FROM OLD.rating OR
     NEW.total_events_hosted IS DISTINCT FROM OLD.total_events_hosted OR
     NEW.is_gstin_verified IS DISTINCT FROM OLD.is_gstin_verified THEN
    RAISE EXCEPTION 'Unauthorized: Administrative and verification fields cannot be modified directly by organizers.';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION prevent_role_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- 1. Allow trusted internal updates via transaction-local setting
  IF current_setting('opskl.trusted', true) = '1' THEN
    RETURN NEW;
  END IF;

  -- 2. Allow administrative role
  IF is_current_admin() THEN
    RETURN NEW;
  END IF;

  IF NEW.role IS DISTINCT FROM OLD.role THEN
    RAISE EXCEPTION 'Unauthorized: Users cannot change their assigned role.';
  END IF;

  IF NEW.is_active IS DISTINCT FROM OLD.is_active THEN
    RAISE EXCEPTION 'Unauthorized: Account activation status cannot be modified directly by users.';
  END IF;

  IF NEW.id IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION 'Unauthorized: Profile ID cannot be modified.';
  END IF;

  RETURN NEW;
END;
$$;

-- ------------------------------------------------------------------------------
-- 1.2 DISPUTES SCHEMA & RPC HARDENING
-- ------------------------------------------------------------------------------

ALTER TABLE disputes ADD COLUMN IF NOT EXISTS details TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS status_before_dispute TEXT;

DROP POLICY IF EXISTS "Participants create disputes" ON disputes;

CREATE OR REPLACE FUNCTION dispute_booking_safe(
  p_booking_id UUID,
  p_reason TEXT,
  p_evidence TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_booking RECORD;
  v_respondent_id UUID;
  v_dispute_id UUID;
  v_details TEXT;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'UNAUTHENTICATED');
  END IF;

  IF length(trim(COALESCE(p_reason, ''))) < 10 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'INVALID_REASON',
      'message', 'Dispute reason must be at least 10 characters long.'
    );
  END IF;

  SELECT * INTO v_booking FROM bookings WHERE id = p_booking_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'BOOKING_NOT_FOUND');
  END IF;

  IF v_user_id != v_booking.worker_id AND v_user_id != v_booking.organizer_id AND NOT is_current_admin() THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'UNAUTHORIZED');
  END IF;

  IF NOT validate_booking_transition(v_booking.status, 'disputed') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'INVALID_TRANSITION',
      'message', 'Cannot dispute booking from status ' || v_booking.status
    );
  END IF;

  v_respondent_id := CASE WHEN v_user_id = v_booking.worker_id THEN v_booking.organizer_id ELSE v_booking.worker_id END;
  v_details := COALESCE(NULLIF(trim(p_evidence), ''), trim(p_reason));

  UPDATE bookings
  SET
    status_before_dispute = v_booking.status,
    status = 'disputed',
    dispute_reason = trim(p_reason)
  WHERE id = p_booking_id;

  INSERT INTO disputes (
    booking_id, raised_by, respondent_id, reason, details, status
  ) VALUES (
    p_booking_id, v_user_id, v_respondent_id, trim(p_reason), v_details, 'open'
  ) RETURNING id INTO v_dispute_id;

  -- Notify respondent
  INSERT INTO notifications (
    user_id, title, body, type, channel, delivery_status, data
  ) VALUES (
    v_respondent_id,
    'Booking Record Disputed',
    'A dispute has been opened regarding your shift booking. An Opskl Admin will arbitrate.',
    'dispute_update',
    'in_app',
    'delivered',
    jsonb_build_object('dispute_id', v_dispute_id, 'booking_id', p_booking_id)
  );

  INSERT INTO audit_logs (
    actor_id, action, entity_type, entity_id, new_state
  ) VALUES (
    v_user_id, 'DISPUTE_BOOKING', 'dispute', v_dispute_id::TEXT,
    jsonb_build_object('booking_id', p_booking_id, 'reason', p_reason, 'status_before_dispute', v_booking.status)
  );

  RETURN jsonb_build_object(
    'success', true,
    'dispute_id', v_dispute_id,
    'status', 'disputed'
  );
END;
$$;

-- ------------------------------------------------------------------------------
-- 1.3 ORGANIZER SIGNUP & CSPRNG BOOKING CODE
-- ------------------------------------------------------------------------------

ALTER TABLE organizer_profiles ALTER COLUMN business_contact_phone DROP NOT NULL;

CREATE OR REPLACE FUNCTION public.handle_new_user_provisioning()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role user_role;
  v_phone TEXT;
  v_name TEXT;
  v_email TEXT;
BEGIN
  v_role := CASE
    WHEN (NEW.raw_user_meta_data->>'role') = 'organizer' THEN 'organizer'::user_role
    ELSE 'worker'::user_role
  END;

  v_email := NEW.email;
  v_phone := COALESCE(NEW.phone, NEW.raw_user_meta_data->>'phone');
  v_name := COALESCE(
    NEW.raw_user_meta_data->>'full_name', 
    NEW.raw_user_meta_data->>'name', 
    CASE WHEN v_email IS NOT NULL THEN split_part(v_email, '@', 1) ELSE 'User ' || substr(NEW.id::text, 1, 6) END
  );

  INSERT INTO public.profiles (
    id, role, phone, full_name, email, city, is_active
  ) VALUES (
    NEW.id, v_role, v_phone, v_name, v_email, 'Mumbai', true
  )
  ON CONFLICT (id) DO UPDATE SET
    email = COALESCE(EXCLUDED.email, profiles.email);

  IF v_role = 'worker' THEN
    INSERT INTO public.worker_profiles (
      id, preferred_locality, skills, availability_status, profile_completion_status, verification_status
    ) VALUES (
      NEW.id, 'Mumbai', '{}', 'available', 'incomplete', 'unverified'
    )
    ON CONFLICT (id) DO NOTHING;
  ELSIF v_role = 'organizer' THEN
    INSERT INTO public.organizer_profiles (
      id, business_name, business_contact_phone, business_contact_email, business_type, profile_completion_status, verification_status
    ) VALUES (
      NEW.id, v_name, COALESCE(v_phone, ''), v_email, 'event_agency', 'incomplete', 'unverified'
    )
    ON CONFLICT (id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION ensure_user_profile_provisioned_safe(
  p_role user_role DEFAULT 'worker',
  p_full_name TEXT DEFAULT NULL,
  p_phone TEXT DEFAULT NULL,
  p_email TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_existing_profile RECORD;
  v_role user_role := COALESCE(p_role, 'worker');
  v_name TEXT;
  v_phone TEXT;
  v_email TEXT;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Authentication required.');
  END IF;

  IF v_role = 'admin' THEN
    v_role := 'worker';
  END IF;

  SELECT email INTO v_email FROM auth.users WHERE id = v_user_id;
  v_email := COALESCE(p_email, v_email);

  SELECT * INTO v_existing_profile FROM profiles WHERE id = v_user_id;

  IF FOUND THEN
    v_role := v_existing_profile.role;
    IF v_existing_profile.email IS NULL AND v_email IS NOT NULL THEN
      UPDATE profiles SET email = v_email WHERE id = v_user_id;
    END IF;
  ELSE
    v_name := COALESCE(
      p_full_name, 
      CASE WHEN v_email IS NOT NULL THEN split_part(v_email, '@', 1) ELSE 'User ' || substr(v_user_id::text, 1, 6) END
    );
    v_phone := p_phone;

    INSERT INTO profiles (id, role, phone, full_name, email, city, is_active)
    VALUES (v_user_id, v_role, v_phone, v_name, v_email, 'Mumbai', true)
    ON CONFLICT (id) DO UPDATE SET
      email = COALESCE(EXCLUDED.email, profiles.email);
  END IF;

  IF v_role = 'worker' THEN
    INSERT INTO worker_profiles (id, preferred_locality, skills, availability_status, profile_completion_status, verification_status)
    VALUES (v_user_id, 'Mumbai', '{}', 'available', 'incomplete', 'unverified')
    ON CONFLICT (id) DO NOTHING;
  ELSIF v_role = 'organizer' THEN
    INSERT INTO organizer_profiles (id, business_name, business_contact_phone, business_contact_email, business_type, profile_completion_status, verification_status)
    VALUES (v_user_id, COALESCE(p_full_name, 'Independent Organizer'), COALESCE(v_phone, ''), v_email, 'independent', 'incomplete', 'unverified')
    ON CONFLICT (id) DO NOTHING;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'user_id', v_user_id,
    'role', v_role,
    'email', v_email
  );
END;
$$;

-- ------------------------------------------------------------------------------
-- 1.4 RLS PRIVACY, PUBLIC_JOBS VIEW & SUPERVISOR RPC
-- ------------------------------------------------------------------------------

DROP POLICY IF EXISTS "Workers view organizer on active jobs" ON organizer_profiles;
REVOKE SELECT ON public_organizer_cards FROM anon;
GRANT SELECT ON public_organizer_cards TO authenticated;

DROP POLICY IF EXISTS "Anyone authenticated can view open jobs" ON jobs;
CREATE POLICY "Anyone authenticated can view open jobs"
  ON jobs FOR SELECT TO authenticated
  USING (status IN ('open', 'filling'));

-- Create public discovery view that shields supervisor direct contact details
CREATE OR REPLACE VIEW public_jobs AS
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
    updated_at
  FROM jobs;

REVOKE SELECT ON public_jobs FROM anon;
GRANT SELECT ON public_jobs TO authenticated;

-- Disclose supervisor phone/name only to confirmed workers, organizer, or admin
CREATE OR REPLACE FUNCTION get_job_contact(p_job_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_job RECORD;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'UNAUTHENTICATED');
  END IF;

  SELECT id, organizer_id, supervisor_name, supervisor_phone INTO v_job
  FROM jobs WHERE id = p_job_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'JOB_NOT_FOUND');
  END IF;

  IF v_job.organizer_id = v_user_id OR is_current_admin() OR EXISTS (
    SELECT 1 FROM bookings
    WHERE job_id = p_job_id
      AND worker_id = v_user_id
      AND status IN ('confirmed', 'checked_in', 'checked_out', 'completed_awaiting_review', 'completed')
  ) THEN
    RETURN jsonb_build_object(
      'success', true,
      'supervisor_name', v_job.supervisor_name,
      'supervisor_phone', v_job.supervisor_phone
    );
  END IF;

  RETURN jsonb_build_object(
    'success', false,
    'error_code', 'UNAUTHORIZED',
    'message', 'Supervisor contact details are disclosed only upon booking confirmation.'
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION get_job_contact(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION get_job_contact(UUID) TO authenticated;

-- Reviews RLS & RPC
DROP POLICY IF EXISTS "Users view reviews" ON reviews;
DROP POLICY IF EXISTS "Participants create reviews" ON reviews;
DROP POLICY IF EXISTS "Participants and admins view reviews" ON reviews;

CREATE POLICY "Participants and admins view reviews"
  ON reviews FOR SELECT TO authenticated
  USING (reviewer_id = auth.uid() OR reviewee_id = auth.uid() OR is_current_admin());

CREATE OR REPLACE FUNCTION submit_review_safe(
  p_booking_id UUID,
  p_rating INTEGER,
  p_comment TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_booking RECORD;
  v_target_id UUID;
  v_review_id UUID;
  v_avg_rating NUMERIC(3, 2);
  v_total_reviews INT;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'UNAUTHENTICATED');
  END IF;

  IF p_rating < 1 OR p_rating > 5 THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'INVALID_RATING', 'message', 'Rating must be between 1 and 5');
  END IF;

  SELECT * INTO v_booking FROM bookings WHERE id = p_booking_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'BOOKING_NOT_FOUND');
  END IF;

  IF v_booking.status != 'completed' THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'BOOKING_NOT_COMPLETED', 'message', 'Reviews can only be submitted for completed shifts.');
  END IF;

  IF v_user_id = v_booking.worker_id THEN
    v_target_id := v_booking.organizer_id;
  ELSIF v_user_id = v_booking.organizer_id THEN
    v_target_id := v_booking.worker_id;
  ELSE
    RETURN jsonb_build_object('success', false, 'error_code', 'UNAUTHORIZED');
  END IF;

  IF EXISTS (SELECT 1 FROM reviews WHERE booking_id = p_booking_id AND reviewer_id = v_user_id) THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'ALREADY_REVIEWED', 'message', 'You have already submitted a review for this booking.');
  END IF;

  INSERT INTO reviews (
    job_id, booking_id, reviewer_id, reviewee_id, rating, comment
  ) VALUES (
    v_booking.job_id, p_booking_id, v_user_id, v_target_id, p_rating, NULLIF(trim(p_comment), '')
  ) RETURNING id INTO v_review_id;

  -- Recompute average rating and total reviews on reviewee profile using trusted bypass
  PERFORM set_config('opskl.trusted', '1', true);

  IF v_target_id = v_booking.worker_id THEN
    SELECT round(avg(rating)::numeric, 2), count(*) INTO v_avg_rating, v_total_reviews
    FROM reviews WHERE reviewee_id = v_target_id;

    UPDATE worker_profiles
    SET rating = v_avg_rating, total_reviews = v_total_reviews, updated_at = now()
    WHERE id = v_target_id;
  ELSIF v_target_id = v_booking.organizer_id THEN
    SELECT round(avg(rating)::numeric, 2) INTO v_avg_rating
    FROM reviews WHERE reviewee_id = v_target_id;

    UPDATE organizer_profiles
    SET rating = v_avg_rating, updated_at = now()
    WHERE id = v_target_id;
  END IF;

  RETURN jsonb_build_object('success', true, 'review_id', v_review_id, 'rating', p_rating);
END;
$$;

REVOKE EXECUTE ON FUNCTION submit_review_safe(UUID, INTEGER, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION submit_review_safe(UUID, INTEGER, TEXT) TO authenticated;

-- Safety reports RLS tightening
DROP POLICY IF EXISTS "Users can create safety reports" ON safety_reports;
CREATE POLICY "Users can create safety reports"
  ON safety_reports FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = reporter_id
    AND status = 'open'
    AND resolved_by IS NULL
    AND staff_notes IS NULL
    AND action_taken IS NULL
  );

-- Job applications insert direct policy removal (RPC only)
DROP POLICY IF EXISTS "Workers apply to open jobs" ON job_applications;

-- Admin select policies
DROP POLICY IF EXISTS "Admins view all worker profiles" ON worker_profiles;
CREATE POLICY "Admins view all worker profiles"
  ON worker_profiles FOR SELECT TO authenticated
  USING (is_current_admin());

DROP POLICY IF EXISTS "Admins view all payment records" ON payment_records;
CREATE POLICY "Admins view all payment records"
  ON payment_records FOR SELECT TO authenticated
  USING (is_current_admin());

DROP POLICY IF EXISTS "Admins view all reviews" ON reviews;
CREATE POLICY "Admins view all reviews"
  ON reviews FOR SELECT TO authenticated
  USING (is_current_admin());

-- ------------------------------------------------------------------------------
-- 1.5 JOB LIFECYCLE STATE MACHINE & EXPIRATION WORKER
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION validate_job_transition(
  p_current_status TEXT,
  p_new_status TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF p_current_status = p_new_status THEN
    RETURN true;
  END IF;

  IF p_current_status = 'draft' AND p_new_status IN ('open', 'cancelled') THEN
    RETURN true;
  ELSIF p_current_status = 'open' AND p_new_status IN ('filling', 'filled', 'paused', 'cancelled') THEN
    RETURN true;
  ELSIF p_current_status = 'filling' AND p_new_status IN ('filled', 'paused', 'cancelled') THEN
    RETURN true;
  ELSIF p_current_status = 'filled' AND p_new_status IN ('filling', 'cancelled', 'in_progress') THEN
    RETURN true;
  ELSIF p_current_status = 'paused' AND p_new_status IN ('open', 'filling', 'cancelled') THEN
    RETURN true;
  ELSIF p_current_status = 'in_progress' AND p_new_status = 'completed' THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

-- Helper to safely send an in-app notification respecting preferences
CREATE OR REPLACE FUNCTION _notify(
  p_user_id UUID,
  p_title TEXT,
  p_body TEXT,
  p_type TEXT,
  p_action_url TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}',
  p_idempotency_key TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prefs RECORD;
  v_delivery_status TEXT := 'delivered';
  v_notification_id UUID;
BEGIN
  SELECT in_app_enabled INTO v_prefs
  FROM user_notification_preferences
  WHERE user_id = p_user_id;

  IF FOUND AND v_prefs.in_app_enabled = false THEN
    v_delivery_status := 'suppressed';
  END IF;

  INSERT INTO notifications (
    user_id,
    title,
    body,
    type,
    channel,
    delivery_status,
    action_url,
    priority,
    data,
    idempotency_key
  ) VALUES (
    p_user_id,
    p_title,
    p_body,
    p_type,
    'in_app',
    v_delivery_status,
    p_action_url,
    'normal',
    p_metadata,
    p_idempotency_key
  )
  ON CONFLICT (idempotency_key) DO NOTHING
  RETURNING id INTO v_notification_id;

  RETURN v_notification_id;
END;
$$;

CREATE OR REPLACE FUNCTION update_job_status_safe(
  p_job_id UUID,
  p_new_status shift_status,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id UUID := auth.uid();
  v_job RECORD;
  v_booking RECORD;
  v_invoice RECORD;
BEGIN
  IF v_actor_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'UNAUTHENTICATED');
  END IF;

  SELECT * INTO v_job FROM jobs WHERE id = p_job_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'JOB_NOT_FOUND', 'message', 'Shift listing not found');
  END IF;

  IF v_job.organizer_id != v_actor_id AND NOT is_current_admin() THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'UNAUTHORIZED', 'message', 'Not authorized to update this shift');
  END IF;

  -- Validate state machine transition
  IF NOT validate_job_transition(v_job.status::TEXT, p_new_status::TEXT) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'INVALID_TRANSITION',
      'message', 'Cannot transition shift from ' || v_job.status || ' to ' || p_new_status
    );
  END IF;

  -- Enforce killswitch if attempting to open a shift while paused
  IF p_new_status IN ('open', 'filling') AND EXISTS (
    SELECT 1 FROM platform_settings
    WHERE key = 'booking_killswitch' AND (value->>'is_paused')::BOOLEAN = true
  ) THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'BOOKINGS_PAUSED', 'message', 'Cannot activate shifts while marketplace bookings are paused');
  END IF;

  -- Atomic cancellation cascade
  IF p_new_status = 'cancelled' THEN
    -- Cancel non-terminal bookings
    FOR v_booking IN
      SELECT b.id, b.worker_id FROM bookings b
      WHERE b.job_id = p_job_id AND b.status IN ('selected_awaiting_confirmation', 'confirmed')
    LOOP
      UPDATE bookings
      SET status = 'cancelled', cancellation_reason = COALESCE(p_reason, 'Shift cancelled by organizer'), cancelled_by = v_actor_id
      WHERE id = v_booking.id;

      PERFORM _notify(
        v_booking.worker_id,
        'Shift Cancelled',
        'Your shift for ' || v_job.title || ' has been cancelled: ' || COALESCE(p_reason, 'Cancelled by organizer'),
        'shift_cancelled',
        '/shift/' || p_job_id,
        jsonb_build_object('job_id', p_job_id, 'reason', p_reason)
      );
    END LOOP;

    -- Set active applications to rejected so worker discovery feed correctly identifies past rejection
    UPDATE job_applications
    SET status = 'rejected'
    WHERE job_id = p_job_id AND status IN ('applied', 'shortlisted');

    -- Flag funded invoice for refund review
    SELECT * INTO v_invoice FROM organizer_invoices WHERE job_id = p_job_id AND status = 'escrow_funded';
    IF FOUND THEN
      INSERT INTO payment_reconciliation_logs (
        reconciliation_type, reference_id, status, expected_amount, recorded_amount, discrepancy_amount, notes, actor_id
      ) VALUES (
        'refund', v_invoice.invoice_number, 'discrepancy', v_invoice.total_payable, 0.00, v_invoice.total_payable,
        'Shift cancelled after escrow funded. Pending organizer refund reconciliation.', v_actor_id
      );
    END IF;
  END IF;

  UPDATE jobs
  SET status = p_new_status, updated_at = now()
  WHERE id = p_job_id;

  INSERT INTO audit_logs (
    actor_id, action, entity_type, entity_id, new_state
  ) VALUES (
    v_actor_id, 'UPDATE_JOB_STATUS', 'job', p_job_id::TEXT,
    jsonb_build_object('old_status', v_job.status, 'new_status', p_new_status, 'reason', p_reason)
  );

  RETURN jsonb_build_object('success', true, 'status', p_new_status);
END;
$$;

-- Scheduled background maintenance: close expired jobs and reconcile stale check-ins
CREATE OR REPLACE FUNCTION close_expired_jobs()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job RECORD;
  v_has_completed BOOLEAN;
  v_jobs_closed INT := 0;
  v_stale_bookings INT := 0;
BEGIN
  -- 1. Close past-dated open/filling/filled jobs
  FOR v_job IN
    SELECT id, status FROM jobs
    WHERE date < (now() AT TIME ZONE 'Asia/Kolkata')::date
      AND status IN ('open', 'filling', 'filled')
  LOOP
    SELECT EXISTS (SELECT 1 FROM bookings WHERE job_id = v_job.id AND status = 'completed') INTO v_has_completed;
    IF v_has_completed THEN
      UPDATE jobs SET status = 'completed', updated_at = now() WHERE id = v_job.id;
    ELSE
      UPDATE jobs SET status = 'cancelled', updated_at = now() WHERE id = v_job.id;
    END IF;
    v_jobs_closed := v_jobs_closed + 1;
  END LOOP;

  -- 2. Mark stale checked-in bookings (> 16 hours) as completed_awaiting_review
  WITH updated AS (
    UPDATE bookings
    SET status = 'completed_awaiting_review'
    WHERE status = 'checked_in'
      AND check_in_time < (now() - interval '16 hours')
    RETURNING id
  )
  SELECT count(*) INTO v_stale_bookings FROM updated;

  RETURN jsonb_build_object(
    'success', true,
    'jobs_closed', v_jobs_closed,
    'stale_bookings_advanced', v_stale_bookings
  );
END;
$$;

-- ------------------------------------------------------------------------------
-- 1.6 HIRING RULES & DOUBLE-BOOKING GUARDS
-- ------------------------------------------------------------------------------

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

  -- Owner-only permissions check (DECISION: default owner-only)
  IF v_job.organizer_id != v_organizer_id AND NOT is_current_admin() THEN
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

  -- Existing application check (DECISION: direct invites rejected by default)
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

  -- CSPRNG check-in code without pgcrypto dependency
  v_check_in_code := 'OP-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));

  -- Create booking record
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

  -- Increment filled slots
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

-- ------------------------------------------------------------------------------
-- 1.7 APPLICATIONS WITHDRAWAL, RE-APPLY & SQL DISCOVERY FEED
-- ------------------------------------------------------------------------------

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
BEGIN
  IF v_organizer_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'UNAUTHENTICATED');
  END IF;

  IF p_new_status NOT IN ('shortlisted', 'rejected') THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'INVALID_STATUS', 'message', 'Status must be shortlisted or rejected.');
  END IF;

  SELECT ja.id, ja.job_id, ja.worker_id, ja.status, j.organizer_id, j.title
  INTO v_app
  FROM job_applications ja
  JOIN jobs j ON j.id = ja.job_id
  WHERE ja.id = p_application_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'APPLICATION_NOT_FOUND');
  END IF;

  IF v_app.organizer_id != v_organizer_id AND NOT is_current_admin() THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'UNAUTHORIZED');
  END IF;

  -- Enforce transition matrix
  IF v_app.status NOT IN ('applied', 'shortlisted') AND NOT (v_app.status = 'rejected' AND p_new_status = 'shortlisted') THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'INVALID_TRANSITION', 'message', 'Cannot transition application from ' || v_app.status);
  END IF;

  UPDATE job_applications
  SET status = p_new_status::application_status, updated_at = now()
  WHERE id = p_application_id;

  IF p_new_status = 'shortlisted' THEN
    PERFORM _notify(
      v_app.worker_id,
      'Profile Shortlisted',
      'The organizer has shortlisted you for ' || v_app.title || '. Keep your schedule open.',
      'application_shortlisted',
      '/shift/' || v_app.job_id,
      jsonb_build_object('job_id', v_app.job_id)
    );
  ELSIF p_new_status = 'rejected' THEN
    PERFORM _notify(
      v_app.worker_id,
      'Application Update',
      'Your application for ' || v_app.title || ' was not selected by the organizer.',
      'application_rejected',
      '/shift/' || v_app.job_id,
      jsonb_build_object('job_id', v_app.job_id)
    );
  END IF;

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

  -- Require worker profile completed
  SELECT p.is_active, wp.profile_completion_status INTO v_worker
  FROM profiles p
  JOIN worker_profiles wp ON wp.id = p.id
  WHERE p.id = v_worker_id;

  IF NOT FOUND OR v_worker.is_active = false THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'INELIGIBLE_WORKER', 'message', 'Active worker account required.');
  END IF;

  IF v_worker.profile_completion_status != 'completed' THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'PROFILE_INCOMPLETE', 'message', 'Please complete your onboarding profile before applying.');
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

  RETURN jsonb_build_object('success', true, 'application_id', v_app_id, 'status', 'applied');
END;
$$;

CREATE OR REPLACE FUNCTION withdraw_application_safe(p_application_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_worker_id UUID := auth.uid();
  v_app RECORD;
BEGIN
  IF v_worker_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'UNAUTHENTICATED');
  END IF;

  SELECT * INTO v_app FROM job_applications WHERE id = p_application_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'APPLICATION_NOT_FOUND');
  END IF;

  IF v_app.worker_id != v_worker_id AND NOT is_current_admin() THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'UNAUTHORIZED');
  END IF;

  IF v_app.status NOT IN ('applied', 'shortlisted') THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'CANNOT_WITHDRAW', 'message', 'Can only withdraw pending or shortlisted applications.');
  END IF;

  UPDATE job_applications
  SET status = 'withdrawn', updated_at = now()
  WHERE id = p_application_id;

  INSERT INTO audit_logs (
    actor_id, action, entity_type, entity_id, new_state
  ) VALUES (
    v_worker_id, 'WITHDRAW_APPLICATION', 'application', p_application_id::TEXT,
    jsonb_build_object('old_status', v_app.status, 'new_status', 'withdrawn')
  );

  RETURN jsonb_build_object('success', true, 'status', 'withdrawn');
END;
$$;

REVOKE EXECUTE ON FUNCTION withdraw_application_safe(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION withdraw_application_safe(UUID) TO authenticated;

-- Keyset-paginated SQL discovery feed
CREATE OR REPLACE FUNCTION get_discovery_feed(
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
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_zone TEXT := NULLIF(trim(p_filters->>'zone'), '');
  v_category TEXT := NULLIF(trim(p_filters->>'category'), '');
  v_min_pay NUMERIC := (p_filters->>'min_pay')::NUMERIC;
  v_cursor_date DATE;
  v_cursor_pay NUMERIC;
  v_cursor_id UUID;
BEGIN
  IF p_cursor IS NOT NULL THEN
    v_cursor_date := (p_cursor->>'date')::DATE;
    v_cursor_pay := (p_cursor->>'total_pay')::NUMERIC;
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
    AND j.date >= (now() AT TIME ZONE 'Asia/Kolkata')::date
    AND j.slots_filled < j.slots_total
    AND (j.application_deadline IS NULL OR j.application_deadline > now())
    AND (v_zone IS NULL OR v_zone = 'all' OR j.zone = v_zone)
    AND (v_category IS NULL OR v_category = 'all' OR j.category::TEXT = v_category)
    AND (v_min_pay IS NULL OR j.total_pay >= v_min_pay)
    -- Exclude shifts with existing applications (applied, shortlisted, confirmed, rejected)
    AND (v_user_id IS NULL OR NOT EXISTS (
      SELECT 1 FROM job_applications ja
      WHERE ja.job_id = j.id AND ja.worker_id = v_user_id AND ja.status IN ('applied', 'shortlisted', 'confirmed', 'rejected')
    ))
    -- Exclude left swipes
    AND (v_user_id IS NULL OR NOT EXISTS (
      SELECT 1 FROM swipe_events se
      WHERE se.job_id = j.id AND se.worker_id = v_user_id AND se.direction = 'left'
    ))
    -- Keyset cursor condition: (date ASC, total_pay DESC, id ASC)
    AND (
      p_cursor IS NULL OR
      (j.date > v_cursor_date) OR
      (j.date = v_cursor_date AND j.total_pay < v_cursor_pay) OR
      (j.date = v_cursor_date AND j.total_pay = v_cursor_pay AND j.id > v_cursor_id)
    )
  ORDER BY j.date ASC, j.total_pay DESC, j.id ASC
  LIMIT LEAST(p_limit, 50);
END;
$$;

REVOKE EXECUTE ON FUNCTION get_discovery_feed(JSONB, INT, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION get_discovery_feed(JSONB, INT, JSONB) TO authenticated;

-- ------------------------------------------------------------------------------
-- 1.8 ATTENDANCE ENGINE & SQL HOURS ADJUSTMENT
-- ------------------------------------------------------------------------------

ALTER TABLE attendance_records ALTER COLUMN distance_to_venue_km TYPE NUMERIC(8, 2);
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS approved_total_pay NUMERIC(10, 2);

-- Cancel / No-show non-resurrecting reopen logic
CREATE OR REPLACE FUNCTION cancel_booking_safe(
  p_booking_id UUID,
  p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_booking RECORD;
  v_job RECORD;
  v_standby RECORD;
BEGIN
  SELECT * INTO v_booking FROM bookings WHERE id = p_booking_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'BOOKING_NOT_FOUND');
  END IF;

  IF v_user_id != v_booking.worker_id AND v_user_id != v_booking.organizer_id AND NOT is_current_admin() THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'UNAUTHORIZED');
  END IF;

  IF NOT validate_booking_transition(v_booking.status, 'cancelled') THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'INVALID_TRANSITION', 'message', 'Cannot cancel booking in status ' || v_booking.status);
  END IF;

  SELECT * INTO v_job FROM jobs WHERE id = v_booking.job_id FOR UPDATE;

  UPDATE bookings
  SET
    status = 'cancelled',
    cancellation_reason = p_reason,
    cancelled_by = v_user_id
  WHERE id = p_booking_id;

  -- Update application: withdrawn if worker cancelled, rejected if organizer cancelled
  UPDATE job_applications
  SET status = CASE WHEN v_user_id = v_booking.worker_id THEN 'withdrawn'::application_status ELSE 'rejected'::application_status END,
      updated_at = now()
  WHERE job_id = v_booking.job_id AND worker_id = v_booking.worker_id;

  -- Reopen slot only if job is not terminal, not paused, and date is today or future
  IF v_job.status IN ('filled', 'filling', 'open') AND v_job.date >= (now() AT TIME ZONE 'Asia/Kolkata')::date THEN
    UPDATE jobs
    SET
      slots_filled = GREATEST(0, slots_filled - 1),
      status = CASE WHEN slots_filled - 1 > 0 THEN 'filling'::shift_status ELSE 'open'::shift_status END,
      updated_at = now()
    WHERE id = v_booking.job_id;
  END IF;

  -- Replacement notify shortlisted
  FOR v_standby IN
    SELECT worker_id FROM job_applications WHERE job_id = v_booking.job_id AND status = 'shortlisted'
  LOOP
    PERFORM _notify(
      v_standby.worker_id,
      'Opening Available',
      'A confirmed spot just opened up for ' || v_job.title || '.',
      'standby_callout',
      '/shift/' || v_job.id,
      jsonb_build_object('job_id', v_job.id)
    );
  END LOOP;

  -- Notify other party
  IF v_user_id = v_booking.worker_id THEN
    PERFORM _notify(
      v_booking.organizer_id,
      'Worker Cancelled Booking',
      'Worker has cancelled their confirmed booking for ' || v_job.title || '.',
      'booking_cancelled',
      '/shift/' || v_job.id,
      jsonb_build_object('job_id', v_job.id, 'booking_id', p_booking_id)
    );
  ELSE
    PERFORM _notify(
      v_booking.worker_id,
      'Booking Cancelled',
      'Your booking for ' || v_job.title || ' has been cancelled: ' || p_reason,
      'booking_cancelled',
      '/shift/' || v_job.id,
      jsonb_build_object('job_id', v_job.id, 'booking_id', p_booking_id)
    );
  END IF;

  INSERT INTO audit_logs (
    actor_id, action, entity_type, entity_id, new_state
  ) VALUES (
    v_user_id, 'CANCEL_BOOKING', 'booking', p_booking_id::TEXT,
    jsonb_build_object('reason', p_reason, 'cancelled_by', v_user_id)
  );

  RETURN jsonb_build_object('success', true, 'status', 'cancelled');
END;
$$;

CREATE OR REPLACE FUNCTION record_no_show_safe(
  p_booking_id UUID,
  p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_organizer_id UUID := auth.uid();
  v_booking RECORD;
  v_job RECORD;
BEGIN
  SELECT * INTO v_booking FROM bookings WHERE id = p_booking_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'BOOKING_NOT_FOUND');
  END IF;

  IF v_booking.organizer_id != v_organizer_id AND NOT is_current_admin() THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'UNAUTHORIZED');
  END IF;

  IF NOT validate_booking_transition(v_booking.status, 'no_show') THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'INVALID_TRANSITION', 'message', 'Cannot mark no-show from status ' || v_booking.status);
  END IF;

  SELECT * INTO v_job FROM jobs WHERE id = v_booking.job_id FOR UPDATE;

  UPDATE bookings
  SET status = 'no_show', no_show_reason = p_reason
  WHERE id = p_booking_id;

  -- Reopen slot only if active and future
  IF v_job.status IN ('filled', 'filling', 'open') AND v_job.date >= (now() AT TIME ZONE 'Asia/Kolkata')::date THEN
    UPDATE jobs
    SET
      slots_filled = GREATEST(0, slots_filled - 1),
      status = CASE WHEN slots_filled - 1 > 0 THEN 'filling'::shift_status ELSE 'open'::shift_status END,
      updated_at = now()
    WHERE id = v_booking.job_id;
  END IF;

  PERFORM _notify(
    v_booking.worker_id,
    'No-Show Recorded',
    'A no-show has been recorded for your shift: ' || v_job.title || '. Contact support if this is an error.',
    'booking_cancelled',
    '/shift/' || v_job.id,
    jsonb_build_object('job_id', v_job.id, 'booking_id', p_booking_id)
  );

  INSERT INTO audit_logs (
    actor_id, action, entity_type, entity_id, new_state
  ) VALUES (
    v_organizer_id, 'RECORD_NO_SHOW', 'booking', p_booking_id::TEXT,
    jsonb_build_object('reason', p_reason)
  );

  RETURN jsonb_build_object('success', true, 'status', 'no_show');
END;
$$;

-- Worker check-in with time-window validation & configurable geofence
CREATE OR REPLACE FUNCTION check_in_worker_safe(
  p_booking_id UUID,
  p_code TEXT,
  p_lat NUMERIC DEFAULT NULL,
  p_lng NUMERIC DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_booking RECORD;
  v_job RECORD;
  v_is_supervisor BOOLEAN := false;
  v_distance NUMERIC;
  v_radius_m NUMERIC := 300.0;
  v_shift_start TIMESTAMPTZ;
  v_shift_end TIMESTAMPTZ;
  v_now_ist TIMESTAMPTZ;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'UNAUTHENTICATED');
  END IF;

  SELECT * INTO v_booking FROM bookings WHERE id = p_booking_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'BOOKING_NOT_FOUND');
  END IF;

  SELECT * INTO v_job FROM jobs WHERE id = v_booking.job_id;

  v_is_supervisor := (v_user_id = v_booking.organizer_id OR is_current_admin());

  IF NOT v_is_supervisor AND v_user_id != v_booking.worker_id THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'UNAUTHORIZED');
  END IF;

  IF NOT validate_booking_transition(v_booking.status, 'checked_in') THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'INVALID_TRANSITION', 'message', 'Cannot check in from status ' || v_booking.status);
  END IF;

  -- Time window calculations in IST
  v_shift_start := (v_job.date + v_job.start_time) AT TIME ZONE 'Asia/Kolkata';
  v_shift_end := (v_job.date + v_job.end_time + CASE WHEN v_job.end_time <= v_job.start_time THEN interval '1 day' ELSE interval '0' END) AT TIME ZONE 'Asia/Kolkata';
  v_now_ist := now() AT TIME ZONE 'Asia/Kolkata';

  IF NOT v_is_supervisor THEN
    -- Worker self check-in window: [start - 60 min, start + 120 min]
    IF v_now_ist < (v_shift_start - interval '60 minutes') OR v_now_ist > (v_shift_start + interval '120 minutes') THEN
      RETURN jsonb_build_object(
        'success', false,
        'error_code', 'OUTSIDE_CHECKIN_WINDOW',
        'message', 'Self check-in is permitted between 60 minutes before and 120 minutes after shift call time.'
      );
    END IF;
  ELSE
    -- Supervisor check-in window: [start - 4 hours, end]
    IF v_now_ist < (v_shift_start - interval '4 hours') OR v_now_ist > v_shift_end THEN
      RETURN jsonb_build_object(
        'success', false,
        'error_code', 'OUTSIDE_CHECKIN_WINDOW',
        'message', 'Supervisor check-in permitted only on shift day within operational window.'
      );
    END IF;
  END IF;

  -- Verification credential check
  IF trim(COALESCE(p_code, '')) != trim(COALESCE(v_booking.check_in_code, '')) THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'INVALID_CHECK_IN_CODE', 'message', 'Verification code does not match shift booking.');
  END IF;

  -- GPS and Geofence enforcement
  IF NOT v_is_supervisor THEN
    IF p_lat IS NULL OR p_lng IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error_code', 'LOCATION_REQUIRED', 'message', 'GPS coordinates are required for worker self check-in.');
    END IF;

    IF v_job.latitude IS NULL OR v_job.longitude IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error_code', 'VENUE_COORDINATES_MISSING', 'message', 'Venue coordinates not configured. Supervisor check-in required.');
    END IF;

    -- Haversine calculation in km
    v_distance := round(
      (6371 * acos(
        least(1.0, greatest(-1.0,
          cos(radians(p_lat)) * cos(radians(v_job.latitude)) *
          cos(radians(v_job.longitude) - radians(p_lng)) +
          sin(radians(p_lat)) * sin(radians(v_job.latitude))
        ))
      ))::numeric, 3
    );

    SELECT COALESCE((value->>'checkin_radius_m')::numeric, 300.0) INTO v_radius_m
    FROM platform_settings WHERE key = 'checkin_radius_m';

    IF (v_distance * 1000.0) > v_radius_m THEN
      RETURN jsonb_build_object(
        'success', false,
        'error_code', 'OUT_OF_GEOFENCE_RANGE',
        'message', 'You are outside the venue check-in area (' || round(v_distance * 1000.0) || 'm away, max ' || v_radius_m || 'm allowed).'
      );
    END IF;
  ELSE
    IF p_lat IS NOT NULL AND p_lng IS NOT NULL AND v_job.latitude IS NOT NULL AND v_job.longitude IS NOT NULL THEN
      v_distance := round(
        (6371 * acos(
          least(1.0, greatest(-1.0,
            cos(radians(p_lat)) * cos(radians(v_job.latitude)) *
            cos(radians(v_job.longitude) - radians(p_lng)) +
            sin(radians(p_lat)) * sin(radians(v_job.latitude))
          ))
        ))::numeric, 3
      );
    END IF;
  END IF;

  UPDATE bookings
  SET status = 'checked_in', check_in_time = now()
  WHERE id = p_booking_id;

  INSERT INTO attendance_records (
    booking_id, job_id, worker_id, supervisor_id,
    check_in_time, check_in_code, verified_by_supervisor,
    latitude, longitude, distance_to_venue_km
  ) VALUES (
    p_booking_id, v_booking.job_id, v_booking.worker_id, v_booking.organizer_id,
    now(), p_code, v_is_supervisor,
    p_lat, p_lng, LEAST(v_distance, 999.99)
  );

  PERFORM _notify(
    v_booking.organizer_id,
    'Worker Checked In',
    'Worker has checked in on-site for ' || v_job.title,
    'check_in',
    '/shift/' || v_job.id,
    jsonb_build_object('booking_id', p_booking_id, 'job_id', v_job.id)
  );

  INSERT INTO audit_logs (
    actor_id, action, entity_type, entity_id, new_state
  ) VALUES (
    v_user_id, 'CHECK_IN_WORKER', 'booking', p_booking_id::TEXT,
    jsonb_build_object('distance_km', v_distance, 'supervisor_verified', v_is_supervisor)
  );

  RETURN jsonb_build_object(
    'success', true,
    'status', 'checked_in',
    'check_in_time', now(),
    'distance_km', v_distance
  );
END;
$$;

CREATE OR REPLACE FUNCTION check_out_worker_safe(
  p_booking_id UUID,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_booking RECORD;
  v_job RECORD;
  v_check_in_time TIMESTAMPTZ;
  v_effective_checkout TIMESTAMPTZ;
  v_shift_end TIMESTAMPTZ;
  v_hours NUMERIC;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'UNAUTHENTICATED');
  END IF;

  SELECT * INTO v_booking FROM bookings WHERE id = p_booking_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'BOOKING_NOT_FOUND');
  END IF;

  IF v_user_id != v_booking.worker_id AND v_user_id != v_booking.organizer_id AND NOT is_current_admin() THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'UNAUTHORIZED');
  END IF;

  IF NOT validate_booking_transition(v_booking.status, 'checked_out') THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'INVALID_TRANSITION', 'message', 'Cannot check out from status ' || v_booking.status);
  END IF;

  SELECT * INTO v_job FROM jobs WHERE id = v_booking.job_id;

  SELECT check_in_time INTO v_check_in_time
  FROM attendance_records
  WHERE booking_id = p_booking_id
  ORDER BY created_at DESC LIMIT 1;

  IF v_check_in_time IS NULL THEN
    v_check_in_time := v_booking.check_in_time;
  END IF;

  IF v_check_in_time IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'NO_CHECK_IN_RECORD', 'message', 'No valid check-in record found for this booking.');
  END IF;

  IF now() < (v_check_in_time + interval '15 minutes') THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'MINIMUM_SHIFT_DURATION', 'message', 'Minimum shift duration before check-out is 15 minutes.');
  END IF;

  -- Compute hours from LEAST(now(), job end + 3 hours)
  v_shift_end := (v_job.date + v_job.end_time + CASE WHEN v_job.end_time <= v_job.start_time THEN interval '1 day' ELSE interval '0' END) AT TIME ZONE 'Asia/Kolkata';
  v_effective_checkout := LEAST(now(), v_shift_end + interval '3 hours');
  v_hours := round((EXTRACT(EPOCH FROM (v_effective_checkout - v_check_in_time)) / 3600.0)::numeric, 2);

  UPDATE bookings
  SET status = 'checked_out', check_out_time = now()
  WHERE id = p_booking_id;

  UPDATE attendance_records
  SET check_out_time = now(), hours_worked = v_hours, notes = p_notes
  WHERE booking_id = p_booking_id;

  PERFORM _notify(
    v_booking.organizer_id,
    'Worker Checked Out',
    'Worker has checked out for ' || v_job.title || '. Please review attendance and approve hours.',
    'check_out',
    '/shift/' || v_job.id,
    jsonb_build_object('booking_id', p_booking_id, 'hours', v_hours)
  );

  INSERT INTO audit_logs (
    actor_id, action, entity_type, entity_id, new_state
  ) VALUES (
    v_user_id, 'CHECK_OUT_WORKER', 'booking', p_booking_id::TEXT,
    jsonb_build_object('hours_worked', v_hours, 'checkout_time', now())
  );

  RETURN jsonb_build_object('success', true, 'status', 'checked_out', 'hours_worked', v_hours);
END;
$$;

-- Supervisor attendance approval with server-side wage calculation
CREATE OR REPLACE FUNCTION complete_shift_and_approve_attendance(
  p_booking_id UUID,
  p_verified_hours NUMERIC,
  p_overtime_approved BOOLEAN DEFAULT false,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_organizer_id UUID := auth.uid();
  v_booking RECORD;
  v_job RECORD;
  v_final_pay NUMERIC(10, 2);
  v_base_pay NUMERIC(10, 2);
BEGIN
  IF v_organizer_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'UNAUTHENTICATED');
  END IF;

  SELECT * INTO v_booking FROM bookings WHERE id = p_booking_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'BOOKING_NOT_FOUND');
  END IF;

  IF v_booking.organizer_id != v_organizer_id AND NOT is_current_admin() THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'UNAUTHORIZED');
  END IF;

  IF NOT validate_booking_transition(v_booking.status, 'completed') THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'INVALID_TRANSITION', 'message', 'Cannot approve attendance from status ' || v_booking.status);
  END IF;

  SELECT * INTO v_job FROM jobs WHERE id = v_booking.job_id;

  -- Validate verified hours between 0 and 1.5x scheduled duration
  IF p_verified_hours < 0 OR p_verified_hours > (v_job.duration_hours * 1.5) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'INVALID_HOURS',
      'message', 'Verified hours must be between 0 and ' || (v_job.duration_hours * 1.5) || ' hours (max 1.5x scheduled).'
    );
  END IF;

  -- Calculate final pay strictly on server
  v_base_pay := round(p_verified_hours * v_job.hourly_rate, 2);

  IF p_verified_hours > v_job.duration_hours THEN
    IF p_overtime_approved AND v_job.overtime_policy IS NOT NULL THEN
      v_final_pay := v_base_pay;
    ELSE
      v_final_pay := v_booking.agreed_total_pay;
    END IF;
  ELSE
    v_final_pay := v_base_pay;
  END IF;

  -- Cap at agreed_total_pay unless overtime was explicitly approved
  IF NOT p_overtime_approved THEN
    v_final_pay := LEAST(v_final_pay, v_booking.agreed_total_pay);
  END IF;

  -- Update booking
  UPDATE bookings
  SET
    status = 'completed',
    completed_at = now(),
    approved_total_pay = v_final_pay
  WHERE id = p_booking_id;

  UPDATE attendance_records
  SET
    hours_worked = p_verified_hours,
    verified_by_supervisor = true,
    notes = COALESCE(p_notes, notes)
  WHERE booking_id = p_booking_id;

  -- Increment worker shifts completed using trusted bypass
  PERFORM set_config('opskl.trusted', '1', true);
  UPDATE worker_profiles
  SET shifts_completed = shifts_completed + 1, updated_at = now()
  WHERE id = v_booking.worker_id;

  PERFORM _notify(
    v_booking.worker_id,
    'Attendance Approved',
    'Your attendance for ' || v_job.title || ' has been approved. Earnings: ₹' || v_final_pay || '.',
    'attendance_approved',
    '/shift/' || v_job.id,
    jsonb_build_object('booking_id', p_booking_id, 'approved_total_pay', v_final_pay)
  );

  INSERT INTO audit_logs (
    actor_id, action, entity_type, entity_id, new_state
  ) VALUES (
    v_organizer_id, 'APPROVE_ATTENDANCE', 'booking', p_booking_id::TEXT,
    jsonb_build_object('verified_hours', p_verified_hours, 'approved_total_pay', v_final_pay, 'overtime_approved', p_overtime_approved)
  );

  RETURN jsonb_build_object(
    'success', true,
    'status', 'completed',
    'approved_total_pay', v_final_pay,
    'verified_hours', p_verified_hours
  );
END;
$$;

-- ------------------------------------------------------------------------------
-- 1.9 DISPUTES ARBITRATION, KYC VERIFICATION & DATA PURGE SAFETY
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION claim_dispute_safe(p_dispute_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id UUID := auth.uid();
BEGIN
  IF NOT is_current_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Administrative authorization required.');
  END IF;

  UPDATE disputes
  SET status = 'under_review', assigned_to = v_admin_id, updated_at = now()
  WHERE id = p_dispute_id AND status = 'open';

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Dispute not found or already claimed.');
  END IF;

  INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, new_state)
  VALUES (v_admin_id, 'CLAIM_DISPUTE', 'disputes', p_dispute_id::TEXT, jsonb_build_object('status', 'under_review'));

  RETURN jsonb_build_object('success', true, 'dispute_id', p_dispute_id, 'status', 'under_review');
END;
$$;

REVOKE EXECUTE ON FUNCTION claim_dispute_safe(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION claim_dispute_safe(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION admin_resolve_dispute_safe(
  p_dispute_id UUID,
  p_status TEXT,
  p_resolution_notes TEXT,
  p_booking_outcome TEXT DEFAULT NULL,
  p_adjusted_payout NUMERIC DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id UUID := auth.uid();
  v_dispute RECORD;
  v_booking RECORD;
  v_has_attendance BOOLEAN;
  v_target_booking_status TEXT;
BEGIN
  IF NOT is_current_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Administrative authorization required.');
  END IF;

  IF p_status NOT IN ('resolved', 'dismissed') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Resolution status must be resolved or dismissed.');
  END IF;

  SELECT * INTO v_dispute FROM disputes WHERE id = p_dispute_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Dispute record not found.');
  END IF;

  IF v_dispute.status NOT IN ('open', 'under_review') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Dispute has already been resolved or closed.');
  END IF;

  SELECT * INTO v_booking FROM bookings WHERE id = v_dispute.booking_id FOR UPDATE;

  IF p_status = 'dismissed' THEN
    -- Restore booking to pre-dispute status
    v_target_booking_status := COALESCE(v_booking.status_before_dispute, 'confirmed');
    UPDATE bookings
    SET status = v_target_booking_status, updated_at = now()
    WHERE id = v_booking.id;
  ELSIF p_status = 'resolved' THEN
    -- Determine booking outcome
    IF p_booking_outcome NOT IN ('completed', 'cancelled', 'no_show') THEN
      RETURN jsonb_build_object('success', false, 'error', 'Booking outcome must be completed, cancelled, or no_show.');
    END IF;

    -- Only allow completed if attendance record exists
    IF p_booking_outcome = 'completed' THEN
      SELECT EXISTS (SELECT 1 FROM attendance_records WHERE booking_id = v_booking.id AND check_in_time IS NOT NULL) INTO v_has_attendance;
      IF NOT v_has_attendance THEN
        RETURN jsonb_build_object('success', false, 'error', 'Cannot rule booking completed without on-site attendance record.');
      END IF;
    END IF;

    IF p_adjusted_payout IS NOT NULL THEN
      IF p_adjusted_payout < 0 OR p_adjusted_payout > (v_booking.agreed_total_pay * 1.5) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Adjusted payout must be between ₹0 and 1.5x agreed pay.');
      END IF;
    END IF;

    UPDATE bookings
    SET
      status = p_booking_outcome,
      approved_total_pay = COALESCE(p_adjusted_payout, approved_total_pay, agreed_total_pay),
      updated_at = now()
    WHERE id = v_booking.id;

    -- Update payment record if exists and not already settled
    IF p_adjusted_payout IS NOT NULL THEN
      UPDATE payment_records
      SET amount = p_adjusted_payout, net_payout = p_adjusted_payout, updated_at = now()
      WHERE booking_id = v_booking.id AND status != 'settled';
    END IF;
  END IF;

  UPDATE disputes
  SET
    status = p_status,
    resolution_notes = p_resolution_notes,
    assigned_to = v_admin_id,
    updated_at = now()
  WHERE id = p_dispute_id;

  -- Notify both parties
  PERFORM _notify(v_dispute.raised_by, 'Dispute ' || initcap(p_status), 'Dispute resolution: ' || p_resolution_notes, 'dispute_update', '/shift/' || v_booking.job_id);
  PERFORM _notify(v_dispute.respondent_id, 'Dispute ' || initcap(p_status), 'Dispute resolution: ' || p_resolution_notes, 'dispute_update', '/shift/' || v_booking.job_id);

  INSERT INTO audit_logs (
    actor_id, action, entity_type, entity_id, new_state
  ) VALUES (
    v_admin_id, 'ADMIN_RESOLVE_DISPUTE', 'disputes', p_dispute_id::TEXT,
    jsonb_build_object('status', p_status, 'resolution_notes', p_resolution_notes, 'booking_outcome', p_booking_outcome, 'adjusted_payout', p_adjusted_payout)
  );

  RETURN jsonb_build_object('success', true, 'dispute_id', p_dispute_id, 'status', p_status);
END;
$$;

-- Verification submission & review
CREATE OR REPLACE FUNCTION submit_verification_case_safe(
  p_document_type TEXT,
  p_masked_id TEXT,
  p_storage_path TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_case_id UUID;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Authentication required.');
  END IF;

  IF p_document_type NOT IN ('aadhaar', 'pan', 'gstin') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Document type must be aadhaar, pan, or gstin.');
  END IF;

  -- Storage path security: must belong to caller
  IF NOT (p_storage_path LIKE (v_user_id::TEXT || '/%') OR p_storage_path LIKE ('kyc/' || v_user_id::TEXT || '/%')) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Storage path must be scoped to your authenticated user directory.');
  END IF;

  -- Reject if pending case already exists for this document type
  IF EXISTS (
    SELECT 1 FROM verification_cases
    WHERE profile_id = v_user_id AND document_type = p_document_type AND status = 'pending'
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'A verification case is already pending review for this document type.');
  END IF;

  INSERT INTO verification_cases (
    profile_id, document_type, document_number_masked, document_storage_path, status
  ) VALUES (
    v_user_id, p_document_type, p_masked_id, p_storage_path, 'pending'
  ) RETURNING id INTO v_case_id;

  -- Update profile status to pending
  PERFORM set_config('opskl.trusted', '1', true);
  UPDATE worker_profiles SET verification_status = 'pending', updated_at = now() WHERE id = v_user_id;
  UPDATE organizer_profiles SET verification_status = 'pending', updated_at = now() WHERE id = v_user_id;

  RETURN jsonb_build_object('success', true, 'case_id', v_case_id, 'status', 'pending');
END;
$$;

REVOKE EXECUTE ON FUNCTION submit_verification_case_safe(TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION submit_verification_case_safe(TEXT, TEXT, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION admin_verify_case_safe(
  p_case_id UUID,
  p_status TEXT,
  p_rejection_reason TEXT DEFAULT NULL,
  p_admin_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_case RECORD;
  v_admin_id UUID := auth.uid();
  v_is_worker BOOLEAN;
  v_w_profile RECORD;
  v_o_profile RECORD;
  v_now_verified BOOLEAN := false;
BEGIN
  IF NOT is_current_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Administrative authorization required.');
  END IF;

  IF p_status NOT IN ('approved', 'rejected') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Status must be approved or rejected.');
  END IF;

  SELECT * INTO v_case FROM verification_cases WHERE id = p_case_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Verification case not found.');
  END IF;

  IF v_case.status != 'pending' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only pending verification cases can be acted upon.');
  END IF;

  UPDATE verification_cases
  SET
    status = p_status,
    rejection_reason = p_rejection_reason,
    reviewed_by = v_admin_id,
    reviewed_at = now()
  WHERE id = p_case_id;

  PERFORM set_config('opskl.trusted', '1', true);

  IF p_status = 'approved' THEN
    -- Check if worker
    SELECT * INTO v_w_profile FROM worker_profiles WHERE id = v_case.profile_id;
    IF FOUND THEN
      -- Set document flag
      UPDATE worker_profiles
      SET
        is_aadhaar_verified = CASE WHEN v_case.document_type = 'aadhaar' THEN true ELSE is_aadhaar_verified END,
        is_pan_verified = CASE WHEN v_case.document_type = 'pan' THEN true ELSE is_pan_verified END
      WHERE id = v_case.profile_id
      RETURNING * INTO v_w_profile;

      -- DECISION: Worker = Aadhaar OR PAN
      IF v_w_profile.is_aadhaar_verified = true OR v_w_profile.is_pan_verified = true THEN
        UPDATE worker_profiles SET verification_status = 'verified', updated_at = now() WHERE id = v_case.profile_id;
      END IF;
    END IF;

    -- Check if organizer
    SELECT * INTO v_o_profile FROM organizer_profiles WHERE id = v_case.profile_id;
    IF FOUND THEN
      UPDATE organizer_profiles
      SET
        is_gstin_verified = CASE WHEN v_case.document_type = 'gstin' THEN true ELSE is_gstin_verified END
      WHERE id = v_case.profile_id
      RETURNING * INTO v_o_profile;

      -- DECISION: Organizer = GSTIN OR PAN
      IF v_o_profile.is_gstin_verified = true OR v_case.document_type = 'pan' THEN
        UPDATE organizer_profiles SET verification_status = 'verified', updated_at = now() WHERE id = v_case.profile_id;
      END IF;
    END IF;

    PERFORM _notify(v_case.profile_id, 'Verification Approved', 'Your document verification has been successfully approved.', 'verification_update');
  ELSIF p_status = 'rejected' THEN
    UPDATE worker_profiles SET verification_status = 'rejected', updated_at = now() WHERE id = v_case.profile_id;
    UPDATE organizer_profiles SET verification_status = 'rejected', updated_at = now() WHERE id = v_case.profile_id;

    PERFORM _notify(v_case.profile_id, 'Verification Update', 'Document verification was rejected: ' || COALESCE(p_rejection_reason, 'Invalid document'), 'verification_update');
  END IF;

  INSERT INTO audit_logs (
    actor_id, action, entity_type, entity_id, new_state
  ) VALUES (
    v_admin_id, 'ADMIN_VERIFY_CASE', 'verification_cases', p_case_id::TEXT,
    jsonb_build_object('status', p_status, 'document_type', v_case.document_type, 'rejection_reason', p_rejection_reason)
  );

  RETURN jsonb_build_object('success', true, 'case_id', p_case_id, 'status', p_status);
END;
$$;

-- Account deletion request, cancellation & service-role purge
CREATE OR REPLACE FUNCTION request_account_deletion_safe(p_reason TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_now TIMESTAMPTZ := now();
  v_purge_at TIMESTAMPTZ := now() + interval '30 days';
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'UNAUTHENTICATED');
  END IF;

  -- Block deletion if user has pending or unresolved bookings
  IF EXISTS (
    SELECT 1 FROM bookings
    WHERE (worker_id = v_user_id OR organizer_id = v_user_id)
      AND status IN ('selected_awaiting_confirmation', 'confirmed', 'checked_in', 'checked_out', 'completed_awaiting_review', 'disputed')
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'ACTIVE_BOOKINGS_PENDING',
      'message', 'Cannot delete account with active, disputed, or pending shift bookings. Please resolve all shifts first.'
    );
  END IF;

  -- Block deletion if organizer has unpaid invoices
  IF EXISTS (
    SELECT 1 FROM organizer_invoices
    WHERE organizer_id = v_user_id AND status IN ('pending', 'overdue')
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'UNPAID_INVOICES',
      'message', 'Cannot delete account with outstanding unpaid invoices.'
    );
  END IF;

  -- Deactivate profile using trusted bypass
  PERFORM set_config('opskl.trusted', '1', true);
  UPDATE profiles SET is_active = false, updated_at = v_now WHERE id = v_user_id;

  INSERT INTO account_deletion_requests (
    user_id, status, reason, scheduled_purge_at, created_at, updated_at
  ) VALUES (
    v_user_id, 'queued', p_reason, v_purge_at, v_now, v_now
  )
  ON CONFLICT (user_id) DO UPDATE SET
    status = 'queued',
    reason = EXCLUDED.reason,
    scheduled_purge_at = EXCLUDED.scheduled_purge_at,
    updated_at = v_now;

  INSERT INTO audit_logs (
    actor_id, action, entity_type, entity_id, new_state
  ) VALUES (
    v_user_id, 'REQUEST_ACCOUNT_DELETION', 'profile', v_user_id::TEXT,
    jsonb_build_object('scheduled_purge_at', v_purge_at, 'reason', p_reason)
  );

  RETURN jsonb_build_object(
    'success', true,
    'status', 'queued',
    'scheduled_purge_at', v_purge_at,
    'message', 'Account has been deactivated. Permanent data purge is scheduled in 30 days.'
  );
END;
$$;

CREATE OR REPLACE FUNCTION cancel_account_deletion_safe()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'UNAUTHENTICATED');
  END IF;

  -- Reactivate profile using trusted bypass
  PERFORM set_config('opskl.trusted', '1', true);
  UPDATE profiles SET is_active = true, updated_at = now() WHERE id = v_user_id;

  UPDATE account_deletion_requests
  SET status = 'cancelled', updated_at = now()
  WHERE user_id = v_user_id AND status = 'queued';

  INSERT INTO audit_logs (
    actor_id, action, entity_type, entity_id, new_state
  ) VALUES (
    v_user_id, 'CANCEL_ACCOUNT_DELETION', 'profile', v_user_id::TEXT,
    jsonb_build_object('status', 'cancelled')
  );

  RETURN jsonb_build_object('success', true, 'status', 'active', 'message', 'Account deletion cancelled successfully.');
END;
$$;

REVOKE EXECUTE ON FUNCTION cancel_account_deletion_safe() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION cancel_account_deletion_safe() TO authenticated;

-- Purge processor (service-role or admin only)
CREATE OR REPLACE FUNCTION process_account_deletion_purge_safe(p_batch_size INT DEFAULT 50)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rec RECORD;
  v_purged_count INT := 0;
BEGIN
  IF NOT (is_current_admin() OR COALESCE(auth.role(), '') = 'service_role' OR current_user = 'postgres') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized. Requires service role or admin credentials.');
  END IF;

  PERFORM set_config('opskl.trusted', '1', true);

  FOR v_rec IN
    SELECT user_id FROM account_deletion_requests
    WHERE status = 'queued' AND scheduled_purge_at <= now()
    ORDER BY scheduled_purge_at ASC
    LIMIT p_batch_size
  LOOP
    -- Null GPS and location data in attendance records
    UPDATE attendance_records
    SET latitude = NULL, longitude = NULL, distance_to_venue_km = NULL
    WHERE worker_id = v_rec.user_id;

    -- Redact sensitive text in disputes, reviews, and safety reports
    UPDATE reviews SET comment = '[Redacted pursuant to user account deletion]' WHERE reviewer_id = v_rec.user_id;
    UPDATE disputes SET details = '[Redacted]' WHERE raised_by = v_rec.user_id;
    UPDATE safety_reports SET description = '[Redacted]' WHERE reporter_id = v_rec.user_id;

    -- Delete user push tokens
    DELETE FROM user_push_tokens WHERE user_id = v_rec.user_id;

    -- Anonymize core profile
    UPDATE profiles
    SET
      full_name = 'Deleted User ' || substr(v_rec.user_id::TEXT, 1, 6),
      phone = NULL,
      email = 'deleted_' || substr(v_rec.user_id::TEXT, 1, 8) || '@deleted.opskil.internal',
      avatar_url = NULL,
      is_active = false,
      updated_at = now()
    WHERE id = v_rec.user_id;

    -- Anonymize worker / organizer details
    UPDATE worker_profiles SET upi_id = NULL, bio = NULL WHERE id = v_rec.user_id;
    UPDATE organizer_profiles SET gstin = NULL, billing_address = NULL, business_contact_phone = NULL WHERE id = v_rec.user_id;

    UPDATE account_deletion_requests SET status = 'purged', updated_at = now() WHERE user_id = v_rec.user_id;
    v_purged_count := v_purged_count + 1;
  END LOOP;

  RETURN jsonb_build_object('success', true, 'purged_count', v_purged_count);
END;
$$;

-- Admin dashboard SQL aggregation views
CREATE OR REPLACE VIEW admin_overview_metrics AS
  SELECT
    (SELECT COALESCE(sum(total_payable), 0.00) FROM organizer_invoices WHERE status = 'escrow_funded') AS gmv_inr,
    (SELECT COALESCE(sum(platform_fee), 0.00) FROM organizer_invoices WHERE status = 'escrow_funded') AS platform_fees_inr,
    (
      (SELECT COALESCE(sum(wage_total), 0.00) FROM organizer_invoices WHERE status = 'escrow_funded') -
      (SELECT COALESCE(sum(net_payout), 0.00) FROM payment_records WHERE status = 'settled')
    ) AS escrow_held_inr,
    (SELECT count(*) FROM jobs WHERE status IN ('open', 'filling', 'filled')) AS active_shifts,
    (SELECT count(*) FROM worker_profiles) AS total_workers,
    (SELECT count(*) FROM verification_cases WHERE status = 'pending') AS pending_verifications,
    (SELECT count(*) FROM disputes WHERE status IN ('open', 'under_review')) AS open_disputes,
    (SELECT count(*) FROM safety_reports WHERE status = 'open') AS open_safety_reports;

GRANT SELECT ON admin_overview_metrics TO authenticated;

CREATE OR REPLACE VIEW admin_audit_logs_view AS
  SELECT
    al.id,
    al.actor_id,
    p.email AS actor_email,
    p.role AS actor_role,
    al.action,
    al.entity_type,
    al.entity_id,
    al.old_state,
    COALESCE(al.changes, al.new_state) AS payload,
    al.created_at
  FROM audit_logs al
  LEFT JOIN profiles p ON p.id = al.actor_id;

GRANT SELECT ON admin_audit_logs_view TO authenticated;

-- ------------------------------------------------------------------------------
-- 1.10 FY SEQUENTIAL INVOICES & MANUAL ESCROW SETTLEMENT (PILOT)
-- ------------------------------------------------------------------------------

CREATE SEQUENCE IF NOT EXISTS invoice_seq START 1;

CREATE OR REPLACE FUNCTION generate_invoice_number()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  v_now TIMESTAMPTZ := now() AT TIME ZONE 'Asia/Kolkata';
  v_month INT := EXTRACT(MONTH FROM v_now);
  v_year INT := EXTRACT(YEAR FROM v_now);
  v_fy_start INT;
  v_fy_end INT;
  v_seq INT;
BEGIN
  IF v_month >= 4 THEN
    v_fy_start := v_year % 100;
    v_fy_end := (v_year + 1) % 100;
  ELSE
    v_fy_start := (v_year - 1) % 100;
    v_fy_end := v_year % 100;
  END IF;

  v_seq := nextval('invoice_seq');
  RETURN 'OPS/' || LPAD(v_fy_start::TEXT, 2, '0') || '-' || LPAD(v_fy_end::TEXT, 2, '0') || '/' || LPAD(v_seq::TEXT, 5, '0');
END;
$$;

CREATE OR REPLACE FUNCTION generate_job_invoice_safe(
  p_job_id UUID,
  p_organizer_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job RECORD;
  v_existing RECORD;
  v_wage_total NUMERIC(10, 2);
  v_fee_pct NUMERIC(5, 2);
  v_gst_pct NUMERIC(5, 2);
  v_platform_fee NUMERIC(10, 2);
  v_gst_amount NUMERIC(10, 2);
  v_total_payable NUMERIC(10, 2);
  v_invoice_number TEXT;
  v_invoice_id UUID;
  v_due_date TIMESTAMPTZ;
BEGIN
  SELECT id, organizer_id, total_pay, slots_total, date INTO v_job FROM jobs WHERE id = p_job_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Job not found.');
  END IF;

  -- Idempotency check: refuse to alter totals if already funded or settled
  SELECT * INTO v_existing FROM organizer_invoices WHERE job_id = p_job_id;
  IF FOUND THEN
    IF v_existing.status IN ('escrow_funded', 'settled') THEN
      RETURN jsonb_build_object(
        'success', true,
        'invoice_id', v_existing.id,
        'invoice_number', v_existing.invoice_number,
        'status', v_existing.status,
        'total_payable', v_existing.total_payable,
        'immutable', true
      );
    END IF;
  END IF;

  -- Fetch dynamic fee and GST percentages from platform settings
  SELECT COALESCE((value->>'platform_fee_percent')::numeric, 10.00) INTO v_fee_pct
  FROM platform_settings WHERE key = 'platform_fee';

  SELECT COALESCE((value->>'gst_rate_percent')::numeric, 18.00) INTO v_gst_pct
  FROM platform_settings WHERE key = 'gst_rate';

  v_wage_total := round(v_job.total_pay * v_job.slots_total, 2);
  v_platform_fee := round(v_wage_total * (v_fee_pct / 100.0), 2);
  v_gst_amount := round(v_platform_fee * (v_gst_pct / 100.0), 2);
  v_total_payable := v_wage_total + v_platform_fee + v_gst_amount;

  -- Due date: least(now() + 3 days, job.date - 1 day)
  v_due_date := LEAST(
    now() + interval '3 days',
    (v_job.date - 1)::timestamp AT TIME ZONE 'Asia/Kolkata'
  );

  IF v_existing.id IS NOT NULL THEN
    UPDATE organizer_invoices
    SET
      wage_total = v_wage_total,
      platform_fee = v_platform_fee,
      gst_rate = v_gst_pct,
      gst_amount = v_gst_amount,
      total_payable = v_total_payable,
      due_date = v_due_date,
      updated_at = now()
    WHERE id = v_existing.id
    RETURNING id INTO v_invoice_id;

    RETURN jsonb_build_object('success', true, 'invoice_id', v_invoice_id, 'status', 'updated', 'total_payable', v_total_payable);
  END IF;

  v_invoice_number := generate_invoice_number();

  INSERT INTO organizer_invoices (
    invoice_number, job_id, organizer_id,
    wage_total, platform_fee, gst_rate, gst_amount, total_payable,
    status, payment_method, payment_provider, due_date, is_sandbox
  ) VALUES (
    v_invoice_number, p_job_id, v_job.organizer_id,
    v_wage_total, v_platform_fee, v_gst_pct, v_gst_amount, v_total_payable,
    'pending', 'neft_rtgs', 'manual_reconciliation', v_due_date, false
  ) RETURNING id INTO v_invoice_id;

  INSERT INTO audit_logs (
    actor_id, action, entity_type, entity_id, new_state
  ) VALUES (
    auth.uid(), 'GENERATE_JOB_INVOICE', 'organizer_invoices', v_invoice_id::TEXT,
    jsonb_build_object('invoice_number', v_invoice_number, 'total_payable', v_total_payable)
  );

  RETURN jsonb_build_object(
    'success', true,
    'invoice_id', v_invoice_id,
    'invoice_number', v_invoice_number,
    'status', 'created',
    'total_payable', v_total_payable
  );
END;
$$;

-- Admin manual receipt of escrow funds (NEFT/RTGS/UPI)
CREATE OR REPLACE FUNCTION admin_mark_invoice_funded(
  p_invoice_id UUID,
  p_reference TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id UUID := auth.uid();
  v_invoice RECORD;
BEGIN
  IF NOT is_current_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Administrative authorization required.');
  END IF;

  SELECT * INTO v_invoice FROM organizer_invoices WHERE id = p_invoice_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invoice record not found.');
  END IF;

  IF v_invoice.status = 'escrow_funded' THEN
    RETURN jsonb_build_object('success', true, 'status', 'escrow_funded', 'message', 'Invoice already marked as escrow funded.');
  END IF;

  UPDATE organizer_invoices
  SET
    status = 'escrow_funded',
    paid_at = now(),
    payment_method = 'neft_rtgs',
    provider_payment_id = p_reference,
    updated_at = now()
  WHERE id = p_invoice_id;

  INSERT INTO payment_reconciliation_logs (
    reconciliation_type, reference_id, status, expected_amount, recorded_amount, notes, actor_id
  ) VALUES (
    'invoice_collection', v_invoice.invoice_number, 'matched', v_invoice.total_payable, v_invoice.total_payable,
    'Manual receipt confirmed by admin. Ref: ' || p_reference, v_admin_id
  );

  INSERT INTO audit_logs (
    actor_id, action, entity_type, entity_id, new_state
  ) VALUES (
    v_admin_id, 'ADMIN_MARK_INVOICE_FUNDED', 'organizer_invoices', p_invoice_id::TEXT,
    jsonb_build_object('reference', p_reference, 'total_payable', v_invoice.total_payable)
  );

  RETURN jsonb_build_object('success', true, 'invoice_id', p_invoice_id, 'status', 'escrow_funded');
END;
$$;

REVOKE EXECUTE ON FUNCTION admin_mark_invoice_funded(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION admin_mark_invoice_funded(UUID, TEXT) TO authenticated;

-- Payout initiation requires completed booking and funded invoice
CREATE OR REPLACE FUNCTION initiate_worker_payout_safe(
  p_booking_id UUID,
  p_upi_id TEXT,
  p_idempotency_key TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_booking RECORD;
  v_job RECORD;
  v_invoice RECORD;
  v_existing RECORD;
  v_worker_upi TEXT;
  v_payout_amount NUMERIC(10, 2);
  v_payment_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Authentication required.');
  END IF;

  SELECT * INTO v_booking FROM bookings WHERE id = p_booking_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Booking not found.');
  END IF;

  IF v_booking.status != 'completed' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Attendance must be completed before payout initiation.');
  END IF;

  -- Require invoice escrow funded
  SELECT * INTO v_invoice FROM organizer_invoices WHERE job_id = v_booking.job_id;
  IF NOT FOUND OR v_invoice.status != 'escrow_funded' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Job escrow invoice must be funded prior to initiating payouts.');
  END IF;

  SELECT upi_id INTO v_worker_upi FROM worker_profiles WHERE id = v_booking.worker_id;
  IF v_worker_upi IS NULL OR trim(v_worker_upi) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Worker has no verified UPI payout destination.');
  END IF;

  v_payout_amount := COALESCE(v_booking.approved_total_pay, v_booking.agreed_total_pay);

  SELECT * INTO v_existing FROM payment_records WHERE booking_id = p_booking_id;
  IF FOUND THEN
    IF v_existing.status NOT IN ('pending', 'failed') THEN
      RETURN jsonb_build_object('success', true, 'payment_id', v_existing.id, 'status', v_existing.status);
    END IF;

    UPDATE payment_records
    SET status = 'escrow_locked', amount = v_payout_amount, net_payout = v_payout_amount, updated_at = now()
    WHERE id = v_existing.id
    RETURNING id INTO v_payment_id;
  ELSE
    INSERT INTO payment_records (
      booking_id, job_id, worker_id, organizer_id,
      amount, platform_fee, net_payout, status, upi_id
    ) VALUES (
      p_booking_id, v_booking.job_id, v_booking.worker_id, v_booking.organizer_id,
      v_payout_amount, 0.00, v_payout_amount, 'escrow_locked', v_worker_upi
    ) RETURNING id INTO v_payment_id;
  END IF;

  INSERT INTO audit_logs (
    actor_id, action, entity_type, entity_id, new_state
  ) VALUES (
    auth.uid(), 'INITIATE_WORKER_PAYOUT', 'payment_records', v_payment_id::TEXT,
    jsonb_build_object('amount', v_payout_amount, 'status', 'escrow_locked')
  );

  RETURN jsonb_build_object('success', true, 'payment_id', v_payment_id, 'status', 'escrow_locked', 'amount', v_payout_amount);
END;
$$;

-- Admin settle / fail payout
CREATE OR REPLACE FUNCTION admin_mark_payout_settled(
  p_payment_id UUID,
  p_utr TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id UUID := auth.uid();
  v_payment RECORD;
BEGIN
  IF NOT is_current_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Administrative authorization required.');
  END IF;

  SELECT * INTO v_payment FROM payment_records WHERE id = p_payment_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Payment record not found.');
  END IF;

  UPDATE payment_records
  SET
    status = 'settled',
    utr_reference = p_utr,
    settled_at = now(),
    updated_at = now()
  WHERE id = p_payment_id;

  INSERT INTO payment_reconciliation_logs (
    reconciliation_type, reference_id, status, expected_amount, recorded_amount, notes, actor_id
  ) VALUES (
    'payout', p_payment_id::TEXT, 'matched', v_payment.net_payout, v_payment.net_payout,
    'Settled via UTR: ' || p_utr, v_admin_id
  );

  PERFORM _notify(
    v_payment.worker_id,
    'Payout Settled',
    'Your payout of ₹' || v_payment.net_payout || ' has been transferred to ' || v_payment.upi_id || '. UTR: ' || p_utr,
    'payout_settled',
    '/shift/' || v_payment.job_id
  );

  INSERT INTO audit_logs (
    actor_id, action, entity_type, entity_id, new_state
  ) VALUES (
    v_admin_id, 'ADMIN_SETTLE_PAYOUT', 'payment_records', p_payment_id::TEXT,
    jsonb_build_object('utr', p_utr, 'amount', v_payment.net_payout)
  );

  RETURN jsonb_build_object('success', true, 'payment_id', p_payment_id, 'status', 'settled');
END;
$$;

REVOKE EXECUTE ON FUNCTION admin_mark_payout_settled(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION admin_mark_payout_settled(UUID, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION admin_mark_payout_failed(
  p_payment_id UUID,
  p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id UUID := auth.uid();
  v_payment RECORD;
BEGIN
  IF NOT is_current_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Administrative authorization required.');
  END IF;

  SELECT * INTO v_payment FROM payment_records WHERE id = p_payment_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Payment record not found.');
  END IF;

  UPDATE payment_records
  SET status = 'failed', failure_reason = p_reason, updated_at = now()
  WHERE id = p_payment_id;

  PERFORM _notify(
    v_payment.worker_id,
    'Payout Failed',
    'Payout transfer failed: ' || p_reason || '. Please verify your UPI ID in settings.',
    'payout_failed',
    '/shift/' || v_payment.job_id
  );

  INSERT INTO audit_logs (
    actor_id, action, entity_type, entity_id, new_state
  ) VALUES (
    v_admin_id, 'ADMIN_FAIL_PAYOUT', 'payment_records', p_payment_id::TEXT,
    jsonb_build_object('failure_reason', p_reason)
  );

  RETURN jsonb_build_object('success', true, 'payment_id', p_payment_id, 'status', 'failed');
END;
$$;

REVOKE EXECUTE ON FUNCTION admin_mark_payout_failed(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION admin_mark_payout_failed(UUID, TEXT) TO authenticated;

-- Webhook processor fix: paise to rupees, discrepancy status, retryable failures
ALTER TABLE payment_webhook_events DROP CONSTRAINT IF EXISTS payment_webhook_events_status_check;
ALTER TABLE payment_webhook_events ADD CONSTRAINT payment_webhook_events_status_check CHECK (
  status IN ('pending', 'processed', 'failed', 'duplicate', 'discrepancy')
);

CREATE OR REPLACE FUNCTION process_payment_webhook_safe(
  p_provider TEXT,
  p_event_id TEXT,
  p_event_type TEXT,
  p_payload JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing_event RECORD;
  v_order_id TEXT;
  v_payment_id TEXT;
  v_amount NUMERIC(10, 2);
  v_invoice RECORD;
  v_gateway_mode TEXT := 'sandbox';
BEGIN
  -- Idempotency check
  SELECT id, status INTO v_existing_event
  FROM payment_webhook_events
  WHERE event_id = p_event_id;

  IF FOUND THEN
    IF v_existing_event.status = 'processed' THEN
      RETURN jsonb_build_object('success', true, 'duplicate', true, 'event_id', p_event_id);
    END IF;
  ELSE
    INSERT INTO payment_webhook_events (
      provider, event_id, event_type, payload, status
    ) VALUES (
      p_provider, p_event_id, p_event_type, p_payload, 'pending'
    );
  END IF;

  SELECT COALESCE((value->>'payment_gateway_mode')::text, 'sandbox') INTO v_gateway_mode
  FROM platform_settings WHERE key = 'payment_gateway_mode';

  IF p_event_type IN ('order.paid', 'payment.captured', 'invoice.paid') THEN
    v_order_id := p_payload->>'order_id';
    v_payment_id := p_payload->>'payment_id';

    -- Convert paise to rupees (/ 100.0)
    v_amount := round(COALESCE((p_payload->>'amount')::NUMERIC, 0.00) / 100.0, 2);

    SELECT * INTO v_invoice
    FROM organizer_invoices
    WHERE provider_order_id = v_order_id OR id::TEXT = (p_payload->>'invoice_id');

    IF NOT FOUND THEN
      UPDATE payment_webhook_events
      SET status = 'failed', error_message = 'No matching invoice found for provider order ' || COALESCE(v_order_id, 'NULL')
      WHERE event_id = p_event_id;

      RETURN jsonb_build_object('success', false, 'error', 'Invoice not found');
    END IF;

    IF v_amount = v_invoice.total_payable THEN
      UPDATE organizer_invoices
      SET
        status = 'escrow_funded',
        provider_payment_id = v_payment_id,
        paid_at = now(),
        updated_at = now()
      WHERE id = v_invoice.id;

      INSERT INTO payment_reconciliation_logs (
        reconciliation_type, reference_id, status, expected_amount, recorded_amount, notes
      ) VALUES (
        'invoice_collection', v_invoice.invoice_number, 'matched', v_invoice.total_payable, v_amount,
        'Webhook capture: ' || p_event_id
      );

      UPDATE payment_webhook_events SET status = 'processed', processed_at = now() WHERE event_id = p_event_id;
    ELSE
      -- Discrepancy logged
      INSERT INTO payment_reconciliation_logs (
        reconciliation_type, reference_id, status, expected_amount, recorded_amount, discrepancy_amount, notes
      ) VALUES (
        'invoice_collection', v_invoice.invoice_number, 'discrepancy', v_invoice.total_payable, v_amount,
        abs(v_invoice.total_payable - v_amount), 'Amount mismatch in webhook payload'
      );

      UPDATE payment_webhook_events SET status = 'discrepancy', error_message = 'Amount mismatch' WHERE event_id = p_event_id;
    END IF;

    RETURN jsonb_build_object('success', true, 'invoice_id', v_invoice.id, 'status', 'processed');
  END IF;

  UPDATE payment_webhook_events SET status = 'processed', processed_at = now() WHERE event_id = p_event_id;
  RETURN jsonb_build_object('success', true, 'status', 'ignored');
END;
$$;

-- ------------------------------------------------------------------------------
-- 1.11 OVERNIGHT SHIFTS, COORDINATE BOUNDS & REALTIME PUBLICATION
-- ------------------------------------------------------------------------------

ALTER TABLE jobs ADD COLUMN IF NOT EXISTS crosses_midnight BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS end_date DATE;

-- Update create_job_safe to support overnight shifts, coordinates, and pilot limits
CREATE OR REPLACE FUNCTION create_job_safe(p_job JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_organizer_id UUID := auth.uid();
  v_title TEXT := trim(p_job->>'title');
  v_category shift_category := (p_job->>'category')::shift_category;
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
    RETURN jsonb_build_object('success', false, 'error_code', 'FORBIDDEN_ROLE', 'message', 'Organizer identity verification required to post shifts.');
  END IF;

  -- Title length aligned with client bounds: 5 to 80 chars
  IF length(v_title) < 5 OR length(v_title) > 80 THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'INVALID_TITLE', 'message', 'Shift title must be between 5 and 80 characters.');
  END IF;

  -- Read min wage from settings
  SELECT COALESCE((value->>'min_hourly_wage_inr')::numeric, 100.0) INTO v_min_wage
  FROM platform_settings WHERE key = 'min_wage';

  -- Pilot rate limits: ₹100 to ₹2000/hr
  IF v_hourly_rate < v_min_wage OR v_hourly_rate > 2000 THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'INVALID_WAGE', 'message', 'Hourly rate must be between ₹' || v_min_wage || ' and ₹2,000/hr.');
  END IF;

  -- Pilot slots limit: 1 to 100 workers
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

-- Ensure supabase_realtime publication includes bookings
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE bookings;
    EXCEPTION
      WHEN duplicate_object THEN null;
    END;
  END IF;
END $$;
