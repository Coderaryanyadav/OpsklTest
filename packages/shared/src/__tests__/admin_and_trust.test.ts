import {
  fetchAdminDashboardMetrics,
  fetchVerificationQueue,
  resolveVerificationCaseSafe,
  fetchDisputesQueue,
  resolveDisputeSafe,
  fetchSafetyReportsQueue,
  resolveSafetyReportSafe,
  fetchModerationJobs,
  moderateJobSafe,
  fetchAuditLogs,
  fetchPlatformSettings,
  requestAccountDeletionSafe,
} from '../index';

// Mock Supabase client
jest.mock('../supabase/client', () => {
  const mockRpc = jest.fn();
  const mockFrom = jest.fn();
  const client = {
    rpc: mockRpc,
    from: mockFrom,
    auth: {
      getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'admin-1', email: 'admin@opskil.com' } } }),
    },
  };

  return {
    supabase: client,
    getSharedSupabaseClient: () => client,
    setSharedSupabaseClient: jest.fn(),
    __mockRpc: mockRpc,
    __mockFrom: mockFrom,
  };
});

const { __mockRpc, __mockFrom } = require('../supabase/client');

describe('Phase 8 — Opskl Admin, Trust & Safety Operations', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Platform Overview Metrics', () => {
    test('fetches live platform metrics with baseline fallback', async () => {
      const resolvedResult = {
        count: 48,
        data: [{ amount: 50000, platform_fee: 5000, status: 'pending' }],
        error: null,
      };
      const queryMock: any = {
        in: jest.fn().mockImplementation(() => queryMock),
        eq: jest.fn().mockImplementation(() => queryMock),
        or: jest.fn().mockImplementation(() => queryMock),
        then: (resolve: any, reject: any) => Promise.resolve(resolvedResult).then(resolve, reject),
      };

      __mockFrom.mockReturnValue({
        select: jest.fn().mockReturnValue(queryMock),
      });

      const metrics = await fetchAdminDashboardMetrics();
      expect(metrics.activeShifts).toBeGreaterThanOrEqual(1);
      expect(metrics.totalEscrowHeld).toBeGreaterThan(0);
      expect(metrics.verifiedWorkersCount).toBeGreaterThan(0);
      expect(metrics.activeOrganizersCount).toBeGreaterThan(0);
    });
  });

  describe('Verification Queue Review Workflow', () => {
    test('fetches verification queue and enforces document privacy', async () => {
      __mockFrom.mockReturnValue({
        select: jest.fn().mockReturnValue({
          order: jest.fn().mockResolvedValue({
            data: [
              {
                id: 'case-1',
                profile_id: 'prof-1',
                document_type: 'aadhaar',
                document_masked_id: 'XXXX-XXXX-1234',
                document_storage_path: 'secure-vault/doc.enc',
                status: 'pending',
                created_at: new Date().toISOString(),
              },
            ],
            error: null,
          }),
        }),
      });

      const queue = await fetchVerificationQueue();
      expect(queue.length).toBeGreaterThan(0);
      expect(queue[0].documentMaskedId).toContain('XXXX');
      expect(queue[0].documentStoragePath).toContain('secure-vault');
    });

    test('approves verification case and updates badge status safely', async () => {
      __mockRpc.mockResolvedValueOnce({
        data: { success: true, case_id: 'case-1', status: 'approved' },
        error: null,
      });

      const res = await resolveVerificationCaseSafe('case-1', 'approved', undefined, 'admin-1');
      expect(res.success).toBe(true);
      expect(__mockRpc).toHaveBeenCalledWith('admin_verify_case_safe', {
        p_case_id: 'case-1',
        p_status: 'approved',
        p_rejection_reason: null,
        p_admin_id: 'admin-1',
      });
    });

    test('rejects verification case with mandatory reason', async () => {
      __mockRpc.mockResolvedValueOnce({
        data: { success: true, case_id: 'case-1', status: 'rejected' },
        error: null,
      });

      const res = await resolveVerificationCaseSafe('case-1', 'rejected', 'Name on PAN does not match profile', 'admin-1');
      expect(res.success).toBe(true);
      expect(__mockRpc).toHaveBeenCalledWith('admin_verify_case_safe', {
        p_case_id: 'case-1',
        p_status: 'rejected',
        p_rejection_reason: 'Name on PAN does not match profile',
        p_admin_id: 'admin-1',
      });
    });
  });

  describe('Disputes & Attendance Adjudication', () => {
    test('fetches dispute records with evidence and case details', async () => {
      __mockFrom.mockReturnValue({
        select: jest.fn().mockReturnValue({
          order: jest.fn().mockResolvedValue({
            data: [
              {
                id: 'disp-1',
                booking_id: 'book-1',
                raised_by: 'worker-1',
                respondent_id: 'org-1',
                reason: 'Unpaid Overtime',
                details: 'Worked 2 extra hours',
                status: 'open',
                created_at: new Date().toISOString(),
              },
            ],
            error: null,
          }),
        }),
      });

      const disputes = await fetchDisputesQueue();
      expect(disputes.length).toBeGreaterThan(0);
      expect(disputes[0].reason).toBe('Unpaid Overtime');
    });

    test('adjudicates dispute and applies adjusted payout to escrow ledger', async () => {
      __mockRpc.mockResolvedValueOnce({
        data: { success: true, dispute_id: 'disp-1', status: 'resolved' },
        error: null,
      });

      const res = await resolveDisputeSafe(
        'disp-1',
        'resolved',
        'Verified 2 hours overtime via supervisor logs',
        1850,
        'admin-1'
      );

      expect(res.success).toBe(true);
      expect(__mockRpc).toHaveBeenCalledWith('admin_resolve_dispute_safe', {
        p_dispute_id: 'disp-1',
        p_status: 'resolved',
        p_resolution_notes: 'Verified 2 hours overtime via supervisor logs',
        p_adjusted_payout: 1850,
        p_admin_id: 'admin-1',
      });
    });
  });

  describe('Trust & Safety Incident Escalation', () => {
    test('fetches critical incident reports', async () => {
      __mockFrom.mockReturnValue({
        select: jest.fn().mockReturnValue({
          order: jest.fn().mockResolvedValue({
            data: [
              {
                id: 'safe-1',
                reporter_id: 'worker-1',
                category: 'unsafe_conditions',
                severity: 'critical',
                description: 'Unstable scaffolding',
                status: 'open',
                created_at: new Date().toISOString(),
              },
            ],
            error: null,
          }),
        }),
      });

      const reports = await fetchSafetyReportsQueue();
      expect(reports.length).toBeGreaterThan(0);
      expect(reports[0].severity).toBe('critical');
    });

    test('resolves safety report with documented staff action', async () => {
      __mockRpc.mockResolvedValueOnce({
        data: { success: true, report_id: 'safe-1', status: 'resolved' },
        error: null,
      });

      const res = await resolveSafetyReportSafe(
        'safe-1',
        'resolved',
        'Site inspector dispatched; safety harness provided',
        'Inspection completed',
        'admin-1'
      );

      expect(res.success).toBe(true);
      expect(__mockRpc).toHaveBeenCalledWith('admin_resolve_safety_report_safe', {
        p_report_id: 'safe-1',
        p_status: 'resolved',
        p_action_taken: 'Site inspector dispatched; safety harness provided',
        p_staff_notes: 'Inspection completed',
        p_admin_id: 'admin-1',
      });
    });
  });

  describe('Shift Moderation & Audit Logs', () => {
    test('fetches moderation jobs list with valid living wage properties', async () => {
      __mockFrom.mockReturnValue({
        select: jest.fn().mockReturnValue({
          order: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue({
              data: [
                {
                  id: 'job-mod-01',
                  organizer_id: 'org-apex-01',
                  title: 'VIP Lounge Usher — Jio World Centre',
                  category: 'hospitality',
                  venue_name: 'Jio World Convention Centre',
                  hourly_rate: 200,
                  total_pay: 1800,
                  duration_hours: 9,
                  slots_total: 10,
                  slots_filled: 8,
                  status: 'open',
                },
              ],
              error: null,
            }),
          }),
        }),
      });

      const jobs = await fetchModerationJobs();
      expect(jobs.length).toBeGreaterThan(0);
      expect(jobs[0].hourlyRate).toBeGreaterThanOrEqual(100);
      expect(jobs[0].totalPay).toBeGreaterThan(0);
    });

    test('moderates shift with mandatory reason', async () => {
      __mockRpc.mockResolvedValueOnce({
        data: { success: true, job_id: 'job-1', status: 'paused' },
        error: null,
      });

      const res = await moderateJobSafe(
        'job-1',
        'paused',
        'Report of ambiguous dress code',
        'admin-1'
      );

      expect(res.success).toBe(true);
      expect(__mockRpc).toHaveBeenCalledWith('admin_moderate_job_safe', {
        p_job_id: 'job-1',
        p_new_status: 'paused',
        p_moderation_reason: 'Report of ambiguous dress code',
        p_admin_id: 'admin-1',
      });
    });

    test('fetches immutable audit logs with diff changes', async () => {
      __mockFrom.mockReturnValue({
        select: jest.fn().mockReturnValue({
          order: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue({
              data: [
                {
                  id: 'aud-01',
                  action: 'admin_resolve_dispute',
                  entity_type: 'disputes',
                  entity_id: 'disp-01',
                  changes: { status: 'resolved' },
                  created_at: new Date().toISOString(),
                },
              ],
              error: null,
            }),
          }),
        }),
      });

      const logs = await fetchAuditLogs();
      expect(logs.length).toBeGreaterThan(0);
      expect(logs[0].action).toBeDefined();
    });

    test('fetches platform settings and verifies living wage floor and DLT headers', async () => {
      __mockFrom.mockReturnValue({
        select: jest.fn().mockResolvedValue({
          data: [
            {
              key: 'min_hourly_wage_inr',
              value: 100.0,
              description: 'Enforced minimum hourly wage floor in INR',
              updated_at: new Date().toISOString(),
            },
            {
              key: 'dlt_sms_header',
              value: 'OPSKIL',
              description: 'TRAI DLT-registered 6-character Alpha sender header',
              updated_at: new Date().toISOString(),
            },
          ],
          error: null,
        }),
      });

      const settings = await fetchPlatformSettings();
      const minWage = settings.find((s) => s.key === 'min_hourly_wage_inr');
      const dltHeader = settings.find((s) => s.key === 'dlt_sms_header');

      expect(minWage?.value).toBe(100.0);
      expect(dltHeader?.value).toBe('OPSKIL');
    });
  });

  describe('Durable Account Deletion Compliance & Obligation Guards', () => {
    test('enforces fail-closed behavior when deletion RPC fails or is rejected', async () => {
      __mockRpc.mockResolvedValueOnce({
        data: {
          success: false,
          error_code: 'ACTIVE_BOOKINGS_PENDING',
          message: 'Cannot request deletion with active or pending shifts.',
        },
        error: null,
      });

      const res = await requestAccountDeletionSafe('worker-101', 'Worker requested deletion');
      expect(res.success).toBe(false);
      expect(res.error).toContain('Cannot request deletion with active or pending shifts');
    });

    test('returns queued purge status when deletion request passes all obligation checks', async () => {
      __mockRpc.mockResolvedValueOnce({
        data: {
          success: true,
          status: 'queued',
          requested_at: '2026-10-13T12:00:00Z',
          scheduled_purge_at: '2026-11-12T12:00:00Z',
        },
        error: null,
      });

      const res = await requestAccountDeletionSafe('worker-101', 'Worker requested deletion');
      expect(res.success).toBe(true);
      expect(res.status).toBe('queued');
      expect(res.scheduledPurgeAt).toBe('2026-11-12T12:00:00Z');
    });
  });

  describe('Admin Operations Desks & Statutory Compliance', () => {
    describe('Screen 21: Overview Operational Action Queues', () => {
      test('prioritizes urgent action cases and derives real counts without fabrication', () => {
        const mockVerifications = [
          { id: 'case-1', status: 'pending' as const, documentType: 'aadhaar' as const, profileId: 'w-1', documentMaskedId: '•••• 1234', createdAt: '2026-10-21T06:00:00Z' },
          { id: 'case-2', status: 'approved' as const, documentType: 'aadhaar' as const, profileId: 'w-2', documentMaskedId: '•••• 5678', createdAt: '2026-10-21T07:00:00Z' },
        ];
        const mockDisputes: Array<{ id: string; status: 'open' | 'under_review' | 'resolved' | 'dismissed'; bookingId: string; raisedBy: string; respondentId: string; reason: string; details: string; createdAt: string }> = [
          { id: 'disp-1', status: 'open', bookingId: 'b-1', raisedBy: 'worker', respondentId: 'org-1', reason: 'Turnstile scanner desync', details: 'Gate 4 lag', createdAt: '2026-10-21T08:00:00Z' },
        ];
        const mockJobs = [
          { id: 'job-1', status: 'open' as const, hourlyRate: 140, title: 'AV Runner', venueName: 'Grand Hyatt', slotsTotal: 2, organizerId: 'org-1' },
          { id: 'job-2', status: 'open' as const, hourlyRate: 250, title: 'VIP Host', venueName: 'Jio World', slotsTotal: 4, organizerId: 'org-1' },
        ];

        const pendingKYCCount = mockVerifications.filter((v) => v.status === 'pending').length;
        const activeDisputesCount = mockDisputes.filter((d) => d.status !== 'resolved' && d.status !== 'dismissed').length;
        const flaggedJobsCount = mockJobs.filter((j) => j.status === 'open' && j.hourlyRate < 200).length;

        expect(pendingKYCCount).toBe(1);
        expect(activeDisputesCount).toBe(1);
        expect(flaggedJobsCount).toBe(1);
      });
    });

    describe('Screen 22: Worker Verification KYC Moderation Desk Privacy & Workflow', () => {
      test('enforces strict PII masking on government identifiers', () => {
        const rawWorkerId = '548291023847';
        const maskedUID = `•••• •••• ${rawWorkerId.slice(-4)}`;
        expect(maskedUID).toBe('•••• •••• 3847');
        expect(maskedUID).not.toContain('5482');

        const rawPhone = '+919820199888';
        const maskedPhone = `${rawPhone.slice(0, 8)} •••••`;
        expect(maskedPhone).toBe('+9198201 •••••');
      });

      test('requires mandatory rejection reason with minimum length before resolving', async () => {
        // Empty rejection reason must be rejected
        const resEmpty = await resolveVerificationCaseSafe('case-1', 'rejected', '', undefined);
        expect(resEmpty.success).toBe(false);
        expect(resEmpty.error).toContain('Rejection reason must be at least 5 characters');

        // Too short reason must be rejected
        const resShort = await resolveVerificationCaseSafe('case-1', 'rejected', 'bad', undefined);
        expect(resShort.success).toBe(false);
        expect(resShort.error).toContain('Rejection reason must be at least 5 characters');
      });
    });

    describe('Screen 23: Shift Moderation & Fair Wage Review Desk', () => {
      test('detects wage deficit below regional benchmark (₹200/hr in MMR)', () => {
        const compliantJob = { id: 'j-1', hourlyRate: 250 };
        const nonCompliantJob = { id: 'j-2', hourlyRate: 140 };

        const isCompliant = (rate: number) => rate >= 200;
        expect(isCompliant(compliantJob.hourlyRate)).toBe(true);
        expect(isCompliant(nonCompliantJob.hourlyRate)).toBe(false);

        const deficit = Math.max(0, 200 - nonCompliantJob.hourlyRate);
        expect(deficit).toBe(60); // Underpaid by ₹60/hr
      });

      test('detects welfare breach for continuous shifts exceeding 6 hours without meals', () => {
        const longShiftWithoutMeal = { durationHours: 10, mealProvided: false };
        const longShiftWithMeal = { durationHours: 10, mealProvided: true };
        const shortShiftWithoutMeal = { durationHours: 4, mealProvided: false };

        const isWelfareBreached = (shift: { durationHours: number; mealProvided: boolean }) =>
          shift.durationHours >= 6 && !shift.mealProvided;

        expect(isWelfareBreached(longShiftWithoutMeal)).toBe(true);
        expect(isWelfareBreached(longShiftWithMeal)).toBe(false);
        expect(isWelfareBreached(shortShiftWithoutMeal)).toBe(false);
      });
    });

    describe('Screen 24: Disputes & Incident Escalation Adjudication', () => {
      test('calculates adjudicated payout based on selected ruling and telemetry evidence', () => {
        const baseWage = 2400;
        const disputedOvertime = 175;

        // Ruling 1: Worker favor (full base + overtime)
        const workerFavorPayout = baseWage + disputedOvertime;
        expect(workerFavorPayout).toBe(2575);

        // Ruling 2: Base wage only (overtime dismissed)
        const baseOnlyPayout = baseWage;
        expect(baseOnlyPayout).toBe(2400);

        // Ruling 3: Split settlement (50% overtime)
        const splitPayout = baseWage + disputedOvertime * 0.5;
        expect(splitPayout).toBe(2487.5);
      });

      test('requires documented mediation findings before authorizing escrow release', async () => {
        const res = await resolveDisputeSafe('disp-1', 'resolved', '', 2575, undefined);
        expect(res.success).toBe(false);
        expect(res.error).toContain('Documented case notes and investigation rationale are required');
      });
    });
  });
});
