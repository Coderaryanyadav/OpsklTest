-- ==============================================================================
-- OPSKL MIGRATION: 20261022000001_shared_rate_limiting.sql
-- Description:
--   Shared atomic rate-limiting table and RPC for multi-instance deployments.
--   Prevents process-local rate limit bypass across serverless instances and nodes.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.rate_limit_buckets (
  key TEXT PRIMARY KEY,
  count INT NOT NULL DEFAULT 1,
  reset_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.rate_limit_buckets ENABLE ROW LEVEL SECURITY;

-- Deny all direct access to anonymous and authenticated users
DROP POLICY IF EXISTS "Deny public access on rate_limit_buckets" ON public.rate_limit_buckets;
CREATE POLICY "Deny public access on rate_limit_buckets"
  ON public.rate_limit_buckets
  FOR ALL
  TO anon, authenticated
  USING (false);

-- Allow service_role full access
DROP POLICY IF EXISTS "Service role full access on rate_limit_buckets" ON public.rate_limit_buckets;
CREATE POLICY "Service role full access on rate_limit_buckets"
  ON public.rate_limit_buckets
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Atomic sliding-window / reset bucket rate limiter
CREATE OR REPLACE FUNCTION public.check_rate_limit_atomic(
  p_key TEXT,
  p_max_requests INT,
  p_window_seconds INT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_now TIMESTAMPTZ := clock_timestamp();
  v_reset_at TIMESTAMPTZ;
  v_count INT;
BEGIN
  IF p_key IS NULL OR length(trim(p_key)) = 0 THEN
    RETURN FALSE;
  END IF;

  INSERT INTO public.rate_limit_buckets (key, count, reset_at, updated_at)
  VALUES (p_key, 1, v_now + (p_window_seconds || ' seconds')::INTERVAL, v_now)
  ON CONFLICT (key) DO UPDATE
  SET
    count = CASE
      WHEN rate_limit_buckets.reset_at < v_now THEN 1
      ELSE rate_limit_buckets.count + 1
    END,
    reset_at = CASE
      WHEN rate_limit_buckets.reset_at < v_now THEN v_now + (p_window_seconds || ' seconds')::INTERVAL
      ELSE rate_limit_buckets.reset_at
    END,
    updated_at = v_now
  RETURNING rate_limit_buckets.count INTO v_count;

  RETURN v_count <= p_max_requests;
END;
$$;

REVOKE ALL ON FUNCTION public.check_rate_limit_atomic(TEXT, INT, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_rate_limit_atomic(TEXT, INT, INT) TO service_role;
