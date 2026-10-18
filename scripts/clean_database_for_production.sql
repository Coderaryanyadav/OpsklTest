-- ======================================================================
-- OPSKL DATABASE CLEANUP SCRIPT (HARDENED)
-- Cleans all demo / test data and preserves only the Administrator
--
-- SAFETY INVARIANT:
-- To execute this destructive script, you MUST explicitly execute:
--   SET opskil.confirm_destructive_clean = 'I_UNDERSTAND_THIS_DELETES_ALL_DATA';
-- Otherwise the script will abort immediately without modifying any tables.
-- ======================================================================

BEGIN;

-- 1. Explicit destructive action confirmation guard
DO $$
BEGIN
  IF current_setting('opskil.confirm_destructive_clean', true) IS DISTINCT FROM 'I_UNDERSTAND_THIS_DELETES_ALL_DATA' THEN
    RAISE EXCEPTION 'DESTRUCTIVE CLEAN BLOCKED: scripts/clean_database_for_production.sql drops all operational data. To run this script, you must first execute: SET opskil.confirm_destructive_clean = ''I_UNDERSTAND_THIS_DELETES_ALL_DATA'';';
  END IF;

  IF current_database() IN ('production', 'opskil_production') AND current_setting('opskil.allow_production_clean', true) IS DISTINCT FROM 'true' THEN
    RAISE EXCEPTION 'DESTRUCTIVE ACTION BLOCKED: Target database "%" is marked as production. Explicit override is required: SET opskil.allow_production_clean = ''true'';', current_database();
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
