-- Opskl Consolidated Full Schema Release
-- Production Ready

-- ============================================================================
-- Migration: 20261012000000_initial_schema.sql
-- ============================================================================

-- ==============================================================================
-- OPSKL MASTER DATABASE SCHEMA & MIGRATION
-- Market: India (Single-Day Event Shift Marketplace)
-- Initial Launch: Mumbai Metropolitan Region
-- ==============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. CUSTOM ENUMS
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('worker', 'organizer', 'admin');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE shift_category AS ENUM (
    'exhibition',
    'conference',
    'corporate',
    'activation',
    'support',
    'hospitality'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE shift_status AS ENUM (
    'draft',
    'open',
    'filling',
    'filled',
    'in_progress',
    'completed',
    'cancelled'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE job_status AS ENUM (
    'draft',
    'open',
    'filling',
    'filled',
    'in_progress',
    'completed',
    'cancelled'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE application_status AS ENUM (
    'applied',
    'shortlisted',
    'confirmed',
    'rejected',
    'withdrawn'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE payout_status AS ENUM (
    'pending',
    'escrow_locked',
    'processing',
    'settled',
    'failed',
    'refunded'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 3. CORE PROFILES (Base user identity)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role user_role NOT NULL DEFAULT 'worker',
  phone TEXT,
  full_name TEXT NOT NULL,
  email TEXT UNIQUE,
  avatar_url TEXT,
  city TEXT NOT NULL DEFAULT 'Mumbai',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. WORKER PROFILES
CREATE TABLE IF NOT EXISTS worker_profiles (
  id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  user_id UUID GENERATED ALWAYS AS (id) STORED,
  preferred_locality TEXT NOT NULL DEFAULT 'Mumbai',
  service_areas TEXT[] NOT NULL DEFAULT '{}',
  skills TEXT[] NOT NULL DEFAULT '{}',
  experience_years NUMERIC(3, 1) DEFAULT 0.0,
  bio TEXT,
  availability_status TEXT NOT NULL DEFAULT 'available' CHECK (availability_status IN ('available', 'busy', 'paused')),
  profile_completion_status TEXT NOT NULL DEFAULT 'incomplete' CHECK (profile_completion_status IN ('incomplete', 'completed')),
  verification_status TEXT NOT NULL DEFAULT 'unverified' CHECK (verification_status IN ('unverified', 'pending', 'verified', 'rejected')),
  is_aadhaar_verified BOOLEAN NOT NULL DEFAULT false,
  is_pan_verified BOOLEAN NOT NULL DEFAULT false,
  rating NUMERIC(3, 2) DEFAULT NULL,
  total_reviews INTEGER NOT NULL DEFAULT 0,
  shifts_completed INTEGER NOT NULL DEFAULT 0,
  upi_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. ORGANIZER PROFILES
CREATE TABLE IF NOT EXISTS organizer_profiles (
  id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  user_id UUID GENERATED ALWAYS AS (id) STORED,
  business_name TEXT NOT NULL,
  business_contact_email TEXT,
  business_contact_phone TEXT NOT NULL,
  gstin TEXT,
  is_gstin_verified BOOLEAN NOT NULL DEFAULT false,
  business_type TEXT NOT NULL DEFAULT 'event_agency' CHECK (business_type IN ('event_agency', 'corporate', 'venue_manager', 'independent')),
  billing_address TEXT,
  verification_status TEXT NOT NULL DEFAULT 'unverified' CHECK (verification_status IN ('unverified', 'pending', 'verified', 'rejected')),
  profile_completion_status TEXT NOT NULL DEFAULT 'incomplete' CHECK (profile_completion_status IN ('incomplete', 'completed')),
  rating NUMERIC(3, 2) DEFAULT NULL,
  total_events_hosted INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. ORGANIZER TEAM MEMBERSHIPS
CREATE TABLE IF NOT EXISTS organizer_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organizer_id UUID NOT NULL REFERENCES organizer_profiles(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'supervisor', 'member')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(organizer_id, user_id)
);

-- 7. JOBS (Single-day shift listings)
CREATE TABLE IF NOT EXISTS jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organizer_id UUID NOT NULL REFERENCES organizer_profiles(id) ON DELETE RESTRICT,
  title TEXT NOT NULL,
  category shift_category NOT NULL,
  venue_name TEXT NOT NULL,
  venue_address TEXT NOT NULL,
  landmark TEXT,
  city TEXT NOT NULL DEFAULT 'Mumbai',
  zone TEXT NOT NULL,
  date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  duration_hours NUMERIC(4, 2) NOT NULL,
  hourly_rate NUMERIC(8, 2) NOT NULL CHECK (hourly_rate >= 100),
  total_pay NUMERIC(8, 2) NOT NULL,
  wage_per_worker NUMERIC(8, 2) GENERATED ALWAYS AS (total_pay) STORED,
  slots_total INTEGER NOT NULL CHECK (slots_total > 0),
  slots_filled INTEGER NOT NULL DEFAULT 0 CHECK (slots_filled <= slots_total),
  dress_code TEXT,
  duties TEXT[] NOT NULL DEFAULT '{}',
  perks TEXT[] NOT NULL DEFAULT '{}',
  supervisor_name TEXT NOT NULL,
  supervisor_phone TEXT NOT NULL,
  status shift_status NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Backward compatibility view
CREATE OR REPLACE VIEW shifts AS SELECT * FROM jobs;

-- 8. JOB APPLICATIONS (Right-swipe / interest expression)
CREATE TABLE IF NOT EXISTS job_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  worker_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status application_status NOT NULL DEFAULT 'applied',
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes TEXT,
  UNIQUE(job_id, worker_id)
);

-- 9. SAVED JOBS (Worker bookmarking)
CREATE TABLE IF NOT EXISTS saved_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(worker_id, job_id)
);

-- 10. SWIPE EVENTS (Discovery feed interactions)
CREATE TABLE IF NOT EXISTS swipe_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  direction TEXT NOT NULL CHECK (direction IN ('left', 'right')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(worker_id, job_id)
);

-- 11. BOOKINGS (Explicit organizer hire confirmation)
CREATE TABLE IF NOT EXISTS bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE RESTRICT,
  worker_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  organizer_id UUID NOT NULL REFERENCES organizer_profiles(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'checked_in', 'completed', 'cancelled', 'no_show')),
  agreed_hourly_rate NUMERIC(8, 2) NOT NULL,
  agreed_total_pay NUMERIC(8, 2) NOT NULL,
  check_in_code TEXT,
  confirmed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  UNIQUE(job_id, worker_id)
);

-- 12. ATTENDANCE RECORDS (On-site check-in / check-out)
CREATE TABLE IF NOT EXISTS attendance_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE RESTRICT,
  worker_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  supervisor_id UUID REFERENCES profiles(id),
  check_in_time TIMESTAMPTZ,
  check_out_time TIMESTAMPTZ,
  hours_worked NUMERIC(4, 2),
  verified_by_supervisor BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 13. PAYMENT RECORDS (Escrow & UPI Settlement)
CREATE TABLE IF NOT EXISTS payment_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE RESTRICT,
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE RESTRICT,
  worker_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  organizer_id UUID NOT NULL REFERENCES organizer_profiles(id) ON DELETE RESTRICT,
  amount NUMERIC(8, 2) NOT NULL,
  platform_fee NUMERIC(8, 2) NOT NULL DEFAULT 0.00,
  net_payout NUMERIC(8, 2) NOT NULL,
  status payout_status NOT NULL DEFAULT 'pending',
  upi_id TEXT NOT NULL,
  utr_reference TEXT,
  escrow_locked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  settled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(booking_id)
);

-- 14. REVIEWS
CREATE TABLE IF NOT EXISTS reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  reviewer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reviewee_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(booking_id, reviewer_id, reviewee_id)
);

-- 15. NOTIFICATIONS
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  type TEXT NOT NULL,
  read BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB DEFAULT '{}',
  data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 16. DISPUTES
CREATE TABLE IF NOT EXISTS disputes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE RESTRICT,
  raised_by UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  respondent_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  reason TEXT NOT NULL,
  details TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'under_review', 'resolved', 'dismissed')),
  resolution_notes TEXT,
  resolved_by UUID REFERENCES profiles(id),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 17. VERIFICATION CASES (KYC review)
CREATE TABLE IF NOT EXISTS verification_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL CHECK (document_type IN ('aadhaar', 'pan', 'gstin', 'voter_id')),
  document_masked_id TEXT NOT NULL,
  document_storage_path TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  rejection_reason TEXT,
  reviewed_by UUID REFERENCES profiles(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 18. AUDIT LOGS
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  changes JSONB DEFAULT '{}',
  old_state JSONB DEFAULT '{}',
  new_state JSONB DEFAULT '{}',
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ==============================================================================
-- INDEXES FOR PERFORMANCE & RELATIONAL INTEGRITY
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_jobs_status_city_date ON jobs(status, city, date);
CREATE INDEX IF NOT EXISTS idx_jobs_organizer_id ON jobs(organizer_id);
CREATE INDEX IF NOT EXISTS idx_job_applications_worker_id ON job_applications(worker_id);
CREATE INDEX IF NOT EXISTS idx_job_applications_job_id ON job_applications(job_id);
CREATE INDEX IF NOT EXISTS idx_saved_jobs_worker_id ON saved_jobs(worker_id);
CREATE INDEX IF NOT EXISTS idx_bookings_worker_id ON bookings(worker_id);
CREATE INDEX IF NOT EXISTS idx_bookings_organizer_id ON bookings(organizer_id);
CREATE INDEX IF NOT EXISTS idx_bookings_job_id ON bookings(job_id);
CREATE INDEX IF NOT EXISTS idx_attendance_booking_id ON attendance_records(booking_id);
CREATE INDEX IF NOT EXISTS idx_payment_records_worker_id ON payment_records(worker_id);
CREATE INDEX IF NOT EXISTS idx_payment_records_organizer_id ON payment_records(organizer_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id) WHERE read = false;
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON audit_logs(actor_id, created_at);

-- ==============================================================================
-- DATABASE SECURITY TRIGGERS
-- ==============================================================================

-- Prevent non-admin role escalation
CREATE OR REPLACE FUNCTION prevent_role_escalation()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.role != OLD.role THEN
    IF NOT EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    ) THEN
      RAISE EXCEPTION 'Unauthorized: Users cannot change their assigned role.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_prevent_role_escalation ON profiles;
CREATE TRIGGER trg_prevent_role_escalation
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION prevent_role_escalation();

-- Auto update updated_at timestamp
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON profiles;
CREATE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_timestamp();

DROP TRIGGER IF EXISTS trg_jobs_updated_at ON jobs;
CREATE TRIGGER trg_jobs_updated_at BEFORE UPDATE ON jobs FOR EACH ROW EXECUTE FUNCTION update_timestamp();

-- ==============================================================================
-- AUTOMATED USER & PROFILE PROVISIONING
-- ==============================================================================

-- 1. Trigger function on auth.users to automatically provision profile records
CREATE OR REPLACE FUNCTION public.handle_new_user_provisioning()
RETURNS TRIGGER AS $$
DECLARE
  v_role user_role;
  v_phone TEXT;
  v_name TEXT;
  v_email TEXT;
BEGIN
  -- Determine role from raw_user_meta_data, default to 'worker'. Never allow self-service admin role.
  v_role := CASE
    WHEN (NEW.raw_user_meta_data->>'role') = 'organizer' THEN 'organizer'::user_role
    ELSE 'worker'::user_role
  END;

  v_email := NEW.email;
  v_phone := COALESCE(NEW.phone, NEW.raw_user_meta_data->>'phone');
  v_name := COALESCE(
    NEW.raw_user_meta_data->>'full_name', 
    NEW.raw_user_meta_data->>'name', 
    CASE WHEN v_email IS NOT NULL THEN split_part(v_email, '@', 1) ELSE 'User ' || substr(NEW.id::text, 1, 6) END
  );

  -- Insert core profile
  INSERT INTO public.profiles (
    id, role, phone, full_name, email, city, is_active
  ) VALUES (
    NEW.id, v_role, v_phone, v_name, v_email, 'Mumbai', true
  )
  ON CONFLICT (id) DO UPDATE SET
    email = COALESCE(EXCLUDED.email, profiles.email);

  -- Insert role-specific profile
  IF v_role = 'worker' THEN
    INSERT INTO public.worker_profiles (
      id, preferred_locality, skills, availability_status, profile_completion_status, verification_status
    ) VALUES (
      NEW.id, 'Mumbai', '{}', 'available', 'incomplete', 'unverified'
    )
    ON CONFLICT (id) DO NOTHING;
  ELSIF v_role = 'organizer' THEN
    INSERT INTO public.organizer_profiles (
      id, business_name, business_contact_phone, business_contact_email, business_type, profile_completion_status, verification_status
    ) VALUES (
      NEW.id, v_name, v_phone, v_email, 'event_agency', 'incomplete', 'unverified'
    )
    ON CONFLICT (id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Attach trigger to auth.users if auth schema is present
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'auth' AND table_name = 'users') THEN
    DROP TRIGGER IF EXISTS trg_on_auth_user_created ON auth.users;
    CREATE TRIGGER trg_on_auth_user_created
      AFTER INSERT ON auth.users
      FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_provisioning();
  END IF;
END $$;

-- 2. Authoritative RPC for idempotent onboarding profile provisioning / repair
CREATE OR REPLACE FUNCTION ensure_user_profile_provisioned_safe(
  p_role user_role DEFAULT 'worker',
  p_full_name TEXT DEFAULT NULL,
  p_phone TEXT DEFAULT NULL,
  p_email TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_existing_profile RECORD;
  v_role user_role := COALESCE(p_role, 'worker');
  v_name TEXT;
  v_phone TEXT;
  v_email TEXT;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Authentication required.');
  END IF;

  -- Disallow regular user elevating to admin
  IF v_role = 'admin' THEN
    v_role := 'worker';
  END IF;

  SELECT email INTO v_email FROM auth.users WHERE id = v_user_id;
  v_email := COALESCE(p_email, v_email);

  SELECT * INTO v_existing_profile FROM profiles WHERE id = v_user_id;

  IF FOUND THEN
    v_role := v_existing_profile.role;
    IF v_existing_profile.email IS NULL AND v_email IS NOT NULL THEN
      UPDATE profiles SET email = v_email WHERE id = v_user_id;
    END IF;
  ELSE
    v_name := COALESCE(
      p_full_name, 
      CASE WHEN v_email IS NOT NULL THEN split_part(v_email, '@', 1) ELSE 'User ' || substr(v_user_id::text, 1, 6) END
    );
    v_phone := p_phone;

    INSERT INTO profiles (id, role, phone, full_name, email, city, is_active)
    VALUES (v_user_id, v_role, v_phone, v_name, v_email, 'Mumbai', true)
    ON CONFLICT (id) DO UPDATE SET
      email = COALESCE(EXCLUDED.email, profiles.email);
  END IF;

  IF v_role = 'worker' THEN
    INSERT INTO worker_profiles (id, preferred_locality, skills, availability_status, profile_completion_status, verification_status)
    VALUES (v_user_id, 'Mumbai', '{}', 'available', 'incomplete', 'unverified')
    ON CONFLICT (id) DO NOTHING;
  ELSIF v_role = 'organizer' THEN
    INSERT INTO organizer_profiles (id, business_name, business_contact_phone, business_contact_email, business_type, profile_completion_status, verification_status)
    VALUES (v_user_id, COALESCE(p_full_name, 'Independent Organizer'), COALESCE(v_phone, ''), v_email, 'independent', 'incomplete', 'unverified')
    ON CONFLICT (id) DO NOTHING;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'user_id', v_user_id,
    'role', v_role,
    'email', v_email
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION ensure_user_profile_provisioned_safe(user_role, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION ensure_user_profile_provisioned_safe(user_role, TEXT, TEXT, TEXT) TO authenticated;

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE worker_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizer_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizer_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE swipe_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE disputes ENABLE ROW LEVEL SECURITY;
ALTER TABLE verification_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Helper function to prevent RLS infinite recursion
CREATE OR REPLACE FUNCTION is_current_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  );
$$;

-- 1. Profiles
CREATE POLICY "Users can view their own profile"
  ON profiles FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile"
  ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Admins full access to profiles"
  ON profiles FOR ALL USING (
    is_current_admin()
  );

-- 2. Worker Profiles
CREATE POLICY "Workers can view own worker profile"
  ON worker_profiles FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Workers can insert own worker profile"
  ON worker_profiles FOR INSERT WITH CHECK (
    auth.uid() = id AND EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('worker', 'admin')
    )
  );

CREATE POLICY "Workers can update own worker profile"
  ON worker_profiles FOR UPDATE USING (auth.uid() = id);

-- 3. Organizer Profiles
CREATE POLICY "Organizers view their own profile"
  ON organizer_profiles FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Organizers insert their own profile"
  ON organizer_profiles FOR INSERT WITH CHECK (
    auth.uid() = id AND EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('organizer', 'admin')
    )
  );

CREATE POLICY "Organizers update their own profile"
  ON organizer_profiles FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Public verified organizer card view"
  ON organizer_profiles FOR SELECT USING (verification_status = 'verified');

CREATE POLICY "Organizers can view applicant worker profiles"
  ON worker_profiles FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM job_applications ja
      JOIN jobs j ON j.id = ja.job_id
      WHERE ja.worker_id = worker_profiles.id AND j.organizer_id = auth.uid()
    )
  );

-- 4. Organizer Memberships
CREATE POLICY "Members view team memberships"
  ON organizer_memberships FOR SELECT USING (
    user_id = auth.uid() OR organizer_id = auth.uid()
  );

CREATE POLICY "Owners manage team memberships"
  ON organizer_memberships FOR ALL USING (organizer_id = auth.uid());

-- 5. Jobs
CREATE POLICY "Anyone authenticated can view open jobs"
  ON jobs FOR SELECT USING (status IN ('open', 'filling'));

CREATE POLICY "Organizers view all their own jobs"
  ON jobs FOR SELECT USING (organizer_id = auth.uid());

CREATE POLICY "Organizers manage their own jobs"
  ON jobs FOR ALL USING (organizer_id = auth.uid());

-- 6. Job Applications
CREATE POLICY "Workers view their own applications"
  ON job_applications FOR SELECT USING (worker_id = auth.uid());

CREATE POLICY "Workers apply to open jobs"
  ON job_applications FOR INSERT WITH CHECK (
    worker_id = auth.uid() AND status = 'applied'
  );

CREATE POLICY "Organizers view applications to their jobs"
  ON job_applications FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM jobs j
      WHERE j.id = job_applications.job_id AND j.organizer_id = auth.uid()
    )
  );

CREATE POLICY "Organizers update application status"
  ON job_applications FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM jobs j
      WHERE j.id = job_applications.job_id AND j.organizer_id = auth.uid()
    )
  );

-- 7. Saved Jobs & Swipe Events
CREATE POLICY "Workers manage saved jobs"
  ON saved_jobs FOR ALL USING (worker_id = auth.uid());

CREATE POLICY "Workers manage swipe events"
  ON swipe_events FOR ALL USING (worker_id = auth.uid());

-- 8. Bookings
CREATE POLICY "Workers view their bookings"
  ON bookings FOR SELECT USING (worker_id = auth.uid());

CREATE POLICY "Organizers view their bookings"
  ON bookings FOR SELECT USING (organizer_id = auth.uid());

CREATE POLICY "Organizers create and update bookings"
  ON bookings FOR ALL USING (organizer_id = auth.uid());

-- 9. Attendance Records
CREATE POLICY "Workers view own attendance"
  ON attendance_records FOR SELECT USING (worker_id = auth.uid());

CREATE POLICY "Organizers manage attendance for their jobs"
  ON attendance_records FOR ALL USING (
    EXISTS (
      SELECT 1 FROM jobs j
      WHERE j.id = attendance_records.job_id AND j.organizer_id = auth.uid()
    )
  );

-- 10. Payment Records
CREATE POLICY "Workers view own payments"
  ON payment_records FOR SELECT USING (worker_id = auth.uid());

CREATE POLICY "Organizers view own job payments"
  ON payment_records FOR SELECT USING (organizer_id = auth.uid());

-- 11. Reviews
CREATE POLICY "Users view reviews"
  ON reviews FOR SELECT USING (true);

CREATE POLICY "Participants create reviews"
  ON reviews FOR INSERT WITH CHECK (reviewer_id = auth.uid());

-- 12. Notifications
CREATE POLICY "Users view own notifications"
  ON notifications FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users update own notification read state"
  ON notifications FOR UPDATE USING (user_id = auth.uid());

-- 13. Disputes
CREATE POLICY "Users view disputes they are part of"
  ON disputes FOR SELECT USING (
    raised_by = auth.uid() OR respondent_id = auth.uid()
  );

CREATE POLICY "Users create disputes"
  ON disputes FOR INSERT WITH CHECK (raised_by = auth.uid());

-- 14. Verification Cases
CREATE POLICY "Users view own verification cases"
  ON verification_cases FOR SELECT USING (profile_id = auth.uid());

CREATE POLICY "Users create verification cases"
  ON verification_cases FOR INSERT WITH CHECK (profile_id = auth.uid());

-- 15. Audit Logs
CREATE POLICY "Admins view audit logs"
  ON audit_logs FOR SELECT USING (
    is_current_admin()
  );

-- 16. COLUMN-LEVEL INTEGRITY TRIGGERS (Prevent users from altering administrative/verification status)
CREATE OR REPLACE FUNCTION check_worker_profile_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF is_current_admin() THEN
    RETURN NEW;
  END IF;

  IF NEW.verification_status IS DISTINCT FROM OLD.verification_status OR
     NEW.rating IS DISTINCT FROM OLD.rating OR
     NEW.total_reviews IS DISTINCT FROM OLD.total_reviews OR
     NEW.shifts_completed IS DISTINCT FROM OLD.shifts_completed OR
     NEW.is_aadhaar_verified IS DISTINCT FROM OLD.is_aadhaar_verified OR
     NEW.is_pan_verified IS DISTINCT FROM OLD.is_pan_verified THEN
    RAISE EXCEPTION 'Unauthorized: Administrative and verification fields cannot be modified directly by workers.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_worker_profile ON worker_profiles;
CREATE TRIGGER trg_protect_worker_profile
  BEFORE UPDATE ON worker_profiles
  FOR EACH ROW
  EXECUTE FUNCTION check_worker_profile_update();

CREATE OR REPLACE FUNCTION check_organizer_profile_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF is_current_admin() THEN
    RETURN NEW;
  END IF;

  IF NEW.verification_status IS DISTINCT FROM OLD.verification_status OR
     NEW.rating IS DISTINCT FROM OLD.rating OR
     NEW.total_events_hosted IS DISTINCT FROM OLD.total_events_hosted OR
     NEW.is_gstin_verified IS DISTINCT FROM OLD.is_gstin_verified THEN
    RAISE EXCEPTION 'Unauthorized: Administrative and verification fields cannot be modified directly by organizers.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_organizer_profile ON organizer_profiles;
CREATE TRIGGER trg_protect_organizer_profile
  BEFORE UPDATE ON organizer_profiles
  FOR EACH ROW
  EXECUTE FUNCTION check_organizer_profile_update();


-- ============================================================================
-- Migration: 20261012000001_marketplace_discovery.sql
-- ============================================================================

-- ============================================================================
-- OPSKL MARKETPLACE DISCOVERY & SWIPE TRANSACTIONS (PHASE 3)
-- Enhanced shift attributes, server-side eligibility checks & atomic application RPC
-- ============================================================================

-- 1. Extend jobs table with richer discovery metadata
ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS required_skills TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS eligibility_criteria TEXT,
  ADD COLUMN IF NOT EXISTS application_deadline TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS breaks_minutes INTEGER NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS meal_provided BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS transport_provided BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS overtime_policy TEXT,
  ADD COLUMN IF NOT EXISTS latitude NUMERIC(9, 6),
  ADD COLUMN IF NOT EXISTS longitude NUMERIC(9, 6);

-- 2. Update shifts backward-compatibility view
CREATE OR REPLACE VIEW shifts AS SELECT * FROM jobs;

-- 3. Enhance RLS for organizer profiles so workers can view verified organizer info on active jobs
CREATE POLICY "Workers view organizer on active jobs"
  ON organizer_profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM jobs
      WHERE jobs.organizer_id = organizer_profiles.id
        AND jobs.status IN ('open', 'filling')
    )
  );

-- 4. Atomic RPC: Safe Application with Server-side Eligibility Validation
-- Enforces:
--  - Authenticated worker caller
--  - Job is open or filling
--  - Application deadline has not elapsed
--  - Open slots remain (slots_filled < slots_total)
--  - Worker has not already applied (prevents duplicate applications)
--  - Concurrency safety with row-level locking (SELECT ... FOR UPDATE)
CREATE OR REPLACE FUNCTION apply_for_job_safe(
  p_job_id UUID,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_worker_id UUID := auth.uid();
  v_job RECORD;
  v_existing_app RECORD;
  v_new_app RECORD;
BEGIN
  -- 1. Authentication check
  IF v_worker_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'UNAUTHENTICATED',
      'message', 'User must be authenticated to apply'
    );
  END IF;

  -- 2. Lock job row to prevent concurrent race conditions
  SELECT id, status, slots_total, slots_filled, application_deadline, date
  INTO v_job
  FROM jobs
  WHERE id = p_job_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'JOB_NOT_FOUND',
      'message', 'The requested shift listing does not exist'
    );
  END IF;

  -- 2b. Authoritative Platform Killswitch Check
  IF EXISTS (
    SELECT 1 FROM platform_settings
    WHERE key = 'booking_killswitch' AND (value->>'is_paused')::BOOLEAN = true
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'BOOKINGS_PAUSED',
      'message', 'Shift applications and bookings are temporarily paused platform-wide.'
    );
  END IF;

  -- 3. Validate status
  IF v_job.status NOT IN ('open', 'filling') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'JOB_CLOSED',
      'message', 'This shift is no longer open for applications'
    );
  END IF;

  -- 4. Validate application deadline
  IF v_job.application_deadline IS NOT NULL AND v_job.application_deadline < now() THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'DEADLINE_PASSED',
      'message', 'The application deadline for this shift has passed'
    );
  END IF;

  -- 5. Validate capacity
  IF v_job.slots_filled >= v_job.slots_total THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'SLOTS_FULL',
      'message', 'All openings for this shift have already been filled'
    );
  END IF;

  -- 6. Check for duplicate application
  SELECT id, status INTO v_existing_app
  FROM job_applications
  WHERE job_id = p_job_id AND worker_id = v_worker_id;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'ALREADY_APPLIED',
      'message', 'You have already expressed interest in this shift',
      'application_id', v_existing_app.id,
      'application_status', v_existing_app.status
    );
  END IF;

  -- 7. Insert application
  INSERT INTO job_applications (job_id, worker_id, status, notes)
  VALUES (p_job_id, v_worker_id, 'applied', p_notes)
  RETURNING id, job_id, worker_id, status, applied_at, notes
  INTO v_new_app;

  -- 8. Record right swipe event (upsert)
  INSERT INTO swipe_events (worker_id, job_id, direction)
  VALUES (v_worker_id, p_job_id, 'right')
  ON CONFLICT (worker_id, job_id)
  DO UPDATE SET direction = 'right', created_at = now();

  -- 9. Return success
  RETURN jsonb_build_object(
    'success', true,
    'application', jsonb_build_object(
      'id', v_new_app.id,
      'job_id', v_new_app.job_id,
      'worker_id', v_new_app.worker_id,
      'status', v_new_app.status,
      'applied_at', v_new_app.applied_at,
      'notes', v_new_app.notes
    )
  );
END;
$$;

-- 5. RPC: Record Left Swipe (Pass)
CREATE OR REPLACE FUNCTION record_swipe_pass(
  p_job_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_worker_id UUID := auth.uid();
BEGIN
  IF v_worker_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'UNAUTHENTICATED');
  END IF;

  INSERT INTO swipe_events (worker_id, job_id, direction)
  VALUES (v_worker_id, p_job_id, 'left')
  ON CONFLICT (worker_id, job_id)
  DO UPDATE SET direction = 'left', created_at = now();

  RETURN jsonb_build_object('success', true);
END;
$$;

-- 6. RPC: Undo Left Swipe (Skip Undo)
CREATE OR REPLACE FUNCTION undo_swipe_event(
  p_job_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_worker_id UUID := auth.uid();
BEGIN
  IF v_worker_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'UNAUTHENTICATED');
  END IF;

  DELETE FROM swipe_events
  WHERE worker_id = v_worker_id
    AND job_id = p_job_id
    AND direction = 'left';

  RETURN jsonb_build_object('success', true);
END;
$$;


-- ============================================================================
-- Migration: 20261012000002_organizer_management.sql
-- ============================================================================

-- ============================================================================
-- OPSKL ORGANIZER JOB MANAGEMENT & HIRING ENGINE (PHASE 4)
-- Multi-step shift specs, atomic booking RPCs, notifications & audit trails
-- ============================================================================

-- 1. Extend shift_status enum to support 'paused'
DO $$
BEGIN
  ALTER TYPE shift_status ADD VALUE IF NOT EXISTS 'paused';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 2. Extend jobs table with Phase 4 terms
ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS reporting_instructions TEXT,
  ADD COLUMN IF NOT EXISTS cancellation_policy TEXT DEFAULT 'Free cancellation up to 24 hours prior to shift commencement.',
  ADD COLUMN IF NOT EXISTS payment_deadline TIMESTAMPTZ;

-- 3. Update shifts view
CREATE OR REPLACE VIEW shifts AS SELECT * FROM jobs;

-- 4. Enable notification and audit log insertion policies for authorized actions
CREATE POLICY "Users insert own notifications or admins"
  ON notifications FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND (user_id = auth.uid() OR is_current_admin()));

CREATE POLICY "Authenticated actors insert own audit logs"
  ON audit_logs FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND (actor_id = auth.uid() OR is_current_admin()));

-- 5. Atomic RPC: Create Job with Server-Side Validations & Audit Log
CREATE OR REPLACE FUNCTION create_job_safe(
  p_job JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_organizer_id UUID := auth.uid();
  v_title TEXT := p_job->>'title';
  v_category shift_category := (p_job->>'category')::shift_category;
  v_venue_name TEXT := p_job->>'venue_name';
  v_venue_address TEXT := p_job->>'venue_address';
  v_landmark TEXT := p_job->>'landmark';
  v_city TEXT := COALESCE(p_job->>'city', 'Mumbai');
  v_zone TEXT := p_job->>'zone';
  v_date DATE := (p_job->>'date')::DATE;
  v_start_time TIME := (p_job->>'start_time')::TIME;
  v_end_time TIME := (p_job->>'end_time')::TIME;
  v_duration_hours NUMERIC := (p_job->>'duration_hours')::NUMERIC;
  v_hourly_rate NUMERIC := (p_job->>'hourly_rate')::NUMERIC;
  v_total_pay NUMERIC := (p_job->>'total_pay')::NUMERIC;
  v_slots_total INTEGER := (p_job->>'slots_total')::INTEGER;
  v_status shift_status := COALESCE(p_job->>'status', 'open')::shift_status;
  v_dress_code TEXT := p_job->>'dress_code';
  v_supervisor_name TEXT := p_job->>'supervisor_name';
  v_supervisor_phone TEXT := p_job->>'supervisor_phone';
  v_reporting_instructions TEXT := p_job->>'reporting_instructions';
  v_cancellation_policy TEXT := p_job->>'cancellation_policy';
  v_application_deadline TIMESTAMPTZ := (p_job->>'application_deadline')::TIMESTAMPTZ;
  v_payment_deadline TIMESTAMPTZ := (p_job->>'payment_deadline')::TIMESTAMPTZ;
  v_duties TEXT[] := ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_job->'duties', '[]'::jsonb)));
  v_required_skills TEXT[] := ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_job->'required_skills', '[]'::jsonb)));
  v_perks TEXT[] := ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_job->'perks', '[]'::jsonb)));
  v_breaks_minutes INTEGER := COALESCE((p_job->>'breaks_minutes')::INTEGER, 30);
  v_meal_provided BOOLEAN := COALESCE((p_job->>'meal_provided')::BOOLEAN, false);
  v_transport_provided BOOLEAN := COALESCE((p_job->>'transport_provided')::BOOLEAN, false);
  v_overtime_policy TEXT := p_job->>'overtime_policy';
  v_new_id UUID;
BEGIN
  -- Authentication check
  IF v_organizer_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'UNAUTHENTICATED', 'message', 'Must be authenticated');
  END IF;

  -- Organizer role authorization check
  IF NOT EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = v_organizer_id AND role IN ('organizer', 'admin')
  ) OR NOT EXISTS (
    SELECT 1 FROM organizer_profiles 
    WHERE id = v_organizer_id
  ) THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error_code', 'FORBIDDEN_ROLE', 
      'message', 'Only verified organizers can create and publish shifts.'
    );
  END IF;

  -- Server-side validation: minimum wage
  IF v_hourly_rate < 100 THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'INVALID_WAGE', 'message', 'Hourly rate must be at least ₹100/hr');
  END IF;

  -- Server-side validation: slots total
  IF v_slots_total <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'INVALID_SLOTS', 'message', 'Headcount must be at least 1 worker');
  END IF;

  -- Server-side validation: date not in the past
  IF v_date < CURRENT_DATE THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'PAST_DATE', 'message', 'Shift date cannot be in the past');
  END IF;

  -- Calculate total pay
  IF v_total_pay IS NULL OR v_total_pay <= 0 THEN
    v_total_pay := v_hourly_rate * v_duration_hours;
  END IF;

  -- Insert Job
  INSERT INTO jobs (
    organizer_id, title, category, venue_name, venue_address, landmark,
    city, zone, date, start_time, end_time, duration_hours,
    hourly_rate, total_pay, slots_total, slots_filled, dress_code,
    duties, perks, required_skills, breaks_minutes, meal_provided,
    transport_provided, overtime_policy, reporting_instructions,
    cancellation_policy, application_deadline, payment_deadline,
    supervisor_name, supervisor_phone, status
  ) VALUES (
    v_organizer_id, v_title, v_category, v_venue_name, v_venue_address, v_landmark,
    v_city, v_zone, v_date, v_start_time, v_end_time, v_duration_hours,
    v_hourly_rate, v_total_pay, v_slots_total, 0, v_dress_code,
    v_duties, v_perks, v_required_skills, v_breaks_minutes, v_meal_provided,
    v_transport_provided, v_overtime_policy, v_reporting_instructions,
    v_cancellation_policy, v_application_deadline, v_payment_deadline,
    v_supervisor_name, v_supervisor_phone, v_status
  ) RETURNING id INTO v_new_id;

  -- Insert Audit Log
  INSERT INTO audit_logs (
    actor_id, action, entity_type, entity_id, new_state
  ) VALUES (
    v_organizer_id, 'CREATE_JOB', 'job', v_new_id::TEXT,
    jsonb_build_object('title', v_title, 'slots', v_slots_total, 'rate', v_hourly_rate, 'status', v_status)
  );

  RETURN jsonb_build_object(
    'success', true,
    'job_id', v_new_id
  );
END;
$$;

-- 6. Atomic RPC: Confirm Worker Booking (Hiring Engine)
-- Enforces:
--  - Authorized organizer
--  - Never exceed headcount (slots_filled < slots_total)
--  - Concurrency safe locking
--  - Unique booking prevention
--  - Worker notification
--  - Audit log recording
CREATE OR REPLACE FUNCTION confirm_worker_booking_safe(
  p_job_id UUID,
  p_worker_id UUID,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_organizer_id UUID := auth.uid();
  v_job RECORD;
  v_app RECORD;
  v_new_booking RECORD;
  v_check_in_code TEXT;
BEGIN
  -- 1. Check authorization
  IF v_organizer_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'UNAUTHENTICATED');
  END IF;

  -- 2. Lock and validate job
  SELECT id, organizer_id, title, status, slots_total, slots_filled, hourly_rate, total_pay
  INTO v_job
  FROM jobs
  WHERE id = p_job_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'JOB_NOT_FOUND', 'message', 'Shift listing not found');
  END IF;

  -- Check organizer permission
  IF v_job.organizer_id != v_organizer_id AND NOT EXISTS (
    SELECT 1 FROM organizer_memberships WHERE organizer_id = v_job.organizer_id AND user_id = v_organizer_id
  ) THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'UNAUTHORIZED', 'message', 'Not authorized to hire for this shift');
  END IF;

  -- 3. Enforce Headcount Capacity
  IF v_job.slots_filled >= v_job.slots_total THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'HEADCOUNT_FULL',
      'message', 'Headcount limit reached. All ' || v_job.slots_total || ' openings have already been filled.'
    );
  END IF;

  -- 4. Check for duplicate booking
  IF EXISTS (SELECT 1 FROM bookings WHERE job_id = p_job_id AND worker_id = p_worker_id) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'ALREADY_BOOKED',
      'message', 'Worker is already confirmed for this shift.'
    );
  END IF;

  -- 5. Lock and update application
  SELECT id, status INTO v_app
  FROM job_applications
  WHERE job_id = p_job_id AND worker_id = p_worker_id
  FOR UPDATE;

  IF FOUND THEN
    UPDATE job_applications
    SET status = 'confirmed'
    WHERE id = v_app.id;
  ELSE
    -- If organizer directly invites/books worker who hasn't swiped yet
    INSERT INTO job_applications (job_id, worker_id, status, notes)
    VALUES (p_job_id, p_worker_id, 'confirmed', p_notes);
  END IF;

  -- 6. Generate distinct, cryptographically secure per-booking check-in credential (CSPRNG via gen_random_bytes)
  v_check_in_code := 'OP-' || upper(substr(encode(gen_random_bytes(4), 'hex'), 1, 6));

  -- Insert Booking Record with provisioned credential
  INSERT INTO bookings (
    job_id, worker_id, organizer_id, status, agreed_hourly_rate, agreed_total_pay, check_in_code
  ) VALUES (
    p_job_id, p_worker_id, v_job.organizer_id, 'confirmed', v_job.hourly_rate, v_job.total_pay, v_check_in_code
  )
  RETURNING id, job_id, worker_id, organizer_id, status, agreed_hourly_rate, agreed_total_pay, confirmed_at
  INTO v_new_booking;

  -- 7. Increment headcount and update job status if full
  UPDATE jobs
  SET
    slots_filled = slots_filled + 1,
    status = CASE WHEN slots_filled + 1 >= slots_total THEN 'filled'::shift_status ELSE status END,
    updated_at = now()
  WHERE id = p_job_id;

  -- 8. Notify Worker
  INSERT INTO notifications (
    user_id, title, body, type, data
  ) VALUES (
    p_worker_id,
    '🎉 Shift Booking Confirmed!',
    'You have been selected for ' || v_job.title || '. Tap to view your shift ticket and reporting brief.',
    'booking_confirmed',
    jsonb_build_object('job_id', p_job_id, 'booking_id', v_new_booking.id)
  );

  -- 9. Audit Log
  INSERT INTO audit_logs (
    actor_id, action, entity_type, entity_id, new_state
  ) VALUES (
    v_organizer_id, 'CONFIRM_WORKER_BOOKING', 'booking', v_new_booking.id::TEXT,
    jsonb_build_object('job_id', p_job_id, 'worker_id', p_worker_id, 'total_pay', v_job.total_pay)
  );

  RETURN jsonb_build_object(
    'success', true,
    'booking', jsonb_build_object(
      'id', v_new_booking.id,
      'job_id', v_new_booking.job_id,
      'worker_id', v_new_booking.worker_id,
      'status', v_new_booking.status,
      'agreed_hourly_rate', v_new_booking.agreed_hourly_rate,
      'agreed_total_pay', v_new_booking.agreed_total_pay,
      'confirmed_at', v_new_booking.confirmed_at
    ),
    'slots_filled', v_job.slots_filled + 1,
    'slots_total', v_job.slots_total
  );
END;
$$;

-- 7. Atomic RPC: Update Applicant Status (Shortlist / Reject)
CREATE OR REPLACE FUNCTION update_application_status_safe(
  p_application_id UUID,
  p_new_status TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_organizer_id UUID := auth.uid();
  v_app RECORD;
  v_job RECORD;
BEGIN
  IF v_organizer_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'UNAUTHENTICATED');
  END IF;

  SELECT ja.id, ja.job_id, ja.worker_id, ja.status, j.organizer_id, j.title
  INTO v_app
  FROM job_applications ja
  JOIN jobs j ON j.id = ja.job_id
  WHERE ja.id = p_application_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'APPLICATION_NOT_FOUND');
  END IF;

  IF v_app.organizer_id != v_organizer_id THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'UNAUTHORIZED');
  END IF;

  -- Update status
  UPDATE job_applications
  SET status = p_new_status::application_status
  WHERE id = p_application_id;

  -- If shortlisted, send worker a notification
  IF p_new_status = 'shortlisted' THEN
    INSERT INTO notifications (
      user_id, title, body, type, data
    ) VALUES (
      v_app.worker_id,
      '⭐ Profile Shortlisted',
      'The organizer has shortlisted you for ' || v_app.title || '. Keep your schedule open.',
      'application_shortlisted',
      jsonb_build_object('job_id', v_app.job_id)
    );
  END IF;

  -- Audit Log
  INSERT INTO audit_logs (
    actor_id, action, entity_type, entity_id, old_state, new_state
  ) VALUES (
    v_organizer_id, 'UPDATE_APPLICATION_STATUS', 'application', p_application_id::TEXT,
    jsonb_build_object('old_status', v_app.status),
    jsonb_build_object('new_status', p_new_status)
  );

  RETURN jsonb_build_object('success', true, 'status', p_new_status);
END;
$$;


-- ============================================================================
-- Migration: 20261012000003_booking_attendance_engine.sql
-- ============================================================================

-- ============================================================================
-- OPSKL BOOKING & ATTENDANCE ENGINE (PHASE 5)
-- Complete lifecycle state machine, auditable check-in/out, no-show & disputes
-- ============================================================================

-- 1. Update bookings table constraint to support full state machine
ALTER TABLE bookings
  DROP CONSTRAINT IF EXISTS bookings_status_check;

ALTER TABLE bookings
  ADD CONSTRAINT bookings_status_check CHECK (
    status IN (
      'selected_awaiting_confirmation',
      'confirmed',
      'checked_in',
      'checked_out',
      'completed_awaiting_review',
      'completed',
      'cancelled',
      'no_show',
      'disputed'
    )
  );

-- 2. Add verification token, timestamps, and audit columns to bookings
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS check_in_code TEXT,
  ADD COLUMN IF NOT EXISTS check_in_time TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS check_out_time TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancellation_reason TEXT,
  ADD COLUMN IF NOT EXISTS cancelled_by UUID REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS no_show_reason TEXT,
  ADD COLUMN IF NOT EXISTS dispute_reason TEXT;

-- 3. Extend attendance_records with location context and verification code
ALTER TABLE attendance_records
  ADD COLUMN IF NOT EXISTS check_in_code TEXT,
  ADD COLUMN IF NOT EXISTS latitude NUMERIC(9, 6),
  ADD COLUMN IF NOT EXISTS longitude NUMERIC(9, 6),
  ADD COLUMN IF NOT EXISTS distance_to_venue_km NUMERIC(5, 2);

-- 4. State Machine Transition Validator Helper
CREATE OR REPLACE FUNCTION validate_booking_transition(
  p_current_status TEXT,
  p_new_status TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  -- Matrix of valid state transitions:
  -- selected_awaiting_confirmation -> confirmed, cancelled
  -- confirmed -> checked_in, cancelled, no_show
  -- checked_in -> checked_out, disputed
  -- checked_out -> completed_awaiting_review, completed, disputed
  -- completed_awaiting_review -> completed, disputed
  -- completed -> disputed
  -- no_show -> disputed
  IF p_current_status = 'selected_awaiting_confirmation' AND p_new_status IN ('confirmed', 'cancelled') THEN
    RETURN true;
  ELSIF p_current_status = 'confirmed' AND p_new_status IN ('checked_in', 'cancelled', 'no_show') THEN
    RETURN true;
  ELSIF p_current_status = 'checked_in' AND p_new_status IN ('checked_out', 'disputed') THEN
    RETURN true;
  ELSIF p_current_status = 'checked_out' AND p_new_status IN ('completed_awaiting_review', 'completed', 'disputed') THEN
    RETURN true;
  ELSIF p_current_status = 'completed_awaiting_review' AND p_new_status IN ('completed', 'disputed') THEN
    RETURN true;
  ELSIF p_current_status = 'completed' AND p_new_status = 'disputed' THEN
    RETURN true;
  ELSIF p_current_status = 'no_show' AND p_new_status = 'disputed' THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

-- 5. Atomic RPC: Check-in Worker (Auditable Venue Code or Supervisor Verification)
CREATE OR REPLACE FUNCTION check_in_worker_safe(
  p_booking_id UUID,
  p_code TEXT,
  p_lat NUMERIC DEFAULT NULL,
  p_lng NUMERIC DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_booking RECORD;
  v_job RECORD;
  v_distance NUMERIC := NULL;
  v_is_supervisor BOOLEAN := false;
BEGIN
  -- 0. Authentication requirement
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'UNAUTHENTICATED', 'message', 'Authentication required.');
  END IF;

  -- 1. Lock and validate booking
  SELECT * INTO v_booking
  FROM bookings
  WHERE id = p_booking_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'BOOKING_NOT_FOUND', 'message', 'Booking record not found');
  END IF;

  -- 2. State machine validation
  IF NOT validate_booking_transition(v_booking.status, 'checked_in') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'INVALID_TRANSITION',
      'message', 'Cannot check in. Current booking status is ' || v_booking.status
    );
  END IF;

  -- 3. Lock job
  SELECT * INTO v_job FROM jobs WHERE id = v_booking.job_id;

  -- 4. Authorization & code verification:
  IF v_user_id != v_booking.worker_id AND v_user_id != v_booking.organizer_id AND NOT is_current_admin() THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'UNAUTHORIZED', 'message', 'Not authorized for this booking');
  END IF;

  v_is_supervisor := (v_user_id = v_booking.organizer_id OR is_current_admin());

  -- Require a valid check-in code
  IF p_code IS NULL OR length(trim(p_code)) < 4 THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'INVALID_CODE', 'message', 'A valid 4-6 digit shift check-in PIN or QR code is required.');
  END IF;

  -- For worker self-check-in, require provisioned credential and exact match
  IF NOT v_is_supervisor THEN
    IF v_booking.check_in_code IS NULL THEN
      RETURN jsonb_build_object(
        'success', false,
        'error_code', 'CHECK_IN_CREDENTIAL_NOT_PROVISIONED',
        'message', 'Check-in credential has not been provisioned for this booking.'
      );
    END IF;

    IF upper(trim(p_code)) != upper(trim(v_booking.check_in_code)) THEN
      RETURN jsonb_build_object(
        'success', false,
        'error_code', 'INVALID_CHECK_IN_CODE',
        'message', 'Check-in code does not match the shift ticket credential.'
      );
    END IF;
  END IF;

  -- 5. Calculate GPS distance if coordinates provided and enforce geofence boundary
  IF p_lat IS NOT NULL AND p_lng IS NOT NULL AND v_job.latitude IS NOT NULL AND v_job.longitude IS NOT NULL THEN
    v_distance := round(
      (6371 * acos(
        least(1.0, greatest(-1.0,
          cos(radians(p_lat)) * cos(radians(v_job.latitude)) *
          cos(radians(v_job.longitude) - radians(p_lng)) +
          sin(radians(p_lat)) * sin(radians(v_job.latitude))
        ))
      ))::numeric, 2
    );

    -- Enforce geofence boundary for worker self check-in (maximum 5.0 km radius)
    IF NOT v_is_supervisor AND v_distance > 5.0 THEN
      RETURN jsonb_build_object(
        'success', false,
        'error_code', 'OUT_OF_GEOFENCE_RANGE',
        'message', 'Check-in location is outside the venue geofence boundary (' || v_distance || ' km away, max 5.0 km allowed).'
      );
    END IF;
  END IF;

  -- 6. Transition status
  UPDATE bookings
  SET
    status = 'checked_in',
    check_in_time = now()
  WHERE id = p_booking_id;

  -- 7. Insert or update attendance record (verified_by_supervisor only true if supervisor checked in or verified)
  INSERT INTO attendance_records (
    booking_id, job_id, worker_id, supervisor_id,
    check_in_time, check_in_code, verified_by_supervisor,
    latitude, longitude, distance_to_venue_km
  ) VALUES (
    p_booking_id, v_booking.job_id, v_booking.worker_id, v_booking.organizer_id,
    now(), p_code, v_is_supervisor,
    p_lat, p_lng, v_distance
  );

  -- 8. Notify organizer
  INSERT INTO notifications (
    user_id, title, body, type, data
  ) VALUES (
    v_booking.organizer_id,
    '📍 Worker Checked In',
    'Worker has checked in on-site for ' || v_job.title,
    'worker_checked_in',
    jsonb_build_object('booking_id', p_booking_id, 'job_id', v_job.id)
  );

  -- 9. Audit log
  INSERT INTO audit_logs (
    actor_id, action, entity_type, entity_id, old_state, new_state
  ) VALUES (
    v_user_id, 'CHECK_IN_WORKER', 'booking', p_booking_id::TEXT,
    jsonb_build_object('status', v_booking.status),
    jsonb_build_object('status', 'checked_in', 'distance_km', v_distance, 'supervisor_verified', v_is_supervisor)
  );

  RETURN jsonb_build_object(
    'success', true,
    'status', 'checked_in',
    'check_in_time', now(),
    'distance_km', v_distance,
    'verified_by_supervisor', v_is_supervisor
  );
END;
$$;

-- 6. Atomic RPC: Check-out Worker
CREATE OR REPLACE FUNCTION check_out_worker_safe(
  p_booking_id UUID,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_booking RECORD;
  v_job RECORD;
  v_hours NUMERIC;
BEGIN
  -- 0. Authentication requirement
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'UNAUTHENTICATED', 'message', 'Authentication required.');
  END IF;

  SELECT * INTO v_booking FROM bookings WHERE id = p_booking_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'BOOKING_NOT_FOUND', 'message', 'Booking record not found');
  END IF;

  -- Caller must be worker, organizer, or admin
  IF v_user_id != v_booking.worker_id AND v_user_id != v_booking.organizer_id AND NOT is_current_admin() THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'UNAUTHORIZED', 'message', 'Not authorized for this booking.');
  END IF;

  IF NOT validate_booking_transition(v_booking.status, 'checked_out') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'INVALID_TRANSITION',
      'message', 'Cannot check out. Current status is ' || v_booking.status
    );
  END IF;

  SELECT * INTO v_job FROM jobs WHERE id = v_booking.job_id;

  -- Calculate hours worked
  v_hours := round(extract(epoch FROM (now() - COALESCE(v_booking.check_in_time, now()))) / 3600.0, 2);

  UPDATE bookings
  SET
    status = 'completed_awaiting_review',
    check_out_time = now()
  WHERE id = p_booking_id;

  UPDATE attendance_records
  SET
    check_out_time = now(),
    hours_worked = v_hours,
    notes = p_notes
  WHERE booking_id = p_booking_id;

  -- Audit log
  INSERT INTO audit_logs (
    actor_id, action, entity_type, entity_id, old_state, new_state
  ) VALUES (
    v_user_id, 'CHECK_OUT_WORKER', 'booking', p_booking_id::TEXT,
    jsonb_build_object('status', v_booking.status),
    jsonb_build_object('status', 'completed_awaiting_review', 'hours_worked', v_hours)
  );

  RETURN jsonb_build_object(
    'success', true,
    'status', 'completed_awaiting_review',
    'check_out_time', now(),
    'hours_worked', v_hours
  );
END;
$$;

-- 7. Atomic RPC: Approve Attendance & Complete Shift
CREATE OR REPLACE FUNCTION complete_shift_and_approve_attendance(
  p_booking_id UUID,
  p_verified_hours NUMERIC DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_organizer_id UUID := auth.uid();
  v_booking RECORD;
  v_job RECORD;
BEGIN
  IF v_organizer_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'UNAUTHENTICATED', 'message', 'Authentication required.');
  END IF;

  SELECT * INTO v_booking FROM bookings WHERE id = p_booking_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'BOOKING_NOT_FOUND', 'message', 'Booking not found');
  END IF;

  IF v_booking.organizer_id != v_organizer_id AND NOT is_current_admin() THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'UNAUTHORIZED', 'message', 'Only the shift organizer or administrator can approve attendance.');
  END IF;

  IF NOT validate_booking_transition(v_booking.status, 'completed') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'INVALID_TRANSITION',
      'message', 'Cannot approve completion from status ' || v_booking.status
    );
  END IF;

  SELECT * INTO v_job FROM jobs WHERE id = v_booking.job_id;

  UPDATE bookings
  SET
    status = 'completed',
    completed_at = now()
  WHERE id = p_booking_id;

  UPDATE attendance_records
  SET
    verified_by_supervisor = true,
    hours_worked = COALESCE(p_verified_hours, hours_worked, v_job.duration_hours)
  WHERE booking_id = p_booking_id;

  -- Increment worker's completed shifts count
  UPDATE worker_profiles
  SET
    shifts_completed = shifts_completed + 1,
    updated_at = now()
  WHERE id = v_booking.worker_id;

  -- Notify worker of payment initiation
  INSERT INTO notifications (
    user_id, title, body, type, data
  ) VALUES (
    v_booking.worker_id,
    '💰 Attendance Approved & Payment Initiated!',
    'Your attendance for ' || v_job.title || ' has been approved. Payout of ₹' || v_booking.agreed_total_pay || ' initiated via direct UPI.',
    'payment_initiated',
    jsonb_build_object('booking_id', p_booking_id, 'amount', v_booking.agreed_total_pay)
  );

  -- Audit log
  INSERT INTO audit_logs (
    actor_id, action, entity_type, entity_id, new_state
  ) VALUES (
    v_organizer_id, 'APPROVE_ATTENDANCE', 'booking', p_booking_id::TEXT,
    jsonb_build_object('status', 'completed', 'total_pay', v_booking.agreed_total_pay)
  );

  RETURN jsonb_build_object(
    'success', true,
    'status', 'completed',
    'completed_at', now()
  );
END;
$$;

-- 8. Atomic RPC: Cancel Booking with Standby Candidate Notification
CREATE OR REPLACE FUNCTION cancel_booking_safe(
  p_booking_id UUID,
  p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_booking RECORD;
  v_job RECORD;
  v_standby RECORD;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'UNAUTHENTICATED', 'message', 'Authentication required.');
  END IF;

  SELECT * INTO v_booking FROM bookings WHERE id = p_booking_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'BOOKING_NOT_FOUND', 'message', 'Booking not found');
  END IF;

  IF v_user_id != v_booking.worker_id AND v_user_id != v_booking.organizer_id AND NOT is_current_admin() THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'UNAUTHORIZED', 'message', 'Not authorized to cancel this booking.');
  END IF;

  IF NOT validate_booking_transition(v_booking.status, 'cancelled') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'INVALID_TRANSITION',
      'message', 'Cannot cancel shift once in status ' || v_booking.status
    );
  END IF;

  SELECT * INTO v_job FROM jobs WHERE id = v_booking.job_id FOR UPDATE;

  -- Update booking
  UPDATE bookings
  SET
    status = 'cancelled',
    cancellation_reason = p_reason,
    cancelled_by = v_user_id
  WHERE id = p_booking_id;

  -- Update application
  UPDATE job_applications
  SET status = 'withdrawn'
  WHERE job_id = v_booking.job_id AND worker_id = v_booking.worker_id;

  -- Decrement headcount & reopen slot
  UPDATE jobs
  SET
    slots_filled = GREATEST(0, slots_filled - 1),
    status = 'open',
    updated_at = now()
  WHERE id = v_booking.job_id;

  -- Replacement workflow: notify shortlisted workers that a spot is now available
  FOR v_standby IN
    SELECT worker_id FROM job_applications
    WHERE job_id = v_booking.job_id AND status = 'shortlisted'
  LOOP
    INSERT INTO notifications (
      user_id, title, body, type, data
    ) VALUES (
      v_standby.worker_id,
      '⚡ Immediate Opening Available!',
      'A confirmed spot just opened up for ' || v_job.title || '. Check your schedule.',
      'standby_opening',
      jsonb_build_object('job_id', v_job.id)
    );
  END LOOP;

  -- Notify the other party
  IF v_user_id = v_booking.worker_id THEN
    INSERT INTO notifications (
      user_id, title, body, type, data
    ) VALUES (
      v_booking.organizer_id,
      '⚠️ Worker Cancelled Shift Booking',
      'Worker has cancelled their confirmed booking for ' || v_job.title || '. Slot reopened.',
      'booking_cancelled',
      jsonb_build_object('job_id', v_job.id, 'booking_id', p_booking_id)
    );
  ELSE
    INSERT INTO notifications (
      user_id, title, body, type, data
    ) VALUES (
      v_booking.worker_id,
      'Shift Booking Cancelled by Organizer',
      'Your booking for ' || v_job.title || ' has been cancelled: ' || p_reason,
      'booking_cancelled',
      jsonb_build_object('job_id', v_job.id, 'booking_id', p_booking_id)
    );
  END IF;

  -- Audit log
  INSERT INTO audit_logs (
    actor_id, action, entity_type, entity_id, new_state
  ) VALUES (
    v_user_id, 'CANCEL_BOOKING', 'booking', p_booking_id::TEXT,
    jsonb_build_object('reason', p_reason, 'cancelled_by', v_user_id)
  );

  RETURN jsonb_build_object('success', true, 'status', 'cancelled');
END;
$$;

-- 9. Atomic RPC: Record No-Show (Reviewable Process)
CREATE OR REPLACE FUNCTION record_no_show_safe(
  p_booking_id UUID,
  p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_organizer_id UUID := auth.uid();
  v_booking RECORD;
  v_job RECORD;
BEGIN
  SELECT * INTO v_booking FROM bookings WHERE id = p_booking_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'BOOKING_NOT_FOUND');
  END IF;

  IF v_organizer_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'UNAUTHENTICATED', 'message', 'Authentication required.');
  END IF;

  IF v_booking.organizer_id != v_organizer_id AND NOT is_current_admin() THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'UNAUTHORIZED', 'message', 'Not authorized to record no-show.');
  END IF;

  IF NOT validate_booking_transition(v_booking.status, 'no_show') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'INVALID_TRANSITION',
      'message', 'Cannot mark no-show from status ' || v_booking.status
    );
  END IF;

  SELECT * INTO v_job FROM jobs WHERE id = v_booking.job_id FOR UPDATE;

  -- Mark no-show
  UPDATE bookings
  SET
    status = 'no_show',
    no_show_reason = p_reason
  WHERE id = p_booking_id;

  -- Release slot back for immediate standby
  UPDATE jobs
  SET
    slots_filled = GREATEST(0, slots_filled - 1),
    status = 'open'
  WHERE id = v_booking.job_id;

  -- Notify worker with option to dispute
  INSERT INTO notifications (
    user_id, title, body, type, data
  ) VALUES (
    v_booking.worker_id,
    '⚠️ Marked as No-Show',
    'You were marked as no-show for ' || v_job.title || '. Reason: ' || p_reason || '. If this is an error, submit a dispute.',
    'no_show_recorded',
    jsonb_build_object('booking_id', p_booking_id, 'job_id', v_job.id)
  );

  -- Audit log
  INSERT INTO audit_logs (
    actor_id, action, entity_type, entity_id, new_state
  ) VALUES (
    v_organizer_id, 'RECORD_NO_SHOW', 'booking', p_booking_id::TEXT,
    jsonb_build_object('reason', p_reason)
  );

  RETURN jsonb_build_object('success', true, 'status', 'no_show');
END;
$$;

-- 10. Atomic RPC: Dispute Booking Record
CREATE OR REPLACE FUNCTION dispute_booking_safe(
  p_booking_id UUID,
  p_reason TEXT,
  p_evidence TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_booking RECORD;
  v_respondent_id UUID;
  v_dispute_id UUID;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'UNAUTHENTICATED');
  END IF;

  SELECT * INTO v_booking FROM bookings WHERE id = p_booking_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'BOOKING_NOT_FOUND');
  END IF;

  IF v_user_id != v_booking.worker_id AND v_user_id != v_booking.organizer_id AND NOT is_current_admin() THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'UNAUTHORIZED');
  END IF;

  IF NOT validate_booking_transition(v_booking.status, 'disputed') THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'INVALID_TRANSITION');
  END IF;

  v_respondent_id := CASE WHEN v_user_id = v_booking.worker_id THEN v_booking.organizer_id ELSE v_booking.worker_id END;

  UPDATE bookings
  SET
    status = 'disputed',
    dispute_reason = p_reason
  WHERE id = p_booking_id;

  -- Insert into disputes table for admin investigation
  INSERT INTO disputes (
    booking_id, raised_by, respondent_id, reason, status
  ) VALUES (
    p_booking_id, v_user_id, v_respondent_id, p_reason, 'open'
  ) RETURNING id INTO v_dispute_id;

  -- Notify respondent
  INSERT INTO notifications (
    user_id, title, body, type, data
  ) VALUES (
    v_respondent_id,
    '⚖️ Booking Record Disputed',
    'A dispute has been opened regarding your shift booking. An Opskl Admin will arbitrate.',
    'dispute_opened',
    jsonb_build_object('dispute_id', v_dispute_id, 'booking_id', p_booking_id)
  );

  -- Audit log
  INSERT INTO audit_logs (
    actor_id, action, entity_type, entity_id, new_state
  ) VALUES (
    v_user_id, 'DISPUTE_BOOKING', 'dispute', v_dispute_id::TEXT,
    jsonb_build_object('booking_id', p_booking_id, 'reason', p_reason)
  );

  RETURN jsonb_build_object('success', true, 'status', 'disputed', 'dispute_id', v_dispute_id);
END;
$$;

-- 11. RESTRICT RPC EXECUTION PRIVILEGES
REVOKE EXECUTE ON FUNCTION check_in_worker_safe(UUID, TEXT, NUMERIC, NUMERIC) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION check_in_worker_safe(UUID, TEXT, NUMERIC, NUMERIC) TO authenticated;

REVOKE EXECUTE ON FUNCTION check_out_worker_safe(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION check_out_worker_safe(UUID, TEXT) TO authenticated;

REVOKE EXECUTE ON FUNCTION complete_shift_and_approve_attendance(UUID, NUMERIC) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION complete_shift_and_approve_attendance(UUID, NUMERIC) TO authenticated;

REVOKE EXECUTE ON FUNCTION cancel_booking_safe(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION cancel_booking_safe(UUID, TEXT) TO authenticated;

REVOKE EXECUTE ON FUNCTION record_no_show_safe(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION record_no_show_safe(UUID, TEXT) TO authenticated;

REVOKE EXECUTE ON FUNCTION dispute_booking_safe(UUID, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION dispute_booking_safe(UUID, TEXT, TEXT) TO authenticated;



-- ============================================================================
-- Migration: 20261012000004_payments_and_earnings.sql
-- ============================================================================

-- ============================================================================
-- OPSKL PAYMENTS & EARNINGS ENGINE (PHASE 6)
-- Authoritative financial records, Indian payment provider abstraction,
-- organizer billing with GST, worker earnings, idempotent webhooks & audit logs
-- ============================================================================

-- 1. EXTEND PAYMENT RECORDS WITH IDEMPOTENCY & PROVIDER AUDITING
ALTER TABLE payment_records
  ADD COLUMN IF NOT EXISTS failure_reason TEXT,
  ADD COLUMN IF NOT EXISTS retry_count INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS provider_payout_id TEXT,
  ADD COLUMN IF NOT EXISTS is_sandbox BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS last_webhook_event_id TEXT;

-- 2. ORGANIZER INVOICES & STATEMENTS
-- Keeps agreed worker wages strictly isolated from platform fees & GST
CREATE TABLE IF NOT EXISTS organizer_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number TEXT UNIQUE NOT NULL,
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE RESTRICT,
  organizer_id UUID NOT NULL REFERENCES organizer_profiles(id) ON DELETE RESTRICT,
  wage_total NUMERIC(10, 2) NOT NULL CHECK (wage_total >= 0),
  platform_fee NUMERIC(10, 2) NOT NULL CHECK (platform_fee >= 0),
  gst_rate NUMERIC(5, 2) NOT NULL DEFAULT 18.00,
  gst_amount NUMERIC(10, 2) NOT NULL CHECK (gst_amount >= 0),
  total_payable NUMERIC(10, 2) NOT NULL CHECK (total_payable >= 0),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('draft', 'pending', 'escrow_funded', 'settled', 'overdue', 'cancelled')),
  payment_method TEXT DEFAULT 'upi' CHECK (payment_method IN ('upi', 'netbanking', 'neft_rtgs', 'corporate_card', 'sandbox_mock')),
  payment_provider TEXT NOT NULL DEFAULT 'razorpay' CHECK (payment_provider IN ('razorpay', 'cashfree', 'sandbox', 'manual_reconciliation')),
  provider_order_id TEXT,
  provider_payment_id TEXT,
  provider_signature TEXT,
  idempotency_key TEXT UNIQUE,
  due_date TIMESTAMPTZ NOT NULL,
  paid_at TIMESTAMPTZ,
  is_sandbox BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. PAYMENT WEBHOOK EVENTS (Idempotent processing log)
CREATE TABLE IF NOT EXISTS payment_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL CHECK (provider IN ('razorpay', 'cashfree', 'sandbox')),
  event_id TEXT UNIQUE NOT NULL,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processed', 'failed', 'duplicate')),
  error_message TEXT,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. RECONCILIATION & AUDIT LOGS
CREATE TABLE IF NOT EXISTS payment_reconciliation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reconciliation_type TEXT NOT NULL CHECK (reconciliation_type IN ('payout', 'invoice_collection', 'refund', 'reversal', 'dispute_hold')),
  reference_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('matched', 'discrepancy', 'resolved', 'reversed')),
  expected_amount NUMERIC(10, 2) NOT NULL,
  recorded_amount NUMERIC(10, 2) NOT NULL,
  discrepancy_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  notes TEXT,
  actor_id UUID REFERENCES profiles(id),
  is_sandbox BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. INDEXES FOR HIGH-THROUGHPUT AUDITING
CREATE INDEX IF NOT EXISTS idx_organizer_invoices_organizer_id ON organizer_invoices(organizer_id);
CREATE INDEX IF NOT EXISTS idx_organizer_invoices_job_id ON organizer_invoices(job_id);
CREATE INDEX IF NOT EXISTS idx_organizer_invoices_status ON organizer_invoices(status);
CREATE INDEX IF NOT EXISTS idx_payment_records_status ON payment_records(status);
CREATE INDEX IF NOT EXISTS idx_payment_webhook_events_event_id ON payment_webhook_events(event_id);
CREATE INDEX IF NOT EXISTS idx_reconciliation_logs_ref ON payment_reconciliation_logs(reference_id);

-- 6. ENABLE ROW-LEVEL SECURITY
ALTER TABLE organizer_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_reconciliation_logs ENABLE ROW LEVEL SECURITY;

-- 7. RLS POLICIES FOR INVOICES
CREATE POLICY "Organizers can view their own shift invoices"
  ON organizer_invoices FOR SELECT
  USING (
    organizer_id = auth.uid() OR is_current_admin()
  );

CREATE POLICY "Admins can manage all invoices"
  ON organizer_invoices FOR ALL
  USING (
    is_current_admin()
  );

-- 8. RLS POLICIES FOR WEBHOOK EVENTS & RECONCILIATION
CREATE POLICY "Admins can view and manage webhook events"
  ON payment_webhook_events FOR ALL
  USING (
    is_current_admin()
  );

CREATE POLICY "Admins can view and manage reconciliation logs"
  ON payment_reconciliation_logs FOR ALL
  USING (
    is_current_admin()
  );

CREATE POLICY "Organizers can view own invoice reconciliation logs"
  ON payment_reconciliation_logs FOR SELECT
  USING (
    is_current_admin() OR EXISTS (
      SELECT 1 FROM organizer_invoices
      WHERE organizer_invoices.invoice_number = payment_reconciliation_logs.reference_id
        AND organizer_invoices.organizer_id = auth.uid()
    )
  );

-- 9. RPC: SERVER-SIDE AUTHORITATIVE FINANCIAL CALCULATOR
CREATE OR REPLACE FUNCTION calculate_shift_financials_safe(
  p_job_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job RECORD;
  v_headcount INT;
  v_wage_per_worker NUMERIC(10, 2);
  v_wage_total NUMERIC(10, 2);
  v_platform_fee NUMERIC(10, 2);
  v_gst_rate NUMERIC(5, 2) := 18.00;
  v_gst_amount NUMERIC(10, 2);
  v_total_payable NUMERIC(10, 2);
BEGIN
  -- Read actual columns defined on the jobs table
  SELECT id, total_pay, hourly_rate, duration_hours, slots_filled, slots_total
  INTO v_job
  FROM jobs
  WHERE id = p_job_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Job not found');
  END IF;

  -- Headcount is slots_filled if > 0, else total requested slots (never truncating unstaffed shifts to 1)
  v_headcount := CASE
    WHEN v_job.slots_filled > 0 THEN v_job.slots_filled
    ELSE GREATEST(v_job.slots_total, 1)
  END;

  -- Canonical wage per worker: total_pay or hourly_rate * duration_hours
  v_wage_per_worker := COALESCE(v_job.total_pay, ROUND(v_job.hourly_rate * v_job.duration_hours, 2));
  
  -- 100% of agreed wage belongs strictly to workers
  v_wage_total := ROUND(v_wage_per_worker * v_headcount, 2);
  
  -- Platform service fee is 10% charged to the organizer (never deducted from worker pay)
  v_platform_fee := ROUND(v_wage_total * 0.10, 2);
  
  -- Indian GST (18%) is applied strictly to the platform service fee (Intermediary service)
  v_gst_amount := ROUND(v_platform_fee * (v_gst_rate / 100.0), 2);
  
  -- Total payable by organizer
  v_total_payable := v_wage_total + v_platform_fee + v_gst_amount;

  RETURN jsonb_build_object(
    'success', true,
    'job_id', p_job_id,
    'headcount', v_headcount,
    'wage_per_worker', v_wage_per_worker,
    'wage_total', v_wage_total,
    'platform_fee', v_platform_fee,
    'gst_rate', v_gst_rate,
    'gst_amount', v_gst_amount,
    'total_payable', v_total_payable
  );
END;
$$;

-- 10. RPC: GENERATE OR UPDATE AUTHORITATIVE SHIFT INVOICE
CREATE OR REPLACE FUNCTION generate_job_invoice_safe(
  p_job_id UUID,
  p_organizer_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job RECORD;
  v_calc JSONB;
  v_invoice_number TEXT;
  v_invoice_id UUID;
  v_existing_id UUID;
  v_due_date TIMESTAMPTZ;
BEGIN
  -- 0. Authorization guard & derive organizer identity from job record
  SELECT id, organizer_id INTO v_job
  FROM jobs
  WHERE id = p_job_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Job not found');
  END IF;

  IF auth.uid() IS NULL OR (v_job.organizer_id != auth.uid() AND NOT is_current_admin()) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized. Only the job organizer or administrator can generate invoices.');
  END IF;

  -- Authoritative server calculation
  v_calc := calculate_shift_financials_safe(p_job_id);
  IF NOT (v_calc->>'success')::BOOLEAN THEN
    RETURN v_calc;
  END IF;

  -- 7 days before event or 24h from now
  v_due_date := now() + interval '3 days';

  -- Check existing invoice for job
  SELECT id INTO v_existing_id
  FROM organizer_invoices
  WHERE job_id = p_job_id;

  IF v_existing_id IS NOT NULL THEN
    UPDATE organizer_invoices
    SET
      wage_total = (v_calc->>'wage_total')::NUMERIC,
      platform_fee = (v_calc->>'platform_fee')::NUMERIC,
      gst_amount = (v_calc->>'gst_amount')::NUMERIC,
      total_payable = (v_calc->>'total_payable')::NUMERIC,
      updated_at = now()
    WHERE id = v_existing_id
    RETURNING id INTO v_invoice_id;

    RETURN jsonb_build_object(
      'success', true,
      'invoice_id', v_invoice_id,
      'status', 'updated',
      'total_payable', (v_calc->>'total_payable')::NUMERIC
    );
  END IF;

  -- Generate sequential invoice code
  v_invoice_number := 'INV-' || TO_CHAR(now(), 'YYYYMM') || '-' || LPAD(FLOOR(RANDOM() * 90000 + 10000)::TEXT, 5, '0');

  INSERT INTO organizer_invoices (
    invoice_number,
    job_id,
    organizer_id,
    wage_total,
    platform_fee,
    gst_rate,
    gst_amount,
    total_payable,
    status,
    payment_method,
    payment_provider,
    due_date,
    is_sandbox
  ) VALUES (
    v_invoice_number,
    p_job_id,
    v_job.organizer_id,
    (v_calc->>'wage_total')::NUMERIC,
    (v_calc->>'platform_fee')::NUMERIC,
    18.00,
    (v_calc->>'gst_amount')::NUMERIC,
    (v_calc->>'total_payable')::NUMERIC,
    'pending',
    'upi',
    'razorpay',
    v_due_date,
    true
  )
  RETURNING id INTO v_invoice_id;

  -- Audit log
  INSERT INTO audit_logs (action, entity_type, entity_id, changes)
  VALUES (
    'invoice_generated',
    'organizer_invoices',
    v_invoice_id,
    jsonb_build_object('invoice_number', v_invoice_number, 'total_payable', (v_calc->>'total_payable')::NUMERIC)
  );

  RETURN jsonb_build_object(
    'success', true,
    'invoice_id', v_invoice_id,
    'invoice_number', v_invoice_number,
    'status', 'created',
    'total_payable', (v_calc->>'total_payable')::NUMERIC
  );
END;
$$;

-- 11. RPC: IDEMPOTENT WEBHOOK PROCESSOR (WITH RECONCILIATION)
CREATE OR REPLACE FUNCTION process_payment_webhook_safe(
  p_provider TEXT,
  p_event_id TEXT,
  p_event_type TEXT,
  p_payload JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing_event RECORD;
  v_record_id UUID;
  v_order_id TEXT;
  v_payment_id TEXT;
  v_amount NUMERIC(10, 2);
  v_invoice RECORD;
  v_payout RECORD;
BEGIN
  -- 1. Idempotency Check: prevent duplicate event processing
  SELECT id, status INTO v_existing_event
  FROM payment_webhook_events
  WHERE event_id = p_event_id;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'success', true,
      'duplicate', true,
      'event_id', p_event_id,
      'status', v_existing_event.status,
      'message', 'Event already recorded and processed'
    );
  END IF;

  -- 2. Record new webhook event
  INSERT INTO payment_webhook_events (
    provider,
    event_id,
    event_type,
    payload,
    status
  ) VALUES (
    p_provider,
    p_event_id,
    p_event_type,
    p_payload,
    'pending'
  );

  -- 3. Process according to event type
  IF p_event_type IN ('order.paid', 'payment.captured', 'invoice.paid') THEN
    v_order_id := p_payload->>'order_id';
    v_payment_id := p_payload->>'payment_id';
    v_amount := COALESCE((p_payload->>'amount')::NUMERIC, 0.00);

    -- Find matching invoice
    SELECT * INTO v_invoice
    FROM organizer_invoices
    WHERE provider_order_id = v_order_id OR id::TEXT = (p_payload->>'invoice_id');

    IF FOUND THEN
      -- Validate exact amount match: recorded amount must match expected payable amount exactly
      IF v_amount != v_invoice.total_payable THEN
        INSERT INTO payment_reconciliation_logs (
          reconciliation_type,
          reference_id,
          status,
          expected_amount,
          recorded_amount,
          discrepancy_amount,
          notes
        ) VALUES (
          'invoice_collection',
          v_invoice.invoice_number,
          'discrepancy',
          v_invoice.total_payable,
          v_amount,
          abs(v_invoice.total_payable - v_amount),
          'Amount mismatch detected via webhook: expected ₹' || v_invoice.total_payable || ', received ₹' || v_amount
        );

        UPDATE payment_webhook_events
        SET status = 'discrepancy'
        WHERE event_id = p_event_id;

        RETURN jsonb_build_object(
          'success', false,
          'error', 'Payment amount mismatch detected',
          'expected', v_invoice.total_payable,
          'received', v_amount
        );
      END IF;

      -- Update invoice to escrow_funded
      UPDATE organizer_invoices
      SET
        status = 'escrow_funded',
        provider_payment_id = v_payment_id,
        paid_at = now(),
        updated_at = now()
      WHERE id = v_invoice.id;

      -- Log matched reconciliation
      INSERT INTO payment_reconciliation_logs (
        reconciliation_type,
        reference_id,
        status,
        expected_amount,
        recorded_amount,
        discrepancy_amount,
        notes
      ) VALUES (
        'invoice_collection',
        v_invoice.invoice_number,
        'matched',
        v_invoice.total_payable,
        v_amount,
        0.00,
        'Full shift escrow locked via provider webhook'
      );
    END IF;

  ELSIF p_event_type = 'payout.processed' THEN
    -- Payout to worker succeeded
    v_record_id := (p_payload->>'payment_record_id')::UUID;
    v_amount := COALESCE((p_payload->>'amount')::NUMERIC, 0.00);
    
    SELECT * INTO v_payout
    FROM payment_records
    WHERE id = v_record_id;

    IF FOUND THEN
      -- Validate exact payout amount match
      IF v_amount != v_payout.net_payout THEN
        INSERT INTO payment_reconciliation_logs (
          reconciliation_type,
          reference_id,
          status,
          expected_amount,
          recorded_amount,
          discrepancy_amount,
          notes
        ) VALUES (
          'payout',
          v_record_id::TEXT,
          'discrepancy',
          v_payout.net_payout,
          v_amount,
          abs(v_payout.net_payout - v_amount),
          'Payout amount mismatch: expected ₹' || v_payout.net_payout || ', received ₹' || v_amount
        );

        UPDATE payment_webhook_events
        SET status = 'discrepancy'
        WHERE event_id = p_event_id;

        RETURN jsonb_build_object('success', false, 'error', 'Payout amount mismatch');
      END IF;

      UPDATE payment_records
      SET
        status = 'settled',
        utr_reference = p_payload->>'utr',
        settled_at = now(),
        last_webhook_event_id = p_event_id
      WHERE id = v_record_id;

      INSERT INTO payment_reconciliation_logs (
        reconciliation_type,
        reference_id,
        status,
        expected_amount,
        recorded_amount,
        notes
      ) VALUES (
        'payout',
        v_record_id::TEXT,
        'matched',
        v_payout.net_payout,
        (p_payload->>'amount')::NUMERIC,
        'Worker direct UPI payout settled'
      );
    END IF;

  ELSIF p_event_type = 'payout.failed' THEN
    -- Payout failed (invalid UPI, bank server delay)
    v_record_id := (p_payload->>'payment_record_id')::UUID;

    UPDATE payment_records
    SET
      status = 'failed',
      failure_reason = p_payload->>'failure_reason',
      retry_count = retry_count + 1,
      last_webhook_event_id = p_event_id
    WHERE id = v_record_id;

    INSERT INTO payment_reconciliation_logs (
      reconciliation_type,
      reference_id,
      status,
      expected_amount,
      recorded_amount,
      discrepancy_amount,
      notes
    ) VALUES (
      'payout',
      v_record_id::TEXT,
      'discrepancy',
      COALESCE((p_payload->>'amount')::NUMERIC, 0.00),
      0.00,
      COALESCE((p_payload->>'amount')::NUMERIC, 0.00),
      'Payout failed: ' || COALESCE(p_payload->>'failure_reason', 'Bank error')
    );

  ELSIF p_event_type = 'payout.reversed' THEN
    -- Payout reversed by provider
    v_record_id := (p_payload->>'payment_record_id')::UUID;

    UPDATE payment_records
    SET
      status = 'refunded',
      failure_reason = 'Payout reversed by provider',
      last_webhook_event_id = p_event_id
    WHERE id = v_record_id;

    INSERT INTO payment_reconciliation_logs (
      reconciliation_type,
      reference_id,
      status,
      expected_amount,
      recorded_amount,
      notes
    ) VALUES (
      'reversal',
      v_record_id::TEXT,
      'reversed',
      COALESCE((p_payload->>'amount')::NUMERIC, 0.00),
      0.00,
      'Payout reversal logged'
    );
  END IF;

  -- Mark webhook event as processed
  UPDATE payment_webhook_events
  SET
    status = 'processed',
    processed_at = now()
  WHERE event_id = p_event_id;

  RETURN jsonb_build_object(
    'success', true,
    'event_id', p_event_id,
    'status', 'processed'
  );
END;
$$;

-- 12. RPC: INITIATE WORKER PAYOUT (IDEMPOTENT & AUDITABLE)
CREATE OR REPLACE FUNCTION initiate_worker_payout_safe(
  p_booking_id UUID,
  p_upi_id TEXT,
  p_idempotency_key TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_booking RECORD;
  v_existing_payment RECORD;
  v_payment_id UUID;
  v_key TEXT;
BEGIN
  -- 1. Validate booking existence, lock row for concurrency protection & enforce completion
  SELECT b.*, j.organizer_id AS job_organizer_id
  INTO v_booking
  FROM bookings b
  JOIN jobs j ON j.id = b.job_id
  WHERE b.id = p_booking_id
  FOR UPDATE OF b;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Booking not found');
  END IF;

  -- 1b. Authorization check
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Authentication required.');
  END IF;

  IF v_booking.job_organizer_id != auth.uid() AND NOT is_current_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized. Only the shift organizer or administrator can initiate payout.');
  END IF;

  IF v_booking.status != 'completed' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Shift attendance must be approved and completed prior to payout initiation (current status: ' || v_booking.status || ')'
    );
  END IF;

  -- 2. Validate UPI ID format
  IF p_upi_id !~* '^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid Indian UPI ID handle format');
  END IF;

  -- 3. Idempotency Key
  v_key := COALESCE(p_idempotency_key, 'payout-' || p_booking_id::TEXT);

  -- 4. Check existing payment record
  SELECT * INTO v_existing_payment
  FROM payment_records
  WHERE booking_id = p_booking_id;

  IF FOUND THEN
    IF v_existing_payment.status = 'settled' THEN
      RETURN jsonb_build_object(
        'success', true,
        'payment_id', v_existing_payment.id,
        'status', 'settled',
        'utr', v_existing_payment.utr_reference,
        'message', 'Payout already settled'
      );
    END IF;

    -- Update pending or failed payout with new UPI ID
    UPDATE payment_records
    SET
      upi_id = p_upi_id,
      status = 'processing',
      failure_reason = null,
      idempotency_key = v_key
    WHERE id = v_existing_payment.id
    RETURNING id INTO v_payment_id;

    RETURN jsonb_build_object(
      'success', true,
      'payment_id', v_payment_id,
      'status', 'processing',
      'amount', v_existing_payment.net_payout,
      'is_sandbox', true,
      'mode', 'sandbox_simulated'
    );
  END IF;

  -- 5. Insert fresh payment record in processing state awaiting provider settlement
  INSERT INTO payment_records (
    booking_id,
    job_id,
    worker_id,
    organizer_id,
    amount,
    platform_fee,
    net_payout,
    status,
    upi_id,
    escrow_locked_at,
    idempotency_key,
    is_sandbox
  ) VALUES (
    p_booking_id,
    v_booking.job_id,
    v_booking.worker_id,
    v_booking.job_organizer_id,
    v_booking.agreed_total_pay,
    0.00, -- 100% of agreed wage to worker
    v_booking.agreed_total_pay,
    'processing',
    p_upi_id,
    now(),
    v_key,
    true
  )
  RETURNING id INTO v_payment_id;

  -- Audit log
  INSERT INTO audit_logs (action, entity_type, entity_id, changes)
  VALUES (
    'worker_payout_initiated',
    'payment_records',
    v_payment_id,
    jsonb_build_object(
      'booking_id', p_booking_id,
      'amount', v_booking.agreed_total_pay,
      'upi_id', p_upi_id,
      'status', 'processing',
      'is_sandbox', true
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'payment_id', v_payment_id,
    'status', 'processing',
    'amount', v_booking.agreed_total_pay,
    'is_sandbox', true,
    'mode', 'sandbox_simulated',
    'message', 'Worker direct UPI payout initiated in sandbox mode. Awaiting provider confirmation.'
  );
END;
$$;

-- 14. SECURITY HARDENING: REVOKE UNRESTRICTED EXECUTE ON FINANCIAL RPCs
REVOKE EXECUTE ON FUNCTION process_payment_webhook_safe(TEXT, TEXT, TEXT, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION process_payment_webhook_safe(TEXT, TEXT, TEXT, JSONB) TO service_role;

REVOKE EXECUTE ON FUNCTION calculate_shift_financials_safe(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION calculate_shift_financials_safe(UUID) TO authenticated;

REVOKE EXECUTE ON FUNCTION generate_job_invoice_safe(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION generate_job_invoice_safe(UUID, UUID) TO authenticated;

REVOKE EXECUTE ON FUNCTION initiate_worker_payout_safe(UUID, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION initiate_worker_payout_safe(UUID, TEXT, TEXT) TO authenticated;



-- ============================================================================
-- Migration: 20261012000005_notifications_and_realtime.sql
-- ============================================================================

-- ============================================================================
-- OPSKL NOTIFICATIONS & REAL-TIME ENGINE (PHASE 7)
-- Multi-channel event-driven notifications (In-app, Expo Push, WhatsApp, SMS),
-- user preferences, device token lifecycle, idempotency & delivery audit logs
-- ============================================================================

-- 1. EXTEND NOTIFICATIONS TABLE
ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS channel TEXT NOT NULL DEFAULT 'in_app' CHECK (channel IN ('in_app', 'expo_push', 'whatsapp', 'sms')),
  ADD COLUMN IF NOT EXISTS delivery_status TEXT NOT NULL DEFAULT 'delivered' CHECK (delivery_status IN ('pending', 'delivered', 'failed', 'suppressed')),
  ADD COLUMN IF NOT EXISTS action_url TEXT,
  ADD COLUMN IF NOT EXISTS priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent'));

-- 2. USER PUSH TOKENS
CREATE TABLE IF NOT EXISTS user_push_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  expo_push_token TEXT NOT NULL,
  device_platform TEXT CHECK (device_platform IN ('ios', 'android', 'web')),
  device_name TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, expo_push_token)
);

-- 3. USER NOTIFICATION PREFERENCES
CREATE TABLE IF NOT EXISTS user_notification_preferences (
  user_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  push_enabled BOOLEAN NOT NULL DEFAULT true,
  in_app_enabled BOOLEAN NOT NULL DEFAULT true,
  whatsapp_enabled BOOLEAN NOT NULL DEFAULT false,
  sms_enabled BOOLEAN NOT NULL DEFAULT true,
  notify_shift_opportunities BOOLEAN NOT NULL DEFAULT true,
  notify_applications BOOLEAN NOT NULL DEFAULT true,
  notify_selection_and_confirmations BOOLEAN NOT NULL DEFAULT true,
  notify_shift_reminders BOOLEAN NOT NULL DEFAULT true,
  notify_attendance_updates BOOLEAN NOT NULL DEFAULT true,
  notify_payouts BOOLEAN NOT NULL DEFAULT true,
  notify_disputes BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. NOTIFICATION DELIVERY AUDIT LOGS
CREATE TABLE IF NOT EXISTS notification_delivery_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id UUID REFERENCES notifications(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK (channel IN ('in_app', 'expo_push', 'whatsapp', 'sms')),
  status TEXT NOT NULL CHECK (status IN ('delivered', 'failed', 'retrying', 'opted_out', 'duplicate')),
  provider_response JSONB,
  attempt_count INT NOT NULL DEFAULT 1,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. INDEXES
CREATE INDEX IF NOT EXISTS idx_push_tokens_user_active ON user_push_tokens(user_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_notifications_idempotency ON notifications(idempotency_key);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);
CREATE INDEX IF NOT EXISTS idx_delivery_logs_notif_id ON notification_delivery_logs(notification_id);

-- 6. RLS POLICIES
ALTER TABLE user_push_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_delivery_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own push tokens"
  ON user_push_tokens FOR ALL
  USING (user_id = auth.uid());

CREATE POLICY "Users can manage their own notification preferences"
  ON user_notification_preferences FOR ALL
  USING (user_id = auth.uid());

CREATE POLICY "Users can view their own delivery logs"
  ON notification_delivery_logs FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Admins can view all notification logs"
  ON notification_delivery_logs FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- 7. RPC: SAFE EVENT-DRIVEN NOTIFICATION DISPATCHER (WITH IDEMPOTENCY & PREFERENCES)
CREATE OR REPLACE FUNCTION send_notification_safe(
  p_user_id UUID,
  p_title TEXT,
  p_body TEXT,
  p_type TEXT,
  p_channel TEXT DEFAULT 'in_app',
  p_idempotency_key TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}',
  p_action_url TEXT DEFAULT NULL,
  p_priority TEXT DEFAULT 'normal'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing_id UUID;
  v_notif_id UUID;
  v_prefs RECORD;
  v_should_deliver BOOLEAN := true;
  v_delivery_status TEXT := 'delivered';
BEGIN
  -- 0. Authorization Guard: Only service_role, admin, or the user themselves
  IF auth.uid() IS NOT NULL AND auth.uid() != p_user_id AND NOT is_current_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized. Users cannot send notifications to other accounts.');
  END IF;

  -- 1. Idempotency Check
  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_existing_id
    FROM notifications
    WHERE idempotency_key = p_idempotency_key;

    IF FOUND THEN
      RETURN jsonb_build_object(
        'success', true,
        'duplicate', true,
        'notification_id', v_existing_id,
        'message', 'Notification already delivered'
      );
    END IF;
  END IF;

  -- 2. Check User Preferences
  SELECT * INTO v_prefs
  FROM user_notification_preferences
  WHERE user_id = p_user_id;

  IF FOUND THEN
    -- Channel check
    IF p_channel = 'expo_push' AND NOT v_prefs.push_enabled THEN
      v_should_deliver := false;
    ELSIF p_channel = 'whatsapp' AND NOT v_prefs.whatsapp_enabled THEN
      v_should_deliver := false;
    ELSIF p_channel = 'sms' AND NOT v_prefs.sms_enabled THEN
      v_should_deliver := false;
    END IF;

    -- Event category check
    IF p_type = 'job_opportunity' AND NOT v_prefs.notify_shift_opportunities THEN
      v_should_deliver := false;
    ELSIF p_type = 'application_status' AND NOT v_prefs.notify_applications THEN
      v_should_deliver := false;
    ELSIF p_type IN ('worker_selected', 'booking_confirmed') AND NOT v_prefs.notify_selection_and_confirmations THEN
      v_should_deliver := false;
    ELSIF p_type = 'shift_reminder' AND NOT v_prefs.notify_shift_reminders THEN
      v_should_deliver := false;
    ELSIF p_type IN ('check_in', 'check_out', 'attendance_approved') AND NOT v_prefs.notify_attendance_updates THEN
      v_should_deliver := false;
    ELSIF p_type IN ('payout_settled', 'payout_failed') AND NOT v_prefs.notify_payouts THEN
      v_should_deliver := false;
    ELSIF p_type = 'dispute_update' AND NOT v_prefs.notify_disputes THEN
      v_should_deliver := false;
    END IF;
  END IF;

  IF NOT v_should_deliver THEN
    v_delivery_status := 'suppressed';
  END IF;

  -- 3. Insert into notifications
  INSERT INTO notifications (
    user_id,
    title,
    body,
    type,
    channel,
    idempotency_key,
    delivery_status,
    metadata,
    action_url,
    priority,
    read
  ) VALUES (
    p_user_id,
    p_title,
    p_body,
    p_type,
    p_channel,
    p_idempotency_key,
    v_delivery_status,
    p_metadata,
    p_action_url,
    p_priority,
    false
  )
  RETURNING id INTO v_notif_id;

  -- 4. Delivery Audit Log
  INSERT INTO notification_delivery_logs (
    notification_id,
    user_id,
    channel,
    status,
    attempt_count
  ) VALUES (
    v_notif_id,
    p_user_id,
    p_channel,
    CASE WHEN v_should_deliver THEN 'delivered' ELSE 'opted_out' END,
    1
  );

  RETURN jsonb_build_object(
    'success', true,
    'duplicate', false,
    'suppressed', NOT v_should_deliver,
    'notification_id', v_notif_id,
    'delivery_status', v_delivery_status
  );
END;
$$;

-- 8. RPC: REGISTER PUSH TOKEN SAFE
CREATE OR REPLACE FUNCTION register_push_token_safe(
  p_user_id UUID,
  p_expo_token TEXT,
  p_platform TEXT,
  p_device_name TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_effective_id UUID;
BEGIN
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Authentication required to register device token.');
  END IF;

  -- Ensure caller can only register for themselves unless admin
  IF p_user_id IS NOT NULL AND p_user_id != v_caller_id THEN
    IF NOT is_current_admin() THEN
      RETURN jsonb_build_object('success', false, 'error', 'Unauthorized. Cannot register push tokens for another user.');
    END IF;
    v_effective_id := p_user_id;
  ELSE
    v_effective_id := v_caller_id;
  END IF;

  INSERT INTO user_push_tokens (
    user_id,
    expo_push_token,
    device_platform,
    device_name,
    is_active,
    updated_at
  ) VALUES (
    v_effective_id,
    p_expo_token,
    p_platform,
    p_device_name,
    true,
    now()
  )
  ON CONFLICT (user_id, expo_push_token)
  DO UPDATE SET
    is_active = true,
    updated_at = now();

  RETURN jsonb_build_object('success', true, 'token', p_expo_token);
END;
$$;

-- 9. RPC: REVOKE PUSH TOKEN SAFE (LOGOUT)
CREATE OR REPLACE FUNCTION revoke_push_token_safe(
  p_user_id UUID,
  p_expo_token TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_effective_id UUID;
BEGIN
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Authentication required to revoke device token.');
  END IF;

  IF p_user_id IS NOT NULL AND p_user_id != v_caller_id THEN
    IF NOT is_current_admin() THEN
      RETURN jsonb_build_object('success', false, 'error', 'Unauthorized. Cannot revoke push tokens for another user.');
    END IF;
    v_effective_id := p_user_id;
  ELSE
    v_effective_id := v_caller_id;
  END IF;

  UPDATE user_push_tokens
  SET
    is_active = false,
    updated_at = now()
  WHERE user_id = v_effective_id AND expo_push_token = p_expo_token;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- 10. ENABLE SUPABASE REALTIME PUBLICATION
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
  END IF;
EXCEPTION
  WHEN undefined_object THEN null;
  WHEN others THEN null;
END $$;

-- 11. RESTRICT RPC EXECUTION PRIVILEGES
REVOKE EXECUTE ON FUNCTION send_notification_safe(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION send_notification_safe(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, TEXT, TEXT) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION register_push_token_safe(UUID, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION register_push_token_safe(UUID, TEXT, TEXT, TEXT) TO authenticated;

REVOKE EXECUTE ON FUNCTION revoke_push_token_safe(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION revoke_push_token_safe(UUID, TEXT) TO authenticated;


-- ============================================================================
-- Migration: 20261012000006_admin_and_trust_operations.sql
-- ============================================================================

-- ============================================================================
-- OPSKL ADMIN & TRUST OPERATIONS ENGINE (PHASE 8)
-- Trust & Safety escalation queue, verification review, dispute adjudication,
-- platform configuration, immutable audit logs, and strict server RBAC
-- ============================================================================

-- 1. SAFETY & INCIDENT REPORTS TABLE
CREATE TABLE IF NOT EXISTS safety_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reported_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  job_id UUID REFERENCES jobs(id) ON DELETE SET NULL,
  category TEXT NOT NULL CHECK (category IN ('safety', 'harassment', 'wage_theft', 'unsafe_conditions', 'fraud', 'other')),
  severity TEXT NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  description TEXT NOT NULL,
  evidence_urls TEXT[] DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'investigating', 'resolved', 'escalated', 'dismissed')),
  staff_notes TEXT,
  action_taken TEXT,
  resolved_by UUID REFERENCES profiles(id),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. PLATFORM CONFIGURATION TABLE
CREATE TABLE IF NOT EXISTS platform_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  description TEXT,
  updated_by UUID REFERENCES profiles(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed baseline configuration
INSERT INTO platform_settings (key, value, description)
VALUES 
  ('platform_fee_percent', '10.0'::jsonb, 'Standard Opskl marketplace service fee percentage charged to organizers'),
  ('gst_rate_percent', '18.0'::jsonb, 'Indian GST rate applied strictly to the platform service fee (SAC 998519)'),
  ('min_hourly_wage_inr', '100.0'::jsonb, 'Enforced minimum hourly wage floor in INR to protect workers from sub-minimum wages'),
  ('payment_gateway_mode', '"sandbox"'::jsonb, 'Payment gateway execution mode ("sandbox" or "live")'),
  ('dlt_sms_header', '"OPSKIL"'::jsonb, 'TRAI DLT-registered 6-character Alpha sender header')
ON CONFLICT (key) DO NOTHING;

-- 3. INDEXES
CREATE INDEX IF NOT EXISTS idx_safety_reports_status ON safety_reports(status);
CREATE INDEX IF NOT EXISTS idx_safety_reports_severity ON safety_reports(severity);
CREATE INDEX IF NOT EXISTS idx_disputes_status ON disputes(status);
CREATE INDEX IF NOT EXISTS idx_verification_cases_status ON verification_cases(status);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC);

-- 4. RLS POLICIES FOR SAFETY REPORTS & SETTINGS
ALTER TABLE safety_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can create safety reports"
  ON safety_reports FOR INSERT
  WITH CHECK (auth.uid() = reporter_id);

CREATE POLICY "Users can view their own filed safety reports"
  ON safety_reports FOR SELECT
  USING (auth.uid() = reporter_id);

CREATE POLICY "Admins have full access to safety reports"
  ON safety_reports FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Public read platform settings"
  ON platform_settings FOR SELECT
  USING (true);

CREATE POLICY "Admins manage platform settings"
  ON platform_settings FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- 5. RPC: ADMIN RESOLVE DISPUTE SAFE (WITH REASON & AUDIT)
CREATE OR REPLACE FUNCTION admin_resolve_dispute_safe(
  p_dispute_id UUID,
  p_status TEXT,
  p_resolution_notes TEXT,
  p_adjusted_payout NUMERIC DEFAULT NULL,
  p_admin_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dispute RECORD;
  v_booking RECORD;
  v_admin_id UUID := auth.uid();
  v_admin_role user_role;
BEGIN
  -- 1. Strictly derive caller identity from auth.uid()
  IF v_admin_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Authentication required.');
  END IF;

  -- Disallow caller spoofing another administrator identity
  IF p_admin_id IS NOT NULL AND p_admin_id != v_admin_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized. Caller cannot specify a different administrator identity.');
  END IF;

  -- Verify actual caller has administrator role
  SELECT role INTO v_admin_role
  FROM profiles
  WHERE id = v_admin_id;

  IF v_admin_role IS NULL OR v_admin_role != 'admin' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized. Requires administrator role.');
  END IF;

  SELECT * INTO v_dispute
  FROM disputes
  WHERE id = p_dispute_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Dispute not found');
  END IF;

  SELECT * INTO v_booking
  FROM bookings
  WHERE id = v_dispute.booking_id;

  -- Update dispute
  UPDATE disputes
  SET
    status = p_status,
    resolution_notes = p_resolution_notes,
    resolved_by = v_admin_id,
    resolved_at = now()
  WHERE id = p_dispute_id;

  -- If resolved, update booking status to completed
  IF p_status = 'resolved' THEN
    UPDATE bookings
    SET
      status = 'completed',
      completed_at = COALESCE(completed_at, now())
    WHERE id = v_dispute.booking_id;

    -- Update or adjust payout record if requested
    IF p_adjusted_payout IS NOT NULL AND p_adjusted_payout >= 0 THEN
      UPDATE payment_records
      SET
        amount = p_adjusted_payout,
        net_payout = p_adjusted_payout,
        status = 'escrow_locked'
      WHERE booking_id = v_dispute.booking_id;
    END IF;
  END IF;

  -- Immutable audit log
  INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, changes)
  VALUES (
    v_admin_id,
    'admin_resolve_dispute',
    'disputes',
    p_dispute_id,
    jsonb_build_object(
      'status', p_status,
      'resolution_notes', p_resolution_notes,
      'adjusted_payout', p_adjusted_payout
    )
  );

  RETURN jsonb_build_object('success', true, 'dispute_id', p_dispute_id, 'status', p_status);
END;
$$;

-- 6. RPC: ADMIN VERIFY CASE SAFE (WITH AUDIT)
CREATE OR REPLACE FUNCTION admin_verify_case_safe(
  p_case_id UUID,
  p_status TEXT,
  p_rejection_reason TEXT DEFAULT NULL,
  p_admin_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_case RECORD;
  v_admin_id UUID := auth.uid();
  v_admin_role user_role;
BEGIN
  IF v_admin_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Authentication required.');
  END IF;

  IF p_admin_id IS NOT NULL AND p_admin_id != v_admin_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized. Caller cannot specify a different administrator identity.');
  END IF;

  SELECT role INTO v_admin_role
  FROM profiles
  WHERE id = v_admin_id;

  IF v_admin_role IS NULL OR v_admin_role != 'admin' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized. Requires administrator role.');
  END IF;

  SELECT * INTO v_case
  FROM verification_cases
  WHERE id = p_case_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Verification case not found');
  END IF;

  UPDATE verification_cases
  SET
    status = p_status,
    rejection_reason = p_rejection_reason,
    reviewed_by = v_admin_id,
    reviewed_at = now()
  WHERE id = p_case_id;

  -- Update target profile verification status
  IF p_status = 'approved' THEN
    -- Check if worker profile
    UPDATE worker_profiles
    SET
      is_aadhaar_verified = CASE WHEN v_case.document_type = 'aadhaar' THEN true ELSE is_aadhaar_verified END,
      is_pan_verified = CASE WHEN v_case.document_type = 'pan' THEN true ELSE is_pan_verified END,
      verification_status = 'verified',
      updated_at = now()
    WHERE id = v_case.profile_id;

    -- Check if organizer profile
    UPDATE organizer_profiles
    SET
      is_gstin_verified = CASE WHEN v_case.document_type = 'gstin' THEN true ELSE is_gstin_verified END,
      verification_status = 'verified',
      updated_at = now()
    WHERE id = v_case.profile_id;
  END IF;

  -- Immutable audit log
  INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, changes)
  VALUES (
    v_admin_id,
    'admin_verify_document',
    'verification_cases',
    p_case_id,
    jsonb_build_object(
      'status', p_status,
      'document_type', v_case.document_type,
      'profile_id', v_case.profile_id,
      'rejection_reason', p_rejection_reason
    )
  );

  RETURN jsonb_build_object('success', true, 'case_id', p_case_id, 'status', p_status);
END;
$$;

-- 7. RPC: ADMIN MODERATE JOB SAFE (WITH REASON & AUDIT)
CREATE OR REPLACE FUNCTION admin_moderate_job_safe(
  p_job_id UUID,
  p_new_status shift_status,
  p_moderation_reason TEXT,
  p_admin_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job RECORD;
  v_admin_id UUID := auth.uid();
  v_admin_role user_role;
BEGIN
  IF v_admin_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Authentication required.');
  END IF;

  IF p_admin_id IS NOT NULL AND p_admin_id != v_admin_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized. Caller cannot specify a different administrator identity.');
  END IF;

  SELECT role INTO v_admin_role
  FROM profiles
  WHERE id = v_admin_id;

  IF v_admin_role IS NULL OR v_admin_role != 'admin' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized. Requires administrator role.');
  END IF;

  SELECT * INTO v_job
  FROM jobs
  WHERE id = p_job_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Job not found');
  END IF;

  UPDATE jobs
  SET
    status = p_new_status,
    updated_at = now()
  WHERE id = p_job_id;

  -- Immutable audit log
  INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, changes)
  VALUES (
    v_admin_id,
    'admin_moderate_job',
    'jobs',
    p_job_id,
    jsonb_build_object(
      'old_status', v_job.status,
      'new_status', p_new_status,
      'moderation_reason', p_moderation_reason
    )
  );

  RETURN jsonb_build_object('success', true, 'job_id', p_job_id, 'status', p_new_status);
END;
$$;

-- 8. RPC: ADMIN RESOLVE SAFETY REPORT SAFE (WITH AUDIT)
CREATE OR REPLACE FUNCTION admin_resolve_safety_report_safe(
  p_report_id UUID,
  p_status TEXT,
  p_action_taken TEXT,
  p_staff_notes TEXT,
  p_admin_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_report RECORD;
  v_admin_id UUID := auth.uid();
  v_admin_role user_role;
BEGIN
  IF v_admin_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Authentication required.');
  END IF;

  IF p_admin_id IS NOT NULL AND p_admin_id != v_admin_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized. Caller cannot specify a different administrator identity.');
  END IF;

  SELECT role INTO v_admin_role
  FROM profiles
  WHERE id = v_admin_id;

  IF v_admin_role IS NULL OR v_admin_role != 'admin' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized. Requires administrator role.');
  END IF;

  SELECT * INTO v_report
  FROM safety_reports
  WHERE id = p_report_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Safety report not found');
  END IF;

  UPDATE safety_reports
  SET
    status = p_status,
    action_taken = p_action_taken,
    staff_notes = p_staff_notes,
    resolved_by = v_admin_id,
    resolved_at = now()
  WHERE id = p_report_id;

  -- Immutable audit log
  INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, changes)
  VALUES (
    v_admin_id,
    'admin_resolve_safety_report',
    'safety_reports',
    p_report_id,
    jsonb_build_object(
      'status', p_status,
      'action_taken', p_action_taken,
      'severity', v_report.severity
    )
  );

  RETURN jsonb_build_object('success', true, 'report_id', p_report_id, 'status', p_status);
END;
$$;

-- 9. RESTRICT EXECUTION OF ADMINISTRATIVE FUNCTIONS
REVOKE EXECUTE ON FUNCTION admin_resolve_dispute_safe(UUID, TEXT, TEXT, NUMERIC, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION admin_resolve_dispute_safe(UUID, TEXT, TEXT, NUMERIC, UUID) TO authenticated;

REVOKE EXECUTE ON FUNCTION admin_verify_case_safe(UUID, TEXT, TEXT, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION admin_verify_case_safe(UUID, TEXT, TEXT, UUID) TO authenticated;

REVOKE EXECUTE ON FUNCTION admin_moderate_job_safe(UUID, shift_status, TEXT, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION admin_moderate_job_safe(UUID, shift_status, TEXT, UUID) TO authenticated;

REVOKE EXECUTE ON FUNCTION admin_resolve_safety_report_safe(UUID, TEXT, TEXT, TEXT, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION admin_resolve_safety_report_safe(UUID, TEXT, TEXT, TEXT, UUID) TO authenticated;

-- 10. ACCOUNT DELETION REQUESTS TABLE & WORKFLOW
CREATE TABLE IF NOT EXISTS account_deletion_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'completed', 'cancelled')),
  reason TEXT,
  scheduled_purge_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT account_deletion_requests_user_id_unique UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS idx_account_deletion_requests_status ON account_deletion_requests(status);
CREATE INDEX IF NOT EXISTS idx_account_deletion_requests_purge_at ON account_deletion_requests(scheduled_purge_at);

ALTER TABLE account_deletion_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own deletion request"
  ON account_deletion_requests FOR SELECT
  USING (auth.uid() = user_id OR is_current_admin());

CREATE POLICY "Admins can manage deletion requests"
  ON account_deletion_requests FOR ALL
  USING (is_current_admin());

-- RPC: USER REQUEST ACCOUNT DELETION SAFE (WITH COMPLIANCE AUDIT & OBLIGATION CHECKS)
CREATE OR REPLACE FUNCTION request_account_deletion_safe(
  p_reason TEXT DEFAULT 'User requested account deletion in-app'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_now TIMESTAMPTZ := now();
  v_purge_at TIMESTAMPTZ := v_now + INTERVAL '30 days';
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'UNAUTHENTICATED', 'message', 'Authentication required.');
  END IF;

  -- 1. Check for active worker shift commitments
  IF EXISTS (
    SELECT 1 FROM bookings 
    WHERE worker_id = v_user_id AND status IN ('confirmed', 'checked_in', 'completed_awaiting_review')
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'ACTIVE_BOOKINGS_PENDING',
      'message', 'Cannot request deletion with active or pending shifts. Please complete or cancel upcoming shifts first.'
    );
  END IF;

  -- 2. Check for active organizer shifts/jobs
  IF EXISTS (
    SELECT 1 FROM jobs 
    WHERE organizer_id = v_user_id AND status IN ('open', 'filling', 'filled', 'in_progress')
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'ACTIVE_JOBS_PENDING',
      'message', 'Cannot request deletion with open, active, or in-progress shifts. Please close or complete all active shifts first.'
    );
  END IF;

  -- 3. Check for unsettled payments / held escrow
  IF EXISTS (
    SELECT 1 FROM payment_records 
    WHERE (worker_id = v_user_id OR organizer_id = v_user_id) 
      AND status IN ('pending', 'escrow_locked', 'processing')
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'PENDING_SETTLEMENT',
      'message', 'Cannot delete account while payments or escrow settlements are pending.'
    );
  END IF;

  -- 4. Deactivate the profile
  UPDATE profiles 
  SET is_active = false, updated_at = v_now 
  WHERE id = v_user_id;

  -- 5. Insert or update the durable deletion queue record
  INSERT INTO account_deletion_requests (
    user_id, status, reason, scheduled_purge_at, created_at, updated_at
  ) VALUES (
    v_user_id, 'queued', p_reason, v_purge_at, v_now, v_now
  )
  ON CONFLICT (user_id) DO UPDATE SET
    status = 'queued',
    reason = EXCLUDED.reason,
    scheduled_purge_at = EXCLUDED.scheduled_purge_at,
    updated_at = v_now;

  -- 6. Record authoritative audit record for compliance and archival
  INSERT INTO audit_logs (
    actor_id,
    action,
    entity_type,
    entity_id,
    changes,
    created_at
  ) VALUES (
    v_user_id,
    'account_deletion_requested',
    'profile',
    v_user_id::text,
    jsonb_build_object(
      'reason', p_reason,
      'requested_at', v_now,
      'scheduled_purge_at', v_purge_at,
      'status', 'queued',
      'source', 'mobile_app_in_app_action'
    ),
    v_now
  );

  RETURN jsonb_build_object(
    'success', true, 
    'status', 'queued',
    'requested_at', v_now,
    'scheduled_purge_at', v_purge_at,
    'message', 'Account has been deactivated and scheduled for permanent data purge in 30 days.'
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION request_account_deletion_safe(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION request_account_deletion_safe(TEXT) TO authenticated;

-- 11. RPC: PURGE WORKER / SCHEDULER TO PROCESS DUE ACCOUNT DELETIONS
CREATE OR REPLACE FUNCTION process_account_deletion_purge_safe(
  p_batch_size INT DEFAULT 50
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rec RECORD;
  v_purged_count INT := 0;
  v_now TIMESTAMPTZ := now();
BEGIN
  -- Strict administrative or service role authorization
  IF NOT is_current_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized. Administrative credentials required to run purge worker.');
  END IF;

  FOR v_rec IN 
    SELECT r.id AS request_id, r.user_id, p.full_name, p.role
    FROM account_deletion_requests r
    JOIN profiles p ON p.id = r.user_id
    WHERE r.status = 'queued' 
      AND r.scheduled_purge_at <= v_now
    ORDER BY r.scheduled_purge_at ASC
    LIMIT p_batch_size
    FOR UPDATE SKIP LOCKED
  LOOP
    -- Mark as processing
    UPDATE account_deletion_requests 
    SET status = 'processing', updated_at = v_now 
    WHERE id = v_rec.request_id;

    -- Redact PII in worker_profiles or organizer_profiles preserving financial record integrity
    UPDATE worker_profiles
    SET
      bio = NULL,
      upi_id = NULL,
      skills = '{}',
      service_areas = '{}',
      preferred_locality = 'Deactivated Locality',
      updated_at = v_now
    WHERE id = v_rec.user_id;

    UPDATE organizer_profiles
    SET
      business_name = 'Redacted Deactivated Organization',
      business_contact_email = NULL,
      business_contact_phone = '0000000000',
      billing_address = NULL,
      gstin = NULL,
      updated_at = v_now
    WHERE id = v_rec.user_id;

    -- Redact base profile identity (GDPR / Indian DPDP Right to be Forgotten)
    UPDATE profiles
    SET
      full_name = 'Deactivated User',
      email = 'purged_' || v_rec.user_id::text || '@opskil.internal',
      phone = NULL,
      avatar_url = NULL,
      is_active = false,
      updated_at = v_now
    WHERE id = v_rec.user_id;

    -- Mark request as completed
    UPDATE account_deletion_requests 
    SET status = 'completed', updated_at = v_now 
    WHERE id = v_rec.request_id;

    -- Log purge execution in immutable compliance audit trail
    INSERT INTO audit_logs (
      actor_id,
      action,
      entity_type,
      entity_id,
      changes,
      created_at
    ) VALUES (
      COALESCE(auth.uid(), v_rec.user_id),
      'account_purged',
      'profile',
      v_rec.user_id::text,
      jsonb_build_object(
        'request_id', v_rec.request_id,
        'purged_at', v_now,
        'status', 'completed',
        'pii_redacted', true
      ),
      v_now
    );

    v_purged_count := v_purged_count + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'purged_count', v_purged_count,
    'executed_at', v_now
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION process_account_deletion_purge_safe(INT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION process_account_deletion_purge_safe(INT) TO authenticated;




