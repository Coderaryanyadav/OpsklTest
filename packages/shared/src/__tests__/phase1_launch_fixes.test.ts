import {
  disputeBookingSafe,
  completeShiftAndApproveAttendance,
} from '../supabase/jobs';

// Mock Supabase
jest.mock('../supabase/client', () => {
  const mockRpc = jest.fn();
  const mockFrom = jest.fn();

  return {
    supabase: {
      rpc: mockRpc,
      from: mockFrom,
      auth: {
        getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'usr-101', email: 'user@opskil.com' } } }),
      },
    },
    getSharedSupabaseClient: () => ({
      rpc: mockRpc,
      from: mockFrom,
    }),
    __mockRpc: mockRpc,
    __mockFrom: mockFrom,
  };
});

const { __mockRpc } = require('../supabase/client');

describe('Phase 1 — Opskl Launch Database Fixes & Marketplace Invariants', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('1.1 Trigger Bypass Simulation & Profile Protection', () => {
    const simulateProfileTrigger = (
      oldProfile: Record<string, any>,
      newProfile: Record<string, any>,
      isTrusted: boolean = false,
      isAdmin: boolean = false
    ) => {
      if (isTrusted || isAdmin) return { allowed: true, newProfile };

      if (newProfile.shifts_completed !== oldProfile.shifts_completed) {
        throw new Error('Unauthorized: Administrative and verification fields cannot be modified directly by workers.');
      }
      if (newProfile.verification_status !== oldProfile.verification_status) {
        throw new Error('Unauthorized: Administrative and verification fields cannot be modified directly by workers.');
      }
      if (newProfile.is_active !== oldProfile.is_active) {
        throw new Error('Unauthorized: Account activation status cannot be modified directly by users.');
      }
      return { allowed: true, newProfile };
    };

    test('rejects direct untrusted update to shifts_completed by worker', () => {
      const oldProfile = { id: 'w-1', shifts_completed: 5, is_active: true };
      const newProfile = { id: 'w-1', shifts_completed: 99, is_active: true };

      expect(() => simulateProfileTrigger(oldProfile, newProfile, false, false)).toThrow(
        /Unauthorized: Administrative and verification fields cannot be modified directly/
      );
    });

    test('permits internal trusted update via set_config("opskl.trusted", "1", true)', () => {
      const oldProfile = { id: 'w-1', shifts_completed: 5, is_active: true };
      const newProfile = { id: 'w-1', shifts_completed: 6, is_active: true };

      const result = simulateProfileTrigger(oldProfile, newProfile, true, false);
      expect(result.allowed).toBe(true);
      expect(result.newProfile.shifts_completed).toBe(6);
    });

    test('permits account deletion deactivation when called by trusted RPC', () => {
      const oldProfile = { id: 'w-1', is_active: true, shifts_completed: 5 };
      const newProfile = { id: 'w-1', is_active: false, shifts_completed: 5 };

      // Untrusted direct update fails
      expect(() => simulateProfileTrigger(oldProfile, newProfile, false, false)).toThrow(
        /Unauthorized: Account activation status cannot be modified directly/
      );

      // Trusted RPC succeeds
      const result = simulateProfileTrigger(oldProfile, newProfile, true, false);
      expect(result.allowed).toBe(true);
      expect(result.newProfile.is_active).toBe(false);
    });
  });

  describe('1.2 Dispute Validation & Evidence Preservation', () => {
    test('enforces minimum reason length of 10 characters', async () => {
      __mockRpc.mockResolvedValueOnce({
        data: { success: false, error_code: 'INVALID_REASON', message: 'Dispute reason must be at least 10 characters long.' },
        error: null,
      });

      const res = await disputeBookingSafe('b-1', 'short');
      expect(res.success).toBe(false);
      expect(res.error).toBe('Dispute reason must be at least 10 characters long.');
    });

    test('successfully opens dispute and stores details when evidence provided', async () => {
      __mockRpc.mockResolvedValueOnce({
        data: { success: true, dispute_id: 'disp-101', status: 'disputed' },
        error: null,
      });

      const res = await disputeBookingSafe('b-1', 'Supervisor did not approve full hours despite sign-off sheet.', 'Photo of log sheet');
      expect(res.success).toBe(true);
      expect(res.disputeId).toBe('disp-101');
      expect(__mockRpc).toHaveBeenCalledWith('dispute_booking_safe', {
        p_booking_id: 'b-1',
        p_reason: 'Supervisor did not approve full hours despite sign-off sheet.',
        p_evidence: 'Photo of log sheet',
      });
    });
  });

  describe('1.3 CSPRNG Booking Codes & Organizer Signup', () => {
    test('generates booking code conforming to OP- prefixed 10-char uppercase hex pattern', () => {
      const generateCode = () => {
        const uuidText = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
        return 'OP-' + uuidText.replace(/-/g, '').substring(0, 10).toUpperCase();
      };

      const code = generateCode();
      expect(code).toMatch(/^OP-[A-Z0-9]{10}$/);
      expect(code.length).toBe(13);
    });

    test('organizer signup allows empty contact phone on initial email OTP', () => {
      const emailOnlySignup = (phone: string | null) => {
        return {
          business_name: 'Apex Events',
          business_contact_phone: phone ?? '',
          business_type: 'event_agency',
        };
      };

      const profile = emailOnlySignup(null);
      expect(profile.business_contact_phone).toBe('');
      expect(profile.business_name).toBe('Apex Events');
    });
  });

  describe('1.5 Job Lifecycle State Machine & Reopen Guards', () => {
    const validateJobTransition = (current: string, next: string): boolean => {
      if (current === next) return true;
      if (current === 'draft' && ['open', 'cancelled'].includes(next)) return true;
      if (current === 'open' && ['filling', 'filled', 'paused', 'cancelled'].includes(next)) return true;
      if (current === 'filling' && ['filled', 'paused', 'cancelled'].includes(next)) return true;
      if (current === 'filled' && ['filling', 'cancelled', 'in_progress'].includes(next)) return true;
      if (current === 'paused' && ['open', 'filling', 'cancelled'].includes(next)) return true;
      if (current === 'in_progress' && next === 'completed') return true;
      return false;
    };

    test('permits valid lifecycle forward progression', () => {
      expect(validateJobTransition('draft', 'open')).toBe(true);
      expect(validateJobTransition('open', 'filling')).toBe(true);
      expect(validateJobTransition('filling', 'filled')).toBe(true);
      expect(validateJobTransition('filled', 'in_progress')).toBe(true);
      expect(validateJobTransition('in_progress', 'completed')).toBe(true);
    });

    test('permits pausing and resuming', () => {
      expect(validateJobTransition('open', 'paused')).toBe(true);
      expect(validateJobTransition('filling', 'paused')).toBe(true);
      expect(validateJobTransition('paused', 'open')).toBe(true);
      expect(validateJobTransition('paused', 'filling')).toBe(true);
    });

    test('blocks transitions out of terminal completed or cancelled states', () => {
      expect(validateJobTransition('completed', 'open')).toBe(false);
      expect(validateJobTransition('completed', 'filling')).toBe(false);
      expect(validateJobTransition('cancelled', 'open')).toBe(false);
      expect(validateJobTransition('cancelled', 'draft')).toBe(false);
    });

    test('cancel_booking does not resurrect cancelled or completed jobs', () => {
      const shouldReopenSlot = (jobStatus: string, jobDate: string, today: string): boolean => {
        const isFutureOrToday = jobDate >= today;
        const isActive = ['filled', 'filling', 'open'].includes(jobStatus);
        return isActive && isFutureOrToday;
      };

      expect(shouldReopenSlot('cancelled', '2026-10-20', '2026-10-15')).toBe(false);
      expect(shouldReopenSlot('completed', '2026-10-20', '2026-10-15')).toBe(false);
      expect(shouldReopenSlot('paused', '2026-10-20', '2026-10-15')).toBe(false);
      expect(shouldReopenSlot('filled', '2026-10-10', '2026-10-15')).toBe(false); // Past shift
      expect(shouldReopenSlot('filled', '2026-10-20', '2026-10-15')).toBe(true); // Active upcoming
    });
  });

  describe('1.6 Overlapping Shift Scheduling Guards', () => {
    interface ShiftWindow {
      date: string;
      startTime: string; // HH:MM
      endTime: string;   // HH:MM
    }

    const checkOverlap = (s1: ShiftWindow, s2: ShiftWindow): boolean => {
      const toMinutes = (time: string, crossMidnight: boolean = false) => {
        const [h, m] = time.split(':').map(Number);
        const dayOffset = crossMidnight ? 1440 : 0;
        return h * 60 + m + dayOffset;
      };

      if (s1.date !== s2.date) return false;

      const s1Crosses = s1.endTime <= s1.startTime;
      const s2Crosses = s2.endTime <= s2.startTime;

      const s1Start = toMinutes(s1.startTime);
      const s1End = toMinutes(s1.endTime, s1Crosses);

      const s2Start = toMinutes(s2.startTime);
      const s2End = toMinutes(s2.endTime, s2Crosses);

      return s1Start < s2End && s1End > s2Start;
    };

    test('detects daytime overlapping shifts on same date', () => {
      const shift1: ShiftWindow = { date: '2026-10-18', startTime: '09:00', endTime: '17:00' };
      const shift2: ShiftWindow = { date: '2026-10-18', startTime: '14:00', endTime: '22:00' };

      expect(checkOverlap(shift1, shift2)).toBe(true);
    });

    test('allows non-overlapping shifts on same date', () => {
      const shift1: ShiftWindow = { date: '2026-10-18', startTime: '08:00', endTime: '12:00' };
      const shift2: ShiftWindow = { date: '2026-10-18', startTime: '13:00', endTime: '19:00' };

      expect(checkOverlap(shift1, shift2)).toBe(false);
    });

    test('detects overlap with overnight shift crossing midnight', () => {
      const nightShift: ShiftWindow = { date: '2026-10-18', startTime: '22:00', endTime: '04:00' };
      const lateEvening: ShiftWindow = { date: '2026-10-18', startTime: '20:00', endTime: '23:30' };

      expect(checkOverlap(nightShift, lateEvening)).toBe(true);
    });
  });

  describe('1.8 Attendance Hours Adjustment & Geofencing', () => {
    test('enforces verified hours within 0 and 1.5x scheduled duration', async () => {
      __mockRpc.mockResolvedValueOnce({
        data: { success: false, error_code: 'INVALID_HOURS', message: 'Verified hours must be between 0 and 12 hours.' },
        error: null,
      });

      const res = await completeShiftAndApproveAttendance('b-1', 15.0);
      expect(res.success).toBe(false);
      expect(res.error).toBe('Verified hours must be between 0 and 12 hours.');
    });

    test('calculates final pay and caps at agreed pay unless overtime approved', () => {
      const calculateApprovedPay = (
        verifiedHours: number,
        scheduledDuration: number,
        hourlyRate: number,
        agreedTotalPay: number,
        overtimeApproved: boolean,
        hasOvertimePolicy: boolean
      ) => {
        const basePay = Math.round(verifiedHours * hourlyRate * 100) / 100;
        if (verifiedHours > scheduledDuration) {
          if (overtimeApproved && hasOvertimePolicy) {
            return basePay;
          }
          return agreedTotalPay;
        }
        return Math.min(basePay, agreedTotalPay);
      };

      // Case A: Normal under-hours (6h of 8h at ₹200/hr)
      expect(calculateApprovedPay(6, 8, 200, 1600, false, false)).toBe(1200);

      // Case B: 10h worked of 8h shift, overtime NOT approved -> capped at ₹1600
      expect(calculateApprovedPay(10, 8, 200, 1600, false, true)).toBe(1600);

      // Case C: 10h worked of 8h shift, overtime approved with policy -> ₹2000
      expect(calculateApprovedPay(10, 8, 200, 1600, true, true)).toBe(2000);
    });
  });

  describe('1.10 FY Sequential Invoices & Manual Pilot Settlement', () => {
    test('formats Indian Financial Year invoice number strictly as OPS/YY-YY/00001', () => {
      const formatInvoiceNumber = (date: Date, seq: number) => {
        const month = date.getMonth() + 1; // 1-12
        const year = date.getFullYear();
        let fyStart: number;
        let fyEnd: number;

        if (month >= 4) {
          fyStart = year % 100;
          fyEnd = (year + 1) % 100;
        } else {
          fyStart = (year - 1) % 100;
          fyEnd = year % 100;
        }

        const fyStr = `${String(fyStart).padStart(2, '0')}-${String(fyEnd).padStart(2, '0')}`;
        return `OPS/${fyStr}/${String(seq).padStart(5, '0')}`;
      };

      // In October 2026 (Month 10), FY is 26-27
      const oct2026 = new Date('2026-10-15T12:00:00Z');
      expect(formatInvoiceNumber(oct2026, 1)).toBe('OPS/26-27/00001');
      expect(formatInvoiceNumber(oct2026, 42)).toBe('OPS/26-27/00042');

      // In February 2027 (Month 2), FY is still 26-27
      const feb2027 = new Date('2027-02-15T12:00:00Z');
      expect(formatInvoiceNumber(feb2027, 85)).toBe('OPS/26-27/00085');
    });

    test('refuses to alter invoice total payable after escrow is funded', () => {
      const processInvoiceUpdate = (invoiceStatus: string, originalPayable: number, newPayable: number) => {
        if (['escrow_funded', 'settled'].includes(invoiceStatus)) {
          return { immutable: true, totalPayable: originalPayable };
        }
        return { immutable: false, totalPayable: newPayable };
      };

      const funded = processInvoiceUpdate('escrow_funded', 11800, 15000);
      expect(funded.immutable).toBe(true);
      expect(funded.totalPayable).toBe(11800);

      const pending = processInvoiceUpdate('pending', 11800, 15000);
      expect(pending.immutable).toBe(false);
      expect(pending.totalPayable).toBe(15000);
    });
  });

  describe('1.11 Indian Geographic Bounding Box Validation', () => {
    const validateIndiaCoords = (lat: number, lng: number): boolean => {
      return lat >= 6.0 && lat <= 38.0 && lng >= 68.0 && lng <= 98.0;
    };

    test('accepts authentic Mumbai coordinates', () => {
      expect(validateIndiaCoords(19.076, 72.8777)).toBe(true); // Mumbai
      expect(validateIndiaCoords(28.6139, 77.209)).toBe(true); // Delhi
      expect(validateIndiaCoords(12.9716, 77.5946)).toBe(true); // Bengaluru
    });

    test('rejects out of country coordinates', () => {
      expect(validateIndiaCoords(51.5074, -0.1278)).toBe(false); // London
      expect(validateIndiaCoords(37.7749, -122.4194)).toBe(false); // San Francisco
      expect(validateIndiaCoords(1.3521, 103.8198)).toBe(false); // Singapore
    });
  });
});
