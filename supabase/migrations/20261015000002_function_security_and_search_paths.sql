-- ==============================================================================
-- OPSKIL DATABASE MIGRATION: 20261015000002_function_security_and_search_paths.sql
-- Remediation for Supabase Database Linter Warnings:
--   - 0011_function_search_path_mutable: Pin search_path on functions
--   - 0028_anon_security_definer_function_executable: Revoke anon/PUBLIC execute
--   - 0029_authenticated_security_definer_function_executable: Revoke execute on
--     triggers, internal helpers, and batch cron functions
-- ==============================================================================

-- 1. Pin search_path on functions flagged with mutable search_path (0011)
ALTER FUNCTION public.validate_job_transition(text, text) SET search_path = public, pg_temp;
ALTER FUNCTION public.update_timestamp() SET search_path = public, pg_temp;
ALTER FUNCTION public.validate_booking_transition(text, text) SET search_path = public, pg_temp;
ALTER FUNCTION public.generate_invoice_number() SET search_path = public, pg_temp;

-- 2. Drop obsolete legacy overload signatures
DROP FUNCTION IF EXISTS public.complete_shift_and_approve_attendance(uuid, numeric);
DROP FUNCTION IF EXISTS public.admin_resolve_dispute_safe(uuid, text, text, numeric, uuid);

-- 3. Revoke EXECUTE from PUBLIC and anon across all public schema functions (0028)
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC, anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon;

-- 4. Revoke EXECUTE from authenticated on trigger functions (0029)
REVOKE EXECUTE ON FUNCTION public.check_organizer_profile_update() FROM authenticated, anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.check_worker_profile_update() FROM authenticated, anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.prevent_role_escalation() FROM authenticated, anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user_provisioning() FROM authenticated, anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.validate_job_transition(text, text) FROM authenticated, anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_timestamp() FROM authenticated, anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.validate_booking_transition(text, text) FROM authenticated, anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.generate_invoice_number() FROM authenticated, anon, PUBLIC;

-- 5. Internal notification helper & cron batch functions: restrict strictly to service_role (0029)
REVOKE EXECUTE ON FUNCTION public._notify(uuid, text, text, text, text, jsonb, text) FROM authenticated, anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public._notify(uuid, text, text, text, text, jsonb, text) TO service_role;

REVOKE EXECUTE ON FUNCTION public.close_expired_jobs() FROM authenticated, anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.close_expired_jobs() TO service_role;

REVOKE EXECUTE ON FUNCTION public.process_account_deletion_purge_safe(integer) FROM authenticated, anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.process_account_deletion_purge_safe(integer) TO service_role;
