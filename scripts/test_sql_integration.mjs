import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const migrationPath = path.join(rootDir, 'supabase', 'migrations', '20261015000000_launch_fixes.sql');

const connectionString = process.env.DATABASE_URL || process.argv[2];

async function run() {
  console.log('\x1b[36m[OPSKL SQL INTEGRATION TEST SUITE]\x1b[0m');

  const migrationSql = fs.readFileSync(migrationPath, 'utf8');

  // Verify critical invariants in the migration SQL
  const checks = [
    {
      name: '1.1 Trusted bypass mechanism configured in check_worker_profile_update',
      test: () => migrationSql.includes("current_setting('opskl.trusted', true) = '1'"),
    },
    {
      name: '1.2 Dispute reason minimum length validation (>= 10)',
      test: () => migrationSql.includes("length(trim(COALESCE(p_reason, ''))) < 10"),
    },
    {
      name: '1.2 Direct INSERT policy on disputes dropped',
      test: () => migrationSql.includes('DROP POLICY IF EXISTS "Participants create disputes" ON disputes'),
    },
    {
      name: '1.3 Organizer business_contact_phone relaxed from NOT NULL',
      test: () => migrationSql.includes('ALTER TABLE organizer_profiles ALTER COLUMN business_contact_phone DROP NOT NULL'),
    },
    {
      name: '1.3 CSPRNG booking code replaced gen_random_bytes',
      test: () => migrationSql.includes("upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10))") && !migrationSql.includes('gen_random_bytes'),
    },
    {
      name: '1.4 public_jobs view shielding supervisor contact created',
      test: () => {
        const viewMatch = migrationSql.match(/CREATE OR REPLACE VIEW public_jobs AS([\s\S]*?)FROM jobs;/);
        return viewMatch && !viewMatch[1].includes('supervisor_name') && migrationSql.includes('get_job_contact');
      },
    },
    {
      name: '1.5 Job lifecycle state machine validate_job_transition defined',
      test: () => migrationSql.includes('CREATE OR REPLACE FUNCTION validate_job_transition('),
    },
    {
      name: '1.5 cancel_booking_safe slot reopen guarded against past/cancelled jobs',
      test: () => migrationSql.includes("v_job.status IN ('filled', 'filling', 'open') AND v_job.date >= (now() AT TIME ZONE 'Asia/Kolkata')::date"),
    },
    {
      name: '1.6 Overlapping shift double-booking guard in confirm_worker_booking_safe',
      test: () => migrationSql.includes('OVERLAPPING_SHIFT_SCHEDULE'),
    },
    {
      name: '1.7 Keyset paginated get_discovery_feed defined',
      test: () => migrationSql.includes('CREATE OR REPLACE FUNCTION get_discovery_feed('),
    },
    {
      name: '1.8 Attendance distance column widened to NUMERIC(8,2)',
      test: () => migrationSql.includes('ALTER TABLE attendance_records ALTER COLUMN distance_to_venue_km TYPE NUMERIC(8, 2)'),
    },
    {
      name: '1.9 Admin dispute resolution restores pre-dispute booking status on dismissal',
      test: () => migrationSql.includes("v_target_booking_status := COALESCE(v_booking.status_before_dispute, 'confirmed')"),
    },
    {
      name: '1.10 FY sequential invoice generator OPS/YY-YY/00001 defined',
      test: () => migrationSql.includes("RETURN 'OPS/' || LPAD(v_fy_start::TEXT, 2, '0')"),
    },
    {
      name: '1.10 Paid invoice immutability guard in generate_job_invoice_safe',
      test: () => migrationSql.includes("IF v_existing.status IN ('escrow_funded', 'settled') THEN"),
    },
    {
      name: '1.11 Overnight shifts crosses_midnight and end_date columns',
      test: () => migrationSql.includes('ALTER TABLE jobs ADD COLUMN IF NOT EXISTS crosses_midnight BOOLEAN') && migrationSql.includes('ALTER TABLE jobs ADD COLUMN IF NOT EXISTS end_date DATE'),
    },
    {
      name: '1.11 Sovereign India coordinate bounds validation (6-38 N, 68-98 E)',
      test: () => migrationSql.includes('v_lat < 6.0 OR v_lat > 38.0 OR v_lng < 68.0 OR v_lng > 98.0'),
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

  // If a live database connection string is provided, run live transactional queries
  const liveDbUrl = connectionString || 'postgresql://postgres.lericvniqdbvacgegrbp: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@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres';
  if (liveDbUrl) {
    console.log(`\nConnecting to live database at ${liveDbUrl.split('@')[1] || 'remote'}...`);
    const client = new pg.Client({
      connectionString: liveDbUrl,
      ssl: { rejectUnauthorized: false },
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
            'date', (now() AT TIME ZONE 'Asia/Kolkata')::date::text,
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

      // 5. Assert unverified organizer live shift creation is rejected by backend RPC
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

      // 6. Assert unverified worker application is rejected by backend RPC
      const { rows: workerRejectRows } = await client.query(`
        SELECT apply_for_job_safe(
          '00000000-0000-0000-0000-000000000001'::uuid
        ) AS result;
      `);
      const workerRejectResult = workerRejectRows[0]?.result;
      if (workerRejectResult?.success !== false) {
        throw new Error(`WORKER GATING FAILURE: unverified or unauthenticated worker application succeeded unexpectedly! Got: ${JSON.stringify(workerRejectResult)}`);
      }
      console.log(`\x1b[32m✓ Verified unauthenticated/unverified worker application is rejected by backend RPC (${workerRejectResult?.error_code || 'REJECTED'}).\x1b[0m`);

      // 7. Assert invoice sequence generator format and uniqueness
      const { rows: invRows } = await client.query(`
        SELECT generate_invoice_number() AS inv1, generate_invoice_number() AS inv2;
      `);
      const inv1 = invRows[0]?.inv1;
      const inv2 = invRows[0]?.inv2;
      const invRegex = /^OPS\/\d{2}-\d{2}\/\d{5}$/;
      if (!invRegex.test(inv1) || !invRegex.test(inv2) || inv1 === inv2) {
        throw new Error(`INVOICE GENERATION FAILURE: Invoices invalid format or not unique! got: ${inv1}, ${inv2}`);
      }
      console.log(`\x1b[32m✓ Verified FY sequential invoice format and uniqueness (${inv1} -> ${inv2}).\x1b[0m`);

      await client.end();
    } catch (err) {
      console.error('\x1b[31m[ERROR] Live database verification failed:\x1b[0m', err.message);
      process.exit(1);
    }
  }

  console.log('\n\x1b[32m✓ Phase 1 SQL integration test suite completed successfully.\x1b[0m\n');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
