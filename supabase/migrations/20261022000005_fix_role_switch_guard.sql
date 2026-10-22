-- Fix self-service organizer role switching.
--
-- `switch_user_role_safe` and `ensure_user_profile_provisioned_safe` are
-- SECURITY DEFINER RPCs that intentionally update `profiles.role` between
-- worker and organizer. The role-escalation trigger added in
-- 20261022000004_fix_privilege_escalation_triggers.sql rejects every role
-- change from a JWT-authenticated session, including those trusted RPCs, so
-- "Switch to Organizer Workspace" and organizer login for an existing worker
-- account fail with "Users cannot change their assigned role."
--
-- The RPCs now mark the narrowly-scoped, transaction-local
-- `opskl.role_switch` flag while performing their own authorized update. The
-- trigger permits only that documented path; direct client updates still hit
-- the original guard.

-- ------------------------------------------------------------------------------
-- 1. Role escalation guard: allow only the explicit trusted RPC window
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.prevent_role_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Set only by the two SECURITY DEFINER role-management RPCs below.
  IF current_setting('opskl.role_switch', true) = '1' THEN
    RETURN NEW;
  END IF;

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
-- 2. Authorized worker <-> organizer switch
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.switch_user_role_safe(
  p_target_role user_role,
  p_business_name text DEFAULT NULL,
  p_business_phone text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_profile RECORD;
  v_email TEXT;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Authentication required.');
  END IF;

  IF p_target_role NOT IN ('worker', 'organizer') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Target role must be worker or organizer.');
  END IF;

  SELECT * INTO v_profile FROM profiles WHERE id = v_user_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'User profile not found.');
  END IF;

  IF v_profile.role = 'admin' THEN
    RETURN jsonb_build_object('success', true, 'message', 'Admin has universal access.', 'role', 'admin');
  END IF;

  SELECT email INTO v_email FROM auth.users WHERE id = v_user_id;

  -- Authorized role update. Keep the window as small as possible.
  PERFORM set_config('opskl.role_switch', '1', true);
  UPDATE profiles
  SET role = p_target_role, updated_at = now()
  WHERE id = v_user_id;
  PERFORM set_config('opskl.role_switch', '0', true);

  -- Ensure target role subprofile exists
  IF p_target_role = 'organizer' THEN
    INSERT INTO organizer_profiles (
      id, business_name, business_contact_phone, business_contact_email, business_type, profile_completion_status, verification_status
    ) VALUES (
      v_user_id,
      COALESCE(p_business_name, v_profile.full_name, 'Independent Organizer'),
      COALESCE(p_business_phone, v_profile.phone, ''),
      COALESCE(v_profile.email, v_email),
      'event_agency',
      'incomplete',
      'unverified'
    )
    ON CONFLICT (id) DO UPDATE SET
      business_name = COALESCE(EXCLUDED.business_name, organizer_profiles.business_name),
      business_contact_phone = COALESCE(EXCLUDED.business_contact_phone, organizer_profiles.business_contact_phone);
  ELSIF p_target_role = 'worker' THEN
    INSERT INTO worker_profiles (
      id, preferred_locality, skills, availability_status, profile_completion_status, verification_status
    ) VALUES (
      v_user_id, 'Mumbai', '{}', 'available', 'incomplete', 'unverified'
    )
    ON CONFLICT (id) DO NOTHING;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'user_id', v_user_id,
    'role', p_target_role
  );
END;
$$;

-- ------------------------------------------------------------------------------
-- 3. Provisioning RPC: same trusted window for its documented role switch
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ensure_user_profile_provisioned_safe(
  p_role user_role DEFAULT 'worker',
  p_full_name text DEFAULT NULL,
  p_phone text DEFAULT NULL,
  p_email text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_existing_profile RECORD;
  v_target_role user_role := COALESCE(p_role, 'worker');
  v_name TEXT;
  v_phone TEXT;
  v_email TEXT;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Authentication required.');
  END IF;

  -- Admin cannot be assigned via client RPC
  IF v_target_role = 'admin' THEN
    v_target_role := 'worker';
  END IF;

  SELECT email INTO v_email FROM auth.users WHERE id = v_user_id;
  v_email := COALESCE(p_email, v_email);

  SELECT * INTO v_existing_profile FROM profiles WHERE id = v_user_id;

  IF FOUND THEN
    -- If user is already admin, keep admin
    IF v_existing_profile.role = 'admin' THEN
      v_target_role := 'admin';
    ELSIF p_role IS NOT NULL AND (p_role = 'organizer' OR p_role = 'worker') THEN
      -- Allow explicit role switch through the same trusted window.
      v_target_role := p_role;
      PERFORM set_config('opskl.role_switch', '1', true);
      UPDATE profiles
      SET
        role = v_target_role,
        full_name = COALESCE(p_full_name, profiles.full_name),
        phone = COALESCE(p_phone, profiles.phone),
        email = COALESCE(v_email, profiles.email),
        updated_at = now()
      WHERE id = v_user_id;
      PERFORM set_config('opskl.role_switch', '0', true);
    ELSE
      v_target_role := v_existing_profile.role;
      IF v_existing_profile.email IS NULL AND v_email IS NOT NULL THEN
        UPDATE profiles SET email = v_email WHERE id = v_user_id;
      END IF;
    END IF;
  ELSE
    v_name := COALESCE(
      p_full_name,
      CASE WHEN v_email IS NOT NULL THEN split_part(v_email, '@', 1) ELSE 'User ' || substr(v_user_id::text, 1, 6) END
    );
    v_phone := p_phone;

    INSERT INTO profiles (id, role, phone, full_name, email, city, is_active)
    VALUES (v_user_id, v_target_role, v_phone, v_name, v_email, 'Mumbai', true)
    ON CONFLICT (id) DO UPDATE SET
      email = COALESCE(EXCLUDED.email, profiles.email);
  END IF;

  -- Provision profile extensions if missing
  IF v_target_role = 'worker' OR v_target_role = 'admin' THEN
    INSERT INTO worker_profiles (id, preferred_locality, skills, availability_status, profile_completion_status, verification_status)
    VALUES (v_user_id, 'Mumbai', '{}', 'available', 'incomplete', 'unverified')
    ON CONFLICT (id) DO NOTHING;
  END IF;

  IF v_target_role = 'organizer' OR v_target_role = 'admin' THEN
    INSERT INTO organizer_profiles (id, business_name, business_contact_phone, business_contact_email, business_type, profile_completion_status, verification_status)
    VALUES (v_user_id, COALESCE(p_full_name, 'Independent Organizer'), COALESCE(p_phone, ''), v_email, 'event_agency', 'incomplete', 'unverified')
    ON CONFLICT (id) DO UPDATE SET
      business_name = CASE WHEN organizer_profiles.business_name = 'Independent Organizer' THEN COALESCE(EXCLUDED.business_name, organizer_profiles.business_name) ELSE organizer_profiles.business_name END,
      business_contact_email = COALESCE(organizer_profiles.business_contact_email, EXCLUDED.business_contact_email);
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'user_id', v_user_id,
    'role', v_target_role,
    'email', v_email
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.switch_user_role_safe(user_role, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_user_profile_provisioned_safe(user_role, text, text, text) TO authenticated;
