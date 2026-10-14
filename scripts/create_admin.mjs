import pg from 'pg';
import { createClient } from '@supabase/supabase-js';

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres.lericvniqdbvacgegrbp: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@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres';
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://lericvniqdbvacgegrbp.supabase.co';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxlcmljdm5pcWRidmFjZ2VncmJwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MTg5ODIxMCwiZXhwIjoyMTA3NDc0MjEwfQ.4abiWP6a-Q3N1EP704hewgn-OD2s9rgyib1Aa881QSM';

const adminEmail = process.argv[2] || 'admin@opskil.com';
const adminPassword = process.argv[3] || 'AdminOpskil2026!';

const adminClient = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const pgClient = new pg.Client({
  connectionString,
  ssl: { rejectUnauthorized: false },
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
  await pgClient.query('ALTER TABLE profiles ENABLE TRIGGER trg_prevent_role_escalation;');

  console.log('\x1b[32m✓ Administrator provisioned and authorized successfully!\x1b[0m');
  console.log(`\nPortal URL: http://localhost:3000/login`);
  console.log(`Email:      ${adminEmail}`);
  console.log(`Password:   ${adminPassword}\n`);

  await pgClient.end();
}

run().catch((err) => {
  console.error('\x1b[31m[ERROR]\x1b[0m', err.message || err);
  process.exit(1);
});
