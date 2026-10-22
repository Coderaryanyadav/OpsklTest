#!/usr/bin/env node
/**
 * Database-backed lifecycle regression test.
 *
 * Requires a DISPOSABLE PostgreSQL database with all migrations applied.
 * Everything runs inside a single transaction that is rolled back at the end,
 * so it never persists fixture rows.
 *
 * Usage:
 *   DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:55432/opskil \
 *     node scripts/test_lifecycle_db.mjs
 */
import { Client } from 'pg';

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.log('SKIP: DATABASE_URL is not set. Point it at a disposable migrated database.');
  process.exit(0);
}

const ids = {
  orgA: 'a0000000-0000-4000-8000-000000000001',
  orgB: 'a0000000-0000-4000-8000-000000000002',
  worker: 'b0000000-0000-4000-8000-000000000001',
  worker2: 'b0000000-0000-4000-8000-000000000002',
  admin: 'c0000000-0000-4000-8000-000000000001',
  job: 'd0000000-0000-4000-8000-000000000001',
  jobGeo: 'd0000000-0000-4000-8000-000000000002',
  jobConflict: 'd0000000-0000-4000-8000-000000000003',
  jobApply: 'd0000000-0000-4000-8000-000000000004',
  booking: 'e0000000-0000-4000-8000-000000000001',
  bookingGeo: 'e0000000-0000-4000-8000-000000000002',
  bookingConflict: 'e0000000-0000-4000-8000-000000000003',
  bookingApply: 'e0000000-0000-4000-8000-000000000004',
  dispute: 'f0000000-0000-4000-8000-000000000001',
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

async function asUser(userId, fn) {
  await client.query(`SET LOCAL request.jwt.claim.sub = '${userId}'`);
  return fn();
}

async function rpc(fn, args = []) {
  const placeholders = args.map((_, i) => `$${i + 1}`).join(', ');
  const { rows } = await client.query(`SELECT public.${fn}(${placeholders}) AS result`, args);
  return rows[0].result;
}

async function main() {
  await client.connect();
  await client.query('BEGIN');

  try {
    // ---------------------------------------------------------------- fixtures
    const nowIst = `(now() AT TIME ZONE 'Asia/Kolkata')`;
    for (const [id, email] of [
      [ids.orgA, 'org-a@opskil.test'],
      [ids.orgB, 'org-b@opskil.test'],
      [ids.worker, 'worker-a@opskil.test'],
      [ids.worker2, 'worker-b@opskil.test'],
      [ids.admin, 'admin@opskil.test'],
    ]) {
      await client.query(
        `INSERT INTO auth.users (id, email) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING`,
        [id, email]
      );
      await client.query(
        `INSERT INTO public.profiles (id, role, full_name, email, city, is_active)
         VALUES ($1, $2, $3, $4, 'Mumbai', true)
         ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, is_active = true`,
        [id, id === ids.admin ? 'admin' : id.startsWith(ids.orgA) || id === ids.orgB ? 'organizer' : 'worker', email.split('@')[0], email]
      );
    }

    for (const id of [ids.orgA, ids.orgB]) {
      await client.query(
        `INSERT INTO public.organizer_profiles (id, business_name) VALUES ($1, 'Test Org')
         ON CONFLICT (id) DO NOTHING`,
        [id]
      );
    }
    for (const id of [ids.worker, ids.worker2]) {
      await client.query(
        `INSERT INTO public.worker_profiles (id, verification_status, upi_id)
         VALUES ($1, 'verified', 'worker@upi') ON CONFLICT (id) DO UPDATE SET verification_status = 'verified', upi_id = 'worker@upi'`,
        [id]
      );
    }

    const jobInsert = `
      INSERT INTO public.jobs
        (id, organizer_id, title, category, venue_name, venue_address, zone,
         date, start_time, end_time, duration_hours, hourly_rate, total_pay,
         slots_total, supervisor_name, supervisor_phone, status, latitude, longitude)
      VALUES ($1, $2, 'Lifecycle Test', 'hospitality', 'Venue', 'Address', 'BKC',
         ${nowIst}::date,
         (${nowIst} + interval '90 minutes')::time,
         (${nowIst} + interval '9 hours 30 minutes')::time,
         8, 500, 4000, 2, 'Supervisor', '9000000000', 'open', $3, $4)`;

    await client.query(jobInsert, [ids.job, ids.orgA, null, null]);
    await client.query(jobInsert, [ids.jobGeo, ids.orgA, 19.076, 72.8777]);
    await client.query(
      `INSERT INTO public.jobs
        (id, organizer_id, title, category, venue_name, venue_address, zone,
         date, start_time, end_time, duration_hours, hourly_rate, total_pay,
         slots_total, supervisor_name, supervisor_phone, status, latitude, longitude)
       SELECT $1, $2, 'Apply Test', 'hospitality', 'Venue', 'Address', 'BKC',
         date, start_time, end_time, 8, 500, 4000, 2, 'Supervisor', '9000000000', 'open', $3, $4
       FROM public.jobs WHERE id = $5`,
      [ids.jobConflict, ids.orgA, null, null, ids.job]
    );
    await client.query(
      `INSERT INTO public.jobs
        (id, organizer_id, title, category, venue_name, venue_address, zone,
         date, start_time, end_time, duration_hours, hourly_rate, total_pay,
         slots_total, supervisor_name, supervisor_phone, status, latitude, longitude)
       SELECT $1, $2, 'Apply Test', 'hospitality', 'Venue', 'Address', 'BKC',
         date, start_time, end_time, 8, 500, 4000, 2, 'Supervisor', '9000000000', 'open', $3, $4
       FROM public.jobs WHERE id = $5`,
      [ids.jobApply, ids.orgA, null, null, ids.job]
    );

    const bookingInsert = `
      INSERT INTO public.bookings
        (id, job_id, worker_id, organizer_id, status, agreed_hourly_rate,
         agreed_total_pay, check_in_code)
      VALUES ($1, $2, $3, $4, $5, 500, 4000, 'CODE123')`;
    await client.query(bookingInsert, [ids.booking, ids.job, ids.worker, ids.orgA, 'selected_awaiting_confirmation']);
    await client.query(bookingInsert, [ids.bookingGeo, ids.jobGeo, ids.worker2, ids.orgA, 'confirmed']);

    // ------------------------------------------------- 1. confirm selection
    console.log('\n[1] Worker confirms a selected offer');
    const confirm = await asUser(ids.worker, () => rpc('worker_confirm_selection_safe', [ids.booking]));
    check('confirm succeeds', confirm.success === true, JSON.stringify(confirm));
    check('booking confirmed', confirm.status === 'confirmed', JSON.stringify(confirm));
    const confirmedRow = (await client.query('SELECT status, check_in_code FROM bookings WHERE id=$1', [ids.booking])).rows[0];
    check('persisted status is confirmed', confirmedRow.status === 'confirmed', confirmedRow.status);
    const jobAfterConfirm = (await client.query('SELECT slots_filled FROM jobs WHERE id=$1', [ids.job])).rows[0];
    check('slots_filled incremented to 1', Number(jobAfterConfirm.slots_filled) === 1, String(jobAfterConfirm.slots_filled));

    const confirmAgain = await asUser(ids.worker, () => rpc('worker_confirm_selection_safe', [ids.booking]));
    check('repeat confirmation is idempotent', confirmAgain.success === true && confirmAgain.already_confirmed === true, JSON.stringify(confirmAgain));

    // ------------------------------------------------- 2. schedule conflict
    console.log('\n[2] Overlapping confirmed shift is rejected');
    await client.query(bookingInsert, [ids.bookingConflict, ids.jobConflict, ids.worker, ids.orgA, 'selected_awaiting_confirmation']);
    const conflict = await asUser(ids.worker, () => rpc('worker_confirm_selection_safe', [ids.bookingConflict]));
    check('overlap returns SCHEDULE_CONFLICT', conflict.success === false && conflict.error_code === 'SCHEDULE_CONFLICT', JSON.stringify(conflict));

    // ------------------------------------------------- 3. check-in
    console.log('\n[3] Worker check-in writes a valid attendance row');
    const checkIn = await asUser(ids.worker, () => rpc('check_in_worker_safe', [ids.booking, 'CODE123', null, null]));
    check('check-in succeeds', checkIn.success === true, JSON.stringify(checkIn));
    const attendance = (await client.query(
      'SELECT job_id, worker_id, check_in_time, latitude, longitude FROM attendance_records WHERE booking_id=$1',
      [ids.booking]
    )).rows;
    check('one attendance row created', attendance.length === 1, `rows=${attendance.length}`);
    check('attendance has job_id and worker_id', attendance[0]?.job_id === ids.job && attendance[0]?.worker_id === ids.worker, JSON.stringify(attendance[0]));

    const checkInAgain = await asUser(ids.worker, () => rpc('check_in_worker_safe', [ids.booking, 'CODE123', null, null]));
    const attendanceCount = (await client.query('SELECT count(*)::int AS c FROM attendance_records WHERE booking_id=$1', [ids.booking])).rows[0].c;
    check('repeat check-in is idempotent', checkInAgain.success === true && checkInAgain.already_checked_in === true && attendanceCount === 1, JSON.stringify({ checkInAgain, attendanceCount }));

    // ------------------------------------------------- 4. geofence
    console.log('\n[4] Geofence requires coordinates and rejects distant check-in');
    const noGps = await asUser(ids.worker2, () => rpc('check_in_worker_safe', [ids.bookingGeo, 'CODE123', null, null]));
    check('missing GPS returns GPS_COORDINATES_REQUIRED', noGps.success === false && noGps.error_code === 'GPS_COORDINATES_REQUIRED', JSON.stringify(noGps));
    const farAway = await asUser(ids.worker2, () => rpc('check_in_worker_safe', [ids.bookingGeo, 'CODE123', 19.5, 73.2]));
    check('distant check-in returns OUT_OF_GEOFENCE_RANGE', farAway.success === false && farAway.error_code === 'OUT_OF_GEOFENCE_RANGE', JSON.stringify(farAway));

    // ------------------------------------------------- 5. completion
    console.log('\n[5] Organizer approves attendance and pay is derived from verified hours');
    const complete = await asUser(ids.orgA, () => rpc('complete_shift_and_approve_attendance', [ids.booking, 8]));
    check('completion succeeds', complete.success === true, JSON.stringify(complete));
    check('approved pay equals 8h x 500', Number(complete.approved_total_pay) === 4000, JSON.stringify(complete));
    const completedRow = (await client.query('SELECT status, approved_total_pay FROM bookings WHERE id=$1', [ids.booking])).rows[0];
    check('booking persisted as completed', completedRow.status === 'completed', JSON.stringify(completedRow));
    check('approved_total_pay persisted', Number(completedRow.approved_total_pay) === 4000, JSON.stringify(completedRow));
    const attendanceAfter = (await client.query('SELECT hours_worked, verified_by_supervisor FROM attendance_records WHERE booking_id=$1', [ids.booking])).rows[0];
    check('attendance hours persisted', Number(attendanceAfter.hours_worked) === 8, JSON.stringify(attendanceAfter));
    check('attendance verified by supervisor', attendanceAfter.verified_by_supervisor === true, JSON.stringify(attendanceAfter));

    const unauthorized = await asUser(ids.orgB, () => rpc('complete_shift_and_approve_attendance', [ids.bookingGeo, 4]));
    check('non-owner completion is rejected', unauthorized.success === false && unauthorized.error_code === 'UNAUTHORIZED', JSON.stringify(unauthorized));

    // ------------------------------------------------- 6. dispute
    console.log('\n[6] Admin resolves a dispute with a booking outcome');
    await client.query(
      `INSERT INTO public.disputes (id, booking_id, raised_by, respondent_id, reason, details, status)
       VALUES ($1, $2, $3, $4, 'Unpaid hours', 'Worker claims 8 hours', 'open')`,
      [ids.dispute, ids.booking, ids.worker, ids.orgA]
    );
    const resolved = await asUser(ids.admin, () =>
      rpc('admin_resolve_dispute_safe', [ids.dispute, 'resolved', 'Verified attendance logs', 'completed', 3800])
    );
    check('dispute resolution succeeds', resolved.success === true, JSON.stringify(resolved));
    const disputeRow = (await client.query('SELECT status, assigned_to, updated_at FROM disputes WHERE id=$1', [ids.dispute])).rows[0];
    check('dispute assigned and timestamped', disputeRow.status === 'resolved' && disputeRow.assigned_to === ids.admin && disputeRow.updated_at !== null, JSON.stringify(disputeRow));
    const adjusted = (await client.query('SELECT approved_total_pay FROM bookings WHERE id=$1', [ids.booking])).rows[0];
    check('adjusted payout persisted', Number(adjusted.approved_total_pay) === 3800, JSON.stringify(adjusted));

    const nonAdmin = await asUser(ids.orgA, () =>
      rpc('admin_resolve_dispute_safe', [ids.dispute, 'resolved', 'self approval', 'completed', 4000])
    );
    check('non-admin cannot resolve disputes', nonAdmin.success === false, JSON.stringify(nonAdmin));

    // ------------------------------------------------- 7. invoice authorization
    console.log('\n[7] Invoice generation is authorized');
    const invoiceDenied = await asUser(ids.orgB, () => rpc('generate_job_invoice_safe', [ids.job]));
    check('foreign organizer cannot invoice job', invoiceDenied.success === false && invoiceDenied.error_code === 'UNAUTHORIZED', JSON.stringify(invoiceDenied));

    // ------------------------------------------------- 7b. apply / select / checkout
    console.log('\n[7b] Apply, shortlist, confirm and check out');
    const applied = await asUser(ids.worker, () => rpc('apply_for_job_safe', [ids.jobApply, 'Available']));
    check('worker can apply', applied.success === true, JSON.stringify(applied));
    const applicationId = applied.application?.id;
    const appliedAgain = await asUser(ids.worker, () => rpc('apply_for_job_safe', [ids.jobApply, 'Available']));
    check('duplicate application is rejected', appliedAgain.success === false, JSON.stringify(appliedAgain));

    const shortlisted = await asUser(ids.orgA, () => rpc('update_application_status_safe', [applicationId, 'shortlisted']));
    check('organizer can shortlist', shortlisted.success === true, JSON.stringify(shortlisted));

    const confirmedBooking = await asUser(ids.orgA, () => rpc('confirm_worker_booking_safe', [ids.jobApply, ids.worker]));
    check('organizer can confirm worker booking', confirmedBooking.success === true, JSON.stringify(confirmedBooking));

    const newBooking = (await client.query(
      `SELECT id, check_in_code FROM bookings WHERE job_id=$1 AND worker_id=$2`,
      [ids.jobApply, ids.worker]
    )).rows[0];
    check('confirmed booking exists', Boolean(newBooking?.id), JSON.stringify(newBooking));

    const applyCheckIn = await asUser(ids.worker, () => rpc('check_in_worker_safe', [newBooking.id, newBooking.check_in_code, null, null]));
    check('confirmed worker can check in', applyCheckIn.success === true, JSON.stringify(applyCheckIn));

    const checkedOut = await asUser(ids.worker, () => rpc('check_out_worker_safe', [newBooking.id, 'Done']));
    check('worker can check out', checkedOut.success === true, JSON.stringify(checkedOut));
    const checkoutRow = (await client.query('SELECT status, check_out_time FROM bookings WHERE id=$1', [newBooking.id])).rows[0];
    check('checkout persisted', checkoutRow.status === 'checked_out' && checkoutRow.check_out_time !== null, JSON.stringify(checkoutRow));

    // ------------------------------------------------- 8. payout authorization
    console.log('\n[8] Payout initiation is authorized and uses approved pay');
    await client.query(`UPDATE bookings SET status='cancelled' WHERE id=$1`, [ids.bookingGeo]);
    const invoice = await asUser(ids.orgA, () => rpc('generate_job_invoice_safe', [ids.job]));
    check('organizer can generate invoice', invoice.success === true, JSON.stringify(invoice));
    check('invoice bills actual attended slot', Number(invoice.wage_total) === 4000, JSON.stringify(invoice));

    await client.query(`UPDATE organizer_invoices SET status='escrow_funded' WHERE job_id=$1`, [ids.job]);

    const payoutDenied = await asUser(ids.orgB, () => rpc('initiate_worker_payout_safe', [ids.booking, 'worker@upi', null]));
    check('foreign organizer cannot initiate payout', payoutDenied.success === false && payoutDenied.error_code === 'UNAUTHORIZED', JSON.stringify(payoutDenied));

    const payout = await asUser(ids.orgA, () => rpc('initiate_worker_payout_safe', [ids.booking, 'worker@upi', 'idem-1']));
    check('organizer can initiate payout', payout.success === true, JSON.stringify(payout));
    check('payout uses approved adjusted pay', Number(payout.amount) === 3800, JSON.stringify(payout));

    const payoutAgain = await asUser(ids.orgA, () => rpc('initiate_worker_payout_safe', [ids.booking, 'worker@upi', 'idem-1']));
    check('repeat payout is idempotent', payoutAgain.payment_id === payout.payment_id, JSON.stringify(payoutAgain));

    // ------------------------------------------------- 9. fiscal sequence
    console.log('\n[9] Fiscal sequence is not client-writable');
    const rls = (await client.query(`SELECT relrowsecurity FROM pg_class WHERE oid='public.invoice_fiscal_sequences'::regclass`)).rows[0];
    check('RLS enabled on invoice_fiscal_sequences', rls.relrowsecurity === true, JSON.stringify(rls));
    const grants = (await client.query(
      `SELECT has_table_privilege('authenticated','public.invoice_fiscal_sequences','UPDATE') AS can_update,
              has_table_privilege('anon','public.invoice_fiscal_sequences','SELECT') AS anon_select`
    )).rows[0];
    check('authenticated cannot UPDATE sequence', grants.can_update === false, JSON.stringify(grants));
    check('anon cannot SELECT sequence', grants.anon_select === false, JSON.stringify(grants));

    console.log(`\nRESULT: ${passed} passed, ${failed} failed`);
    if (failed > 0) {
      throw new Error(`${failed} lifecycle regression check(s) failed`);
    }
  } finally {
    await client.query('ROLLBACK').catch(() => {});
    await client.end();
  }
}

main().catch((err) => {
  console.error('\nLIFECYCLE TEST ERROR:', err.message);
  process.exit(1);
});
