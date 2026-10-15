-- ======================================================================
-- OPSKL DATABASE CLEANUP SCRIPT
-- Cleans all demo / test data and preserves only the Administrator
-- ======================================================================

BEGIN;

-- 1. Temporarily disable triggers that guard deletions or validations
SET session_replication_role = 'replica';

-- 2. Clear all transactional & operational marketplace data
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

-- 7. Reset replication role back to normal
SET session_replication_role = 'origin';

COMMIT;

-- 8. Notify PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
