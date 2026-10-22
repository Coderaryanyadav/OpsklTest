#!/usr/bin/env node
/**
 * Full three-role workflow verification (database-backed).
 *
 * Covers:
 *   signup/profile provisioning -> worker onboarding -> KYC case -> admin approval
 *   organizer onboarding -> pre-verification denial -> KYC case -> admin approval
 *   organizer posts shift -> worker discovers/applies -> organizer offers
 *   worker accepts -> check-in -> checkout -> organizer approves attendance
 *   invoice -> admin marks funded -> payout initiated -> admin settles
 *
 * Uses only a disposable, migrated database. Everything runs in one transaction
 * and is rolled back. No production credentials, real users, OTPs, or money.
 *
 * Usage:
 *   DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:55432/opskil \
 *     node scripts/test_full_workflow_db.mjs
 */
import { Client } from 'pg';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.log('SKIP: DATABASE_URL is not set. Point it at a disposable migrated database.');
  process.exit(0);
}

const ids = {
  org: '11111111-1111-4111-8111-111111111111',
  worker: '22222222-2222-4222-8222-222222222222',
  admin: '33333333-3333-4333-8333-333333333333',
  switcher: '44444444-4444-4444-8444-444444444444',
};

let passed = 0;
let failed = 0;

function check(name, condition, detail) {
  if (condition) {
    passed += 1;
    console.log(`  PASS  ${name}`);
  } else {
    failed += 1;
    console.error(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

const client = new Client({ connectionString: DATABASE_URL });

async function asAuth(userId, fn) {
  await client.query('SET LOCAL ROLE authenticated');
  await client.query(`SET LOCAL request.jwt.claim.sub = '${userId}'`);
  await client.query(`SET LOCAL request.jwt.claim.role = 'authenticated'`);
  try {
    return await fn();
  } finally {
    // If the statement raised, PostgreSQL aborts the transaction. Do not mask
    // the original error with a second "transaction is aborted" failure.
    try {
      await client.query('RESET ROLE');
    } catch {}
    try {
      await client.query(`SELECT set_config('opskl.trusted','0',true)`);
    } catch {}
  }
}

async function q(sql, params = []) {
  return (await client.query(sql, params)).rows;
}

async function rpc(fn, args = []) {
  const placeholders = args.map((_, i) => `$${i + 1}`).join(', ');
  const rows = await q(`SELECT public.${fn}(${placeholders}) AS result`, args);
  return rows[0].result;
}

async function expectRpcRejected(name, fn, expectedCode) {
  await client.query('SAVEPOINT expected_failure');
  try {
    const res = await fn();
    check(name, res?.success === false && (!expectedCode || res.error_code === expectedCode), JSON.stringify(res));
  } catch (err) {
    check(name, false, err.message);
  } finally {
    await client.query('ROLLBACK TO SAVEPOINT expected_failure');
    await client.query('RELEASE SAVEPOINT expected_failure');
  }
}

async function expectSqlRejected(name, fn, pattern) {
  await client.query('SAVEPOINT expected_sql_failure');
  try {
    await fn();
    check(name, false, 'statement unexpectedly succeeded');
  } catch (err) {
    check(name, pattern.test(err.message), err.message);
  } finally {
    await client.query('ROLLBACK TO SAVEPOINT expected_sql_failure');
    await client.query('RELEASE SAVEPOINT expected_sql_failure');
  }
}

async function main() {
  await client.connect();
  await client.query('BEGIN');

  try {
    // ---------------------------------------------------------------- 1. signup
    console.log('\n[1] Signup / profile provisioning');
    // Mirrors the client sign-up path: auth.users metadata carries the role, and
    // the auth trigger creates the matching profile/subprofile atomically.
    for (const [id, email, role, fullName] of [
      [ids.org, 'flow-org@opskil.test', 'organizer', 'Flow Events'],
      [ids.worker, 'flow-worker@opskil.test', 'worker', 'Flow Worker'],
      [ids.switcher, 'flow-switcher@opskil.test', 'worker', 'Flow Switcher'],
    ]) {
      await q(
        `INSERT INTO auth.users (id, email, raw_user_meta_data)
         VALUES ($1, $2, $3::jsonb) ON CONFLICT (id) DO NOTHING`,
        [id, email, JSON.stringify({ role, full_name: fullName, phone: '9000000000' })]
      );
    }

    const orgProvision = await asAuth(ids.org, () =>
      rpc('ensure_user_profile_provisioned_safe', ['organizer', 'Flow Events', '9000000001', 'flow-org@opskil.test'])
    );
    check('organizer profile provisioned through RPC', orgProvision.success === true, JSON.stringify(orgProvision));

    const workerProvision = await asAuth(ids.worker, () =>
      rpc('ensure_user_profile_provisioned_safe', ['worker', 'Flow Worker', '9000000002', 'flow-worker@opskil.test'])
    );
    check('worker profile provisioned through RPC', workerProvision.success === true, JSON.stringify(workerProvision));

    // Operational admin seeding uses a superuser/migration context, not a client RPC.
    await client.query(
      `SELECT set_config('request.jwt.claim.sub','',true),
              set_config('request.jwt.claim.role','',true),
              set_config('opskl.role_switch','0',true)`
    );
    await q(`INSERT INTO auth.users (id, email) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING`, [
      ids.admin,
      'flow-admin@opskil.test',
    ]);
    await q(`UPDATE profiles SET role='admin', full_name='Flow Admin', is_active=true WHERE id=$1`, [ids.admin]);
    const adminProfile = (await q(`SELECT role, is_active FROM profiles WHERE id=$1`, [ids.admin]))[0];
    check('admin identity seeded as active admin', adminProfile?.role === 'admin' && adminProfile?.is_active === true, JSON.stringify(adminProfile));

    // Regression: organizer login uses switch_user_role_safe for an existing
    // worker account. That trusted RPC must be able to change worker -> organizer,
    // while a direct client update must still be rejected.
    const switched = await asAuth(ids.switcher, () =>
      rpc('switch_user_role_safe', ['organizer', 'Flow Switch Agency', '9000000004'])
    );
    check('worker can switch to organizer workspace', switched.success === true && switched.role === 'organizer', JSON.stringify(switched));
    const switchedProfile = (await q(`SELECT role FROM profiles WHERE id=$1`, [ids.switcher]))[0];
    const switchedOrg = (await q(`SELECT verification_status FROM organizer_profiles WHERE id=$1`, [ids.switcher]))[0];
    check('role switch persists organizer role', switchedProfile?.role === 'organizer', JSON.stringify(switchedProfile));
    check('role switch creates unverified organizer profile', switchedOrg?.verification_status === 'unverified', JSON.stringify(switchedOrg));

    const switchedBack = await asAuth(ids.switcher, () =>
      rpc('ensure_user_profile_provisioned_safe', ['worker', 'Flow Switcher', '9000000004', 'flow-switcher@opskil.test'])
    );
    check('provisioning RPC can switch back to worker', switchedBack.success === true && switchedBack.role === 'worker', JSON.stringify(switchedBack));

    await expectSqlRejected(
      'direct authenticated role change remains blocked',
      () => asAuth(ids.switcher, () => q(`UPDATE profiles SET role='organizer' WHERE id=$1`, [ids.switcher])),
      /cannot change their assigned role/i
    );

    const orgProfile = (await q(`SELECT verification_status, profile_completion_status FROM organizer_profiles WHERE id=$1`, [ids.org]))[0];
    const workerProfile = (await q(`SELECT verification_status, profile_completion_status FROM worker_profiles WHERE id=$1`, [ids.worker]))[0];
    check('new organizer starts unverified', orgProfile?.verification_status === 'unverified', JSON.stringify(orgProfile));
    check('new worker starts unverified', workerProfile?.verification_status === 'unverified', JSON.stringify(workerProfile));

    // ------------------------------------------------------- 2. worker onboarding
    console.log('\n[2] Worker onboarding and KYC submission');
    await asAuth(ids.worker, () =>
      q(
        `UPDATE worker_profiles
         SET preferred_locality='BKC', skills=ARRAY['hospitality','crowd management'],
             availability_status='available', profile_completion_status='completed',
             upi_id='flowworker@upi', updated_at=now()
         WHERE id=$1`,
        [ids.worker]
      )
    );
    const onboarded = (await q(`SELECT profile_completion_status, upi_id FROM worker_profiles WHERE id=$1`, [ids.worker]))[0];
    check('worker can complete onboarding including UPI', onboarded.profile_completion_status === 'completed' && onboarded.upi_id === 'flowworker@upi', JSON.stringify(onboarded));

    const workerCase = (await asAuth(ids.worker, () =>
      q(
        `INSERT INTO verification_cases (profile_id, document_type, document_masked_id, document_storage_path)
         VALUES ($1,'aadhaar','XXXX-XXXX-1234','test/worker-aadhaar.pdf') RETURNING id`,
        [ids.worker]
      )
    ))[0];
    check('worker can submit a pending KYC case', Boolean(workerCase?.id), JSON.stringify(workerCase));

    const workerCaseStatus = (await q(`SELECT status FROM verification_cases WHERE id=$1`, [workerCase.id]))[0];
    check('worker KYC case starts pending', workerCaseStatus.status === 'pending', JSON.stringify(workerCaseStatus));

    // ------------------------------------------------------- 3. admin verifies worker
    console.log('\n[3] Admin verifies worker KYC');
    const workerApproval = await asAuth(ids.admin, () =>
      rpc('admin_verify_case_safe', [workerCase.id, 'approved', null, ids.admin])
    );
    check('admin can approve worker KYC', workerApproval.success === true, JSON.stringify(workerApproval));
    const verifiedWorker = (await q(`SELECT verification_status, is_aadhaar_verified FROM worker_profiles WHERE id=$1`, [ids.worker]))[0];
    check('worker is verified after admin approval', verifiedWorker.verification_status === 'verified', JSON.stringify(verifiedWorker));
    check('Aadhaar flag set by admin approval', verifiedWorker.is_aadhaar_verified === true, JSON.stringify(verifiedWorker));

    // --------------------------------------------------- 4. organizer onboarding
    console.log('\n[4] Organizer onboarding and verification gate');
    await asAuth(ids.org, () =>
      q(
        `UPDATE organizer_profiles
         SET business_name='Flow Events Pvt Ltd', business_type='event_agency',
             business_contact_phone='9000000001', business_contact_email='flow-org@opskil.test',
             billing_address='BKC, Mumbai', gstin='27AAAAA0000A1Z5',
             profile_completion_status='completed', updated_at=now()
         WHERE id=$1`,
        [ids.org]
      )
    );

    const schedule = (await q(
      `SELECT ((now() AT TIME ZONE 'Asia/Kolkata') + interval '90 minutes')::date::text AS d,
              ((now() AT TIME ZONE 'Asia/Kolkata') + interval '90 minutes')::time::text AS start_time,
              ((now() AT TIME ZONE 'Asia/Kolkata') + interval '9 hours 30 minutes')::time::text AS end_time`
    ))[0];
    const jobPayload = {
      title: 'Full Workflow Hospitality Shift',
      category: 'hospitality',
      venue_name: 'Flow Test Venue',
      venue_address: 'Bandra Kurla Complex, Mumbai',
      city: 'Mumbai',
      zone: 'BKC',
      latitude: 19.076,
      longitude: 72.8777,
      date: schedule.d,
      start_time: schedule.start_time,
      end_time: schedule.end_time,
      hourly_rate: 500,
      slots_total: 1,
      status: 'open',
      supervisor_name: 'Flow Supervisor',
      supervisor_phone: '9000000000',
      duties: ['Guest greeting', 'Front desk support'],
      breaks_minutes: 30,
      meal_provided: true,
    };

    await expectRpcRejected(
      'unverified organizer cannot publish a shift',
      () => asAuth(ids.org, () => rpc('create_job_safe', [jobPayload, ids.org])),
      'ORGANIZER_NOT_VERIFIED'
    );

    const orgCase = (await asAuth(ids.org, () =>
      q(
        `INSERT INTO verification_cases (profile_id, document_type, document_masked_id, document_storage_path)
         VALUES ($1,'gstin','27AAAAA0000A1Z5','test/org-gstin.pdf') RETURNING id`,
        [ids.org]
      )
    ))[0];
    check('organizer can submit a pending GSTIN case', Boolean(orgCase?.id), JSON.stringify(orgCase));

    const orgApproval = await asAuth(ids.admin, () =>
      rpc('admin_verify_case_safe', [orgCase.id, 'approved', null, ids.admin])
    );
    check('admin can approve organizer KYC', orgApproval.success === true, JSON.stringify(orgApproval));
    const verifiedOrg = (await q(`SELECT verification_status, is_gstin_verified FROM organizer_profiles WHERE id=$1`, [ids.org]))[0];
    check('organizer is verified after admin approval', verifiedOrg.verification_status === 'verified', JSON.stringify(verifiedOrg));
    check('GSTIN flag set by admin approval', verifiedOrg.is_gstin_verified === true, JSON.stringify(verifiedOrg));

    // ------------------------------------------------------------ 5. post shift
    console.log('\n[5] Organizer posts a verified shift');
    const created = await asAuth(ids.org, () => rpc('create_job_safe', [jobPayload, ids.org]));
    check('verified organizer can publish shift', created.success === true, JSON.stringify(created));
    const jobId = created.job_id;
    check('shift returns a job id', Boolean(jobId), JSON.stringify(created));
    const jobRow = (await q(`SELECT status, slots_total, slots_filled, hourly_rate, total_pay, organizer_id FROM jobs WHERE id=$1`, [jobId]))[0];
    check('shift is open with one slot', jobRow.status === 'open' && jobRow.slots_total === 1 && jobRow.slots_filled === 0, JSON.stringify(jobRow));
    check('shift pay derived from rate and hours', Number(jobRow.total_pay) === 4000, JSON.stringify(jobRow));

    // -------------------------------------------------------- 6. discovery/apply
    console.log('\n[6] Worker discovers, applies, and is offered');
    const feed = await asAuth(ids.worker, () =>
      q(`SELECT * FROM public.get_discovery_feed($1::jsonb, $2, NULL)`, [JSON.stringify({ city: 'Mumbai' }), 50])
    );
    check('worker discovery feed contains the new shift', feed.some((r) => r.id === jobId), `feed=${feed.length}`);

    const applied = await asAuth(ids.worker, () => rpc('apply_for_job_safe', [jobId, 'Available for this shift']));
    check('worker can apply to the shift', applied.success === true, JSON.stringify(applied));
    const applicationId = applied.application_id || applied.application?.id;
    check('application id returned', Boolean(applicationId), JSON.stringify(applied));

    const applications = await asAuth(ids.org, () =>
      q(`SELECT * FROM public.get_organizer_applications_safe($1, $2)`, [ids.org, jobId])
    );
    check('organizer sees the worker application', applications.some((r) => r.worker_id === ids.worker), `applications=${applications.length}`);

    const shortlisted = await asAuth(ids.org, () => rpc('update_application_status_safe', [applicationId, 'shortlisted']));
    check('organizer can shortlist the applicant', shortlisted.success === true, JSON.stringify(shortlisted));

    const offer = await asAuth(ids.org, () => rpc('select_worker_offer_safe', [jobId, ids.worker, 'Please accept']));
    check('organizer can send a shift offer', offer.success === true, JSON.stringify(offer));
    check('offer has a server-generated check-in code', typeof offer.check_in_code === 'string' && offer.check_in_code.startsWith('OP-'), JSON.stringify(offer));

    const accepted = await asAuth(ids.worker, () => rpc('worker_confirm_selection_safe', [offer.booking_id]));
    check('worker can accept the offer', accepted.success === true && accepted.status === 'confirmed', JSON.stringify(accepted));
    const booking = (await q(`SELECT id, status, check_in_code FROM bookings WHERE id=$1`, [offer.booking_id]))[0];
    check('booking is confirmed with the same code', booking.status === 'confirmed' && booking.check_in_code === offer.check_in_code, JSON.stringify(booking));
    const filledJob = (await q(`SELECT status, slots_filled FROM jobs WHERE id=$1`, [jobId]))[0];
    check('job is filled after acceptance', filledJob.status === 'filled' && filledJob.slots_filled === 1, JSON.stringify(filledJob));

    // ------------------------------------------------ 7. attendance lifecycle
    console.log('\n[7] Check-in, check-out, and attendance approval');
    const checkIn = await asAuth(ids.worker, () =>
      rpc('check_in_worker_safe', [offer.booking_id, offer.check_in_code, 19.076, 72.8777])
    );
    check('worker can check in at the venue geofence', checkIn.success === true, JSON.stringify(checkIn));

    // Time-travel the disposable fixture so the 15-minute minimum does not require a real wait.
    await q(`UPDATE bookings SET check_in_time = now() - interval '1 hour' WHERE id=$1`, [offer.booking_id]);
    await q(`UPDATE attendance_records SET check_in_time = now() - interval '1 hour' WHERE booking_id=$1`, [offer.booking_id]);

    const checkOut = await asAuth(ids.worker, () => rpc('check_out_worker_safe', [offer.booking_id, 'Shift complete']));
    check('worker can check out after minimum duration', checkOut.success === true, JSON.stringify(checkOut));

    const completed = await asAuth(ids.org, () =>
      rpc('complete_shift_and_approve_attendance', [offer.booking_id, 8, true, 'Verified by supervisor'])
    );
    check('organizer can approve attendance and pay', completed.success === true, JSON.stringify(completed));
    const completedBooking = (await q(`SELECT status, approved_total_pay FROM bookings WHERE id=$1`, [offer.booking_id]))[0];
    check('booking completed with approved pay', completedBooking.status === 'completed' && Number(completedBooking.approved_total_pay) === 4000, JSON.stringify(completedBooking));
    const workerCounter = (await q(`SELECT shifts_completed FROM worker_profiles WHERE id=$1`, [ids.worker]))[0];
    check('worker completed-shift counter incremented', Number(workerCounter.shifts_completed) === 1, JSON.stringify(workerCounter));

    // ------------------------------------------------------- 8. invoice/payout
    console.log('\n[8] Invoice funding, payout initiation, and admin settlement');
    const invoice = await asAuth(ids.org, () => rpc('generate_job_invoice_safe', [jobId, ids.org]));
    check('organizer can generate the shift invoice', invoice.success === true, JSON.stringify(invoice));
    const invoiceId = invoice.invoice_id;
    const invoiceRow = (await q(`SELECT status, total_payable FROM organizer_invoices WHERE id=$1`, [invoiceId]))[0];
    check('invoice is issued', invoiceRow?.status === 'issued', JSON.stringify(invoiceRow));

    const funded = await asAuth(ids.admin, () => rpc('admin_mark_invoice_funded', [invoiceId, 'TESTBANKREF123']));
    check('admin can mark invoice funded (manual ledger)', funded.success === true, JSON.stringify(funded));

    const payout = await asAuth(ids.org, () =>
      rpc('initiate_worker_payout_safe', [offer.booking_id, 'flowworker@upi', 'flow-idem-1'])
    );
    check('organizer can initiate payout after approval', payout.success === true && payout.status === 'escrow_locked', JSON.stringify(payout));
    check('payout amount equals approved pay', Number(payout.amount) === 4000, JSON.stringify(payout));

    if (payout.success && payout.payment_id) {
      const settled = await asAuth(ids.admin, () => rpc('admin_mark_payout_settled', [payout.payment_id, 'TESTUTR123456']));
      check('admin can settle the payout with a UTR', settled.success === true && settled.status === 'settled', JSON.stringify(settled));
      const payment = (await q(`SELECT status, net_payout, utr_reference FROM payment_records WHERE id=$1`, [payout.payment_id]))[0];
      check('payment ledger is settled with UTR', payment?.status === 'settled' && Number(payment?.net_payout) === 4000 && payment?.utr_reference === 'TESTUTR123456', JSON.stringify(payment));

      const settleAgainDifferent = await asAuth(ids.admin, () =>
        rpc('admin_mark_payout_settled', [payout.payment_id, 'DIFFERENTUTR999'])
      );
      check('different-UTR re-settlement is rejected', settleAgainDifferent.success === false, JSON.stringify(settleAgainDifferent));
    } else {
      check('admin can settle the payout with a UTR', false, 'payout was not created');
      check('payment ledger is settled with UTR', false, 'payout was not created');
      check('different-UTR re-settlement is rejected', false, 'payout was not created');
    }

    // ------------------------------------------------------------ 9. admin view
    console.log('\n[9] Admin authorization and cross-role checks');
    const adminCheck = await asAuth(ids.admin, () => rpc('is_current_admin'));
    check('admin is recognized as active admin', adminCheck === true, JSON.stringify(adminCheck));
    const workerAdminCheck = await asAuth(ids.worker, () => rpc('is_current_admin'));
    check('worker is not recognized as admin', workerAdminCheck === false, JSON.stringify(workerAdminCheck));

    const workerJobAttempt = await asAuth(ids.worker, () => rpc('create_job_safe', [jobPayload, ids.org]));
    check('worker cannot post a shift for an organizer', workerJobAttempt.success === false && workerJobAttempt.error_code === 'UNAUTHORIZED', JSON.stringify(workerJobAttempt));

    const workerCaseCount = (await q(`SELECT count(*)::int AS c FROM verification_cases WHERE profile_id=$1 AND status='approved'`, [ids.worker]))[0];
    check('approved KYC case is persisted', workerCaseCount.c === 1, JSON.stringify(workerCaseCount));

    console.log(`\nRESULT: ${passed} passed, ${failed} failed`);
    if (failed > 0) throw new Error(`${failed} full-workflow check(s) failed`);
  } finally {
    await client.query('ROLLBACK').catch(() => {});
    await client.end();
  }
}

main().catch((err) => {
  console.error('\nFULL WORKFLOW TEST ERROR:', err.stack || err.message);
  process.exit(1);
});
