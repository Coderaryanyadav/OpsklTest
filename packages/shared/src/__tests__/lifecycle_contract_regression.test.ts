import { describe, it, expect } from '@jest/globals';
import fs from 'fs';
import path from 'path';

/**
 * Static contract guards for defects that cannot be exercised by the mocked
 * unit suite. Behavioral proof for the SQL lives in
 * `scripts/test_lifecycle_db.mjs` (run against a disposable migrated database).
 */
const repoRoot = path.resolve(__dirname, '../../../..');
const read = (relative: string) => fs.readFileSync(path.join(repoRoot, relative), 'utf8');

describe('Lifecycle Contract Regression Guards', () => {
  describe('Attendance RPC schema contract', () => {
    const migration = read(
      'supabase/migrations/20261022000001_fix_attendance_contracts_and_fiscal_rls.sql'
    );

    it('restores the missing booking audit columns used by lifecycle RPCs', () => {
      expect(migration).toContain('ADD COLUMN IF NOT EXISTS updated_at');
      expect(migration).toContain('ADD COLUMN IF NOT EXISTS created_at');
      expect(migration).toContain('trg_bookings_updated_at');
    });

    it('writes only columns that exist on attendance_records', () => {
      expect(migration).not.toContain('worker_latitude');
      expect(migration).not.toContain('worker_longitude');
      expect(migration).toContain('INSERT INTO attendance_records');
      expect(migration).toContain('booking_id, job_id, worker_id');
      expect(migration).toContain('distance_to_venue_km');
    });

    it('removes the ambiguous completion overload', () => {
      expect(migration).toContain(
        'DROP FUNCTION IF EXISTS public.complete_shift_and_approve_attendance(UUID, NUMERIC);'
      );
      expect(migration).toContain('approved_total_pay = v_final_pay');
      expect(migration).toContain('p_overtime_approved BOOLEAN DEFAULT false');
    });

    it('does not trust current_user inside SECURITY DEFINER for admin checks', () => {
      expect(migration).not.toContain("current_user IN ('postgres'");
      expect(migration).toContain("COALESCE(auth.role(), '') = 'service_role'");
    });

    it('applies RLS and removes client DML from the fiscal sequence', () => {
      expect(migration).toContain('ENABLE ROW LEVEL SECURITY');
      expect(migration).toContain(
        'REVOKE ALL ON TABLE public.invoice_fiscal_sequences FROM PUBLIC, anon, authenticated'
      );
    });

    it('does not let SECURITY DEFINER trigger ownership bypass verification guards', () => {
      const escalation = read(
        'supabase/migrations/20261022000004_fix_privilege_escalation_triggers.sql'
      );
      expect(escalation).not.toContain("current_user IN ('postgres'");
      expect(escalation).toContain("session_user IN ('postgres', 'supabase_admin')");
      expect(escalation).toContain('{2,255}');
      expect(escalation).toContain("status NOT IN ('escrow_locked', 'processing')");
    });

    it('never compares shift_status to the non-existent closed literal', () => {
      const confirmation = read(
        'supabase/migrations/20261022000002_fix_offer_confirmation_enum_guard.sql'
      );
      expect(confirmation).not.toContain("'cancelled', 'closed'");
      expect(confirmation).toContain("IN ('cancelled', 'completed')");
    });
  });

  describe('Client workflow guards', () => {
    it('never checks in against an unrelated fallback booking', () => {
      const checkin = read('apps/worker/app/shift/checkin.tsx');
      expect(checkin).not.toContain('bookings[0]');
      expect(checkin).toContain('setBooking(found ?? null)');
    });

    it('does not fake screening success when the mutation fails', () => {
      const screening = read('apps/organizer/app/shift/screening.tsx');
      expect(screening).not.toContain('res.success || true');
      expect(screening).toContain('Could not shortlist candidate.');
      expect(screening).toContain('Could not decline candidate.');
    });

    it('marks the worker profile complete even when UPI is deferred', () => {
      const onboarding = read('apps/worker/app/onboarding.tsx');
      const submitBlock = onboarding.slice(
        onboarding.indexOf('const handleSubmitVerification'),
        onboarding.indexOf('const handleSubmitVerification') + 2500
      );
      expect(submitBlock).toContain('profileCompletionStatus: \'completed\'');
      expect(submitBlock).not.toContain('if (upiId.trim()) {');
    });

    it('does not claim UPI disbursement without a payout rail', () => {
      const earnings = read('apps/worker/app/(tabs)/earnings.tsx');
      expect(earnings).not.toContain('DISBURSED VIA UPI');
      expect(earnings).toContain('MANUAL RECONCILIATION');
      expect(earnings).toContain('PDF statement export is not implemented');
    });

    it('does not hardcode fabricated organizer wage pools or automated payouts', () => {
      const finances = read('apps/organizer/app/(tabs)/finances.tsx');
      expect(finances).not.toContain('14,400');
      expect(finances).not.toContain('Automated disbursement');
    });

    it('sanitizes the admin post-login redirect', () => {
      const login = read('apps/admin/src/app/login/page.tsx');
      expect(login).toContain("rawRedirect.startsWith('/')");
      expect(login).toContain("!rawRedirect.startsWith('//')");
    });

    it('generates a non-static offline gate code', () => {
      const offline = read('packages/shared/src/services/offline_queue_service.ts');
      expect(offline).not.toContain("backupPin: '884 - 219'");
      expect(offline).not.toContain("tokenHash: '7f83b1657ff1fc53b92dc'");
      expect(offline).toContain('randomBytes');
    });

    it('never fabricates a check-in pass code or rotating token UI', () => {
      const modal = read('apps/worker/src/components/GeofencedCheckInModal.tsx');
      const jobs = read('packages/shared/src/supabase/jobs.ts');
      expect(modal).not.toContain('8842JW');
      expect(modal).not.toContain('884219');
      expect(modal).not.toContain('Token refreshes in');
      expect(modal).toContain("const rawCode = booking?.checkInCode || '';");
      expect(jobs).not.toContain('OP-${row.id.slice');
    });

    it('sends the dispute booking outcome instead of an ignored admin id', () => {
      const admin = read('packages/shared/src/supabase/admin.ts');
      const disputeFn = admin.slice(
        admin.indexOf('export async function resolveDisputeSafe'),
        admin.indexOf('export async function', admin.indexOf('export async function resolveDisputeSafe') + 10)
      );
      expect(disputeFn).toContain('p_booking_outcome');
      expect(disputeFn).not.toContain('p_admin_id');
    });
  });
});
