-- ==============================================================================
-- OPSKL POSTGRESQL PERMISSIONS & SCHEMA PRIVILEGES
-- Run this script in the Supabase SQL Editor:
-- https://supabase.com/dashboard/project/lericvniqdbvacgegrbp/sql
-- ==============================================================================

-- 1. Grant schema usage to standard Supabase roles
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

-- 2. Grant table permissions (Row Level Security policies still enforce user-level data isolation)
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO anon, authenticated, service_role;

-- 3. Ensure future tables, sequences, and functions automatically inherit these privileges
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON ROUTINES TO anon, authenticated, service_role;

-- 4. Explicitly ensure public read access on open jobs for unauthenticated workers browsing the feed
GRANT SELECT ON public.jobs TO anon, authenticated;
GRANT SELECT ON public.organizer_profiles TO anon, authenticated;
GRANT SELECT ON public.worker_profiles TO anon, authenticated;
