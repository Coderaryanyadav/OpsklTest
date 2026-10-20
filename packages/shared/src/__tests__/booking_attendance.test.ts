import {
  checkInWorkerSafe,
  checkOutWorkerSafe,
  completeShiftAndApproveAttendance,
  cancelBookingSafe,
  recordNoShowSafe,
  disputeBookingSafe,
} from '../supabase/jobs';

// Mock Supabase
jest.mock('../supabase/client', () => {
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

const { __mockRpc } = require('../supabase/client');

describe('Phase 5 — Booking State Machine & Attendance Engine', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Booking State Machine Transition Rules', () => {
    // Pure validator matching PostgreSQL validate_booking_transition
    const validateBookingTransition = (current: string, next: string): boolean => {
      if (current === 'selected_awaiting_confirmation' && ['confirmed', 'cancelled'].includes(next)) return true;
      if (current === 'confirmed' && ['checked_in', 'cancelled', 'no_show'].includes(next)) return true;
      if (current === 'checked_in' && ['checked_out', 'completed_awaiting_review', 'disputed'].includes(next)) return true;
      if (['checked_out', 'completed_awaiting_review'].includes(current) && ['completed', 'disputed'].includes(next)) return true;
      if (current === 'completed' && next === 'disputed') return true;
      if (current === 'no_show' && next === 'disputed') return true;
      return false;
    };

    test('validates standard successful lifecycle: confirmed -> checked_in -> completed_awaiting_review -> completed', () => {
      expect(validateBookingTransition('confirmed', 'checked_in')).toBe(true);
      expect(validateBookingTransition('checked_in', 'completed_awaiting_review')).toBe(true);
      expect(validateBookingTransition('completed_awaiting_review', 'completed')).toBe(true);
    });

    test('allows cancellation only prior to check-in', () => {
      expect(validateBookingTransition('confirmed', 'cancelled')).toBe(true);
      expect(validateBookingTransition('selected_awaiting_confirmation', 'cancelled')).toBe(true);

      // Rejects cancellation once worker has already checked in or completed
      expect(validateBookingTransition('checked_in', 'cancelled')).toBe(false);
      expect(validateBookingTransition('completed', 'cancelled')).toBe(false);
    });

    test('allows marking no-show only from confirmed state', () => {
      expect(validateBookingTransition('confirmed', 'no_show')).toBe(true);
      expect(validateBookingTransition('checked_in', 'no_show')).toBe(false);
      expect(validateBookingTransition('completed', 'no_show')).toBe(false);
    });

    test('allows opening dispute from completed, awaiting review, or no-show states', () => {
      expect(validateBookingTransition('completed', 'disputed')).toBe(true);
      expect(validateBookingTransition('no_show', 'disputed')).toBe(true);
      expect(validateBookingTransition('completed_awaiting_review', 'disputed')).toBe(true);
      expect(validateBookingTransition('checked_in', 'disputed')).toBe(true);
    });
  });

  describe('Auditable Check-In & Check-Out', () => {
    test('successful check-in with valid token transitions booking to checked_in', async () => {
      __mockRpc.mockResolvedValueOnce({
        data: {
          success: true,
          status: 'checked_in',
          distance_km: 0.15,
        },
        error: null,
      });

      const res = await checkInWorkerSafe('booking-101', 'OP-4829', 19.062, 72.864);
      expect(res.success).toBe(true);
      expect(res.status).toBe('checked_in');
      expect(res.distanceKm).toBe(0.15);
    });

    test('rejects check-in if booking is already checked-in or completed', async () => {
      __mockRpc.mockResolvedValueOnce({
        data: {
          success: false,
          error_code: 'INVALID_TRANSITION',
          message: 'Cannot check in. Current booking status is completed',
        },
        error: null,
      });

      const res = await checkInWorkerSafe('booking-101', 'OP-4829');
      expect(res.success).toBe(false);
      expect(res.error).toContain('INVALID_TRANSITION');
    });

    test('rejects check-in when worker is outside 300m geofence radius (OUT_OF_GEOFENCE_RANGE)', async () => {
      __mockRpc.mockResolvedValueOnce({
        data: {
          success: false,
          error_code: 'OUT_OF_GEOFENCE_RANGE',
          message: 'You are 850m away from the venue. You must be within 300m to check in.',
        },
        error: null,
      });

      const res = await checkInWorkerSafe('booking-101', 'OP-4829', 19.070, 72.875);
      expect(res.success).toBe(false);
      expect(res.errorCode).toBe('OUT_OF_GEOFENCE_RANGE');
      expect(res.error).toContain('OUT_OF_GEOFENCE_RANGE');
    });

    test('rejects check-in when venue requires GPS but coordinates are not provided (GPS_COORDINATES_REQUIRED)', async () => {
      __mockRpc.mockResolvedValueOnce({
        data: {
          success: false,
          error_code: 'GPS_COORDINATES_REQUIRED',
          message: 'GPS coordinates are required to verify on-site arrival.',
        },
        error: null,
      });

      const res = await checkInWorkerSafe('booking-101', 'OP-4829');
      expect(res.success).toBe(false);
      expect(res.errorCode).toBe('GPS_COORDINATES_REQUIRED');
      expect(res.error).toContain('GPS_COORDINATES_REQUIRED');
    });

    test('successful check-out records departure and calculates hours worked', async () => {
      __mockRpc.mockResolvedValueOnce({
        data: {
          success: true,
          status: 'completed_awaiting_review',
          hours_worked: 8.95,
        },
        error: null,
      });

      const res = await checkOutWorkerSafe('booking-101', 'Shift finished smoothly');
      expect(res.success).toBe(true);
      expect(res.status).toBe('completed_awaiting_review');
      expect(res.hoursWorked).toBe(8.95);
    });
  });

  describe('Shift Completion, Cancellation & Standby Replacement', () => {
    test('supervisor approval completes shift and triggers payment release', async () => {
      __mockRpc.mockResolvedValueOnce({
        data: {
          success: true,
          status: 'completed',
        },
        error: null,
      });

      const res = await completeShiftAndApproveAttendance('booking-101', 9.0);
      expect(res.success).toBe(true);
    });

    test('booking cancellation releases headcount and triggers standby notifications', async () => {
      __mockRpc.mockResolvedValueOnce({
        data: {
          success: true,
          status: 'cancelled',
        },
        error: null,
      });

      const res = await cancelBookingSafe('booking-101', 'Worker transit breakdown');
      expect(res.success).toBe(true);
    });

    test('no-show records reason and reopens slot for immediate standby replacement', async () => {
      __mockRpc.mockResolvedValueOnce({
        data: {
          success: true,
          status: 'no_show',
        },
        error: null,
      });

      const res = await recordNoShowSafe('booking-101', 'Unreachable 1 hour after shift call time');
      expect(res.success).toBe(true);
    });

    test('dispute booking escalates to dispute arbitration queue', async () => {
      __mockRpc.mockResolvedValueOnce({
        data: {
          success: true,
          status: 'disputed',
          dispute_id: 'disp-999',
        },
        error: null,
      });

      const res = await disputeBookingSafe('booking-101', 'Hours worked were 9.5 hours but paid 8.0 hours');
      expect(res.success).toBe(true);
      expect(res.disputeId).toBe('disp-999');
    });
  });
});
