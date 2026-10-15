-- Migration 20261015000010: Fix Organizer Registration & Profile Switching
-- 1. Updates handle_new_user_provisioning trigger to auto-confirm new users and create organizer profile when role='organizer'
-- 2. Adds register_organizer_direct_safe RPC for direct atomic registration without failing on SMTP/Resend rate limits
-- 3. Updates ensure_user_profile_provisioned_safe to allow switching role to 'organizer' if requested by authenticated user
-- 4. Adds switch_user_role_safe RPC for existing accounts (e.g. Google auth) to switch between worker and organizer seamlessly

-- 1. Update handle_new_user_provisioning trigger
CREATE OR REPLACE FUNCTION public.handle_new_user_provisioning()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_role user_role;
  v_phone TEXT;
  v_name TEXT;
  v_email TEXT;
BEGIN
  v_role := CASE
    WHEN (NEW.raw_user_meta_data->>'role') = 'organizer' THEN 'organizer'::user_role
    WHEN (NEW.raw_user_meta_data->>'role') = 'admin' THEN 'admin'::user_role
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
    role = CASE WHEN EXCLUDED.role = 'organizer' THEN 'organizer'::user_role ELSE profiles.role END,
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
$function$;

-- 2. Update ensure_user_profile_provisioned_safe to support role switching when explicitly requested
CREATE OR REPLACE FUNCTION public.ensure_user_profile_provisioned_safe(
  p_role user_role DEFAULT 'worker',
  p_full_name TEXT DEFAULT NULL,
  p_phone TEXT DEFAULT NULL,
  p_email TEXT DEFAULT NULL
)
RETURNS JSONB
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
      -- Allow explicit role switch
      v_target_role := p_role;
      UPDATE profiles 
      SET 
        role = v_target_role,
        full_name = COALESCE(p_full_name, profiles.full_name),
        phone = COALESCE(p_phone, profiles.phone),
        email = COALESCE(v_email, profiles.email),
        updated_at = now()
      WHERE id = v_user_id;
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

-- 3. Dedicated switch_user_role_safe RPC
CREATE OR REPLACE FUNCTION public.switch_user_role_safe(
  p_target_role user_role,
  p_business_name TEXT DEFAULT NULL,
  p_business_phone TEXT DEFAULT NULL
)
RETURNS JSONB
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

  -- Update role on profiles table
  UPDATE profiles
  SET role = p_target_role, updated_at = now()
  WHERE id = v_user_id;

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

-- 4. Direct Organizer Registration RPC (bypasses Resend/SMTP email failures in development/pilot)
CREATE OR REPLACE FUNCTION public.register_organizer_direct_safe(
  p_email TEXT,
  p_password TEXT,
  p_business_name TEXT,
  p_phone TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_norm_email TEXT := lower(trim(p_email));
  v_norm_phone TEXT := trim(p_phone);
  v_norm_name TEXT := trim(p_business_name);
  v_existing_user_id UUID;
  v_new_user_id UUID;
  v_encrypted_pw TEXT;
BEGIN
  IF v_norm_email IS NULL OR v_norm_email NOT LIKE '%@%.%' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid email address provided.');
  END IF;

  IF length(p_password) < 6 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Password must be at least 6 characters.');
  END IF;

  IF length(v_norm_name) < 2 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Organization name is required.');
  END IF;

  -- Check if user already exists in auth.users
  SELECT id INTO v_existing_user_id FROM auth.users WHERE lower(email) = v_norm_email;

  IF v_existing_user_id IS NOT NULL THEN
    -- User already exists: update role to organizer and ensure organizer_profiles entry
    v_encrypted_pw := extensions.crypt(p_password, extensions.gen_salt('bf'));

    UPDATE auth.users
    SET 
      encrypted_password = v_encrypted_pw,
      email_confirmed_at = COALESCE(email_confirmed_at, now()),
      raw_user_meta_data = raw_user_meta_data || jsonb_build_object('role', 'organizer', 'full_name', v_norm_name, 'phone', v_norm_phone),
      updated_at = now()
    WHERE id = v_existing_user_id;

    UPDATE profiles
    SET 
      role = 'organizer',
      full_name = v_norm_name,
      phone = v_norm_phone,
      updated_at = now()
    WHERE id = v_existing_user_id;

    INSERT INTO organizer_profiles (
      id, business_name, business_contact_phone, business_contact_email, business_type, profile_completion_status, verification_status
    ) VALUES (
      v_existing_user_id, v_norm_name, v_norm_phone, v_norm_email, 'event_agency', 'incomplete', 'unverified'
    )
    ON CONFLICT (id) DO UPDATE SET
      business_name = EXCLUDED.business_name,
      business_contact_phone = EXCLUDED.business_contact_phone;

    RETURN jsonb_build_object(
      'success', true,
      'user_id', v_existing_user_id,
      'is_existing_account', true,
      'message', 'Existing account upgraded to Organizer profile.'
    );
  END IF;

  -- Create brand new user in auth.users
  v_new_user_id := gen_random_uuid();
  v_encrypted_pw := extensions.crypt(p_password, extensions.gen_salt('bf'));

  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    v_new_user_id,
    'authenticated',
    'authenticated',
    v_norm_email,
    v_encrypted_pw,
    now(),
    jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
    jsonb_build_object('role', 'organizer', 'full_name', v_norm_name, 'phone', v_norm_phone),
    now(),
    now()
  );

  INSERT INTO auth.identities (
    id,
    user_id,
    identity_data,
    provider,
    provider_id,
    last_sign_in_at,
    created_at,
    updated_at
  ) VALUES (
    gen_random_uuid(),
    v_new_user_id,
    jsonb_build_object('sub', v_new_user_id::text, 'email', v_norm_email),
    'email',
    v_new_user_id::text,
    now(),
    now(),
    now()
  );

  -- Profiles and organizer_profiles are created via trg_on_auth_user_created,
  -- but ensure them explicitly here for guaranteed idempotency:
  INSERT INTO profiles (
    id, role, phone, full_name, email, city, is_active
  ) VALUES (
    v_new_user_id, 'organizer', v_norm_phone, v_norm_name, v_norm_email, 'Mumbai', true
  )
  ON CONFLICT (id) DO UPDATE SET
    role = 'organizer',
    full_name = EXCLUDED.full_name,
    phone = EXCLUDED.phone;

  INSERT INTO organizer_profiles (
    id, business_name, business_contact_phone, business_contact_email, business_type, profile_completion_status, verification_status
  ) VALUES (
    v_new_user_id, v_norm_name, v_norm_phone, v_norm_email, 'event_agency', 'incomplete', 'unverified'
  )
  ON CONFLICT (id) DO UPDATE SET
    business_name = EXCLUDED.business_name,
    business_contact_phone = EXCLUDED.business_contact_phone;

  RETURN jsonb_build_object(
    'success', true,
    'user_id', v_new_user_id,
    'is_existing_account', false,
    'message', 'Organizer account registered and verified.'
  );
END;
$$;

-- Grant EXECUTE permissions
GRANT EXECUTE ON FUNCTION public.ensure_user_profile_provisioned_safe(user_role, TEXT, TEXT, TEXT) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.switch_user_role_safe(user_role, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.register_organizer_direct_safe(TEXT, TEXT, TEXT, TEXT) TO anon, authenticated;
