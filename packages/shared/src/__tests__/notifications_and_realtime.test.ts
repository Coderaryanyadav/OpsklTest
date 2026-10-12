import {
  buildNotificationIdempotencyKey,
  buildJobOpportunityNotification,
  buildApplicationSubmittedNotification,
  buildShortlistedNotification,
  buildWorkerSelectedNotification,
  buildBookingConfirmedNotification,
  buildShiftReminderNotification,
  buildStandbyCalloutNotification,
  buildAttendanceUpdateNotification,
  buildPayoutNotification,
  buildDisputeNotification,
  isValidExpoPushToken,
  buildExpoPushMessage,
  formatIndianMobileE164,
  buildWhatsAppShiftConfirmation,
  buildWhatsAppPayoutSettled,
  buildDltShiftReminderSms,
  buildDltPayoutCreditSms,
  sendNotificationSafe,
  subscribeToUserNotifications,
  subscribeToShiftRoster,
} from '../index';

// Mock Supabase client
jest.mock('../supabase/client', () => {
  const mockRpc = jest.fn();
  const mockFrom = jest.fn();
  const mockChannel = jest.fn();
  const mockRemoveChannel = jest.fn();

  return {
    supabase: {
      rpc: mockRpc,
      from: mockFrom,
      channel: mockChannel,
      removeChannel: mockRemoveChannel,
    },
    __mockRpc: mockRpc,
    __mockFrom: mockFrom,
    __mockChannel: mockChannel,
    __mockRemoveChannel: mockRemoveChannel,
  };
});

const { __mockRpc, __mockChannel, __mockRemoveChannel } = require('../supabase/client');

describe('Phase 7 — Opskl Notifications & Real-Time Engine', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Event Factories & Deterministic Idempotency Keys', () => {
    test('generates deterministic idempotency key for same event and entity', () => {
      const key1 = buildNotificationIdempotencyKey('booking_confirmed', 'book-101');
      const key2 = buildNotificationIdempotencyKey('booking_confirmed', 'book-101');
      expect(key1).toBe('notif_booking_confirmed_book-101');
      expect(key1).toBe(key2);
    });

    test('builds job opportunity notification matching locality', () => {
      const notif = buildJobOpportunityNotification('worker-1', {
        id: 'job-1',
        title: 'VIP Usher',
        wageInr: 1800,
        locality: 'BKC, Mumbai',
      });

      expect(notif.userId).toBe('worker-1');
      expect(notif.title).toContain('Shift Match');
      expect(notif.body).toContain('₹1800/day');
      expect(notif.type).toBe('job_opportunity');
      expect(notif.idempotencyKey).toBe('notif_job_opportunity_job-1_worker-1');
    });

    test('builds application submission and shortlisting events', () => {
      const appNotif = buildApplicationSubmittedNotification('worker-1', 'Event Host', 'app-1');
      expect(appNotif.type).toBe('application_submitted');
      expect(appNotif.idempotencyKey).toBe('notif_application_submitted_app-1');

      const shortNotif = buildShortlistedNotification('worker-1', 'Event Host', 'app-1');
      expect(shortNotif.type).toBe('application_shortlisted');
      expect(shortNotif.priority).toBe('high');
      expect(shortNotif.body).toContain('shortlisted');
    });

    test('builds urgent worker selection notification with confirmation CTA', () => {
      const selNotif = buildWorkerSelectedNotification('worker-1', 'Auto Expo Usher', 'book-200');
      expect(selNotif.type).toBe('worker_selected');
      expect(selNotif.priority).toBe('urgent');
      expect(selNotif.body).toContain('Confirm your shift within 30 minutes');
    });

    test('builds shift confirmation and T-2h reminder notifications', () => {
      const confNotif = buildBookingConfirmedNotification(
        'worker-1',
        'Auto Expo Usher',
        'Jio World Centre',
        'book-200'
      );
      expect(confNotif.type).toBe('booking_confirmed');
      expect(confNotif.actionUrl).toBe('/(tabs)/my-shifts');

      const remNotif = buildShiftReminderNotification(
        'worker-1',
        'Auto Expo Usher',
        '08:30 AM',
        'book-200'
      );
      expect(remNotif.type).toBe('shift_reminder');
      expect(remNotif.priority).toBe('urgent');
      expect(remNotif.idempotencyKey).toBe('notif_shift_reminder_book-200_t_minus_2h');
    });

    test('builds standby callout replacement notification upon cancellation', () => {
      const standbyNotif = buildStandbyCalloutNotification('worker-standby', 'VIP Marshall', 'job-99');
      expect(standbyNotif.type).toBe('standby_callout');
      expect(standbyNotif.priority).toBe('urgent');
      expect(standbyNotif.title).toContain('Standby Slot Open');
    });

    test('builds check-in arrival and check-out departure updates for organizers', () => {
      const checkInNotif = buildAttendanceUpdateNotification(
        'org-1',
        'Aakash Sharma',
        'Auto Expo Usher',
        'check_in',
        'book-200'
      );
      expect(checkInNotif.type).toBe('check_in');
      expect(checkInNotif.title).toContain('Arrival Verified');

      const checkOutNotif = buildAttendanceUpdateNotification(
        'org-1',
        'Aakash Sharma',
        'Auto Expo Usher',
        'check_out',
        'book-200'
      );
      expect(checkOutNotif.type).toBe('check_out');
      expect(checkOutNotif.title).toContain('Departure Recorded');
    });

    test('builds payout settled and failed notifications with bank UTR reference', () => {
      const settledNotif = buildPayoutNotification(
        'worker-1',
        1620,
        '428901827461',
        'settled',
        'pay-001'
      );
      expect(settledNotif.type).toBe('payout_settled');
      expect(settledNotif.body).toContain('428901827461');
      expect(settledNotif.actionUrl).toBe('/(tabs)/earnings');

      const failedNotif = buildPayoutNotification(
        'worker-1',
        1620,
        'VPA_INVALID',
        'failed',
        'pay-002'
      );
      expect(failedNotif.type).toBe('payout_failed');
      expect(failedNotif.priority).toBe('urgent');
    });

    test('builds dispute notification', () => {
      const dispNotif = buildDisputeNotification('worker-1', 'disp-101', 'under_review');
      expect(dispNotif.type).toBe('dispute_update');
      expect(dispNotif.body).toContain('under_review');
    });
  });

  describe('Expo Push Token Validation & Message Formatting', () => {
    test('validates Expo Push Token format strictly', () => {
      expect(isValidExpoPushToken('ExpoPushToken[xxxxxxxxxxxxxxxxxxxxxx]')).toBe(true);
      expect(isValidExpoPushToken('ExponentPushToken[1234567890abcdef]')).toBe(true);
      expect(isValidExpoPushToken('invalid-token')).toBe(false);
      expect(isValidExpoPushToken('')).toBe(false);
      expect(isValidExpoPushToken('FCM-raw-token')).toBe(false);
    });

    test('builds high priority Expo push message payload', () => {
      const payload = buildWorkerSelectedNotification('worker-1', 'Auto Expo', 'book-1');
      const message = buildExpoPushMessage('ExpoPushToken[valid_token_123]', payload);

      expect(message.to).toBe('ExpoPushToken[valid_token_123]');
      expect(message.priority).toBe('high');
      expect(message.sound).toBe('default');
      expect(message.data?.actionUrl).toBe('/shift/book-1');
    });
  });

  describe('External Messaging (WhatsApp Business & DLT Compliant SMS)', () => {
    test('formats Indian mobile number into standard E.164 format', () => {
      expect(formatIndianMobileE164('9820098200')).toBe('+919820098200');
      expect(formatIndianMobileE164('+91 98200 98200')).toBe('+919820098200');
      expect(formatIndianMobileE164('919820098200')).toBe('+919820098200');
      expect(formatIndianMobileE164('123')).toBeNull();
    });

    test('builds WhatsApp Business shift confirmation template payload', () => {
      const msg = buildWhatsAppShiftConfirmation(
        '9820098200',
        'Aakash',
        'Auto Expo Host',
        'Oct 18, 2026',
        'Jio World Centre'
      );

      expect(msg).not.toBeNull();
      expect(msg?.templateName).toBe('opskil_shift_confirmed_v1');
      expect(msg?.bodyParameters).toEqual(['Aakash', 'Auto Expo Host', 'Oct 18, 2026', 'Jio World Centre']);
    });

    test('builds WhatsApp Business payout settled template payload', () => {
      const msg = buildWhatsAppPayoutSettled('9820098200', 'Aakash', 1620, '428901827461');
      expect(msg).not.toBeNull();
      expect(msg?.templateName).toBe('opskil_payout_settled_v1');
      expect(msg?.bodyParameters).toEqual(['Aakash', '₹1620', '428901827461']);
    });

    test('builds TRAI DLT approved SMS message with registered sender header and template ID', () => {
      const sms = buildDltPayoutCreditSms(
        '9820098200',
        1620,
        'Auto Expo Host',
        '428901827461'
      );

      expect(sms).not.toBeNull();
      expect(sms?.senderHeader).toBe('OPSKIL');
      expect(sms?.dltTemplateId).toBe('1707168902148192002');
      expect(sms?.messageText).toContain('Rs.1620');
      expect(sms?.messageText).toContain('428901827461');
    });

    test('builds TRAI DLT shift reminder SMS', () => {
      const sms = buildDltShiftReminderSms(
        '9820098200',
        'Aakash',
        'Auto Expo Host',
        'BKC'
      );

      expect(sms?.senderHeader).toBe('OPSKIL');
      expect(sms?.dltTemplateId).toBe('1707168902148192001');
      expect(sms?.messageText).toContain('starts in 2 hours');
    });
  });

  describe('Idempotent Delivery & User Preferences Suppression', () => {
    test('dispatches notification and returns duplicate: false on first delivery', async () => {
      __mockRpc.mockResolvedValueOnce({
        data: {
          success: true,
          duplicate: false,
          suppressed: false,
          notification_id: 'notif-1',
        },
        error: null,
      });

      const notif = buildBookingConfirmedNotification('worker-1', 'Auto Expo', 'BKC', 'book-1');
      const res = await sendNotificationSafe(notif, 'in_app');

      expect(res.success).toBe(true);
      expect(res.duplicate).toBe(false);
      expect(res.notificationId).toBe('notif-1');
    });

    test('suppresses duplicate delivery when identical idempotency key is submitted', async () => {
      __mockRpc.mockResolvedValueOnce({
        data: {
          success: true,
          duplicate: true,
          suppressed: false,
          notification_id: 'notif-1',
        },
        error: null,
      });

      const notif = buildBookingConfirmedNotification('worker-1', 'Auto Expo', 'BKC', 'book-1');
      const res = await sendNotificationSafe(notif, 'in_app');

      expect(res.success).toBe(true);
      expect(res.duplicate).toBe(true);
    });
  });

  describe('Supabase Realtime Channel Subscriptions & Cleanup', () => {
    test('subscribes to Realtime notifications channel and tears down cleanly', () => {
      const mockChannelInstance = {
        on: jest.fn().mockReturnThis(),
        subscribe: jest.fn().mockReturnThis(),
      };
      __mockChannel.mockReturnValue(mockChannelInstance);

      const onNotif = jest.fn();
      const unsubscribe = subscribeToUserNotifications('worker-101', onNotif);

      expect(__mockChannel).toHaveBeenCalledWith('user-notifs-worker-101');
      expect(mockChannelInstance.on).toHaveBeenCalled();
      expect(mockChannelInstance.subscribe).toHaveBeenCalled();

      // Trigger cleanup
      unsubscribe();
      expect(__mockRemoveChannel).toHaveBeenCalledWith(mockChannelInstance);
    });

    test('subscribes to live shift roster channel and tears down cleanly', () => {
      const mockChannelInstance = {
        on: jest.fn().mockReturnThis(),
        subscribe: jest.fn().mockReturnThis(),
      };
      __mockChannel.mockReturnValue(mockChannelInstance);

      const onRoster = jest.fn();
      const unsubscribe = subscribeToShiftRoster('job-apex-01', onRoster);

      expect(__mockChannel).toHaveBeenCalledWith('roster-job-apex-01');

      // Trigger cleanup
      unsubscribe();
      expect(__mockRemoveChannel).toHaveBeenCalledWith(mockChannelInstance);
    });
  });
});
