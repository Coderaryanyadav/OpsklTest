import {
  calculateDistanceKm,
  formatDistance,
  formatDeadline,
  formatWageSummary,
} from '../formatters';
import { applyForJobSafe } from '../supabase/jobs';

// Mock Supabase client to test server-side eligibility checks and edge cases
jest.mock('../supabase/client', () => {
  const mockFrom = jest.fn();
  const mockRpc = jest.fn();

  return {
    supabase: {
      from: mockFrom,
      rpc: mockRpc,
    },
    __mockFrom: mockFrom,
    __mockRpc: mockRpc,
  };
});

const { __mockRpc, __mockFrom } = require('../supabase/client');

describe('Phase 3 — Marketplace Discovery, Distance & Server-side Eligibility', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Haversine Distance & Formatters', () => {
    test('calculates accurate distance between BKC and NESCO Goregaon', () => {
      // BKC: (19.066, 72.868), NESCO: (19.1482, 72.853)
      const distance = calculateDistanceKm(19.066, 72.868, 19.1482, 72.853);
      expect(distance).toBeGreaterThan(8);
      expect(distance).toBeLessThan(12);
    });

    test('calculates zero distance for identical coordinates', () => {
      const distance = calculateDistanceKm(19.062, 72.864, 19.062, 72.864);
      expect(distance).toBe(0);
    });

    test('formatDistance handles null, undefined, close and far distances', () => {
      expect(formatDistance(null)).toBe('Distance unavailable');
      expect(formatDistance(undefined)).toBe('Distance unavailable');
      expect(formatDistance(0.3)).toBe('Under 500m away');
      expect(formatDistance(0.8)).toBe('Under 1 km away');
      expect(formatDistance(4.5)).toBe('4.5 km away');
    });

    test('formatDeadline correctly formats active vs expired deadlines', () => {
      expect(formatDeadline(null)).toBe('Applications open');

      const past = new Date(Date.now() - 3600000).toISOString();
      expect(formatDeadline(past)).toBe('Deadline passed');

      const futureHours = new Date(Date.now() + 5 * 3600000).toISOString();
      expect(formatDeadline(futureHours)).toMatch(/Closes in \d+h/);
    });

    test('formatWageSummary gives correct breakdown in INR', () => {
      const summary = formatWageSummary(185, 9);
      expect(summary.totalFormatted).toBe('₹1,665');
      expect(summary.rateFormatted).toBe('₹185/hr');
      expect(summary.breakdown).toBe('₹185 × 9 hrs = ₹1,665');
    });
  });

  describe('Server-Side Eligibility Validation & Race Condition Protection', () => {
    test('RPC success returns valid application', async () => {
      __mockRpc.mockResolvedValueOnce({
        data: {
          success: true,
          application: {
            id: 'app-101',
            job_id: 'job-1',
            worker_id: 'worker-1',
            status: 'applied',
            applied_at: new Date().toISOString(),
          },
        },
        error: null,
      });

      const res = await applyForJobSafe('job-1', 'worker-1');
      expect(res.success).toBe(true);
      expect(res.application?.id).toBe('app-101');
      expect(res.application?.status).toBe('applied');
    });

    test('Rejects duplicate applications if worker already applied', async () => {
      __mockRpc.mockResolvedValueOnce({
        data: {
          success: false,
          error_code: 'ALREADY_APPLIED',
          message: 'You have already expressed interest in this shift',
        },
        error: null,
      });

      const res = await applyForJobSafe('job-1', 'worker-1');
      expect(res.success).toBe(false);
      expect(res.errorCode).toBe('ALREADY_APPLIED');
      expect(res.errorMessage).toContain('already expressed interest');
    });

    test('Rejects application if shift is closed or cancelled', async () => {
      __mockRpc.mockResolvedValueOnce({
        data: {
          success: false,
          error_code: 'JOB_CLOSED',
          message: 'This shift is no longer open for applications',
        },
        error: null,
      });

      const res = await applyForJobSafe('job-closed', 'worker-1');
      expect(res.success).toBe(false);
      expect(res.errorCode).toBe('JOB_CLOSED');
    });

    test('Rejects application if deadline has expired', async () => {
      __mockRpc.mockResolvedValueOnce({
        data: {
          success: false,
          error_code: 'DEADLINE_PASSED',
          message: 'The application deadline for this shift has passed',
        },
        error: null,
      });

      const res = await applyForJobSafe('job-expired', 'worker-1');
      expect(res.success).toBe(false);
      expect(res.errorCode).toBe('DEADLINE_PASSED');
    });

    test('Rejects application if all slots are filled', async () => {
      __mockRpc.mockResolvedValueOnce({
        data: {
          success: false,
          error_code: 'SLOTS_FULL',
          message: 'All openings for this shift have already been filled',
        },
        error: null,
      });

      const res = await applyForJobSafe('job-full', 'worker-1');
      expect(res.success).toBe(false);
      expect(res.errorCode).toBe('SLOTS_FULL');
    });

    test('Client direct fallback rejects closed job if RPC is unavailable', async () => {
      // Simulate RPC not found
      __mockRpc.mockResolvedValueOnce({
        data: null,
        error: { message: 'function apply_for_job_safe does not exist' },
      });

      // Mock jobs query returning closed job
      __mockFrom.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: {
                id: 'job-1',
                status: 'filled',
                slots_total: 10,
                slots_filled: 10,
              },
              error: null,
            }),
          }),
        }),
      });

      const res = await applyForJobSafe('job-1', 'worker-1');
      expect(res.success).toBe(false);
      expect(res.errorCode).toBe('JOB_CLOSED');
    });

    test('Client direct fallback detects duplicate application if RPC is unavailable', async () => {
      // Simulate RPC not found
      __mockRpc.mockResolvedValueOnce({
        data: null,
        error: { message: 'RPC error' },
      });

      // Mock open job
      __mockFrom.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: {
                id: 'job-1',
                status: 'open',
                slots_total: 10,
                slots_filled: 5,
              },
              error: null,
            }),
          }),
        }),
      });

      // Mock existing application found
      __mockFrom.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              maybeSingle: jest.fn().mockResolvedValue({
                data: { id: 'app-999', status: 'applied' },
                error: null,
              }),
            }),
          }),
        }),
      });

      const res = await applyForJobSafe('job-1', 'worker-1');
      expect(res.success).toBe(false);
      expect(res.errorCode).toBe('ALREADY_APPLIED');
    });
  });
});
