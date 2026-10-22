-- ==============================================================================
-- OPSKL MIGRATION: 20261022000004_fix_privilege_escalation_triggers.sql
--
-- Reproduced on a disposable PostgreSQL database:
--   As an authenticated worker (SET ROLE authenticated + worker JWT sub), the
--   following direct PostgREST table updates SUCCEEDED:
--     UPDATE worker_profiles SET verification_status='verified'  -> verified
--     UPDATE profiles        SET role='admin'                    -> admin
--   Root cause: the protection triggers are SECURITY DEFINER, so current_user
--   is always the function owner (postgres). The bypass branch
--   `current_user IN ('postgres', ...)` therefore treated every caller as an
--   administrator. Verification and role fields must be derived from the
--   verified JWT/role, never from the execution role of the definer.
--
-- Also hardens manual payout settlement:
--   - only escrow_locked/processing payouts may be settled
--   - repeated settlement is idempotent only for the same UTR
--   - failed/refunded payouts cannot be silently overwritten
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Role escalation guard
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.prevent_role_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Administrative maintenance (migrations), service role, or an active admin.
  IF COALESCE(current_setting('request.jwt.claim.role', true), '') IN ('authenticated', 'anon')
     OR current_user IN ('authenticated', 'anon') THEN
    IF is_current_admin() THEN
      RETURN NEW;
    END IF;
  ELSE
    IF session_user IN ('postgres', 'supabase_admin')
       OR COALESCE(auth.role(), '') = 'service_role'
       OR COALESCE(current_setting('request.jwt.claim.role', true), '') = 'service_role'
       OR is_current_admin() THEN
      RETURN NEW;
    END IF;
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
-- 2. Worker verification/rating guard
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.check_worker_profile_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF current_setting('opskl.trusted', true) = '1' THEN
    RETURN NEW;
  END IF;

  IF COALESCE(current_setting('request.jwt.claim.role', true), '') IN ('authenticated', 'anon')
     OR current_user IN ('authenticated', 'anon') THEN
    IF is_current_admin() THEN
      RETURN NEW;
    END IF;
  ELSE
    IF session_user IN ('postgres', 'supabase_admin')
       OR COALESCE(auth.role(), '') = 'service_role'
       OR COALESCE(current_setting('request.jwt.claim.role', true), '') = 'service_role'
       OR is_current_admin() THEN
      RETURN NEW;
    END IF;
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
    IF NEW.upi_id !~* '^[a-zA-Z0-9._-]{2,255}@[a-zA-Z]{2,64}$' THEN
      RAISE EXCEPTION 'Invalid UPI ID format. Payout destination handle must be valid (e.g. name@bank).';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- ------------------------------------------------------------------------------
-- 3. Organizer verification guard
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.check_organizer_profile_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF current_setting('opskl.trusted', true) = '1' THEN
    RETURN NEW;
  END IF;

  IF COALESCE(current_setting('request.jwt.claim.role', true), '') IN ('authenticated', 'anon')
     OR current_user IN ('authenticated', 'anon') THEN
    IF is_current_admin() THEN
      RETURN NEW;
    END IF;
  ELSE
    IF session_user IN ('postgres', 'supabase_admin')
       OR COALESCE(auth.role(), '') = 'service_role'
       OR COALESCE(current_setting('request.jwt.claim.role', true), '') = 'service_role'
       OR is_current_admin() THEN
      RETURN NEW;
    END IF;
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

-- ------------------------------------------------------------------------------
-- 4. Manual payout settlement state machine
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_mark_payout_settled(
  p_payment_id UUID,
  p_utr TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_admin_id UUID := auth.uid();
  v_payment RECORD;
  v_clean_utr TEXT := upper(trim(COALESCE(p_utr, '')));
BEGIN
  IF NOT is_current_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Administrative authorization required.');
  END IF;

  IF length(v_clean_utr) < 6 OR length(v_clean_utr) > 64 THEN
    RETURN jsonb_build_object('success', false, 'error', 'A valid UTR/transaction reference (6-64 characters) is required.');
  END IF;

  SELECT * INTO v_payment FROM payment_records WHERE id = p_payment_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Payment record not found.');
  END IF;

  IF v_payment.status = 'settled' THEN
    IF upper(trim(COALESCE(v_payment.utr_reference, ''))) = v_clean_utr THEN
      RETURN jsonb_build_object('success', true, 'payment_id', p_payment_id, 'status', 'settled', 'already_settled', true);
    END IF;
    RETURN jsonb_build_object('success', false, 'error', 'Payout is already settled with a different UTR. Reversal requires a separate reconciliation workflow.');
  END IF;

  IF v_payment.status NOT IN ('escrow_locked', 'processing') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only escrow-locked or processing payouts can be settled. Current status: ' || v_payment.status);
  END IF;

  UPDATE payment_records
  SET
    status = 'settled',
    utr_reference = v_clean_utr,
    settled_at = now(),
    updated_at = now()
  WHERE id = p_payment_id;

  INSERT INTO payment_reconciliation_logs (
    reconciliation_type, reference_id, status, expected_amount, recorded_amount, notes, actor_id
  ) VALUES (
    'payout', p_payment_id::TEXT, 'matched', v_payment.net_payout, v_payment.net_payout,
    'Settled via UTR: ' || v_clean_utr, v_admin_id
  );

  PERFORM _notify(
    v_payment.worker_id,
    'Payout Settled',
    'Your payout of ₹' || v_payment.net_payout || ' has been transferred to ' || v_payment.upi_id || '. UTR: ' || v_clean_utr,
    'payout_settled',
    '/shift/' || v_payment.job_id
  );

  INSERT INTO audit_logs (
    actor_id, action, entity_type, entity_id, new_state
  ) VALUES (
    v_admin_id, 'ADMIN_SETTLE_PAYOUT', 'payment_records', p_payment_id::TEXT,
    jsonb_build_object('utr', v_clean_utr, 'amount', v_payment.net_payout)
  );

  RETURN jsonb_build_object('success', true, 'payment_id', p_payment_id, 'status', 'settled', 'already_settled', false);
END;
$$;

-- ------------------------------------------------------------------------------
-- 5. Function-level grants
-- ------------------------------------------------------------------------------
-- The invoice sequence is an internal allocator; clients must never call it
-- directly and burn fiscal invoice numbers.
REVOKE EXECUTE ON FUNCTION public.generate_invoice_number() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.generate_invoice_number() TO service_role;

-- Payment reference submission is for authenticated organizers/admins only.
REVOKE EXECUTE ON FUNCTION public.submit_invoice_payment_reference_safe(UUID, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_invoice_payment_reference_safe(UUID, TEXT, TEXT) TO authenticated, service_role;
