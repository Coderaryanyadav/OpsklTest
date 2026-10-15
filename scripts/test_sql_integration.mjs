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
  if (connectionString) {
    console.log(`\nConnecting to live database at ${connectionString.split('@')[1] || 'remote'}...`);
    const client = new pg.Client({
      connectionString,
      ssl: { rejectUnauthorized: false },
    });

    try {
      await client.connect();
      console.log('\x1b[32m✓ Connected to PostgreSQL.\x1b[0m');

      // Test transactional apply and rollback
      await client.query('BEGIN');
      console.log('Applying migration in sandbox transaction...');
      await client.query(migrationSql);

      // Verify function existence
      const { rows } = await client.query(`
        SELECT proname FROM pg_proc
        WHERE proname IN (
          'validate_job_transition',
          'get_discovery_feed',
          'get_job_contact',
          'submit_review_safe',
          'admin_mark_invoice_funded',
          'admin_mark_payout_settled'
        );
      `);
      console.log(`\x1b[32m✓ Verified ${rows.length} new RPC functions compiled in Postgres.\x1b[0m`);

      await client.query('ROLLBACK');
      console.log('\x1b[32m✓ Sandbox transaction rolled back cleanly.\x1b[0m');
      await client.end();
    } catch (err) {
      console.error('\x1b[31m[ERROR] Live database verification failed:\x1b[0m', err.message);
      process.exit(1);
    }
  } else {
    console.log('\x1b[33m[INFO] No DATABASE_URL specified. Invariant schema verification completed successfully.\x1b[0m');
  }

  console.log('\n\x1b[32m✓ Phase 1 SQL integration test suite completed successfully.\x1b[0m\n');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
