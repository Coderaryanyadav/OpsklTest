-- ======================================================================
-- OPSKL DATABASE CLEANUP SCRIPT (DISPOSABLE TESTING SANDBOX ONLY)
--
-- CRITICAL WARNING:
-- This script permanently deletes marketplace operational data and test accounts.
-- It is designed EXCLUSIVELY for disposable ephemeral testing sandboxes.
-- It MUST NEVER be executed against production or shared staging databases.
--
-- STRICT SAFETY INVARIANTS:
-- To execute this script on a disposable test database, you must explicitly set:
--   SET opskil.target_env = 'disposable_local_sandbox';
--   SET opskil.confirm_destructive_clean = 'I_UNDERSTAND_THIS_DELETES_ALL_DATA';
-- Without BOTH settings, the script aborts immediately without touching any table.
-- ======================================================================

BEGIN;

-- 1. Explicit destructive action confirmation & disposable target allowlist guard
DO $$
DECLARE
  v_db TEXT := current_database();
  v_env TEXT := current_setting('opskil.target_env', true);
  v_confirm TEXT := current_setting('opskil.confirm_destructive_clean', true);
BEGIN
  -- Multi-step explicit environment declaration
  IF v_env IS DISTINCT FROM 'disposable_local_sandbox' THEN
    RAISE EXCEPTION 'FATAL: scripts/clean_database_for_production.sql is prohibited on non-disposable environments. opskil.target_env must be set to ''disposable_local_sandbox''. (Current target DB: %)', v_db;
  END IF;

  IF v_confirm IS DISTINCT FROM 'I_UNDERSTAND_THIS_DELETES_ALL_DATA' THEN
    RAISE EXCEPTION 'DESTRUCTIVE CLEAN BLOCKED: Explicit confirmation required: SET opskil.confirm_destructive_clean = ''I_UNDERSTAND_THIS_DELETES_ALL_DATA'';';
  END IF;

  -- Block any database name indicating live, production, or client deployment
  IF v_db ~* 'prod|production|live|opskil_main|client' THEN
    RAISE EXCEPTION 'CRITICAL ACTION BLOCKED: Database name "%" indicates a production/live deployment. Automated cleanup is permanently forbidden on production.', v_db;
  END IF;
END $$;

-- 2. Clear all transactional & operational marketplace child data first (triggers remain safely enabled)
TRUNCATE TABLE public.shift_messages CASCADE;
TRUNCATE TABLE public.saved_jobs CASCADE;
TRUNCATE TABLE public.swipe_events CASCADE;
TRUNCATE TABLE public.attendance_records CASCADE;
TRUNCATE TABLE public.payment_records CASCADE;
TRUNCATE TABLE public.payment_reconciliation_logs CASCADE;
TRUNCATE TABLE public.payment_webhook_events CASCADE;
TRUNCATE TABLE public.organizer_invoices CASCADE;
TRUNCATE TABLE public.disputes CASCADE;
TRUNCATE TABLE public.verification_cases CASCADE;
TRUNCATE TABLE public.safety_reports CASCADE;
TRUNCATE TABLE public.account_deletion_requests CASCADE;
TRUNCATE TABLE public.user_push_tokens CASCADE;
TRUNCATE TABLE public.user_notification_preferences CASCADE;
TRUNCATE TABLE public.notification_delivery_logs CASCADE;
TRUNCATE TABLE public.notifications CASCADE;
TRUNCATE TABLE public.reviews CASCADE;
TRUNCATE TABLE public.bookings CASCADE;
TRUNCATE TABLE public.job_applications CASCADE;
TRUNCATE TABLE public.jobs CASCADE;
TRUNCATE TABLE public.audit_logs CASCADE;

-- 3. Remove non-admin role profiles
DELETE FROM public.worker_profiles 
WHERE id NOT IN (SELECT id FROM public.profiles WHERE role = 'admin' OR email = 'admin@opskil.com');

DELETE FROM public.organizer_memberships 
WHERE user_id NOT IN (SELECT id FROM public.profiles WHERE role = 'admin' OR email = 'admin@opskil.com');

DELETE FROM public.organizer_profiles 
WHERE id NOT IN (SELECT id FROM public.profiles WHERE role = 'admin' OR email = 'admin@opskil.com');

-- 4. Delete non-admin profiles
DELETE FROM public.profiles 
WHERE role != 'admin' AND email != 'admin@opskil.com';

-- 5. Delete non-admin auth.users
DELETE FROM auth.users 
WHERE email != 'admin@opskil.com';

-- 6. Ensure the admin profile is fully configured and active
INSERT INTO public.profiles (
  id, role, full_name, email, city, is_active, created_at, updated_at
)
SELECT 
  id, 
  'admin', 
  'Opskl Administrator', 
  'admin@opskil.com', 
  'Mumbai', 
  true, 
  now(), 
  now()
FROM auth.users 
WHERE email = 'admin@opskil.com'
ON CONFLICT (id) DO UPDATE SET 
  role = 'admin',
  full_name = 'Opskl Administrator',
  email = 'admin@opskil.com',
  is_active = true,
  updated_at = now();

COMMIT;

-- 7. Notify PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
