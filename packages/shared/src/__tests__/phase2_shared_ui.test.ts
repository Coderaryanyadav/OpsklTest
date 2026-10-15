import {
  redactSensitiveData,
  fetchUserNotifications,
  sendNotificationSafe,
  fetchUserProfile,
  cancelAccountDeletionSafe,
} from '../index';

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

const { __mockRpc, __mockFrom } = jest.requireMock('../supabase/client');

describe('Phase 2 — Shared & Design System Verification Suite', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('2.1 PII & Location Redaction in Logger', () => {
    test('redacts all sensitive PII fields including UPI, Aadhaar, PAN, GSTIN, and GPS coordinates', () => {
      const payload = {
        code: '123456',
        lat: 19.076,
        lng: 72.8777,
        latitude: 19.076,
        longitude: 72.8777,
        email: 'user@example.com',
        phone: '+919820098200',
        upi: 'user@okhdfcbank',
        upi_id: 'user@okhdfcbank',
        aadhaar: '123456789012',
        pan: 'ABCDE1234F',
        gstin: '27ABCDE1234F1Z5',
        title: 'VIP Usher',
        wage: 1500,
      };

      const redacted = redactSensitiveData(payload);

      expect(redacted.code).toBe('[REDACTED]');
      expect(redacted.lat).toBe('[REDACTED]');
      expect(redacted.lng).toBe('[REDACTED]');
      expect(redacted.latitude).toBe('[REDACTED]');
      expect(redacted.longitude).toBe('[REDACTED]');
      expect(redacted.email).toBe('[REDACTED]');
      expect(redacted.phone).toBe('[REDACTED]');
      expect(redacted.upi).toBe('[REDACTED]');
      expect(redacted.upi_id).toBe('[REDACTED]');
      expect(redacted.aadhaar).toBe('[REDACTED]');
      expect(redacted.pan).toBe('[REDACTED]');
      expect(redacted.gstin).toBe('[REDACTED]');

      // Non-sensitive data remains untouched
      expect(redacted.title).toBe('VIP Usher');
      expect(redacted.wage).toBe(1500);
    });
  });

  describe('2.3 Notifications Error Handling & Zero Fake Fallback', () => {
    test('throws when notification query fails, never returning hardcoded demo notifications', async () => {
      __mockFrom.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            neq: jest.fn().mockReturnValue({
              order: jest.fn().mockReturnValue({
                limit: jest.fn().mockResolvedValue({
                  data: null,
                  error: { message: 'Database connection failed' },
                }),
              }),
            }),
          }),
        }),
      });

      await expect(fetchUserNotifications('user-1')).rejects.toThrow('Database connection failed');
    });

    test('sendNotificationSafe returns success: false with error message when RPC fails (fails closed)', async () => {
      __mockRpc.mockResolvedValue({
        data: null,
        error: { message: 'RPC execution failed' },
      });

      const res = await sendNotificationSafe({
        userId: 'user-1',
        title: 'Test Alert',
        body: 'Alert body',
        type: 'shift_reminder',
        priority: 'high',
        idempotencyKey: 'notif_test_1',
      });

      expect(res.success).toBe(false);
      expect(res.error).toBe('RPC execution failed');
    });
  });

  describe('2.2 & 2.10 Profile Fetching & Error Differentiation', () => {
    test('returns null when profile row is not found (PGRST116)', async () => {
      __mockFrom.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: { code: 'PGRST116', message: 'Row not found' },
            }),
          }),
        }),
      });

      const profile = await fetchUserProfile('user-new-404');
      expect(profile).toBeNull();
    });

    test('throws on genuine network or database errors to prevent session destruction', async () => {
      __mockFrom.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: { code: 'ECONNREFUSED', message: 'Connection refused' },
            }),
          }),
        }),
      });

      await expect(fetchUserProfile('user-existing-500')).rejects.toThrow('Connection refused');
    });

    test('cancelAccountDeletionSafe invokes RPC and returns status', async () => {
      __mockRpc.mockResolvedValue({
        data: { success: true },
        error: null,
      });

      const res = await cancelAccountDeletionSafe();
      expect(res.success).toBe(true);
    });
  });
});

