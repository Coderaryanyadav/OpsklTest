-- ==============================================================================
-- OPSKIL DATABASE MIGRATION: 20261015000001_security_definer_views_and_rls.sql
-- Remediation for Supabase Database Linter errors:
--   - 0010_security_definer_view: Views defined without security_invoker = true
--   - 0013_rls_disabled_in_public: _opskil_migrations table missing RLS
-- ==============================================================================

-- 1. Enable RLS on _opskil_migrations and revoke public access
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = '_opskil_migrations') THEN
    ALTER TABLE public._opskil_migrations ENABLE ROW LEVEL SECURITY;
    REVOKE ALL ON TABLE public._opskil_migrations FROM anon, authenticated;
  END IF;
END $$;

-- 2. Add RLS policy on organizer_profiles so security_invoker = true views allow authenticated workers to read organizer cards
DROP POLICY IF EXISTS "Public organizer card read access" ON public.organizer_profiles;
CREATE POLICY "Public organizer card read access"
  ON public.organizer_profiles FOR SELECT TO authenticated
  USING (
    verification_status = 'verified'
    OR id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.jobs j 
      WHERE j.organizer_id = organizer_profiles.id 
        AND j.status IN ('open', 'filling', 'filled', 'in_progress', 'completed')
    )
  );

-- 3. Add RLS policy on worker_profiles so security_invoker = true views allow organizers to view applicants & bookings
DROP POLICY IF EXISTS "Organizers view applicant worker profiles" ON public.worker_profiles;
CREATE POLICY "Organizers view applicant worker profiles"
  ON public.worker_profiles FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.job_applications ja
      JOIN public.jobs j ON j.id = ja.job_id
      WHERE ja.worker_id = worker_profiles.id AND j.organizer_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.worker_id = worker_profiles.id AND b.organizer_id = auth.uid()
    )
  );

-- 4. Set security_invoker = true on all 6 public views to satisfy 0010_security_definer_view
ALTER VIEW public.public_organizer_cards SET (security_invoker = true);
ALTER VIEW public.worker_applicant_profiles SET (security_invoker = true);
ALTER VIEW public.shifts SET (security_invoker = true);
ALTER VIEW public.public_jobs SET (security_invoker = true);
ALTER VIEW public.admin_overview_metrics SET (security_invoker = true);
ALTER VIEW public.admin_audit_logs_view SET (security_invoker = true);
