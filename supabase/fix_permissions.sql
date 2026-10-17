-- ==============================================================================
-- OPSKL LEAST-PRIVILEGE PERMISSIONS & ROLE GRANTS
-- Hardens public API roles according to database security principles:
-- 1. anon role has NO direct table access to sensitive base tables
-- 2. anon role ONLY has SELECT on safe projection views (public_jobs, public_organizer_cards)
-- 3. Default privileges strictly restricted; RLS enforced on authenticated role
-- ==============================================================================

-- 1. Schema Usage
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

-- 2. Strip excessive privileges from anon
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL ROUTINES IN SCHEMA public FROM anon;

ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON ROUTINES FROM anon;

-- 3. Service role maintains full administrative and background worker access
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON ROUTINES TO service_role;

-- 4. Authenticated role grants (DML governed strictly by Row Level Security policies)
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- 5. Safe Public Projections for Unauthenticated Discovery
-- Exclusively grant SELECT on sanitized views; never expose raw jobs or user profiles to anon
GRANT SELECT ON public.public_jobs TO anon;
GRANT SELECT ON public.public_organizer_cards TO anon;

-- 6. Public Discovery RPC functions
GRANT EXECUTE ON FUNCTION is_current_admin() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_discovery_feed(JSONB, INT, JSONB) TO anon, authenticated;
