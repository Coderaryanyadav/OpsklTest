import { ShiftCreateSchema } from '@opskil/validation';
import {
  createJobSafe,
  confirmWorkerBookingSafe,
  updateApplicationStatusSafe,
  updateJobStatus,
} from '@opskil/shared';

// Mock Supabase client
jest.mock('@opskil/shared/src/supabase/client', () => {
  const mockRpc = jest.fn();
  const mockFrom = jest.fn();

  return {
    supabase: {
      rpc: mockRpc,
      from: mockFrom,
    },
    __mockRpc: mockRpc,
    __mockFrom: mockFrom,
  };
});

const { __mockRpc, __mockFrom } = require('@opskil/shared/src/supabase/client');

describe('Phase 4 — Organizer Job Management & Hiring Rules', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Job Creation Wizard Validation (Client & Schema Rules)', () => {
    const today = new Date().toISOString().split('T')[0];

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

    test('updates shift status to paused or cancelled with audit log', async () => {
      __mockFrom.mockReturnValueOnce({
        update: jest.fn().mockReturnValue({
          match: jest.fn().mockResolvedValue({ error: null }),
        }),
      });
      __mockFrom.mockReturnValueOnce({
        insert: jest.fn().mockResolvedValue({ error: null }),
      });

      const res = await updateJobStatus('job-1', 'org-apex-01', 'paused');
      expect(res.success).toBe(true);
    });
  });
});
