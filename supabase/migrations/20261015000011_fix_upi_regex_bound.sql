-- Migration 20261015000011: Fix UPI Regex in check_worker_profile_update
-- Fixes PostgreSQL regex error: invalid regular expression: invalid repetition count(s)
-- PostgreSQL REG_UBOUND limits repetition counts in {m,n} to 255.
-- Changes {2,256} to {2,255} to adhere to POSIX bounds.

CREATE OR REPLACE FUNCTION public.check_worker_profile_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- 1. Allow trusted internal updates via transaction-local setting
  IF current_setting('opskl.trusted', true) = '1' THEN
    RETURN NEW;
  END IF;

  -- 2. Allow administrative role
  IF is_current_admin() THEN
    RETURN NEW;
  END IF;

  IF NEW.id IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION 'Unauthorized: Profile ID cannot be modified.';
  END IF;

  IF NEW.verification_status IS DISTINCT FROM OLD.verification_status OR
     NEW.rating IS DISTINCT FROM OLD.rating OR
     NEW.total_reviews IS DISTINCT FROM OLD.total_reviews OR
     NEW.shifts_completed IS DISTINCT FROM OLD.shifts_completed OR
     NEW.is_aadhaar_verified IS DISTINCT FROM OLD.is_aadhaar_verified OR
     NEW.is_pan_verified IS DISTINCT FROM OLD.is_pan_verified THEN
    RAISE EXCEPTION 'Unauthorized: Administrative and verification fields cannot be modified directly by workers.';
  END IF;

  IF NEW.upi_id IS DISTINCT FROM OLD.upi_id AND NEW.upi_id IS NOT NULL AND trim(NEW.upi_id) != '' THEN
    IF NEW.upi_id !~* '^[a-zA-Z0-9._-]{2,255}@[a-zA-Z]{2,64}$' THEN
      RAISE EXCEPTION 'Invalid UPI ID format. Payout destination handle must be valid (e.g. name@bank).';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
