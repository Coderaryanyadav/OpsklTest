// Mock Supabase client to test server-side eligibility checks and edge cases
jest.mock('../supabase/client', () => {
  const mockFrom = jest.fn();
  const mockRpc = jest.fn();

  return {
    supabase: {
      from: mockFrom,
      rpc: mockRpc,
    },
    getSharedSupabaseClient: () => ({
      from: mockFrom,
      rpc: mockRpc,
    }),
    __mockFrom: mockFrom,
    __mockRpc: mockRpc,
  };
});

const { __mockRpc: mockRpc, __mockFrom: mockFrom } = require('../supabase/client');

import {
  sweepExpiredWorkerOffersSafe,
  fetchApplicationsForJob,
  cancelBookingSafe,
} from '../supabase/jobs';

describe('Organizer Management & Capacity Sweep Safe Operations', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('sweepExpiredWorkerOffersSafe', () => {
    it('invokes sweep_expired_worker_offers_safe RPC and returns swept count', async () => {
      mockRpc.mockResolvedValueOnce({
        data: { success: true, swept_count: 2, expired_booking_ids: ['b-1', 'b-2'] },
        error: null,
      });

      const res = await sweepExpiredWorkerOffersSafe('job-test-123');
      expect(res.success).toBe(true);
      expect(res.sweptCount).toBe(2);
      expect(mockRpc).toHaveBeenCalledWith('sweep_expired_worker_offers_safe', {
        p_job_id: 'job-test-123',
      });
    });

    it('allows global sweep when no job ID is specified', async () => {
      mockRpc.mockResolvedValueOnce({
        data: { success: true, swept_count: 5 },
        error: null,
      });

      const res = await sweepExpiredWorkerOffersSafe();
      expect(res.success).toBe(true);
      expect(res.sweptCount).toBe(5);
      expect(mockRpc).toHaveBeenCalledWith('sweep_expired_worker_offers_safe', {
        p_job_id: null,
      });
    });

    it('handles RPC error gracefully without throwing', async () => {
      mockRpc.mockResolvedValueOnce({
        data: null,
        error: { message: 'Database connection failed' },
      });

      const res = await sweepExpiredWorkerOffersSafe('job-test-123');
      expect(res.success).toBe(false);
      expect(res.sweptCount).toBe(0);
      expect(res.error).toContain('Database connection failed');
    });
  });

  describe('fetchApplicationsForJob (via privacy-safe RPC)', () => {
    it('calls get_organizer_applications_safe RPC with job id', async () => {
      const mockApplications = [
        {
          id: 'app-1',
          job_id: 'job-100',
          worker_id: 'worker-100',
          status: 'applied',
          applied_at: '2026-10-21T00:00:00Z',
          worker_full_name: 'Aarav Patel',
          worker_avatar_url: 'https://cdn.opskil.com/avatars/aarav.jpg',
          worker_rating: 4.8,
          worker_shifts_completed: 12,
        },
      ];

      mockRpc.mockResolvedValueOnce({
        data: mockApplications,
        error: null,
      });

      const apps = await fetchApplicationsForJob('job-100');
      expect(mockRpc).toHaveBeenCalledWith('get_organizer_applications_safe', {
        p_organizer_id: null,
        p_job_id: 'job-100',
      });
      expect(apps).toHaveLength(1);
      expect(apps[0].worker?.profile?.fullName).toBe('Aarav Patel');
      expect(apps[0].worker?.profile?.avatarUrl).toBe('https://cdn.opskil.com/avatars/aarav.jpg');
    });

    it('returns empty array when RPC errors out and direct table query returns no rows', async () => {
      mockRpc.mockResolvedValueOnce({
        data: null,
        error: { message: 'RPC failure' },
      });

      mockFrom.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: [], error: null }),
      });

      const apps = await fetchApplicationsForJob('job-100');
      expect(apps).toEqual([]);
      expect(mockFrom).toHaveBeenCalledWith('job_applications');
    });
  });

  describe('cancelBookingSafe', () => {
    it('invokes cancel_booking_safe RPC with reason and returns success', async () => {
      mockRpc.mockResolvedValueOnce({
        data: { success: true },
        error: null,
      });

      const res = await cancelBookingSafe('booking-456', 'Shift cancelled due to weather', 'user-mgr-1');
      expect(res.success).toBe(true);
      expect(mockRpc).toHaveBeenCalledWith('cancel_booking_safe', {
        p_booking_id: 'booking-456',
        p_reason: 'Shift cancelled due to weather',
        p_user_id: 'user-mgr-1',
      });
    });

    it('validates booking ID presence before RPC call', async () => {
      const res = await cancelBookingSafe('', 'No reason');
      expect(res.success).toBe(false);
      expect(res.error).toBe('Booking ID is required to cancel');
      expect(mockRpc).not.toHaveBeenCalled();
    });
  });
});
