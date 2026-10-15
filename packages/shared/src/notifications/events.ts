import { NotificationType, NotificationPriority } from '../types';

export interface NotificationPayload {
  userId: string;
  title: string;
  body: string;
  type: NotificationType;
  priority: NotificationPriority;
  idempotencyKey: string;
  actionUrl?: string;
  metadata?: Record<string, any>;
}

/**
 * Deterministic Idempotency Key Generator for Notifications
 */
export function buildNotificationIdempotencyKey(
  type: NotificationType,
  entityId: string,
  qualifier?: string
): string {
  const parts = ['notif', type, entityId];
  if (qualifier) parts.push(qualifier);
  return parts.join('_');
}

// 1. Relevant Job Opportunities
export function buildJobOpportunityNotification(
  userId: string,
  job: { id: string; title: string; wageInr: number; locality: string }
): NotificationPayload {
  return {
    userId,
    title: 'New Shift Match in Mumbai',
    body: `${job.title} at ${job.locality} • ₹${job.wageInr}/day. Tap to apply.`,
    type: 'job_opportunity',
    priority: 'normal',
    idempotencyKey: buildNotificationIdempotencyKey('job_opportunity', job.id, userId),
    actionUrl: `/shift/${job.id}`,
    metadata: { jobId: job.id, wage: job.wageInr },
  };
}

// 2. Application Submitted
export function buildApplicationSubmittedNotification(
  userId: string,
  jobTitle: string,
  applicationId: string
): NotificationPayload {
  return {
    userId,
    title: 'Application Received',
    body: `Your application for "${jobTitle}" has been submitted to the organizer.`,
    type: 'application_submitted',
    priority: 'normal',
    idempotencyKey: buildNotificationIdempotencyKey('application_submitted', applicationId),
    metadata: { applicationId },
  };
}

// 3. Shortlisted & Rejected
export function buildShortlistedNotification(
  userId: string,
  jobTitle: string,
  applicationId: string
): NotificationPayload {
  return {
    userId,
    title: 'You are Shortlisted! 🎉',
    body: `The organizer shortlisted your profile for "${jobTitle}". Stay alert for final selection.`,
    type: 'application_shortlisted',
    priority: 'high',
    idempotencyKey: buildNotificationIdempotencyKey('application_shortlisted', applicationId),
    metadata: { applicationId },
  };
}

// 4. Worker Selection (Awaiting Worker Confirmation)
export function buildWorkerSelectedNotification(
  userId: string,
  jobTitle: string,
  bookingId: string
): NotificationPayload {
  return {
    userId,
    title: 'Action Required: You are Selected! ⭐',
    body: `You have been selected for "${jobTitle}". Confirm your shift within 30 minutes to lock your spot.`,
    type: 'worker_selected',
    priority: 'urgent',
    idempotencyKey: buildNotificationIdempotencyKey('worker_selected', bookingId),
    actionUrl: `/shift/${bookingId}`,
    metadata: { bookingId },
  };
}

// 5. Booking Confirmation
export function buildBookingConfirmedNotification(
  userId: string,
  jobTitle: string,
  venue: string,
  bookingId: string
): NotificationPayload {
  return {
    userId,
    title: 'Shift Confirmed ✅',
    body: `Your spot for "${jobTitle}" at ${venue} is confirmed. Your check-in pass is ready in My Shifts.`,
    type: 'booking_confirmed',
    priority: 'high',
    idempotencyKey: buildNotificationIdempotencyKey('booking_confirmed', bookingId),
    actionUrl: '/(tabs)/my-shifts',
    metadata: { bookingId, venue },
  };
}

// 6. Upcoming Shift Reminder (T-2 hours)
export function buildShiftReminderNotification(
  userId: string,
  jobTitle: string,
  reportingTime: string,
  bookingId: string
): NotificationPayload {
  return {
    userId,
    title: 'Shift Reminder ⏰',
    body: `"${jobTitle}" starts at ${reportingTime}. Ensure you arrive 15 minutes early with your digital check-in pass.`,
    type: 'shift_reminder',
    priority: 'urgent',
    idempotencyKey: buildNotificationIdempotencyKey('shift_reminder', bookingId, 't_minus_2h'),
    actionUrl: '/(tabs)/my-shifts',
    metadata: { bookingId, reportingTime },
  };
}

// 7. Cancellation & Standby Replacement Callout
export function buildStandbyCalloutNotification(
  userId: string,
  jobTitle: string,
  jobId: string
): NotificationPayload {
  return {
    userId,
    title: 'Urgent Opening: Standby Slot Open! ⚡',
    body: `A confirmed spot opened up for "${jobTitle}". Immediate confirmation available.`,
    type: 'standby_callout',
    priority: 'urgent',
    idempotencyKey: buildNotificationIdempotencyKey('standby_callout', jobId, userId),
    actionUrl: `/shift/${jobId}`,
    metadata: { jobId },
  };
}

// 8. Attendance Check-In / Check-Out
export function buildAttendanceUpdateNotification(
  organizerUserId: string,
  workerName: string,
  shiftTitle: string,
  type: 'check_in' | 'check_out',
  bookingId: string
): NotificationPayload {
  const isCheckIn = type === 'check_in';
  return {
    userId: organizerUserId,
    title: isCheckIn ? 'Crew Arrival Verified 📍' : 'Crew Departure Recorded 👋',
    body: `${workerName} has ${isCheckIn ? 'checked in at venue' : 'completed duty and checked out'} for "${shiftTitle}".`,
    type: isCheckIn ? 'check_in' : 'check_out',
    priority: 'normal',
    idempotencyKey: buildNotificationIdempotencyKey(type, bookingId),
    actionUrl: `/shift/${bookingId}`,
    metadata: { bookingId, workerName },
  };
}

// 9. Wage Approval & Payout Settlement
export function buildPayoutNotification(
  userId: string,
  amountInr: number,
  utrOrError: string,
  status: 'settled' | 'failed',
  paymentId: string
): NotificationPayload {
  const isSettled = status === 'settled';
  return {
    userId,
    title: isSettled ? 'Shift Payout Credited! 💸' : 'Payout Action Required ⚠️',
    body: isSettled
      ? `₹${amountInr} has been credited to your bank via UPI. UTR: ${utrOrError}.`
      : `Payout of ₹${amountInr} delayed (${utrOrError}). Tap to verify your UPI handle.`,
    type: isSettled ? 'payout_settled' : 'payout_failed',
    priority: isSettled ? 'high' : 'urgent',
    idempotencyKey: buildNotificationIdempotencyKey(
      isSettled ? 'payout_settled' : 'payout_failed',
      paymentId
    ),
    actionUrl: '/(tabs)/earnings',
    metadata: { paymentId, amountInr },
  };
}

// 10. Dispute Update
export function buildDisputeNotification(
  userId: string,
  disputeId: string,
  status: string
): NotificationPayload {
  return {
    userId,
    title: 'Dispute Status Update ⚖️',
    body: `Your shift review case has been updated to "${status}". Platform mediation notes attached.`,
    type: 'dispute_update',
    priority: 'high',
    idempotencyKey: buildNotificationIdempotencyKey('dispute_update', disputeId, status),
    actionUrl: '/(tabs)/my-shifts',
    metadata: { disputeId, status },
  };
}
