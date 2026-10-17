import pg from 'pg';
import { createClient } from '@supabase/supabase-js';

const connectionString = process.env.DATABASE_URL;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!connectionString || !supabaseUrl || !serviceRoleKey) {
  console.error('\x1b[31m[ERROR] Missing required environment variables:\x1b[0m');
  console.error('Please ensure DATABASE_URL, NEXT_PUBLIC_SUPABASE_URL, and SUPABASE_SERVICE_ROLE_KEY are set.');
  process.exit(1);
}

const adminEmail = process.argv[2] || process.env.ADMIN_EMAIL || 'admin@opskil.com';
const adminPassword = process.argv[3] || process.env.ADMIN_PASSWORD;

if (!adminPassword) {
  console.error('\x1b[31m[ERROR] Admin password must be provided via argument or ADMIN_PASSWORD environment variable.\x1b[0m');
  process.exit(1);
}

const adminClient = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const rejectUnauthorized = process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== 'false';
const pgClient = new pg.Client({
  connectionString,
  ssl: { rejectUnauthorized },
});

async function run() {
  console.log('\x1b[36m[OPSKL ADMIN PROVISIONING ENGINE]\x1b[0m');
  console.log(`Target Email: ${adminEmail}`);

  await pgClient.connect();

  // 1. Check if user exists in auth.users
  const userCheck = await pgClient.query('SELECT id FROM auth.users WHERE email = $1', [adminEmail]);
  let userId;

  if (userCheck.rows.length > 0) {
    userId = userCheck.rows[0].id;
    console.log(`Found existing auth record (ID: ${userId}). Updating password & metadata...`);
    const { error } = await adminClient.auth.admin.updateUserById(userId, {
      password: adminPassword,
      email_confirm: true,
      user_metadata: { role: 'admin', full_name: 'Opskl Administrator' },
    });
    if (error) throw error;
  } else {
    console.log('Creating new user in auth.users...');
    const { data, error } = await adminClient.auth.admin.createUser({
      email: adminEmail,
      password: adminPassword,
      email_confirm: true,
      user_metadata: { role: 'admin', full_name: 'Opskl Administrator' },
    });
    if (error) throw error;
    userId = data.user.id;
  }

  // 2. Authoritatively elevate role in profiles table (bypassing user-level role escalation trigger)
  console.log('Elevating profile role to admin in PostgreSQL...');
  try {
    await pgClient.query('ALTER TABLE profiles DISABLE TRIGGER trg_prevent_role_escalation;');
    await pgClient.query(
      `INSERT INTO profiles (id, role, full_name, email, city, is_active, created_at, updated_at)
       VALUES ($1, 'admin', 'Opskl Administrator', $2, 'Mumbai', true, now(), now())
       ON CONFLICT (id) DO UPDATE SET 
         role = 'admin',
         full_name = 'Opskl Administrator',
         is_active = true,
         updated_at = now();`,
      [userId, adminEmail]
    );
  } finally {
    try {
      await pgClient.query('ALTER TABLE profiles ENABLE TRIGGER trg_prevent_role_escalation;');
    } catch (e) {
      console.error('Warning: Failed to re-enable trg_prevent_role_escalation trigger:', e.message);
    }
  }

  console.log('\x1b[32m✓ Administrator provisioned and authorized successfully!\x1b[0m');
  console.log(`\nPortal URL: http://localhost:3000/login`);
  console.log(`Email:      ${adminEmail}`);
  console.log(`Password:   [CONFIGURED SECURELY]\n`);

  await pgClient.end();
}

run().catch((err) => {
  console.error('\x1b[31m[ERROR]\x1b[0m', err.message || err);
  process.exit(1);
});
