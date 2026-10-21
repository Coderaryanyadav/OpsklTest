import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import pg from 'pg';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const migrationsDir = path.join(rootDir, 'supabase', 'migrations');

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

if (!connectionString) {
  console.error('\x1b[31m[ERROR] Missing DATABASE_URL.\x1b[0m');
  console.error('Usage: DATABASE_URL="postgresql://postgres:[PASSWORD]@[HOST]:[PORT]/[DBNAME]" node scripts/deploy_migrations.mjs');
  process.exit(1);
}

// Target database host safety verification
const parsedDbUrl = new URL(connectionString.replace(/^postgresql:\/\//, 'http://'));
const isLocalDb = ['localhost', '127.0.0.1'].includes(parsedDbUrl.hostname);

if (process.env.NODE_ENV === 'production' && !isLocalDb) {
  if (process.env.CONFIRM_PRODUCTION_MIGRATION !== 'true') {
    console.error('\x1b[31m[PRODUCTION DEPLOYMENT GUARD BLOCKED EXECUTION]\x1b[0m');
    console.error(`Database target '${parsedDbUrl.hostname}' is a remote production database.`);
    console.error('To apply migrations to production, you must explicitly confirm:');
    console.error('  CONFIRM_PRODUCTION_MIGRATION=true');
    process.exit(1);
  }
}

const rejectUnauthorized = process.env.DATABASE_SSL_REJECT_UNAUTHORIZED === 'true';
const client = new pg.Client({
  connectionString,
  ssl: isLocalDb ? false : { rejectUnauthorized },
});

function calculateSha256(content) {
  return crypto.createHash('sha256').update(content, 'utf8').digest('hex');
}

async function run() {
  console.log('\x1b[36m[OPSKL DATABASE MIGRATION ENGINE]\x1b[0m');
  console.log(`Connecting to database...`);
  
  await client.connect();
  console.log('\x1b[32m✓ Connected to PostgreSQL successfully.\x1b[0m\n');

  // 1. Acquire migration advisory lock to prevent concurrent deployment races
  console.log('Acquiring migration advisory lock...');
  await client.query('SELECT pg_advisory_lock(849201);');
  console.log('\x1b[32m✓ Migration lock acquired.\x1b[0m\n');

  try {
    // 2. Initialize migration history table with sha256 checksum tracking
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

    let { rows: appliedRows } = await client.query('SELECT filename, checksum FROM _opskil_migrations;');

    // If _opskil_migrations is newly created on an existing initialized database,
    // backfill baseline migration history ONLY when explicitly authorized and verified against schema fingerprint.
    if (appliedRows.length === 0) {
      const { rows: tableCheck } = await client.query("SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'profiles';");
      if (tableCheck.length > 0) {
        if (process.env.ALLOW_BASELINE_RECONCILIATION !== 'true') {
          console.error('\x1b[31m[ERROR] Detected pre-existing tables without migration ledger.\x1b[0m');
          console.error('To reconcile historical migrations against an existing initialized database, you must:');
          console.error('1. Independently prove the schema matches baseline release specifications.');
          console.error('2. Explicitly provide: ALLOW_BASELINE_RECONCILIATION=true');
          console.error('Failing closed to prevent unverified migration history insertion.\n');
          process.exit(1);
        }

        // Schema Fingerprint Verification: Comprehensive validation of tables, columns, RLS and compiled functions
        const requiredEntities = [
          'profiles', 'worker_profiles', 'organizer_profiles', 'jobs', 
          'bookings', 'attendance_records', 'payment_records', 'organizer_invoices', 'disputes'
        ];
        const { rows: foundTables } = await client.query(
          "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = ANY($1);",
          [requiredEntities]
        );
        const foundSet = new Set(foundTables.map((r) => r.table_name));
        const missing = requiredEntities.filter((t) => !foundSet.has(t));
        if (missing.length > 0) {
          console.error(`\x1b[31m[FINGERPRINT MISMATCH] Missing baseline tables: ${missing.join(', ')}\x1b[0m`);
          process.exit(1);
        }

        // 1. Column-level schema fingerprint
        const requiredColumns = [
          { table: 'jobs', col: 'slots_filled' },
          { table: 'jobs', col: 'slots_total' },
          { table: 'jobs', col: 'latitude' },
          { table: 'jobs', col: 'longitude' },
          { table: 'bookings', col: 'check_in_code' },
          { table: 'bookings', col: 'status' },
          { table: 'profiles', col: 'is_active' },
        ];
        for (const item of requiredColumns) {
          const { rows: colCheck } = await client.query(
            "SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2;",
            [item.table, item.col]
          );
          if (colCheck.length === 0) {
            console.error(`\x1b[31m[FINGERPRINT MISMATCH] Missing required baseline column: ${item.table}.${item.col}\x1b[0m`);
            process.exit(1);
          }
        }

        // 2. RLS security fingerprint
        const { rows: rlsCheck } = await client.query(
          "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename = ANY($1) AND rowsecurity = true;",
          [requiredEntities]
        );
        if (rlsCheck.length < requiredEntities.length) {
          const rlsSet = new Set(rlsCheck.map((r) => r.tablename));
          const unshielded = requiredEntities.filter((t) => !rlsSet.has(t));
          console.error(`\x1b[31m[FINGERPRINT MISMATCH] RLS disabled on required baseline tables: ${unshielded.join(', ')}\x1b[0m`);
          process.exit(1);
        }

        // 3. Functions fingerprint
        const requiredFunctions = ['is_current_admin', 'worker_confirm_selection_safe', 'check_in_with_pin_safe'];
        const { rows: procCheck } = await client.query(
          "SELECT proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND proname = ANY($1);",
          [requiredFunctions]
        );
        const procSet = new Set(procCheck.map((r) => r.proname));
        const missingProcs = requiredFunctions.filter((f) => !procSet.has(f));
        if (missingProcs.length > 0) {
          console.error(`\x1b[31m[FINGERPRINT MISMATCH] Missing required baseline functions in pg_proc: ${missingProcs.join(', ')}\x1b[0m`);
          process.exit(1);
        }

        console.log('Comprehensive schema fingerprint (tables, columns, RLS, functions) verified. Authorized baseline reconciliation in progress...');

        const migrationFiles = fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();
        for (const f of migrationFiles) {
          if (f < '20261017000000') {
            const sql = fs.readFileSync(path.join(migrationsDir, f), 'utf8');
            const checksum = calculateSha256(sql);
            await client.query('INSERT INTO _opskil_migrations (filename, checksum) VALUES ($1, $2) ON CONFLICT (filename) DO NOTHING;', [f, checksum]);
          }
        }
        const refreshed = await client.query('SELECT filename, checksum FROM _opskil_migrations;');
        appliedRows = refreshed.rows;
        console.log(`\x1b[32m✓ Reconciled ${appliedRows.length} verified baseline migration records in _opskil_migrations.\x1b[0m\n`);
      }
    }

    const appliedMap = new Map(appliedRows.map((r) => [r.filename, r.checksum]));

    const migrationFiles = fs
      .readdirSync(migrationsDir)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    console.log(`Discovered ${migrationFiles.length} sequential migration files:\n`);

    for (let i = 0; i < migrationFiles.length; i++) {
      const file = migrationFiles[i];
      const filePath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(filePath, 'utf8');
      const currentChecksum = calculateSha256(sql);

      if (appliedMap.has(file)) {
        const storedChecksum = appliedMap.get(file);
        // Strict SHA-256 validation: if stored checksum is legacy Base64 or mismatched, reconcile or fail closed
        if (storedChecksum) {
          if (storedChecksum === currentChecksum) {
            console.log(`[${i + 1}/${migrationFiles.length}] Skipping ${file} (verified SHA-256: ${currentChecksum.slice(0, 10)}...)`);
            continue;
          }

          // If legacy Base64 format was previously recorded, upgrade it to current verified SHA-256
          const isLegacyBase64 = storedChecksum === Buffer.from(file).toString('base64');
          if (isLegacyBase64) {
            console.log(`[${i + 1}/${migrationFiles.length}] Upgrading legacy Base64 checksum for ${file} to SHA-256...`);
            await client.query('UPDATE _opskil_migrations SET checksum = $1 WHERE filename = $2', [currentChecksum, file]);
            continue;
          }

          throw new Error(`CHECKSUM MISMATCH on ${file}! Applied checksum (${storedChecksum}) does not match current file digest (${currentChecksum}). Create a new sequential migration instead of modifying applied files.`);
        }
      }

      console.log(`[${i + 1}/${migrationFiles.length}] Executing ${file}...`);
      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query('INSERT INTO _opskil_migrations (filename, checksum) VALUES ($1, $2)', [
          file,
          currentChecksum,
        ]);
        await client.query('COMMIT');
        console.log(`\x1b[32m  ✓ Completed and committed ${file} [SHA-256: ${currentChecksum.slice(0, 10)}...]\x1b[0m`);
      } catch (err) {
        await client.query('ROLLBACK');
        if (err.position) {
          console.error(`    At character position: ${err.position}`);
        }
        throw new Error(`Failed to apply migration ${file}: ${err.message}`);
      }
    }

    console.log('\n\x1b[36m--- VERIFYING AUTHORITATIVE SCHEMA INTEGRITY ---\x1b[0m');

    const verificationQueries = [
      { name: 'Core Profiles & Columns', sql: "SELECT id, role, email, is_active FROM profiles LIMIT 1;" },
      { name: 'Worker Profiles & Table Access', sql: "SELECT id, skills, availability_status FROM worker_profiles LIMIT 1;" },
      { name: 'Organizer Profiles & Table Access', sql: "SELECT id, business_name FROM organizer_profiles LIMIT 1;" },
      { name: 'Jobs Schema & Lat/Lng', sql: "SELECT id, latitude, longitude, slots_total FROM jobs LIMIT 1;" },
      { name: 'Bookings & CSPRNG Token', sql: "SELECT id, check_in_code, status FROM bookings LIMIT 1;" },
      { name: 'Payment Records & Escrow', sql: "SELECT id, worker_id, organizer_id, status FROM payment_records LIMIT 1;" },
      { name: 'Organizer Invoices Table', sql: "SELECT id, total_payable, status FROM organizer_invoices LIMIT 1;" },
      { name: 'Account Deletion Queue', sql: "SELECT id, user_id, status, scheduled_purge_at FROM account_deletion_requests LIMIT 1;" },
      {
        name: 'Purge Worker Function Presence & Definer',
        sql: "SELECT proname, prosecdef FROM pg_proc WHERE proname = 'process_account_deletion_purge_safe';",
        validate: (res) => {
          if (!res.rows || res.rows.length === 0) throw new Error('Function not found in pg_proc');
          if (res.rows[0].prosecdef !== true) throw new Error('Function must be SECURITY DEFINER (prosecdef=true)');
        },
      },
      {
        name: 'Provisioning RPC Function Presence & Definer',
        sql: "SELECT proname, prosecdef FROM pg_proc WHERE proname = 'ensure_user_profile_provisioned_safe';",
        validate: (res) => {
          if (!res.rows || res.rows.length === 0) throw new Error('Function not found in pg_proc');
          if (res.rows[0].prosecdef !== true) throw new Error('Function must be SECURITY DEFINER (prosecdef=true)');
        },
      },
      {
        name: 'Row-Level Security Enabled on Core Tables',
        sql: "SELECT relname, relrowsecurity FROM pg_class WHERE relname IN ('profiles', 'worker_profiles', 'organizer_profiles', 'jobs', 'bookings', 'attendance_records', 'payment_records');",
        validate: (res) => {
          const expectedTables = ['profiles', 'worker_profiles', 'organizer_profiles', 'jobs', 'bookings', 'attendance_records', 'payment_records'];
          const found = new Set(res.rows.filter((r) => r.relrowsecurity === true).map((r) => r.relname));
          for (const tbl of expectedTables) {
            if (!found.has(tbl)) throw new Error(`RLS is not enabled or table missing for ${tbl}`);
          }
        },
      },
    ];

    let verificationFailed = false;
    for (const q of verificationQueries) {
      try {
        const res = await client.query(q.sql);
        if (q.validate) {
          q.validate(res);
        }
        console.log(`\x1b[32m  ✓ Verified: ${q.name}\x1b[0m`);
      } catch (err) {
        console.error(`\x1b[31m  ✗ Verification failed: ${q.name}\x1b[0m (${err.message})`);
        verificationFailed = true;
      }
    }

    if (verificationFailed) {
      throw new Error('One or more schema health verification checks failed.');
    }

    console.log('\n\x1b[32m🎉 ALL MIGRATIONS DEPLOYED AND INTEGRITY CHECKS PASSED!\x1b[0m\n');
  } finally {
    console.log('Releasing migration advisory lock...');
    await client.query('SELECT pg_advisory_unlock(849201);').catch(() => {});
    await client.end();
  }
}

run().catch((err) => {
  console.error('\x1b[31m[FATAL ERROR]\x1b[0m', err.message || err);
  process.exit(1);
});
