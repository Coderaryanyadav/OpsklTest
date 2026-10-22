#!/usr/bin/env node
/**
 * Deterministic, disposable fixtures for the local Docker/Supabase test stack.
 *
 * Creates three real Supabase Auth users (worker, organizer, admin), provisions
 * their role profiles through the real auth trigger, submits synthetic KYC cases,
 * approves them through the admin RPC, and publishes one open shift.
 *
 * No production data, real identities, real payments, SMS, or email are used.
 * The script refuses to run against a non-loopback Supabase URL.
 */
import { createClient } from '@supabase/supabase-js';
import pg from 'pg';

const url = process.env.SUPABASE_URL || process.env.TEST_API_URL;
const anonKey = process.env.SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !anonKey || !serviceKey) {
  console.error('Missing SUPABASE_URL, SUPABASE_ANON_KEY, or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(2);
}
const parsed = new URL(url);
if (!['127.0.0.1', 'localhost', 'opskl-test-api'].includes(parsed.hostname)) {
  console.error(`Refusing non-loopback Supabase URL host: ${parsed.hostname}`);
  process.exit(2);
}

const service = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const accounts = {
  admin: {
    email: process.env.ADMIN_EMAIL || 'admin@test.opskil.local',
    password: process.env.ADMIN_PASSWORD || 'OpsklTestAdmin!2026',
    role: 'admin',
    fullName: 'Docker Test Admin',
    phone: '9000000100',
  },
  worker: {
    email: process.env.WORKER_EMAIL || 'worker@test.opskil.local',
    password: process.env.WORKER_PASSWORD || 'OpsklTestWorker!2026',
    role: 'worker',
    fullName: 'Docker Test Worker',
    phone: '9000000101',
  },
  organizer: {
    email: process.env.ORGANIZER_EMAIL || 'organizer@test.opskil.local',
    password: process.env.ORGANIZER_PASSWORD || 'OpsklTestOrganizer!2026',
    role: 'organizer',
    fullName: 'Docker Test Events',
    phone: '9000000102',
  },
};

const TEST_DOMAIN = '@test.opskil.local';

function fail(where, error) {
  console.error(`FAIL ${where}: ${error?.message || error}`);
  process.exit(1);
}

async function listTestUsers() {
  const testUsers = [];
  let page = 1;
  for (;;) {
    const { data, error } = await service.auth.admin.listUsers({ page, perPage: 100 });
    if (error) fail('listUsers', error);
    const users = data?.users || [];
    testUsers.push(...users.filter((user) => user.email?.endsWith(TEST_DOMAIN)));
    if (users.length < 100) break;
    page += 1;
  }
  return testUsers;
}

async function cleanupTestData(userIds) {
  if (userIds.length === 0) return;
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) fail('cleanup', 'DATABASE_URL is required for idempotent cleanup');
  const parsedDb = new URL(databaseUrl);
  if (!['127.0.0.1', 'localhost', 'opskl-test-db'].includes(parsedDb.hostname) || parsedDb.pathname !== '/postgres') {
    fail('cleanup', `refusing non-disposable database host: ${parsedDb.hostname}${parsedDb.pathname}`);
  }

  const db = new pg.Client({ connectionString: databaseUrl });
  await db.connect();
  try {
    await db.query('BEGIN');
    // Delete RESTRICT children before parents; this keeps the seed idempotent
    // without truncating unrelated platform data.
    await db.query('DELETE FROM payment_records WHERE worker_id = ANY($1::uuid[]) OR organizer_id = ANY($1::uuid[])', [userIds]);
    await db.query('DELETE FROM disputes WHERE raised_by = ANY($1::uuid[]) OR respondent_id = ANY($1::uuid[]) OR assigned_to = ANY($1::uuid[]) OR resolved_by = ANY($1::uuid[])', [userIds]);
    await db.query('DELETE FROM attendance_records WHERE worker_id = ANY($1::uuid[]) OR supervisor_id = ANY($1::uuid[])', [userIds]);
    await db.query('DELETE FROM organizer_invoices WHERE organizer_id = ANY($1::uuid[])', [userIds]);
    await db.query('DELETE FROM bookings WHERE worker_id = ANY($1::uuid[]) OR organizer_id = ANY($1::uuid[]) OR cancelled_by = ANY($1::uuid[])', [userIds]);
    await db.query('DELETE FROM jobs WHERE organizer_id = ANY($1::uuid[])', [userIds]);
    await db.query('UPDATE verification_cases SET reviewed_by = NULL WHERE reviewed_by = ANY($1::uuid[])', [userIds]);
    await db.query('UPDATE payment_reconciliation_logs SET actor_id = NULL WHERE actor_id = ANY($1::uuid[])', [userIds]);
    await db.query('UPDATE platform_settings SET updated_by = NULL WHERE updated_by = ANY($1::uuid[])', [userIds]);
    await db.query('DELETE FROM profiles WHERE id = ANY($1::uuid[])', [userIds]);
    await db.query('COMMIT');
  } catch (error) {
    await db.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    await db.end();
  }
}

async function deleteExistingTestUsers(users) {
  for (const user of users) {
    const { error: delError } = await service.auth.admin.deleteUser(user.id);
    if (delError) fail(`deleteUser ${user.email}`, delError);
  }
}

async function createAccount(account) {
  const metadataRole = account.role === 'admin' ? 'worker' : account.role;
  const { data, error } = await service.auth.admin.createUser({
    email: account.email,
    password: account.password,
    email_confirm: true,
    user_metadata: {
      role: metadataRole,
      full_name: account.fullName,
      phone: account.phone,
    },
  });
  if (error) fail(`createUser ${account.email}`, error);
  return data.user.id;
}

function client() {
  return createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function signIn(account) {
  const supabase = client();
  const { error } = await supabase.auth.signInWithPassword({
    email: account.email,
    password: account.password,
  });
  if (error) fail(`signIn ${account.email}`, error);
  return supabase;
}

function kolkataDate(daysAhead) {
  const d = new Date(Date.now() + daysAhead * 86400000);
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

async function main() {
  const existingUsers = await listTestUsers();
  await cleanupTestData(existingUsers.map((u) => u.id));
  await deleteExistingTestUsers(existingUsers);

  const adminId = await createAccount(accounts.admin);
  const workerId = await createAccount(accounts.worker);
  const organizerId = await createAccount(accounts.organizer);

  // The auth trigger deliberately converts admin metadata to worker.
  // Promotion is performed with the local service-role key, never by a client.
  const { data: promoted, error: promoteError } = await service
    .from('profiles')
    .update({ role: 'admin', full_name: accounts.admin.fullName, is_active: true })
    .eq('id', adminId)
    .select('id, role, is_active')
    .single();
  if (promoteError || promoted?.role !== 'admin') fail('promote admin', promoteError || 'role not admin');

  const admin = await signIn(accounts.admin);
  const worker = await signIn(accounts.worker);
  const organizer = await signIn(accounts.organizer);

  const { error: workerProfileError } = await worker
    .from('worker_profiles')
    .update({
      preferred_locality: 'BKC',
      skills: ['hospitality', 'crowd management'],
      availability_status: 'available',
      profile_completion_status: 'completed',
      upi_id: 'dockerworker@upi',
    })
    .eq('id', workerId);
  if (workerProfileError) fail('worker profile onboarding', workerProfileError);

  const { error: organizerProfileError } = await organizer
    .from('organizer_profiles')
    .update({
      business_name: 'Docker Test Events Pvt Ltd',
      business_type: 'event_agency',
      business_contact_phone: accounts.organizer.phone,
      business_contact_email: accounts.organizer.email,
      billing_address: 'BKC, Mumbai',
      gstin: '27AAAAA0000A1Z5',
      profile_completion_status: 'completed',
    })
    .eq('id', organizerId);
  if (organizerProfileError) fail('organizer profile onboarding', organizerProfileError);

  const { data: workerCase, error: workerCaseError } = await worker
    .from('verification_cases')
    .insert({
      profile_id: workerId,
      document_type: 'aadhaar',
      document_masked_id: 'XXXX-XXXX-1234',
      document_storage_path: 'test/worker-aadhaar.pdf',
    })
    .select('id')
    .single();
  if (workerCaseError) fail('worker KYC insert', workerCaseError);

  const { data: orgCase, error: orgCaseError } = await organizer
    .from('verification_cases')
    .insert({
      profile_id: organizerId,
      document_type: 'gstin',
      document_masked_id: '27AAAAA0000A1Z5',
      document_storage_path: 'test/org-gstin.pdf',
    })
    .select('id')
    .single();
  if (orgCaseError) fail('organizer KYC insert', orgCaseError);

  for (const caseId of [workerCase.id, orgCase.id]) {
    const { data, error } = await admin.rpc('admin_verify_case_safe', {
      p_case_id: caseId,
      p_status: 'approved',
      p_rejection_reason: null,
      p_admin_id: adminId,
    });
    if (error || !data?.success) fail(`admin_verify_case_safe ${caseId}`, error || JSON.stringify(data));
  }

  const shiftBase = {
    category: 'hospitality',
    venue_address: 'Bandra Kurla Complex, Mumbai',
    city: 'Mumbai',
    zone: 'BKC',
    latitude: 19.076,
    longitude: 72.8777,
    date: kolkataDate(2),
    start_time: '10:00',
    end_time: '18:00',
    hourly_rate: 500,
    slots_total: 2,
    supervisor_name: 'Docker Supervisor',
    supervisor_phone: '9000000103',
    duties: ['Guest greeting', 'Front desk support'],
    breaks_minutes: 30,
    meal_provided: true,
  };

  const { data: job, error: jobError } = await organizer.rpc('create_job_safe', {
    p_organizer_id: organizerId,
    p_job: {
      ...shiftBase,
      title: 'Docker Test Hospitality Shift',
      venue_name: 'Docker Test Venue',
    },
  });
  if (jobError || !job?.success) fail('create_job_safe', jobError || JSON.stringify(job));

  // A second untouched shift remains visible to the worker discovery feed even
  // though the worker has applied to the first shift (the feed intentionally
  // excludes shifts the current worker already applied to).
  const { data: discoveryJob, error: discoveryError } = await organizer.rpc('create_job_safe', {
    p_organizer_id: organizerId,
    p_job: {
      ...shiftBase,
      title: 'Docker Test Open Discovery Shift',
      venue_name: 'Docker Test Discovery Venue',
    },
  });
  if (discoveryError || !discoveryJob?.success) fail('create discovery job', discoveryError || JSON.stringify(discoveryJob));

  // A pending application makes the organizer roster/screening screen non-empty.
  const { data: application, error: applyError } = await worker.rpc('apply_for_job_safe', {
    p_job_id: job.job_id,
    p_notes: 'Docker test application',
  });
  if (applyError || !application?.success) fail('apply_for_job_safe', applyError || JSON.stringify(application));

  console.log(
    JSON.stringify({
      status: 'seeded',
      accounts: {
        admin: accounts.admin.email,
        worker: accounts.worker.email,
        organizer: accounts.organizer.email,
      },
      jobId: job.job_id,
      discoveryJobId: discoveryJob.job_id,
      applicationId: application.application_id,
      workerCaseId: workerCase.id,
      organizerCaseId: orgCase.id,
    })
  );
}

main().catch((err) => {
  console.error('SEED ERROR:', err?.stack || err?.message || err);
  process.exit(1);
});
