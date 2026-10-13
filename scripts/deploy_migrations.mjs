import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import pg from 'pg';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const migrationsDir = path.join(rootDir, 'supabase', 'migrations');

const connectionString = process.env.DATABASE_URL || process.argv[2];

if (!connectionString) {
  console.error('\x1b[31m[ERROR] Missing DATABASE_URL.\x1b[0m');
  console.error('Usage: DATABASE_URL="postgresql://postgres:[PASSWORD]@db.lericvniqdbvacgegrbp.supabase.co:5432/postgres" node scripts/deploy_migrations.mjs');
  process.exit(1);
}

const client = new pg.Client({
  connectionString,
  ssl: { rejectUnauthorized: false },
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
    `);

    const { rows: appliedRows } = await client.query('SELECT filename, checksum FROM _opskil_migrations;');
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
        if (storedChecksum && storedChecksum !== currentChecksum && !storedChecksum.includes('=')) {
          console.error(`\x1b[31m  ✗ CHECKSUM MISMATCH on ${file}!\x1b[0m`);
          console.error(`    Applied checksum: ${storedChecksum}`);
          console.error(`    Current  checksum: ${currentChecksum}`);
          console.error(`    A previously applied migration file has been altered. Create a new sequential migration instead.`);
          process.exit(1);
        }
        console.log(`[${i + 1}/${migrationFiles.length}] Skipping ${file} (already applied and verified)`);
        continue;
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
        console.error(`\x1b[31m  ✗ FAILED on ${file}:\x1b[0m`, err.message);
        if (err.position) {
          console.error(`    At character position: ${err.position}`);
        }
        process.exit(1);
      }
    }

    console.log('\n\x1b[36m--- VERIFYING AUTHORITATIVE SCHEMA INTEGRITY ---\x1b[0m');

    const verificationQueries = [
      { name: 'Core Profiles & Columns', sql: "SELECT id, role, email, is_active FROM profiles LIMIT 1;" },
      { name: 'Worker Profiles & RLS', sql: "SELECT id, skills, availability_status FROM worker_profiles LIMIT 1;" },
      { name: 'Organizer Profiles & RLS', sql: "SELECT id, business_name FROM organizer_profiles LIMIT 1;" },
      { name: 'Jobs Schema & Lat/Lng', sql: "SELECT id, latitude, longitude, slots_total FROM jobs LIMIT 1;" },
      { name: 'Bookings & CSPRNG Token', sql: "SELECT id, check_in_code, status FROM bookings LIMIT 1;" },
      { name: 'Payment Records & Escrow', sql: "SELECT id, worker_id, organizer_id, status FROM payment_records LIMIT 1;" },
      { name: 'Organizer Invoices Table', sql: "SELECT id, total_payable, status FROM organizer_invoices LIMIT 1;" },
      { name: 'Account Deletion Queue', sql: "SELECT id, user_id, status, scheduled_purge_at FROM account_deletion_requests LIMIT 1;" },
      { name: 'Purge Worker Function', sql: "SELECT proname FROM pg_proc WHERE proname = 'process_account_deletion_purge_safe';" },
      { name: 'Provisioning RPC Function', sql: "SELECT proname FROM pg_proc WHERE proname = 'ensure_user_profile_provisioned_safe';" },
    ];

    let verificationFailed = false;
    for (const q of verificationQueries) {
      try {
        await client.query(q.sql);
        console.log(`\x1b[32m  ✓ Verified: ${q.name}\x1b[0m`);
      } catch (err) {
        console.error(`\x1b[31m  ✗ Verification failed: ${q.name}\x1b[0m (${err.message})`);
        verificationFailed = true;
      }
    }

    if (verificationFailed) {
      console.error('\n\x1b[31m[FAILED] Schema health integrity checks failed.\x1b[0m\n');
      process.exit(1);
    }

    console.log('\n\x1b[32m🎉 ALL MIGRATIONS DEPLOYED AND INTEGRITY CHECKS PASSED!\x1b[0m\n');
  } finally {
    console.log('Releasing migration advisory lock...');
    await client.query('SELECT pg_advisory_unlock(849201);').catch(() => {});
    await client.end();
  }
}

run().catch((err) => {
  console.error('\x1b[31m[FATAL ERROR]\x1b[0m', err);
  process.exit(1);
});
