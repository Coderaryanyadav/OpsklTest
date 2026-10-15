-- Migration: 20261015000009_grant_is_current_admin_to_anon.sql
-- Description: Grant EXECUTE on is_current_admin to anon so public discovery feed RLS policies evaluate cleanly without permission denied

GRANT EXECUTE ON FUNCTION is_current_admin() TO anon, authenticated, service_role;
