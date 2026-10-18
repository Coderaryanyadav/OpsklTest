#!/usr/bin/env node
/**
 * OPSKIL PHASE 4 — REAL MARKETPLACE BUSINESS LOGIC INTEGRATION TEST
 * 
 * Executes the authoritative 12-step marketplace test required by Phase 4:
 * 1. Worker registers and submits KYC.
 * 2. Admin approves the worker.
 * 3. Organizer registers and submits verification.
 * 4. Admin approves the organizer.
 * 5. Organizer creates and publishes a shift.
 * 6. Worker discovers and applies for the shift.
 * 7. Organizer sees the real application.
 * 8. Organizer confirms the worker.
 * 9. Worker sees the authoritative confirmed status.
 * 10. Repeated requests do not create duplicate applications or bookings.
 * 11. A second worker cannot exceed available capacity.
 * 12. Cross-account access is rejected.
 */

import { Client as PgClient } from 'pg';
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// Parse .env
try {
  const envPath = path.resolve(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const l of lines) {
      const trimmed = l.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const idx = trimmed.indexOf('=');
      if (idx !== -1) {
        const key = trimmed.slice(0, idx).trim();
        let val = trimmed.slice(idx + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        if (!process.env[key]) process.env[key] = val;
      }
    }
  }
} catch (e) { }

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
};

async function run() {
  console.log(`\n${colors.cyan}${colors.bold}======================================================================${colors.reset}`);
  console.log(`${colors.cyan}${colors.bold}   PHASE 4 — AUTHORITATIVE MARKETPLACE BUSINESS LOGIC INTEGRATION TEST ${colors.reset}`);
  console.log(`${colors.cyan}${colors.bold}======================================================================${colors.reset}\n`);

  const dbUrl = process.env.DATABASE_URL;
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!dbUrl || !supabaseUrl || !serviceKey) {
    throw new Error('Missing DATABASE_URL, EXPO_PUBLIC_SUPABASE_URL, or SUPABASE_SERVICE_ROLE_KEY');
  }

  const rejectUnauthorized = process.env.DATABASE_SSL_REJECT_UNAUTHORIZED === 'true';
  const pg = new PgClient({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized },
  });
  await pg.connect();
  console.log(`${colors.green}✓ Connected to PostgreSQL Pooler${colors.reset}`);

  const adminClient = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const testSuffix = Date.now().toString().slice(-6);
  const w1Email = `test_w1_${testSuffix}@opskil.test`;
  const w2Email = `test_w2_${testSuffix}@opskil.test`;
  const orgEmail = `test_org_${testSuffix}@opskil.test`;
  const adminEmail = `test_admin_${testSuffix}@opskil.test`;

  let w1Id = null;
  let w2Id = null;
  let orgId = null;
  let adminId = null;
  let jobId = null;
  let w1CaseId = null;
  let orgCaseId = null;
  let bookingId = null;

  try {
    // -------------------------------------------------------------------------
    // PROVISION TEST ACCOUNTS
    // -------------------------------------------------------------------------
    console.log(`\n${colors.bold}Provisioning Isolated Test Accounts...${colors.reset}`);
    const [w1Res, w2Res, orgRes, admRes] = await Promise.all([
      adminClient.auth.admin.createUser({
        email: w1Email,
        password: 'Password123!',
        email_confirm: true,
        user_metadata: { role: 'worker', full_name: 'Worker One' },
      }),
      adminClient.auth.admin.createUser({
        email: w2Email,
        password: 'Password123!',
        email_confirm: true,
        user_metadata: { role: 'worker', full_name: 'Worker Two' },
      }),
      adminClient.auth.admin.createUser({
        email: orgEmail,
        password: 'Password123!',
        email_confirm: true,
        user_metadata: { role: 'organizer', full_name: 'Apex Events' },
      }),
      adminClient.auth.admin.createUser({
        email: adminEmail,
        password: 'Password123!',
        email_confirm: true,
        user_metadata: { role: 'admin', full_name: 'Platform Admin' },
      }),
    ]);

    if (w1Res.error) throw w1Res.error;
    if (w2Res.error) throw w2Res.error;
    if (orgRes.error) throw orgRes.error;
    if (admRes.error) throw admRes.error;

    w1Id = w1Res.data.user.id;
    w2Id = w2Res.data.user.id;
    orgId = orgRes.data.user.id;
    adminId = admRes.data.user.id;

    console.log(`   ${colors.green}✓ Worker 1: ${w1Id}${colors.reset}`);
    console.log(`   ${colors.green}✓ Worker 2: ${w2Id}${colors.reset}`);
    console.log(`   ${colors.green}✓ Organizer: ${orgId}${colors.reset}`);
    console.log(`   ${colors.green}✓ Admin: ${adminId}${colors.reset}`);

    // Set up profiles in DB
    await pg.query(`
      SELECT set_config('opskl.trusted', '1', true);

      INSERT INTO profiles (id, role, phone, full_name, city, is_active) VALUES
        ('${w1Id}', 'worker', '+919901${testSuffix}', 'Worker One', 'Mumbai', true),
        ('${w2Id}', 'worker', '+919902${testSuffix}', 'Worker Two', 'Mumbai', true),
        ('${orgId}', 'organizer', '+919903${testSuffix}', 'Apex Events', 'Mumbai', true),
        ('${adminId}', 'admin', '+919904${testSuffix}', 'Platform Admin', 'Mumbai', true)
      ON CONFLICT (id) DO UPDATE SET is_active = true;

      INSERT INTO worker_profiles (id, preferred_locality, skills, experience_years, verification_status, profile_completion_status)
      VALUES 
        ('${w1Id}', 'Bandra Kurla Complex (BKC)', ARRAY['Registration Desk & Scanning'], 1, 'pending', 'completed'),
        ('${w2Id}', 'Bandra Kurla Complex (BKC)', ARRAY['VIP Ushering & Concierge'], 2, 'pending', 'completed')
      ON CONFLICT (id) DO UPDATE SET verification_status = 'pending', profile_completion_status = 'completed';

      INSERT INTO organizer_profiles (id, business_name, business_contact_phone, verification_status, profile_completion_status)
      VALUES ('${orgId}', 'Apex Events', '+919903${testSuffix}', 'pending', 'completed')
      ON CONFLICT (id) DO UPDATE SET verification_status = 'pending', profile_completion_status = 'completed';
    `);

    // -------------------------------------------------------------------------
    // STEP 1: Worker 1 Registers and Submits KYC
    // -------------------------------------------------------------------------
    console.log(`\n${colors.bold}STEP 1: Worker 1 registers and submits KYC...${colors.reset}`);
    await pg.query(`SELECT set_config('request.jwt.claim.sub', '${w1Id}', false);`);
    const w1SubmitRes = await pg.query(`
      SELECT submit_verification_case_safe(
        'aadhaar',
        '998877665544',
        '${w1Id}/aadhaar.jpg'
      ) AS res;
    `);
    const w1Submit = w1SubmitRes.rows[0].res;
    if (!w1Submit.success || !w1Submit.case_id) {
      throw new Error(`Worker 1 KYC submission failed: ${JSON.stringify(w1Submit)}`);
    }
    w1CaseId = w1Submit.case_id;
    console.log(`   ${colors.green}✓ Worker 1 KYC Case submitted: ${w1CaseId} (Status: ${w1Submit.status})${colors.reset}`);

    // -------------------------------------------------------------------------
    // STEP 2: Admin Approves Worker 1
    // -------------------------------------------------------------------------
    console.log(`\n${colors.bold}STEP 2: Admin approves Worker 1 KYC...${colors.reset}`);
    await pg.query(`SELECT set_config('request.jwt.claim.sub', '${adminId}', false);`);
    const w1ApprovalRes = await pg.query(`
      SELECT admin_verify_case_safe('${w1CaseId}'::uuid, 'approved', 'Valid Aadhaar document verified') AS res;
    `);
    const w1Appr = w1ApprovalRes.rows[0].res;
    if (!w1Appr.success || w1Appr.status !== 'approved') {
      throw new Error(`Admin KYC approval failed: ${JSON.stringify(w1Appr)}`);
    }

    const w1Check = await pg.query(`SELECT verification_status FROM worker_profiles WHERE id = '${w1Id}';`);
    if (w1Check.rows[0].verification_status !== 'verified') {
      throw new Error(`Worker 1 profile not updated to verified! Current: ${w1Check.rows[0].verification_status}`);
    }
    console.log(`   ${colors.green}✓ Admin successfully approved Worker 1. Worker verification_status = 'verified'.${colors.reset}`);

    // Also submit & approve Worker 2 for capacity tests later
    await pg.query(`SELECT set_config('request.jwt.claim.sub', '${w2Id}', false);`);
    const w2SubmitRes = await pg.query(`
      SELECT submit_verification_case_safe(
        'aadhaar',
        '998877665555',
        '${w2Id}/aadhaar.jpg'
      ) AS res;
    `);
    const w2CaseId = w2SubmitRes.rows[0].res.case_id;
    await pg.query(`SELECT set_config('request.jwt.claim.sub', '${adminId}', false);`);
    await pg.query(`SELECT admin_verify_case_safe('${w2CaseId}'::uuid, 'approved', 'Valid Aadhaar') AS res;`);
    console.log(`   ${colors.green}✓ Worker 2 KYC approved for capacity test.${colors.reset}`);

    // -------------------------------------------------------------------------
    // STEP 3: Organizer Registers and Submits Verification
    // -------------------------------------------------------------------------
    console.log(`\n${colors.bold}STEP 3: Organizer registers and submits business verification...${colors.reset}`);
    await pg.query(`SELECT set_config('request.jwt.claim.sub', '${orgId}', false);`);
    const orgSubmitRes = await pg.query(`
      SELECT submit_verification_case_safe(
        'gstin',
        '27ABCDE1234F1Z5',
        '${orgId}/gst_certificate.pdf'
      ) AS res;
    `);
    const orgSubmit = orgSubmitRes.rows[0].res;
    if (!orgSubmit.success || !orgSubmit.case_id) {
      throw new Error(`Organizer business verification submission failed: ${JSON.stringify(orgSubmit)}`);
    }
    orgCaseId = orgSubmit.case_id;
    console.log(`   ${colors.green}✓ Organizer Business Verification Case: ${orgCaseId} (Status: ${orgSubmit.status})${colors.reset}`);

    // -------------------------------------------------------------------------
    // STEP 4: Admin Approves Organizer
    // -------------------------------------------------------------------------
    console.log(`\n${colors.bold}STEP 4: Admin approves Organizer business verification...${colors.reset}`);
    await pg.query(`SELECT set_config('request.jwt.claim.sub', '${adminId}', false);`);
    const orgApprovalRes = await pg.query(`
      SELECT admin_verify_case_safe('${orgCaseId}'::uuid, 'approved', 'Valid GST Certificate') AS res;
    `);
    const orgAppr = orgApprovalRes.rows[0].res;
    if (!orgAppr.success || orgAppr.status !== 'approved') {
      throw new Error(`Admin business verification approval failed: ${JSON.stringify(orgAppr)}`);
    }

    const orgCheck = await pg.query(`SELECT verification_status FROM organizer_profiles WHERE id = '${orgId}';`);
    if (orgCheck.rows[0].verification_status !== 'verified') {
      throw new Error(`Organizer profile not updated to verified! Current: ${orgCheck.rows[0].verification_status}`);
    }
    console.log(`   ${colors.green}✓ Admin successfully approved Organizer. verification_status = 'verified'.${colors.reset}`);

    // -------------------------------------------------------------------------
    // STEP 5: Organizer Creates and Publishes a Shift
    // -------------------------------------------------------------------------
    console.log(`\n${colors.bold}STEP 5: Organizer creates and publishes a shift (slots_total = 1)...${colors.reset}`);
    await pg.query(`SELECT set_config('request.jwt.claim.sub', '${orgId}', false);`);
    const shiftRes = await pg.query(`
      SELECT create_job_safe(
        jsonb_build_object(
          'title', 'Concert Guest Experience Staff',
          'category', 'conference',
          'venue_name', 'Jio World Garden',
          'venue_address', 'BKC, Bandra East, Mumbai',
          'zone', 'Bandra Kurla Complex (BKC)',
          'city', 'Mumbai',
          'date', (now() AT TIME ZONE 'Asia/Kolkata' + interval '2 days')::date,
          'start_time', '16:00:00',
          'end_time', '22:00:00',
          'hourly_rate', 300,
          'slots_total', 1,
          'supervisor_name', 'Sunil Kapoor',
          'supervisor_phone', '+919876543210',
          'latitude', 19.0657,
          'longitude', 72.8682
        ),
        '${orgId}'::uuid
      ) AS res;
    `);
    const shiftData = shiftRes.rows[0].res;
    if (!shiftData.success || !shiftData.job_id) {
      throw new Error(`Failed to create shift: ${JSON.stringify(shiftData)}`);
    }
    jobId = shiftData.job_id;
    console.log(`   ${colors.green}✓ Shift published successfully: ${jobId} (Capacity: 1 worker)${colors.reset}`);

    // -------------------------------------------------------------------------
    // STEP 6: Worker 1 Discovers and Applies for the Shift
    // -------------------------------------------------------------------------
    console.log(`\n${colors.bold}STEP 6: Worker 1 discovers and applies for the shift...${colors.reset}`);
    await pg.query(`SELECT set_config('request.jwt.claim.sub', '${w1Id}', false);`);
    const discoveryRes = await pg.query(`
      SELECT * FROM get_discovery_feed(
        jsonb_build_object('zone', 'Bandra Kurla Complex (BKC)'),
        20,
        NULL
      );
    `);
    const matchedShifts = discoveryRes.rows.filter(r => r.id === jobId);
    if (matchedShifts.length === 0) {
      throw new Error(`Worker 1 could not find published shift in get_discovery_feed!`);
    }
    console.log(`   ${colors.green}✓ Worker 1 discovered shift "${matchedShifts[0].title}" in feed.${colors.reset}`);

    // Apply for shift
    const applyRes = await pg.query(`
      SELECT apply_for_job_safe('${jobId}'::uuid, 'Excited to assist at the concert!') AS res;
    `);
    const applyData = applyRes.rows[0].res;
    if (!applyData.success || applyData.status !== 'applied') {
      throw new Error(`Worker 1 application failed: ${JSON.stringify(applyData)}`);
    }
    console.log(`   ${colors.green}✓ Worker 1 application submitted: Application ID ${applyData.application_id}.${colors.reset}`);

    // -------------------------------------------------------------------------
    // STEP 7: Organizer Sees Real Application
    // -------------------------------------------------------------------------
    console.log(`\n${colors.bold}STEP 7: Organizer inspects applicants list...${colors.reset}`);
    await pg.query(`SELECT set_config('request.jwt.claim.sub', '${orgId}', false);`);
    const appQuery = await pg.query(`
      SELECT ja.id, ja.status, ja.worker_id, p.full_name, wp.verification_status
      FROM job_applications ja
      JOIN profiles p ON p.id = ja.worker_id
      JOIN worker_profiles wp ON wp.id = ja.worker_id
      WHERE ja.job_id = '${jobId}';
    `);
    if (appQuery.rows.length === 0 || appQuery.rows[0].worker_id !== w1Id) {
      throw new Error(`Organizer cannot see Worker 1 application! Found: ${JSON.stringify(appQuery.rows)}`);
    }
    console.log(`   ${colors.green}✓ Organizer sees Worker 1 (${appQuery.rows[0].full_name}) with status: ${appQuery.rows[0].status}.${colors.reset}`);

    // -------------------------------------------------------------------------
    // STEP 8: Organizer Confirms the Worker
    // -------------------------------------------------------------------------
    console.log(`\n${colors.bold}STEP 8: Organizer confirms Worker 1 booking...${colors.reset}`);
    const confirmRes = await pg.query(`
      SELECT confirm_worker_booking_safe('${jobId}'::uuid, '${w1Id}'::uuid, 'Selected for VIP Entrance') AS res;
    `);
    const confirmData = confirmRes.rows[0].res;
    if (!confirmData.success || !confirmData.booking_id) {
      throw new Error(`Confirmation failed: ${JSON.stringify(confirmData)}`);
    }
    bookingId = confirmData.booking_id;
    console.log(`   ${colors.green}✓ Booking created: ${bookingId} (Check-in Code: ${confirmData.check_in_code})${colors.reset}`);

    // -------------------------------------------------------------------------
    // STEP 9: Worker 1 Sees Authoritative Confirmed Status
    // -------------------------------------------------------------------------
    console.log(`\n${colors.bold}STEP 9: Worker 1 queries confirmed booking...${colors.reset}`);
    await pg.query(`SELECT set_config('request.jwt.claim.sub', '${w1Id}', false);`);
    const w1BookingRes = await pg.query(`
      SELECT id, status, agreed_hourly_rate, check_in_code 
      FROM bookings 
      WHERE id = '${bookingId}' AND worker_id = '${w1Id}';
    `);
    if (w1BookingRes.rows.length === 0 || w1BookingRes.rows[0].status !== 'confirmed') {
      throw new Error(`Worker 1 cannot see authoritative confirmed booking!`);
    }
    console.log(`   ${colors.green}✓ Worker 1 verified confirmed booking: Rate ₹${w1BookingRes.rows[0].agreed_hourly_rate}/hr, Status: ${w1BookingRes.rows[0].status}.${colors.reset}`);

    // -------------------------------------------------------------------------
    // STEP 10: Repeated Requests Do Not Create Duplicates
    // -------------------------------------------------------------------------
    console.log(`\n${colors.bold}STEP 10: Testing idempotency against repeated requests...${colors.reset}`);
    // Worker 1 tries to apply again
    await pg.query(`SELECT set_config('request.jwt.claim.sub', '${w1Id}', false);`);
    const dupApplyRes = await pg.query(`
      SELECT apply_for_job_safe('${jobId}'::uuid) AS res;
    `);
    const dupApplyData = dupApplyRes.rows[0].res;
    if (dupApplyData.success === true) {
      throw new Error(`IDEMPOTENCY FLAW: Worker 1 was allowed to re-apply to an already hired shift!`);
    }
    console.log(`   ${colors.green}✓ Duplicate application rejected: ${dupApplyData.error_code} (${dupApplyData.message})${colors.reset}`);

    // Organizer tries to confirm Worker 1 again
    await pg.query(`SELECT set_config('request.jwt.claim.sub', '${orgId}', false);`);
    const dupConfirmRes = await pg.query(`
      SELECT confirm_worker_booking_safe('${jobId}'::uuid, '${w1Id}'::uuid) AS res;
    `);
    const dupConfirmData = dupConfirmRes.rows[0].res;
    if (!dupConfirmData.success || !dupConfirmData.already_confirmed) {
      throw new Error(`IDEMPOTENCY FLAW: Repeated confirm call did not return idempotent confirmation!`);
    }
    console.log(`   ${colors.green}✓ Repeated confirmation was cleanly idempotent: already_confirmed = true (Booking ID: ${dupConfirmData.booking_id})${colors.reset}`);

    // -------------------------------------------------------------------------
    // STEP 11: A Second Worker Cannot Exceed Available Capacity
    // -------------------------------------------------------------------------
    console.log(`\n${colors.bold}STEP 11: Testing capacity boundary with Worker 2...${colors.reset}`);
    // Check shift capacity on DB
    const jobCapacityCheck = await pg.query(`SELECT slots_total, slots_filled, status FROM jobs WHERE id = '${jobId}';`);
    console.log(`   Current shift capacity: ${jobCapacityCheck.rows[0].slots_filled}/${jobCapacityCheck.rows[0].slots_total} (Status: ${jobCapacityCheck.rows[0].status})`);

    // Worker 2 attempts to apply to the full shift
    await pg.query(`SELECT set_config('request.jwt.claim.sub', '${w2Id}', false);`);
    const w2ApplyRes = await pg.query(`
      SELECT apply_for_job_safe('${jobId}'::uuid) AS res;
    `);
    const w2ApplyData = w2ApplyRes.rows[0].res;
    if (w2ApplyData.success === true) {
      throw new Error(`CAPACITY FLAW: Worker 2 was allowed to apply to a filled shift!`);
    }
    console.log(`   ${colors.green}✓ Worker 2 application blocked: ${w2ApplyData.error_code} (${w2ApplyData.message})${colors.reset}`);

    // Organizer attempts to confirm Worker 2 over capacity
    await pg.query(`SELECT set_config('request.jwt.claim.sub', '${orgId}', false);`);
    const w2ConfirmRes = await pg.query(`
      SELECT confirm_worker_booking_safe('${jobId}'::uuid, '${w2Id}'::uuid) AS res;
    `);
    const w2ConfirmData = w2ConfirmRes.rows[0].res;
    if (w2ConfirmData.success === true) {
      throw new Error(`CONCURRENCY/CAPACITY OVERBOOKING FLAW: Worker 2 was confirmed beyond capacity!`);
    }
    console.log(`   ${colors.green}✓ Overbooking blocked: ${w2ConfirmData.error_code} (${w2ConfirmData.message})${colors.reset}`);

    // -------------------------------------------------------------------------
    // STEP 12: Cross-Account Access is Rejected
    // -------------------------------------------------------------------------
    console.log(`\n${colors.bold}STEP 12: Testing cross-account authorization rejection...${colors.reset}`);
    // Worker 1 attempts to confirm a booking on organizer's shift
    await pg.query(`SELECT set_config('request.jwt.claim.sub', '${w1Id}', false);`);
    const unauthorizedConfirm = await pg.query(`
      SELECT confirm_worker_booking_safe('${jobId}'::uuid, '${w2Id}'::uuid) AS res;
    `);
    const unauthData = unauthorizedConfirm.rows[0].res;
    if (unauthData.success === true || unauthData.error_code !== 'UNAUTHORIZED') {
      throw new Error(`SECURITY FLAW: Worker 1 unauthorized booking confirmation was not rejected!`);
    }
    console.log(`   ${colors.green}✓ Cross-account confirmation blocked: ${unauthData.error_code}.${colors.reset}`);

    // Worker 1 attempts to edit Organizer's shift
    const unauthorizedEdit = await pg.query(`
      SELECT edit_job_safe('${jobId}'::uuid, jsonb_build_object('title', 'Hacked Title')) AS res;
    `);
    const unauthEditData = unauthorizedEdit.rows[0].res;
    if (unauthEditData.success === true || unauthEditData.error_code !== 'UNAUTHORIZED') {
      throw new Error(`SECURITY FLAW: Worker 1 unauthorized shift edit was not rejected!`);
    }
    console.log(`   ${colors.green}✓ Cross-account shift edit blocked: ${unauthEditData.error_code}.${colors.reset}`);

    // Unauthenticated caller attempts to call confirm
    await pg.query(`SELECT set_config('request.jwt.claim.sub', '', false);`);
    const unauthNoUser = await pg.query(`
      SELECT confirm_worker_booking_safe('${jobId}'::uuid, '${w1Id}'::uuid) AS res;
    `);
    if (unauthNoUser.rows[0].res.error_code !== 'UNAUTHENTICATED') {
      throw new Error(`SECURITY FLAW: Unauthenticated RPC call did not return UNAUTHENTICATED!`);
    }
    console.log(`   ${colors.green}✓ Unauthenticated caller blocked: UNAUTHENTICATED.${colors.reset}`);

    console.log(`\n${colors.green}${colors.bold}======================================================================${colors.reset}`);
    console.log(`${colors.green}${colors.bold}   ALL 12 MARKETPLACE LIFECYCLE REQUIREMENTS PASSED WITH 0 ERRORS!     ${colors.reset}`);
    console.log(`${colors.green}${colors.bold}======================================================================${colors.reset}\n`);

  } finally {
    // -------------------------------------------------------------------------
    // CLEANUP TEST FIXTURES SAFELY
    // -------------------------------------------------------------------------
    console.log(`${colors.bold}Cleaning up isolated test fixtures...${colors.reset}`);
    try {
      if (jobId) {
        await pg.query(`DELETE FROM bookings WHERE job_id = '${jobId}';`);
        await pg.query(`DELETE FROM job_applications WHERE job_id = '${jobId}';`);
        await pg.query(`DELETE FROM jobs WHERE id = '${jobId}';`);
      }
      if (w1CaseId) await pg.query(`DELETE FROM verification_cases WHERE id = '${w1CaseId}';`);
      if (orgCaseId) await pg.query(`DELETE FROM verification_cases WHERE id = '${orgCaseId}';`);

      const userIds = [w1Id, w2Id, orgId, adminId].filter(Boolean);
      for (const u of userIds) {
        await pg.query(`DELETE FROM worker_profiles WHERE id = '${u}';`);
        await pg.query(`DELETE FROM organizer_profiles WHERE id = '${u}';`);
        await pg.query(`DELETE FROM profiles WHERE id = '${u}';`);
        await adminClient.auth.admin.deleteUser(u).catch(() => {});
      }
      console.log(`   ${colors.green}✓ Cleaned up all test accounts and database rows.${colors.reset}`);
    } catch (cleanErr) {
      console.warn('Warning during cleanup:', cleanErr);
    }
    await pg.end();
  }
}

run().catch((err) => {
  console.error(`\n${colors.red}${colors.bold}INTEGRATION TEST FAILED:${colors.reset}`, err);
  process.exit(1);
});
