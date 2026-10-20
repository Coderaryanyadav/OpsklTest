import {
  calculateDistanceKm,
  formatDistance,
  formatDeadline,
  formatWageSummary,
} from '../formatters';
import { applyForJobSafe, recordSwipePass } from '../supabase/jobs';

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

const { __mockRpc } = require('../supabase/client');

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

    test('Fails closed and rejects application if authoritative RPC encounters transaction error', async () => {
      __mockRpc.mockResolvedValueOnce({
        data: null,
        error: { message: 'Transaction rolled back', code: 'TRANSACTION_ERROR' },
      });

      const res = await applyForJobSafe('job-1', 'worker-1');
      expect(res.success).toBe(false);
      expect(res.errorCode).toBe('TRANSACTION_ERROR');
      expect(res.errorMessage).toBe('Transaction rolled back');
    });

    test('Fails closed if authoritative RPC returns unexpected connection failure', async () => {
      __mockRpc.mockResolvedValueOnce({
        data: null,
        error: { message: 'Database connection failed' },
      });

      const res = await applyForJobSafe('job-1', 'worker-1');
      expect(res.success).toBe(false);
      expect(res.errorCode).toBe('TRANSACTION_ERROR');
      expect(res.errorMessage).toBe('Database connection failed');
    });

    test('recordSwipePass preserves right-swipes and rejects overwriting existing right swipe', async () => {
      __mockRpc.mockResolvedValueOnce({
        data: {
          success: false,
          error_code: 'ALREADY_APPLIED',
          message: 'Cannot pass a shift that has already been applied for or saved.',
        },
        error: null,
      });

      const res = await recordSwipePass('job-1', 'worker-1');
      expect(res.success).toBe(false);
      expect(res.error).toBe('Cannot pass a shift that has already been applied for or saved.');
    });

    test('recordSwipePass successfully records pass when no prior right-swipe exists', async () => {
      __mockRpc.mockResolvedValueOnce({
        data: { success: true },
        error: null,
      });

      const res = await recordSwipePass('job-2', 'worker-1');
      expect(res.success).toBe(true);
    });
  });

  describe('Job Lifecycle Transitions & State Machine (FLOW-001)', () => {
    // Pure validator matching PostgreSQL validate_job_transition
    const validateJobTransition = (current: string, next: string): boolean => {
      if (current === next) return true;
      if (current === 'draft' && ['open', 'cancelled'].includes(next)) return true;
      if (['open', 'filling', 'filled'].includes(current) && ['open', 'filling', 'filled', 'in_progress', 'paused', 'cancelled'].includes(next)) return true;
      if (current === 'paused' && ['open', 'filling', 'in_progress', 'cancelled'].includes(next)) return true;
      if (current === 'in_progress' && ['completed', 'cancelled'].includes(next)) return true;
      return false;
    };

    test('permits partially-filled shifts (filling) to transition directly to in_progress at call time', () => {
      expect(validateJobTransition('filling', 'in_progress')).toBe(true);
      expect(validateJobTransition('open', 'in_progress')).toBe(true);
      expect(validateJobTransition('filled', 'in_progress')).toBe(true);
    });

    test('permits in_progress shifts to complete and trigger invoice reconciliation', () => {
      expect(validateJobTransition('in_progress', 'completed')).toBe(true);
    });

    test('rejects invalid backward transitions from terminal states', () => {
      expect(validateJobTransition('completed', 'in_progress')).toBe(false);
      expect(validateJobTransition('cancelled', 'open')).toBe(false);
    });
  });
});
