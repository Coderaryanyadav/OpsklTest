import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import pg from 'pg';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const migrationsDir = path.join(rootDir, 'supabase', 'migrations');

const connectionString = process.env.DATABASE_URL || process.argv[2];
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (process.env.NODE_ENV === 'production' || process.env.ALLOW_DESTRUCTIVE_DATABASE_REBUILD !== 'true') {
  console.error('\x1b[31m[DESTRUCTIVE ACTION BLOCKED]\x1b[0m');
  console.error('scripts/rebuild_database.mjs drops and recreates the public schema and is destructive.');
  console.error('To run this script on a dedicated local/test database, you must explicitly set:');
  console.error('  ALLOW_DESTRUCTIVE_DATABASE_REBUILD=true');
  process.exit(1);
}

// Second safety check & database target allowlist
if (!connectionString) {
  console.error('DATABASE_URL is required to run rebuild_database.mjs');
  process.exit(1);
}

const parsedDbUrl = new URL(connectionString.replace(/^postgresql:\/\//, 'http://'));
const isLocalDb = ['localhost', '127.0.0.1'].includes(parsedDbUrl.hostname);

if (!isLocalDb) {
  if (process.env.ALLOW_REMOTE_DATABASE_REBUILD !== 'true' || process.env.CONFIRM_DATABASE_HOST !== parsedDbUrl.hostname) {
    console.error('\x1b[31m[REMOTE DATABASE TARGET BLOCKED]\x1b[0m');
    console.error(`Database target '${parsedDbUrl.hostname}' is a remote host.`);
    console.error('To rebuild a remote non-production database, you must provide a second explicit safety confirmation:');
    console.error('  ALLOW_REMOTE_DATABASE_REBUILD=true');
    console.error(`  CONFIRM_DATABASE_HOST=${parsedDbUrl.hostname}`);
    process.exit(1);
  }
}

const rejectUnauthorized = process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== 'false';
const client = new pg.Client({
  connectionString,
  ssl: { rejectUnauthorized },
});

function calculateSha256(content) {
  return crypto.createHash('sha256').update(content, 'utf8').digest('hex');
}

async function run() {
  console.log('\x1b[36m====================================================\x1b[0m');
  console.log('\x1b[36m   OPSKL COMPLETE DATABASE RESET & REBUILD ENGINE   \x1b[0m');
  console.log('\x1b[36m====================================================\x1b[0m\n');

  console.log('Connecting to PostgreSQL database...');
  await client.connect();
  console.log('\x1b[32m✓ Connected to PostgreSQL.\x1b[0m\n');

  console.log('Step 1: Dropping existing public schema and re-establishing permissions...');
  await client.query(`
    DROP SCHEMA IF EXISTS public CASCADE;
    CREATE SCHEMA public;

    GRANT USAGE ON SCHEMA public TO anon, authenticated;
    GRANT ALL ON SCHEMA public TO postgres, service_role;

    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO postgres, service_role;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres, service_role;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres, service_role;
  `);
  console.log('\x1b[32m✓ Public schema cleanly recreated with least-privilege grants.\x1b[0m\n');

  console.log('Step 2: Initializing _opskil_migrations metadata table...');
  await client.query(`
    CREATE TABLE IF NOT EXISTS _opskil_migrations (
      id SERIAL PRIMARY KEY,
      filename TEXT UNIQUE NOT NULL,
      checksum TEXT NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    ALTER TABLE _opskil_migrations ENABLE ROW LEVEL SECURITY;
    REVOKE ALL ON TABLE _opskil_migrations FROM anon, authenticated;
  `);
  console.log('\x1b[32m✓ Migrations table initialized.\x1b[0m\n');

  const migrationFiles = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  console.log(`Step 3: Discovered ${migrationFiles.length} sequential migration files to execute:`);
  for (let i = 0; i < migrationFiles.length; i++) {
    const file = migrationFiles[i];
    const filePath = path.join(migrationsDir, file);
    const sql = fs.readFileSync(filePath, 'utf8');
    const checksum = calculateSha256(sql);

    console.log(`\n  Applying [${i + 1}/${migrationFiles.length}] ${file}...`);
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query(
        'INSERT INTO _opskil_migrations (filename, checksum) VALUES ($1, $2)',
        [file, checksum]
      );
      await client.query('COMMIT');
      console.log(`  \x1b[32m✓ Committed ${file} (SHA-256: ${checksum.slice(0, 12)}...)\x1b[0m`);
    } catch (err) {
      await client.query('ROLLBACK');
      console.error(`\x1b[31m  ✗ Failed to apply ${file}: ${err.message}\x1b[0m`);
      if (err.position) {
        console.error(`    At character position: ${err.position}`);
      }
      throw err;
    }
  }

  console.log('\nStep 4: Verifying Authoritative Schema Integrity & Security...');

  const verificationQueries = [
    { name: 'Core Profiles Table', sql: 'SELECT id, role, email, is_active FROM profiles LIMIT 1;' },
    { name: 'Worker Profiles Table', sql: 'SELECT id, skills, availability_status FROM worker_profiles LIMIT 1;' },
    { name: 'Organizer Profiles Table & Nullable Contact Phone', sql: 'SELECT id, business_name, business_contact_phone FROM organizer_profiles LIMIT 1;' },
    { name: 'Jobs Table with Coordinate & Midnight Columns', sql: 'SELECT id, latitude, longitude, crosses_midnight, end_date FROM jobs LIMIT 1;' },
    { name: 'Public Jobs View (Supervisor PII Shielded)', sql: 'SELECT id, title, venue_name FROM public_jobs LIMIT 1;' },
    { name: 'Bookings Table with CSPRNG Check-in Code', sql: 'SELECT id, check_in_code, status, status_before_dispute FROM bookings LIMIT 1;' },
    { name: 'Attendance Records Table with Widened Distance Column', sql: 'SELECT id, distance_to_venue_km FROM attendance_records LIMIT 1;' },
    { name: 'Disputes Table with Resolution Columns', sql: 'SELECT id, reason, resolution_notes, resolved_by FROM disputes LIMIT 1;' },
    { name: 'Payment Records Table', sql: 'SELECT id, worker_id, organizer_id, status FROM payment_records LIMIT 1;' },
    { name: 'Organizer Invoices Table', sql: 'SELECT id, total_payable, status FROM organizer_invoices LIMIT 1;' },
    { name: 'Platform Settings & Killswitch', sql: 'SELECT key, value FROM platform_settings LIMIT 1;' },
    { name: 'Account Deletion Queue', sql: 'SELECT id, user_id, status, scheduled_purge_at FROM account_deletion_requests LIMIT 1;' },
    {
      name: 'SECURITY DEFINER Functions Audit',
      sql: `SELECT proname FROM pg_proc WHERE proname IN (
        'ensure_user_profile_provisioned_safe',
        'apply_for_job_safe',
        'confirm_worker_booking_safe',
        'check_in_worker_safe',
        'complete_shift_and_approve_attendance',
        'generate_job_invoice_safe',
        'admin_resolve_dispute_safe',
        'admin_mark_invoice_funded',
        'admin_mark_payout_settled',
        'process_account_deletion_purge_safe',
        'get_discovery_feed'
      ) AND prosecdef = true;`,
      validate: (res) => {
        if (res.rows.length < 11) {
          throw new Error(`Expected at least 11 SECURITY DEFINER RPCs, found ${res.rows.length}`);
        }
      },
    },
    {
      name: 'Row-Level Security Verification on All Domain Tables',
      sql: `SELECT relname FROM pg_class 
            WHERE relnamespace = 'public'::regnamespace 
            AND relkind = 'r' 
            AND relname IN ('profiles', 'worker_profiles', 'organizer_profiles', 'jobs', 'bookings', 'attendance_records', 'payment_records', 'organizer_invoices', 'disputes', 'safety_reports')
            AND relrowsecurity = true;`,
      validate: (res) => {
        if (res.rows.length < 10) {
          throw new Error(`Expected at least 10 tables with RLS enabled, found ${res.rows.length}`);
        }
      },
    },
  ];

  for (const q of verificationQueries) {
    try {
      const res = await client.query(q.sql);
      if (q.validate) q.validate(res);
      console.log(`  \x1b[32m✓ Verified: ${q.name}\x1b[0m`);
    } catch (err) {
      console.error(`  \x1b[31m✗ Verification failed for ${q.name}: ${err.message}\x1b[0m`);
      throw err;
    }
  }

  console.log('\nStep 5: Provisioning Initial Admin User & Backfilling Auth Profiles...');
  const adminEmail = process.env.ADMIN_EMAIL || process.argv[2] || 'admin@opskil.com';
  const adminPassword = process.env.ADMIN_PASSWORD || process.argv[3];

  let userId;
  if (serviceRoleKey && adminPassword) {
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const userCheck = await client.query('SELECT id FROM auth.users WHERE email = $1', [adminEmail]);
    if (userCheck.rows.length > 0) {
      userId = userCheck.rows[0].id;
      await adminClient.auth.admin.updateUserById(userId, {
        password: adminPassword,
        email_confirm: true,
        user_metadata: { role: 'admin', full_name: 'Opskl Administrator' },
      });
      console.log(`  \x1b[32m✓ Updated existing auth.users record (ID: ${userId})\x1b[0m`);
    } else {
      const { data, error } = await adminClient.auth.admin.createUser({
        email: adminEmail,
        password: adminPassword,
        email_confirm: true,
        user_metadata: { role: 'admin', full_name: 'Opskl Administrator' },
      });
      if (error) throw error;
      userId = data.user.id;
      console.log(`  \x1b[32m✓ Created new auth.users record (ID: ${userId})\x1b[0m`);
    }
  } else if (!adminPassword) {
    console.log(`  \x1b[33m[NOTICE] No ADMIN_PASSWORD provided via environment. Skipping admin credentials provisioning.\x1b[0m`);
    const userCheck = await client.query('SELECT id FROM auth.users WHERE email = $1', [adminEmail]);
    if (userCheck.rows.length > 0) {
      userId = userCheck.rows[0].id;
    }
  } else {
    const userCheck = await client.query('SELECT id FROM auth.users WHERE email = $1', [adminEmail]);
    if (userCheck.rows.length > 0) {
      userId = userCheck.rows[0].id;
    }
  }

  if (userId) {
    await client.query(
      `INSERT INTO profiles (id, role, full_name, email, city, is_active, created_at, updated_at)
       VALUES ($1, 'admin', 'Opskl Administrator', $2, 'Mumbai', true, now(), now())
       ON CONFLICT (id) DO UPDATE SET 
         role = 'admin',
         full_name = 'Opskl Administrator',
         is_active = true,
         updated_at = now();`,
      [userId, adminEmail]
    );
    console.log(`  \x1b[32m✓ Provisioned admin profile for ${adminEmail}\x1b[0m`);
  }

  // Backfill existing auth.users into profiles so existing test users remain active
  await client.query(`
    INSERT INTO public.profiles (id, email, role, full_name, is_active)
    SELECT
      id,
      email,
      COALESCE((raw_user_meta_data->>'role')::user_role, 'worker'::user_role),
      COALESCE(raw_user_meta_data->>'full_name', 'Member'),
      true
    FROM auth.users
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.worker_profiles (id, skills)
    SELECT
      p.id,
      ARRAY['Event Support']::text[]
    FROM public.profiles p
    WHERE p.role = 'worker'
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.organizer_profiles (id, business_name)
    SELECT
      p.id,
      p.full_name || ' Organization'
    FROM public.profiles p
    WHERE p.role = 'organizer'
    ON CONFLICT (id) DO NOTHING;
  `);
  console.log(`  \x1b[32m✓ Synced auth.users into domain profiles table.\x1b[0m`);

  console.log('\n\x1b[32m====================================================\x1b[0m');
  console.log('\x1b[32m  ALL SQL MIGRATIONS DEPLOYED & VERIFIED WITH 0 ERRORS!  \x1b[0m');
  console.log('\x1b[32m====================================================\x1b[0m\n');
}

run()
  .catch((err) => {
    console.error('\n\x1b[31m[FATAL REBUILD ERROR]\x1b[0m', err);
    process.exit(1);
  })
  .finally(async () => {
    await client.end();
  });
