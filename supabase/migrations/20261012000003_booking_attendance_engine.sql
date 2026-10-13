-- ============================================================================
-- OPSKL BOOKING & ATTENDANCE ENGINE (PHASE 5)
-- Complete lifecycle state machine, auditable check-in/out, no-show & disputes
-- ============================================================================

-- 1. Update bookings table constraint to support full state machine
ALTER TABLE bookings
  DROP CONSTRAINT IF EXISTS bookings_status_check;

ALTER TABLE bookings
  ADD CONSTRAINT bookings_status_check CHECK (
    status IN (
      'selected_awaiting_confirmation',
      'confirmed',
      'checked_in',
      'checked_out',
      'completed_awaiting_review',
      'completed',
      'cancelled',
      'no_show',
      'disputed'
    )
  );

-- 2. Add verification token, timestamps, and audit columns to bookings
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS check_in_code TEXT,
  ADD COLUMN IF NOT EXISTS check_in_time TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS check_out_time TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancellation_reason TEXT,
  ADD COLUMN IF NOT EXISTS cancelled_by UUID REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS no_show_reason TEXT,
  ADD COLUMN IF NOT EXISTS dispute_reason TEXT;

-- 3. Extend attendance_records with location context and verification code
ALTER TABLE attendance_records
  ADD COLUMN IF NOT EXISTS check_in_code TEXT,
  ADD COLUMN IF NOT EXISTS latitude NUMERIC(9, 6),
  ADD COLUMN IF NOT EXISTS longitude NUMERIC(9, 6),
  ADD COLUMN IF NOT EXISTS distance_to_venue_km NUMERIC(5, 2);

-- 4. State Machine Transition Validator Helper
CREATE OR REPLACE FUNCTION validate_booking_transition(
  p_current_status TEXT,
  p_new_status TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  -- Matrix of valid state transitions:
  -- selected_awaiting_confirmation -> confirmed, cancelled
  -- confirmed -> checked_in, cancelled, no_show
  -- checked_in -> checked_out, disputed
  -- checked_out -> completed_awaiting_review, completed, disputed
  -- completed_awaiting_review -> completed, disputed
  -- completed -> disputed
  -- no_show -> disputed
  IF p_current_status = 'selected_awaiting_confirmation' AND p_new_status IN ('confirmed', 'cancelled') THEN
    RETURN true;
  ELSIF p_current_status = 'confirmed' AND p_new_status IN ('checked_in', 'cancelled', 'no_show') THEN
    RETURN true;
  ELSIF p_current_status = 'checked_in' AND p_new_status IN ('checked_out', 'disputed') THEN
    RETURN true;
  ELSIF p_current_status = 'checked_out' AND p_new_status IN ('completed_awaiting_review', 'completed', 'disputed') THEN
    RETURN true;
  ELSIF p_current_status = 'completed_awaiting_review' AND p_new_status IN ('completed', 'disputed') THEN
    RETURN true;
  ELSIF p_current_status = 'completed' AND p_new_status = 'disputed' THEN
    RETURN true;
  ELSIF p_current_status = 'no_show' AND p_new_status = 'disputed' THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

-- 5. Atomic RPC: Check-in Worker (Auditable Venue Code or Supervisor Verification)
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
  v_distance NUMERIC := NULL;
  v_is_supervisor BOOLEAN := false;
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

  -- 4. Authorization & code verification:
  IF v_user_id != v_booking.worker_id AND v_user_id != v_booking.organizer_id AND NOT is_current_admin() THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'UNAUTHORIZED', 'message', 'Not authorized for this booking');
  END IF;

  v_is_supervisor := (v_user_id = v_booking.organizer_id OR is_current_admin());

  -- Require a valid check-in code
  IF p_code IS NULL OR length(trim(p_code)) < 4 OR length(trim(p_code)) > 32 THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'INVALID_CODE', 'message', 'A valid shift check-in code or pass credential is required.');
  END IF;

  -- For worker self-check-in, require provisioned credential and exact match
  IF NOT v_is_supervisor THEN
    IF v_booking.check_in_code IS NULL THEN
      RETURN jsonb_build_object(
        'success', false,
        'error_code', 'CHECK_IN_CREDENTIAL_NOT_PROVISIONED',
        'message', 'Check-in credential has not been provisioned for this booking.'
      );
    END IF;

    IF upper(trim(p_code)) != upper(trim(v_booking.check_in_code)) THEN
      RETURN jsonb_build_object(
        'success', false,
        'error_code', 'INVALID_CHECK_IN_CODE',
        'message', 'Check-in code does not match the shift ticket credential.'
      );
    END IF;
  END IF;

  -- 5. Calculate GPS distance and enforce geofence boundary
  IF NOT v_is_supervisor THEN
    -- For worker self-check-in, GPS coordinates are mandatory to enforce the venue geofence
    IF p_lat IS NULL OR p_lng IS NULL THEN
      RETURN jsonb_build_object(
        'success', false,
        'error_code', 'LOCATION_REQUIRED',
        'message', 'Device GPS coordinates are required for worker self-check-in to verify venue presence.'
      );
    END IF;

    IF v_job.latitude IS NOT NULL AND v_job.longitude IS NOT NULL THEN
      v_distance := round(
        (6371 * acos(
          least(1.0, greatest(-1.0,
            cos(radians(p_lat)) * cos(radians(v_job.latitude)) *
            cos(radians(v_job.longitude) - radians(p_lng)) +
            sin(radians(p_lat)) * sin(radians(v_job.latitude))
          ))
        ))::numeric, 2
      );

      -- Enforce geofence boundary for worker self check-in (maximum 5.0 km radius)
      IF v_distance > 5.0 THEN
        RETURN jsonb_build_object(
          'success', false,
          'error_code', 'OUT_OF_GEOFENCE_RANGE',
          'message', 'Check-in location is outside the venue geofence boundary (' || v_distance || ' km away, max 5.0 km allowed).'
        );
      END IF;
    END IF;
  ELSE
    -- For supervisor check-in, compute distance optionally if coordinates provided
    IF p_lat IS NOT NULL AND p_lng IS NOT NULL AND v_job.latitude IS NOT NULL AND v_job.longitude IS NOT NULL THEN
      v_distance := round(
        (6371 * acos(
          least(1.0, greatest(-1.0,
            cos(radians(p_lat)) * cos(radians(v_job.latitude)) *
            cos(radians(v_job.longitude) - radians(p_lng)) +
            sin(radians(p_lat)) * sin(radians(v_job.latitude))
          ))
        ))::numeric, 2
      );
    END IF;
  END IF;

  -- 6. Transition status
  UPDATE bookings
  SET
    status = 'checked_in',
    check_in_time = now()
  WHERE id = p_booking_id;

  -- 7. Insert or update attendance record (verified_by_supervisor only true if supervisor checked in or verified)
  INSERT INTO attendance_records (
    booking_id, job_id, worker_id, supervisor_id,
    check_in_time, check_in_code, verified_by_supervisor,
    latitude, longitude, distance_to_venue_km
  ) VALUES (
    p_booking_id, v_booking.job_id, v_booking.worker_id, v_booking.organizer_id,
    now(), p_code, v_is_supervisor,
    p_lat, p_lng, v_distance
  );

  -- 8. Notify organizer
  INSERT INTO notifications (
    user_id, title, body, type, data
  ) VALUES (
    v_booking.organizer_id,
    '📍 Worker Checked In',
    'Worker has checked in on-site for ' || v_job.title,
    'worker_checked_in',
    jsonb_build_object('booking_id', p_booking_id, 'job_id', v_job.id)
  );

  -- 9. Audit log
  INSERT INTO audit_logs (
    actor_id, action, entity_type, entity_id, old_state, new_state
  ) VALUES (
    v_user_id, 'CHECK_IN_WORKER', 'booking', p_booking_id::TEXT,
    jsonb_build_object('status', v_booking.status),
    jsonb_build_object('status', 'checked_in', 'distance_km', v_distance, 'supervisor_verified', v_is_supervisor)
  );

  RETURN jsonb_build_object(
    'success', true,
    'status', 'checked_in',
    'check_in_time', now(),
    'distance_km', v_distance,
    'verified_by_supervisor', v_is_supervisor
  );
END;
$$;

-- 6. Atomic RPC: Check-out Worker
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
  v_hours NUMERIC;
BEGIN
  -- 0. Authentication requirement
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'UNAUTHENTICATED', 'message', 'Authentication required.');
  END IF;

  SELECT * INTO v_booking FROM bookings WHERE id = p_booking_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'BOOKING_NOT_FOUND', 'message', 'Booking record not found');
  END IF;

  -- Caller must be worker, organizer, or admin
  IF v_user_id != v_booking.worker_id AND v_user_id != v_booking.organizer_id AND NOT is_current_admin() THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'UNAUTHORIZED', 'message', 'Not authorized for this booking.');
  END IF;

  IF NOT validate_booking_transition(v_booking.status, 'checked_out') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'INVALID_TRANSITION',
      'message', 'Cannot check out. Current status is ' || v_booking.status
    );
  END IF;

  SELECT * INTO v_job FROM jobs WHERE id = v_booking.job_id;

  -- Calculate hours worked
  v_hours := round(extract(epoch FROM (now() - COALESCE(v_booking.check_in_time, now()))) / 3600.0, 2);

  UPDATE bookings
  SET
    status = 'completed_awaiting_review',
    check_out_time = now()
  WHERE id = p_booking_id;

  UPDATE attendance_records
  SET
    check_out_time = now(),
    hours_worked = v_hours,
    notes = p_notes
  WHERE booking_id = p_booking_id;

  -- Audit log
  INSERT INTO audit_logs (
    actor_id, action, entity_type, entity_id, old_state, new_state
  ) VALUES (
    v_user_id, 'CHECK_OUT_WORKER', 'booking', p_booking_id::TEXT,
    jsonb_build_object('status', v_booking.status),
    jsonb_build_object('status', 'completed_awaiting_review', 'hours_worked', v_hours)
  );

  RETURN jsonb_build_object(
    'success', true,
    'status', 'completed_awaiting_review',
    'check_out_time', now(),
    'hours_worked', v_hours
  );
END;
$$;

-- 7. Atomic RPC: Approve Attendance & Complete Shift
CREATE OR REPLACE FUNCTION complete_shift_and_approve_attendance(
  p_booking_id UUID,
  p_verified_hours NUMERIC DEFAULT NULL
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
  IF v_organizer_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'UNAUTHENTICATED', 'message', 'Authentication required.');
  END IF;

  SELECT * INTO v_booking FROM bookings WHERE id = p_booking_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'BOOKING_NOT_FOUND', 'message', 'Booking not found');
  END IF;

  IF v_booking.organizer_id != v_organizer_id AND NOT is_current_admin() THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'UNAUTHORIZED', 'message', 'Only the shift organizer or administrator can approve attendance.');
  END IF;

  IF NOT validate_booking_transition(v_booking.status, 'completed') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'INVALID_TRANSITION',
      'message', 'Cannot approve completion from status ' || v_booking.status
    );
  END IF;

  SELECT * INTO v_job FROM jobs WHERE id = v_booking.job_id;

  UPDATE bookings
  SET
    status = 'completed',
    completed_at = now()
  WHERE id = p_booking_id;

  UPDATE attendance_records
  SET
    verified_by_supervisor = true,
    hours_worked = COALESCE(p_verified_hours, hours_worked, v_job.duration_hours)
  WHERE booking_id = p_booking_id;

  -- Increment worker's completed shifts count
  UPDATE worker_profiles
  SET
    shifts_completed = shifts_completed + 1,
    updated_at = now()
  WHERE id = v_booking.worker_id;

  -- Notify worker of payment initiation
  INSERT INTO notifications (
    user_id, title, body, type, data
  ) VALUES (
    v_booking.worker_id,
    '💰 Attendance Approved & Payment Initiated!',
    'Your attendance for ' || v_job.title || ' has been approved. Payout of ₹' || v_booking.agreed_total_pay || ' initiated via direct UPI.',
    'payment_initiated',
    jsonb_build_object('booking_id', p_booking_id, 'amount', v_booking.agreed_total_pay)
  );

  -- Audit log
  INSERT INTO audit_logs (
    actor_id, action, entity_type, entity_id, new_state
  ) VALUES (
    v_organizer_id, 'APPROVE_ATTENDANCE', 'booking', p_booking_id::TEXT,
    jsonb_build_object('status', 'completed', 'total_pay', v_booking.agreed_total_pay)
  );

  RETURN jsonb_build_object(
    'success', true,
    'status', 'completed',
    'completed_at', now()
  );
END;
$$;

-- 8. Atomic RPC: Cancel Booking with Standby Candidate Notification
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
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'UNAUTHENTICATED', 'message', 'Authentication required.');
  END IF;

  SELECT * INTO v_booking FROM bookings WHERE id = p_booking_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'BOOKING_NOT_FOUND', 'message', 'Booking not found');
  END IF;

  IF v_user_id != v_booking.worker_id AND v_user_id != v_booking.organizer_id AND NOT is_current_admin() THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'UNAUTHORIZED', 'message', 'Not authorized to cancel this booking.');
  END IF;

  IF NOT validate_booking_transition(v_booking.status, 'cancelled') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'INVALID_TRANSITION',
      'message', 'Cannot cancel shift once in status ' || v_booking.status
    );
  END IF;

  SELECT * INTO v_job FROM jobs WHERE id = v_booking.job_id FOR UPDATE;

  -- Update booking
  UPDATE bookings
  SET
    status = 'cancelled',
    cancellation_reason = p_reason,
    cancelled_by = v_user_id
  WHERE id = p_booking_id;

  -- Update application
  UPDATE job_applications
  SET status = 'withdrawn'
  WHERE job_id = v_booking.job_id AND worker_id = v_booking.worker_id;

  -- Decrement headcount & reopen slot
  UPDATE jobs
  SET
    slots_filled = GREATEST(0, slots_filled - 1),
    status = 'open',
    updated_at = now()
  WHERE id = v_booking.job_id;

  -- Replacement workflow: notify shortlisted workers that a spot is now available
  FOR v_standby IN
    SELECT worker_id FROM job_applications
    WHERE job_id = v_booking.job_id AND status = 'shortlisted'
  LOOP
    INSERT INTO notifications (
      user_id, title, body, type, data
    ) VALUES (
      v_standby.worker_id,
      '⚡ Immediate Opening Available!',
      'A confirmed spot just opened up for ' || v_job.title || '. Check your schedule.',
      'standby_opening',
      jsonb_build_object('job_id', v_job.id)
    );
  END LOOP;

  -- Notify the other party
  IF v_user_id = v_booking.worker_id THEN
    INSERT INTO notifications (
      user_id, title, body, type, data
    ) VALUES (
      v_booking.organizer_id,
      '⚠️ Worker Cancelled Shift Booking',
      'Worker has cancelled their confirmed booking for ' || v_job.title || '. Slot reopened.',
      'booking_cancelled',
      jsonb_build_object('job_id', v_job.id, 'booking_id', p_booking_id)
    );
  ELSE
    INSERT INTO notifications (
      user_id, title, body, type, data
    ) VALUES (
      v_booking.worker_id,
      'Shift Booking Cancelled by Organizer',
      'Your booking for ' || v_job.title || ' has been cancelled: ' || p_reason,
      'booking_cancelled',
      jsonb_build_object('job_id', v_job.id, 'booking_id', p_booking_id)
    );
  END IF;

  -- Audit log
  INSERT INTO audit_logs (
    actor_id, action, entity_type, entity_id, new_state
  ) VALUES (
    v_user_id, 'CANCEL_BOOKING', 'booking', p_booking_id::TEXT,
    jsonb_build_object('reason', p_reason, 'cancelled_by', v_user_id)
  );

  RETURN jsonb_build_object('success', true, 'status', 'cancelled');
END;
$$;

-- 9. Atomic RPC: Record No-Show (Reviewable Process)
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

  IF v_organizer_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'UNAUTHENTICATED', 'message', 'Authentication required.');
  END IF;

  IF v_booking.organizer_id != v_organizer_id AND NOT is_current_admin() THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'UNAUTHORIZED', 'message', 'Not authorized to record no-show.');
  END IF;

  IF NOT validate_booking_transition(v_booking.status, 'no_show') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'INVALID_TRANSITION',
      'message', 'Cannot mark no-show from status ' || v_booking.status
    );
  END IF;

  SELECT * INTO v_job FROM jobs WHERE id = v_booking.job_id FOR UPDATE;

  -- Mark no-show
  UPDATE bookings
  SET
    status = 'no_show',
    no_show_reason = p_reason
  WHERE id = p_booking_id;

  -- Release slot back for immediate standby
  UPDATE jobs
  SET
    slots_filled = GREATEST(0, slots_filled - 1),
    status = 'open'
  WHERE id = v_booking.job_id;

  -- Notify worker with option to dispute
  INSERT INTO notifications (
    user_id, title, body, type, data
  ) VALUES (
    v_booking.worker_id,
    '⚠️ Marked as No-Show',
    'You were marked as no-show for ' || v_job.title || '. Reason: ' || p_reason || '. If this is an error, submit a dispute.',
    'no_show_recorded',
    jsonb_build_object('booking_id', p_booking_id, 'job_id', v_job.id)
  );

  -- Audit log
  INSERT INTO audit_logs (
    actor_id, action, entity_type, entity_id, new_state
  ) VALUES (
    v_organizer_id, 'RECORD_NO_SHOW', 'booking', p_booking_id::TEXT,
    jsonb_build_object('reason', p_reason)
  );

  RETURN jsonb_build_object('success', true, 'status', 'no_show');
END;
$$;

-- 10. Atomic RPC: Dispute Booking Record
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

  IF NOT validate_booking_transition(v_booking.status, 'disputed') THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'INVALID_TRANSITION');
  END IF;

  v_respondent_id := CASE WHEN v_user_id = v_booking.worker_id THEN v_booking.organizer_id ELSE v_booking.worker_id END;

  UPDATE bookings
  SET
    status = 'disputed',
    dispute_reason = p_reason
  WHERE id = p_booking_id;

  -- Insert into disputes table for admin investigation
  INSERT INTO disputes (
    booking_id, raised_by, respondent_id, reason, status
  ) VALUES (
    p_booking_id, v_user_id, v_respondent_id, p_reason, 'open'
  ) RETURNING id INTO v_dispute_id;

  -- Notify respondent
  INSERT INTO notifications (
    user_id, title, body, type, data
  ) VALUES (
    v_respondent_id,
    '⚖️ Booking Record Disputed',
    'A dispute has been opened regarding your shift booking. An Opskl Admin will arbitrate.',
    'dispute_opened',
    jsonb_build_object('dispute_id', v_dispute_id, 'booking_id', p_booking_id)
  );

  -- Audit log
  INSERT INTO audit_logs (
    actor_id, action, entity_type, entity_id, new_state
  ) VALUES (
    v_user_id, 'DISPUTE_BOOKING', 'dispute', v_dispute_id::TEXT,
    jsonb_build_object('booking_id', p_booking_id, 'reason', p_reason)
  );

  RETURN jsonb_build_object('success', true, 'status', 'disputed', 'dispute_id', v_dispute_id);
END;
$$;

-- 11. RESTRICT RPC EXECUTION PRIVILEGES
REVOKE EXECUTE ON FUNCTION check_in_worker_safe(UUID, TEXT, NUMERIC, NUMERIC) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION check_in_worker_safe(UUID, TEXT, NUMERIC, NUMERIC) TO authenticated;

REVOKE EXECUTE ON FUNCTION check_out_worker_safe(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION check_out_worker_safe(UUID, TEXT) TO authenticated;

REVOKE EXECUTE ON FUNCTION complete_shift_and_approve_attendance(UUID, NUMERIC) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION complete_shift_and_approve_attendance(UUID, NUMERIC) TO authenticated;

REVOKE EXECUTE ON FUNCTION cancel_booking_safe(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION cancel_booking_safe(UUID, TEXT) TO authenticated;

REVOKE EXECUTE ON FUNCTION record_no_show_safe(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION record_no_show_safe(UUID, TEXT) TO authenticated;

REVOKE EXECUTE ON FUNCTION dispute_booking_safe(UUID, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION dispute_booking_safe(UUID, TEXT, TEXT) TO authenticated;

