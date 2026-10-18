-- ==============================================================================
-- OPSKL SECURITY & MIGRATION ENGINE HARDENING
-- Migration: 20261017000000_safe_admin_role_escalation_guard.sql
-- 
-- Rationale:
-- Eliminates the dangerous practice of executing
-- 'ALTER TABLE profiles DISABLE TRIGGER trg_prevent_role_escalation;'
-- during admin provisioning, database migrations, and administrative scripts.
--
-- Authorizes PostgreSQL superuser / direct migrations ('postgres', 'service_role',
-- 'supabase_admin'), internal service-role JWT contexts, and active admins,
-- while strictly preserving role escalation protection against non-admin users.
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.prevent_role_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- 1. Authorize administrative maintenance scripts, migrations, superuser, and service_role
  IF current_user IN ('postgres', 'service_role', 'supabase_admin')
     OR (current_setting('request.jwt.claim.role', true) = 'service_role')
     OR is_current_admin() THEN
    RETURN NEW;
  END IF;

  -- 2. Restrict regular authenticated / anon callers from altering assigned role
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    RAISE EXCEPTION 'Unauthorized: Users cannot change their assigned role.';
  END IF;

  -- 3. Restrict regular users from altering account active status
  IF NEW.is_active IS DISTINCT FROM OLD.is_active THEN
    RAISE EXCEPTION 'Unauthorized: Account activation status cannot be modified directly by users.';
  END IF;

  -- 4. Restrict regular users from modifying immutable primary key
  IF NEW.id IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION 'Unauthorized: Profile ID cannot be modified.';
  END IF;

  RETURN NEW;
END;
$$;

-- Ensure execute privileges are preserved
GRANT EXECUTE ON FUNCTION public.prevent_role_escalation() TO postgres, service_role, authenticated, anon;
