-- ==============================================================================
-- OPSKL CONSOLIDATED MASTER SCHEMA RELEASE
-- Market: India (Single-Day Event Shift Marketplace)
-- Initial Launch: Mumbai Metropolitan Region
-- Contains All 22 Sequential Migrations (20261012000000 through 20261016000000)
-- Generated automatically for reproducible full schema deployment
-- ==============================================================================


-- ##############################################################################
-- START MIGRATION: 20261012000000_initial_schema.sql
-- ##############################################################################

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
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF is_current_admin() THEN
    RETURN NEW;
  END IF;

  IF NEW.role IS DISTINCT FROM OLD.role THEN
    RAISE EXCEPTION 'Unauthorized: Users cannot change their assigned role.';
  END IF;

  IF NEW.is_active IS DISTINCT FROM OLD.is_active THEN
    RAISE EXCEPTION 'Unauthorized: Account activation status cannot be modified directly by users.';
  END IF;

  IF NEW.id IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION 'Unauthorized: Profile ID cannot be modified.';
  END IF;

  RETURN NEW;
END;
$$;

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
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

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

CREATE POLICY "Admins full access to organizer profiles"
  ON organizer_profiles FOR ALL USING (is_current_admin());

-- Restricted public view for organizer cards (protects sensitive gstin, billing_address, phone/email)
CREATE OR REPLACE VIEW public_organizer_cards AS
  SELECT
    id,
    business_name,
    business_type,
    verification_status,
    rating,
    total_events_hosted,
    created_at
  FROM organizer_profiles
  WHERE verification_status = 'verified'
     OR is_current_admin()
     OR id = auth.uid()
     OR EXISTS (
       SELECT 1 FROM jobs j 
       WHERE j.organizer_id = organizer_profiles.id 
         AND j.status IN ('open', 'filling', 'filled', 'in_progress', 'completed')
     );

GRANT SELECT ON public_organizer_cards TO anon, authenticated;

-- Restricted view for applicant worker profiles (protects sensitive worker upi_id and enforces applicant relationship)
CREATE OR REPLACE VIEW worker_applicant_profiles AS
  SELECT
    wp.id,
    wp.preferred_locality,
    wp.skills,
    wp.experience_years,
    wp.rating,
    wp.total_reviews,
    wp.shifts_completed,
    wp.verification_status,
    wp.is_aadhaar_verified,
    wp.is_pan_verified
  FROM worker_profiles wp
  WHERE
    wp.id = auth.uid()
    OR is_current_admin()
    OR EXISTS (
      SELECT 1 FROM job_applications ja
      JOIN jobs j ON j.id = ja.job_id
      WHERE ja.worker_id = wp.id AND j.organizer_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM bookings b
      WHERE b.worker_id = wp.id AND b.organizer_id = auth.uid()
    );

GRANT SELECT ON worker_applicant_profiles TO authenticated;

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

CREATE POLICY "Organizers update their draft jobs"
  ON jobs FOR UPDATE USING (organizer_id = auth.uid() AND status = 'draft');

CREATE POLICY "Admins manage all jobs"
  ON jobs FOR ALL USING (is_current_admin());

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

CREATE POLICY "Admins view and manage all bookings"
  ON bookings FOR ALL USING (is_current_admin());

-- 9. Attendance Records
CREATE POLICY "Workers view own attendance"
  ON attendance_records FOR SELECT USING (worker_id = auth.uid());

CREATE POLICY "Organizers view attendance for their jobs"
  ON attendance_records FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM jobs j
      WHERE j.id = attendance_records.job_id AND j.organizer_id = auth.uid()
    )
  );

CREATE POLICY "Admins manage attendance records"
  ON attendance_records FOR ALL USING (is_current_admin());

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
    raised_by = auth.uid() OR respondent_id = auth.uid() OR is_current_admin()
  );

CREATE POLICY "Participants create disputes"
  ON disputes FOR INSERT WITH CHECK (
    raised_by = auth.uid()
    AND status = 'open'
    AND EXISTS (
      SELECT 1 FROM bookings b
      WHERE b.id = disputes.booking_id
        AND (b.worker_id = auth.uid() OR b.organizer_id = auth.uid())
    )
  );

-- 14. Verification Cases (Forces initial status to pending and prevents user self-approval)
CREATE POLICY "Users view own verification cases"
  ON verification_cases FOR SELECT USING (profile_id = auth.uid() OR is_current_admin());

CREATE POLICY "Users create verification cases"
  ON verification_cases FOR INSERT WITH CHECK (
    profile_id = auth.uid()
    AND status = 'pending'
    AND reviewed_by IS NULL
    AND reviewed_at IS NULL
    AND rejection_reason IS NULL
  );

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
    IF NEW.upi_id !~* '^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$' THEN
      RAISE EXCEPTION 'Invalid UPI ID format. Payout destination handle must be valid (e.g. name@bank).';
    END IF;
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

  IF NEW.id IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION 'Unauthorized: Organizer profile ID cannot be modified.';
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


-- ##############################################################################
-- START MIGRATION: 20261012000001_marketplace_discovery.sql
-- ##############################################################################

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

  -- 1b. Worker eligibility check: must have active profile with worker role
  IF NOT EXISTS (
    SELECT 1 FROM profiles p
    JOIN worker_profiles wp ON wp.id = p.id
    WHERE p.id = v_worker_id AND p.role IN ('worker', 'admin') AND p.is_active = true
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'INELIGIBLE_WORKER',
      'message', 'Only active workers with established profiles can apply for shifts.'
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

  -- Do not overwrite an existing right swipe or active job application
  IF EXISTS (
    SELECT 1 FROM swipe_events
    WHERE worker_id = v_worker_id AND job_id = p_job_id AND direction = 'right'
  ) OR EXISTS (
    SELECT 1 FROM job_applications
    WHERE worker_id = v_worker_id AND job_id = p_job_id
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'ALREADY_APPLIED',
      'message', 'Cannot pass a shift that has already been applied for or saved.'
    );
  END IF;

  INSERT INTO swipe_events (worker_id, job_id, direction)
  VALUES (v_worker_id, p_job_id, 'left')
  ON CONFLICT (worker_id, job_id)
  DO UPDATE SET direction = 'left', created_at = now()
  WHERE swipe_events.direction != 'right';

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

REVOKE EXECUTE ON FUNCTION record_swipe_pass(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION record_swipe_pass(UUID) TO authenticated;

REVOKE EXECUTE ON FUNCTION undo_swipe_event(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION undo_swipe_event(UUID) TO authenticated;


-- ##############################################################################
-- START MIGRATION: 20261012000002_organizer_management.sql
-- ##############################################################################

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

CREATE POLICY "Admins insert audit logs"
  ON audit_logs FOR INSERT
  WITH CHECK (is_current_admin() OR auth.role() = 'service_role');

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

  -- Platform Killswitch Check
  IF EXISTS (
    SELECT 1 FROM platform_settings
    WHERE key = 'booking_killswitch' AND (value->>'is_paused')::BOOLEAN = true
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'BOOKINGS_PAUSED',
      'message', 'Shift creation and bookings are temporarily paused platform-wide.'
    );
  END IF;

  -- Organizer role and active account authorization check
  IF NOT EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = v_organizer_id AND role IN ('organizer', 'admin') AND is_active = true
  ) OR NOT EXISTS (
    SELECT 1 FROM organizer_profiles 
    WHERE id = v_organizer_id AND (verification_status = 'verified' OR is_current_admin())
  ) THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error_code', 'FORBIDDEN_ROLE', 
      'message', 'Only active organizers with verified profiles can create and publish shifts.'
    );
  END IF;

  -- Server-side validation: text lengths
  IF length(trim(COALESCE(v_title, ''))) < 3 OR length(trim(COALESCE(v_title, ''))) > 150 THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'INVALID_TITLE', 'message', 'Shift title must be between 3 and 150 characters.');
  END IF;

  IF length(trim(COALESCE(v_venue_address, ''))) < 5 OR length(trim(COALESCE(v_venue_address, ''))) > 500 THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'INVALID_VENUE', 'message', 'Venue address must be between 5 and 500 characters.');
  END IF;

  -- Server-side validation: minimum and maximum wage
  IF v_hourly_rate < 100 OR v_hourly_rate > 10000 THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'INVALID_WAGE', 'message', 'Hourly rate must be between ₹100 and ₹10,000/hr.');
  END IF;

  -- Server-side validation: slots total bounds
  IF v_slots_total < 1 OR v_slots_total > 500 THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'INVALID_SLOTS', 'message', 'Headcount must be between 1 and 500 workers.');
  END IF;

  -- Server-side validation: start and end times
  IF v_start_time IS NULL OR v_end_time IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'INVALID_TIME', 'message', 'Shift start and end times are required.');
  END IF;

  IF v_end_time <= v_start_time THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'INVALID_TIME_ORDER', 'message', 'Shift end time must be after shift start time.');
  END IF;

  -- Strictly derive duration unconditionally from start and end times
  v_duration_hours := round((EXTRACT(EPOCH FROM (v_end_time - v_start_time)) / 3600.0)::numeric, 2);

  -- Strictly enforce minimum 0.5 hours (30 min) and maximum 24 hours
  IF v_duration_hours < 0.5 OR v_duration_hours > 24.0 THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'INVALID_DURATION', 'message', 'Shift duration must be between 0.5 and 24 hours.');
  END IF;

  -- Server-side validation: array size bounds
  IF cardinality(v_duties) > 20 OR cardinality(v_required_skills) > 20 OR cardinality(v_perks) > 20 THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'ARRAY_TOO_LARGE', 'message', 'Duties, required skills, and perks lists must not exceed 20 items.');
  END IF;

  -- Server-side validation: date not in the past
  IF v_date < CURRENT_DATE THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'PAST_DATE', 'message', 'Shift date cannot be in the past');
  END IF;

  -- Calculate total pay strictly server-side
  v_total_pay := round(v_hourly_rate * v_duration_hours, 2);

  -- Initial status sanitization
  IF v_status NOT IN ('draft', 'open', 'filling') THEN
    v_status := 'open';
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

  -- Platform Killswitch Check
  IF EXISTS (
    SELECT 1 FROM platform_settings
    WHERE key = 'booking_killswitch' AND (value->>'is_paused')::BOOLEAN = true
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'BOOKINGS_PAUSED',
      'message', 'Shift bookings are temporarily paused platform-wide.'
    );
  END IF;

  -- Enforce organizer active status
  IF NOT EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = v_organizer_id AND role IN ('organizer', 'admin') AND is_active = true
  ) THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'INELIGIBLE_ORGANIZER', 'message', 'Organizer account is inactive or not eligible.');
  END IF;

  -- Enforce candidate worker active account and profile eligibility
  IF NOT EXISTS (
    SELECT 1 FROM profiles p
    JOIN worker_profiles wp ON wp.id = p.id
    WHERE p.id = p_worker_id AND p.role IN ('worker', 'admin') AND p.is_active = true
  ) THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'INELIGIBLE_WORKER', 'message', 'Selected candidate is not an active worker profile.');
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

  -- 6. Generate distinct, cryptographically secure per-booking check-in credential (48-bit CSPRNG entropy via gen_random_bytes)
  v_check_in_code := 'OP-' || upper(encode(gen_random_bytes(6), 'hex'));

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

-- 8. Atomic RPC: Update Job Status with Audit Log
CREATE OR REPLACE FUNCTION update_job_status_safe(
  p_job_id UUID,
  p_new_status shift_status,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id UUID := auth.uid();
  v_job RECORD;
BEGIN
  IF v_actor_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'UNAUTHENTICATED');
  END IF;

  SELECT * INTO v_job FROM jobs WHERE id = p_job_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'JOB_NOT_FOUND', 'message', 'Shift listing not found');
  END IF;

  IF v_job.organizer_id != v_actor_id AND NOT is_current_admin() THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'UNAUTHORIZED', 'message', 'Not authorized to update this shift');
  END IF;

  -- Enforce killswitch if attempting to open a shift while paused
  IF p_new_status IN ('open', 'filling') AND EXISTS (
    SELECT 1 FROM platform_settings
    WHERE key = 'booking_killswitch' AND (value->>'is_paused')::BOOLEAN = true
  ) THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'BOOKINGS_PAUSED', 'message', 'Cannot activate shifts while marketplace bookings are paused');
  END IF;

  UPDATE jobs
  SET status = p_new_status, updated_at = now()
  WHERE id = p_job_id;

  INSERT INTO audit_logs (
    actor_id, action, entity_type, entity_id, new_state
  ) VALUES (
    v_actor_id, 'UPDATE_JOB_STATUS', 'job', p_job_id::TEXT,
    jsonb_build_object('old_status', v_job.status, 'new_status', p_new_status, 'reason', p_reason)
  );

  RETURN jsonb_build_object('success', true, 'status', p_new_status);
END;
$$;

REVOKE EXECUTE ON FUNCTION update_job_status_safe(UUID, shift_status, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION update_job_status_safe(UUID, shift_status, TEXT) TO authenticated;

REVOKE EXECUTE ON FUNCTION create_job_safe(JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION create_job_safe(JSONB) TO authenticated;

REVOKE EXECUTE ON FUNCTION confirm_worker_booking_safe(UUID, UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION confirm_worker_booking_safe(UUID, UUID, TEXT) TO authenticated;

REVOKE EXECUTE ON FUNCTION update_application_status_safe(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION update_application_status_safe(UUID, TEXT) TO authenticated;


-- ##############################################################################
-- START MIGRATION: 20261012000003_booking_attendance_engine.sql
-- ##############################################################################

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
  IF p_code IS NULL OR length(trim(p_code)) < 4 OR length(trim(p_code)) > 32 THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'INVALID_CODE', 'message', 'A valid shift check-in code or pass credential is required.');
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

  -- 5. Calculate GPS distance and enforce venue geofence boundary
  IF NOT v_is_supervisor THEN
    -- For worker self-check-in, GPS coordinates from the device are mandatory
    IF p_lat IS NULL OR p_lng IS NULL THEN
      RETURN jsonb_build_object(
        'success', false,
        'error_code', 'LOCATION_REQUIRED',
        'message', 'Device GPS coordinates are required for worker self-check-in to verify venue presence.'
      );
    END IF;

    -- Coordinate range validation (Latitude [-90, 90], Longitude [-180, 180])
    IF p_lat < -90.0 OR p_lat > 90.0 OR p_lng < -180.0 OR p_lng > 180.0 THEN
      RETURN jsonb_build_object(
        'success', false,
        'error_code', 'INVALID_COORDINATES',
        'message', 'Submitted GPS coordinates are out of valid geographic range.'
      );
    END IF;

    -- Strict venue coordinate requirement: if venue location is unconfigured, self-check-in must be rejected
    IF v_job.latitude IS NULL OR v_job.longitude IS NULL THEN
      RETURN jsonb_build_object(
        'success', false,
        'error_code', 'VENUE_COORDINATES_MISSING',
        'message', 'Shift venue location coordinates are not configured. On-site supervisor verification required for check-in.'
      );
    END IF;

    v_distance := round(
      (6371 * acos(
        least(1.0, greatest(-1.0,
          cos(radians(p_lat)) * cos(radians(v_job.latitude)) *
          cos(radians(v_job.longitude) - radians(p_lng)) +
          sin(radians(p_lat)) * sin(radians(v_job.latitude))
        ))
      ))::numeric, 2
    );

    -- Enforce geofence boundary for worker self check-in (maximum 1.0 km radius)
    IF v_distance > 1.0 THEN
      RETURN jsonb_build_object(
        'success', false,
        'error_code', 'OUT_OF_GEOFENCE_RANGE',
        'message', 'Check-in location is outside the venue geofence boundary (' || v_distance || ' km away, max 1.0 km allowed).'
      );
    END IF;
  ELSE
    -- For supervisor check-in, compute distance if both coordinates are present and valid
    IF p_lat IS NOT NULL AND p_lng IS NOT NULL AND v_job.latitude IS NOT NULL AND v_job.longitude IS NOT NULL THEN
      IF p_lat >= -90.0 AND p_lat <= 90.0 AND p_lng >= -180.0 AND p_lng <= 180.0 THEN
        v_distance := round(
          (6371 * acos(
            least(1.0, greatest(-1.0,
              cos(radians(p_lat)) * cos(radians(v_job.latitude)) *
              cos(radians(v_job.longitude) - radians(p_lng)) +
              sin(radians(p_lat)) * sin(radians(v_job.latitude))
            ))
          ))::numeric, 2
        );
      END IF;
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



-- ##############################################################################
-- START MIGRATION: 20261012000004_payments_and_earnings.sql
-- ##############################################################################

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
  v_worker_upi TEXT;
  v_target_upi TEXT;
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

  -- 2. Resolve payout destination from worker verified profile (prevents destination hijacking)
  SELECT upi_id INTO v_worker_upi
  FROM worker_profiles
  WHERE id = v_booking.worker_id;

  IF v_worker_upi IS NULL OR trim(v_worker_upi) = '' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Worker does not have a verified UPI payout destination configured in their profile.'
    );
  END IF;

  -- Validate format of worker's registered UPI ID
  IF v_worker_upi !~* '^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Worker profile contains an invalid UPI ID format.');
  END IF;

  -- If caller supplied a UPI ID, it must match worker's verified profile UPI ID to prevent diversion
  IF p_upi_id IS NOT NULL AND trim(p_upi_id) != '' AND lower(trim(p_upi_id)) != lower(trim(v_worker_upi)) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Supplied UPI destination does not match worker verified payout profile. Diversion prohibited.'
    );
  END IF;

  v_target_upi := trim(v_worker_upi);

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

    -- Update pending or failed payout with verified worker UPI ID
    UPDATE payment_records
    SET
      upi_id = v_target_upi,
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
    v_target_upi,
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
      'upi_id', v_target_upi,
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



-- ##############################################################################
-- START MIGRATION: 20261012000005_notifications_and_realtime.sql
-- ##############################################################################

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


-- ##############################################################################
-- START MIGRATION: 20261012000006_admin_and_trust_operations.sql
-- ##############################################################################

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
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'completed', 'cancelled', 'failed')),
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
  -- Strict administrative or trusted service-role authorization
  IF NOT (is_current_admin() OR auth.role() = 'service_role' OR current_user = 'postgres') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized. Administrative credentials or service role required to run purge worker.');
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

    -- Redact KYC document references
    UPDATE verification_cases
    SET
      document_storage_path = 'purged',
      document_masked_id = 'PURGED',
      rejection_reason = 'Account purged upon user deletion request'
    WHERE profile_id = v_rec.user_id;

    -- Remove personal notifications
    DELETE FROM notifications
    WHERE user_id = v_rec.user_id;

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

    -- Invalidate and permanently disable auth user account in auth.users
    DECLARE
      v_auth_ok BOOLEAN := true;
      v_auth_err TEXT := NULL;
    BEGIN
      BEGIN
        UPDATE auth.users
        SET
          email = 'purged_' || v_rec.user_id::text || '@opskil.internal',
          phone = NULL,
          raw_user_meta_data = '{}'::jsonb,
          banned_until = '3000-01-01 00:00:00+00'::timestamptz
        WHERE id = v_rec.user_id;
      EXCEPTION WHEN OTHERS THEN
        v_auth_ok := false;
        v_auth_err := SQLERRM;
      END;

      IF NOT v_auth_ok THEN
        -- Mark as failed/retryable; never mark completed if auth invalidation fails
        UPDATE account_deletion_requests
        SET status = 'failed', updated_at = v_now
        WHERE id = v_rec.request_id;

        INSERT INTO audit_logs (
          actor_id, action, entity_type, entity_id, changes, created_at
        ) VALUES (
          COALESCE(auth.uid(), v_rec.user_id),
          'account_purge_failed',
          'profile',
          v_rec.user_id::text,
          jsonb_build_object(
            'request_id', v_rec.request_id,
            'error', v_auth_err,
            'status', 'failed'
          ),
          v_now
        );
        CONTINUE;
      END IF;
    END;

    -- Mark request as completed only when all purge and credential invalidation steps succeed
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
GRANT EXECUTE ON FUNCTION process_account_deletion_purge_safe(INT) TO service_role, authenticated;




-- ##############################################################################
-- START MIGRATION: 20261015000000_launch_fixes.sql
-- ##############################################################################

-- ==============================================================================
-- OPSKL LAUNCH FIXES & PRODUCTION MARKETPLACE ENGINE (PHASE 1)
-- Sequential Migration: 20261015000000_launch_fixes.sql
-- Enforces:
--  1.1 Trusted internal trigger bypass (set_config 'opskl.trusted')
--  1.2 Dispute detail handling & direct insert lockdown
--  1.3 Organizer signup phone relaxation & CSPRNG booking codes
--  1.4 RLS privacy hardening, public_jobs view & supervisor RPC
--  1.5 Job lifecycle state machine & non-resurrecting reopen guards
--  1.6 Overlapping booking guards & internal _notify helper
--  1.7 Application withdraw/re-apply & SQL keyset discovery feed
--  1.8 Check-in time window, geofencing & SQL hours adjustment
--  1.9 Admin dispute arbitration, KYC resolution & purge safety
--  1.10 FY sequential invoices, manual escrow & payout settlement
--  1.11 Overnight shifts, Indian coordinate bounds & realtime bindings
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1.1 TRIGGER BYPASS FOR TRUSTED INTERNAL UPDATES
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION check_worker_profile_update()
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
    IF NEW.upi_id !~* '^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$' THEN
      RAISE EXCEPTION 'Invalid UPI ID format. Payout destination handle must be valid (e.g. name@bank).';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION check_organizer_profile_update()
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
    RAISE EXCEPTION 'Unauthorized: Organizer profile ID cannot be modified.';
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

CREATE OR REPLACE FUNCTION prevent_role_escalation()
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

  IF NEW.role IS DISTINCT FROM OLD.role THEN
    RAISE EXCEPTION 'Unauthorized: Users cannot change their assigned role.';
  END IF;

  IF NEW.is_active IS DISTINCT FROM OLD.is_active THEN
    RAISE EXCEPTION 'Unauthorized: Account activation status cannot be modified directly by users.';
  END IF;

  IF NEW.id IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION 'Unauthorized: Profile ID cannot be modified.';
  END IF;

  RETURN NEW;
END;
$$;

-- ------------------------------------------------------------------------------
-- 1.2 DISPUTES SCHEMA & RPC HARDENING
-- ------------------------------------------------------------------------------

ALTER TABLE disputes ADD COLUMN IF NOT EXISTS details TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS status_before_dispute TEXT;

DROP POLICY IF EXISTS "Participants create disputes" ON disputes;

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
  v_details TEXT;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'UNAUTHENTICATED');
  END IF;

  IF length(trim(COALESCE(p_reason, ''))) < 10 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'INVALID_REASON',
      'message', 'Dispute reason must be at least 10 characters long.'
    );
  END IF;

  SELECT * INTO v_booking FROM bookings WHERE id = p_booking_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'BOOKING_NOT_FOUND');
  END IF;

  IF v_user_id != v_booking.worker_id AND v_user_id != v_booking.organizer_id AND NOT is_current_admin() THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'UNAUTHORIZED');
  END IF;

  IF NOT validate_booking_transition(v_booking.status, 'disputed') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'INVALID_TRANSITION',
      'message', 'Cannot dispute booking from status ' || v_booking.status
    );
  END IF;

  v_respondent_id := CASE WHEN v_user_id = v_booking.worker_id THEN v_booking.organizer_id ELSE v_booking.worker_id END;
  v_details := COALESCE(NULLIF(trim(p_evidence), ''), trim(p_reason));

  UPDATE bookings
  SET
    status_before_dispute = v_booking.status,
    status = 'disputed',
    dispute_reason = trim(p_reason)
  WHERE id = p_booking_id;

  INSERT INTO disputes (
    booking_id, raised_by, respondent_id, reason, details, status
  ) VALUES (
    p_booking_id, v_user_id, v_respondent_id, trim(p_reason), v_details, 'open'
  ) RETURNING id INTO v_dispute_id;

  -- Notify respondent
  INSERT INTO notifications (
    user_id, title, body, type, channel, delivery_status, data
  ) VALUES (
    v_respondent_id,
    'Booking Record Disputed',
    'A dispute has been opened regarding your shift booking. An Opskl Admin will arbitrate.',
    'dispute_update',
    'in_app',
    'delivered',
    jsonb_build_object('dispute_id', v_dispute_id, 'booking_id', p_booking_id)
  );

  INSERT INTO audit_logs (
    actor_id, action, entity_type, entity_id, new_state
  ) VALUES (
    v_user_id, 'DISPUTE_BOOKING', 'dispute', v_dispute_id::TEXT,
    jsonb_build_object('booking_id', p_booking_id, 'reason', p_reason, 'status_before_dispute', v_booking.status)
  );

  RETURN jsonb_build_object(
    'success', true,
    'dispute_id', v_dispute_id,
    'status', 'disputed'
  );
END;
$$;

-- ------------------------------------------------------------------------------
-- 1.3 ORGANIZER SIGNUP & CSPRNG BOOKING CODE
-- ------------------------------------------------------------------------------

ALTER TABLE organizer_profiles ALTER COLUMN business_contact_phone DROP NOT NULL;

CREATE OR REPLACE FUNCTION public.handle_new_user_provisioning()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role user_role;
  v_phone TEXT;
  v_name TEXT;
  v_email TEXT;
BEGIN
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

  INSERT INTO public.profiles (
    id, role, phone, full_name, email, city, is_active
  ) VALUES (
    NEW.id, v_role, v_phone, v_name, v_email, 'Mumbai', true
  )
  ON CONFLICT (id) DO UPDATE SET
    email = COALESCE(EXCLUDED.email, profiles.email);

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
      NEW.id, v_name, COALESCE(v_phone, ''), v_email, 'event_agency', 'incomplete', 'unverified'
    )
    ON CONFLICT (id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

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

-- ------------------------------------------------------------------------------
-- 1.4 RLS PRIVACY, PUBLIC_JOBS VIEW & SUPERVISOR RPC
-- ------------------------------------------------------------------------------

DROP POLICY IF EXISTS "Workers view organizer on active jobs" ON organizer_profiles;
REVOKE SELECT ON public_organizer_cards FROM anon;
GRANT SELECT ON public_organizer_cards TO authenticated;

DROP POLICY IF EXISTS "Anyone authenticated can view open jobs" ON jobs;
CREATE POLICY "Anyone authenticated can view open jobs"
  ON jobs FOR SELECT TO authenticated
  USING (status IN ('open', 'filling'));

-- Create public discovery view that shields supervisor direct contact details
CREATE OR REPLACE VIEW public_jobs AS
  SELECT
    id,
    organizer_id,
    title,
    category,
    venue_name,
    venue_address,
    landmark,
    city,
    zone,
    date,
    start_time,
    end_time,
    duration_hours,
    hourly_rate,
    total_pay,
    wage_per_worker,
    slots_total,
    slots_filled,
    dress_code,
    duties,
    perks,
    required_skills,
    eligibility_criteria,
    application_deadline,
    breaks_minutes,
    meal_provided,
    transport_provided,
    overtime_policy,
    latitude,
    longitude,
    status,
    created_at,
    updated_at
  FROM jobs;

REVOKE SELECT ON public_jobs FROM anon;
GRANT SELECT ON public_jobs TO authenticated;

-- Disclose supervisor phone/name only to confirmed workers, organizer, or admin
CREATE OR REPLACE FUNCTION get_job_contact(p_job_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_job RECORD;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'UNAUTHENTICATED');
  END IF;

  SELECT id, organizer_id, supervisor_name, supervisor_phone INTO v_job
  FROM jobs WHERE id = p_job_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'JOB_NOT_FOUND');
  END IF;

  IF v_job.organizer_id = v_user_id OR is_current_admin() OR EXISTS (
    SELECT 1 FROM bookings
    WHERE job_id = p_job_id
      AND worker_id = v_user_id
      AND status IN ('confirmed', 'checked_in', 'checked_out', 'completed_awaiting_review', 'completed')
  ) THEN
    RETURN jsonb_build_object(
      'success', true,
      'supervisor_name', v_job.supervisor_name,
      'supervisor_phone', v_job.supervisor_phone
    );
  END IF;

  RETURN jsonb_build_object(
    'success', false,
    'error_code', 'UNAUTHORIZED',
    'message', 'Supervisor contact details are disclosed only upon booking confirmation.'
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION get_job_contact(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION get_job_contact(UUID) TO authenticated;

-- Reviews RLS & RPC
DROP POLICY IF EXISTS "Users view reviews" ON reviews;
DROP POLICY IF EXISTS "Participants create reviews" ON reviews;
DROP POLICY IF EXISTS "Participants and admins view reviews" ON reviews;

CREATE POLICY "Participants and admins view reviews"
  ON reviews FOR SELECT TO authenticated
  USING (reviewer_id = auth.uid() OR reviewee_id = auth.uid() OR is_current_admin());

CREATE OR REPLACE FUNCTION submit_review_safe(
  p_booking_id UUID,
  p_rating INTEGER,
  p_comment TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_booking RECORD;
  v_target_id UUID;
  v_review_id UUID;
  v_avg_rating NUMERIC(3, 2);
  v_total_reviews INT;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'UNAUTHENTICATED');
  END IF;

  IF p_rating < 1 OR p_rating > 5 THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'INVALID_RATING', 'message', 'Rating must be between 1 and 5');
  END IF;

  SELECT * INTO v_booking FROM bookings WHERE id = p_booking_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'BOOKING_NOT_FOUND');
  END IF;

  IF v_booking.status != 'completed' THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'BOOKING_NOT_COMPLETED', 'message', 'Reviews can only be submitted for completed shifts.');
  END IF;

  IF v_user_id = v_booking.worker_id THEN
    v_target_id := v_booking.organizer_id;
  ELSIF v_user_id = v_booking.organizer_id THEN
    v_target_id := v_booking.worker_id;
  ELSE
    RETURN jsonb_build_object('success', false, 'error_code', 'UNAUTHORIZED');
  END IF;

  IF EXISTS (SELECT 1 FROM reviews WHERE booking_id = p_booking_id AND reviewer_id = v_user_id) THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'ALREADY_REVIEWED', 'message', 'You have already submitted a review for this booking.');
  END IF;

  INSERT INTO reviews (
    job_id, booking_id, reviewer_id, reviewee_id, rating, comment
  ) VALUES (
    v_booking.job_id, p_booking_id, v_user_id, v_target_id, p_rating, NULLIF(trim(p_comment), '')
  ) RETURNING id INTO v_review_id;

  -- Recompute average rating and total reviews on reviewee profile using trusted bypass
  PERFORM set_config('opskl.trusted', '1', true);

  IF v_target_id = v_booking.worker_id THEN
    SELECT round(avg(rating)::numeric, 2), count(*) INTO v_avg_rating, v_total_reviews
    FROM reviews WHERE reviewee_id = v_target_id;

    UPDATE worker_profiles
    SET rating = v_avg_rating, total_reviews = v_total_reviews, updated_at = now()
    WHERE id = v_target_id;
  ELSIF v_target_id = v_booking.organizer_id THEN
    SELECT round(avg(rating)::numeric, 2) INTO v_avg_rating
    FROM reviews WHERE reviewee_id = v_target_id;

    UPDATE organizer_profiles
    SET rating = v_avg_rating, updated_at = now()
    WHERE id = v_target_id;
  END IF;

  RETURN jsonb_build_object('success', true, 'review_id', v_review_id, 'rating', p_rating);
END;
$$;

REVOKE EXECUTE ON FUNCTION submit_review_safe(UUID, INTEGER, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION submit_review_safe(UUID, INTEGER, TEXT) TO authenticated;

-- Safety reports RLS tightening
DROP POLICY IF EXISTS "Users can create safety reports" ON safety_reports;
CREATE POLICY "Users can create safety reports"
  ON safety_reports FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = reporter_id
    AND status = 'open'
    AND resolved_by IS NULL
    AND staff_notes IS NULL
    AND action_taken IS NULL
  );

-- Job applications insert direct policy removal (RPC only)
DROP POLICY IF EXISTS "Workers apply to open jobs" ON job_applications;

-- Admin select policies
DROP POLICY IF EXISTS "Admins view all worker profiles" ON worker_profiles;
CREATE POLICY "Admins view all worker profiles"
  ON worker_profiles FOR SELECT TO authenticated
  USING (is_current_admin());

DROP POLICY IF EXISTS "Admins view all payment records" ON payment_records;
CREATE POLICY "Admins view all payment records"
  ON payment_records FOR SELECT TO authenticated
  USING (is_current_admin());

DROP POLICY IF EXISTS "Admins view all reviews" ON reviews;
CREATE POLICY "Admins view all reviews"
  ON reviews FOR SELECT TO authenticated
  USING (is_current_admin());

-- ------------------------------------------------------------------------------
-- 1.5 JOB LIFECYCLE STATE MACHINE & EXPIRATION WORKER
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION validate_job_transition(
  p_current_status TEXT,
  p_new_status TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF p_current_status = p_new_status THEN
    RETURN true;
  END IF;

  IF p_current_status = 'draft' AND p_new_status IN ('open', 'cancelled') THEN
    RETURN true;
  ELSIF p_current_status = 'open' AND p_new_status IN ('filling', 'filled', 'paused', 'cancelled') THEN
    RETURN true;
  ELSIF p_current_status = 'filling' AND p_new_status IN ('filled', 'paused', 'cancelled') THEN
    RETURN true;
  ELSIF p_current_status = 'filled' AND p_new_status IN ('filling', 'cancelled', 'in_progress') THEN
    RETURN true;
  ELSIF p_current_status = 'paused' AND p_new_status IN ('open', 'filling', 'cancelled') THEN
    RETURN true;
  ELSIF p_current_status = 'in_progress' AND p_new_status = 'completed' THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

-- Helper to safely send an in-app notification respecting preferences
CREATE OR REPLACE FUNCTION _notify(
  p_user_id UUID,
  p_title TEXT,
  p_body TEXT,
  p_type TEXT,
  p_action_url TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}',
  p_idempotency_key TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prefs RECORD;
  v_delivery_status TEXT := 'delivered';
  v_notification_id UUID;
BEGIN
  SELECT in_app_enabled INTO v_prefs
  FROM user_notification_preferences
  WHERE user_id = p_user_id;

  IF FOUND AND v_prefs.in_app_enabled = false THEN
    v_delivery_status := 'suppressed';
  END IF;

  INSERT INTO notifications (
    user_id,
    title,
    body,
    type,
    channel,
    delivery_status,
    action_url,
    priority,
    data,
    idempotency_key
  ) VALUES (
    p_user_id,
    p_title,
    p_body,
    p_type,
    'in_app',
    v_delivery_status,
    p_action_url,
    'normal',
    p_metadata,
    p_idempotency_key
  )
  ON CONFLICT (idempotency_key) DO NOTHING
  RETURNING id INTO v_notification_id;

  RETURN v_notification_id;
END;
$$;

CREATE OR REPLACE FUNCTION update_job_status_safe(
  p_job_id UUID,
  p_new_status shift_status,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id UUID := auth.uid();
  v_job RECORD;
  v_booking RECORD;
  v_invoice RECORD;
BEGIN
  IF v_actor_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'UNAUTHENTICATED');
  END IF;

  SELECT * INTO v_job FROM jobs WHERE id = p_job_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'JOB_NOT_FOUND', 'message', 'Shift listing not found');
  END IF;

  IF v_job.organizer_id != v_actor_id AND NOT is_current_admin() THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'UNAUTHORIZED', 'message', 'Not authorized to update this shift');
  END IF;

  -- Validate state machine transition
  IF NOT validate_job_transition(v_job.status::TEXT, p_new_status::TEXT) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'INVALID_TRANSITION',
      'message', 'Cannot transition shift from ' || v_job.status || ' to ' || p_new_status
    );
  END IF;

  -- Enforce killswitch if attempting to open a shift while paused
  IF p_new_status IN ('open', 'filling') AND EXISTS (
    SELECT 1 FROM platform_settings
    WHERE key = 'booking_killswitch' AND (value->>'is_paused')::BOOLEAN = true
  ) THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'BOOKINGS_PAUSED', 'message', 'Cannot activate shifts while marketplace bookings are paused');
  END IF;

  -- Atomic cancellation cascade
  IF p_new_status = 'cancelled' THEN
    -- Cancel non-terminal bookings
    FOR v_booking IN
      SELECT b.id, b.worker_id FROM bookings b
      WHERE b.job_id = p_job_id AND b.status IN ('selected_awaiting_confirmation', 'confirmed')
    LOOP
      UPDATE bookings
      SET status = 'cancelled', cancellation_reason = COALESCE(p_reason, 'Shift cancelled by organizer'), cancelled_by = v_actor_id
      WHERE id = v_booking.id;

      PERFORM _notify(
        v_booking.worker_id,
        'Shift Cancelled',
        'Your shift for ' || v_job.title || ' has been cancelled: ' || COALESCE(p_reason, 'Cancelled by organizer'),
        'shift_cancelled',
        '/shift/' || p_job_id,
        jsonb_build_object('job_id', p_job_id, 'reason', p_reason)
      );
    END LOOP;

    -- Set active applications to rejected so worker discovery feed correctly identifies past rejection
    UPDATE job_applications
    SET status = 'rejected'
    WHERE job_id = p_job_id AND status IN ('applied', 'shortlisted');

    -- Flag funded invoice for refund review
    SELECT * INTO v_invoice FROM organizer_invoices WHERE job_id = p_job_id AND status = 'escrow_funded';
    IF FOUND THEN
      INSERT INTO payment_reconciliation_logs (
        reconciliation_type, reference_id, status, expected_amount, recorded_amount, discrepancy_amount, notes, actor_id
      ) VALUES (
        'refund', v_invoice.invoice_number, 'discrepancy', v_invoice.total_payable, 0.00, v_invoice.total_payable,
        'Shift cancelled after escrow funded. Pending organizer refund reconciliation.', v_actor_id
      );
    END IF;
  END IF;

  UPDATE jobs
  SET status = p_new_status, updated_at = now()
  WHERE id = p_job_id;

  INSERT INTO audit_logs (
    actor_id, action, entity_type, entity_id, new_state
  ) VALUES (
    v_actor_id, 'UPDATE_JOB_STATUS', 'job', p_job_id::TEXT,
    jsonb_build_object('old_status', v_job.status, 'new_status', p_new_status, 'reason', p_reason)
  );

  RETURN jsonb_build_object('success', true, 'status', p_new_status);
END;
$$;

-- Scheduled background maintenance: close expired jobs and reconcile stale check-ins
CREATE OR REPLACE FUNCTION close_expired_jobs()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job RECORD;
  v_has_completed BOOLEAN;
  v_jobs_closed INT := 0;
  v_stale_bookings INT := 0;
BEGIN
  -- 1. Close past-dated open/filling/filled jobs
  FOR v_job IN
    SELECT id, status FROM jobs
    WHERE date < (now() AT TIME ZONE 'Asia/Kolkata')::date
      AND status IN ('open', 'filling', 'filled')
  LOOP
    SELECT EXISTS (SELECT 1 FROM bookings WHERE job_id = v_job.id AND status = 'completed') INTO v_has_completed;
    IF v_has_completed THEN
      UPDATE jobs SET status = 'completed', updated_at = now() WHERE id = v_job.id;
    ELSE
      UPDATE jobs SET status = 'cancelled', updated_at = now() WHERE id = v_job.id;
    END IF;
    v_jobs_closed := v_jobs_closed + 1;
  END LOOP;

  -- 2. Mark stale checked-in bookings (> 16 hours) as completed_awaiting_review
  WITH updated AS (
    UPDATE bookings
    SET status = 'completed_awaiting_review'
    WHERE status = 'checked_in'
      AND check_in_time < (now() - interval '16 hours')
    RETURNING id
  )
  SELECT count(*) INTO v_stale_bookings FROM updated;

  RETURN jsonb_build_object(
    'success', true,
    'jobs_closed', v_jobs_closed,
    'stale_bookings_advanced', v_stale_bookings
  );
END;
$$;

-- ------------------------------------------------------------------------------
-- 1.6 HIRING RULES & DOUBLE-BOOKING GUARDS
-- ------------------------------------------------------------------------------

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
  v_allow_direct BOOLEAN := false;
  v_job_start TIMESTAMPTZ;
  v_job_end TIMESTAMPTZ;
BEGIN
  IF v_organizer_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'UNAUTHENTICATED');
  END IF;

  SELECT id, organizer_id, title, date, start_time, end_time, status, slots_total, slots_filled, hourly_rate, total_pay
  INTO v_job
  FROM jobs
  WHERE id = p_job_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'JOB_NOT_FOUND', 'message', 'Shift listing not found');
  END IF;

  -- Owner-only permissions check (DECISION: default owner-only)
  IF v_job.organizer_id != v_organizer_id AND NOT is_current_admin() THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'UNAUTHORIZED', 'message', 'Not authorized to hire for this shift');
  END IF;

  -- Platform Killswitch Check
  IF EXISTS (
    SELECT 1 FROM platform_settings
    WHERE key = 'booking_killswitch' AND (value->>'is_paused')::BOOLEAN = true
  ) THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'BOOKINGS_PAUSED', 'message', 'Shift bookings are temporarily paused platform-wide.');
  END IF;

  -- Require organizer verified (or admin)
  IF NOT EXISTS (
    SELECT 1 FROM organizer_profiles
    WHERE id = v_job.organizer_id AND (verification_status = 'verified' OR is_current_admin())
  ) THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'UNVERIFIED_ORGANIZER', 'message', 'Organizer identity verification required before hiring.');
  END IF;

  -- Require shift status in open/filling and date >= today IST
  IF v_job.status NOT IN ('open', 'filling') THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'JOB_NOT_OPEN', 'message', 'Shift is not open for hiring.');
  END IF;

  IF v_job.date < (now() AT TIME ZONE 'Asia/Kolkata')::date THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'PAST_DATE', 'message', 'Cannot hire workers for past shifts.');
  END IF;

  -- Capacity check
  IF v_job.slots_filled >= v_job.slots_total THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'SLOTS_FULL', 'message', 'All openings for this shift have already been filled.');
  END IF;

  -- Existing application check (DECISION: direct invites rejected by default)
  SELECT COALESCE((value->>'allow_direct_invites')::boolean, false) INTO v_allow_direct
  FROM platform_settings WHERE key = 'allow_direct_invites';

  SELECT id, status INTO v_app
  FROM job_applications
  WHERE job_id = p_job_id AND worker_id = p_worker_id;

  IF NOT FOUND THEN
    IF NOT v_allow_direct THEN
      RETURN jsonb_build_object('success', false, 'error_code', 'APPLICATION_REQUIRED', 'message', 'Worker must apply to shift before being confirmed.');
    END IF;
  ELSE
    IF v_app.status NOT IN ('applied', 'shortlisted') THEN
      RETURN jsonb_build_object('success', false, 'error_code', 'INVALID_APPLICATION_STATUS', 'message', 'Application must be applied or shortlisted.');
    END IF;
  END IF;

  -- Check for double-booking / overlapping confirmed/checked_in shifts on the same date
  v_job_start := (v_job.date + v_job.start_time) AT TIME ZONE 'Asia/Kolkata';
  v_job_end := (v_job.date + v_job.end_time + CASE WHEN v_job.end_time <= v_job.start_time THEN interval '1 day' ELSE interval '0' END) AT TIME ZONE 'Asia/Kolkata';

  IF EXISTS (
    SELECT 1 FROM bookings b
    JOIN jobs j ON j.id = b.job_id
    WHERE b.worker_id = p_worker_id
      AND b.status IN ('confirmed', 'checked_in')
      AND (
        ( (j.date + j.start_time) AT TIME ZONE 'Asia/Kolkata' ) < v_job_end
        AND
        ( (j.date + j.end_time + CASE WHEN j.end_time <= j.start_time THEN interval '1 day' ELSE interval '0' END) AT TIME ZONE 'Asia/Kolkata' ) > v_job_start
      )
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'OVERLAPPING_SHIFT_SCHEDULE',
      'message', 'Worker is already confirmed for an overlapping shift during these hours.'
    );
  END IF;

  -- CSPRNG check-in code without pgcrypto dependency
  v_check_in_code := 'OP-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));

  -- Create booking record
  INSERT INTO bookings (
    job_id, worker_id, organizer_id, status,
    agreed_hourly_rate, agreed_total_pay, approved_total_pay, check_in_code
  ) VALUES (
    p_job_id, p_worker_id, v_job.organizer_id, 'confirmed',
    v_job.hourly_rate, v_job.total_pay, v_job.total_pay, v_check_in_code
  )
  ON CONFLICT (job_id, worker_id) DO UPDATE SET
    status = 'confirmed',
    agreed_hourly_rate = EXCLUDED.agreed_hourly_rate,
    agreed_total_pay = EXCLUDED.agreed_total_pay,
    approved_total_pay = EXCLUDED.approved_total_pay,
    check_in_code = EXCLUDED.check_in_code
  RETURNING * INTO v_new_booking;

  -- Update application status
  IF v_app.id IS NOT NULL THEN
    UPDATE job_applications
    SET status = 'confirmed', updated_at = now()
    WHERE id = v_app.id;
  END IF;

  -- Increment filled slots
  UPDATE jobs
  SET
    slots_filled = slots_filled + 1,
    status = CASE WHEN slots_filled + 1 >= slots_total THEN 'filled'::shift_status ELSE 'filling'::shift_status END,
    updated_at = now()
  WHERE id = p_job_id;

  -- Automatically generate idempotent job invoice for escrow funding on first confirmed booking
  PERFORM generate_job_invoice_safe(p_job_id);

  -- Send worker notification
  PERFORM _notify(
    p_worker_id,
    'Shift Booking Confirmed!',
    'You have been confirmed for ' || v_job.title || '. Check details and venue instructions.',
    'booking_confirmed',
    '/shift/' || p_job_id,
    jsonb_build_object('job_id', p_job_id, 'booking_id', v_new_booking.id)
  );

  INSERT INTO audit_logs (
    actor_id, action, entity_type, entity_id, new_state
  ) VALUES (
    v_organizer_id, 'CONFIRM_WORKER_BOOKING', 'booking', v_new_booking.id::TEXT,
    jsonb_build_object('job_id', p_job_id, 'worker_id', p_worker_id, 'agreed_pay', v_job.total_pay)
  );

  RETURN jsonb_build_object(
    'success', true,
    'booking_id', v_new_booking.id,
    'status', 'confirmed',
    'check_in_code', v_check_in_code
  );
END;
$$;

-- ------------------------------------------------------------------------------
-- 1.7 APPLICATIONS WITHDRAWAL, RE-APPLY & SQL DISCOVERY FEED
-- ------------------------------------------------------------------------------

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
BEGIN
  IF v_organizer_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'UNAUTHENTICATED');
  END IF;

  IF p_new_status NOT IN ('shortlisted', 'rejected') THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'INVALID_STATUS', 'message', 'Status must be shortlisted or rejected.');
  END IF;

  SELECT ja.id, ja.job_id, ja.worker_id, ja.status, j.organizer_id, j.title
  INTO v_app
  FROM job_applications ja
  JOIN jobs j ON j.id = ja.job_id
  WHERE ja.id = p_application_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'APPLICATION_NOT_FOUND');
  END IF;

  IF v_app.organizer_id != v_organizer_id AND NOT is_current_admin() THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'UNAUTHORIZED');
  END IF;

  -- Enforce transition matrix
  IF v_app.status NOT IN ('applied', 'shortlisted') AND NOT (v_app.status = 'rejected' AND p_new_status = 'shortlisted') THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'INVALID_TRANSITION', 'message', 'Cannot transition application from ' || v_app.status);
  END IF;

  UPDATE job_applications
  SET status = p_new_status::application_status, updated_at = now()
  WHERE id = p_application_id;

  IF p_new_status = 'shortlisted' THEN
    PERFORM _notify(
      v_app.worker_id,
      'Profile Shortlisted',
      'The organizer has shortlisted you for ' || v_app.title || '. Keep your schedule open.',
      'application_shortlisted',
      '/shift/' || v_app.job_id,
      jsonb_build_object('job_id', v_app.job_id)
    );
  ELSIF p_new_status = 'rejected' THEN
    PERFORM _notify(
      v_app.worker_id,
      'Application Update',
      'Your application for ' || v_app.title || ' was not selected by the organizer.',
      'application_rejected',
      '/shift/' || v_app.job_id,
      jsonb_build_object('job_id', v_app.job_id)
    );
  END IF;

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
  v_worker RECORD;
  v_existing_app RECORD;
  v_app_id UUID;
BEGIN
  IF v_worker_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'UNAUTHENTICATED');
  END IF;

  -- Require worker profile completed
  SELECT p.is_active, wp.profile_completion_status INTO v_worker
  FROM profiles p
  JOIN worker_profiles wp ON wp.id = p.id
  WHERE p.id = v_worker_id;

  IF NOT FOUND OR v_worker.is_active = false THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'INELIGIBLE_WORKER', 'message', 'Active worker account required.');
  END IF;

  IF v_worker.profile_completion_status != 'completed' THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'PROFILE_INCOMPLETE', 'message', 'Please complete your onboarding profile before applying.');
  END IF;

  SELECT * INTO v_job FROM jobs WHERE id = p_job_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'JOB_NOT_FOUND');
  END IF;

  IF v_job.status NOT IN ('open', 'filling') THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'JOB_CLOSED', 'message', 'This shift is no longer open for applications.');
  END IF;

  IF v_job.date < (now() AT TIME ZONE 'Asia/Kolkata')::date THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'PAST_DATE', 'message', 'Shift date has already passed.');
  END IF;

  IF v_job.application_deadline IS NOT NULL AND v_job.application_deadline < now() THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'DEADLINE_PASSED');
  END IF;

  IF v_job.slots_filled >= v_job.slots_total THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'SLOTS_FULL');
  END IF;

  SELECT id, status INTO v_existing_app
  FROM job_applications
  WHERE job_id = p_job_id AND worker_id = v_worker_id;

  IF FOUND THEN
    IF v_existing_app.status = 'withdrawn' THEN
      UPDATE job_applications
      SET status = 'applied', updated_at = now()
      WHERE id = v_existing_app.id;

      RETURN jsonb_build_object('success', true, 'application_id', v_existing_app.id, 'status', 'applied', 'reapplied', true);
    ELSE
      RETURN jsonb_build_object('success', false, 'error_code', 'ALREADY_APPLIED', 'message', 'You have already applied for this shift.');
    END IF;
  END IF;

  INSERT INTO job_applications (
    job_id, worker_id, status
  ) VALUES (
    p_job_id, v_worker_id, 'applied'
  ) RETURNING id INTO v_app_id;

  INSERT INTO audit_logs (
    actor_id, action, entity_type, entity_id, new_state
  ) VALUES (
    v_worker_id, 'APPLY_FOR_JOB', 'application', v_app_id::TEXT,
    jsonb_build_object('job_id', p_job_id, 'status', 'applied')
  );

  RETURN jsonb_build_object('success', true, 'application_id', v_app_id, 'status', 'applied');
END;
$$;

CREATE OR REPLACE FUNCTION withdraw_application_safe(p_application_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_worker_id UUID := auth.uid();
  v_app RECORD;
BEGIN
  IF v_worker_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'UNAUTHENTICATED');
  END IF;

  SELECT * INTO v_app FROM job_applications WHERE id = p_application_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'APPLICATION_NOT_FOUND');
  END IF;

  IF v_app.worker_id != v_worker_id AND NOT is_current_admin() THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'UNAUTHORIZED');
  END IF;

  IF v_app.status NOT IN ('applied', 'shortlisted') THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'CANNOT_WITHDRAW', 'message', 'Can only withdraw pending or shortlisted applications.');
  END IF;

  UPDATE job_applications
  SET status = 'withdrawn', updated_at = now()
  WHERE id = p_application_id;

  INSERT INTO audit_logs (
    actor_id, action, entity_type, entity_id, new_state
  ) VALUES (
    v_worker_id, 'WITHDRAW_APPLICATION', 'application', p_application_id::TEXT,
    jsonb_build_object('old_status', v_app.status, 'new_status', 'withdrawn')
  );

  RETURN jsonb_build_object('success', true, 'status', 'withdrawn');
END;
$$;

REVOKE EXECUTE ON FUNCTION withdraw_application_safe(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION withdraw_application_safe(UUID) TO authenticated;

-- Keyset-paginated SQL discovery feed
CREATE OR REPLACE FUNCTION get_discovery_feed(
  p_filters JSONB DEFAULT '{}',
  p_limit INT DEFAULT 20,
  p_cursor JSONB DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  organizer_id UUID,
  title TEXT,
  category shift_category,
  venue_name TEXT,
  venue_address TEXT,
  landmark TEXT,
  city TEXT,
  zone TEXT,
  date DATE,
  start_time TIME,
  end_time TIME,
  duration_hours NUMERIC,
  hourly_rate NUMERIC,
  total_pay NUMERIC,
  wage_per_worker NUMERIC,
  slots_total INTEGER,
  slots_filled INTEGER,
  dress_code TEXT,
  duties TEXT[],
  perks TEXT[],
  required_skills TEXT[],
  eligibility_criteria TEXT,
  breaks_minutes INTEGER,
  meal_provided BOOLEAN,
  transport_provided BOOLEAN,
  overtime_policy TEXT,
  latitude NUMERIC,
  longitude NUMERIC,
  status shift_status,
  created_at TIMESTAMPTZ,
  organizer_business_name TEXT,
  organizer_rating NUMERIC,
  organizer_verified BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_zone TEXT := NULLIF(trim(p_filters->>'zone'), '');
  v_category TEXT := NULLIF(trim(p_filters->>'category'), '');
  v_min_pay NUMERIC := (p_filters->>'min_pay')::NUMERIC;
  v_cursor_date DATE;
  v_cursor_pay NUMERIC;
  v_cursor_id UUID;
BEGIN
  IF p_cursor IS NOT NULL THEN
    v_cursor_date := (p_cursor->>'date')::DATE;
    v_cursor_pay := (p_cursor->>'total_pay')::NUMERIC;
    v_cursor_id := (p_cursor->>'id')::UUID;
  END IF;

  RETURN QUERY
  SELECT
    j.id,
    j.organizer_id,
    j.title,
    j.category,
    j.venue_name,
    j.venue_address,
    j.landmark,
    j.city,
    j.zone,
    j.date,
    j.start_time,
    j.end_time,
    j.duration_hours,
    j.hourly_rate,
    j.total_pay,
    j.wage_per_worker,
    j.slots_total,
    j.slots_filled,
    j.dress_code,
    j.duties,
    j.perks,
    j.required_skills,
    j.eligibility_criteria,
    j.breaks_minutes,
    j.meal_provided,
    j.transport_provided,
    j.overtime_policy,
    j.latitude,
    j.longitude,
    j.status,
    j.created_at,
    op.business_name,
    op.rating,
    (op.verification_status = 'verified')
  FROM jobs j
  JOIN organizer_profiles op ON op.id = j.organizer_id
  WHERE j.status IN ('open', 'filling')
    AND j.date >= (now() AT TIME ZONE 'Asia/Kolkata')::date
    AND j.slots_filled < j.slots_total
    AND (j.application_deadline IS NULL OR j.application_deadline > now())
    AND (v_zone IS NULL OR v_zone = 'all' OR j.zone = v_zone)
    AND (v_category IS NULL OR v_category = 'all' OR j.category::TEXT = v_category)
    AND (v_min_pay IS NULL OR j.total_pay >= v_min_pay)
    -- Exclude shifts with existing applications (applied, shortlisted, confirmed, rejected)
    AND (v_user_id IS NULL OR NOT EXISTS (
      SELECT 1 FROM job_applications ja
      WHERE ja.job_id = j.id AND ja.worker_id = v_user_id AND ja.status IN ('applied', 'shortlisted', 'confirmed', 'rejected')
    ))
    -- Exclude left swipes
    AND (v_user_id IS NULL OR NOT EXISTS (
      SELECT 1 FROM swipe_events se
      WHERE se.job_id = j.id AND se.worker_id = v_user_id AND se.direction = 'left'
    ))
    -- Keyset cursor condition: (date ASC, total_pay DESC, id ASC)
    AND (
      p_cursor IS NULL OR
      (j.date > v_cursor_date) OR
      (j.date = v_cursor_date AND j.total_pay < v_cursor_pay) OR
      (j.date = v_cursor_date AND j.total_pay = v_cursor_pay AND j.id > v_cursor_id)
    )
  ORDER BY j.date ASC, j.total_pay DESC, j.id ASC
  LIMIT LEAST(p_limit, 50);
END;
$$;

REVOKE EXECUTE ON FUNCTION get_discovery_feed(JSONB, INT, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION get_discovery_feed(JSONB, INT, JSONB) TO authenticated;

-- ------------------------------------------------------------------------------
-- 1.8 ATTENDANCE ENGINE & SQL HOURS ADJUSTMENT
-- ------------------------------------------------------------------------------

ALTER TABLE attendance_records ALTER COLUMN distance_to_venue_km TYPE NUMERIC(8, 2);
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS approved_total_pay NUMERIC(10, 2);

-- Cancel / No-show non-resurrecting reopen logic
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
  SELECT * INTO v_booking FROM bookings WHERE id = p_booking_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'BOOKING_NOT_FOUND');
  END IF;

  IF v_user_id != v_booking.worker_id AND v_user_id != v_booking.organizer_id AND NOT is_current_admin() THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'UNAUTHORIZED');
  END IF;

  IF NOT validate_booking_transition(v_booking.status, 'cancelled') THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'INVALID_TRANSITION', 'message', 'Cannot cancel booking in status ' || v_booking.status);
  END IF;

  SELECT * INTO v_job FROM jobs WHERE id = v_booking.job_id FOR UPDATE;

  UPDATE bookings
  SET
    status = 'cancelled',
    cancellation_reason = p_reason,
    cancelled_by = v_user_id
  WHERE id = p_booking_id;

  -- Update application: withdrawn if worker cancelled, rejected if organizer cancelled
  UPDATE job_applications
  SET status = CASE WHEN v_user_id = v_booking.worker_id THEN 'withdrawn'::application_status ELSE 'rejected'::application_status END,
      updated_at = now()
  WHERE job_id = v_booking.job_id AND worker_id = v_booking.worker_id;

  -- Reopen slot only if job is not terminal, not paused, and date is today or future
  IF v_job.status IN ('filled', 'filling', 'open') AND v_job.date >= (now() AT TIME ZONE 'Asia/Kolkata')::date THEN
    UPDATE jobs
    SET
      slots_filled = GREATEST(0, slots_filled - 1),
      status = CASE WHEN slots_filled - 1 > 0 THEN 'filling'::shift_status ELSE 'open'::shift_status END,
      updated_at = now()
    WHERE id = v_booking.job_id;
  END IF;

  -- Replacement notify shortlisted
  FOR v_standby IN
    SELECT worker_id FROM job_applications WHERE job_id = v_booking.job_id AND status = 'shortlisted'
  LOOP
    PERFORM _notify(
      v_standby.worker_id,
      'Opening Available',
      'A confirmed spot just opened up for ' || v_job.title || '.',
      'standby_callout',
      '/shift/' || v_job.id,
      jsonb_build_object('job_id', v_job.id)
    );
  END LOOP;

  -- Notify other party
  IF v_user_id = v_booking.worker_id THEN
    PERFORM _notify(
      v_booking.organizer_id,
      'Worker Cancelled Booking',
      'Worker has cancelled their confirmed booking for ' || v_job.title || '.',
      'booking_cancelled',
      '/shift/' || v_job.id,
      jsonb_build_object('job_id', v_job.id, 'booking_id', p_booking_id)
    );
  ELSE
    PERFORM _notify(
      v_booking.worker_id,
      'Booking Cancelled',
      'Your booking for ' || v_job.title || ' has been cancelled: ' || p_reason,
      'booking_cancelled',
      '/shift/' || v_job.id,
      jsonb_build_object('job_id', v_job.id, 'booking_id', p_booking_id)
    );
  END IF;

  INSERT INTO audit_logs (
    actor_id, action, entity_type, entity_id, new_state
  ) VALUES (
    v_user_id, 'CANCEL_BOOKING', 'booking', p_booking_id::TEXT,
    jsonb_build_object('reason', p_reason, 'cancelled_by', v_user_id)
  );

  RETURN jsonb_build_object('success', true, 'status', 'cancelled');
END;
$$;

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

  IF v_booking.organizer_id != v_organizer_id AND NOT is_current_admin() THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'UNAUTHORIZED');
  END IF;

  IF NOT validate_booking_transition(v_booking.status, 'no_show') THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'INVALID_TRANSITION', 'message', 'Cannot mark no-show from status ' || v_booking.status);
  END IF;

  SELECT * INTO v_job FROM jobs WHERE id = v_booking.job_id FOR UPDATE;

  UPDATE bookings
  SET status = 'no_show', no_show_reason = p_reason
  WHERE id = p_booking_id;

  -- Reopen slot only if active and future
  IF v_job.status IN ('filled', 'filling', 'open') AND v_job.date >= (now() AT TIME ZONE 'Asia/Kolkata')::date THEN
    UPDATE jobs
    SET
      slots_filled = GREATEST(0, slots_filled - 1),
      status = CASE WHEN slots_filled - 1 > 0 THEN 'filling'::shift_status ELSE 'open'::shift_status END,
      updated_at = now()
    WHERE id = v_booking.job_id;
  END IF;

  PERFORM _notify(
    v_booking.worker_id,
    'No-Show Recorded',
    'A no-show has been recorded for your shift: ' || v_job.title || '. Contact support if this is an error.',
    'booking_cancelled',
    '/shift/' || v_job.id,
    jsonb_build_object('job_id', v_job.id, 'booking_id', p_booking_id)
  );

  INSERT INTO audit_logs (
    actor_id, action, entity_type, entity_id, new_state
  ) VALUES (
    v_organizer_id, 'RECORD_NO_SHOW', 'booking', p_booking_id::TEXT,
    jsonb_build_object('reason', p_reason)
  );

  RETURN jsonb_build_object('success', true, 'status', 'no_show');
END;
$$;

-- Worker check-in with time-window validation & configurable geofence
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
  v_is_supervisor BOOLEAN := false;
  v_distance NUMERIC;
  v_radius_m NUMERIC := 300.0;
  v_shift_start TIMESTAMPTZ;
  v_shift_end TIMESTAMPTZ;
  v_now_ist TIMESTAMPTZ;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'UNAUTHENTICATED');
  END IF;

  SELECT * INTO v_booking FROM bookings WHERE id = p_booking_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'BOOKING_NOT_FOUND');
  END IF;

  SELECT * INTO v_job FROM jobs WHERE id = v_booking.job_id;

  v_is_supervisor := (v_user_id = v_booking.organizer_id OR is_current_admin());

  IF NOT v_is_supervisor AND v_user_id != v_booking.worker_id THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'UNAUTHORIZED');
  END IF;

  IF NOT validate_booking_transition(v_booking.status, 'checked_in') THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'INVALID_TRANSITION', 'message', 'Cannot check in from status ' || v_booking.status);
  END IF;

  -- Time window calculations in IST
  v_shift_start := (v_job.date + v_job.start_time) AT TIME ZONE 'Asia/Kolkata';
  v_shift_end := (v_job.date + v_job.end_time + CASE WHEN v_job.end_time <= v_job.start_time THEN interval '1 day' ELSE interval '0' END) AT TIME ZONE 'Asia/Kolkata';
  v_now_ist := now() AT TIME ZONE 'Asia/Kolkata';

  IF NOT v_is_supervisor THEN
    -- Worker self check-in window: [start - 60 min, start + 120 min]
    IF v_now_ist < (v_shift_start - interval '60 minutes') OR v_now_ist > (v_shift_start + interval '120 minutes') THEN
      RETURN jsonb_build_object(
        'success', false,
        'error_code', 'OUTSIDE_CHECKIN_WINDOW',
        'message', 'Self check-in is permitted between 60 minutes before and 120 minutes after shift call time.'
      );
    END IF;
  ELSE
    -- Supervisor check-in window: [start - 4 hours, end]
    IF v_now_ist < (v_shift_start - interval '4 hours') OR v_now_ist > v_shift_end THEN
      RETURN jsonb_build_object(
        'success', false,
        'error_code', 'OUTSIDE_CHECKIN_WINDOW',
        'message', 'Supervisor check-in permitted only on shift day within operational window.'
      );
    END IF;
  END IF;

  -- Verification credential check
  IF trim(COALESCE(p_code, '')) != trim(COALESCE(v_booking.check_in_code, '')) THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'INVALID_CHECK_IN_CODE', 'message', 'Verification code does not match shift booking.');
  END IF;

  -- GPS and Geofence enforcement
  IF NOT v_is_supervisor THEN
    IF p_lat IS NULL OR p_lng IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error_code', 'LOCATION_REQUIRED', 'message', 'GPS coordinates are required for worker self check-in.');
    END IF;

    IF v_job.latitude IS NULL OR v_job.longitude IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error_code', 'VENUE_COORDINATES_MISSING', 'message', 'Venue coordinates not configured. Supervisor check-in required.');
    END IF;

    -- Haversine calculation in km
    v_distance := round(
      (6371 * acos(
        least(1.0, greatest(-1.0,
          cos(radians(p_lat)) * cos(radians(v_job.latitude)) *
          cos(radians(v_job.longitude) - radians(p_lng)) +
          sin(radians(p_lat)) * sin(radians(v_job.latitude))
        ))
      ))::numeric, 3
    );

    SELECT COALESCE((value->>'checkin_radius_m')::numeric, 300.0) INTO v_radius_m
    FROM platform_settings WHERE key = 'checkin_radius_m';

    IF (v_distance * 1000.0) > v_radius_m THEN
      RETURN jsonb_build_object(
        'success', false,
        'error_code', 'OUT_OF_GEOFENCE_RANGE',
        'message', 'You are outside the venue check-in area (' || round(v_distance * 1000.0) || 'm away, max ' || v_radius_m || 'm allowed).'
      );
    END IF;
  ELSE
    IF p_lat IS NOT NULL AND p_lng IS NOT NULL AND v_job.latitude IS NOT NULL AND v_job.longitude IS NOT NULL THEN
      v_distance := round(
        (6371 * acos(
          least(1.0, greatest(-1.0,
            cos(radians(p_lat)) * cos(radians(v_job.latitude)) *
            cos(radians(v_job.longitude) - radians(p_lng)) +
            sin(radians(p_lat)) * sin(radians(v_job.latitude))
          ))
        ))::numeric, 3
      );
    END IF;
  END IF;

  UPDATE bookings
  SET status = 'checked_in', check_in_time = now()
  WHERE id = p_booking_id;

  INSERT INTO attendance_records (
    booking_id, job_id, worker_id, supervisor_id,
    check_in_time, check_in_code, verified_by_supervisor,
    latitude, longitude, distance_to_venue_km
  ) VALUES (
    p_booking_id, v_booking.job_id, v_booking.worker_id, v_booking.organizer_id,
    now(), p_code, v_is_supervisor,
    p_lat, p_lng, LEAST(v_distance, 999.99)
  );

  PERFORM _notify(
    v_booking.organizer_id,
    'Worker Checked In',
    'Worker has checked in on-site for ' || v_job.title,
    'check_in',
    '/shift/' || v_job.id,
    jsonb_build_object('booking_id', p_booking_id, 'job_id', v_job.id)
  );

  INSERT INTO audit_logs (
    actor_id, action, entity_type, entity_id, new_state
  ) VALUES (
    v_user_id, 'CHECK_IN_WORKER', 'booking', p_booking_id::TEXT,
    jsonb_build_object('distance_km', v_distance, 'supervisor_verified', v_is_supervisor)
  );

  RETURN jsonb_build_object(
    'success', true,
    'status', 'checked_in',
    'check_in_time', now(),
    'distance_km', v_distance
  );
END;
$$;

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
  v_check_in_time TIMESTAMPTZ;
  v_effective_checkout TIMESTAMPTZ;
  v_shift_end TIMESTAMPTZ;
  v_hours NUMERIC;
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

  IF NOT validate_booking_transition(v_booking.status, 'checked_out') THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'INVALID_TRANSITION', 'message', 'Cannot check out from status ' || v_booking.status);
  END IF;

  SELECT * INTO v_job FROM jobs WHERE id = v_booking.job_id;

  SELECT check_in_time INTO v_check_in_time
  FROM attendance_records
  WHERE booking_id = p_booking_id
  ORDER BY created_at DESC LIMIT 1;

  IF v_check_in_time IS NULL THEN
    v_check_in_time := v_booking.check_in_time;
  END IF;

  IF v_check_in_time IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'NO_CHECK_IN_RECORD', 'message', 'No valid check-in record found for this booking.');
  END IF;

  IF now() < (v_check_in_time + interval '15 minutes') THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'MINIMUM_SHIFT_DURATION', 'message', 'Minimum shift duration before check-out is 15 minutes.');
  END IF;

  -- Compute hours from LEAST(now(), job end + 3 hours)
  v_shift_end := (v_job.date + v_job.end_time + CASE WHEN v_job.end_time <= v_job.start_time THEN interval '1 day' ELSE interval '0' END) AT TIME ZONE 'Asia/Kolkata';
  v_effective_checkout := LEAST(now(), v_shift_end + interval '3 hours');
  v_hours := round((EXTRACT(EPOCH FROM (v_effective_checkout - v_check_in_time)) / 3600.0)::numeric, 2);

  UPDATE bookings
  SET status = 'checked_out', check_out_time = now()
  WHERE id = p_booking_id;

  UPDATE attendance_records
  SET check_out_time = now(), hours_worked = v_hours, notes = p_notes
  WHERE booking_id = p_booking_id;

  PERFORM _notify(
    v_booking.organizer_id,
    'Worker Checked Out',
    'Worker has checked out for ' || v_job.title || '. Please review attendance and approve hours.',
    'check_out',
    '/shift/' || v_job.id,
    jsonb_build_object('booking_id', p_booking_id, 'hours', v_hours)
  );

  INSERT INTO audit_logs (
    actor_id, action, entity_type, entity_id, new_state
  ) VALUES (
    v_user_id, 'CHECK_OUT_WORKER', 'booking', p_booking_id::TEXT,
    jsonb_build_object('hours_worked', v_hours, 'checkout_time', now())
  );

  RETURN jsonb_build_object('success', true, 'status', 'checked_out', 'hours_worked', v_hours);
END;
$$;

-- Supervisor attendance approval with server-side wage calculation
CREATE OR REPLACE FUNCTION complete_shift_and_approve_attendance(
  p_booking_id UUID,
  p_verified_hours NUMERIC,
  p_overtime_approved BOOLEAN DEFAULT false,
  p_notes TEXT DEFAULT NULL
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
  v_final_pay NUMERIC(10, 2);
  v_base_pay NUMERIC(10, 2);
BEGIN
  IF v_organizer_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'UNAUTHENTICATED');
  END IF;

  SELECT * INTO v_booking FROM bookings WHERE id = p_booking_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'BOOKING_NOT_FOUND');
  END IF;

  IF v_booking.organizer_id != v_organizer_id AND NOT is_current_admin() THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'UNAUTHORIZED');
  END IF;

  IF NOT validate_booking_transition(v_booking.status, 'completed') THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'INVALID_TRANSITION', 'message', 'Cannot approve attendance from status ' || v_booking.status);
  END IF;

  SELECT * INTO v_job FROM jobs WHERE id = v_booking.job_id;

  -- Validate verified hours between 0 and 1.5x scheduled duration
  IF p_verified_hours < 0 OR p_verified_hours > (v_job.duration_hours * 1.5) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'INVALID_HOURS',
      'message', 'Verified hours must be between 0 and ' || (v_job.duration_hours * 1.5) || ' hours (max 1.5x scheduled).'
    );
  END IF;

  -- Calculate final pay strictly on server
  v_base_pay := round(p_verified_hours * v_job.hourly_rate, 2);

  IF p_verified_hours > v_job.duration_hours THEN
    IF p_overtime_approved AND v_job.overtime_policy IS NOT NULL THEN
      v_final_pay := v_base_pay;
    ELSE
      v_final_pay := v_booking.agreed_total_pay;
    END IF;
  ELSE
    v_final_pay := v_base_pay;
  END IF;

  -- Cap at agreed_total_pay unless overtime was explicitly approved
  IF NOT p_overtime_approved THEN
    v_final_pay := LEAST(v_final_pay, v_booking.agreed_total_pay);
  END IF;

  -- Update booking
  UPDATE bookings
  SET
    status = 'completed',
    completed_at = now(),
    approved_total_pay = v_final_pay
  WHERE id = p_booking_id;

  UPDATE attendance_records
  SET
    hours_worked = p_verified_hours,
    verified_by_supervisor = true,
    notes = COALESCE(p_notes, notes)
  WHERE booking_id = p_booking_id;

  -- Increment worker shifts completed using trusted bypass
  PERFORM set_config('opskl.trusted', '1', true);
  UPDATE worker_profiles
  SET shifts_completed = shifts_completed + 1, updated_at = now()
  WHERE id = v_booking.worker_id;

  PERFORM _notify(
    v_booking.worker_id,
    'Attendance Approved',
    'Your attendance for ' || v_job.title || ' has been approved. Earnings: ₹' || v_final_pay || '.',
    'attendance_approved',
    '/shift/' || v_job.id,
    jsonb_build_object('booking_id', p_booking_id, 'approved_total_pay', v_final_pay)
  );

  INSERT INTO audit_logs (
    actor_id, action, entity_type, entity_id, new_state
  ) VALUES (
    v_organizer_id, 'APPROVE_ATTENDANCE', 'booking', p_booking_id::TEXT,
    jsonb_build_object('verified_hours', p_verified_hours, 'approved_total_pay', v_final_pay, 'overtime_approved', p_overtime_approved)
  );

  RETURN jsonb_build_object(
    'success', true,
    'status', 'completed',
    'approved_total_pay', v_final_pay,
    'verified_hours', p_verified_hours
  );
END;
$$;

-- ------------------------------------------------------------------------------
-- 1.9 DISPUTES ARBITRATION, KYC VERIFICATION & DATA PURGE SAFETY
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION claim_dispute_safe(p_dispute_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id UUID := auth.uid();
BEGIN
  IF NOT is_current_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Administrative authorization required.');
  END IF;

  UPDATE disputes
  SET status = 'under_review', assigned_to = v_admin_id, updated_at = now()
  WHERE id = p_dispute_id AND status = 'open';

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Dispute not found or already claimed.');
  END IF;

  INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, new_state)
  VALUES (v_admin_id, 'CLAIM_DISPUTE', 'disputes', p_dispute_id::TEXT, jsonb_build_object('status', 'under_review'));

  RETURN jsonb_build_object('success', true, 'dispute_id', p_dispute_id, 'status', 'under_review');
END;
$$;

REVOKE EXECUTE ON FUNCTION claim_dispute_safe(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION claim_dispute_safe(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION admin_resolve_dispute_safe(
  p_dispute_id UUID,
  p_status TEXT,
  p_resolution_notes TEXT,
  p_booking_outcome TEXT DEFAULT NULL,
  p_adjusted_payout NUMERIC DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id UUID := auth.uid();
  v_dispute RECORD;
  v_booking RECORD;
  v_has_attendance BOOLEAN;
  v_target_booking_status TEXT;
BEGIN
  IF NOT is_current_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Administrative authorization required.');
  END IF;

  IF p_status NOT IN ('resolved', 'dismissed') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Resolution status must be resolved or dismissed.');
  END IF;

  SELECT * INTO v_dispute FROM disputes WHERE id = p_dispute_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Dispute record not found.');
  END IF;

  IF v_dispute.status NOT IN ('open', 'under_review') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Dispute has already been resolved or closed.');
  END IF;

  SELECT * INTO v_booking FROM bookings WHERE id = v_dispute.booking_id FOR UPDATE;

  IF p_status = 'dismissed' THEN
    -- Restore booking to pre-dispute status
    v_target_booking_status := COALESCE(v_booking.status_before_dispute, 'confirmed');
    UPDATE bookings
    SET status = v_target_booking_status, updated_at = now()
    WHERE id = v_booking.id;
  ELSIF p_status = 'resolved' THEN
    -- Determine booking outcome
    IF p_booking_outcome NOT IN ('completed', 'cancelled', 'no_show') THEN
      RETURN jsonb_build_object('success', false, 'error', 'Booking outcome must be completed, cancelled, or no_show.');
    END IF;

    -- Only allow completed if attendance record exists
    IF p_booking_outcome = 'completed' THEN
      SELECT EXISTS (SELECT 1 FROM attendance_records WHERE booking_id = v_booking.id AND check_in_time IS NOT NULL) INTO v_has_attendance;
      IF NOT v_has_attendance THEN
        RETURN jsonb_build_object('success', false, 'error', 'Cannot rule booking completed without on-site attendance record.');
      END IF;
    END IF;

    IF p_adjusted_payout IS NOT NULL THEN
      IF p_adjusted_payout < 0 OR p_adjusted_payout > (v_booking.agreed_total_pay * 1.5) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Adjusted payout must be between ₹0 and 1.5x agreed pay.');
      END IF;
    END IF;

    UPDATE bookings
    SET
      status = p_booking_outcome,
      approved_total_pay = COALESCE(p_adjusted_payout, approved_total_pay, agreed_total_pay),
      updated_at = now()
    WHERE id = v_booking.id;

    -- Update payment record if exists and not already settled
    IF p_adjusted_payout IS NOT NULL THEN
      UPDATE payment_records
      SET amount = p_adjusted_payout, net_payout = p_adjusted_payout, updated_at = now()
      WHERE booking_id = v_booking.id AND status != 'settled';
    END IF;
  END IF;

  UPDATE disputes
  SET
    status = p_status,
    resolution_notes = p_resolution_notes,
    assigned_to = v_admin_id,
    updated_at = now()
  WHERE id = p_dispute_id;

  -- Notify both parties
  PERFORM _notify(v_dispute.raised_by, 'Dispute ' || initcap(p_status), 'Dispute resolution: ' || p_resolution_notes, 'dispute_update', '/shift/' || v_booking.job_id);
  PERFORM _notify(v_dispute.respondent_id, 'Dispute ' || initcap(p_status), 'Dispute resolution: ' || p_resolution_notes, 'dispute_update', '/shift/' || v_booking.job_id);

  INSERT INTO audit_logs (
    actor_id, action, entity_type, entity_id, new_state
  ) VALUES (
    v_admin_id, 'ADMIN_RESOLVE_DISPUTE', 'disputes', p_dispute_id::TEXT,
    jsonb_build_object('status', p_status, 'resolution_notes', p_resolution_notes, 'booking_outcome', p_booking_outcome, 'adjusted_payout', p_adjusted_payout)
  );

  RETURN jsonb_build_object('success', true, 'dispute_id', p_dispute_id, 'status', p_status);
END;
$$;

-- Verification submission & review
CREATE OR REPLACE FUNCTION submit_verification_case_safe(
  p_document_type TEXT,
  p_masked_id TEXT,
  p_storage_path TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_case_id UUID;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Authentication required.');
  END IF;

  IF p_document_type NOT IN ('aadhaar', 'pan', 'gstin') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Document type must be aadhaar, pan, or gstin.');
  END IF;

  -- Storage path security: must belong to caller
  IF NOT (p_storage_path LIKE (v_user_id::TEXT || '/%') OR p_storage_path LIKE ('kyc/' || v_user_id::TEXT || '/%')) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Storage path must be scoped to your authenticated user directory.');
  END IF;

  -- Reject if pending case already exists for this document type
  IF EXISTS (
    SELECT 1 FROM verification_cases
    WHERE profile_id = v_user_id AND document_type = p_document_type AND status = 'pending'
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'A verification case is already pending review for this document type.');
  END IF;

  INSERT INTO verification_cases (
    profile_id, document_type, document_number_masked, document_storage_path, status
  ) VALUES (
    v_user_id, p_document_type, p_masked_id, p_storage_path, 'pending'
  ) RETURNING id INTO v_case_id;

  -- Update profile status to pending
  PERFORM set_config('opskl.trusted', '1', true);
  UPDATE worker_profiles SET verification_status = 'pending', updated_at = now() WHERE id = v_user_id;
  UPDATE organizer_profiles SET verification_status = 'pending', updated_at = now() WHERE id = v_user_id;

  RETURN jsonb_build_object('success', true, 'case_id', v_case_id, 'status', 'pending');
END;
$$;

REVOKE EXECUTE ON FUNCTION submit_verification_case_safe(TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION submit_verification_case_safe(TEXT, TEXT, TEXT) TO authenticated;

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
  v_is_worker BOOLEAN;
  v_w_profile RECORD;
  v_o_profile RECORD;
  v_now_verified BOOLEAN := false;
BEGIN
  IF NOT is_current_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Administrative authorization required.');
  END IF;

  IF p_status NOT IN ('approved', 'rejected') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Status must be approved or rejected.');
  END IF;

  SELECT * INTO v_case FROM verification_cases WHERE id = p_case_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Verification case not found.');
  END IF;

  IF v_case.status != 'pending' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only pending verification cases can be acted upon.');
  END IF;

  UPDATE verification_cases
  SET
    status = p_status,
    rejection_reason = p_rejection_reason,
    reviewed_by = v_admin_id,
    reviewed_at = now()
  WHERE id = p_case_id;

  PERFORM set_config('opskl.trusted', '1', true);

  IF p_status = 'approved' THEN
    -- Check if worker
    SELECT * INTO v_w_profile FROM worker_profiles WHERE id = v_case.profile_id;
    IF FOUND THEN
      -- Set document flag
      UPDATE worker_profiles
      SET
        is_aadhaar_verified = CASE WHEN v_case.document_type = 'aadhaar' THEN true ELSE is_aadhaar_verified END,
        is_pan_verified = CASE WHEN v_case.document_type = 'pan' THEN true ELSE is_pan_verified END
      WHERE id = v_case.profile_id
      RETURNING * INTO v_w_profile;

      -- DECISION: Worker = Aadhaar OR PAN
      IF v_w_profile.is_aadhaar_verified = true OR v_w_profile.is_pan_verified = true THEN
        UPDATE worker_profiles SET verification_status = 'verified', updated_at = now() WHERE id = v_case.profile_id;
      END IF;
    END IF;

    -- Check if organizer
    SELECT * INTO v_o_profile FROM organizer_profiles WHERE id = v_case.profile_id;
    IF FOUND THEN
      UPDATE organizer_profiles
      SET
        is_gstin_verified = CASE WHEN v_case.document_type = 'gstin' THEN true ELSE is_gstin_verified END
      WHERE id = v_case.profile_id
      RETURNING * INTO v_o_profile;

      -- DECISION: Organizer = GSTIN OR PAN
      IF v_o_profile.is_gstin_verified = true OR v_case.document_type = 'pan' THEN
        UPDATE organizer_profiles SET verification_status = 'verified', updated_at = now() WHERE id = v_case.profile_id;
      END IF;
    END IF;

    PERFORM _notify(v_case.profile_id, 'Verification Approved', 'Your document verification has been successfully approved.', 'verification_update');
  ELSIF p_status = 'rejected' THEN
    UPDATE worker_profiles SET verification_status = 'rejected', updated_at = now() WHERE id = v_case.profile_id;
    UPDATE organizer_profiles SET verification_status = 'rejected', updated_at = now() WHERE id = v_case.profile_id;

    PERFORM _notify(v_case.profile_id, 'Verification Update', 'Document verification was rejected: ' || COALESCE(p_rejection_reason, 'Invalid document'), 'verification_update');
  END IF;

  INSERT INTO audit_logs (
    actor_id, action, entity_type, entity_id, new_state
  ) VALUES (
    v_admin_id, 'ADMIN_VERIFY_CASE', 'verification_cases', p_case_id::TEXT,
    jsonb_build_object('status', p_status, 'document_type', v_case.document_type, 'rejection_reason', p_rejection_reason)
  );

  RETURN jsonb_build_object('success', true, 'case_id', p_case_id, 'status', p_status);
END;
$$;

-- Account deletion request, cancellation & service-role purge
CREATE OR REPLACE FUNCTION request_account_deletion_safe(p_reason TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_now TIMESTAMPTZ := now();
  v_purge_at TIMESTAMPTZ := now() + interval '30 days';
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'UNAUTHENTICATED');
  END IF;

  -- Block deletion if user has pending or unresolved bookings
  IF EXISTS (
    SELECT 1 FROM bookings
    WHERE (worker_id = v_user_id OR organizer_id = v_user_id)
      AND status IN ('selected_awaiting_confirmation', 'confirmed', 'checked_in', 'checked_out', 'completed_awaiting_review', 'disputed')
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'ACTIVE_BOOKINGS_PENDING',
      'message', 'Cannot delete account with active, disputed, or pending shift bookings. Please resolve all shifts first.'
    );
  END IF;

  -- Block deletion if organizer has unpaid invoices
  IF EXISTS (
    SELECT 1 FROM organizer_invoices
    WHERE organizer_id = v_user_id AND status IN ('pending', 'overdue')
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'UNPAID_INVOICES',
      'message', 'Cannot delete account with outstanding unpaid invoices.'
    );
  END IF;

  -- Deactivate profile using trusted bypass
  PERFORM set_config('opskl.trusted', '1', true);
  UPDATE profiles SET is_active = false, updated_at = v_now WHERE id = v_user_id;

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

  INSERT INTO audit_logs (
    actor_id, action, entity_type, entity_id, new_state
  ) VALUES (
    v_user_id, 'REQUEST_ACCOUNT_DELETION', 'profile', v_user_id::TEXT,
    jsonb_build_object('scheduled_purge_at', v_purge_at, 'reason', p_reason)
  );

  RETURN jsonb_build_object(
    'success', true,
    'status', 'queued',
    'scheduled_purge_at', v_purge_at,
    'message', 'Account has been deactivated. Permanent data purge is scheduled in 30 days.'
  );
END;
$$;

CREATE OR REPLACE FUNCTION cancel_account_deletion_safe()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'UNAUTHENTICATED');
  END IF;

  -- Reactivate profile using trusted bypass
  PERFORM set_config('opskl.trusted', '1', true);
  UPDATE profiles SET is_active = true, updated_at = now() WHERE id = v_user_id;

  UPDATE account_deletion_requests
  SET status = 'cancelled', updated_at = now()
  WHERE user_id = v_user_id AND status = 'queued';

  INSERT INTO audit_logs (
    actor_id, action, entity_type, entity_id, new_state
  ) VALUES (
    v_user_id, 'CANCEL_ACCOUNT_DELETION', 'profile', v_user_id::TEXT,
    jsonb_build_object('status', 'cancelled')
  );

  RETURN jsonb_build_object('success', true, 'status', 'active', 'message', 'Account deletion cancelled successfully.');
END;
$$;

REVOKE EXECUTE ON FUNCTION cancel_account_deletion_safe() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION cancel_account_deletion_safe() TO authenticated;

-- Purge processor (service-role or admin only)
CREATE OR REPLACE FUNCTION process_account_deletion_purge_safe(p_batch_size INT DEFAULT 50)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rec RECORD;
  v_purged_count INT := 0;
BEGIN
  IF NOT (is_current_admin() OR COALESCE(auth.role(), '') = 'service_role' OR current_user = 'postgres') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized. Requires service role or admin credentials.');
  END IF;

  PERFORM set_config('opskl.trusted', '1', true);

  FOR v_rec IN
    SELECT user_id FROM account_deletion_requests
    WHERE status = 'queued' AND scheduled_purge_at <= now()
    ORDER BY scheduled_purge_at ASC
    LIMIT p_batch_size
  LOOP
    -- Null GPS and location data in attendance records
    UPDATE attendance_records
    SET latitude = NULL, longitude = NULL, distance_to_venue_km = NULL
    WHERE worker_id = v_rec.user_id;

    -- Redact sensitive text in disputes, reviews, and safety reports
    UPDATE reviews SET comment = '[Redacted pursuant to user account deletion]' WHERE reviewer_id = v_rec.user_id;
    UPDATE disputes SET details = '[Redacted]' WHERE raised_by = v_rec.user_id;
    UPDATE safety_reports SET description = '[Redacted]' WHERE reporter_id = v_rec.user_id;

    -- Delete user push tokens
    DELETE FROM user_push_tokens WHERE user_id = v_rec.user_id;

    -- Anonymize core profile
    UPDATE profiles
    SET
      full_name = 'Deleted User ' || substr(v_rec.user_id::TEXT, 1, 6),
      phone = NULL,
      email = 'deleted_' || substr(v_rec.user_id::TEXT, 1, 8) || '@deleted.opskil.internal',
      avatar_url = NULL,
      is_active = false,
      updated_at = now()
    WHERE id = v_rec.user_id;

    -- Anonymize worker / organizer details
    UPDATE worker_profiles SET upi_id = NULL, bio = NULL WHERE id = v_rec.user_id;
    UPDATE organizer_profiles SET gstin = NULL, billing_address = NULL, business_contact_phone = NULL WHERE id = v_rec.user_id;

    UPDATE account_deletion_requests SET status = 'purged', updated_at = now() WHERE user_id = v_rec.user_id;
    v_purged_count := v_purged_count + 1;
  END LOOP;

  RETURN jsonb_build_object('success', true, 'purged_count', v_purged_count);
END;
$$;

-- Admin dashboard SQL aggregation views
CREATE OR REPLACE VIEW admin_overview_metrics AS
  SELECT
    (SELECT COALESCE(sum(total_payable), 0.00) FROM organizer_invoices WHERE status = 'escrow_funded') AS gmv_inr,
    (SELECT COALESCE(sum(platform_fee), 0.00) FROM organizer_invoices WHERE status = 'escrow_funded') AS platform_fees_inr,
    (
      (SELECT COALESCE(sum(wage_total), 0.00) FROM organizer_invoices WHERE status = 'escrow_funded') -
      (SELECT COALESCE(sum(net_payout), 0.00) FROM payment_records WHERE status = 'settled')
    ) AS escrow_held_inr,
    (SELECT count(*) FROM jobs WHERE status IN ('open', 'filling', 'filled')) AS active_shifts,
    (SELECT count(*) FROM worker_profiles) AS total_workers,
    (SELECT count(*) FROM verification_cases WHERE status = 'pending') AS pending_verifications,
    (SELECT count(*) FROM disputes WHERE status IN ('open', 'under_review')) AS open_disputes,
    (SELECT count(*) FROM safety_reports WHERE status = 'open') AS open_safety_reports;

GRANT SELECT ON admin_overview_metrics TO authenticated;

CREATE OR REPLACE VIEW admin_audit_logs_view AS
  SELECT
    al.id,
    al.actor_id,
    p.email AS actor_email,
    p.role AS actor_role,
    al.action,
    al.entity_type,
    al.entity_id,
    al.old_state,
    COALESCE(al.changes, al.new_state) AS payload,
    al.created_at
  FROM audit_logs al
  LEFT JOIN profiles p ON p.id = al.actor_id;

GRANT SELECT ON admin_audit_logs_view TO authenticated;

-- ------------------------------------------------------------------------------
-- 1.10 FY SEQUENTIAL INVOICES & MANUAL ESCROW SETTLEMENT (PILOT)
-- ------------------------------------------------------------------------------

CREATE SEQUENCE IF NOT EXISTS invoice_seq START 1;

CREATE OR REPLACE FUNCTION generate_invoice_number()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  v_now TIMESTAMPTZ := now() AT TIME ZONE 'Asia/Kolkata';
  v_month INT := EXTRACT(MONTH FROM v_now);
  v_year INT := EXTRACT(YEAR FROM v_now);
  v_fy_start INT;
  v_fy_end INT;
  v_seq INT;
BEGIN
  IF v_month >= 4 THEN
    v_fy_start := v_year % 100;
    v_fy_end := (v_year + 1) % 100;
  ELSE
    v_fy_start := (v_year - 1) % 100;
    v_fy_end := v_year % 100;
  END IF;

  v_seq := nextval('invoice_seq');
  RETURN 'OPS/' || LPAD(v_fy_start::TEXT, 2, '0') || '-' || LPAD(v_fy_end::TEXT, 2, '0') || '/' || LPAD(v_seq::TEXT, 5, '0');
END;
$$;

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
  v_existing RECORD;
  v_wage_total NUMERIC(10, 2);
  v_fee_pct NUMERIC(5, 2);
  v_gst_pct NUMERIC(5, 2);
  v_platform_fee NUMERIC(10, 2);
  v_gst_amount NUMERIC(10, 2);
  v_total_payable NUMERIC(10, 2);
  v_invoice_number TEXT;
  v_invoice_id UUID;
  v_due_date TIMESTAMPTZ;
BEGIN
  SELECT id, organizer_id, total_pay, slots_total, date INTO v_job FROM jobs WHERE id = p_job_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Job not found.');
  END IF;

  -- Idempotency check: refuse to alter totals if already funded or settled
  SELECT * INTO v_existing FROM organizer_invoices WHERE job_id = p_job_id;
  IF FOUND THEN
    IF v_existing.status IN ('escrow_funded', 'settled') THEN
      RETURN jsonb_build_object(
        'success', true,
        'invoice_id', v_existing.id,
        'invoice_number', v_existing.invoice_number,
        'status', v_existing.status,
        'total_payable', v_existing.total_payable,
        'immutable', true
      );
    END IF;
  END IF;

  -- Fetch dynamic fee and GST percentages from platform settings
  SELECT COALESCE((value->>'platform_fee_percent')::numeric, 10.00) INTO v_fee_pct
  FROM platform_settings WHERE key = 'platform_fee';

  SELECT COALESCE((value->>'gst_rate_percent')::numeric, 18.00) INTO v_gst_pct
  FROM platform_settings WHERE key = 'gst_rate';

  v_wage_total := round(v_job.total_pay * v_job.slots_total, 2);
  v_platform_fee := round(v_wage_total * (v_fee_pct / 100.0), 2);
  v_gst_amount := round(v_platform_fee * (v_gst_pct / 100.0), 2);
  v_total_payable := v_wage_total + v_platform_fee + v_gst_amount;

  -- Due date: least(now() + 3 days, job.date - 1 day)
  v_due_date := LEAST(
    now() + interval '3 days',
    (v_job.date - 1)::timestamp AT TIME ZONE 'Asia/Kolkata'
  );

  IF v_existing.id IS NOT NULL THEN
    UPDATE organizer_invoices
    SET
      wage_total = v_wage_total,
      platform_fee = v_platform_fee,
      gst_rate = v_gst_pct,
      gst_amount = v_gst_amount,
      total_payable = v_total_payable,
      due_date = v_due_date,
      updated_at = now()
    WHERE id = v_existing.id
    RETURNING id INTO v_invoice_id;

    RETURN jsonb_build_object('success', true, 'invoice_id', v_invoice_id, 'status', 'updated', 'total_payable', v_total_payable);
  END IF;

  v_invoice_number := generate_invoice_number();

  INSERT INTO organizer_invoices (
    invoice_number, job_id, organizer_id,
    wage_total, platform_fee, gst_rate, gst_amount, total_payable,
    status, payment_method, payment_provider, due_date, is_sandbox
  ) VALUES (
    v_invoice_number, p_job_id, v_job.organizer_id,
    v_wage_total, v_platform_fee, v_gst_pct, v_gst_amount, v_total_payable,
    'pending', 'neft_rtgs', 'manual_reconciliation', v_due_date, false
  ) RETURNING id INTO v_invoice_id;

  INSERT INTO audit_logs (
    actor_id, action, entity_type, entity_id, new_state
  ) VALUES (
    auth.uid(), 'GENERATE_JOB_INVOICE', 'organizer_invoices', v_invoice_id::TEXT,
    jsonb_build_object('invoice_number', v_invoice_number, 'total_payable', v_total_payable)
  );

  RETURN jsonb_build_object(
    'success', true,
    'invoice_id', v_invoice_id,
    'invoice_number', v_invoice_number,
    'status', 'created',
    'total_payable', v_total_payable
  );
END;
$$;

-- Admin manual receipt of escrow funds (NEFT/RTGS/UPI)
CREATE OR REPLACE FUNCTION admin_mark_invoice_funded(
  p_invoice_id UUID,
  p_reference TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id UUID := auth.uid();
  v_invoice RECORD;
BEGIN
  IF NOT is_current_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Administrative authorization required.');
  END IF;

  SELECT * INTO v_invoice FROM organizer_invoices WHERE id = p_invoice_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invoice record not found.');
  END IF;

  IF v_invoice.status = 'escrow_funded' THEN
    RETURN jsonb_build_object('success', true, 'status', 'escrow_funded', 'message', 'Invoice already marked as escrow funded.');
  END IF;

  UPDATE organizer_invoices
  SET
    status = 'escrow_funded',
    paid_at = now(),
    payment_method = 'neft_rtgs',
    provider_payment_id = p_reference,
    updated_at = now()
  WHERE id = p_invoice_id;

  INSERT INTO payment_reconciliation_logs (
    reconciliation_type, reference_id, status, expected_amount, recorded_amount, notes, actor_id
  ) VALUES (
    'invoice_collection', v_invoice.invoice_number, 'matched', v_invoice.total_payable, v_invoice.total_payable,
    'Manual receipt confirmed by admin. Ref: ' || p_reference, v_admin_id
  );

  INSERT INTO audit_logs (
    actor_id, action, entity_type, entity_id, new_state
  ) VALUES (
    v_admin_id, 'ADMIN_MARK_INVOICE_FUNDED', 'organizer_invoices', p_invoice_id::TEXT,
    jsonb_build_object('reference', p_reference, 'total_payable', v_invoice.total_payable)
  );

  RETURN jsonb_build_object('success', true, 'invoice_id', p_invoice_id, 'status', 'escrow_funded');
END;
$$;

REVOKE EXECUTE ON FUNCTION admin_mark_invoice_funded(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION admin_mark_invoice_funded(UUID, TEXT) TO authenticated;

-- Payout initiation requires completed booking and funded invoice
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
  v_job RECORD;
  v_invoice RECORD;
  v_existing RECORD;
  v_worker_upi TEXT;
  v_payout_amount NUMERIC(10, 2);
  v_payment_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Authentication required.');
  END IF;

  SELECT * INTO v_booking FROM bookings WHERE id = p_booking_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Booking not found.');
  END IF;

  IF v_booking.status != 'completed' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Attendance must be completed before payout initiation.');
  END IF;

  -- Require invoice escrow funded
  SELECT * INTO v_invoice FROM organizer_invoices WHERE job_id = v_booking.job_id;
  IF NOT FOUND OR v_invoice.status != 'escrow_funded' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Job escrow invoice must be funded prior to initiating payouts.');
  END IF;

  SELECT upi_id INTO v_worker_upi FROM worker_profiles WHERE id = v_booking.worker_id;
  IF v_worker_upi IS NULL OR trim(v_worker_upi) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Worker has no verified UPI payout destination.');
  END IF;

  v_payout_amount := COALESCE(v_booking.approved_total_pay, v_booking.agreed_total_pay);

  SELECT * INTO v_existing FROM payment_records WHERE booking_id = p_booking_id;
  IF FOUND THEN
    IF v_existing.status NOT IN ('pending', 'failed') THEN
      RETURN jsonb_build_object('success', true, 'payment_id', v_existing.id, 'status', v_existing.status);
    END IF;

    UPDATE payment_records
    SET status = 'escrow_locked', amount = v_payout_amount, net_payout = v_payout_amount, updated_at = now()
    WHERE id = v_existing.id
    RETURNING id INTO v_payment_id;
  ELSE
    INSERT INTO payment_records (
      booking_id, job_id, worker_id, organizer_id,
      amount, platform_fee, net_payout, status, upi_id
    ) VALUES (
      p_booking_id, v_booking.job_id, v_booking.worker_id, v_booking.organizer_id,
      v_payout_amount, 0.00, v_payout_amount, 'escrow_locked', v_worker_upi
    ) RETURNING id INTO v_payment_id;
  END IF;

  INSERT INTO audit_logs (
    actor_id, action, entity_type, entity_id, new_state
  ) VALUES (
    auth.uid(), 'INITIATE_WORKER_PAYOUT', 'payment_records', v_payment_id::TEXT,
    jsonb_build_object('amount', v_payout_amount, 'status', 'escrow_locked')
  );

  RETURN jsonb_build_object('success', true, 'payment_id', v_payment_id, 'status', 'escrow_locked', 'amount', v_payout_amount);
END;
$$;

-- Admin settle / fail payout
CREATE OR REPLACE FUNCTION admin_mark_payout_settled(
  p_payment_id UUID,
  p_utr TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id UUID := auth.uid();
  v_payment RECORD;
BEGIN
  IF NOT is_current_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Administrative authorization required.');
  END IF;

  SELECT * INTO v_payment FROM payment_records WHERE id = p_payment_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Payment record not found.');
  END IF;

  UPDATE payment_records
  SET
    status = 'settled',
    utr_reference = p_utr,
    settled_at = now(),
    updated_at = now()
  WHERE id = p_payment_id;

  INSERT INTO payment_reconciliation_logs (
    reconciliation_type, reference_id, status, expected_amount, recorded_amount, notes, actor_id
  ) VALUES (
    'payout', p_payment_id::TEXT, 'matched', v_payment.net_payout, v_payment.net_payout,
    'Settled via UTR: ' || p_utr, v_admin_id
  );

  PERFORM _notify(
    v_payment.worker_id,
    'Payout Settled',
    'Your payout of ₹' || v_payment.net_payout || ' has been transferred to ' || v_payment.upi_id || '. UTR: ' || p_utr,
    'payout_settled',
    '/shift/' || v_payment.job_id
  );

  INSERT INTO audit_logs (
    actor_id, action, entity_type, entity_id, new_state
  ) VALUES (
    v_admin_id, 'ADMIN_SETTLE_PAYOUT', 'payment_records', p_payment_id::TEXT,
    jsonb_build_object('utr', p_utr, 'amount', v_payment.net_payout)
  );

  RETURN jsonb_build_object('success', true, 'payment_id', p_payment_id, 'status', 'settled');
END;
$$;

REVOKE EXECUTE ON FUNCTION admin_mark_payout_settled(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION admin_mark_payout_settled(UUID, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION admin_mark_payout_failed(
  p_payment_id UUID,
  p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id UUID := auth.uid();
  v_payment RECORD;
BEGIN
  IF NOT is_current_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Administrative authorization required.');
  END IF;

  SELECT * INTO v_payment FROM payment_records WHERE id = p_payment_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Payment record not found.');
  END IF;

  UPDATE payment_records
  SET status = 'failed', failure_reason = p_reason, updated_at = now()
  WHERE id = p_payment_id;

  PERFORM _notify(
    v_payment.worker_id,
    'Payout Failed',
    'Payout transfer failed: ' || p_reason || '. Please verify your UPI ID in settings.',
    'payout_failed',
    '/shift/' || v_payment.job_id
  );

  INSERT INTO audit_logs (
    actor_id, action, entity_type, entity_id, new_state
  ) VALUES (
    v_admin_id, 'ADMIN_FAIL_PAYOUT', 'payment_records', p_payment_id::TEXT,
    jsonb_build_object('failure_reason', p_reason)
  );

  RETURN jsonb_build_object('success', true, 'payment_id', p_payment_id, 'status', 'failed');
END;
$$;

REVOKE EXECUTE ON FUNCTION admin_mark_payout_failed(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION admin_mark_payout_failed(UUID, TEXT) TO authenticated;

-- Webhook processor fix: paise to rupees, discrepancy status, retryable failures
ALTER TABLE payment_webhook_events DROP CONSTRAINT IF EXISTS payment_webhook_events_status_check;
ALTER TABLE payment_webhook_events ADD CONSTRAINT payment_webhook_events_status_check CHECK (
  status IN ('pending', 'processed', 'failed', 'duplicate', 'discrepancy')
);

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
  v_order_id TEXT;
  v_payment_id TEXT;
  v_amount NUMERIC(10, 2);
  v_invoice RECORD;
  v_gateway_mode TEXT := 'sandbox';
BEGIN
  -- Idempotency check
  SELECT id, status INTO v_existing_event
  FROM payment_webhook_events
  WHERE event_id = p_event_id;

  IF FOUND THEN
    IF v_existing_event.status = 'processed' THEN
      RETURN jsonb_build_object('success', true, 'duplicate', true, 'event_id', p_event_id);
    END IF;
  ELSE
    INSERT INTO payment_webhook_events (
      provider, event_id, event_type, payload, status
    ) VALUES (
      p_provider, p_event_id, p_event_type, p_payload, 'pending'
    );
  END IF;

  SELECT COALESCE((value->>'payment_gateway_mode')::text, 'sandbox') INTO v_gateway_mode
  FROM platform_settings WHERE key = 'payment_gateway_mode';

  IF p_event_type IN ('order.paid', 'payment.captured', 'invoice.paid') THEN
    v_order_id := p_payload->>'order_id';
    v_payment_id := p_payload->>'payment_id';

    -- Convert paise to rupees (/ 100.0)
    v_amount := round(COALESCE((p_payload->>'amount')::NUMERIC, 0.00) / 100.0, 2);

    SELECT * INTO v_invoice
    FROM organizer_invoices
    WHERE provider_order_id = v_order_id OR id::TEXT = (p_payload->>'invoice_id');

    IF NOT FOUND THEN
      UPDATE payment_webhook_events
      SET status = 'failed', error_message = 'No matching invoice found for provider order ' || COALESCE(v_order_id, 'NULL')
      WHERE event_id = p_event_id;

      RETURN jsonb_build_object('success', false, 'error', 'Invoice not found');
    END IF;

    IF v_amount = v_invoice.total_payable THEN
      UPDATE organizer_invoices
      SET
        status = 'escrow_funded',
        provider_payment_id = v_payment_id,
        paid_at = now(),
        updated_at = now()
      WHERE id = v_invoice.id;

      INSERT INTO payment_reconciliation_logs (
        reconciliation_type, reference_id, status, expected_amount, recorded_amount, notes
      ) VALUES (
        'invoice_collection', v_invoice.invoice_number, 'matched', v_invoice.total_payable, v_amount,
        'Webhook capture: ' || p_event_id
      );

      UPDATE payment_webhook_events SET status = 'processed', processed_at = now() WHERE event_id = p_event_id;
    ELSE
      -- Discrepancy logged
      INSERT INTO payment_reconciliation_logs (
        reconciliation_type, reference_id, status, expected_amount, recorded_amount, discrepancy_amount, notes
      ) VALUES (
        'invoice_collection', v_invoice.invoice_number, 'discrepancy', v_invoice.total_payable, v_amount,
        abs(v_invoice.total_payable - v_amount), 'Amount mismatch in webhook payload'
      );

      UPDATE payment_webhook_events SET status = 'discrepancy', error_message = 'Amount mismatch' WHERE event_id = p_event_id;
    END IF;

    RETURN jsonb_build_object('success', true, 'invoice_id', v_invoice.id, 'status', 'processed');
  END IF;

  UPDATE payment_webhook_events SET status = 'processed', processed_at = now() WHERE event_id = p_event_id;
  RETURN jsonb_build_object('success', true, 'status', 'ignored');
END;
$$;

-- ------------------------------------------------------------------------------
-- 1.11 OVERNIGHT SHIFTS, COORDINATE BOUNDS & REALTIME PUBLICATION
-- ------------------------------------------------------------------------------

ALTER TABLE jobs ADD COLUMN IF NOT EXISTS crosses_midnight BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS end_date DATE;

-- Update create_job_safe to support overnight shifts, coordinates, and pilot limits
CREATE OR REPLACE FUNCTION create_job_safe(p_job JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_organizer_id UUID := auth.uid();
  v_title TEXT := trim(p_job->>'title');
  v_category shift_category := (p_job->>'category')::shift_category;
  v_venue_name TEXT := trim(p_job->>'venue_name');
  v_venue_address TEXT := trim(p_job->>'venue_address');
  v_landmark TEXT := p_job->>'landmark';
  v_city TEXT := COALESCE(p_job->>'city', 'Mumbai');
  v_zone TEXT := p_job->>'zone';
  v_date DATE := (p_job->>'date')::DATE;
  v_start_time TIME := (p_job->>'start_time')::TIME;
  v_end_time TIME := (p_job->>'end_time')::TIME;
  v_hourly_rate NUMERIC := (p_job->>'hourly_rate')::NUMERIC;
  v_slots_total INTEGER := (p_job->>'slots_total')::INTEGER;
  v_status shift_status := COALESCE(p_job->>'status', 'open')::shift_status;
  v_dress_code TEXT := p_job->>'dress_code';
  v_supervisor_name TEXT := trim(p_job->>'supervisor_name');
  v_supervisor_phone TEXT := trim(p_job->>'supervisor_phone');
  v_reporting_instructions TEXT := p_job->>'reporting_instructions';
  v_cancellation_policy TEXT := p_job->>'cancellation_policy';
  v_eligibility_criteria TEXT := p_job->>'eligibility_criteria';
  v_lat NUMERIC := (p_job->>'latitude')::NUMERIC;
  v_lng NUMERIC := (p_job->>'longitude')::NUMERIC;
  v_duties TEXT[] := ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_job->'duties', '[]'::jsonb)));
  v_required_skills TEXT[] := ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_job->'required_skills', '[]'::jsonb)));
  v_perks TEXT[] := ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_job->'perks', '[]'::jsonb)));
  v_breaks_minutes INTEGER := COALESCE((p_job->>'breaks_minutes')::INTEGER, 30);
  v_meal_provided BOOLEAN := COALESCE((p_job->>'meal_provided')::BOOLEAN, false);
  v_transport_provided BOOLEAN := COALESCE((p_job->>'transport_provided')::BOOLEAN, false);
  v_overtime_policy TEXT := p_job->>'overtime_policy';
  v_crosses_midnight BOOLEAN := false;
  v_end_date DATE;
  v_duration_hours NUMERIC;
  v_total_pay NUMERIC;
  v_min_wage NUMERIC := 100.0;
  v_new_id UUID;
BEGIN
  IF v_organizer_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'UNAUTHENTICATED');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM organizer_profiles
    WHERE id = v_organizer_id AND (verification_status = 'verified' OR is_current_admin())
  ) THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'FORBIDDEN_ROLE', 'message', 'Organizer identity verification required to post shifts.');
  END IF;

  -- Title length aligned with client bounds: 5 to 80 chars
  IF length(v_title) < 5 OR length(v_title) > 80 THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'INVALID_TITLE', 'message', 'Shift title must be between 5 and 80 characters.');
  END IF;

  -- Read min wage from settings
  SELECT COALESCE((value->>'min_hourly_wage_inr')::numeric, 100.0) INTO v_min_wage
  FROM platform_settings WHERE key = 'min_wage';

  -- Pilot rate limits: ₹100 to ₹2000/hr
  IF v_hourly_rate < v_min_wage OR v_hourly_rate > 2000 THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'INVALID_WAGE', 'message', 'Hourly rate must be between ₹' || v_min_wage || ' and ₹2,000/hr.');
  END IF;

  -- Pilot slots limit: 1 to 100 workers
  IF v_slots_total < 1 OR v_slots_total > 100 THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'INVALID_SLOTS', 'message', 'Headcount must be between 1 and 100 workers.');
  END IF;

  -- Date check in IST
  IF v_date < (now() AT TIME ZONE 'Asia/Kolkata')::date THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'PAST_DATE', 'message', 'Shift date cannot be in the past.');
  END IF;

  -- Overnight calculation
  IF v_end_time <= v_start_time THEN
    v_crosses_midnight := true;
    v_end_date := v_date + 1;
    v_duration_hours := round((EXTRACT(EPOCH FROM (v_end_time - v_start_time + interval '24 hours')) / 3600.0)::numeric, 2);
  ELSE
    v_crosses_midnight := false;
    v_end_date := v_date;
    v_duration_hours := round((EXTRACT(EPOCH FROM (v_end_time - v_start_time)) / 3600.0)::numeric, 2);
  END IF;

  IF v_duration_hours < 0.5 OR v_duration_hours > 24.0 THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'INVALID_DURATION', 'message', 'Shift duration must be between 0.5 and 24 hours.');
  END IF;

  -- India geographic coordinate bounds check (Lat: 6–38 N, Lng: 68–98 E)
  IF v_lat IS NOT NULL OR v_lng IS NOT NULL THEN
    IF v_lat < 6.0 OR v_lat > 38.0 OR v_lng < 68.0 OR v_lng > 98.0 THEN
      RETURN jsonb_build_object('success', false, 'error_code', 'INVALID_COORDINATES', 'message', 'Coordinates must fall within the sovereign territory of India (6–38°N, 68–98°E).');
    END IF;
  END IF;

  v_total_pay := round(v_hourly_rate * v_duration_hours, 2);

  INSERT INTO jobs (
    organizer_id, title, category, venue_name, venue_address, landmark,
    city, zone, date, start_time, end_time, duration_hours,
    hourly_rate, total_pay, slots_total, slots_filled, dress_code,
    duties, perks, required_skills, breaks_minutes, meal_provided,
    transport_provided, overtime_policy, reporting_instructions,
    cancellation_policy, eligibility_criteria, latitude, longitude,
    supervisor_name, supervisor_phone, status, crosses_midnight, end_date
  ) VALUES (
    v_organizer_id, v_title, v_category, v_venue_name, v_venue_address, v_landmark,
    v_city, v_zone, v_date, v_start_time, v_end_time, v_duration_hours,
    v_hourly_rate, v_total_pay, v_slots_total, 0, v_dress_code,
    v_duties, v_perks, v_required_skills, v_breaks_minutes, v_meal_provided,
    v_transport_provided, v_overtime_policy, v_reporting_instructions,
    v_cancellation_policy, v_eligibility_criteria, v_lat, v_lng,
    v_supervisor_name, v_supervisor_phone, v_status, v_crosses_midnight, v_end_date
  ) RETURNING id INTO v_new_id;

  INSERT INTO audit_logs (
    actor_id, action, entity_type, entity_id, new_state
  ) VALUES (
    v_organizer_id, 'CREATE_JOB', 'job', v_new_id::TEXT,
    jsonb_build_object('title', v_title, 'duration_hours', v_duration_hours, 'total_pay', v_total_pay, 'crosses_midnight', v_crosses_midnight)
  );

  RETURN jsonb_build_object('success', true, 'job_id', v_new_id, 'duration_hours', v_duration_hours, 'total_pay', v_total_pay);
END;
$$;

-- Ensure supabase_realtime publication includes bookings
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE bookings;
    EXCEPTION
      WHEN duplicate_object THEN null;
    END;
  END IF;
END $$;


-- ##############################################################################
-- START MIGRATION: 20261015000001_security_definer_views_and_rls.sql
-- ##############################################################################

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


-- ##############################################################################
-- START MIGRATION: 20261015000002_function_security_and_search_paths.sql
-- ##############################################################################

-- ==============================================================================
-- OPSKIL DATABASE MIGRATION: 20261015000002_function_security_and_search_paths.sql
-- Remediation for Supabase Database Linter Warnings:
--   - 0011_function_search_path_mutable: Pin search_path on functions
--   - 0028_anon_security_definer_function_executable: Revoke anon/PUBLIC execute
--   - 0029_authenticated_security_definer_function_executable: Revoke execute on
--     triggers, internal helpers, and batch cron functions
-- ==============================================================================

-- 1. Pin search_path on functions flagged with mutable search_path (0011)
ALTER FUNCTION public.validate_job_transition(text, text) SET search_path = public, pg_temp;
ALTER FUNCTION public.update_timestamp() SET search_path = public, pg_temp;
ALTER FUNCTION public.validate_booking_transition(text, text) SET search_path = public, pg_temp;
ALTER FUNCTION public.generate_invoice_number() SET search_path = public, pg_temp;

-- 2. Drop obsolete legacy overload signatures
DROP FUNCTION IF EXISTS public.complete_shift_and_approve_attendance(uuid, numeric);
DROP FUNCTION IF EXISTS public.admin_resolve_dispute_safe(uuid, text, text, numeric, uuid);

-- 3. Revoke EXECUTE from PUBLIC and anon across all public schema functions (0028)
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC, anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon;

-- 4. Revoke EXECUTE from authenticated on trigger functions (0029)
REVOKE EXECUTE ON FUNCTION public.check_organizer_profile_update() FROM authenticated, anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.check_worker_profile_update() FROM authenticated, anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.prevent_role_escalation() FROM authenticated, anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user_provisioning() FROM authenticated, anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.validate_job_transition(text, text) FROM authenticated, anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_timestamp() FROM authenticated, anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.validate_booking_transition(text, text) FROM authenticated, anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.generate_invoice_number() FROM authenticated, anon, PUBLIC;

-- 5. Internal notification helper & cron batch functions: restrict strictly to service_role (0029)
REVOKE EXECUTE ON FUNCTION public._notify(uuid, text, text, text, text, jsonb, text) FROM authenticated, anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public._notify(uuid, text, text, text, text, jsonb, text) TO service_role;

REVOKE EXECUTE ON FUNCTION public.close_expired_jobs() FROM authenticated, anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.close_expired_jobs() TO service_role;

REVOKE EXECUTE ON FUNCTION public.process_account_deletion_purge_safe(integer) FROM authenticated, anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.process_account_deletion_purge_safe(integer) TO service_role;


-- ##############################################################################
-- START MIGRATION: 20261015000003_security_and_privacy_hardening.sql
-- ##############################################################################

-- ==============================================================================
-- OPSKIL DATABASE MIGRATION: 20261015000003_security_and_privacy_hardening.sql
-- Resolution for Audit P0/P1 Security, Privacy, and Data Exposure Findings:
--   1. Secure process_payment_webhook_safe: enforce service_role caller
--   2. Fix process_account_deletion_purge_safe authorization check
--   3. Revoke broad SELECT on admin views; expose strictly via admin-guarded RPCs
--   4. Filter public_jobs view to active/upcoming shifts (status in open/filling & date >= CURRENT_DATE)
--   5. Support guest discovery safely on public_jobs and get_discovery_feed
--   6. Initialize verification-documents private storage bucket and RLS policies
--   7. Standardize user-scoped KYC storage path validation
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. SECURE PAYMENT WEBHOOK: RESTRICT TO SERVICE_ROLE & REJECT CLIENT EXECUTION
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION process_payment_webhook_safe(
  p_provider TEXT,
  p_event_id TEXT,
  p_event_type TEXT,
  p_payload JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_jwt_role TEXT := current_setting('request.jwt.claim.role', true);
  v_existing_event RECORD;
  v_order_id TEXT;
  v_payment_id TEXT;
  v_amount NUMERIC(10, 2);
  v_invoice RECORD;
  v_gateway_mode TEXT := 'sandbox';
BEGIN
  -- Strict caller authorization: Must be service_role or superuser
  IF v_jwt_role IS NOT NULL AND v_jwt_role != 'service_role' AND session_user NOT IN ('postgres', 'service_role') THEN
    RAISE EXCEPTION 'Unauthorized: Webhook processing is restricted to service_role credentials';
  END IF;

  -- Idempotency check
  SELECT id, status INTO v_existing_event
  FROM payment_webhook_events
  WHERE event_id = p_event_id;

  IF FOUND THEN
    IF v_existing_event.status = 'processed' THEN
      RETURN jsonb_build_object('success', true, 'duplicate', true, 'event_id', p_event_id);
    END IF;
  ELSE
    INSERT INTO payment_webhook_events (
      provider, event_id, event_type, payload, status
    ) VALUES (
      p_provider, p_event_id, p_event_type, p_payload, 'pending'
    );
  END IF;

  -- Razorpay / Sandbox payload parsing
  IF p_provider = 'razorpay' THEN
    v_order_id := p_payload->'payload'->'payment'->'entity'->>'order_id';
    v_payment_id := p_payload->'payload'->'payment'->'entity'->>'id';
    -- Razorpay amounts arrive in paise; convert safely to INR
    v_amount := (COALESCE((p_payload->'payload'->'payment'->'entity'->>'amount')::NUMERIC, 0.00)) / 100.00;
  ELSE
    -- Generic / Mock test provider
    v_order_id := p_payload->>'order_id';
    v_payment_id := p_payload->>'payment_id';
    v_amount := COALESCE((p_payload->>'amount')::NUMERIC, 0.00);
  END IF;

  -- Reconcile matching invoice
  SELECT * INTO v_invoice
  FROM organizer_invoices
  WHERE invoice_number = v_order_id OR id::TEXT = v_order_id;

  IF NOT FOUND THEN
    UPDATE payment_webhook_events
    SET status = 'failed', error_message = 'Invoice not found for order ' || COALESCE(v_order_id, 'null')
    WHERE event_id = p_event_id;

    RETURN jsonb_build_object('success', false, 'error', 'Invoice not found');
  END IF;

  IF p_event_type = 'payment.captured' OR p_event_type = 'payment_success' THEN
    IF v_amount >= v_invoice.total_payable THEN
      -- Fund escrow
      UPDATE organizer_invoices
      SET
        status = 'escrow_funded',
        escrow_funded_at = now(),
        payment_reference = v_payment_id,
        updated_at = now()
      WHERE id = v_invoice.id;

      UPDATE payment_webhook_events
      SET status = 'processed', processed_at = now()
      WHERE event_id = p_event_id;

      INSERT INTO payment_reconciliation_logs (
        invoice_id, event_type, expected_amount, received_amount, status, metadata
      ) VALUES (
        v_invoice.id, p_event_type, v_invoice.total_payable, v_amount, 'reconciled',
        jsonb_build_object('provider', p_provider, 'payment_id', v_payment_id)
      );

      RETURN jsonb_build_object('success', true, 'invoice_id', v_invoice.id, 'status', 'escrow_funded');
    ELSE
      -- Discrepancy: underpaid
      UPDATE payment_webhook_events
      SET status = 'discrepancy', error_message = 'Underpaid amount'
      WHERE event_id = p_event_id;

      INSERT INTO payment_reconciliation_logs (
        invoice_id, event_type, expected_amount, received_amount, status, metadata
      ) VALUES (
        v_invoice.id, p_event_type, v_invoice.total_payable, v_amount, 'discrepancy',
        jsonb_build_object('provider', p_provider, 'payment_id', v_payment_id, 'shortfall', v_invoice.total_payable - v_amount)
      );

      RETURN jsonb_build_object('success', false, 'error', 'Payment amount discrepancy recorded');
    END IF;
  END IF;

  UPDATE payment_webhook_events
  SET status = 'processed', processed_at = now()
  WHERE event_id = p_event_id;

  RETURN jsonb_build_object('success', true, 'event_id', p_event_id);
END;
$$;

REVOKE EXECUTE ON FUNCTION process_payment_webhook_safe(TEXT, TEXT, TEXT, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION process_payment_webhook_safe(TEXT, TEXT, TEXT, JSONB) TO service_role;

-- ------------------------------------------------------------------------------
-- 2. FIX ACCOUNT DELETION PURGE AUTHORIZATION CHECK
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION process_account_deletion_purge_safe(p_batch_size INT DEFAULT 50)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_jwt_role TEXT := current_setting('request.jwt.claim.role', true);
  v_rec RECORD;
  v_purged_count INT := 0;
BEGIN
  -- Strict caller verification: service_role or admin user only
  IF NOT (
    is_current_admin()
    OR v_jwt_role = 'service_role'
    OR session_user IN ('postgres', 'service_role')
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized. Requires service role or admin credentials.');
  END IF;

  PERFORM set_config('opskl.trusted', '1', true);

  FOR v_rec IN
    SELECT user_id FROM account_deletion_requests
    WHERE status = 'queued' AND scheduled_purge_at <= now()
    ORDER BY scheduled_purge_at ASC
    LIMIT p_batch_size
  LOOP
    -- Null GPS and location data in attendance records
    UPDATE attendance_records
    SET latitude = NULL, longitude = NULL, distance_to_venue_km = NULL
    WHERE worker_id = v_rec.user_id;

    -- Redact sensitive text in disputes, reviews, and safety reports
    UPDATE reviews SET comment = '[Redacted pursuant to user account deletion]' WHERE reviewer_id = v_rec.user_id;
    UPDATE disputes SET details = '[Redacted]' WHERE raised_by = v_rec.user_id;
    UPDATE safety_reports SET description = '[Redacted]' WHERE reporter_id = v_rec.user_id;

    -- Delete user push tokens
    DELETE FROM user_push_tokens WHERE user_id = v_rec.user_id;

    -- Anonymize core profile
    UPDATE profiles
    SET
      full_name = 'Deleted User ' || substr(v_rec.user_id::TEXT, 1, 6),
      phone = NULL,
      email = 'deleted_' || substr(v_rec.user_id::TEXT, 1, 8) || '@deleted.opskil.internal',
      avatar_url = NULL,
      is_active = false,
      updated_at = now()
    WHERE id = v_rec.user_id;

    -- Anonymize worker / organizer details
    UPDATE worker_profiles SET upi_id = NULL, bio = NULL WHERE id = v_rec.user_id;
    UPDATE organizer_profiles SET gstin = NULL, billing_address = NULL, business_contact_phone = NULL WHERE id = v_rec.user_id;

    UPDATE account_deletion_requests SET status = 'purged', updated_at = now() WHERE user_id = v_rec.user_id;
    v_purged_count := v_purged_count + 1;
  END LOOP;

  RETURN jsonb_build_object('success', true, 'purged_count', v_purged_count);
END;
$$;

REVOKE EXECUTE ON FUNCTION process_account_deletion_purge_safe(INT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION process_account_deletion_purge_safe(INT) TO service_role;

-- ------------------------------------------------------------------------------
-- 3. REVOKE BROAD VIEW ACCESS & RESTRICT ADMIN REPORTING TO AUTHORIZED RPCS
-- ------------------------------------------------------------------------------

-- Revoke direct view access from normal users
REVOKE SELECT ON public.admin_overview_metrics FROM PUBLIC, anon, authenticated;
REVOKE SELECT ON public.admin_audit_logs_view FROM PUBLIC, anon, authenticated;

-- Create admin-guarded overview metrics RPC
CREATE OR REPLACE FUNCTION get_admin_overview_metrics()
RETURNS TABLE (
  gmv_inr NUMERIC,
  platform_fees_inr NUMERIC,
  escrow_held_inr NUMERIC,
  active_shifts BIGINT,
  total_workers BIGINT,
  pending_verifications BIGINT,
  open_disputes BIGINT,
  open_safety_reports BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT is_current_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Only platform administrators can view overview metrics';
  END IF;

  RETURN QUERY SELECT * FROM public.admin_overview_metrics;
END;
$$;

REVOKE EXECUTE ON FUNCTION get_admin_overview_metrics() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION get_admin_overview_metrics() TO authenticated;

-- Create admin-guarded audit logs RPC with pagination
CREATE OR REPLACE FUNCTION get_admin_audit_logs(p_limit INT DEFAULT 50, p_offset INT DEFAULT 0)
RETURNS TABLE (
  id UUID,
  actor_id UUID,
  actor_email TEXT,
  actor_role TEXT,
  action TEXT,
  entity_type TEXT,
  entity_id TEXT,
  old_state JSONB,
  payload JSONB,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT is_current_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Only platform administrators can view audit logs';
  END IF;

  RETURN QUERY
    SELECT
      al.id,
      al.actor_id,
      p.email AS actor_email,
      p.role AS actor_role,
      al.action,
      al.entity_type,
      al.entity_id,
      al.old_state,
      COALESCE(al.changes, al.new_state) AS payload,
      al.created_at
    FROM audit_logs al
    LEFT JOIN profiles p ON p.id = al.actor_id
    ORDER BY al.created_at DESC
    LIMIT p_limit OFFSET p_offset;
END;
$$;

REVOKE EXECUTE ON FUNCTION get_admin_audit_logs(INT, INT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION get_admin_audit_logs(INT, INT) TO authenticated;

-- ------------------------------------------------------------------------------
-- 4. PUBLIC_JOBS VIEW: FILTER OUT DRAFT, CANCELLED, AND PAST-DATED SHIFTS
-- ------------------------------------------------------------------------------

DROP VIEW IF EXISTS public.public_jobs CASCADE;
CREATE OR REPLACE VIEW public.public_jobs WITH (security_invoker = true) AS
  SELECT
    id,
    organizer_id,
    title,
    category,
    venue_name,
    venue_address,
    landmark,
    city,
    zone,
    date,
    start_time,
    end_time,
    duration_hours,
    hourly_rate,
    total_pay,
    wage_per_worker,
    slots_total,
    slots_filled,
    dress_code,
    duties,
    perks,
    required_skills,
    eligibility_criteria,
    application_deadline,
    breaks_minutes,
    meal_provided,
    transport_provided,
    overtime_policy,
    latitude,
    longitude,
    status,
    created_at,
    updated_at
  FROM jobs
  WHERE status IN ('open', 'filling')
    AND date >= CURRENT_DATE;

GRANT SELECT ON public.public_jobs TO anon, authenticated;

-- Ensure underlying table allows anon guest discovery on public_jobs
DROP POLICY IF EXISTS "Anyone can view open public jobs" ON jobs;
CREATE POLICY "Anyone can view open public jobs"
  ON jobs FOR SELECT TO anon, authenticated
  USING (status IN ('open', 'filling') AND date >= CURRENT_DATE);

-- Permit guest discovery feed RPC
GRANT EXECUTE ON FUNCTION get_discovery_feed(JSONB, INT, JSONB) TO anon, authenticated;

-- ------------------------------------------------------------------------------
-- 5. INITIALIZE VERIFICATION-DOCUMENTS PRIVATE STORAGE BUCKET & RLS POLICIES
-- ------------------------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'verification-documents',
  'verification-documents',
  false,
  10485760, -- 10MB
  ARRAY['application/pdf', 'image/jpeg', 'image/png']
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 10485760,
  allowed_mime_types = ARRAY['application/pdf', 'image/jpeg', 'image/png'];

DROP POLICY IF EXISTS "Users upload own verification documents" ON storage.objects;
CREATE POLICY "Users upload own verification documents"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'verification-documents'
    AND (
      (storage.foldername(name))[1] = auth.uid()::TEXT
      OR name LIKE (auth.uid()::TEXT || '/%')
      OR name LIKE ('kyc/' || auth.uid()::TEXT || '/%')
      OR name LIKE ('verification/' || auth.uid()::TEXT || '/%')
    )
  );

DROP POLICY IF EXISTS "Users read own verification documents" ON storage.objects;
CREATE POLICY "Users read own verification documents"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'verification-documents'
    AND (
      (storage.foldername(name))[1] = auth.uid()::TEXT
      OR name LIKE (auth.uid()::TEXT || '/%')
      OR name LIKE ('kyc/' || auth.uid()::TEXT || '/%')
      OR name LIKE ('verification/' || auth.uid()::TEXT || '/%')
      OR is_current_admin()
    )
  );

DROP POLICY IF EXISTS "Admins full manage verification documents" ON storage.objects;
CREATE POLICY "Admins full manage verification documents"
  ON storage.objects FOR ALL TO authenticated
  USING (
    bucket_id = 'verification-documents'
    AND is_current_admin()
  );

-- ------------------------------------------------------------------------------
-- 6. STANDARDIZE KYC STORAGE PATH VALIDATION IN SUBMIT_VERIFICATION_CASE_SAFE
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION submit_verification_case_safe(
  p_document_type TEXT,
  p_masked_id TEXT,
  p_storage_path TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_case_id UUID;
  v_user_str TEXT;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Authentication required.');
  END IF;

  v_user_str := v_user_id::TEXT;

  IF p_document_type NOT IN ('aadhaar', 'pan', 'gstin') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Document type must be aadhaar, pan, or gstin.');
  END IF;

  -- Storage path security: must be strictly scoped to caller's user directory
  IF NOT (
    p_storage_path LIKE (v_user_str || '/%')
    OR p_storage_path LIKE ('kyc/' || v_user_str || '/%')
    OR p_storage_path LIKE ('verification/' || v_user_str || '/%')
    OR p_storage_path LIKE ('verification/%/' || v_user_str || '.%')
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Storage path must be scoped to your authenticated user directory.');
  END IF;

  -- Reject if pending case already exists for this document type
  IF EXISTS (
    SELECT 1 FROM verification_cases
    WHERE profile_id = v_user_id AND document_type = p_document_type AND status = 'pending'
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'A verification case is already pending review for this document type.');
  END IF;

  INSERT INTO verification_cases (
    profile_id, document_type, document_number_masked, document_storage_path, status
  ) VALUES (
    v_user_id, p_document_type, p_masked_id, p_storage_path, 'pending'
  ) RETURNING id INTO v_case_id;

  -- Update profile status to pending
  PERFORM set_config('opskl.trusted', '1', true);
  UPDATE worker_profiles SET verification_status = 'pending', updated_at = now() WHERE id = v_user_id;
  UPDATE organizer_profiles SET verification_status = 'pending', updated_at = now() WHERE id = v_user_id;

  RETURN jsonb_build_object('success', true, 'case_id', v_case_id, 'status', 'pending');
END;
$$;

REVOKE EXECUTE ON FUNCTION submit_verification_case_safe(TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION submit_verification_case_safe(TEXT, TEXT, TEXT) TO authenticated;


-- ##############################################################################
-- START MIGRATION: 20261015000004_shift_messaging_and_standby.sql
-- ##############################################################################

-- ============================================================================
-- OPSKL MIGRATION: 20261015000004_shift_messaging_and_standby.sql
-- Shift-Specific Messaging, Standby Replacement, and Arrival Delay Alerts
-- ============================================================================

-- 1. SHIFT MESSAGES TABLE
CREATE TABLE IF NOT EXISTS public.shift_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  recipient_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  content TEXT NOT NULL CHECK (char_length(trim(content)) > 0 AND char_length(content) <= 2000),
  is_broadcast BOOLEAN NOT NULL DEFAULT false,
  is_reported BOOLEAN NOT NULL DEFAULT false,
  report_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shift_messages_job_id ON public.shift_messages(job_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_shift_messages_sender ON public.shift_messages(sender_id);

ALTER TABLE public.shift_messages ENABLE ROW LEVEL SECURITY;

-- Helper to check if caller is confirmed worker or supervisor on the job
CREATE OR REPLACE FUNCTION public.can_access_shift_messages(p_job_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.jobs j WHERE j.id = p_job_id AND j.organizer_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM public.bookings b WHERE b.job_id = p_job_id AND b.worker_id = auth.uid() AND b.status IN ('confirmed', 'checked_in', 'checked_out', 'completed', 'completed_awaiting_review')
  ) OR is_current_admin();
$$;

DROP POLICY IF EXISTS "Participants can view shift messages" ON public.shift_messages;
CREATE POLICY "Participants can view shift messages"
ON public.shift_messages FOR SELECT TO authenticated
USING (public.can_access_shift_messages(job_id));

DROP POLICY IF EXISTS "Participants can post shift messages" ON public.shift_messages;
CREATE POLICY "Participants can post shift messages"
ON public.shift_messages FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = sender_id AND public.can_access_shift_messages(job_id)
);

-- 2. REPORT WORKER DELAY RPC
CREATE OR REPLACE FUNCTION public.report_worker_delay_safe(
  p_booking_id UUID,
  p_minutes INTEGER,
  p_reason TEXT DEFAULT NULL
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
  v_worker_name TEXT;
  v_notif_title TEXT;
  v_notif_body TEXT;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'UNAUTHENTICATED');
  END IF;

  SELECT * INTO v_booking FROM public.bookings WHERE id = p_booking_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'BOOKING_NOT_FOUND');
  END IF;

  IF v_booking.worker_id != v_user_id AND NOT is_current_admin() THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'UNAUTHORIZED');
  END IF;

  IF v_booking.status != 'confirmed' THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'INVALID_STATUS', 'message', 'Delay alerts can only be logged for upcoming confirmed shifts.');
  END IF;

  SELECT * INTO v_job FROM public.jobs WHERE id = v_booking.job_id;
  SELECT full_name INTO v_worker_name FROM public.profiles WHERE id = v_booking.worker_id;

  -- Create late notice shift message broadcast
  INSERT INTO public.shift_messages (
    job_id,
    sender_id,
    content,
    is_broadcast
  ) VALUES (
    v_booking.job_id,
    v_user_id,
    '[DELAY ALERT] ' || COALESCE(v_worker_name, 'Worker') || ' reported expected delay of ' || p_minutes || ' minutes. Reason: ' || COALESCE(p_reason, 'Traffic/Transport delay'),
    true
  );

  -- Send high-priority notification to Organizer
  v_notif_title := 'Worker Running Late: ' || COALESCE(v_worker_name, 'Crew Member');
  v_notif_body := COALESCE(v_worker_name, 'Crew Member') || ' reported a ' || p_minutes || ' min delay for "' || v_job.title || '". Reason: ' || COALESCE(p_reason, 'Traffic/Transit');

  PERFORM public.send_notification_safe(
    v_job.organizer_id,
    v_notif_title,
    v_notif_body,
    'shift_reminder',
    'in_app',
    'delay_' || p_booking_id || '_' || (extract(epoch from now())::BIGINT / 300),
    jsonb_build_object(
      'booking_id', p_booking_id,
      'job_id', v_booking.job_id,
      'delay_minutes', p_minutes,
      'reason', p_reason
    ),
    '/shift/' || v_booking.job_id,
    'high'
  );

  RETURN jsonb_build_object(
    'success', true,
    'booking_id', p_booking_id,
    'delay_minutes', p_minutes,
    'message', 'Delay alert recorded and organizer notified.'
  );
END;
$$;

-- Explicit permissions
REVOKE ALL ON FUNCTION public.can_access_shift_messages(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_access_shift_messages(UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.report_worker_delay_safe(UUID, INTEGER, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.report_worker_delay_safe(UUID, INTEGER, TEXT) TO authenticated;


-- ##############################################################################
-- START MIGRATION: 20261015000005_enforce_kyc_on_application.sql
-- ##############################################################################

-- ==============================================================================
-- OPSKL MIGRATION: 20261015000005_enforce_kyc_on_application.sql
-- Enforces mandatory admin-approved KYC verification before applying for shifts.
-- ==============================================================================

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
  v_worker RECORD;
  v_existing_app RECORD;
  v_app_id UUID;
BEGIN
  IF v_worker_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'UNAUTHENTICATED');
  END IF;

  -- Require worker profile completed and KYC approved
  SELECT p.is_active, wp.profile_completion_status, wp.verification_status INTO v_worker
  FROM profiles p
  JOIN worker_profiles wp ON wp.id = p.id
  WHERE p.id = v_worker_id;

  IF NOT FOUND OR v_worker.is_active = false THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'INELIGIBLE_WORKER', 'message', 'Active worker account required.');
  END IF;

  IF v_worker.profile_completion_status != 'completed' THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'PROFILE_INCOMPLETE', 'message', 'Please complete your onboarding profile before applying.');
  END IF;

  IF v_worker.verification_status != 'verified' AND NOT is_current_admin() THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'KYC_NOT_VERIFIED', 'message', 'KYC identity verification must be approved by an administrator before applying for shifts.');
  END IF;

  SELECT * INTO v_job FROM jobs WHERE id = p_job_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'JOB_NOT_FOUND');
  END IF;

  IF v_job.status NOT IN ('open', 'filling') THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'JOB_CLOSED', 'message', 'This shift is no longer open for applications.');
  END IF;

  IF v_job.date < (now() AT TIME ZONE 'Asia/Kolkata')::date THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'PAST_DATE', 'message', 'Shift date has already passed.');
  END IF;

  IF v_job.application_deadline IS NOT NULL AND v_job.application_deadline < now() THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'DEADLINE_PASSED');
  END IF;

  IF v_job.slots_filled >= v_job.slots_total THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'SLOTS_FULL');
  END IF;

  SELECT id, status INTO v_existing_app
  FROM job_applications
  WHERE job_id = p_job_id AND worker_id = v_worker_id;

  IF FOUND THEN
    IF v_existing_app.status = 'withdrawn' THEN
      UPDATE job_applications
      SET status = 'applied', updated_at = now()
      WHERE id = v_existing_app.id;

      RETURN jsonb_build_object('success', true, 'application_id', v_existing_app.id, 'status', 'applied', 'reapplied', true);
    ELSE
      RETURN jsonb_build_object('success', false, 'error_code', 'ALREADY_APPLIED', 'message', 'You have already applied for this shift.');
    END IF;
  END IF;

  INSERT INTO job_applications (
    job_id, worker_id, status
  ) VALUES (
    p_job_id, v_worker_id, 'applied'
  ) RETURNING id INTO v_app_id;

  INSERT INTO audit_logs (
    actor_id, action, entity_type, entity_id, new_state
  ) VALUES (
    v_worker_id, 'APPLY_FOR_JOB', 'application', v_app_id::TEXT,
    jsonb_build_object('job_id', p_job_id, 'status', 'applied')
  );

  -- Send real-time notification to organizer
  PERFORM _notify(v_job.organizer_id, 'New Applicant for Shift', 'A verified worker has applied for ' || v_job.title, 'new_applicant');

  RETURN jsonb_build_object(
    'success', true,
    'application_id', v_app_id,
    'status', 'applied'
  );
END;
$$;


-- ##############################################################################
-- START MIGRATION: 20261015000006_fix_job_applications_updated_at.sql
-- ##############################################################################

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


-- ##############################################################################
-- START MIGRATION: 20261015000007_fix_invoice_platform_settings_keys.sql
-- ##############################################################################

-- Migration: 20261015000007_fix_invoice_platform_settings_keys.sql
-- Description: Expand organizer_invoices constraints, standardize platform_settings aliases, and fix generate_job_invoice_safe calculation & return payload

-- 1. Expand organizer_invoices check constraints to safely support 'issued' status and 'bank_transfer' method
ALTER TABLE organizer_invoices DROP CONSTRAINT IF EXISTS organizer_invoices_status_check;
ALTER TABLE organizer_invoices ADD CONSTRAINT organizer_invoices_status_check 
  CHECK (status = ANY (ARRAY['draft'::text, 'pending'::text, 'issued'::text, 'escrow_funded'::text, 'settled'::text, 'overdue'::text, 'cancelled'::text]));

ALTER TABLE organizer_invoices DROP CONSTRAINT IF EXISTS organizer_invoices_payment_method_check;
ALTER TABLE organizer_invoices ADD CONSTRAINT organizer_invoices_payment_method_check 
  CHECK (payment_method = ANY (ARRAY['upi'::text, 'netbanking'::text, 'neft_rtgs'::text, 'corporate_card'::text, 'sandbox_mock'::text, 'bank_transfer'::text]));

-- 2. Ensure platform_settings has both legacy and percent-suffixed keys with robust scalar numeric values
INSERT INTO platform_settings (key, value, description)
VALUES 
  ('platform_fee_percent', '10.0'::jsonb, 'Standard Opskl marketplace service fee percentage charged to organizers'),
  ('gst_rate_percent', '18.0'::jsonb, 'Indian GST rate applied strictly to the platform service fee (SAC 998519)'),
  ('min_hourly_wage_inr', '100.0'::jsonb, 'Enforced minimum hourly wage floor in INR to protect workers from sub-minimum wages'),
  ('platform_fee', '10.0'::jsonb, 'Legacy alias for platform fee percentage'),
  ('gst_rate', '18.0'::jsonb, 'Legacy alias for GST rate percentage'),
  ('min_wage', '100.0'::jsonb, 'Legacy alias for min hourly wage INR'),
  ('checkin_radius_m', '300.0'::jsonb, 'Checkin radius tolerance in meters')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- 3. Update generate_job_invoice_safe to be fully resilient and return invoice_number on update
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
  v_existing RECORD;
  v_wage_total NUMERIC(10, 2);
  v_fee_pct NUMERIC(5, 2);
  v_gst_pct NUMERIC(5, 2);
  v_platform_fee NUMERIC(10, 2);
  v_gst_amount NUMERIC(10, 2);
  v_total_payable NUMERIC(10, 2);
  v_invoice_number TEXT;
  v_invoice_id UUID;
  v_due_date TIMESTAMPTZ;
BEGIN
  SELECT id, organizer_id, total_pay, slots_total, date INTO v_job FROM jobs WHERE id = p_job_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Job not found.');
  END IF;

  -- Idempotency check: refuse to alter totals if already funded or settled
  SELECT * INTO v_existing FROM organizer_invoices WHERE job_id = p_job_id;
  IF FOUND THEN
    IF v_existing.status IN ('escrow_funded', 'settled') THEN
      RETURN jsonb_build_object(
        'success', true,
        'invoice_id', v_existing.id,
        'invoice_number', v_existing.invoice_number,
        'status', v_existing.status,
        'total_payable', v_existing.total_payable,
        'immutable', true
      );
    END IF;
  END IF;

  -- Fetch dynamic fee and GST percentages from platform settings with robust fallbacks
  SELECT COALESCE(
    CASE 
      WHEN jsonb_typeof(value) = 'number' THEN (value)::text::numeric
      WHEN jsonb_typeof(value) = 'string' THEN (value#>>'{}')::numeric
      ELSE (value->>'platform_fee_percent')::numeric
    END, 
    10.00
  ) INTO v_fee_pct
  FROM platform_settings WHERE key IN ('platform_fee_percent', 'platform_fee')
  LIMIT 1;

  IF v_fee_pct IS NULL THEN v_fee_pct := 10.00; END IF;

  SELECT COALESCE(
    CASE 
      WHEN jsonb_typeof(value) = 'number' THEN (value)::text::numeric
      WHEN jsonb_typeof(value) = 'string' THEN (value#>>'{}')::numeric
      ELSE (value->>'gst_rate_percent')::numeric
    END, 
    18.00
  ) INTO v_gst_pct
  FROM platform_settings WHERE key IN ('gst_rate_percent', 'gst_rate')
  LIMIT 1;

  IF v_gst_pct IS NULL THEN v_gst_pct := 18.00; END IF;

  v_wage_total := round(v_job.total_pay * v_job.slots_total, 2);
  v_platform_fee := round(v_wage_total * (v_fee_pct / 100.0), 2);
  v_gst_amount := round(v_platform_fee * (v_gst_pct / 100.0), 2);
  v_total_payable := v_wage_total + v_platform_fee + v_gst_amount;

  -- Due date: least(now() + 3 days, job.date - 1 day)
  v_due_date := LEAST(
    now() + interval '3 days',
    (v_job.date - 1)::timestamp AT TIME ZONE 'Asia/Kolkata'
  );

  IF v_existing.id IS NOT NULL THEN
    UPDATE organizer_invoices
    SET
      wage_total = v_wage_total,
      platform_fee = v_platform_fee,
      gst_rate = v_gst_pct,
      gst_amount = v_gst_amount,
      total_payable = v_total_payable,
      due_date = v_due_date,
      updated_at = now()
    WHERE id = v_existing.id
    RETURNING id INTO v_invoice_id;

    RETURN jsonb_build_object(
      'success', true, 
      'invoice_id', v_invoice_id, 
      'invoice_number', v_existing.invoice_number,
      'status', 'updated', 
      'total_payable', v_total_payable
    );
  END IF;

  v_invoice_number := generate_invoice_number();

  INSERT INTO organizer_invoices (
    invoice_number, job_id, organizer_id,
    wage_total, platform_fee, gst_rate, gst_amount, total_payable,
    status, payment_method, payment_provider, due_date, is_sandbox
  ) VALUES (
    v_invoice_number, p_job_id, v_job.organizer_id,
    v_wage_total, v_platform_fee, v_gst_pct, v_gst_amount, v_total_payable,
    'issued', 'bank_transfer', 'razorpay', v_due_date, true
  )
  RETURNING id INTO v_invoice_id;

  RETURN jsonb_build_object(
    'success', true,
    'invoice_id', v_invoice_id,
    'invoice_number', v_invoice_number,
    'status', 'issued',
    'total_payable', v_total_payable
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION generate_job_invoice_safe(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION generate_job_invoice_safe(UUID, UUID) TO authenticated;


-- ##############################################################################
-- START MIGRATION: 20261015000008_fix_check_in_timezone_window.sql
-- ##############################################################################

-- Migration: 20261015000008_fix_check_in_timezone_window.sql
-- Description: Fix check_in_worker_safe now() comparison to avoid double-offsetting TIMESTAMPTZ

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
  v_is_supervisor BOOLEAN := false;
  v_distance NUMERIC;
  v_radius_m NUMERIC := 300.0;
  v_shift_start TIMESTAMPTZ;
  v_shift_end TIMESTAMPTZ;
  v_now TIMESTAMPTZ := now();
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'UNAUTHENTICATED');
  END IF;

  SELECT * INTO v_booking FROM bookings WHERE id = p_booking_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'BOOKING_NOT_FOUND');
  END IF;

  SELECT * INTO v_job FROM jobs WHERE id = v_booking.job_id;

  v_is_supervisor := (v_user_id = v_booking.organizer_id OR is_current_admin());

  IF NOT v_is_supervisor AND v_user_id != v_booking.worker_id THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'UNAUTHORIZED');
  END IF;

  IF NOT validate_booking_transition(v_booking.status, 'checked_in') THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'INVALID_TRANSITION', 'message', 'Cannot check in from status ' || v_booking.status);
  END IF;

  -- Time window calculations in IST timezone converted to TIMESTAMPTZ
  v_shift_start := (v_job.date + v_job.start_time) AT TIME ZONE 'Asia/Kolkata';
  v_shift_end := (v_job.date + v_job.end_time + CASE WHEN v_job.end_time <= v_job.start_time THEN interval '1 day' ELSE interval '0' END) AT TIME ZONE 'Asia/Kolkata';

  IF NOT v_is_supervisor THEN
    -- Worker self check-in window: [start - 60 min, start + 120 min]
    IF v_now < (v_shift_start - interval '60 minutes') OR v_now > (v_shift_start + interval '120 minutes') THEN
      RETURN jsonb_build_object(
        'success', false,
        'error_code', 'OUTSIDE_CHECKIN_WINDOW',
        'message', 'Self check-in is permitted between 60 minutes before and 120 minutes after shift call time.'
      );
    END IF;
  ELSE
    -- Supervisor check-in window: [start - 4 hours, end]
    IF v_now < (v_shift_start - interval '4 hours') OR v_now > v_shift_end THEN
      RETURN jsonb_build_object(
        'success', false,
        'error_code', 'OUTSIDE_CHECKIN_WINDOW',
        'message', 'Supervisor check-in permitted only on shift day within operational window.'
      );
    END IF;
  END IF;

  -- Verification credential check
  IF trim(COALESCE(p_code, '')) != trim(COALESCE(v_booking.check_in_code, '')) THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'INVALID_CHECK_IN_CODE', 'message', 'Verification code does not match shift booking.');
  END IF;

  -- GPS and Geofence enforcement
  IF NOT v_is_supervisor THEN
    IF p_lat IS NULL OR p_lng IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error_code', 'LOCATION_REQUIRED', 'message', 'GPS coordinates are required for worker self check-in.');
    END IF;

    IF v_job.latitude IS NULL OR v_job.longitude IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error_code', 'VENUE_COORDINATES_MISSING', 'message', 'Venue coordinates not configured. Supervisor check-in required.');
    END IF;

    -- Haversine calculation in km
    v_distance := round(
      (6371 * acos(
        least(1.0, greatest(-1.0,
          cos(radians(p_lat)) * cos(radians(v_job.latitude)) *
          cos(radians(v_job.longitude) - radians(p_lng)) +
          sin(radians(p_lat)) * sin(radians(v_job.latitude))
        ))
      ))::numeric, 3
    );

    SELECT COALESCE((value->>'checkin_radius_m')::numeric, 300.0) INTO v_radius_m
    FROM platform_settings WHERE key = 'checkin_radius_m';

    IF (v_distance * 1000.0) > v_radius_m THEN
      RETURN jsonb_build_object(
        'success', false,
        'error_code', 'OUT_OF_GEOFENCE_RANGE',
        'message', 'You are outside the venue check-in area (' || round(v_distance * 1000.0) || 'm away, max ' || v_radius_m || 'm allowed).'
      );
    END IF;
  ELSE
    IF p_lat IS NOT NULL AND p_lng IS NOT NULL AND v_job.latitude IS NOT NULL AND v_job.longitude IS NOT NULL THEN
      v_distance := round(
        (6371 * acos(
          least(1.0, greatest(-1.0,
            cos(radians(p_lat)) * cos(radians(v_job.latitude)) *
            cos(radians(v_job.longitude) - radians(p_lng)) +
            sin(radians(p_lat)) * sin(radians(v_job.latitude))
          ))
        ))::numeric, 3
      );
    END IF;
  END IF;

  UPDATE bookings
  SET status = 'checked_in', check_in_time = now()
  WHERE id = p_booking_id;

  INSERT INTO attendance_records (
    booking_id, job_id, worker_id, supervisor_id,
    check_in_time, check_in_code, verified_by_supervisor,
    latitude, longitude, distance_to_venue_km
  ) VALUES (
    p_booking_id, v_booking.job_id, v_booking.worker_id, v_booking.organizer_id,
    now(), p_code, v_is_supervisor,
    p_lat, p_lng, LEAST(v_distance, 999.99)
  );

  PERFORM _notify(
    v_booking.organizer_id,
    'Worker Checked In',
    'Worker has checked in on-site for ' || v_job.title,
    'check_in',
    '/shift/' || v_job.id,
    jsonb_build_object('booking_id', p_booking_id, 'job_id', v_job.id)
  );

  INSERT INTO audit_logs (
    actor_id, action, entity_type, entity_id, new_state
  ) VALUES (
    v_user_id, 'CHECK_IN_WORKER', 'booking', p_booking_id::TEXT,
    jsonb_build_object('distance_km', v_distance, 'supervisor_verified', v_is_supervisor)
  );

  RETURN jsonb_build_object(
    'success', true,
    'status', 'checked_in',
    'check_in_time', now(),
    'distance_km', v_distance
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION check_in_worker_safe(UUID, TEXT, NUMERIC, NUMERIC) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION check_in_worker_safe(UUID, TEXT, NUMERIC, NUMERIC) TO authenticated;


-- ##############################################################################
-- START MIGRATION: 20261015000009_grant_is_current_admin_to_anon.sql
-- ##############################################################################

-- Migration: 20261015000009_grant_is_current_admin_to_anon.sql
-- Description: Grant EXECUTE on is_current_admin to anon so public discovery feed RLS policies evaluate cleanly without permission denied

GRANT EXECUTE ON FUNCTION is_current_admin() TO anon, authenticated, service_role;


-- ##############################################################################
-- START MIGRATION: 20261015000010_fix_organizer_registration_and_role_switching.sql
-- ##############################################################################

-- Migration 20261015000010: Fix Organizer Registration & Profile Switching
-- 1. Updates handle_new_user_provisioning trigger to auto-confirm new users and create organizer profile when role='organizer'
-- 2. Adds register_organizer_direct_safe RPC for direct atomic registration without failing on SMTP/Resend rate limits
-- 3. Updates ensure_user_profile_provisioned_safe to allow switching role to 'organizer' if requested by authenticated user
-- 4. Adds switch_user_role_safe RPC for existing accounts (e.g. Google auth) to switch between worker and organizer seamlessly

-- 1. Update handle_new_user_provisioning trigger
CREATE OR REPLACE FUNCTION public.handle_new_user_provisioning()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_role user_role;
  v_phone TEXT;
  v_name TEXT;
  v_email TEXT;
BEGIN
  v_role := CASE
    WHEN (NEW.raw_user_meta_data->>'role') = 'organizer' THEN 'organizer'::user_role
    WHEN (NEW.raw_user_meta_data->>'role') = 'admin' THEN 'admin'::user_role
    ELSE 'worker'::user_role
  END;

  v_email := NEW.email;
  v_phone := COALESCE(NEW.phone, NEW.raw_user_meta_data->>'phone');
  v_name := COALESCE(
    NEW.raw_user_meta_data->>'full_name', 
    NEW.raw_user_meta_data->>'name', 
    CASE WHEN v_email IS NOT NULL THEN split_part(v_email, '@', 1) ELSE 'User ' || substr(NEW.id::text, 1, 6) END
  );

  INSERT INTO public.profiles (
    id, role, phone, full_name, email, city, is_active
  ) VALUES (
    NEW.id, v_role, v_phone, v_name, v_email, 'Mumbai', true
  )
  ON CONFLICT (id) DO UPDATE SET
    role = CASE WHEN EXCLUDED.role = 'organizer' THEN 'organizer'::user_role ELSE profiles.role END,
    email = COALESCE(EXCLUDED.email, profiles.email);

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
      NEW.id, v_name, COALESCE(v_phone, ''), v_email, 'event_agency', 'incomplete', 'unverified'
    )
    ON CONFLICT (id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$function$;

-- 2. Update ensure_user_profile_provisioned_safe to support role switching when explicitly requested
CREATE OR REPLACE FUNCTION public.ensure_user_profile_provisioned_safe(
  p_role user_role DEFAULT 'worker',
  p_full_name TEXT DEFAULT NULL,
  p_phone TEXT DEFAULT NULL,
  p_email TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_existing_profile RECORD;
  v_target_role user_role := COALESCE(p_role, 'worker');
  v_name TEXT;
  v_phone TEXT;
  v_email TEXT;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Authentication required.');
  END IF;

  -- Admin cannot be assigned via client RPC
  IF v_target_role = 'admin' THEN
    v_target_role := 'worker';
  END IF;

  SELECT email INTO v_email FROM auth.users WHERE id = v_user_id;
  v_email := COALESCE(p_email, v_email);

  SELECT * INTO v_existing_profile FROM profiles WHERE id = v_user_id;

  IF FOUND THEN
    -- If user is already admin, keep admin
    IF v_existing_profile.role = 'admin' THEN
      v_target_role := 'admin';
    ELSIF p_role IS NOT NULL AND (p_role = 'organizer' OR p_role = 'worker') THEN
      -- Allow explicit role switch
      v_target_role := p_role;
      UPDATE profiles 
      SET 
        role = v_target_role,
        full_name = COALESCE(p_full_name, profiles.full_name),
        phone = COALESCE(p_phone, profiles.phone),
        email = COALESCE(v_email, profiles.email),
        updated_at = now()
      WHERE id = v_user_id;
    ELSE
      v_target_role := v_existing_profile.role;
      IF v_existing_profile.email IS NULL AND v_email IS NOT NULL THEN
        UPDATE profiles SET email = v_email WHERE id = v_user_id;
      END IF;
    END IF;
  ELSE
    v_name := COALESCE(
      p_full_name, 
      CASE WHEN v_email IS NOT NULL THEN split_part(v_email, '@', 1) ELSE 'User ' || substr(v_user_id::text, 1, 6) END
    );
    v_phone := p_phone;

    INSERT INTO profiles (id, role, phone, full_name, email, city, is_active)
    VALUES (v_user_id, v_target_role, v_phone, v_name, v_email, 'Mumbai', true)
    ON CONFLICT (id) DO UPDATE SET
      email = COALESCE(EXCLUDED.email, profiles.email);
  END IF;

  -- Provision profile extensions if missing
  IF v_target_role = 'worker' OR v_target_role = 'admin' THEN
    INSERT INTO worker_profiles (id, preferred_locality, skills, availability_status, profile_completion_status, verification_status)
    VALUES (v_user_id, 'Mumbai', '{}', 'available', 'incomplete', 'unverified')
    ON CONFLICT (id) DO NOTHING;
  END IF;

  IF v_target_role = 'organizer' OR v_target_role = 'admin' THEN
    INSERT INTO organizer_profiles (id, business_name, business_contact_phone, business_contact_email, business_type, profile_completion_status, verification_status)
    VALUES (v_user_id, COALESCE(p_full_name, 'Independent Organizer'), COALESCE(p_phone, ''), v_email, 'event_agency', 'incomplete', 'unverified')
    ON CONFLICT (id) DO UPDATE SET
      business_name = CASE WHEN organizer_profiles.business_name = 'Independent Organizer' THEN COALESCE(EXCLUDED.business_name, organizer_profiles.business_name) ELSE organizer_profiles.business_name END,
      business_contact_email = COALESCE(organizer_profiles.business_contact_email, EXCLUDED.business_contact_email);
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'user_id', v_user_id,
    'role', v_target_role,
    'email', v_email
  );
END;
$$;

-- 3. Dedicated switch_user_role_safe RPC
CREATE OR REPLACE FUNCTION public.switch_user_role_safe(
  p_target_role user_role,
  p_business_name TEXT DEFAULT NULL,
  p_business_phone TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_profile RECORD;
  v_email TEXT;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Authentication required.');
  END IF;

  IF p_target_role NOT IN ('worker', 'organizer') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Target role must be worker or organizer.');
  END IF;

  SELECT * INTO v_profile FROM profiles WHERE id = v_user_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'User profile not found.');
  END IF;

  IF v_profile.role = 'admin' THEN
    RETURN jsonb_build_object('success', true, 'message', 'Admin has universal access.', 'role', 'admin');
  END IF;

  SELECT email INTO v_email FROM auth.users WHERE id = v_user_id;

  -- Update role on profiles table
  UPDATE profiles
  SET role = p_target_role, updated_at = now()
  WHERE id = v_user_id;

  -- Ensure target role subprofile exists
  IF p_target_role = 'organizer' THEN
    INSERT INTO organizer_profiles (
      id, business_name, business_contact_phone, business_contact_email, business_type, profile_completion_status, verification_status
    ) VALUES (
      v_user_id,
      COALESCE(p_business_name, v_profile.full_name, 'Independent Organizer'),
      COALESCE(p_business_phone, v_profile.phone, ''),
      COALESCE(v_profile.email, v_email),
      'event_agency',
      'incomplete',
      'unverified'
    )
    ON CONFLICT (id) DO UPDATE SET
      business_name = COALESCE(EXCLUDED.business_name, organizer_profiles.business_name),
      business_contact_phone = COALESCE(EXCLUDED.business_contact_phone, organizer_profiles.business_contact_phone);
  ELSIF p_target_role = 'worker' THEN
    INSERT INTO worker_profiles (
      id, preferred_locality, skills, availability_status, profile_completion_status, verification_status
    ) VALUES (
      v_user_id, 'Mumbai', '{}', 'available', 'incomplete', 'unverified'
    )
    ON CONFLICT (id) DO NOTHING;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'user_id', v_user_id,
    'role', p_target_role
  );
END;
$$;

-- 4. Direct Organizer Registration RPC (bypasses Resend/SMTP email failures in development/pilot)
CREATE OR REPLACE FUNCTION public.register_organizer_direct_safe(
  p_email TEXT,
  p_password TEXT,
  p_business_name TEXT,
  p_phone TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_norm_email TEXT := lower(trim(p_email));
  v_norm_phone TEXT := trim(p_phone);
  v_norm_name TEXT := trim(p_business_name);
  v_existing_user_id UUID;
  v_new_user_id UUID;
  v_encrypted_pw TEXT;
BEGIN
  IF v_norm_email IS NULL OR v_norm_email NOT LIKE '%@%.%' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid email address provided.');
  END IF;

  IF length(p_password) < 6 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Password must be at least 6 characters.');
  END IF;

  IF length(v_norm_name) < 2 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Organization name is required.');
  END IF;

  -- Check if user already exists in auth.users
  SELECT id INTO v_existing_user_id FROM auth.users WHERE lower(email) = v_norm_email;

  IF v_existing_user_id IS NOT NULL THEN
    -- User already exists: update role to organizer and ensure organizer_profiles entry
    v_encrypted_pw := extensions.crypt(p_password, extensions.gen_salt('bf'));

    UPDATE auth.users
    SET 
      encrypted_password = v_encrypted_pw,
      email_confirmed_at = COALESCE(email_confirmed_at, now()),
      raw_user_meta_data = raw_user_meta_data || jsonb_build_object('role', 'organizer', 'full_name', v_norm_name, 'phone', v_norm_phone),
      updated_at = now()
    WHERE id = v_existing_user_id;

    UPDATE profiles
    SET 
      role = 'organizer',
      full_name = v_norm_name,
      phone = v_norm_phone,
      updated_at = now()
    WHERE id = v_existing_user_id;

    INSERT INTO organizer_profiles (
      id, business_name, business_contact_phone, business_contact_email, business_type, profile_completion_status, verification_status
    ) VALUES (
      v_existing_user_id, v_norm_name, v_norm_phone, v_norm_email, 'event_agency', 'incomplete', 'unverified'
    )
    ON CONFLICT (id) DO UPDATE SET
      business_name = EXCLUDED.business_name,
      business_contact_phone = EXCLUDED.business_contact_phone;

    RETURN jsonb_build_object(
      'success', true,
      'user_id', v_existing_user_id,
      'is_existing_account', true,
      'message', 'Existing account upgraded to Organizer profile.'
    );
  END IF;

  -- Create brand new user in auth.users
  v_new_user_id := gen_random_uuid();
  v_encrypted_pw := extensions.crypt(p_password, extensions.gen_salt('bf'));

  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    v_new_user_id,
    'authenticated',
    'authenticated',
    v_norm_email,
    v_encrypted_pw,
    now(),
    jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
    jsonb_build_object('role', 'organizer', 'full_name', v_norm_name, 'phone', v_norm_phone),
    now(),
    now()
  );

  INSERT INTO auth.identities (
    id,
    user_id,
    identity_data,
    provider,
    provider_id,
    last_sign_in_at,
    created_at,
    updated_at
  ) VALUES (
    gen_random_uuid(),
    v_new_user_id,
    jsonb_build_object('sub', v_new_user_id::text, 'email', v_norm_email),
    'email',
    v_new_user_id::text,
    now(),
    now(),
    now()
  );

  -- Profiles and organizer_profiles are created via trg_on_auth_user_created,
  -- but ensure them explicitly here for guaranteed idempotency:
  INSERT INTO profiles (
    id, role, phone, full_name, email, city, is_active
  ) VALUES (
    v_new_user_id, 'organizer', v_norm_phone, v_norm_name, v_norm_email, 'Mumbai', true
  )
  ON CONFLICT (id) DO UPDATE SET
    role = 'organizer',
    full_name = EXCLUDED.full_name,
    phone = EXCLUDED.phone;

  INSERT INTO organizer_profiles (
    id, business_name, business_contact_phone, business_contact_email, business_type, profile_completion_status, verification_status
  ) VALUES (
    v_new_user_id, v_norm_name, v_norm_phone, v_norm_email, 'event_agency', 'incomplete', 'unverified'
  )
  ON CONFLICT (id) DO UPDATE SET
    business_name = EXCLUDED.business_name,
    business_contact_phone = EXCLUDED.business_contact_phone;

  RETURN jsonb_build_object(
    'success', true,
    'user_id', v_new_user_id,
    'is_existing_account', false,
    'message', 'Organizer account registered and verified.'
  );
END;
$$;

-- Grant EXECUTE permissions
GRANT EXECUTE ON FUNCTION public.ensure_user_profile_provisioned_safe(user_role, TEXT, TEXT, TEXT) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.switch_user_role_safe(user_role, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.register_organizer_direct_safe(TEXT, TEXT, TEXT, TEXT) TO anon, authenticated;


-- ##############################################################################
-- START MIGRATION: 20261015000011_fix_upi_regex_bound.sql
-- ##############################################################################

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


-- ##############################################################################
-- START MIGRATION: 20261015000012_robust_create_job_safe.sql
-- ##############################################################################

-- Migration 20261015000012: Robust category and bounds handling in create_job_safe
-- 1. Normalizes category to lowercase trim before casting to shift_category
-- 2. Aligns duration checks to allow micro-shifts (min 0.5h up to 24h)
-- 3. Ensures clear descriptive errors for organizers

CREATE OR REPLACE FUNCTION public.create_job_safe(p_job JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_organizer_id UUID := auth.uid();
  v_title TEXT := trim(p_job->>'title');
  v_raw_cat TEXT := lower(trim(p_job->>'category'));
  v_category shift_category;
  v_venue_name TEXT := trim(p_job->>'venue_name');
  v_venue_address TEXT := trim(p_job->>'venue_address');
  v_landmark TEXT := p_job->>'landmark';
  v_city TEXT := COALESCE(p_job->>'city', 'Mumbai');
  v_zone TEXT := p_job->>'zone';
  v_date DATE := (p_job->>'date')::DATE;
  v_start_time TIME := (p_job->>'start_time')::TIME;
  v_end_time TIME := (p_job->>'end_time')::TIME;
  v_hourly_rate NUMERIC := (p_job->>'hourly_rate')::NUMERIC;
  v_slots_total INTEGER := (p_job->>'slots_total')::INTEGER;
  v_status shift_status := COALESCE(p_job->>'status', 'open')::shift_status;
  v_dress_code TEXT := p_job->>'dress_code';
  v_supervisor_name TEXT := trim(p_job->>'supervisor_name');
  v_supervisor_phone TEXT := trim(p_job->>'supervisor_phone');
  v_reporting_instructions TEXT := p_job->>'reporting_instructions';
  v_cancellation_policy TEXT := p_job->>'cancellation_policy';
  v_eligibility_criteria TEXT := p_job->>'eligibility_criteria';
  v_lat NUMERIC := (p_job->>'latitude')::NUMERIC;
  v_lng NUMERIC := (p_job->>'longitude')::NUMERIC;
  v_duties TEXT[] := ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_job->'duties', '[]'::jsonb)));
  v_required_skills TEXT[] := ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_job->'required_skills', '[]'::jsonb)));
  v_perks TEXT[] := ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_job->'perks', '[]'::jsonb)));
  v_breaks_minutes INTEGER := COALESCE((p_job->>'breaks_minutes')::INTEGER, 30);
  v_meal_provided BOOLEAN := COALESCE((p_job->>'meal_provided')::BOOLEAN, false);
  v_transport_provided BOOLEAN := COALESCE((p_job->>'transport_provided')::BOOLEAN, false);
  v_overtime_policy TEXT := p_job->>'overtime_policy';
  v_crosses_midnight BOOLEAN := false;
  v_end_date DATE;
  v_duration_hours NUMERIC;
  v_total_pay NUMERIC;
  v_min_wage NUMERIC := 100.0;
  v_new_id UUID;
BEGIN
  IF v_organizer_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'UNAUTHENTICATED');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM organizer_profiles
    WHERE id = v_organizer_id AND (verification_status = 'verified' OR is_current_admin())
  ) THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'ORGANIZER_NOT_VERIFIED', 'message', 'Organizer identity verification required to post shifts.');
  END IF;

  -- Safe enum casting
  BEGIN
    v_category := v_raw_cat::shift_category;
  EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'INVALID_CATEGORY', 'message', 'Invalid shift category: ' || COALESCE(p_job->>'category', 'none'));
  END;

  -- Title length aligned with client bounds: 5 to 80 chars
  IF length(v_title) < 5 OR length(v_title) > 80 THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'INVALID_TITLE', 'message', 'Shift title must be between 5 and 80 characters.');
  END IF;

  -- Read min wage from settings
  SELECT COALESCE((value->>'min_hourly_wage_inr')::numeric, 100.0) INTO v_min_wage
  FROM platform_settings WHERE key = 'min_wage';

  -- Rate limits: ₹100 to ₹2000/hr
  IF v_hourly_rate < v_min_wage OR v_hourly_rate > 2000 THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'INVALID_WAGE', 'message', 'Hourly rate must be between ₹' || v_min_wage || ' and ₹2,000/hr.');
  END IF;

  -- Slots limit: 1 to 100 workers
  IF v_slots_total < 1 OR v_slots_total > 100 THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'INVALID_SLOTS', 'message', 'Headcount must be between 1 and 100 workers.');
  END IF;

  -- Date check in IST
  IF v_date < (now() AT TIME ZONE 'Asia/Kolkata')::date THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'PAST_DATE', 'message', 'Shift date cannot be in the past.');
  END IF;

  -- Overnight calculation
  IF v_end_time <= v_start_time THEN
    v_crosses_midnight := true;
    v_end_date := v_date + 1;
    v_duration_hours := round((EXTRACT(EPOCH FROM (v_end_time - v_start_time + interval '24 hours')) / 3600.0)::numeric, 2);
  ELSE
    v_crosses_midnight := false;
    v_end_date := v_date;
    v_duration_hours := round((EXTRACT(EPOCH FROM (v_end_time - v_start_time)) / 3600.0)::numeric, 2);
  END IF;

  -- Allow duration between 0.5 and 24 hours
  IF v_duration_hours < 0.5 OR v_duration_hours > 24.0 THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'INVALID_DURATION', 'message', 'Shift duration must be between 0.5 and 24 hours.');
  END IF;

  -- India geographic coordinate bounds check (Lat: 6–38 N, Lng: 68–98 E)
  IF v_lat IS NOT NULL OR v_lng IS NOT NULL THEN
    IF v_lat < 6.0 OR v_lat > 38.0 OR v_lng < 68.0 OR v_lng > 98.0 THEN
      RETURN jsonb_build_object('success', false, 'error_code', 'INVALID_COORDINATES', 'message', 'Coordinates must fall within the sovereign territory of India (6–38°N, 68–98°E).');
    END IF;
  END IF;

  v_total_pay := round(v_hourly_rate * v_duration_hours, 2);

  INSERT INTO jobs (
    organizer_id, title, category, venue_name, venue_address, landmark,
    city, zone, date, start_time, end_time, duration_hours,
    hourly_rate, total_pay, slots_total, slots_filled, dress_code,
    duties, perks, required_skills, breaks_minutes, meal_provided,
    transport_provided, overtime_policy, reporting_instructions,
    cancellation_policy, eligibility_criteria, latitude, longitude,
    supervisor_name, supervisor_phone, status, crosses_midnight, end_date
  ) VALUES (
    v_organizer_id, v_title, v_category, v_venue_name, v_venue_address, v_landmark,
    v_city, v_zone, v_date, v_start_time, v_end_time, v_duration_hours,
    v_hourly_rate, v_total_pay, v_slots_total, 0, v_dress_code,
    v_duties, v_perks, v_required_skills, v_breaks_minutes, v_meal_provided,
    v_transport_provided, v_overtime_policy, v_reporting_instructions,
    v_cancellation_policy, v_eligibility_criteria, v_lat, v_lng,
    v_supervisor_name, v_supervisor_phone, v_status, v_crosses_midnight, v_end_date
  ) RETURNING id INTO v_new_id;

  INSERT INTO audit_logs (
    actor_id, action, entity_type, entity_id, new_state
  ) VALUES (
    v_organizer_id, 'CREATE_JOB', 'job', v_new_id::TEXT,
    jsonb_build_object('title', v_title, 'duration_hours', v_duration_hours, 'total_pay', v_total_pay, 'crosses_midnight', v_crosses_midnight)
  );

  RETURN jsonb_build_object('success', true, 'job_id', v_new_id, 'duration_hours', v_duration_hours, 'total_pay', v_total_pay);
END;
$$;


-- ##############################################################################
-- START MIGRATION: 20261015000013_fix_verification_case_column.sql
-- ##############################################################################

-- Migration 20261015000013: Fix document_masked_id in submit_verification_case_safe
-- Replaces erroneous 'document_number_masked' with actual table column 'document_masked_id'

CREATE OR REPLACE FUNCTION submit_verification_case_safe(
  p_document_type TEXT,
  p_masked_id TEXT,
  p_storage_path TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_case_id UUID;
  v_user_str TEXT;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Authentication required.');
  END IF;

  v_user_str := v_user_id::TEXT;

  IF p_document_type NOT IN ('aadhaar', 'pan', 'gstin') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Document type must be aadhaar, pan, or gstin.');
  END IF;

  -- Storage path security: must be strictly scoped to caller's user directory
  IF NOT (
    p_storage_path LIKE (v_user_str || '/%')
    OR p_storage_path LIKE ('kyc/' || v_user_str || '/%')
    OR p_storage_path LIKE ('verification/' || v_user_str || '/%')
    OR p_storage_path LIKE ('verification/%/' || v_user_str || '.%')
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Storage path must be scoped to your authenticated user directory.');
  END IF;

  -- Reject if pending case already exists for this document type
  IF EXISTS (
    SELECT 1 FROM verification_cases
    WHERE profile_id = v_user_id AND document_type = p_document_type AND status = 'pending'
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'A verification case is already pending review for this document type.');
  END IF;

  INSERT INTO verification_cases (
    profile_id, document_type, document_masked_id, document_storage_path, status
  ) VALUES (
    v_user_id, p_document_type, p_masked_id, p_storage_path, 'pending'
  ) RETURNING id INTO v_case_id;

  -- Update profile status to pending
  PERFORM set_config('opskl.trusted', '1', true);
  UPDATE worker_profiles SET verification_status = 'pending', updated_at = now() WHERE id = v_user_id;
  UPDATE organizer_profiles SET verification_status = 'pending', updated_at = now() WHERE id = v_user_id;

  RETURN jsonb_build_object('success', true, 'case_id', v_case_id, 'status', 'pending');
END;
$$;

REVOKE EXECUTE ON FUNCTION submit_verification_case_safe(TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION submit_verification_case_safe(TEXT, TEXT, TEXT) TO authenticated;


-- ##############################################################################
-- START MIGRATION: 20261016000000_security_privacy_coordinate_hardening.sql
-- ##############################################################################

-- ==============================================================================
-- OPSKIL DATABASE MIGRATION: 20261016000000_security_privacy_coordinate_hardening.sql
-- Resolves:
--   1. Finding 2: Supervisor contact privacy shield on raw jobs table & public_jobs view
--   2. Finding 4: Organizer GSTIN / billing address exposure shield on organizer_profiles
--   3. Finding 6: Venue coordinates partial pair validation in create_job_safe
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. HARDEN COORDINATE BOUNDS & INTEGRITY IN create_job_safe
-- ------------------------------------------------------------------------------

DROP FUNCTION IF EXISTS public.create_job_safe(JSONB, UUID);
DROP FUNCTION IF EXISTS public.create_job_safe(JSONB);

CREATE OR REPLACE FUNCTION public.create_job_safe(
  p_job JSONB,
  p_organizer_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_effective_org_id UUID := COALESCE(p_organizer_id, (p_job->>'organizer_id')::uuid, auth.uid());
  v_job_id UUID;
  v_title TEXT := trim(COALESCE(p_job->>'title', ''));
  v_raw_cat TEXT := lower(trim(COALESCE(p_job->>'category', 'conference')));
  v_category shift_category;
  v_venue_name TEXT := trim(COALESCE(p_job->>'venue_name', p_job->>'venueName', ''));
  v_venue_addr TEXT := trim(COALESCE(p_job->>'venue_address', p_job->>'venueAddress', ''));
  v_landmark TEXT := trim(COALESCE(p_job->>'landmark', ''));
  v_city TEXT := COALESCE(NULLIF(trim(p_job->>'city'), ''), 'Mumbai');
  v_zone TEXT := trim(COALESCE(p_job->>'zone', ''));
  v_lat NUMERIC := (p_job->>'latitude')::numeric;
  v_lng NUMERIC := (p_job->>'longitude')::numeric;
  v_date DATE := (p_job->>'date')::date;
  v_start_time TIME := (p_job->>'start_time')::time;
  v_end_time TIME := (p_job->>'end_time')::time;
  v_hourly_rate NUMERIC := COALESCE((p_job->>'hourly_rate')::numeric, (p_job->>'hourlyRate')::numeric, 0);
  v_slots_total INT := COALESCE((p_job->>'slots_total')::int, (p_job->>'slotsTotal')::int, 0);
  v_dress_code TEXT := trim(COALESCE(p_job->>'dress_code', p_job->>'dressCode', ''));
  v_duties TEXT[] := CASE 
    WHEN p_job->'duties' IS NOT NULL AND jsonb_typeof(p_job->'duties') = 'array' 
    THEN ARRAY(SELECT jsonb_array_elements_text(p_job->'duties'))
    ELSE ARRAY[]::TEXT[]
  END;
  v_required_skills TEXT[] := CASE 
    WHEN COALESCE(p_job->'required_skills', p_job->'requiredSkills') IS NOT NULL 
         AND jsonb_typeof(COALESCE(p_job->'required_skills', p_job->'requiredSkills')) = 'array'
    THEN ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_job->'required_skills', p_job->'requiredSkills')))
    ELSE ARRAY[]::TEXT[]
  END;
  v_perks TEXT[] := CASE 
    WHEN p_job->'perks' IS NOT NULL AND jsonb_typeof(p_job->'perks') = 'array' 
    THEN ARRAY(SELECT jsonb_array_elements_text(p_job->'perks'))
    ELSE ARRAY[]::TEXT[]
  END;
  v_eligibility TEXT := trim(COALESCE(p_job->>'eligibility_criteria', p_job->>'eligibilityCriteria', ''));
  v_breaks_mins INT := COALESCE((p_job->>'breaks_minutes')::int, (p_job->>'breaksMinutes')::int, 30);
  v_meal_provided BOOLEAN := COALESCE((p_job->>'meal_provided')::boolean, (p_job->>'mealProvided')::boolean, false);
  v_transport_provided BOOLEAN := COALESCE((p_job->>'transport_provided')::boolean, (p_job->>'transportProvided')::boolean, false);
  v_overtime_policy TEXT := trim(COALESCE(p_job->>'overtime_policy', p_job->>'overtimePolicy', ''));
  v_reporting_instructions TEXT := trim(COALESCE(p_job->>'reporting_instructions', p_job->>'reportingInstructions', ''));
  v_cancellation_policy TEXT := trim(COALESCE(p_job->>'cancellation_policy', p_job->>'cancellationPolicy', ''));
  v_supervisor_name TEXT := trim(COALESCE(p_job->>'supervisor_name', p_job->>'supervisorName', ''));
  v_supervisor_phone TEXT := trim(COALESCE(p_job->>'supervisor_phone', p_job->>'supervisorPhone', ''));
  v_raw_status TEXT := lower(trim(COALESCE(p_job->>'status', 'open')));
  v_status shift_status;
  v_app_deadline TIMESTAMPTZ;
  v_payment_deadline TIMESTAMPTZ;
  v_shift_start_timestamptz TIMESTAMPTZ;
  v_crosses_midnight BOOLEAN;
  v_end_date DATE;
  v_duration_hours NUMERIC;
  v_total_pay NUMERIC;
  v_org_verified TEXT;
  v_org_active BOOLEAN;
  v_min_wage NUMERIC := 100.0;
BEGIN
  -- Authentication check: must have an authenticated user (bypassed only for service_role / postgres superuser)
  IF auth.uid() IS NULL AND COALESCE(auth.role(), '') <> 'service_role' AND current_user <> 'postgres' THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'UNAUTHENTICATED', 'message', 'Please sign in to publish shifts.');
  END IF;

  IF v_effective_org_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'ORGANIZER_REQUIRED', 'message', 'Organizer identity is required.');
  END IF;

  -- Authorization: Caller must be the organizer or admin
  IF auth.uid() IS NOT NULL AND auth.uid() <> v_effective_org_id AND NOT is_current_admin() THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'UNAUTHORIZED', 'message', 'You are not authorized to post shifts on behalf of another organizer.');
  END IF;

  -- Lifecycle status check (Defect 2): Only 'draft' and 'open' are permitted at creation
  IF v_raw_status NOT IN ('draft', 'open') THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'INVALID_INITIAL_STATUS', 'message', 'Initial shift status must be either "draft" or "open". Status "' || v_raw_status || '" is prohibited at creation.');
  END IF;
  v_status := v_raw_status::shift_status;

  -- Organizer verification check
  SELECT verification_status INTO v_org_verified
  FROM organizer_profiles WHERE id = v_effective_org_id;

  SELECT is_active INTO v_org_active
  FROM profiles WHERE id = v_effective_org_id;

  IF v_org_active IS FALSE THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'ORGANIZER_INACTIVE', 'message', 'This organizer account has been suspended or deactivated.');
  END IF;

  -- Require existing organizer profile for publishing non-draft shifts
  IF v_status <> 'draft' AND v_org_verified IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'ORGANIZER_NOT_FOUND', 'message', 'Organizer profile not found.');
  END IF;

  -- Require verified organizer for publishing non-draft shifts (admins bypass)
  IF v_status <> 'draft' AND v_org_verified <> 'verified' AND NOT is_current_admin() THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'ORGANIZER_NOT_VERIFIED', 'message', 'Organizer identity verification required to post shifts.');
  END IF;

  -- Safe category enum casting
  BEGIN
    v_category := v_raw_cat::shift_category;
  EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'INVALID_CATEGORY', 'message', 'Invalid shift category: ' || COALESCE(p_job->>'category', 'none'));
  END;

  -- Title length aligned: 5 to 80 chars
  IF length(v_title) < 5 OR length(v_title) > 80 THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'INVALID_TITLE', 'message', 'Shift title must be between 5 and 80 characters.');
  END IF;

  -- Read min wage from settings with safe fallback if row is missing (Defect 3)
  v_min_wage := 100.0;
  SELECT COALESCE(
    CASE 
      WHEN jsonb_typeof(value) = 'object' THEN (value->>'min_hourly_wage_inr')::numeric
      WHEN jsonb_typeof(value) = 'number' THEN (value)::text::numeric
      ELSE NULL
    END,
    100.0
  ) INTO v_min_wage
  FROM platform_settings 
  WHERE key IN ('min_wage', 'min_hourly_wage_inr')
  ORDER BY CASE WHEN key = 'min_hourly_wage_inr' THEN 1 ELSE 2 END
  LIMIT 1;

  v_min_wage := GREATEST(COALESCE(v_min_wage, 100.0), 100.0);

  -- Rate limits: ₹100 to ₹2000/hr
  IF v_hourly_rate < v_min_wage OR v_hourly_rate > 2000 THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'INVALID_WAGE', 'message', 'Hourly rate must be between ₹' || v_min_wage || ' and ₹2,000/hr.');
  END IF;

  -- Slots limit: 1 to 50 workers (aligned with client schema)
  IF v_slots_total < 1 OR v_slots_total > 50 THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'INVALID_SLOTS', 'message', 'Headcount must be between 1 and 50 workers.');
  END IF;

  -- Schedule validation
  IF v_date IS NULL OR v_start_time IS NULL OR v_end_time IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'INVALID_SCHEDULE', 'message', 'Shift date, start time, and end time are required.');
  END IF;

  -- Date check in IST
  IF v_date < (now() AT TIME ZONE 'Asia/Kolkata')::date THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'PAST_DATE', 'message', 'Shift date cannot be in the past.');
  END IF;

  -- Same-day start time check in IST (Defect 4)
  v_shift_start_timestamptz := (v_date + v_start_time) AT TIME ZONE 'Asia/Kolkata';
  IF v_shift_start_timestamptz <= now() THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'PAST_START_TIME', 'message', 'Shift start time has already passed for the scheduled date.');
  END IF;

  -- Overnight and duration calculation
  IF v_end_time <= v_start_time THEN
    v_crosses_midnight := true;
    v_end_date := v_date + 1;
    v_duration_hours := round((EXTRACT(EPOCH FROM (v_end_time - v_start_time + interval '24 hours')) / 3600.0)::numeric, 2);
  ELSE
    v_crosses_midnight := false;
    v_end_date := v_date;
    v_duration_hours := round((EXTRACT(EPOCH FROM (v_end_time - v_start_time)) / 3600.0)::numeric, 2);
  END IF;

  -- Allow duration between 1.0 and 14.0 hours (aligned with client schema)
  IF v_duration_hours < 1.0 OR v_duration_hours > 14.0 THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'INVALID_DURATION', 'message', 'Shift duration must be between 1 and 14 hours.');
  END IF;

  -- Break duration bounds check (Defect 5: 0–120 mins and strictly less than shift duration)
  IF v_breaks_mins < 0 OR v_breaks_mins > 120 THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'INVALID_BREAK_DURATION', 'message', 'Break duration must be between 0 and 120 minutes.');
  END IF;

  IF (v_breaks_mins / 60.0) >= v_duration_hours THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'BREAK_EXCEEDS_DURATION', 'message', 'Break duration cannot equal or exceed total shift duration.');
  END IF;

  -- Deadlines parsing & validation (Defect 1)
  IF p_job->>'application_deadline' IS NOT NULL AND trim(p_job->>'application_deadline') <> '' THEN
    BEGIN
      v_app_deadline := (p_job->>'application_deadline')::timestamptz;
    EXCEPTION WHEN OTHERS THEN
      RETURN jsonb_build_object('success', false, 'error_code', 'INVALID_APPLICATION_DEADLINE', 'message', 'Invalid application deadline format.');
    END;

    IF v_app_deadline <= now() THEN
      RETURN jsonb_build_object('success', false, 'error_code', 'INVALID_APPLICATION_DEADLINE', 'message', 'Application deadline must be in the future.');
    END IF;

    IF v_app_deadline > v_shift_start_timestamptz THEN
      RETURN jsonb_build_object('success', false, 'error_code', 'INVALID_APPLICATION_DEADLINE', 'message', 'Application deadline cannot be after the shift start time.');
    END IF;
  END IF;

  IF p_job->>'payment_deadline' IS NOT NULL AND trim(p_job->>'payment_deadline') <> '' THEN
    BEGIN
      v_payment_deadline := (p_job->>'payment_deadline')::timestamptz;
    EXCEPTION WHEN OTHERS THEN
      RETURN jsonb_build_object('success', false, 'error_code', 'INVALID_PAYMENT_DEADLINE', 'message', 'Invalid payment deadline format.');
    END;

    IF v_payment_deadline < now() THEN
      RETURN jsonb_build_object('success', false, 'error_code', 'INVALID_PAYMENT_DEADLINE', 'message', 'Payment deadline cannot be in the past.');
    END IF;
  END IF;

  -- Require BOTH coordinates to be present together or BOTH absent (Fix 6)
  IF (v_lat IS NULL AND v_lng IS NOT NULL) OR (v_lat IS NOT NULL AND v_lng IS NULL) THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'INCOMPLETE_COORDINATES', 'message', 'Both latitude and longitude must be provided together or omitted.');
  END IF;

  -- India geographic coordinate bounds check (Lat: 6–38 N, Lng: 68–98 E)
  IF v_lat IS NOT NULL AND v_lng IS NOT NULL THEN
    IF v_lat < 6.0 OR v_lat > 38.0 OR v_lng < 68.0 OR v_lng > 98.0 THEN
      RETURN jsonb_build_object('success', false, 'error_code', 'INVALID_COORDINATES', 'message', 'Coordinates must fall within the sovereign territory of India (6–38°N, 68–98°E).');
    END IF;
  END IF;

  -- Authoritative payable-hours rule (Defect 6):
  -- In Indian event and exhibition commercial staffing, shifts are scheduled as full on-site engagement blocks.
  -- Scheduled rest breaks (up to 120 minutes) are paid rest periods included in the on-site engagement duration.
  -- Total pay is calculated directly from scheduled engagement duration: hourly_rate * duration_hours.
  v_total_pay := round(v_hourly_rate * v_duration_hours, 2);

  -- Insert shift with application_deadline and payment_deadline persisted (Defect 1)
  INSERT INTO jobs (
    organizer_id, title, category, venue_name, venue_address,
    landmark, city, zone, latitude, longitude,
    date, start_time, end_time, duration_hours,
    hourly_rate, total_pay, slots_total, slots_filled,
    dress_code, duties, perks, required_skills, eligibility_criteria,
    breaks_minutes, meal_provided, transport_provided, overtime_policy,
    reporting_instructions, cancellation_policy,
    application_deadline, payment_deadline,
    supervisor_name, supervisor_phone, status, crosses_midnight, end_date
  ) VALUES (
    v_effective_org_id, v_title, v_category, v_venue_name, v_venue_addr,
    v_landmark, v_city, v_zone, v_lat, v_lng,
    v_date, v_start_time, v_end_time, v_duration_hours,
    v_hourly_rate, v_total_pay, v_slots_total, 0,
    v_dress_code, v_duties, v_perks, v_required_skills, v_eligibility,
    v_breaks_mins, v_meal_provided, v_transport_provided, v_overtime_policy,
    v_reporting_instructions, v_cancellation_policy,
    v_app_deadline, v_payment_deadline,
    v_supervisor_name, v_supervisor_phone, v_status, v_crosses_midnight, v_end_date
  ) RETURNING id INTO v_job_id;

  RETURN jsonb_build_object(
    'success', true,
    'job_id', v_job_id,
    'title', v_title,
    'total_pay', v_total_pay,
    'duration_hours', v_duration_hours,
    'crosses_midnight', v_crosses_midnight,
    'application_deadline', v_app_deadline,
    'payment_deadline', v_payment_deadline
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_job_safe(JSONB, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_job_safe(JSONB, UUID) TO authenticated;

-- ------------------------------------------------------------------------------
-- 2. SHIELD SUPERVISOR CONTACTS ON JOBS TABLE (Fix 2)
-- ------------------------------------------------------------------------------

-- Drop and recreate public_jobs view with security_barrier = true
-- Omits supervisor_name and supervisor_phone
DROP VIEW IF EXISTS public.public_jobs CASCADE;

CREATE VIEW public.public_jobs
WITH (security_barrier = true) AS
  SELECT
    id,
    organizer_id,
    title,
    category,
    venue_name,
    venue_address,
    landmark,
    city,
    zone,
    date,
    start_time,
    end_time,
    duration_hours,
    hourly_rate,
    total_pay,
    wage_per_worker,
    slots_total,
    slots_filled,
    dress_code,
    duties,
    perks,
    required_skills,
    eligibility_criteria,
    application_deadline,
    breaks_minutes,
    meal_provided,
    transport_provided,
    overtime_policy,
    latitude,
    longitude,
    status,
    created_at,
    updated_at,
    crosses_midnight,
    end_date
  FROM public.jobs
  WHERE status IN ('open', 'filling')
    AND date >= CURRENT_DATE;

GRANT SELECT ON public.public_jobs TO anon, authenticated;

-- Restrict direct SELECT on jobs table:
-- Only job's organizer, confirmed workers for that shift, or admin can select raw jobs row
DROP POLICY IF EXISTS "Anyone can view open public jobs" ON public.jobs;
DROP POLICY IF EXISTS "Anyone authenticated can view open jobs" ON public.jobs;
DROP POLICY IF EXISTS "Organizers and confirmed crew view full jobs" ON public.jobs;

CREATE POLICY "Organizers and confirmed crew view full jobs"
  ON public.jobs FOR SELECT TO authenticated
  USING (
    organizer_id = auth.uid()
    OR is_current_admin()
    OR EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.job_id = jobs.id
        AND b.worker_id = auth.uid()
        AND b.status IN ('confirmed', 'checked_in', 'completed_awaiting_review', 'completed')
    )
  );

-- ------------------------------------------------------------------------------
-- 3. SHIELD SENSITIVE FIELDS (GSTIN, BILLING ADDRESS, PHONE) IN ORGANIZER PROFILES (Fix 4)
-- ------------------------------------------------------------------------------

-- Drop and recreate public organizer card view with security_barrier = true
DROP VIEW IF EXISTS public.public_organizer_cards CASCADE;

CREATE VIEW public.public_organizer_cards
WITH (security_barrier = true) AS
  SELECT
    id,
    business_name,
    business_type,
    profile_completion_status,
    verification_status,
    rating,
    total_events_hosted,
    created_at,
    updated_at
  FROM public.organizer_profiles;

GRANT SELECT ON public.public_organizer_cards TO anon, authenticated;

-- Restrict direct SELECT on organizer_profiles:
-- An organizer can only read their own profile; admins can read all profiles
DROP POLICY IF EXISTS "Public organizer card read access" ON public.organizer_profiles;
DROP POLICY IF EXISTS "Organizers view own business profile" ON public.organizer_profiles;

CREATE POLICY "Organizers view own business profile"
  ON public.organizer_profiles FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR is_current_admin()
  );

-- ==============================================================================
-- OPSKL SECURITY & MIGRATION ENGINE HARDENING
-- Migration: 20261017000000_safe_admin_role_escalation_guard.sql
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.prevent_role_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- 1. Authorize administrative maintenance scripts, migrations, superuser, and service_role
  IF current_user IN ('postgres', 'service_role', 'supabase_admin')
     OR (current_setting('request.jwt.claim.role', true) = 'service_role')
     OR is_current_admin() THEN
    RETURN NEW;
  END IF;

  -- 2. Restrict regular authenticated / anon callers from altering assigned role
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    RAISE EXCEPTION 'Unauthorized: Users cannot change their assigned role.';
  END IF;

  -- 3. Restrict regular users from altering account active status
  IF NEW.is_active IS DISTINCT FROM OLD.is_active THEN
    RAISE EXCEPTION 'Unauthorized: Account activation status cannot be modified directly by users.';
  END IF;

  -- 4. Restrict regular users from modifying immutable primary key
  IF NEW.id IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION 'Unauthorized: Profile ID cannot be modified.';
  END IF;

  RETURN NEW;
END;
$$;

GRANT EXECUTE ON FUNCTION public.prevent_role_escalation() TO postgres, service_role, authenticated, anon;

-- ==============================================================================
-- OPSKIL DATABASE MIGRATION: 20261017000001_shift_creation_and_rpc_hardening.sql
-- ==============================================================================

DROP FUNCTION IF EXISTS public.create_job_safe(JSONB, UUID);
DROP FUNCTION IF EXISTS public.create_job_safe(JSONB);

CREATE OR REPLACE FUNCTION public.create_job_safe(
  p_job JSONB,
  p_organizer_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_effective_org_id UUID := COALESCE(p_organizer_id, (p_job->>'organizer_id')::uuid, auth.uid());
  v_job_id UUID;
  v_title TEXT := trim(COALESCE(p_job->>'title', ''));
  v_raw_cat TEXT := lower(trim(COALESCE(p_job->>'category', 'conference')));
  v_category shift_category;
  v_venue_name TEXT := trim(COALESCE(p_job->>'venue_name', p_job->>'venueName', ''));
  v_venue_addr TEXT := trim(COALESCE(p_job->>'venue_address', p_job->>'venueAddress', ''));
  v_landmark TEXT := trim(COALESCE(p_job->>'landmark', ''));
  v_city TEXT := COALESCE(NULLIF(trim(p_job->>'city'), ''), 'Mumbai');
  v_zone TEXT := trim(COALESCE(p_job->>'zone', ''));
  v_lat NUMERIC := (p_job->>'latitude')::numeric;
  v_lng NUMERIC := (p_job->>'longitude')::numeric;
  v_date DATE := (p_job->>'date')::date;
  v_start_time TIME := (p_job->>'start_time')::time;
  v_end_time TIME := (p_job->>'end_time')::time;
  v_hourly_rate NUMERIC := COALESCE((p_job->>'hourly_rate')::numeric, (p_job->>'hourlyRate')::numeric, 0);
  v_slots_total INT := COALESCE((p_job->>'slots_total')::int, (p_job->>'slotsTotal')::int, 0);
  v_dress_code TEXT := trim(COALESCE(p_job->>'dress_code', p_job->>'dressCode', ''));
  v_duties TEXT[] := CASE 
    WHEN p_job->'duties' IS NOT NULL AND jsonb_typeof(p_job->'duties') = 'array' 
    THEN ARRAY(SELECT jsonb_array_elements_text(p_job->'duties'))
    ELSE ARRAY[]::TEXT[]
  END;
  v_required_skills TEXT[] := CASE 
    WHEN COALESCE(p_job->'required_skills', p_job->'requiredSkills') IS NOT NULL 
         AND jsonb_typeof(COALESCE(p_job->'required_skills', p_job->'requiredSkills')) = 'array'
    THEN ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_job->'required_skills', p_job->'requiredSkills')))
    ELSE ARRAY[]::TEXT[]
  END;
  v_perks TEXT[] := CASE 
    WHEN p_job->'perks' IS NOT NULL AND jsonb_typeof(p_job->'perks') = 'array' 
    THEN ARRAY(SELECT jsonb_array_elements_text(p_job->'perks'))
    ELSE ARRAY[]::TEXT[]
  END;
  v_eligibility TEXT := trim(COALESCE(p_job->>'eligibility_criteria', p_job->>'eligibilityCriteria', ''));
  v_breaks_mins INT := COALESCE((p_job->>'breaks_minutes')::int, (p_job->>'breaksMinutes')::int, 30);
  v_meal_provided BOOLEAN := COALESCE((p_job->>'meal_provided')::boolean, (p_job->>'mealProvided')::boolean, false);
  v_transport_provided BOOLEAN := COALESCE((p_job->>'transport_provided')::boolean, (p_job->>'transportProvided')::boolean, false);
  v_overtime_policy TEXT := trim(COALESCE(p_job->>'overtime_policy', p_job->>'overtimePolicy', ''));
  v_reporting_instructions TEXT := trim(COALESCE(p_job->>'reporting_instructions', p_job->>'reportingInstructions', ''));
  v_cancellation_policy TEXT := trim(COALESCE(p_job->>'cancellation_policy', p_job->>'cancellationPolicy', ''));
  v_supervisor_name TEXT := trim(COALESCE(p_job->>'supervisor_name', p_job->>'supervisorName', ''));
  v_supervisor_phone TEXT := trim(COALESCE(p_job->>'supervisor_phone', p_job->>'supervisorPhone', ''));
  v_raw_status TEXT := lower(trim(COALESCE(p_job->>'status', 'open')));
  v_status shift_status;
  v_app_deadline TIMESTAMPTZ;
  v_payment_deadline TIMESTAMPTZ;
  v_shift_start_timestamptz TIMESTAMPTZ;
  v_crosses_midnight BOOLEAN;
  v_end_date DATE;
  v_duration_hours NUMERIC;
  v_total_pay NUMERIC;
  v_org_verified TEXT;
  v_org_active BOOLEAN;
  v_min_wage NUMERIC := 100.0;
BEGIN
  -- Authentication check: must have an authenticated user (bypassed only for service_role / postgres superuser)
  IF auth.uid() IS NULL AND COALESCE(auth.role(), '') <> 'service_role' AND current_user <> 'postgres' THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'UNAUTHENTICATED', 'message', 'Please sign in to publish shifts.');
  END IF;

  IF v_effective_org_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'ORGANIZER_REQUIRED', 'message', 'Organizer identity is required.');
  END IF;

  -- Authorization: Caller must be the organizer, an authorized team member (owner/admin), or platform admin
  IF auth.uid() IS NOT NULL 
     AND auth.uid() <> v_effective_org_id 
     AND NOT is_current_admin()
     AND NOT EXISTS (
       SELECT 1 FROM organizer_memberships
       WHERE organizer_id = v_effective_org_id
         AND user_id = auth.uid()
         AND role IN ('owner', 'admin')
     ) THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'UNAUTHORIZED', 'message', 'You are not authorized to post shifts on behalf of this organizer.');
  END IF;

  -- Lifecycle status check: Only 'draft' and 'open' are permitted at creation
  IF v_raw_status NOT IN ('draft', 'open') THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'INVALID_INITIAL_STATUS', 'message', 'Initial shift status must be either "draft" or "open". Status "' || v_raw_status || '" is prohibited at creation.');
  END IF;
  v_status := v_raw_status::shift_status;

  -- Organizer verification and account status checks
  SELECT verification_status INTO v_org_verified
  FROM organizer_profiles WHERE id = v_effective_org_id;

  SELECT is_active INTO v_org_active
  FROM profiles WHERE id = v_effective_org_id;

  IF v_org_active IS FALSE THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'ORGANIZER_INACTIVE', 'message', 'This organizer account has been suspended or deactivated.');
  END IF;

  -- Require existing organizer profile for publishing non-draft shifts
  IF v_status <> 'draft' AND v_org_verified IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'ORGANIZER_NOT_FOUND', 'message', 'Organizer profile not found.');
  END IF;

  -- Require verified organizer for publishing non-draft shifts (admins bypass)
  IF v_status <> 'draft' AND v_org_verified <> 'verified' AND NOT is_current_admin() THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'ORGANIZER_NOT_VERIFIED', 'message', 'Organizer identity verification required to post shifts.');
  END IF;

  -- Safe category enum casting
  BEGIN
    v_category := v_raw_cat::shift_category;
  EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'INVALID_CATEGORY', 'message', 'Invalid shift category: ' || COALESCE(p_job->>'category', 'none'));
  END;

  -- Title length validation: 5 to 80 chars
  IF length(v_title) < 5 OR length(v_title) > 80 THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'INVALID_TITLE', 'message', 'Shift title must be between 5 and 80 characters.');
  END IF;

  -- Venue and on-site supervisor validation
  IF length(v_venue_name) < 2 OR length(v_venue_addr) < 5 THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'INVALID_VENUE', 'message', 'Venue name (min 2 chars) and complete address (min 5 chars) are required.');
  END IF;

  IF length(v_supervisor_name) < 2 OR length(v_supervisor_phone) < 8 THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'INVALID_SUPERVISOR', 'message', 'On-site supervisor name and a valid contact phone number are required.');
  END IF;

  -- Read min wage from settings with safe fallback if configuration row is missing
  v_min_wage := 100.0;
  SELECT COALESCE(
    CASE 
      WHEN jsonb_typeof(value) = 'object' THEN (value->>'min_hourly_wage_inr')::numeric
      WHEN jsonb_typeof(value) = 'number' THEN (value)::text::numeric
      ELSE NULL
    END,
    100.0
  ) INTO v_min_wage
  FROM platform_settings 
  WHERE key IN ('min_wage', 'min_hourly_wage_inr')
  ORDER BY CASE WHEN key = 'min_hourly_wage_inr' THEN 1 ELSE 2 END
  LIMIT 1;

  v_min_wage := GREATEST(COALESCE(v_min_wage, 100.0), 100.0);

  -- Rate limits: ₹100 to ₹2000/hr
  IF v_hourly_rate < v_min_wage OR v_hourly_rate > 2000 THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'INVALID_WAGE', 'message', 'Hourly rate must be between ₹' || v_min_wage || ' and ₹2,000/hr.');
  END IF;

  -- Slots limit: 1 to 50 workers
  IF v_slots_total < 1 OR v_slots_total > 50 THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'INVALID_SLOTS', 'message', 'Headcount must be between 1 and 50 workers.');
  END IF;

  -- Schedule validation
  IF v_date IS NULL OR v_start_time IS NULL OR v_end_time IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'INVALID_SCHEDULE', 'message', 'Shift date, start time, and end time are required.');
  END IF;

  -- Date check in IST
  IF v_date < (now() AT TIME ZONE 'Asia/Kolkata')::date THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'PAST_DATE', 'message', 'Shift date cannot be in the past.');
  END IF;

  -- Same-day start time check in IST
  v_shift_start_timestamptz := (v_date + v_start_time) AT TIME ZONE 'Asia/Kolkata';
  IF v_shift_start_timestamptz <= now() THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'PAST_START_TIME', 'message', 'Shift start time has already passed for the scheduled date.');
  END IF;

  -- Overnight and duration calculation
  IF v_end_time <= v_start_time THEN
    v_crosses_midnight := true;
    v_end_date := v_date + 1;
    v_duration_hours := round((EXTRACT(EPOCH FROM (v_end_time - v_start_time + interval '24 hours')) / 3600.0)::numeric, 2);
  ELSE
    v_crosses_midnight := false;
    v_end_date := v_date;
    v_duration_hours := round((EXTRACT(EPOCH FROM (v_end_time - v_start_time)) / 3600.0)::numeric, 2);
  END IF;

  -- Duration boundaries: 1.0 to 14.0 hours
  IF v_duration_hours < 1.0 OR v_duration_hours > 14.0 THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'INVALID_DURATION', 'message', 'Shift duration must be between 1 and 14 hours.');
  END IF;

  -- Break duration bounds: 0 to 120 mins and strictly less than total shift duration
  IF v_breaks_mins < 0 OR v_breaks_mins > 120 THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'INVALID_BREAK_DURATION', 'message', 'Break duration must be between 0 and 120 minutes.');
  END IF;

  IF (v_breaks_mins / 60.0) >= v_duration_hours THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'BREAK_EXCEEDS_DURATION', 'message', 'Break duration cannot equal or exceed total shift duration.');
  END IF;

  -- Deadlines parsing & validation
  IF p_job->>'application_deadline' IS NOT NULL AND trim(p_job->>'application_deadline') <> '' THEN
    BEGIN
      v_app_deadline := (p_job->>'application_deadline')::timestamptz;
    EXCEPTION WHEN OTHERS THEN
      RETURN jsonb_build_object('success', false, 'error_code', 'INVALID_APPLICATION_DEADLINE', 'message', 'Invalid application deadline format.');
    END;

    IF v_app_deadline <= now() THEN
      RETURN jsonb_build_object('success', false, 'error_code', 'INVALID_APPLICATION_DEADLINE', 'message', 'Application deadline must be in the future.');
    END IF;

    IF v_app_deadline > v_shift_start_timestamptz THEN
      RETURN jsonb_build_object('success', false, 'error_code', 'INVALID_APPLICATION_DEADLINE', 'message', 'Application deadline cannot be after the shift start time.');
    END IF;
  END IF;

  IF p_job->>'payment_deadline' IS NOT NULL AND trim(p_job->>'payment_deadline') <> '' THEN
    BEGIN
      v_payment_deadline := (p_job->>'payment_deadline')::timestamptz;
    EXCEPTION WHEN OTHERS THEN
      RETURN jsonb_build_object('success', false, 'error_code', 'INVALID_PAYMENT_DEADLINE', 'message', 'Invalid payment deadline format.');
    END;

    IF v_payment_deadline < now() THEN
      RETURN jsonb_build_object('success', false, 'error_code', 'INVALID_PAYMENT_DEADLINE', 'message', 'Payment deadline cannot be in the past.');
    END IF;
  END IF;

  -- Require BOTH coordinates to be present together or BOTH omitted
  IF (v_lat IS NULL AND v_lng IS NOT NULL) OR (v_lat IS NOT NULL AND v_lng IS NULL) THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'INCOMPLETE_COORDINATES', 'message', 'Both latitude and longitude must be provided together or omitted.');
  END IF;

  -- India geographic coordinate bounds check (Lat: 6–38°N, Lng: 68–98°E)
  IF v_lat IS NOT NULL AND v_lng IS NOT NULL THEN
    IF v_lat < 6.0 OR v_lat > 38.0 OR v_lng < 68.0 OR v_lng > 98.0 THEN
      RETURN jsonb_build_object('success', false, 'error_code', 'INVALID_COORDINATES', 'message', 'Coordinates must fall within the sovereign territory of India (6–38°N, 68–98°E).');
    END IF;
  END IF;

  -- Duplicate publication guard: detect rapid identical reposts (within 30 seconds)
  IF EXISTS (
    SELECT 1 FROM jobs
    WHERE organizer_id = v_effective_org_id
      AND title = v_title
      AND date = v_date
      AND start_time = v_start_time
      AND venue_name = v_venue_name
      AND status <> 'cancelled'
      AND created_at >= (now() - interval '30 seconds')
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'DUPLICATE_PUBLICATION',
      'message', 'A shift with the same title, venue, and timing was just published. Please wait before reposting.'
    );
  END IF;

  -- Authoritative payable-hours rule:
  -- In Indian event and exhibition commercial staffing, shifts are scheduled as full on-site engagement blocks.
  -- Scheduled rest breaks (up to 120 minutes) are paid rest periods included in the on-site engagement duration.
  -- Total pay is calculated directly from scheduled engagement duration: hourly_rate * duration_hours.
  v_total_pay := round(v_hourly_rate * v_duration_hours, 2);

  -- Insert shift with all supported fields persisted
  INSERT INTO jobs (
    organizer_id, title, category, venue_name, venue_address,
    landmark, city, zone, latitude, longitude,
    date, start_time, end_time, duration_hours,
    hourly_rate, total_pay, slots_total, slots_filled,
    dress_code, duties, perks, required_skills, eligibility_criteria,
    breaks_minutes, meal_provided, transport_provided, overtime_policy,
    reporting_instructions, cancellation_policy,
    application_deadline, payment_deadline,
    supervisor_name, supervisor_phone, status, crosses_midnight, end_date
  ) VALUES (
    v_effective_org_id, v_title, v_category, v_venue_name, v_venue_addr,
    v_landmark, v_city, v_zone, v_lat, v_lng,
    v_date, v_start_time, v_end_time, v_duration_hours,
    v_hourly_rate, v_total_pay, v_slots_total, 0,
    v_dress_code, v_duties, v_perks, v_required_skills, v_eligibility,
    v_breaks_mins, v_meal_provided, v_transport_provided, v_overtime_policy,
    v_reporting_instructions, v_cancellation_policy,
    v_app_deadline, v_payment_deadline,
    v_supervisor_name, v_supervisor_phone, v_status, v_crosses_midnight, v_end_date
  ) RETURNING id INTO v_job_id;

  -- Immutable audit log entry
  INSERT INTO audit_logs (
    actor_id, action, entity_type, entity_id, new_state
  ) VALUES (
    COALESCE(auth.uid(), v_effective_org_id),
    'CREATE_JOB',
    'jobs',
    v_job_id::TEXT,
    jsonb_build_object(
      'title', v_title,
      'status', v_status,
      'slots_total', v_slots_total,
      'hourly_rate', v_hourly_rate,
      'total_pay', v_total_pay,
      'duration_hours', v_duration_hours
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'job_id', v_job_id,
    'title', v_title,
    'total_pay', v_total_pay,
    'duration_hours', v_duration_hours,
    'crosses_midnight', v_crosses_midnight,
    'application_deadline', v_app_deadline,
    'payment_deadline', v_payment_deadline
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_job_safe(JSONB, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_job_safe(JSONB, UUID) TO authenticated;

-- ------------------------------------------------------------------------------
-- 2. HARDEN confirm_worker_booking_safe FOR ORGANIZER TEAM MEMBERS
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.confirm_worker_booking_safe(
  p_job_id UUID,
  p_worker_id UUID,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_organizer_id UUID := auth.uid();
  v_job RECORD;
  v_app RECORD;
  v_new_booking RECORD;
  v_check_in_code TEXT;
  v_allow_direct BOOLEAN := false;
  v_job_start TIMESTAMPTZ;
  v_job_end TIMESTAMPTZ;
BEGIN
  IF v_organizer_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'UNAUTHENTICATED');
  END IF;

  SELECT id, organizer_id, title, date, start_time, end_time, status, slots_total, slots_filled, hourly_rate, total_pay
  INTO v_job
  FROM jobs
  WHERE id = p_job_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'JOB_NOT_FOUND', 'message', 'Shift listing not found');
  END IF;

  -- Permissions check: must be shift organizer, authorized team member (owner/admin), or platform admin
  IF v_job.organizer_id <> v_organizer_id 
     AND NOT is_current_admin() 
     AND NOT EXISTS (
       SELECT 1 FROM organizer_memberships
       WHERE organizer_id = v_job.organizer_id
         AND user_id = v_organizer_id
         AND role IN ('owner', 'admin')
     ) THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'UNAUTHORIZED', 'message', 'Not authorized to hire for this shift');
  END IF;

  -- Platform Killswitch Check
  IF EXISTS (
    SELECT 1 FROM platform_settings
    WHERE key = 'booking_killswitch' AND (value->>'is_paused')::BOOLEAN = true
  ) THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'BOOKINGS_PAUSED', 'message', 'Shift bookings are temporarily paused platform-wide.');
  END IF;

  -- Require organizer verified (or admin)
  IF NOT EXISTS (
    SELECT 1 FROM organizer_profiles
    WHERE id = v_job.organizer_id AND (verification_status = 'verified' OR is_current_admin())
  ) THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'UNVERIFIED_ORGANIZER', 'message', 'Organizer identity verification required before hiring.');
  END IF;

  -- Require shift status in open/filling and date >= today IST
  IF v_job.status NOT IN ('open', 'filling') THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'JOB_NOT_OPEN', 'message', 'Shift is not open for hiring.');
  END IF;

  IF v_job.date < (now() AT TIME ZONE 'Asia/Kolkata')::date THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'PAST_DATE', 'message', 'Cannot hire workers for past shifts.');
  END IF;

  -- Capacity check
  IF v_job.slots_filled >= v_job.slots_total THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'SLOTS_FULL', 'message', 'All openings for this shift have already been filled.');
  END IF;

  -- Application requirement check
  SELECT COALESCE((value->>'allow_direct_invites')::boolean, false) INTO v_allow_direct
  FROM platform_settings WHERE key = 'allow_direct_invites';

  SELECT id, status INTO v_app
  FROM job_applications
  WHERE job_id = p_job_id AND worker_id = p_worker_id;

  IF NOT FOUND THEN
    IF NOT v_allow_direct THEN
      RETURN jsonb_build_object('success', false, 'error_code', 'APPLICATION_REQUIRED', 'message', 'Worker must apply to shift before being confirmed.');
    END IF;
  ELSE
    IF v_app.status NOT IN ('applied', 'shortlisted') THEN
      RETURN jsonb_build_object('success', false, 'error_code', 'INVALID_APPLICATION_STATUS', 'message', 'Application must be applied or shortlisted.');
    END IF;
  END IF;

  -- Check for double-booking / overlapping confirmed/checked_in shifts on the same date
  v_job_start := (v_job.date + v_job.start_time) AT TIME ZONE 'Asia/Kolkata';
  v_job_end := (v_job.date + v_job.end_time + CASE WHEN v_job.end_time <= v_job.start_time THEN interval '1 day' ELSE interval '0' END) AT TIME ZONE 'Asia/Kolkata';

  IF EXISTS (
    SELECT 1 FROM bookings b
    JOIN jobs j ON j.id = b.job_id
    WHERE b.worker_id = p_worker_id
      AND b.status IN ('confirmed', 'checked_in')
      AND (
        ( (j.date + j.start_time) AT TIME ZONE 'Asia/Kolkata' ) < v_job_end
        AND
        ( (j.date + j.end_time + CASE WHEN j.end_time <= j.start_time THEN interval '1 day' ELSE interval '0' END) AT TIME ZONE 'Asia/Kolkata' ) > v_job_start
      )
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'OVERLAPPING_SHIFT_SCHEDULE',
      'message', 'Worker is already confirmed for an overlapping shift during these hours.'
    );
  END IF;

  -- CSPRNG check-in code
  v_check_in_code := 'OP-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));

  -- Create or update booking record
  INSERT INTO bookings (
    job_id, worker_id, organizer_id, status,
    agreed_hourly_rate, agreed_total_pay, approved_total_pay, check_in_code
  ) VALUES (
    p_job_id, p_worker_id, v_job.organizer_id, 'confirmed',
    v_job.hourly_rate, v_job.total_pay, v_job.total_pay, v_check_in_code
  )
  ON CONFLICT (job_id, worker_id) DO UPDATE SET
    status = 'confirmed',
    agreed_hourly_rate = EXCLUDED.agreed_hourly_rate,
    agreed_total_pay = EXCLUDED.agreed_total_pay,
    approved_total_pay = EXCLUDED.approved_total_pay,
    check_in_code = EXCLUDED.check_in_code
  RETURNING * INTO v_new_booking;

  -- Update application status
  IF v_app.id IS NOT NULL THEN
    UPDATE job_applications
    SET status = 'confirmed', updated_at = now()
    WHERE id = v_app.id;
  END IF;

  -- Increment filled slots atomically
  UPDATE jobs
  SET
    slots_filled = slots_filled + 1,
    status = CASE WHEN slots_filled + 1 >= slots_total THEN 'filled'::shift_status ELSE 'filling'::shift_status END,
    updated_at = now()
  WHERE id = p_job_id;

  -- Automatically generate idempotent job invoice for escrow funding on first confirmed booking
  PERFORM generate_job_invoice_safe(p_job_id);

  -- Send worker notification
  PERFORM _notify(
    p_worker_id,
    'Shift Booking Confirmed!',
    'You have been confirmed for ' || v_job.title || '. Check details and venue instructions.',
    'booking_confirmed',
    '/shift/' || p_job_id,
    jsonb_build_object('job_id', p_job_id, 'booking_id', v_new_booking.id)
  );

  INSERT INTO audit_logs (
    actor_id, action, entity_type, entity_id, new_state
  ) VALUES (
    v_organizer_id, 'CONFIRM_WORKER_BOOKING', 'booking', v_new_booking.id::TEXT,
    jsonb_build_object('job_id', p_job_id, 'worker_id', p_worker_id, 'agreed_pay', v_job.total_pay)
  );

  RETURN jsonb_build_object(
    'success', true,
    'booking_id', v_new_booking.id,
    'status', 'confirmed',
    'check_in_code', v_check_in_code
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.confirm_worker_booking_safe(UUID, UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.confirm_worker_booking_safe(UUID, UUID, TEXT) TO authenticated;

-- ------------------------------------------------------------------------------
-- 3. ALIGN ADMIN MODERATION FUNCTIONS TO is_current_admin()
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.admin_moderate_job_safe(
  p_job_id UUID,
  p_new_status shift_status,
  p_moderation_reason TEXT,
  p_admin_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_job RECORD;
  v_admin_id UUID := auth.uid();
BEGIN
  IF v_admin_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Authentication required.');
  END IF;

  IF p_admin_id IS NOT NULL AND p_admin_id <> v_admin_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized. Caller cannot specify a different administrator identity.');
  END IF;

  IF NOT is_current_admin() THEN
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

REVOKE EXECUTE ON FUNCTION public.admin_moderate_job_safe(UUID, shift_status, TEXT, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_moderate_job_safe(UUID, shift_status, TEXT, UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_resolve_safety_report_safe(
  p_report_id UUID,
  p_status TEXT,
  p_action_taken TEXT,
  p_staff_notes TEXT,
  p_admin_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_report RECORD;
  v_admin_id UUID := auth.uid();
BEGIN
  IF v_admin_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Authentication required.');
  END IF;

  IF p_admin_id IS NOT NULL AND p_admin_id <> v_admin_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized. Caller cannot specify a different administrator identity.');
  END IF;

  IF NOT is_current_admin() THEN
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

REVOKE EXECUTE ON FUNCTION public.admin_resolve_safety_report_safe(UUID, TEXT, TEXT, TEXT, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_resolve_safety_report_safe(UUID, TEXT, TEXT, TEXT, UUID) TO authenticated;

-- ------------------------------------------------------------------------------
-- 4. REVOKE UNPRIVILEGED ROLE SWITCHING FROM anon
-- ------------------------------------------------------------------------------

REVOKE EXECUTE ON FUNCTION public.switch_user_role_safe(user_role, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.switch_user_role_safe(user_role, TEXT, TEXT) TO authenticated;

-- ##############################################################################
-- START MIGRATION: 20261018000000_phase3_auth_kyc_verification_hardening.sql
-- #################################=============================================

-- ==============================================================================
-- OPSKL MIGRATION: 20261018000000_phase3_auth_kyc_verification_hardening.sql
-- PHASE 3: AUTHENTICATION, AUTHORIZATION, WORKER KYC & ORGANIZER VERIFICATION
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. HARDEN SUBMIT_VERIFICATION_CASE_SAFE WITH PRIVACY MASKING & STORAGE SCOPING
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.submit_verification_case_safe(
  p_document_type TEXT,
  p_masked_id TEXT,
  p_storage_path TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_case_id UUID;
  v_user_str TEXT;
  v_sanitized_masked_id TEXT;
  v_raw_id TEXT;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'UNAUTHENTICATED', 'error', 'Authentication required.');
  END IF;

  v_user_str := v_user_id::TEXT;

  IF p_document_type NOT IN ('aadhaar', 'pan', 'gstin') THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'INVALID_DOCUMENT_TYPE', 'error', 'Document type must be aadhaar, pan, or gstin.');
  END IF;

  IF p_storage_path IS NULL OR trim(p_storage_path) = '' THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'MISSING_STORAGE_PATH', 'error', 'Storage path to verification document is required.');
  END IF;

  -- Storage path security: must be strictly scoped to caller's authenticated user directory
  IF NOT (
    p_storage_path LIKE (v_user_str || '/%')
    OR p_storage_path LIKE ('kyc/' || v_user_str || '/%')
    OR p_storage_path LIKE ('verification/' || v_user_str || '/%')
    OR p_storage_path LIKE ('verification/%/' || v_user_str || '.%')
  ) THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'UNAUTHORIZED_STORAGE_PATH', 'error', 'Storage path must be scoped to your authenticated user directory.');
  END IF;

  -- Enforce server-side privacy masking: raw document numbers must never be stored unmasked
  v_raw_id := trim(COALESCE(p_masked_id, ''));
  IF v_raw_id = '' THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'INVALID_DOCUMENT_ID', 'error', 'Document number or identifier is required.');
  END IF;

  IF p_document_type = 'aadhaar' THEN
    -- If 12-digit raw Aadhaar is provided, mask first 8 digits (UIDAI compliance)
    IF v_raw_id ~ '^[0-9]{12}$' THEN
      v_sanitized_masked_id := 'XXXX-XXXX-' || right(v_raw_id, 4);
    ELSIF v_raw_id ~ '^[X*]{4}-[X*]{4}-[0-9]{4}$' OR v_raw_id ~ '^[X*]{8}[0-9]{4}$' THEN
      v_sanitized_masked_id := v_raw_id;
    ELSE
      -- Extract last 4 digits and mask prefix
      DECLARE
        v_digits TEXT := regexp_replace(v_raw_id, '[^0-9]', '', 'g');
      BEGIN
        IF length(v_digits) < 4 THEN
          RETURN jsonb_build_object('success', false, 'error_code', 'INVALID_DOCUMENT_ID', 'error', 'Aadhaar must include at least the last 4 digits.');
        END IF;
        v_sanitized_masked_id := 'XXXX-XXXX-' || right(v_digits, 4);
      END;
    END IF;
  ELSIF p_document_type = 'pan' THEN
    -- PAN format: 5 letters, 4 digits, 1 letter. Mask the 4 digits: ABCDE****F
    IF length(v_raw_id) = 10 AND upper(v_raw_id) ~ '^[A-Z]{5}[0-9]{4}[A-Z]{1}$' THEN
      v_sanitized_masked_id := upper(left(v_raw_id, 5)) || '****' || upper(right(v_raw_id, 1));
    ELSIF upper(v_raw_id) ~ '^[A-Z]{5}[*X]{4}[A-Z]{1}$' THEN
      v_sanitized_masked_id := upper(v_raw_id);
    ELSE
      IF length(v_raw_id) < 5 THEN
        RETURN jsonb_build_object('success', false, 'error_code', 'INVALID_DOCUMENT_ID', 'error', 'Invalid PAN document number.');
      END IF;
      v_sanitized_masked_id := upper(left(v_raw_id, 2)) || '******' || upper(right(v_raw_id, 2));
    END IF;
  ELSIF p_document_type = 'gstin' THEN
    -- GSTIN format: 2-digit state code + 10-char PAN + 3 entity chars (15 total)
    IF length(v_raw_id) = 15 THEN
      v_sanitized_masked_id := left(v_raw_id, 2) || '*****' || right(v_raw_id, 4);
    ELSE
      v_sanitized_masked_id := v_raw_id;
    END IF;
  END IF;

  -- Resubmission rule: Reject only if an active case is already pending review
  IF EXISTS (
    SELECT 1 FROM verification_cases
    WHERE profile_id = v_user_id AND document_type = p_document_type AND status = 'pending'
  ) THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'CASE_ALREADY_PENDING', 'error', 'A verification case is already pending review for this document type.');
  END IF;

  INSERT INTO verification_cases (
    profile_id, document_type, document_masked_id, document_storage_path, status
  ) VALUES (
    v_user_id, p_document_type, v_sanitized_masked_id, p_storage_path, 'pending'
  ) RETURNING id INTO v_case_id;

  -- Update profile status to pending under trusted bypass
  PERFORM set_config('opskl.trusted', '1', true);
  UPDATE worker_profiles SET verification_status = 'pending', updated_at = now() WHERE id = v_user_id;
  UPDATE organizer_profiles SET verification_status = 'pending', updated_at = now() WHERE id = v_user_id;

  RETURN jsonb_build_object('success', true, 'case_id', v_case_id, 'status', 'pending');
END;
$$;

REVOKE EXECUTE ON FUNCTION public.submit_verification_case_safe(TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_verification_case_safe(TEXT, TEXT, TEXT) TO authenticated;

-- ------------------------------------------------------------------------------
-- 2. HARDEN ADMIN_VERIFY_CASE_SAFE WITH MANDATORY REASON, REVOCATION & EXPIRY
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.admin_verify_case_safe(
  p_case_id UUID,
  p_status TEXT,
  p_rejection_reason TEXT DEFAULT NULL,
  p_admin_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_case RECORD;
  v_admin_id UUID := auth.uid();
  v_w_profile RECORD;
  v_o_profile RECORD;
BEGIN
  IF NOT is_current_admin() THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'UNAUTHORIZED', 'error', 'Administrative authorization required.');
  END IF;

  IF p_status NOT IN ('approved', 'rejected', 'revoked', 'expired') THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'INVALID_STATUS', 'error', 'Status must be approved, rejected, revoked, or expired.');
  END IF;

  -- Rejection requires an explanatory reason
  IF p_status = 'rejected' AND (p_rejection_reason IS NULL OR length(trim(p_rejection_reason)) < 5) THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'REASON_REQUIRED', 'error', 'A specific rejection reason (at least 5 characters) is required.');
  END IF;

  SELECT * INTO v_case FROM verification_cases WHERE id = p_case_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'CASE_NOT_FOUND', 'error', 'Verification case not found.');
  END IF;

  -- For approval or initial rejection, case must be pending
  -- For revocation or expiry, case can be previously approved
  IF p_status IN ('approved', 'rejected') AND v_case.status <> 'pending' THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'INVALID_TRANSITION', 'error', 'Only pending verification cases can be approved or rejected.');
  END IF;

  IF p_status IN ('revoked', 'expired') AND v_case.status <> 'approved' THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'INVALID_TRANSITION', 'error', 'Only approved verification cases can be revoked or expired.');
  END IF;

  UPDATE verification_cases
  SET
    status = p_status,
    rejection_reason = CASE WHEN p_status IN ('rejected', 'revoked', 'expired') THEN p_rejection_reason ELSE NULL END,
    reviewed_by = COALESCE(v_admin_id, p_admin_id),
    reviewed_at = now()
  WHERE id = p_case_id;

  PERFORM set_config('opskl.trusted', '1', true);

  IF p_status = 'approved' THEN
    -- Check and update worker profile
    SELECT * INTO v_w_profile FROM worker_profiles WHERE id = v_case.profile_id;
    IF FOUND THEN
      UPDATE worker_profiles
      SET
        is_aadhaar_verified = CASE WHEN v_case.document_type = 'aadhaar' THEN true ELSE is_aadhaar_verified END,
        is_pan_verified = CASE WHEN v_case.document_type = 'pan' THEN true ELSE is_pan_verified END,
        verification_status = 'verified',
        updated_at = now()
      WHERE id = v_case.profile_id;
    END IF;

    -- Check and update organizer profile
    SELECT * INTO v_o_profile FROM organizer_profiles WHERE id = v_case.profile_id;
    IF FOUND THEN
      UPDATE organizer_profiles
      SET
        is_gstin_verified = CASE WHEN v_case.document_type = 'gstin' THEN true ELSE is_gstin_verified END,
        verification_status = 'verified',
        updated_at = now()
      WHERE id = v_case.profile_id;
    END IF;

    PERFORM _notify(v_case.profile_id, 'Verification Approved', 'Your document verification has been successfully approved.', 'verification_update');

  ELSIF p_status = 'rejected' THEN
    UPDATE worker_profiles SET verification_status = 'rejected', updated_at = now() WHERE id = v_case.profile_id;
    UPDATE organizer_profiles SET verification_status = 'rejected', updated_at = now() WHERE id = v_case.profile_id;

    PERFORM _notify(v_case.profile_id, 'Verification Update', 'Document verification was rejected: ' || p_rejection_reason, 'verification_update');

  ELSIF p_status IN ('revoked', 'expired') THEN
    UPDATE worker_profiles
    SET
      verification_status = 'rejected',
      is_aadhaar_verified = false,
      is_pan_verified = false,
      updated_at = now()
    WHERE id = v_case.profile_id;

    UPDATE organizer_profiles
    SET
      verification_status = 'rejected',
      is_gstin_verified = false,
      updated_at = now()
    WHERE id = v_case.profile_id;

    PERFORM _notify(
      v_case.profile_id,
      'Verification ' || initcap(p_status),
      'Your verified status has been ' || p_status || ': ' || COALESCE(p_rejection_reason, 'Administrative review update'),
      'verification_update'
    );
  END IF;

  INSERT INTO audit_logs (
    actor_id, action, entity_type, entity_id, new_state
  ) VALUES (
    COALESCE(v_admin_id, p_admin_id),
    'ADMIN_VERIFY_CASE',
    'verification_cases',
    p_case_id::TEXT,
    jsonb_build_object(
      'status', p_status,
      'document_type', v_case.document_type,
      'rejection_reason', p_rejection_reason,
      'profile_id', v_case.profile_id
    )
  );

  RETURN jsonb_build_object('success', true, 'case_id', p_case_id, 'status', p_status);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_verify_case_safe(UUID, TEXT, TEXT, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_verify_case_safe(UUID, TEXT, TEXT, UUID) TO authenticated;

-- ------------------------------------------------------------------------------
-- 3. SERVER-ENFORCED ACCOUNT SUSPENSION & ACTIVATION (ADMIN_SET_USER_STATUS_SAFE)
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.admin_set_user_status_safe(
  p_user_id UUID,
  p_is_active BOOLEAN,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_admin_id UUID := auth.uid();
  v_prev_active BOOLEAN;
BEGIN
  IF NOT is_current_admin() THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'UNAUTHORIZED', 'error', 'Administrative authorization required.');
  END IF;

  IF p_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'MISSING_USER_ID', 'error', 'Target user ID is required.');
  END IF;

  SELECT is_active INTO v_prev_active FROM profiles WHERE id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'USER_NOT_FOUND', 'error', 'User profile not found.');
  END IF;

  UPDATE profiles
  SET is_active = p_is_active, updated_at = now()
  WHERE id = p_user_id;

  INSERT INTO audit_logs (
    actor_id, action, entity_type, entity_id, new_state
  ) VALUES (
    v_admin_id,
    CASE WHEN p_is_active THEN 'ADMIN_ACTIVATE_USER' ELSE 'ADMIN_SUSPEND_USER' END,
    'profiles',
    p_user_id::TEXT,
    jsonb_build_object(
      'previous_is_active', v_prev_active,
      'new_is_active', p_is_active,
      'reason', p_reason
    )
  );

  RETURN jsonb_build_object('success', true, 'user_id', p_user_id, 'is_active', p_is_active);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_set_user_status_safe(UUID, BOOLEAN, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_user_status_safe(UUID, BOOLEAN, TEXT) TO authenticated;

-- ------------------------------------------------------------------------------
-- 4. HARDEN CHECK_IN_WORKER_SAFE: ENFORCE VERIFIED WORKER IDENTITY
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.check_in_worker_safe(
  p_booking_id UUID,
  p_code TEXT,
  p_lat NUMERIC DEFAULT NULL,
  p_lng NUMERIC DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_booking RECORD;
  v_job RECORD;
  v_distance NUMERIC := NULL;
  v_is_supervisor BOOLEAN := false;
  v_now TIMESTAMPTZ := now();
  v_shift_start_ist TIMESTAMPTZ;
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

  -- 4. Authorization check
  IF v_user_id <> v_booking.worker_id 
     AND v_user_id <> v_booking.organizer_id 
     AND NOT is_current_admin() 
     AND NOT EXISTS (
       SELECT 1 FROM organizer_memberships
       WHERE organizer_id = v_booking.organizer_id
         AND user_id = v_user_id
         AND role IN ('owner', 'admin', 'manager')
     ) THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'UNAUTHORIZED', 'message', 'Not authorized for this booking');
  END IF;

  v_is_supervisor := (
    v_user_id = v_booking.organizer_id 
    OR is_current_admin()
    OR EXISTS (
      SELECT 1 FROM organizer_memberships
      WHERE organizer_id = v_booking.organizer_id
        AND user_id = v_user_id
        AND role IN ('owner', 'admin', 'manager')
    )
  );

  -- 5. Server-side verification requirement: worker identity must be active & verified
  IF NOT v_is_supervisor THEN
    IF NOT EXISTS (
      SELECT 1 FROM worker_profiles wp
      JOIN profiles p ON p.id = wp.id
      WHERE wp.id = v_booking.worker_id
        AND (wp.verification_status = 'verified' OR is_current_admin())
        AND p.is_active = true
    ) THEN
      RETURN jsonb_build_object(
        'success', false,
        'error_code', 'WORKER_NOT_VERIFIED',
        'message', 'Worker identity verification must be active and approved to check in.'
      );
    END IF;
  END IF;

  -- 6. Require a valid check-in code
  IF p_code IS NULL OR length(trim(p_code)) < 4 OR length(trim(p_code)) > 32 THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'INVALID_CODE', 'message', 'A valid shift check-in code or pass credential is required.');
  END IF;

  -- For worker self-check-in, require provisioned credential and exact match
  IF NOT v_is_supervisor THEN
    IF v_booking.check_in_code IS NULL THEN
      RETURN jsonb_build_object(
        'success', false,
        'error_code', 'CHECK_IN_CREDENTIAL_NOT_PROVISIONED',
        'message', 'Shift credential has not been generated for this booking.'
      );
    END IF;

    IF upper(trim(p_code)) <> upper(trim(v_booking.check_in_code)) THEN
      RETURN jsonb_build_object(
        'success', false,
        'error_code', 'INVALID_CHECK_IN_CODE',
        'message', 'The check-in code entered does not match this booking.'
      );
    END IF;
  END IF;

  -- 7. Shift Timing & IST Check-In Window (Allowed from 2 hours before scheduled shift start)
  v_shift_start_ist := (v_job.date + v_job.start_time) AT TIME ZONE 'Asia/Kolkata';
  IF v_now < (v_shift_start_ist - interval '2 hours') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'CHECK_IN_TOO_EARLY',
      'message', 'Check-in opens 2 hours before scheduled shift start time.'
    );
  END IF;

  -- 8. Geolocation verification (if venue coordinates and worker GPS are present)
  IF p_lat IS NOT NULL AND p_lng IS NOT NULL AND v_job.latitude IS NOT NULL AND v_job.longitude IS NOT NULL THEN
    v_distance := round((
      6371 * acos(
        least(1.0, greatest(-1.0,
          cos(radians(v_job.latitude)) * cos(radians(p_lat)) *
          cos(radians(p_lng) - radians(v_job.longitude)) +
          sin(radians(v_job.latitude)) * sin(radians(p_lat))
        ))
      )
    )::NUMERIC, 2);
  END IF;

  -- 9. Execute check-in mutation
  UPDATE bookings
  SET
    status = 'checked_in',
    check_in_time = v_now,
    updated_at = v_now
  WHERE id = p_booking_id;

  INSERT INTO attendance_records (
    booking_id, check_in_time, check_in_code, verified_by_supervisor,
    worker_latitude, worker_longitude, distance_to_venue_km, status
  ) VALUES (
    p_booking_id, v_now, upper(trim(p_code)), v_is_supervisor,
    p_lat, p_lng, v_distance, 'checked_in'
  );

  INSERT INTO audit_logs (
    actor_id, action, entity_type, entity_id, new_state
  ) VALUES (
    v_user_id, 'CHECK_IN_WORKER', 'booking', p_booking_id::TEXT,
    jsonb_build_object(
      'status', 'checked_in',
      'check_in_time', v_now,
      'is_supervisor', v_is_supervisor,
      'distance_km', v_distance
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'booking_id', p_booking_id,
    'status', 'checked_in',
    'check_in_time', v_now,
    'distance_km', v_distance
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.check_in_worker_safe(UUID, TEXT, NUMERIC, NUMERIC) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.check_in_worker_safe(UUID, TEXT, NUMERIC, NUMERIC) TO authenticated;

-- ------------------------------------------------------------------------------
-- 5. HARDEN CONFIRM_WORKER_BOOKING_SAFE: ENFORCE VERIFIED WORKER IDENTITY
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.confirm_worker_booking_safe(
  p_job_id UUID,
  p_worker_id UUID,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_organizer_id UUID := auth.uid();
  v_job RECORD;
  v_app RECORD;
  v_new_booking RECORD;
  v_check_in_code TEXT;
  v_allow_direct BOOLEAN := false;
  v_job_start TIMESTAMPTZ;
  v_job_end TIMESTAMPTZ;
BEGIN
  IF v_organizer_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'UNAUTHENTICATED');
  END IF;

  SELECT id, organizer_id, title, date, start_time, end_time, status, slots_total, slots_filled, hourly_rate, total_pay
  INTO v_job
  FROM jobs
  WHERE id = p_job_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'JOB_NOT_FOUND', 'message', 'Shift listing not found');
  END IF;

  -- Permissions check: must be shift organizer, authorized team member (owner/admin), or platform admin
  IF v_job.organizer_id <> v_organizer_id 
     AND NOT is_current_admin() 
     AND NOT EXISTS (
       SELECT 1 FROM organizer_memberships
       WHERE organizer_id = v_job.organizer_id
         AND user_id = v_organizer_id
         AND role IN ('owner', 'admin')
     ) THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'UNAUTHORIZED', 'message', 'Not authorized to hire for this shift');
  END IF;

  -- Platform Killswitch Check
  IF EXISTS (
    SELECT 1 FROM platform_settings
    WHERE key = 'booking_killswitch' AND (value->>'is_paused')::BOOLEAN = true
  ) THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'BOOKINGS_PAUSED', 'message', 'Shift bookings are temporarily paused platform-wide.');
  END IF;

  -- Require organizer verified (or admin)
  IF NOT EXISTS (
    SELECT 1 FROM organizer_profiles
    WHERE id = v_job.organizer_id AND (verification_status = 'verified' OR is_current_admin())
  ) THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'UNVERIFIED_ORGANIZER', 'message', 'Organizer identity verification required before hiring.');
  END IF;

  -- Require worker active & verified (or admin)
  IF NOT EXISTS (
    SELECT 1 FROM worker_profiles wp
    JOIN profiles p ON p.id = wp.id
    WHERE wp.id = p_worker_id
      AND (wp.verification_status = 'verified' OR is_current_admin())
      AND p.is_active = true
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'UNVERIFIED_WORKER',
      'message', 'Worker identity verification must be approved before booking can be confirmed.'
    );
  END IF;

  -- Require shift status in open/filling and date >= today IST
  IF v_job.status NOT IN ('open', 'filling') THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'JOB_NOT_OPEN', 'message', 'Shift is not open for hiring.');
  END IF;

  IF v_job.date < (now() AT TIME ZONE 'Asia/Kolkata')::date THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'PAST_DATE', 'message', 'Cannot hire workers for past shifts.');
  END IF;

  -- Capacity check
  IF v_job.slots_filled >= v_job.slots_total THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'SLOTS_FULL', 'message', 'All openings for this shift have already been filled.');
  END IF;

  -- Application requirement check
  SELECT COALESCE((value->>'allow_direct_invites')::boolean, false) INTO v_allow_direct
  FROM platform_settings WHERE key = 'allow_direct_invites';

  SELECT id, status INTO v_app
  FROM job_applications
  WHERE job_id = p_job_id AND worker_id = p_worker_id;

  IF NOT FOUND THEN
    IF NOT v_allow_direct THEN
      RETURN jsonb_build_object('success', false, 'error_code', 'APPLICATION_REQUIRED', 'message', 'Worker must apply to shift before being confirmed.');
    END IF;
  ELSE
    IF v_app.status NOT IN ('applied', 'shortlisted') THEN
      RETURN jsonb_build_object('success', false, 'error_code', 'INVALID_APPLICATION_STATUS', 'message', 'Application must be applied or shortlisted.');
    END IF;
  END IF;

  -- Check for double-booking / overlapping confirmed/checked_in shifts on the same date
  v_job_start := (v_job.date + v_job.start_time) AT TIME ZONE 'Asia/Kolkata';
  v_job_end := (v_job.date + v_job.end_time + CASE WHEN v_job.end_time <= v_job.start_time THEN interval '1 day' ELSE interval '0' END) AT TIME ZONE 'Asia/Kolkata';

  IF EXISTS (
    SELECT 1 FROM bookings b
    JOIN jobs other_j ON other_j.id = b.job_id
    WHERE b.worker_id = p_worker_id
      AND b.status IN ('confirmed', 'checked_in')
      AND other_j.id <> p_job_id
      AND (
        ((other_j.date + other_j.start_time) AT TIME ZONE 'Asia/Kolkata') < v_job_end
        AND
        ((other_j.date + other_j.end_time + CASE WHEN other_j.end_time <= other_j.start_time THEN interval '1 day' ELSE interval '0' END) AT TIME ZONE 'Asia/Kolkata') > v_job_start
      )
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'OVERLAPPING_SHIFT_SCHEDULE',
      'message', 'Worker is already confirmed for another overlapping shift on this schedule.'
    );
  END IF;

  -- Generate cryptographically robust booking code (OP-XXXXXXXXXX)
  v_check_in_code := 'OP-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));

  -- Insert booking record
  INSERT INTO bookings (
    job_id, worker_id, organizer_id, status,
    agreed_rate, total_payout, check_in_code, notes
  ) VALUES (
    p_job_id, p_worker_id, v_job.organizer_id, 'confirmed',
    v_job.hourly_rate, v_job.total_pay, v_check_in_code, p_notes
  )
  RETURNING * INTO v_new_booking;

  -- Update application status
  IF v_app.id IS NOT NULL THEN
    UPDATE job_applications
    SET status = 'hired', updated_at = now()
    WHERE id = v_app.id;
  END IF;

  -- Increment filled slots count and update job status
  UPDATE jobs
  SET
    slots_filled = slots_filled + 1,
    status = CASE WHEN slots_filled + 1 >= slots_total THEN 'filled'::job_status ELSE 'filling'::job_status END,
    updated_at = now()
  WHERE id = p_job_id;

  INSERT INTO audit_logs (
    actor_id, action, entity_type, entity_id, new_state
  ) VALUES (
    v_organizer_id, 'CONFIRM_WORKER_BOOKING', 'bookings', v_new_booking.id::TEXT,
    jsonb_build_object('job_id', p_job_id, 'worker_id', p_worker_id, 'status', 'confirmed')
  );

  PERFORM _notify(
    p_worker_id,
    'Booking Confirmed!',
    'You have been confirmed for: ' || v_job.title,
    'booking_confirmed'
  );

  RETURN jsonb_build_object(
    'success', true,
    'booking_id', v_new_booking.id,
    'check_in_code', v_check_in_code,
    'status', 'confirmed'
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.confirm_worker_booking_safe(UUID, UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.confirm_worker_booking_safe(UUID, UUID, TEXT) TO authenticated;

-- ------------------------------------------------------------------------------
-- 6. ORGANIZER DATA ISOLATION RLS POLICY ON ORGANIZER_PROFILES
-- ------------------------------------------------------------------------------

DROP POLICY IF EXISTS "Organizers view own business profile" ON public.organizer_profiles;
DROP POLICY IF EXISTS "Organizers and team members view business profile" ON public.organizer_profiles;

CREATE POLICY "Organizers and team members view business profile"
  ON public.organizer_profiles FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR is_current_admin()
    OR EXISTS (
      SELECT 1 FROM organizer_memberships
      WHERE organizer_id = organizer_profiles.id
        AND user_id = auth.uid()
        AND role IN ('owner', 'admin', 'manager', 'member')
    )
  );

-- ==============================================================================
-- OPSKL MIGRATION: 20261018000001_phase4_marketplace_business_logic.sql
-- ==============================================================================

-- 1. HARDEN GET_DISCOVERY_FEED WITH COMPOSABLE FILTERS & EXCLUSIONS
CREATE OR REPLACE FUNCTION public.get_discovery_feed(
  p_filters JSONB DEFAULT '{}',
  p_limit INT DEFAULT 20,
  p_cursor JSONB DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  organizer_id UUID,
  title TEXT,
  category shift_category,
  venue_name TEXT,
  venue_address TEXT,
  landmark TEXT,
  city TEXT,
  zone TEXT,
  date DATE,
  start_time TIME,
  end_time TIME,
  duration_hours NUMERIC,
  hourly_rate NUMERIC,
  total_pay NUMERIC,
  wage_per_worker NUMERIC,
  slots_total INTEGER,
  slots_filled INTEGER,
  dress_code TEXT,
  duties TEXT[],
  perks TEXT[],
  required_skills TEXT[],
  eligibility_criteria TEXT,
  breaks_minutes INTEGER,
  meal_provided BOOLEAN,
  transport_provided BOOLEAN,
  overtime_policy TEXT,
  latitude NUMERIC,
  longitude NUMERIC,
  status shift_status,
  created_at TIMESTAMPTZ,
  organizer_business_name TEXT,
  organizer_rating NUMERIC,
  organizer_verified BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_zone TEXT := NULLIF(trim(p_filters->>'zone'), '');
  v_city TEXT := NULLIF(trim(p_filters->>'city'), '');
  v_category TEXT := NULLIF(trim(p_filters->>'category'), '');
  v_min_hourly NUMERIC := COALESCE((p_filters->>'min_hourly_rate')::NUMERIC, (p_filters->>'min_hourly_wage')::NUMERIC);
  v_min_pay NUMERIC := COALESCE((p_filters->>'min_total_pay')::NUMERIC, (p_filters->>'min_pay')::NUMERIC);
  v_date DATE := (p_filters->>'date')::DATE;
  v_date_from DATE := (p_filters->>'date_from')::DATE;
  v_date_to DATE := (p_filters->>'date_to')::DATE;
  v_search TEXT := NULLIF(trim(p_filters->>'search_query'), '');
  v_user_lat NUMERIC := (p_filters->>'latitude')::NUMERIC;
  v_user_lng NUMERIC := (p_filters->>'longitude')::NUMERIC;
  v_radius_km NUMERIC := COALESCE((p_filters->>'radius_km')::NUMERIC, (p_filters->>'distance_km')::NUMERIC);

  v_cursor_date DATE;
  v_cursor_time TIME;
  v_cursor_id UUID;
BEGIN
  IF p_cursor IS NOT NULL THEN
    v_cursor_date := (p_cursor->>'date')::DATE;
    v_cursor_time := (p_cursor->>'start_time')::TIME;
    v_cursor_id := (p_cursor->>'id')::UUID;
  END IF;

  RETURN QUERY
  SELECT
    j.id,
    j.organizer_id,
    j.title,
    j.category,
    j.venue_name,
    j.venue_address,
    j.landmark,
    j.city,
    j.zone,
    j.date,
    j.start_time,
    j.end_time,
    j.duration_hours,
    j.hourly_rate,
    j.total_pay,
    j.wage_per_worker,
    j.slots_total,
    j.slots_filled,
    j.dress_code,
    j.duties,
    j.perks,
    j.required_skills,
    j.eligibility_criteria,
    j.breaks_minutes,
    j.meal_provided,
    j.transport_provided,
    j.overtime_policy,
    j.latitude,
    j.longitude,
    j.status,
    j.created_at,
    op.business_name,
    op.rating,
    (op.verification_status = 'verified')
  FROM jobs j
  JOIN organizer_profiles op ON op.id = j.organizer_id
  WHERE j.status IN ('open', 'filling')
    -- Require organizer to be verified
    AND op.verification_status = 'verified'
    -- Strictly exclude shifts whose start time in IST has already passed
    AND (
      j.date > (now() AT TIME ZONE 'Asia/Kolkata')::date
      OR (
        j.date = (now() AT TIME ZONE 'Asia/Kolkata')::date
        AND j.start_time > (now() AT TIME ZONE 'Asia/Kolkata')::time
      )
    )
    -- Must have available openings
    AND j.slots_filled < j.slots_total
    -- Application deadline check
    AND (j.application_deadline IS NULL OR j.application_deadline > now())
    -- Composable Zone / City filter
    AND (v_zone IS NULL OR v_zone = 'all' OR j.zone = v_zone OR j.city = v_zone)
    AND (v_city IS NULL OR v_city = 'all' OR j.city = v_city)
    -- Composable Category filter
    AND (v_category IS NULL OR v_category = 'all' OR j.category::TEXT = v_category)
    -- Hourly Rate filter
    AND (v_min_hourly IS NULL OR j.hourly_rate >= v_min_hourly)
    -- Total Pay filter
    AND (v_min_pay IS NULL OR j.total_pay >= v_min_pay)
    -- Date filters
    AND (v_date IS NULL OR j.date = v_date)
    AND (v_date_from IS NULL OR j.date >= v_date_from)
    AND (v_date_to IS NULL OR j.date <= v_date_to)
    -- Search Query filter
    AND (
      v_search IS NULL
      OR j.title ILIKE '%' || v_search || '%'
      OR j.venue_name ILIKE '%' || v_search || '%'
      OR j.venue_address ILIKE '%' || v_search || '%'
      OR j.category::TEXT ILIKE '%' || v_search || '%'
    )
    -- Distance / Radius Filter (Haversine formula approximation)
    AND (
      v_user_lat IS NULL OR v_user_lng IS NULL OR v_radius_km IS NULL
      OR (
        j.latitude IS NOT NULL AND j.longitude IS NOT NULL AND
        (
          6371 * acos(
            least(1.0, greatest(-1.0,
              cos(radians(v_user_lat)) * cos(radians(j.latitude)) *
              cos(radians(j.longitude) - radians(v_user_lng)) +
              sin(radians(v_user_lat)) * sin(radians(j.latitude))
            ))
          )
        ) <= v_radius_km
      )
    )
    -- Exclude shifts with existing applications (applied, shortlisted, hired, confirmed, rejected)
    AND (v_user_id IS NULL OR NOT EXISTS (
      SELECT 1 FROM job_applications ja
      WHERE ja.job_id = j.id
        AND ja.worker_id = v_user_id
        AND ja.status IN ('applied', 'shortlisted', 'hired', 'confirmed', 'rejected')
    ))
    -- Exclude left swipe passes
    AND (v_user_id IS NULL OR NOT EXISTS (
      SELECT 1 FROM swipe_events se
      WHERE se.job_id = j.id
        AND se.worker_id = v_user_id
        AND se.direction = 'left'
    ))
    -- Keyset cursor condition: (date ASC, start_time ASC, id ASC)
    AND (
      p_cursor IS NULL OR
      (j.date > v_cursor_date) OR
      (j.date = v_cursor_date AND j.start_time > v_cursor_time) OR
      (j.date = v_cursor_date AND j.start_time = v_cursor_time AND j.id > v_cursor_id)
    )
  ORDER BY j.date ASC, j.start_time ASC, j.id ASC
  LIMIT LEAST(p_limit, 50);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_discovery_feed(JSONB, INT, JSONB) TO anon, authenticated;

-- 2. HARDEN APPLY_FOR_JOB_SAFE (EXCLUDE PAST START TIME & ENFORCE DEADLINES)
CREATE OR REPLACE FUNCTION public.apply_for_job_safe(
  p_job_id UUID,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_worker_id UUID := auth.uid();
  v_job RECORD;
  v_worker RECORD;
  v_existing_app RECORD;
  v_app_id UUID;
BEGIN
  IF v_worker_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'UNAUTHENTICATED');
  END IF;

  -- Require active worker profile with completed onboarding & verified KYC
  SELECT p.is_active, wp.profile_completion_status, wp.verification_status INTO v_worker
  FROM profiles p
  JOIN worker_profiles wp ON wp.id = p.id
  WHERE p.id = v_worker_id;

  IF NOT FOUND OR v_worker.is_active = false THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'INELIGIBLE_WORKER', 'message', 'Active worker account required.');
  END IF;

  IF v_worker.profile_completion_status != 'completed' THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'PROFILE_INCOMPLETE', 'message', 'Please complete your onboarding profile before applying.');
  END IF;

  IF v_worker.verification_status != 'verified' AND NOT is_current_admin() THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'KYC_NOT_VERIFIED', 'message', 'KYC identity verification must be approved by an administrator before applying for shifts.');
  END IF;

  -- Concurrency lock on job row
  SELECT * INTO v_job FROM jobs WHERE id = p_job_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'JOB_NOT_FOUND', 'message', 'Shift listing not found.');
  END IF;

  IF v_job.status NOT IN ('open', 'filling') THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'JOB_CLOSED', 'message', 'This shift is no longer open for applications.');
  END IF;

  -- Strict start time check in Indian Standard Time
  IF (v_job.date < (now() AT TIME ZONE 'Asia/Kolkata')::date)
     OR (v_job.date = (now() AT TIME ZONE 'Asia/Kolkata')::date AND v_job.start_time <= (now() AT TIME ZONE 'Asia/Kolkata')::time) THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'SHIFT_ALREADY_STARTED', 'message', 'Shift date and start time have already passed.');
  END IF;

  IF v_job.application_deadline IS NOT NULL AND v_job.application_deadline < now() THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'DEADLINE_PASSED', 'message', 'Application deadline for this shift has expired.');
  END IF;

  IF v_job.slots_filled >= v_job.slots_total THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'SLOTS_FULL', 'message', 'All openings for this shift have been filled.');
  END IF;

  SELECT id, status INTO v_existing_app
  FROM job_applications
  WHERE job_id = p_job_id AND worker_id = v_worker_id;

  IF FOUND THEN
    IF v_existing_app.status = 'withdrawn' THEN
      UPDATE job_applications
      SET status = 'applied', notes = COALESCE(p_notes, notes), updated_at = now()
      WHERE id = v_existing_app.id;

      RETURN jsonb_build_object('success', true, 'application_id', v_existing_app.id, 'status', 'applied', 'reapplied', true);
    ELSE
      RETURN jsonb_build_object('success', false, 'error_code', 'ALREADY_APPLIED', 'message', 'You have already applied for this shift.');
    END IF;
  END IF;

  INSERT INTO job_applications (
    job_id, worker_id, status, notes
  ) VALUES (
    p_job_id, v_worker_id, 'applied', p_notes
  ) RETURNING id INTO v_app_id;

  INSERT INTO audit_logs (
    actor_id, action, entity_type, entity_id, new_state
  ) VALUES (
    v_worker_id, 'APPLY_FOR_JOB', 'application', v_app_id::TEXT,
    jsonb_build_object('job_id', p_job_id, 'status', 'applied')
  );

  -- Send real-time notification to organizer
  PERFORM _notify(v_job.organizer_id, 'New Applicant for Shift', 'A verified worker has applied for ' || v_job.title, 'new_applicant');

  RETURN jsonb_build_object(
    'success', true,
    'application_id', v_app_id,
    'status', 'applied'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.apply_for_job_safe(UUID, TEXT) TO authenticated;

-- 3. APPLICATION WITHDRAWAL RPC (AUTHORITATIVE BUSINESS RULE ENFORCEMENT)
CREATE OR REPLACE FUNCTION public.withdraw_job_application_safe(
  p_application_id UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_worker_id UUID := auth.uid();
  v_app RECORD;
  v_job RECORD;
  v_shift_start TIMESTAMPTZ;
BEGIN
  IF v_worker_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'UNAUTHENTICATED');
  END IF;

  SELECT ja.id, ja.job_id, ja.worker_id, ja.status
  INTO v_app
  FROM job_applications ja
  WHERE ja.id = p_application_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'APPLICATION_NOT_FOUND', 'message', 'Application record not found.');
  END IF;

  -- Worker ownership or admin check
  IF v_app.worker_id != v_worker_id AND NOT is_current_admin() THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'UNAUTHORIZED', 'message', 'Not authorized to withdraw this application.');
  END IF;

  IF v_app.status = 'withdrawn' THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'ALREADY_WITHDRAWN', 'message', 'Application is already withdrawn.');
  END IF;

  IF v_app.status NOT IN ('applied', 'shortlisted') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'CANNOT_WITHDRAW_CONFIRMED',
      'message', 'Cannot withdraw an application that has already been confirmed or processed.'
    );
  END IF;

  -- Check shift cutoff window (cannot withdraw within 2 hours of start time)
  SELECT j.id, j.title, j.organizer_id, j.date, j.start_time
  INTO v_job
  FROM jobs j
  WHERE j.id = v_app.job_id;

  IF FOUND THEN
    v_shift_start := (v_job.date + v_job.start_time) AT TIME ZONE 'Asia/Kolkata';
    IF v_shift_start <= (now() AT TIME ZONE 'Asia/Kolkata') + INTERVAL '2 hours' THEN
      RETURN jsonb_build_object(
        'success', false,
        'error_code', 'WITHDRAWAL_DEADLINE_EXPIRED',
        'message', 'Applications cannot be withdrawn within 2 hours of shift start time.'
      );
    END IF;
  END IF;

  UPDATE job_applications
  SET status = 'withdrawn', updated_at = now()
  WHERE id = p_application_id;

  INSERT INTO audit_logs (
    actor_id, action, entity_type, entity_id, new_state
  ) VALUES (
    v_worker_id, 'WITHDRAW_APPLICATION', 'application', p_application_id::TEXT,
    jsonb_build_object('status', 'withdrawn', 'reason', p_reason)
  );

  IF v_job.organizer_id IS NOT NULL THEN
    PERFORM _notify(
      v_job.organizer_id,
      'Application Withdrawn',
      'A worker has withdrawn their application for ' || v_job.title,
      'application_withdrawn'
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'application_id', p_application_id,
    'status', 'withdrawn'
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.withdraw_job_application_safe(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.withdraw_job_application_safe(UUID, TEXT) TO authenticated;

-- 4. HARDEN CONFIRM_WORKER_BOOKING_SAFE (IDEMPOTENCY & STRICT CAPACITY LOCK)
CREATE OR REPLACE FUNCTION public.confirm_worker_booking_safe(
  p_job_id UUID,
  p_worker_id UUID,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_organizer_id UUID := auth.uid();
  v_job RECORD;
  v_app RECORD;
  v_existing_booking RECORD;
  v_new_booking RECORD;
  v_check_in_code TEXT;
  v_allow_direct BOOLEAN := false;
  v_job_start TIMESTAMPTZ;
  v_job_end TIMESTAMPTZ;
BEGIN
  IF v_organizer_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'UNAUTHENTICATED');
  END IF;

  -- 1. Idempotency Check: If worker is already confirmed for this shift, return existing booking cleanly
  SELECT id, check_in_code, status INTO v_existing_booking
  FROM bookings
  WHERE job_id = p_job_id AND worker_id = p_worker_id AND status IN ('confirmed', 'checked_in');

  IF FOUND THEN
    RETURN jsonb_build_object(
      'success', true,
      'booking_id', v_existing_booking.id,
      'check_in_code', v_existing_booking.check_in_code,
      'status', v_existing_booking.status,
      'already_confirmed', true
    );
  END IF;

  -- 2. Concurrency Lock on Shift Listing
  SELECT id, organizer_id, title, date, start_time, end_time, status, slots_total, slots_filled, hourly_rate, total_pay
  INTO v_job
  FROM jobs
  WHERE id = p_job_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'JOB_NOT_FOUND', 'message', 'Shift listing not found');
  END IF;

  -- 3. Authorization Check: must be shift organizer, team admin/owner, or platform admin
  IF v_job.organizer_id <> v_organizer_id 
     AND NOT is_current_admin() 
     AND NOT EXISTS (
       SELECT 1 FROM organizer_memberships
       WHERE organizer_id = v_job.organizer_id
         AND user_id = v_organizer_id
         AND role IN ('owner', 'admin')
     ) THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'UNAUTHORIZED', 'message', 'Not authorized to hire for this shift');
  END IF;

  -- 4. Platform Killswitch Check
  IF EXISTS (
    SELECT 1 FROM platform_settings
    WHERE key = 'booking_killswitch' AND (value->>'is_paused')::BOOLEAN = true
  ) THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'BOOKINGS_PAUSED', 'message', 'Shift bookings are temporarily paused platform-wide.');
  END IF;

  -- 5. Require Organizer Identity Verification
  IF NOT EXISTS (
    SELECT 1 FROM organizer_profiles
    WHERE id = v_job.organizer_id AND (verification_status = 'verified' OR is_current_admin())
  ) THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'UNVERIFIED_ORGANIZER', 'message', 'Organizer identity verification required before hiring.');
  END IF;

  -- 6. Require Worker Active & KYC Verified
  IF NOT EXISTS (
    SELECT 1 FROM worker_profiles wp
    JOIN profiles p ON p.id = wp.id
    WHERE wp.id = p_worker_id
      AND (wp.verification_status = 'verified' OR is_current_admin())
      AND p.is_active = true
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'UNVERIFIED_WORKER',
      'message', 'Worker identity verification must be approved before booking can be confirmed.'
    );
  END IF;

  -- 7. Shift Status & Time Validity
  IF v_job.status NOT IN ('open', 'filling') THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'JOB_NOT_OPEN', 'message', 'Shift is not open for hiring.');
  END IF;

  IF (v_job.date < (now() AT TIME ZONE 'Asia/Kolkata')::date)
     OR (v_job.date = (now() AT TIME ZONE 'Asia/Kolkata')::date AND v_job.start_time <= (now() AT TIME ZONE 'Asia/Kolkata')::time) THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'PAST_DATE', 'message', 'Cannot hire workers for shifts that have already started.');
  END IF;

  -- 8. Capacity Check: Atomic & Strict
  IF v_job.slots_filled >= v_job.slots_total THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'CAPACITY_REACHED', 'message', 'All openings for this shift have already been filled.');
  END IF;

  -- 9. Application Requirement Check
  SELECT COALESCE((value->>'allow_direct_invites')::boolean, false) INTO v_allow_direct
  FROM platform_settings WHERE key = 'allow_direct_invites';

  SELECT id, status INTO v_app
  FROM job_applications
  WHERE job_id = p_job_id AND worker_id = p_worker_id;

  IF NOT FOUND THEN
    IF NOT v_allow_direct THEN
      RETURN jsonb_build_object('success', false, 'error_code', 'APPLICATION_REQUIRED', 'message', 'Worker must apply to shift before being confirmed.');
    END IF;
  ELSE
    IF v_app.status NOT IN ('applied', 'shortlisted') THEN
      RETURN jsonb_build_object('success', false, 'error_code', 'INVALID_APPLICATION_STATUS', 'message', 'Application must be in applied or shortlisted state.');
    END IF;
  END IF;

  -- 10. Check for Overlapping Shifts on Schedule
  v_job_start := (v_job.date + v_job.start_time) AT TIME ZONE 'Asia/Kolkata';
  v_job_end := (v_job.date + v_job.end_time + CASE WHEN v_job.end_time <= v_job.start_time THEN interval '1 day' ELSE interval '0' END) AT TIME ZONE 'Asia/Kolkata';

  IF EXISTS (
    SELECT 1 FROM bookings b
    JOIN jobs other_j ON other_j.id = b.job_id
    WHERE b.worker_id = p_worker_id
      AND b.status IN ('confirmed', 'checked_in')
      AND other_j.id <> p_job_id
      AND (
        ((other_j.date + other_j.start_time) AT TIME ZONE 'Asia/Kolkata') < v_job_end
        AND
        ((other_j.date + other_j.end_time + CASE WHEN other_j.end_time <= other_j.start_time THEN interval '1 day' ELSE interval '0' END) AT TIME ZONE 'Asia/Kolkata') > v_job_start
      )
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'OVERLAPPING_SHIFT_SCHEDULE',
      'message', 'Worker is already confirmed for another overlapping shift on this schedule.'
    );
  END IF;

  -- Generate cryptographically robust booking code
  v_check_in_code := 'OP-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));

  -- Insert Booking
  INSERT INTO bookings (
    job_id, worker_id, organizer_id, status,
    agreed_rate, total_payout, check_in_code, notes
  ) VALUES (
    p_job_id, p_worker_id, v_job.organizer_id, 'confirmed',
    v_job.hourly_rate, v_job.total_pay, v_check_in_code, p_notes
  )
  RETURNING * INTO v_new_booking;

  -- Update Application status to hired
  IF v_app.id IS NOT NULL THEN
    UPDATE job_applications
    SET status = 'hired', updated_at = now()
    WHERE id = v_app.id;
  END IF;

  -- Increment filled slots count and update job status
  UPDATE jobs
  SET
    slots_filled = slots_filled + 1,
    status = CASE WHEN slots_filled + 1 >= slots_total THEN 'filled'::job_status ELSE 'filling'::job_status END,
    updated_at = now()
  WHERE id = p_job_id;

  INSERT INTO audit_logs (
    actor_id, action, entity_type, entity_id, new_state
  ) VALUES (
    v_organizer_id, 'CONFIRM_WORKER_BOOKING', 'bookings', v_new_booking.id::TEXT,
    jsonb_build_object('job_id', p_job_id, 'worker_id', p_worker_id, 'status', 'confirmed')
  );

  PERFORM _notify(
    p_worker_id,
    'Booking Confirmed!',
    'You have been confirmed for: ' || v_job.title,
    'booking_confirmed'
  );

  RETURN jsonb_build_object(
    'success', true,
    'booking_id', v_new_booking.id,
    'check_in_code', v_check_in_code,
    'status', 'confirmed',
    'already_confirmed', false
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.confirm_worker_booking_safe(UUID, UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.confirm_worker_booking_safe(UUID, UUID, TEXT) TO authenticated;

-- 5. SHIFT EDITING RPC (PREVENT ALTERING COMPLETED SHIFTS OR REDUCING BELOW CONFIRMED)
CREATE OR REPLACE FUNCTION public.edit_job_safe(
  p_job_id UUID,
  p_job JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor_id UUID := auth.uid();
  v_job RECORD;
  v_new_slots INTEGER;
  v_new_hourly NUMERIC;
  v_new_date DATE;
  v_new_start TIME;
  v_new_end TIME;
  v_new_lat NUMERIC;
  v_new_lng NUMERIC;
BEGIN
  IF v_actor_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'UNAUTHENTICATED');
  END IF;

  SELECT * INTO v_job
  FROM jobs
  WHERE id = p_job_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'JOB_NOT_FOUND', 'message', 'Shift listing not found.');
  END IF;

  -- Authorization check
  IF v_job.organizer_id != v_actor_id
     AND NOT is_current_admin()
     AND NOT EXISTS (
       SELECT 1 FROM organizer_memberships
       WHERE organizer_id = v_job.organizer_id
         AND user_id = v_actor_id
         AND role IN ('owner', 'admin')
     ) THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'UNAUTHORIZED', 'message', 'Not authorized to edit this shift.');
  END IF;

  -- Cannot edit completed, cancelled, or in_progress shifts
  IF v_job.status IN ('completed', 'cancelled', 'in_progress') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'SHIFT_IMMUTABLE',
      'message', 'Cannot edit a shift that is ' || v_job.status || '.'
    );
  END IF;

  -- Parse fields
  v_new_slots := COALESCE((p_job->>'required_workers')::INTEGER, (p_job->>'slots_total')::INTEGER, v_job.slots_total);
  v_new_hourly := COALESCE((p_job->>'hourly_rate')::NUMERIC, v_job.hourly_rate);
  v_new_date := COALESCE((p_job->>'date')::DATE, v_job.date);
  v_new_start := COALESCE((p_job->>'start_time')::TIME, v_job.start_time);
  v_new_end := COALESCE((p_job->>'end_time')::TIME, v_job.end_time);
  v_new_lat := CASE WHEN p_job ? 'latitude' THEN (p_job->>'latitude')::NUMERIC ELSE v_job.latitude END;
  v_new_lng := CASE WHEN p_job ? 'longitude' THEN (p_job->>'longitude')::NUMERIC ELSE v_job.longitude END;

  -- Validation: Capacity cannot be reduced below already confirmed workers
  IF v_new_slots < v_job.slots_filled THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'CAPACITY_BELOW_CONFIRMED',
      'message', 'Capacity cannot be reduced below ' || v_job.slots_filled || ' currently confirmed workers.'
    );
  END IF;

  -- Validation: If workers are confirmed, cannot change dates/times or decrease hourly rate
  IF v_job.slots_filled > 0 THEN
    IF v_new_hourly < v_job.hourly_rate THEN
      RETURN jsonb_build_object(
        'success', false,
        'error_code', 'WAGE_REDUCTION_FORBIDDEN',
        'message', 'Cannot reduce hourly rate on a shift with confirmed workers.'
      );
    END IF;

    IF v_new_date != v_job.date OR v_new_start != v_job.start_time OR v_new_end != v_job.end_time THEN
      RETURN jsonb_build_object(
        'success', false,
        'error_code', 'SCHEDULE_LOCKED',
        'message', 'Shift date and schedule times cannot be altered after workers have been confirmed.'
      );
    END IF;
  END IF;

  -- Validation: Indian coordinates bounds
  IF (v_new_lat IS NOT NULL AND v_new_lng IS NULL) OR (v_new_lat IS NULL AND v_new_lng IS NOT NULL) THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'INVALID_COORDINATES', 'message', 'Both latitude and longitude must be provided.');
  END IF;

  IF v_new_lat IS NOT NULL AND (v_new_lat < 6.0 OR v_new_lat > 38.0 OR v_new_lng < 68.0 OR v_new_lng > 98.0) THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'COORDINATES_OUT_OF_BOUNDS', 'message', 'Venue coordinates must be within India (6–38°N, 68–98°E).');
  END IF;

  -- Validation: Minimum wage floor
  IF v_new_hourly < 100.0 THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'BELOW_MINIMUM_WAGE', 'message', 'Hourly rate cannot be below ₹100.');
  END IF;

  -- Update shift record
  UPDATE jobs
  SET
    title = COALESCE(NULLIF(trim(p_job->>'title'), ''), title),
    description = COALESCE(p_job->>'description', description),
    category = COALESCE((p_job->>'category')::shift_category, category),
    slots_total = v_new_slots,
    hourly_rate = v_new_hourly,
    total_pay = COALESCE((p_job->>'total_pay')::NUMERIC, ROUND(v_new_hourly * duration_hours, 2)),
    wage_per_worker = COALESCE((p_job->>'wage_per_worker')::NUMERIC, ROUND(v_new_hourly * duration_hours, 2)),
    venue_name = COALESCE(NULLIF(trim(p_job->>'venue_name'), ''), venue_name),
    venue_address = COALESCE(NULLIF(trim(p_job->>'venue_address'), ''), venue_address),
    landmark = COALESCE(p_job->>'landmark', landmark),
    city = COALESCE(p_job->>'city', city),
    zone = COALESCE(p_job->>'zone', zone),
    latitude = v_new_lat,
    longitude = v_new_lng,
    dress_code = COALESCE(p_job->>'dress_code', dress_code),
    duties = CASE WHEN p_job ? 'duties' THEN ARRAY(SELECT jsonb_array_elements_text(p_job->'duties')) ELSE duties END,
    perks = CASE WHEN p_job ? 'perks' THEN ARRAY(SELECT jsonb_array_elements_text(p_job->'perks')) ELSE perks END,
    required_skills = CASE WHEN p_job ? 'required_skills' THEN ARRAY(SELECT jsonb_array_elements_text(p_job->'required_skills')) ELSE required_skills END,
    eligibility_criteria = COALESCE(p_job->>'eligibility_criteria', eligibility_criteria),
    breaks_minutes = COALESCE((p_job->>'break_minutes')::INTEGER, (p_job->>'breaks_minutes')::INTEGER, breaks_minutes),
    application_deadline = CASE WHEN p_job ? 'application_deadline' THEN (p_job->>'application_deadline')::TIMESTAMPTZ ELSE application_deadline END,
    status = CASE WHEN slots_filled >= v_new_slots THEN 'filled'::job_status ELSE 'open'::job_status END,
    updated_at = now()
  WHERE id = p_job_id;

  INSERT INTO audit_logs (
    actor_id, action, entity_type, entity_id, new_state
  ) VALUES (
    v_actor_id, 'EDIT_JOB', 'jobs', p_job_id::TEXT,
    jsonb_build_object('job_id', p_job_id, 'slots_total', v_new_slots, 'hourly_rate', v_new_hourly)
  );

  RETURN jsonb_build_object(
    'success', true,
    'job_id', p_job_id
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.edit_job_safe(UUID, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.edit_job_safe(UUID, JSONB) TO authenticated;




