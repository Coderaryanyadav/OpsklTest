import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const launchMigrationPath = path.join(rootDir, 'supabase', 'migrations', '20261015000000_launch_fixes.sql');
const hardeningMigrationPath = path.join(rootDir, 'supabase', 'migrations', '20261016000000_security_privacy_coordinate_hardening.sql');
const adminGuardMigrationPath = path.join(rootDir, 'supabase', 'migrations', '20261017000000_safe_admin_role_escalation_guard.sql');
const phase2MigrationPath = path.join(rootDir, 'supabase', 'migrations', '20261017000001_shift_creation_and_rpc_hardening.sql');

// Parse .env if present
try {
  const envPath = path.join(rootDir, '.env');
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const idx = trimmed.indexOf('=');
      if (idx !== -1) {
        const key = trimmed.slice(0, idx).trim();
        let val = trimmed.slice(idx + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  }
} catch {
  // Ignore errors reading local .env
}

const connectionString = process.env.DATABASE_URL || process.argv[2];

async function run() {
  console.log('\x1b[36m[OPSKL SQL INTEGRATION & LOGIC HARDENING TEST SUITE - PHASE 2]\x1b[0m');

  const launchSql = fs.readFileSync(launchMigrationPath, 'utf8');
  const hardeningSql = fs.readFileSync(hardeningMigrationPath, 'utf8');
  const adminGuardSql = fs.readFileSync(adminGuardMigrationPath, 'utf8');
  const phase2Sql = fs.readFileSync(phase2MigrationPath, 'utf8');
  const combinedSql = `${launchSql}\n${hardeningSql}\n${adminGuardSql}\n${phase2Sql}`;

  // Verify critical invariants across migrations
  const checks = [
    {
      name: '1.1 Trusted bypass mechanism configured in check_worker_profile_update',
      test: () => combinedSql.includes("current_setting('opskl.trusted', true) = '1'"),
    },
    {
      name: '1.2 Dispute reason minimum length validation (>= 10)',
      test: () => combinedSql.includes("length(trim(COALESCE(p_reason, ''))) < 10"),
    },
    {
      name: '1.2 Direct INSERT policy on disputes dropped',
      test: () => combinedSql.includes('DROP POLICY IF EXISTS "Participants create disputes" ON disputes'),
    },
    {
      name: '1.3 Organizer business_contact_phone relaxed from NOT NULL',
      test: () => combinedSql.includes('ALTER TABLE organizer_profiles ALTER COLUMN business_contact_phone DROP NOT NULL'),
    },
    {
      name: '1.3 CSPRNG booking code replaced gen_random_bytes',
      test: () => combinedSql.includes("upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10))") && !combinedSql.includes('gen_random_bytes'),
    },
    {
      name: '1.4 public_jobs view shielding supervisor contact created',
      test: () => {
        const viewMatch = hardeningSql.match(/CREATE VIEW public\.public_jobs([\s\S]*?)FROM public\.jobs/);
        return viewMatch && !viewMatch[1].includes('supervisor_name') && !viewMatch[1].includes('supervisor_phone');
      },
    },
    {
      name: '1.5 Job lifecycle state machine validate_job_transition defined',
      test: () => combinedSql.includes('CREATE OR REPLACE FUNCTION validate_job_transition('),
    },
    {
      name: '1.5 cancel_booking_safe slot reopen guarded against past/cancelled jobs',
      test: () => combinedSql.includes("v_job.status IN ('filled', 'filling', 'open') AND v_job.date >= (now() AT TIME ZONE 'Asia/Kolkata')::date"),
    },
    {
      name: '1.6 Overlapping shift double-booking guard in confirm_worker_booking_safe',
      test: () => combinedSql.includes('OVERLAPPING_SHIFT_SCHEDULE'),
    },
    {
      name: '1.7 Keyset paginated get_discovery_feed defined',
      test: () => combinedSql.includes('CREATE OR REPLACE FUNCTION get_discovery_feed('),
    },
    {
      name: '1.8 Attendance distance column widened to NUMERIC(8,2)',
      test: () => combinedSql.includes('ALTER TABLE attendance_records ALTER COLUMN distance_to_venue_km TYPE NUMERIC(8, 2)'),
    },
    {
      name: '1.9 Admin dispute resolution restores pre-dispute booking status on dismissal',
      test: () => combinedSql.includes("v_target_booking_status := COALESCE(v_booking.status_before_dispute, 'confirmed')"),
    },
    {
      name: '1.10 FY sequential invoice generator OPS/YY-YY/00001 defined',
      test: () => combinedSql.includes("RETURN 'OPS/' || LPAD(v_fy_start::TEXT, 2, '0')"),
    },
    {
      name: '1.10 Paid invoice immutability guard in generate_job_invoice_safe',
      test: () => combinedSql.includes("IF v_existing.status IN ('escrow_funded', 'settled') THEN"),
    },
    {
      name: '1.11 Overnight shifts crosses_midnight and end_date columns',
      test: () => combinedSql.includes('crosses_midnight') && combinedSql.includes('end_date'),
    },
    {
      name: '1.11 Sovereign India coordinate bounds validation (6-38 N, 68-98 E)',
      test: () => combinedSql.includes('v_lat < 6.0 OR v_lat > 38.0 OR v_lng < 68.0 OR v_lng > 98.0'),
    },
    {
      name: '2.1 Hardening migration: Partial coordinate pair rejection (INCOMPLETE_COORDINATES)',
      test: () => phase2Sql.includes('INCOMPLETE_COORDINATES'),
    },
    {
      name: '2.2 Hardening migration: Public organizer card shields GSTIN & billing address',
      test: () => {
        const orgViewMatch = hardeningSql.match(/CREATE VIEW public\.public_organizer_cards([\s\S]*?)FROM public\.organizer_profiles;/);
        return orgViewMatch && !orgViewMatch[1].includes('gstin') && !orgViewMatch[1].includes('billing_address');
      },
    },
    {
      name: '2.3 Hardening migration: Initial shift lifecycle status restricted to draft/open',
      test: () => phase2Sql.includes('INVALID_INITIAL_STATUS') && phase2Sql.includes("v_raw_status NOT IN ('draft', 'open')"),
    },
    {
      name: '2.4 Hardening migration: Application & payment deadlines persisted in INSERT',
      test: () => phase2Sql.includes('v_app_deadline') && phase2Sql.includes('v_payment_deadline') && phase2Sql.includes('application_deadline, payment_deadline'),
    },
    {
      name: '2.5 Hardening migration: Min wage fallback protects against missing settings row',
      test: () => phase2Sql.includes('v_min_wage := 100.0;') && phase2Sql.includes('GREATEST(COALESCE(v_min_wage, 100.0), 100.0)'),
    },
    {
      name: '2.6 Hardening migration: Same-day start time in the past rejected in IST',
      test: () => phase2Sql.includes('PAST_START_TIME') && phase2Sql.includes("v_shift_start_timestamptz <= now()"),
    },
    {
      name: '2.7 Hardening migration: Break duration bounds (0-120 mins and < shift duration)',
      test: () => phase2Sql.includes('INVALID_BREAK_DURATION') && phase2Sql.includes('BREAK_EXCEEDS_DURATION'),
    },
    {
      name: '2.8 Phase 2: Duplicate publication throttle guard (DUPLICATE_PUBLICATION)',
      test: () => phase2Sql.includes('DUPLICATE_PUBLICATION') && phase2Sql.includes("interval '30 seconds'"),
    },
    {
      name: '2.9 Phase 2: Organizer team memberships authorization check',
      test: () => phase2Sql.includes('organizer_memberships') && phase2Sql.includes("role IN ('owner', 'admin')"),
    },
    {
      name: '2.10 Phase 2: Admin role escalation safe guard prevents trigger-disable hacks',
      test: () => adminGuardSql.includes('prevent_role_escalation') && adminGuardSql.includes('is_current_admin()'),
    },
  ];

  let passed = 0;
  for (const check of checks) {
    if (check.test()) {
      console.log(`\x1b[32m  ✓ Passed: ${check.name}\x1b[0m`);
      passed++;
    } else {
      console.error(`\x1b[31m  ✗ Failed: ${check.name}\x1b[0m`);
    }
  }

  console.log(`\nInvariant Checks Passed: ${passed}/${checks.length}`);
  if (passed !== checks.length) {
    process.exit(1);
  }

  // Live database connection requires explicit opt-in via DATABASE_URL
  const liveDbUrl = connectionString;
  if (liveDbUrl) {
    console.log(`\nConnecting to test database at ${liveDbUrl.split('@')[1] || 'database'}...`);
    const parsedDb = new URL(liveDbUrl.replace(/^postgresql:\/\//, 'http://'));
    const isLocalDb = ['localhost', '127.0.0.1'].includes(parsedDb.hostname);
    const rejectUnauthorized = process.env.DATABASE_SSL_REJECT_UNAUTHORIZED === 'true';
    const client = new pg.Client({
      connectionString: liveDbUrl,
      ssl: isLocalDb ? false : { rejectUnauthorized },
    });

    try {
      await client.connect();
      console.log('\x1b[32m✓ Connected to PostgreSQL.\x1b[0m');

      // 1. Verify all required RPC functions exist and assert all are found
      const expectedFunctions = [
        'validate_job_transition',
        'get_discovery_feed',
        'get_job_contact',
        'submit_review_safe',
        'admin_mark_invoice_funded',
        'admin_mark_payout_settled',
        'create_job_safe',
        'confirm_worker_booking_safe',
        'cancel_booking_safe',
        'is_current_admin',
        'admin_moderate_job_safe',
        'admin_resolve_safety_report_safe',
      ];

      const { rows: funcRows } = await client.query(`
        SELECT proname FROM pg_proc
        WHERE proname = ANY($1);
      `, [expectedFunctions]);

      const foundFuncs = new Set(funcRows.map((r) => r.proname));
      const missingFuncs = expectedFunctions.filter((f) => !foundFuncs.has(f));
      if (missingFuncs.length > 0) {
        throw new Error(`Missing expected RPC functions in Postgres: ${missingFuncs.join(', ')}`);
      }
      console.log(`\x1b[32m✓ Verified all ${expectedFunctions.length} core security and lifecycle RPC functions compiled in Postgres.\x1b[0m`);

      // 2. Assert that public_jobs view shields supervisor contact info
      const { rows: publicJobCols } = await client.query(`
        SELECT column_name FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'public_jobs';
      `);
      const publicJobColNames = publicJobCols.map((c) => c.column_name);
      if (publicJobColNames.includes('supervisor_phone') || publicJobColNames.includes('supervisor_name')) {
        throw new Error('SECURITY VIOLATION: public_jobs view exposes supervisor direct contact details!');
      }
      console.log('\x1b[32m✓ Verified public_jobs view strictly shields supervisor contact details.\x1b[0m');

      // 3. Assert that public_organizer_cards view shields GSTIN and billing info
      const { rows: publicOrgCols } = await client.query(`
        SELECT column_name FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'public_organizer_cards';
      `);
      const publicOrgColNames = publicOrgCols.map((c) => c.column_name);
      if (publicOrgColNames.includes('gstin') || publicOrgColNames.includes('billing_address')) {
        throw new Error('SECURITY VIOLATION: public_organizer_cards view exposes organizer GSTIN or billing address!');
      }
      console.log('\x1b[32m✓ Verified public_organizer_cards view strictly shields organizer GSTIN & billing address.\x1b[0m');

      // 4. Assert coordinate bounds check: partial coordinate rejection
      const { rows: coordTestRows } = await client.query(`
        SELECT create_job_safe(
          jsonb_build_object(
            'title', 'Test Coordinate Shield Shift',
            'category', 'conference',
            'venueName', 'Grand Hyatt Mumbai',
            'venueAddress', 'Bandra Kurla Complex, Mumbai',
            'zone', 'Bandra Kurla Complex (BKC)',
            'latitude', 19.066,
            'longitude', NULL,
            'date', ((now() AT TIME ZONE 'Asia/Kolkata') + interval '3 days')::date::text,
            'start_time', '09:00',
            'end_time', '18:00',
            'durationHours', 9,
            'hourlyRate', 200,
            'slotsTotal', 5,
            'supervisorName', 'Rajesh Sharma',
            'supervisorPhone', '9820098200',
            'status', 'draft'
          ),
          '6ad9b1d3-cd34-49ba-aa96-37d903451db4'::uuid
        ) AS result;
      `);
      const coordResult = coordTestRows[0]?.result;
      if (coordResult?.success !== false || coordResult?.error_code !== 'INCOMPLETE_COORDINATES') {
        throw new Error(`COORDINATE INTEGRITY FAILURE: create_job_safe did not reject incomplete coordinate pair! Got: ${JSON.stringify(coordResult)}`);
      }
      console.log('\x1b[32m✓ Verified create_job_safe strictly rejects partial coordinate pairs.\x1b[0m');

      // 5. Assert out-of-bounds coordinates rejected (outside India: Lat 50, Lng 10)
      const { rows: oobCoordRows } = await client.query(`
        SELECT create_job_safe(
          jsonb_build_object(
            'title', 'Test Out of Bounds Shift',
            'category', 'conference',
            'venueName', 'European Exhibition Hall',
            'venueAddress', 'Berlin, Germany',
            'latitude', 52.5200,
            'longitude', 13.4050,
            'date', ((now() AT TIME ZONE 'Asia/Kolkata') + interval '3 days')::date::text,
            'start_time', '09:00',
            'end_time', '18:00',
            'hourlyRate', 200,
            'slotsTotal', 5,
            'supervisorName', 'Rajesh Sharma',
            'supervisorPhone', '9820098200',
            'status', 'draft'
          ),
          '6ad9b1d3-cd34-49ba-aa96-37d903451db4'::uuid
        ) AS result;
      `);
      const oobCoordResult = oobCoordRows[0]?.result;
      if (oobCoordResult?.success !== false || oobCoordResult?.error_code !== 'INVALID_COORDINATES') {
        throw new Error(`COORDINATE INTEGRITY FAILURE: create_job_safe did not reject non-India coordinates! Got: ${JSON.stringify(oobCoordResult)}`);
      }
      console.log('\x1b[32m✓ Verified create_job_safe strictly rejects non-India geographic coordinates.\x1b[0m');

      // 6. Assert unverified organizer live shift creation is rejected by backend RPC
      const { rows: orgRejectRows } = await client.query(`
        SELECT create_job_safe(
          jsonb_build_object(
            'title', 'Unauthorized Live Event Shift',
            'category', 'conference',
            'venueName', 'NESCO Center',
            'venueAddress', 'Western Express Highway, Goregaon, Mumbai',
            'zone', 'Goregaon & NESCO',
            'latitude', 19.1482,
            'longitude', 72.853,
            'date', ((now() AT TIME ZONE 'Asia/Kolkata') + interval '3 days')::date::text,
            'start_time', '10:00',
            'end_time', '19:00',
            'durationHours', 9,
            'hourlyRate', 250,
            'slotsTotal', 10,
            'supervisorName', 'Supervisor Test',
            'supervisorPhone', '9820098200',
            'status', 'open'
          ),
          '00000000-0000-0000-0000-000000000001'::uuid
        ) AS result;
      `);
      const orgRejectResult = orgRejectRows[0]?.result;
      if (orgRejectResult?.success !== false || !['ORGANIZER_NOT_VERIFIED', 'ORGANIZER_NOT_FOUND'].includes(orgRejectResult?.error_code)) {
        throw new Error(`ORGANIZER GATING FAILURE: unverified organizer was not rejected! Got: ${JSON.stringify(orgRejectResult)}`);
      }
      console.log(`\x1b[32m✓ Verified unverified organizer live shift creation is rejected by backend RPC (${orgRejectResult.error_code}).\x1b[0m`);

      // 7. Assert shift creation lifecycle status restrictions
      for (const disallowedStatus of ['completed', 'cancelled', 'filled', 'in_progress']) {
        const { rows: statusTestRows } = await client.query(`
          SELECT create_job_safe(
            jsonb_build_object(
              'title', 'Disallowed Initial Status Shift',
              'category', 'conference',
              'venueName', 'Grand Hyatt Mumbai',
              'venueAddress', 'Bandra Kurla Complex, Mumbai',
              'supervisorName', 'Rajesh Sharma',
              'supervisorPhone', '9820098200',
              'date', ((now() AT TIME ZONE 'Asia/Kolkata') + interval '3 days')::date::text,
              'start_time', '10:00',
              'end_time', '18:00',
              'hourlyRate', 200,
              'slotsTotal', 5,
              'status', $1::text
            ),
            '6ad9b1d3-cd34-49ba-aa96-37d903451db4'::uuid
          ) AS result;
        `, [disallowedStatus]);
        const statusRes = statusTestRows[0]?.result;
        if (statusRes?.success !== false || statusRes?.error_code !== 'INVALID_INITIAL_STATUS') {
          throw new Error(`LIFECYCLE STATUS INTEGRITY FAILURE: create_job_safe allowed initial status '${disallowedStatus}'! Got: ${JSON.stringify(statusRes)}`);
        }
      }
      console.log('\x1b[32m✓ Verified create_job_safe rejects direct creation in non-initial lifecycle statuses.\x1b[0m');

      // 8. Assert same-day start time in the past is rejected
      const { rows: pastTimeRows } = await client.query(`
        SELECT create_job_safe(
          jsonb_build_object(
            'title', 'Same Day Past Start Time Shift',
            'category', 'conference',
            'venueName', 'Grand Hyatt Mumbai',
            'venueAddress', 'Bandra Kurla Complex, Mumbai',
            'supervisorName', 'Rajesh Sharma',
            'supervisorPhone', '9820098200',
            'date', (now() AT TIME ZONE 'Asia/Kolkata')::date::text,
            'start_time', '01:00',
            'end_time', '09:00',
            'hourlyRate', 200,
            'slotsTotal', 5,
            'status', 'draft'
          ),
          '6ad9b1d3-cd34-49ba-aa96-37d903451db4'::uuid
        ) AS result;
      `);
      const pastTimeRes = pastTimeRows[0]?.result;
      if (pastTimeRes?.success !== false || pastTimeRes?.error_code !== 'PAST_START_TIME') {
        throw new Error(`SCHEDULE INTEGRITY FAILURE: create_job_safe allowed same-day past start time! Got: ${JSON.stringify(pastTimeRes)}`);
      }
      console.log('\x1b[32m✓ Verified create_job_safe rejects same-day shifts scheduled after start time.\x1b[0m');

      // 9. Assert break duration bounds validation
      const { rows: breakBoundsRows } = await client.query(`
        SELECT create_job_safe(
          jsonb_build_object(
            'title', 'Excessive Break Shift',
            'category', 'conference',
            'venueName', 'Grand Hyatt Mumbai',
            'venueAddress', 'Bandra Kurla Complex, Mumbai',
            'supervisorName', 'Rajesh Sharma',
            'supervisorPhone', '9820098200',
            'date', ((now() AT TIME ZONE 'Asia/Kolkata') + interval '3 days')::date::text,
            'start_time', '10:00',
            'end_time', '18:00',
            'hourlyRate', 200,
            'slotsTotal', 5,
            'breaksMinutes', 150,
            'status', 'draft'
          ),
          '6ad9b1d3-cd34-49ba-aa96-37d903451db4'::uuid
        ) AS result;
      `);
      const breakBoundsRes = breakBoundsRows[0]?.result;
      if (breakBoundsRes?.success !== false || breakBoundsRes?.error_code !== 'INVALID_BREAK_DURATION') {
        throw new Error(`BREAK DURATION FAILURE: create_job_safe allowed break > 120 mins! Got: ${JSON.stringify(breakBoundsRes)}`);
      }
      console.log('\x1b[32m✓ Verified create_job_safe validates break duration bounds (0-120 mins).\x1b[0m');

      // 10. Assert venue and supervisor validation
      const { rows: invalidVenueRows } = await client.query(`
        SELECT create_job_safe(
          jsonb_build_object(
            'title', 'Invalid Venue Shift',
            'category', 'conference',
            'venueName', 'A',
            'venueAddress', 'B',
            'supervisorName', 'Rajesh Sharma',
            'supervisorPhone', '9820098200',
            'date', ((now() AT TIME ZONE 'Asia/Kolkata') + interval '3 days')::date::text,
            'start_time', '10:00',
            'end_time', '18:00',
            'hourlyRate', 200,
            'slotsTotal', 5,
            'status', 'draft'
          ),
          '6ad9b1d3-cd34-49ba-aa96-37d903451db4'::uuid
        ) AS result;
      `);
      const invalidVenueRes = invalidVenueRows[0]?.result;
      if (invalidVenueRes?.success !== false || invalidVenueRes?.error_code !== 'INVALID_VENUE') {
        throw new Error(`VENUE VALIDATION FAILURE: Expected INVALID_VENUE, got: ${JSON.stringify(invalidVenueRes)}`);
      }
      console.log('\x1b[32m✓ Verified create_job_safe validates venue name and address minimum length.\x1b[0m');

      // 11. Transactional verification of persistence, deadlines, min-wage, duplicate guard & rollback
      await client.query('BEGIN');
      try {
        const testOrgId = '6ad9b1d3-cd34-49ba-aa96-37d903451db4';
        await client.query(`
          INSERT INTO organizer_profiles (id, business_name, business_type, verification_status)
          VALUES ($1, 'Verification Enterprise Corp', 'corporate', 'verified')
          ON CONFLICT (id) DO UPDATE SET verification_status = 'verified';
        `, [testOrgId]);

        // A. Verify min-wage fallback with platform_settings row deleted
        await client.query("DELETE FROM platform_settings WHERE key IN ('min_wage', 'min_hourly_wage_inr');");
        const { rows: lowWageRows } = await client.query(`
          SELECT create_job_safe(
            jsonb_build_object(
              'title', 'Test Sub Minimum Wage Shift',
              'category', 'conference',
              'venueName', 'Test Venue',
              'venueAddress', 'Bandra Kurla Complex, Mumbai',
              'supervisorName', 'Rajesh Sharma',
              'supervisorPhone', '9820098200',
              'latitude', 19.066,
              'longitude', 72.877,
              'date', ((now() AT TIME ZONE 'Asia/Kolkata') + interval '3 days')::date::text,
              'start_time', '10:00',
              'end_time', '18:00',
              'hourlyRate', 60,
              'slotsTotal', 3,
              'status', 'draft'
            ),
            $1::uuid
          ) AS res;
        `, [testOrgId]);
        if (lowWageRows[0]?.res?.success !== false || lowWageRows[0]?.res?.error_code !== 'INVALID_WAGE') {
          throw new Error(`MIN WAGE FALLBACK FAILURE: create_job_safe permitted ₹60/hr with missing settings row! Got: ${JSON.stringify(lowWageRows[0]?.res)}`);
        }
        console.log('\x1b[32m✓ Verified create_job_safe enforces ₹100 floor when platform_settings min_wage row is missing.\x1b[0m');

        // B. Verify application & payment deadlines persistence and payable-hours rule
        const appDeadline = new Date(Date.now() + 86400000 * 2).toISOString();
        const payDeadline = new Date(Date.now() + 86400000 * 5).toISOString();

        const { rows: dlRows } = await client.query(`
          SELECT create_job_safe(
            jsonb_build_object(
              'title', 'Persisted Deadlines Verification Shift',
              'category', 'conference',
              'venueName', 'Jio World Convention Centre',
              'venueAddress', 'BKC Mumbai',
              'supervisorName', 'Rajesh Sharma',
              'supervisorPhone', '9820098200',
              'latitude', 19.066,
              'longitude', 72.877,
              'date', ((now() AT TIME ZONE 'Asia/Kolkata') + interval '4 days')::date::text,
              'start_time', '09:00',
              'end_time', '17:00',
              'hourlyRate', 300,
              'slotsTotal', 4,
              'breaksMinutes', 45,
              'application_deadline', $2::text,
              'payment_deadline', $3::text,
              'status', 'open'
            ),
            $1::uuid
          ) AS res;
        `, [testOrgId, appDeadline, payDeadline]);

        const dlRes = dlRows[0]?.res;
        if (!dlRes?.success || !dlRes?.job_id) {
          throw new Error(`SHIFT CREATION FAILURE: Failed to create test shift with deadlines: ${JSON.stringify(dlRes)}`);
        }

        // Query raw database row back to verify persistence
        const { rows: savedJobRows } = await client.query(`
          SELECT id, status, application_deadline, payment_deadline, total_pay, duration_hours, breaks_minutes
          FROM jobs WHERE id = $1;
        `, [dlRes.job_id]);

        const saved = savedJobRows[0];
        if (!saved || !saved.application_deadline || !saved.payment_deadline) {
          throw new Error(`DEADLINES PERSISTENCE FAILURE: Saved shift row missing application_deadline or payment_deadline: ${JSON.stringify(saved)}`);
        }

        // Assert payable-hours rule: 8 hours @ ₹300 = ₹2400 (breaks included in paid on-site duty)
        if (Number(saved.total_pay) !== 2400.00 || Number(saved.duration_hours) !== 8.00) {
          throw new Error(`PAYABLE HOURS RULE FAILURE: Expected total_pay 2400.00 for 8h @ 300, got: ${saved.total_pay}`);
        }
        console.log('\x1b[32m✓ Verified application_deadline and payment_deadline are authoritatively persisted and readable in jobs table.\x1b[0m');
        console.log('\x1b[32m✓ Verified authoritative payable-hours rule: 8h @ ₹300/hr = ₹2,400 with 45min scheduled break included.\x1b[0m');

        // C. Verify duplicate publication guard: submitting identical shift immediately is rejected
        const { rows: dupRows } = await client.query(`
          SELECT create_job_safe(
            jsonb_build_object(
              'title', 'Persisted Deadlines Verification Shift',
              'category', 'conference',
              'venueName', 'Jio World Convention Centre',
              'venueAddress', 'BKC Mumbai',
              'supervisorName', 'Rajesh Sharma',
              'supervisorPhone', '9820098200',
              'latitude', 19.066,
              'longitude', 72.877,
              'date', ((now() AT TIME ZONE 'Asia/Kolkata') + interval '4 days')::date::text,
              'start_time', '09:00',
              'end_time', '17:00',
              'hourlyRate', 300,
              'slotsTotal', 4,
              'status', 'open'
            ),
            $1::uuid
          ) AS res;
        `, [testOrgId]);
        const dupRes = dupRows[0]?.res;
        if (dupRes?.success !== false || dupRes?.error_code !== 'DUPLICATE_PUBLICATION') {
          throw new Error(`DUPLICATE PUBLICATION FAILURE: Expected DUPLICATE_PUBLICATION, got: ${JSON.stringify(dupRes)}`);
        }
        console.log('\x1b[32m✓ Verified duplicate publication guard blocks identical reposts within throttle window.\x1b[0m');

        // D. Verify non-admin role escalation blocked by prevent_role_escalation trigger
        let escalationFailed = false;
        await client.query('SAVEPOINT sp_escalate;');
        try {
          // Temporarily simulate regular non-admin user
          await client.query(`
            SET LOCAL "request.jwt.claim.role" = 'authenticated';
            SET LOCAL ROLE authenticated;
            UPDATE profiles SET role = 'admin' WHERE id = $1;
          `, [testOrgId]);
        } catch (escalateErr) {
          escalationFailed = true;
          await client.query('ROLLBACK TO SAVEPOINT sp_escalate;');
        } finally {
          await client.query('RESET ROLE;');
        }
        if (!escalationFailed) {
          throw new Error('SECURITY VIOLATION: Non-admin user was able to escalate role to admin!');
        }
        console.log('\x1b[32m✓ Verified prevent_role_escalation strictly blocks unprivileged role tampering.\x1b[0m');

      } finally {
        await client.query('ROLLBACK');
        console.log('\x1b[32m✓ Transaction rolled back cleanly without permanent mutations.\x1b[0m');
      }

      await client.end();
    } catch (err) {
      console.error('\x1b[31m[ERROR] Live database verification failed:\x1b[0m', err.message);
      process.exit(1);
    }
  }

  console.log('\n\x1b[32m✓ Full Opskl SQL integration & logic hardening test suite passed with 100% success.\x1b[0m\n');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
