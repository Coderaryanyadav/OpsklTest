#!/usr/bin/env node
/**
 * API/RLS end-to-end workflow against the disposable local Supabase stack.
 *
 * Uses real GoTrue password sessions and PostgREST RPCs. No RLS bypass is used
 * for the workflow itself; the service-role client is only used to (a) verify
 * persisted state and (b) time-travel attendance rows in this disposable DB.
 * Financial actions are explicit test-mode ledger entries; no provider is called.
 */
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL || process.env.TEST_API_URL;
const anonKey = process.env.SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !anonKey || !serviceKey) {
  console.error('Missing SUPABASE_URL, SUPABASE_ANON_KEY, or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(2);
}
const host = new URL(url).hostname;
if (!['127.0.0.1', 'localhost', 'opskl-test-api'].includes(host)) {
  console.error(`Refusing non-loopback Supabase URL host: ${host}`);
  process.exit(2);
}

const runId = process.env.TEST_RUN_ID || new Date().toISOString().replace(/\D/g, '').slice(0, 14);
const emails = {
  admin: process.env.ADMIN_EMAIL || 'admin@test.opskil.local',
  worker: process.env.WORKER_EMAIL || 'worker@test.opskil.local',
  organizer: process.env.ORGANIZER_EMAIL || 'organizer@test.opskil.local',
};
const passwords = {
  admin: process.env.ADMIN_PASSWORD || 'OpsklTestAdmin!2026',
  worker: process.env.WORKER_PASSWORD || 'OpsklTestWorker!2026',
  organizer: process.env.ORGANIZER_PASSWORD || 'OpsklTestOrganizer!2026',
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
function fatal(where, error) {
  console.error(`FATAL ${where}: ${error?.message || error}`);
  process.exit(1);
}

function makeClient() {
  return createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
async function signIn(key) {
  const client = makeClient();
  const { data, error } = await client.auth.signInWithPassword({
    email: emails[key],
    password: passwords[key],
  });
  if (error) fatal(`signIn ${key}`, error);
  return { client, userId: data.user.id };
}

function kolkataParts(offsetMs) {
  const d = new Date(Date.now() + offsetMs);
  const date = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
  const time = (dateObj) =>
    new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(dateObj);
  return { date, start: time(d), end: time(new Date(d.getTime() + 8 * 60 * 60 * 1000)) };
}

async function main() {
  console.log('\n[1] Auth and role isolation');
  const admin = await signIn('admin');
  const worker = await signIn('worker');
  const organizer = await signIn('organizer');
  const service = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const anon = makeClient();
  const anonRead = await anon.from('verification_cases').select('id').limit(1);
  check('unauthenticated cannot read KYC cases', !anonRead.error && (anonRead.data || []).length === 0, JSON.stringify(anonRead.error || anonRead.data));

  const workerAdminAttempt = await worker.client.rpc('admin_verify_case_safe', {
    p_case_id: '00000000-0000-4000-8000-000000000000',
    p_status: 'approved',
    p_rejection_reason: null,
    p_admin_id: worker.userId,
  });
  check('worker cannot invoke admin KYC approval', Boolean(workerAdminAttempt.error) || workerAdminAttempt.data?.success === false, JSON.stringify(workerAdminAttempt.error || workerAdminAttempt.data));

  const organizerAdminAttempt = await organizer.client.rpc('admin_mark_payout_settled', {
    p_payment_id: '00000000-0000-4000-8000-000000000000',
    p_utr: 'FORGED',
  });
  check('organizer cannot invoke admin settlement', Boolean(organizerAdminAttempt.error) || organizerAdminAttempt.data?.success === false, JSON.stringify(organizerAdminAttempt.error || organizerAdminAttempt.data));

  const workerInvoiceRead = await worker.client.from('organizer_invoices').select('id').limit(1);
  check('worker cannot read organizer invoices', !workerInvoiceRead.error && (workerInvoiceRead.data || []).length === 0, JSON.stringify(workerInvoiceRead.error || workerInvoiceRead.data));

  const adminProfile = await service.from('profiles').select('role,is_active').eq('id', admin.userId).single();
  check('admin identity is active admin', adminProfile.data?.role === 'admin' && adminProfile.data?.is_active === true, JSON.stringify(adminProfile.error || adminProfile.data));

  console.log('\n[2] Organizer publishes a shift');
  const schedule = kolkataParts(90 * 60 * 1000);
  const payload = {
    title: `Docker API Lifecycle Shift ${runId}`,
    category: 'hospitality',
    venue_name: 'Docker API Venue',
    venue_address: 'Bandra Kurla Complex, Mumbai',
    city: 'Mumbai',
    zone: 'BKC',
    latitude: 19.076,
    longitude: 72.8777,
    date: schedule.date,
    start_time: schedule.start,
    end_time: schedule.end,
    hourly_rate: 500,
    slots_total: 1,
    supervisor_name: 'Docker API Supervisor',
    supervisor_phone: '9000000104',
    duties: ['Guest greeting', 'Front desk support'],
    breaks_minutes: 30,
    meal_provided: true,
  };
  const created = await organizer.client.rpc('create_job_safe', {
    p_job: payload,
    p_organizer_id: organizer.userId,
  });
  check('verified organizer can publish shift', created.data?.success === true, JSON.stringify(created.error || created.data));
  if (!created.data?.success) throw new Error('cannot continue without a job');
  const jobId = created.data.job_id;

  const workerPost = await worker.client.rpc('create_job_safe', {
    p_job: { ...payload, title: 'Worker Forged Shift' },
    p_organizer_id: organizer.userId,
  });
  check('worker cannot publish a shift for an organizer', workerPost.data?.success === false && workerPost.data?.error_code === 'UNAUTHORIZED', JSON.stringify(workerPost.error || workerPost.data));

  const jobRow = await service.from('jobs').select('status,slots_total,slots_filled,hourly_rate,total_pay,organizer_id').eq('id', jobId).single();
  check('shift is open with one slot and server-derived pay', jobRow.data?.status === 'open' && jobRow.data?.slots_total === 1 && jobRow.data?.slots_filled === 0 && Number(jobRow.data?.total_pay) === 4000, JSON.stringify(jobRow.error || jobRow.data));

  console.log('\n[3] Worker discovers and applies');
  const feed = await worker.client.rpc('get_discovery_feed', {
    p_filters: { city: 'Mumbai' },
    p_limit: 50,
  });
  check('worker discovery feed contains the shift', Array.isArray(feed.data) && feed.data.some((row) => row.id === jobId), JSON.stringify(feed.error || `rows=${feed.data?.length}`));

  const applied = await worker.client.rpc('apply_for_job_safe', {
    p_job_id: jobId,
    p_notes: 'Docker API test application',
  });
  check('worker can apply to the shift', applied.data?.success === true, JSON.stringify(applied.error || applied.data));
  const applicationId = applied.data?.application_id || applied.data?.application?.id;
  if (!applicationId) throw new Error('application id missing');

  const appRow = await service.from('job_applications').select('status').eq('id', applicationId).single();
  check('application is not represented as confirmed/hired', appRow.data?.status !== 'confirmed' && appRow.data?.status !== 'hired', JSON.stringify(appRow.error || appRow.data));
  const bookingBefore = await service.from('bookings').select('id').eq('job_id', jobId);
  check('applying does not create a booking', !bookingBefore.error && (bookingBefore.data || []).length === 0, JSON.stringify(bookingBefore.error || bookingBefore.data));

  const duplicateApply = await worker.client.rpc('apply_for_job_safe', {
    p_job_id: jobId,
    p_notes: 'Duplicate submit',
  });
  check('duplicate application is rejected safely', duplicateApply.data?.success === false, JSON.stringify(duplicateApply.error || duplicateApply.data));

  const shortlisted = await organizer.client.rpc('update_application_status_safe', {
    p_application_id: applicationId,
    p_new_status: 'shortlisted',
  });
  check('organizer can shortlist the applicant', shortlisted.data?.success === true, JSON.stringify(shortlisted.error || shortlisted.data));

  console.log('\n[4] Offer, acceptance, and capacity');
  const offer = await organizer.client.rpc('select_worker_offer_safe', {
    p_job_id: jobId,
    p_worker_id: worker.userId,
    p_notes: 'Docker API offer',
  });
  check('organizer can send a shift offer', offer.data?.success === true, JSON.stringify(offer.error || offer.data));
  const bookingId = offer.data?.booking_id;
  const code = offer.data?.check_in_code;
  check('offer has a server-generated attendance code', typeof code === 'string' && code.startsWith('OP-'), JSON.stringify({ bookingId, code: code ? 'present' : 'missing' }));

  const bookingOffered = await service.from('bookings').select('status').eq('id', bookingId).single();
  check('booking awaits worker confirmation before acceptance', bookingOffered.data?.status === 'selected_awaiting_confirmation', JSON.stringify(bookingOffered.error || bookingOffered.data));

  const duplicateOffer = await organizer.client.rpc('select_worker_offer_safe', {
    p_job_id: jobId,
    p_worker_id: worker.userId,
    p_notes: 'Duplicate offer',
  });
  check('duplicate offer for the filled slot is rejected', duplicateOffer.data?.success === false, JSON.stringify(duplicateOffer.error || duplicateOffer.data));

  const accepted = await worker.client.rpc('worker_confirm_selection_safe', {
    p_booking_or_job_id: bookingId,
  });
  check('worker can accept the offer', accepted.data?.success === true && accepted.data?.status === 'confirmed', JSON.stringify(accepted.error || accepted.data));

  const acceptAgain = await worker.client.rpc('worker_confirm_selection_safe', {
    p_booking_or_job_id: bookingId,
  });
  check('duplicate acceptance is handled without a second booking', acceptAgain.data?.success === false || acceptAgain.data?.status === 'confirmed', JSON.stringify(acceptAgain.error || acceptAgain.data));

  const filled = await service.from('jobs').select('status,slots_filled').eq('id', jobId).single();
  check('job is filled after acceptance', filled.data?.status === 'filled' && filled.data?.slots_filled === 1, JSON.stringify(filled.error || filled.data));
  const bookings = await service.from('bookings').select('id,status').eq('job_id', jobId);
  check('no overbooking or duplicate active assignment', (bookings.data || []).length === 1 && bookings.data[0].status === 'confirmed', JSON.stringify(bookings.error || bookings.data));

  console.log('\n[5] Attendance lifecycle');
  const badCode = await worker.client.rpc('check_in_worker_safe', {
    p_booking_id: bookingId,
    p_code: 'OP-WRONG',
    p_lat: 19.076,
    p_lng: 72.8777,
  });
  check('invalid attendance code is rejected', badCode.data?.success === false, JSON.stringify(badCode.error || badCode.data));

  const outside = await worker.client.rpc('check_in_worker_safe', {
    p_booking_id: bookingId,
    p_code: code,
    p_lat: 19.2,
    p_lng: 72.9,
  });
  check('check-in outside the geofence is rejected', outside.data?.success === false, JSON.stringify(outside.error || outside.data));

  const checkIn = await worker.client.rpc('check_in_worker_safe', {
    p_booking_id: bookingId,
    p_code: code,
    p_lat: 19.076,
    p_lng: 72.8777,
  });
  check('worker can check in at the venue geofence', checkIn.data?.success === true, JSON.stringify(checkIn.error || checkIn.data));

  const duplicateCheckIn = await worker.client.rpc('check_in_worker_safe', {
    p_booking_id: bookingId,
    p_code: code,
    p_lat: 19.076,
    p_lng: 72.8777,
  });
  check('duplicate check-in is idempotent and flagged as already checked in', duplicateCheckIn.data?.success === true && duplicateCheckIn.data?.already_checked_in === true, JSON.stringify(duplicateCheckIn.error || duplicateCheckIn.data));

  // Disposable test fixture only: make the 15-minute minimum elapsed without
  // waiting in real time. This does not bypass the checkout RPC's own checks.
  const past = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const tt1 = await service.from('bookings').update({ check_in_time: past }).eq('id', bookingId);
  const tt2 = await service.from('attendance_records').update({ check_in_time: past }).eq('booking_id', bookingId);
  check('disposable attendance timestamps prepared for checkout test', !tt1.error && !tt2.error, JSON.stringify(tt1.error || tt2.error));

  const checkOut = await worker.client.rpc('check_out_worker_safe', {
    p_booking_id: bookingId,
    p_notes: 'Docker API shift complete',
  });
  check('worker can check out after minimum duration', checkOut.data?.success === true, JSON.stringify(checkOut.error || checkOut.data));

  const completed = await organizer.client.rpc('complete_shift_and_approve_attendance', {
    p_booking_id: bookingId,
    p_verified_hours: 8,
    p_overtime_approved: false,
    p_notes: 'Docker API supervisor approval',
  });
  check('organizer can approve attendance and pay', completed.data?.success === true, JSON.stringify(completed.error || completed.data));

  const completedRow = await service.from('bookings').select('status,approved_total_pay').eq('id', bookingId).single();
  check('booking is completed with approved pay', completedRow.data?.status === 'completed' && Number(completedRow.data?.approved_total_pay) === 4000, JSON.stringify(completedRow.error || completedRow.data));

  console.log('\n[6] Invoice, funding, payout, and settlement (test-mode ledger)');
  const invoice = await organizer.client.rpc('generate_job_invoice_safe', {
    p_job_id: jobId,
    p_organizer_id: organizer.userId,
  });
  check('organizer can generate the invoice', invoice.data?.success === true, JSON.stringify(invoice.error || invoice.data));
  const invoiceId = invoice.data?.invoice_id;

  const invoiceRow = await service.from('organizer_invoices').select('status,total_payable').eq('id', invoiceId).single();
  check('invoice is issued with server-calculated total', invoiceRow.data?.status === 'issued' && Number(invoiceRow.data?.total_payable) > 4000, JSON.stringify(invoiceRow.error || invoiceRow.data));

  const funded = await admin.client.rpc('admin_mark_invoice_funded', {
    p_invoice_id: invoiceId,
    p_reference: `TEST-DOCKER-FUNDING-${runId}`,
  });
  check('admin can mark invoice funded in the test ledger', funded.data?.success === true, JSON.stringify(funded.error || funded.data));

  const payout = await organizer.client.rpc('initiate_worker_payout_safe', {
    p_booking_id: bookingId,
    p_upi_id: 'dockerworker@upi',
    p_idempotency_key: `docker-api-payout-${runId}`,
  });
  check('organizer can initiate a test-mode payout', payout.data?.success === true && payout.data?.status === 'escrow_locked', JSON.stringify(payout.error || payout.data));
  check('payout amount equals approved pay', Number(payout.data?.amount) === 4000, JSON.stringify(payout.data));
  const paymentId = payout.data?.payment_id;

  const duplicatePayout = await organizer.client.rpc('initiate_worker_payout_safe', {
    p_booking_id: bookingId,
    p_upi_id: 'dockerworker@upi',
    p_idempotency_key: `docker-api-payout-${runId}`,
  });
  check('payout idempotency key does not create a second payment', duplicatePayout.data?.success === true && duplicatePayout.data?.payment_id === paymentId, JSON.stringify(duplicatePayout.error || duplicatePayout.data));

  const settled = await admin.client.rpc('admin_mark_payout_settled', {
    p_payment_id: paymentId,
    p_utr: `TESTUTR-DOCKER-${runId}`,
  });
  check('admin can settle the test-mode payout', settled.data?.success === true && settled.data?.status === 'settled', JSON.stringify(settled.error || settled.data));

  const paymentRow = await service.from('payment_records').select('status,net_payout,utr_reference').eq('id', paymentId).single();
  check('payment ledger is settled with test UTR', paymentRow.data?.status === 'settled' && Number(paymentRow.data?.net_payout) === 4000 && paymentRow.data?.utr_reference === `TESTUTR-DOCKER-${runId}`, JSON.stringify(paymentRow.error || paymentRow.data));

  const differentUtr = await admin.client.rpc('admin_mark_payout_settled', {
    p_payment_id: paymentId,
    p_utr: `TESTUTR-DOCKER-DIFFERENT-${runId}`,
  });
  check('re-settlement with a different UTR is rejected', differentUtr.data?.success === false, JSON.stringify(differentUtr.error || differentUtr.data));

  const adminCheck = await admin.client.rpc('is_current_admin');
  check('admin session is recognized by is_current_admin', adminCheck.data === true, JSON.stringify(adminCheck.error || adminCheck.data));
  const workerAdminCheck = await worker.client.rpc('is_current_admin');
  check('worker session is not recognized as admin', workerAdminCheck.data === false, JSON.stringify(workerAdminCheck.error || workerAdminCheck.data));

  console.log(`\nRESULT: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error('API WORKFLOW ERROR:', err?.stack || err?.message || err);
  process.exit(1);
});
