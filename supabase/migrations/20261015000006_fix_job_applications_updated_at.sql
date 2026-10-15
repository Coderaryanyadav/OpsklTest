-- ==============================================================================
-- OPSKL MIGRATION: 20261015000006_fix_job_applications_updated_at.sql
-- Adds updated_at column to job_applications to support status tracking and confirm_worker_booking_safe
-- ==============================================================================

ALTER TABLE job_applications ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- Ensure trigger or timestamp auto-updates
CREATE OR REPLACE FUNCTION set_job_applications_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_job_applications_updated_at ON job_applications;
CREATE TRIGGER trg_job_applications_updated_at
BEFORE UPDATE ON job_applications
FOR EACH ROW
EXECUTE FUNCTION set_job_applications_updated_at();
