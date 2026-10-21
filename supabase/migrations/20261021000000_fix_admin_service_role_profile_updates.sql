-- ==============================================================================
-- OPSKL SECURITY REPAIR: AUTHORIZE SERVICE ROLE & ADMIN IN PROFILE GUARDS
-- Allows administrative service_role and verified admin accounts to update
-- worker and organizer profiles (e.g. KYC verification, skills, business data).
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.is_current_admin()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO "public"
AS $function$
  SELECT (
    COALESCE(auth.role(), '') = 'service_role'
    OR current_user IN ('postgres', 'service_role', 'supabase_admin')
    OR (current_setting('request.jwt.claim.role', true) = 'service_role')
    OR EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );
$function$;

CREATE OR REPLACE FUNCTION public.check_organizer_profile_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO "public"
AS $function$
BEGIN
  -- Allow service role, postgres, admin, or opskl.trusted bypass
  IF current_setting('opskl.trusted', true) = '1'
     OR is_current_admin()
     OR COALESCE(auth.role(), '') = 'service_role'
     OR current_user IN ('postgres', 'service_role', 'supabase_admin')
     OR (current_setting('request.jwt.claim.role', true) = 'service_role') THEN
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
$function$;

CREATE OR REPLACE FUNCTION public.check_worker_profile_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO "public"
AS $function$
BEGIN
  -- Allow service role, postgres, admin, or opskl.trusted bypass
  IF current_setting('opskl.trusted', true) = '1'
     OR is_current_admin()
     OR COALESCE(auth.role(), '') = 'service_role'
     OR current_user IN ('postgres', 'service_role', 'supabase_admin')
     OR (current_setting('request.jwt.claim.role', true) = 'service_role') THEN
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
$function$;
