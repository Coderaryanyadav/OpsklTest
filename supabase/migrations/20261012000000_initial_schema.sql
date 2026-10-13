-- ==============================================================================
-- OPSKL MASTER DATABASE SCHEMA & MIGRATION
-- Market: India (Single-Day Event Shift Marketplace)
-- Initial Launch: Mumbai Metropolitan Region
-- ==============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

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
  phone TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  email TEXT,
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
  rating NUMERIC(3, 2) DEFAULT 5.00,
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
  rating NUMERIC(3, 2) DEFAULT 5.00,
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

  v_phone := COALESCE(NEW.phone, NEW.raw_user_meta_data->>'phone', '91' || substr(replace(NEW.id::text, '-', ''), 1, 10));
  v_name := COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', 'User ' || substr(NEW.id::text, 1, 6));
  v_email := NEW.email;

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
  p_phone TEXT DEFAULT NULL
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
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Authentication required.');
  END IF;

  -- Disallow regular user elevating to admin
  IF v_role = 'admin' THEN
    v_role := 'worker';
  END IF;

  SELECT * INTO v_existing_profile FROM profiles WHERE id = v_user_id;

  IF FOUND THEN
    v_role := v_existing_profile.role;
  ELSE
    v_name := COALESCE(p_full_name, 'User ' || substr(v_user_id::text, 1, 6));
    v_phone := COALESCE(p_phone, '91' || substr(replace(v_user_id::text, '-', ''), 1, 10));

    INSERT INTO profiles (id, role, phone, full_name, city, is_active)
    VALUES (v_user_id, v_role, v_phone, v_name, 'Mumbai', true)
    ON CONFLICT (id) DO NOTHING;
  END IF;

  IF v_role = 'worker' THEN
    INSERT INTO worker_profiles (id, preferred_locality, skills, availability_status, profile_completion_status, verification_status)
    VALUES (v_user_id, 'Mumbai', '{}', 'available', 'incomplete', 'unverified')
    ON CONFLICT (id) DO NOTHING;
  ELSIF v_role = 'organizer' THEN
    INSERT INTO organizer_profiles (id, business_name, business_contact_phone, business_type, profile_completion_status, verification_status)
    VALUES (v_user_id, COALESCE(p_full_name, 'Independent Organizer'), COALESCE(p_phone, ''), 'independent', 'incomplete', 'unverified')
    ON CONFLICT (id) DO NOTHING;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'user_id', v_user_id,
    'role', v_role
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION ensure_user_profile_provisioned_safe(user_role, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION ensure_user_profile_provisioned_safe(user_role, TEXT, TEXT) TO authenticated;

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

CREATE POLICY "Organizers can view applicant worker profiles"
  ON worker_profiles FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM job_applications ja
      JOIN jobs j ON j.id = ja.job_id
      WHERE ja.worker_id = worker_profiles.id AND j.organizer_id = auth.uid()
    )
  );

-- 3. Organizer Profiles
CREATE POLICY "Organizers view their own profile"
  ON organizer_profiles FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Organizers update their own profile"
  ON organizer_profiles FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Public verified organizer card view"
  ON organizer_profiles FOR SELECT USING (verification_status = 'verified');

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
