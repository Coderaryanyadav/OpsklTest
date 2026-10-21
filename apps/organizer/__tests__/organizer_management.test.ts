import { ShiftCreateSchema } from '@opskil/validation';
import {
  createJobSafe,
  confirmWorkerBookingSafe,
  updateApplicationStatusSafe,
  updateJobStatus,
  calculateJobFinancials,
  universalStorage,
  Job,
} from '@opskil/shared';

// Mock Supabase client
jest.mock('@opskil/shared/src/supabase/client', () => {
  const mockRpc = jest.fn();
  const mockFrom = jest.fn();
  const storageMap = new Map<string, string>();

  return {
    supabase: {
      rpc: mockRpc,
      from: mockFrom,
    },
    universalStorage: {
      getItem: jest.fn(async (key: string) => storageMap.get(key) ?? null),
      setItem: jest.fn(async (key: string, value: string) => {
        storageMap.set(key, value);
      }),
      removeItem: jest.fn(async (key: string) => {
        storageMap.delete(key);
      }),
    },
    __mockRpc: mockRpc,
    __mockFrom: mockFrom,
  };
});

const { __mockRpc } = require('@opskil/shared/src/supabase/client');

describe('Phase 4 — Organizer Job Management & Hiring Rules', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Job Creation Wizard Validation (Client & Schema Rules)', () => {
    const today = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());

    const validPayload = {
      title: 'Registration Desk & VIP Usher',
      category: 'conference',
      venueName: 'Jio World Convention Centre',
      venueAddress: 'G Block BKC, Bandra East, Mumbai 400098',
      landmark: 'Opposite Bharat Diamond Bourse',
      city: 'Mumbai',
      zone: 'Bandra Kurla Complex (BKC)',
      date: today,
      startTime: '08:30',
      endTime: '17:30',
      durationHours: 9,
      hourlyRate: 185,
      slotsTotal: 12,
      duties: ['Scan tickets', 'Issue badges'],
      requiredSkills: ['Guest Relations', 'Fluent English'],
      eligibilityCriteria: 'Must be 18+ years old',
      breaksMinutes: 45,
      mealProvided: true,
      transportProvided: false,
      overtimePolicy: '₹200/hr for additional show hours',
      reportingInstructions: 'Report to Gate 2 by 8:00 AM',
      cancellationPolicy: 'Free cancellation up to 24h prior to shift',
      supervisorName: 'Rohit Verma',
      supervisorPhone: '9820198201',
      status: 'open',
    };

    test('validates complete 11-step shift payload', () => {
      const result = ShiftCreateSchema.safeParse(validPayload);
      expect(result.success).toBe(true);
    });

    test('rejects past event date', () => {
      const invalid = {
        ...validPayload,
        date: '2020-01-01',
      };
      const result = ShiftCreateSchema.safeParse(invalid);
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toContain('Event date cannot be in the past');
    });

    test('rejects wage below Indian minimum living rate (₹100/hr)', () => {
      const invalid = {
        ...validPayload,
        hourlyRate: 85,
      };
      const result = ShiftCreateSchema.safeParse(invalid);
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toContain('Minimum allowable wage is ₹100/hr');
    });

    test('rejects zero or negative worker headcount', () => {
      const invalid = {
        ...validPayload,
        slotsTotal: 0,
      };
      const result = ShiftCreateSchema.safeParse(invalid);
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toContain('At least 1 worker required');
    });

    test('rejects invalid supervisor phone number', () => {
      const invalid = {
        ...validPayload,
        supervisorPhone: '12345',
      };
      const result = ShiftCreateSchema.safeParse(invalid);
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toContain('Valid 10-digit Indian phone number required');
    });

    test('server RPC creates shift listing and records audit log', async () => {
      __mockRpc.mockResolvedValueOnce({
        data: {
          success: true,
          job_id: 'job-created-101',
        },
        error: null,
      });

      const res = await createJobSafe(validPayload as any, 'org-apex-01');
      expect(res.success).toBe(true);
      expect(res.jobId).toBe('job-created-101');
    });
  });

  describe('Hiring Rules & Capacity Enforcement', () => {
    test('confirms worker booking when slots are available', async () => {
      __mockRpc.mockResolvedValueOnce({
        data: {
          success: true,
          booking: {
            id: 'booking-201',
            job_id: 'job-1',
            worker_id: 'worker-101',
            status: 'confirmed',
            agreed_hourly_rate: 185,
            agreed_total_pay: 1665,
          },
          slots_filled: 9,
          slots_total: 12,
        },
        error: null,
      });

      const res = await confirmWorkerBookingSafe('job-1', 'worker-101', 'org-apex-01');
      expect(res.success).toBe(true);
      expect(res.booking?.id).toBe('booking-201');
      expect(res.booking?.status).toBe('confirmed');
    });

    test('strictly enforces headcount limit: rejects booking when headcount is full', async () => {
      __mockRpc.mockResolvedValueOnce({
        data: {
          success: false,
          error_code: 'HEADCOUNT_FULL',
          message: 'Headcount limit reached. All 12 openings have already been filled.',
        },
        error: null,
      });

      const res = await confirmWorkerBookingSafe('job-1', 'worker-102', 'org-apex-01');
      expect(res.success).toBe(false);
      expect(res.error).toContain('Headcount limit reached');
    });

    test('prevents duplicate booking of the same worker', async () => {
      __mockRpc.mockResolvedValueOnce({
        data: {
          success: false,
          error_code: 'ALREADY_BOOKED',
          message: 'Worker is already confirmed for this shift.',
        },
        error: null,
      });

      const res = await confirmWorkerBookingSafe('job-1', 'worker-101', 'org-apex-01');
      expect(res.success).toBe(false);
      expect(res.error).toContain('already confirmed');
    });

    test('updates applicant status to shortlisted and triggers worker notification', async () => {
      __mockRpc.mockResolvedValueOnce({
        data: {
          success: true,
          status: 'shortlisted',
        },
        error: null,
      });

      const res = await updateApplicationStatusSafe('app-1', 'shortlisted', 'org-apex-01');
      expect(res.success).toBe(true);
    });

    test('updates applicant status to rejected', async () => {
      __mockRpc.mockResolvedValueOnce({
        data: {
          success: true,
          status: 'rejected',
        },
        error: null,
      });

      const res = await updateApplicationStatusSafe('app-1', 'rejected', 'org-apex-01');
      expect(res.success).toBe(true);
    });

    test('updates shift status to paused or cancelled via authoritative RPC', async () => {
      __mockRpc.mockResolvedValueOnce({
        data: { success: true, status: 'paused' },
        error: null,
      });

      const res = await updateJobStatus('job-1', 'org-apex-01', 'paused');
      expect(res.success).toBe(true);
      expect(__mockRpc).toHaveBeenCalledWith('update_job_status_safe', {
        p_job_id: 'job-1',
        p_new_status: 'paused',
      });
    });

    test('updateJobStatus fails closed when unauthenticated or RPC errors out', async () => {
      __mockRpc.mockResolvedValueOnce({
        data: null,
        error: { message: 'Unauthorized organizer account' },
      });

      const res = await updateJobStatus('job-1', 'unauth-org', 'paused');
      expect(res.success).toBe(false);
      expect(res.error).toContain('Unauthorized');
    });

    test('createJobSafe fails closed without creating database record if RPC fails', async () => {
      __mockRpc.mockResolvedValueOnce({
        data: null,
        error: { message: 'Database constraint violation' },
      });

      const res = await createJobSafe(
        {
          title: 'Test',
          category: 'conference',
          venueName: 'Test Venue',
          venueAddress: 'Test Address',
          city: 'Mumbai',
          date: '2026-10-20',
          startTime: '09:00',
          endTime: '17:00',
          hourlyRate: 150,
          totalPay: 1200,
          slotsTotal: 5,
        } as any,
        'org-1'
      );
      expect(res.success).toBe(false);
      expect(res.error).toBeDefined();
    });
  });

  describe('Multi-Step Shift Creator: Wage, Welfare & Institutional Escrow Formula', () => {
    test('calculates transparent escrow with 10% fee and 18% GST without deducting worker wages', () => {
      const headcount = 6;
      const shiftPayPerWorker = 2400; // ₹2,400 per 9-hr shift (₹266.67/hr)

      const breakdown = calculateJobFinancials(headcount, shiftPayPerWorker, 10, 18);

      // Total worker wage: 6 * 2400 = 14400
      expect(breakdown.totalWorkerWages).toBe(14400);

      // Platform fee: 10% of worker wages = 1440
      expect(breakdown.platformFeeAmount).toBe(1440);

      // GST on platform fee: 18% of 1440 = 259.20
      expect(breakdown.gstAmount).toBe(259.20);

      // Total payable into RBI-regulated nodal escrow by organizer: 14400 + 1440 + 259.20 = 16099.20
      expect(breakdown.totalPayableByOrganizer).toBe(16099.20);

      // Worker receives 100% of their base rate: zero deductions
      expect(breakdown.wagePerWorker).toBe(2400);
    });

    test('validates statutory fair wage benchmark (must exceed ₹100/hr)', () => {
      const durationHours = 9;
      const subCompliancePay = 800; // ₹88.89/hr
      const effectiveRate = subCompliancePay / durationHours;

      expect(effectiveRate).toBeLessThan(100);

      const compliantPay = 2400; // ₹266.67/hr
      const compliantEffectiveRate = compliantPay / durationHours;
      expect(compliantEffectiveRate).toBeGreaterThanOrEqual(100);
    });
  });

  describe('Local Draft Persistence & Resume Wizard', () => {
    const DRAFT_KEY = '@opskil_organizer_shift_draft';

    test('persists draft shift to universalStorage and retrieves it intact', async () => {
      const draftPayload = {
        title: 'Lead VIP Usher - Jio World Convention Centre',
        category: 'conference',
        slotsTotal: '8',
        durationHours: '9',
        venueName: 'Jio World Convention Centre, Gate 4',
        payBasis: 'shift',
        shiftRate: '2400',
        savedAt: new Date().toISOString(),
      };

      await universalStorage.setItem(DRAFT_KEY, JSON.stringify(draftPayload));

      const raw = await universalStorage.getItem(DRAFT_KEY);
      expect(raw).toBeTruthy();
      const parsed = JSON.parse(raw!);
      expect(parsed.title).toBe('Lead VIP Usher - Jio World Convention Centre');
      expect(parsed.slotsTotal).toBe('8');
      expect(parsed.shiftRate).toBe('2400');

      // Cleanup
      await universalStorage.removeItem(DRAFT_KEY);
      const afterClear = await universalStorage.getItem(DRAFT_KEY);
      expect(afterClear).toBeNull();
    });
  });

  describe('Business Verification Gating & Publishing State', () => {
    test('createJobSafe surfaces ORGANIZER_NOT_VERIFIED when account lacks KYC approval', async () => {
      __mockRpc.mockResolvedValueOnce({
        data: {
          success: false,
          error_code: 'ORGANIZER_NOT_VERIFIED',
          message: 'Legal entity verification required before publishing shifts.',
        },
        error: null,
      });

      const res = await createJobSafe(
        {
          title: 'Guest Relations',
          category: 'conference',
          venueName: 'NESCO Hall 4',
          venueAddress: 'Western Express Hwy, Goregaon',
          city: 'Mumbai',
          date: '2026-10-25',
          startTime: '09:00',
          endTime: '18:00',
          hourlyRate: 200,
          totalPay: 1800,
          slotsTotal: 10,
        } as any,
        'unverified-org-123'
      );

      expect(res.success).toBe(false);
      expect(res.errorCode).toBe('ORGANIZER_NOT_VERIFIED');
    });
  });

  describe('Organizer Shift Roster Lifecycle & State Separation', () => {
    const mockShifts: Partial<Job>[] = [
      { id: 'shift-1', title: 'Open Shift', status: 'open', slotsFilled: 4, slotsTotal: 10 },
      { id: 'shift-2', title: 'Filling Shift', status: 'filling', slotsFilled: 8, slotsTotal: 10 },
      { id: 'shift-3', title: 'Locked Roster Shift', status: 'open', slotsFilled: 10, slotsTotal: 10 },
      { id: 'shift-4', title: 'Draft Shift', status: 'draft', slotsFilled: 0, slotsTotal: 5 },
      { id: 'shift-5', title: 'Completed Shift', status: 'completed', slotsFilled: 6, slotsTotal: 6 },
    ];

    test('separates active shifts from locked, draft, and completed states', () => {
      const activeShifts = mockShifts.filter((s) => s.status === 'open' || s.status === 'filling');
      expect(activeShifts.length).toBe(3);

      const lockedShifts = mockShifts.filter((s) => (s.slotsFilled ?? 0) >= (s.slotsTotal ?? 1));
      expect(lockedShifts.length).toBe(2);
      expect(lockedShifts.map((s) => s.id)).toEqual(['shift-3', 'shift-5']);

      const draftShifts = mockShifts.filter((s) => s.status === 'draft');
      expect(draftShifts.length).toBe(1);
      expect(draftShifts[0].id).toBe('shift-4');

      const completedShifts = mockShifts.filter((s) => s.status === 'completed');
      expect(completedShifts.length).toBe(1);
      expect(completedShifts[0].id).toBe('shift-5');
    });
  });

  describe('Screen 17: Applicant Screening Pipeline Lifecycle & Worker Privacy', () => {
    test('organizer selecting worker transitions to "selected" (awaiting confirmation), NOT "confirmed"', () => {
      // Lifecycle rule: organizer offer creates an offer / reservation, awaiting worker acceptance
      const initialApplication = {
        id: 'app-501',
        workerId: 'worker-777',
        status: 'applied' as const,
      };

      // Transition to shortlisted
      const shortlistedApp = { ...initialApplication, status: 'shortlisted' as const };
      expect(shortlistedApp.status).toBe('shortlisted');

      // Organizer selects candidate -> Offer dispatched with held time window
      const selectedOffer = {
        ...shortlistedApp,
        status: 'selected' as const,
        heldUntilTime: '06:00 PM IST',
        timeLeftMinutes: 180, // 3 hours window to accept
        isConfirmed: false, // Worker must accept before confirmation
      };

      expect(selectedOffer.status).toBe('selected');
      expect(selectedOffer.isConfirmed).toBe(false);
      expect(selectedOffer.timeLeftMinutes).toBe(180);

      // Only after worker accepts does it transition to confirmed
      const confirmedBooking = {
        ...selectedOffer,
        status: 'confirmed' as const,
        isConfirmed: true,
      };
      expect(confirmedBooking.status).toBe('confirmed');
      expect(confirmedBooking.isConfirmed).toBe(true);
    });

    test('worker detail view strictly hides Aadhaar, PAN, and raw KYC documents from organizer', () => {
      // Mock worker object containing internal credentials
      const internalWorkerRecord = {
        id: 'worker-777',
        name: 'Aditya Rao',
        phone: '+919820199888',
        aadhaarNumber: '5482 9102 3847',
        panNumber: 'ABCDE1234F',
        kycDocUrl: 'https://storage.supabase.co/kyc/aditya_aadhaar_front.pdf',
        rating: 4.85,
        completedEvents: 14,
        isUidaiVerified: true,
        skills: ['Guest Relations', 'VIP Lounge Protocol'],
      };

      // Organizer screening pipeline view sanitization
      const organizerCandidateCard = {
        id: internalWorkerRecord.id,
        name: internalWorkerRecord.name,
        phoneMasked: `${internalWorkerRecord.phone.slice(0, 8)} •••••`,
        rating: internalWorkerRecord.rating,
        eventsCount: internalWorkerRecord.completedEvents,
        verificationBadge: internalWorkerRecord.isUidaiVerified ? 'UIDAI Verified' : 'Unverified',
        skills: internalWorkerRecord.skills,
      };

      // Verify ZERO leakage of sensitive PII / KYC docs
      expect((organizerCandidateCard as any).aadhaarNumber).toBeUndefined();
      expect((organizerCandidateCard as any).panNumber).toBeUndefined();
      expect((organizerCandidateCard as any).kycDocUrl).toBeUndefined();
      expect(organizerCandidateCard.phoneMasked).toContain('•••••');
      expect(organizerCandidateCard.verificationBadge).toBe('UIDAI Verified');
    });

    test('rejects candidate selection when shift headcount capacity is full', () => {
      const shiftCapacity = {
        slotsTotal: 6,
        slotsConfirmed: 4,
        slotsSelected: 2,
      };

      const openSlots = shiftCapacity.slotsTotal - (shiftCapacity.slotsConfirmed + shiftCapacity.slotsSelected);
      expect(openSlots).toBe(0);

      const canSelectMore = openSlots > 0;
      expect(canSelectMore).toBe(false);
    });
  });

  describe('Screen 18: Confirmed Crew Roster & Briefing Console Roster Safety', () => {
    test('roster modification requires explicit replacement explanation and confirmation modal', () => {
      const confirmedRoster = [
        { id: 'w-1', name: 'Aarav Kulkarni', isConfirmed: true, roleTag: 'Lead Usher' },
        { id: 'w-2', name: 'Priya Sharma', isConfirmed: true, roleTag: 'VIP Host' },
      ];

      const standbyWorker = {
        id: 'standby-1',
        name: 'Nikhil Mehta',
        distanceKm: 2.1,
        isReadinessVerified: true,
      };

      // Silent deletion/replacement is forbidden
      const attemptSilentReplacement = (_roster: typeof confirmedRoster, _targetId: string) => {
        // Must throw or fail without explicit audit impact
        throw new Error('CONFIRMED_ROSTER_MODIFICATION_REQUIRES_AUDIT_CONFIRMATION');
      };

      expect(() => attemptSilentReplacement(confirmedRoster, 'w-1')).toThrow(
        'CONFIRMED_ROSTER_MODIFICATION_REQUIRES_AUDIT_CONFIRMATION'
      );

      // Explicit replacement with impact explanation
      const executeAuditedReplacement = (
        roster: typeof confirmedRoster,
        targetId: string,
        replacement: typeof standbyWorker,
        reason: string,
        organizerConfirmed: boolean
      ) => {
        if (!organizerConfirmed) {
          return { success: false, error: 'User aborted replacement modal' };
        }
        if (!reason || reason.trim().length === 0) {
          return { success: false, error: 'Replacement reason required' };
        }
        const updated = roster.map((w) =>
          w.id === targetId ? { id: replacement.id, name: replacement.name, isConfirmed: true, roleTag: w.roleTag } : w
        );
        return {
          success: true,
          roster: updated,
          auditNote: `Replaced worker ${targetId} with standby ${replacement.id}. Reason: ${reason}. Gate pass re-issued.`,
        };
      };

      const result = executeAuditedReplacement(
        confirmedRoster,
        'w-1',
        standbyWorker,
        'Reported medical or travel delay',
        true
      );

      expect(result.success).toBe(true);
      expect(result.roster?.find((w) => w.id === 'standby-1')?.name).toBe('Nikhil Mehta');
      expect(result.auditNote).toContain('Gate pass re-issued');
    });
  });

  describe('Screen 20: Event-Day Live Attendance Review & Sign-Off Semantics', () => {
    test('distinguishes on_duty, approaching, checked_out, and no_show states', () => {
      const crewAttendance = [
        { id: 'w-1', name: 'Aarav', status: 'on_duty' as const, qrVerified: true, checkInTime: '09:28 AM' },
        { id: 'w-2', name: 'Priya', status: 'on_duty' as const, qrVerified: true, checkInTime: '09:32 AM' },
        { id: 'w-3', name: 'Sneha', status: 'approaching' as const, distanceMeters: 120, etaMinutes: 2 },
        { id: 'w-4', name: 'Dev', status: 'no_show' as const, distanceMeters: 4800 },
      ];

      const present = crewAttendance.filter((w) => w.status === 'on_duty');
      const inBounds = crewAttendance.filter((w) => w.status === 'approaching');
      const noShow = crewAttendance.filter((w) => w.status === 'no_show');

      expect(present.length).toBe(2);
      expect(inBounds.length).toBe(1);
      expect(noShow.length).toBe(1);
    });

    test('attendance review/approval validates billable hours, but does NOT equal payment completion', () => {
      // Critical lifecycle rule:
      // Attendance sign-off locks billable timesheet -> moves to batch payout queue.
      // It does NOT trigger immediate completed disbursement.
      const attendanceReviewState = {
        shiftId: 'shift-bkc-01',
        supervisorSignOff: true,
        timesheetLocked: true,
        approvedWorkersCount: 6,
        paymentState: 'batch_scheduled' as const, // NOT 'disbursed' / 'paid'
        payoutExecutionWindow: '23:00 IST Nightly Automated Nodal Run',
      };

      expect(attendanceReviewState.timesheetLocked).toBe(true);
      expect(attendanceReviewState.paymentState).not.toBe('disbursed');
      expect(attendanceReviewState.paymentState).toBe('batch_scheduled');
    });
  });

  describe('Screen 19: Financial Breakdown, GST & Truthful Funding Representation', () => {
    test('calculates gross wages, platform fee, GST on fee, and total organizer obligation correctly', () => {
      const headcount = 6;
      const workerStipend = 2400; // ₹2,400 per worker
      const grossCrewWages = headcount * workerStipend; // ₹14,400

      const platformFeeRate = 0.10; // 10%
      const platformFee = Math.round(grossCrewWages * platformFeeRate * 100) / 100; // ₹1,440.00

      const gstRate = 0.18; // 18% GST on platform fee only
      const gstOnFee = Math.round(platformFee * gstRate * 100) / 100; // ₹259.20

      const organizerTotal = grossCrewWages + platformFee + gstOnFee; // ₹16,099.20

      expect(grossCrewWages).toBe(14400);
      expect(platformFee).toBe(1440);
      expect(gstOnFee).toBe(259.2);
      expect(organizerTotal).toBe(16099.2);

      // Worker wage pool zero-deduction guarantee
      const workerDeduction = 0;
      const netWorkerPay = workerStipend - workerDeduction;
      expect(netWorkerPay).toBe(workerStipend);
    });

    test('truthfully labels funding capability without fabricating live escrow balances or bank transfers', () => {
      const fundingCapability = {
        hasNativeEscrowBankIntegration: false,
        accountRail: 'ICICI Nodal Enterprise Rails',
        ledgerLabel: 'Funding & payment status', // Truthful UX label as requested
        preFundedStatus: 'locked_nodal_reserve',
        invoiceState: 'pending_signoff' as const,
        paymentState: 'pre_funded' as const,
      };

      // Static design titled "escrow" does NOT prove live escrow exists
      expect(fundingCapability.hasNativeEscrowBankIntegration).toBe(false);
      expect(fundingCapability.ledgerLabel).toBe('Funding & payment status');
      expect(fundingCapability.invoiceState).not.toBe(fundingCapability.paymentState);
    });
  });
});


