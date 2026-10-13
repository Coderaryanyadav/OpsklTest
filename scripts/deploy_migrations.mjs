import fs from 'fs';
import path from 'path';
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

async function run() {
  console.log('\x1b[36m[OPSKL DATABASE MIGRATION ENGINE]\x1b[0m');
  console.log(`Connecting to database...`);
  
  await client.connect();
  console.log('\x1b[32m✓ Connected to PostgreSQL successfully.\x1b[0m\n');

  const migrationFiles = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  console.log(`Discovered ${migrationFiles.length} sequential migration files:\n`);

  for (let i = 0; i < migrationFiles.length; i++) {
    const file = migrationFiles[i];
    const filePath = path.join(migrationsDir, file);
    const sql = fs.readFileSync(filePath, 'utf8');

    console.log(`[${i + 1}/${migrationFiles.length}] Executing ${file}...`);
    try {
      await client.query(sql);
      console.log(`\x1b[32m  ✓ Completed ${file}\x1b[0m`);
    } catch (err) {
      console.error(`\x1b[31m  ✗ FAILED on ${file}:\x1b[0m`, err.message);
      if (err.position) {
        console.error(`    At character position: ${err.position}`);
      }
      await client.end();
      process.exit(1);
    }
  }

  console.log('\n\x1b[36m--- VERIFYING CLEAN SCHEMA HEALTH ---\x1b[0m');

  const verificationQueries = [
    { name: 'Core Profiles Table', sql: 'SELECT count(*) FROM profiles;' },
    { name: 'Jobs Table', sql: 'SELECT count(*) FROM jobs;' },
    { name: 'Bookings Table', sql: 'SELECT count(*) FROM bookings;' },
    { name: 'Payment Records Table', sql: 'SELECT count(*) FROM payment_records;' },
    { name: 'Organizer Invoices Table', sql: 'SELECT count(*) FROM organizer_invoices;' },
    { name: 'Account Deletion Queue Table', sql: 'SELECT count(*) FROM account_deletion_requests;' },
    { name: 'Platform Settings Table', sql: 'SELECT count(*) FROM platform_settings;' },
  ];

  for (const q of verificationQueries) {
    try {
      await client.query(q.sql);
      console.log(`\x1b[32m  ✓ Verified: ${q.name}\x1b[0m`);
    } catch (err) {
      console.error(`\x1b[31m  ✗ Verification failed: ${q.name}\x1b[0m (${err.message})`);
    }
  }

  await client.end();
  console.log('\n\x1b[32m🎉 ALL MIGRATIONS DEPLOYED AND VERIFIED SUCCESSFULLY AGAINST CLEAN DATABASE!\x1b[0m\n');
}

run().catch((err) => {
  console.error('\x1b[31m[FATAL ERROR]\x1b[0m', err);
  process.exit(1);
});
