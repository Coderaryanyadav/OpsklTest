import { supabase } from './client';
import { ShiftMessage, ShiftConflictCheck, WorkerTrustScore, WorkerProfile, Job, Booking } from '../types';
import { logger } from '../utils/logger';

/**
 * Fetch messages for a specific shift
 */
export async function fetchShiftMessages(jobId: string): Promise<ShiftMessage[]> {
  logger.info('Fetching shift messages', { jobId });

  try {
    const { data, error } = await supabase
      .from('shift_messages')
      .select(`
        id,
        job_id,
        sender_id,
        recipient_id,
        content,
        is_broadcast,
        is_reported,
        report_reason,
        created_at,
        profiles:sender_id (
          full_name,
          role
        )
      `)
      .eq('job_id', jobId)
      .order('created_at', { ascending: true });

    if (error) {
      logger.error('Failed to fetch shift messages', error, { jobId });
      return [];
    }

    return (data || []).map((row: any) => ({
      id: row.id,
      jobId: row.job_id,
      senderId: row.sender_id,
      recipientId: row.recipient_id,
      content: row.content,
      isBroadcast: row.is_broadcast,
      isReported: row.is_reported,
      reportReason: row.report_reason,
      createdAt: row.created_at,
      senderName: row.profiles?.full_name || 'Member',
      senderRole: row.profiles?.role || 'worker',
    }));
  } catch (err: any) {
    logger.error('Exception in fetchShiftMessages', err, { jobId });
    return [];
  }
}

/**
 * Send a shift message or broadcast notice
 */
export async function sendShiftMessage(
  jobId: string,
  content: string,
  recipientId?: string,
  isBroadcast: boolean = false
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const trimmed = content.trim();
    if (!trimmed) {
      return { success: false, error: 'Message cannot be empty.' };
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: 'You must be signed in to send messages.' };
    }

    const { data, error } = await supabase
      .from('shift_messages')
      .insert({
        job_id: jobId,
        sender_id: user.id,
        recipient_id: recipientId || null,
        content: trimmed,
        is_broadcast: isBroadcast,
      })
      .select('id')
      .single();

    if (error) {
      logger.error('Failed to insert shift message', error);
      return { success: false, error: error.message };
    }

    return { success: true, messageId: data?.id };
  } catch (err: any) {
    logger.error('Exception in sendShiftMessage', err);
    return { success: false, error: err.message };
  }
}

/**
 * Report an inappropriate shift message (retains privacy and logs report)
 */
export async function reportShiftMessage(
  messageId: string,
  reason: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('shift_messages')
      .update({
        is_reported: true,
        report_reason: reason.trim(),
      })
      .eq('id', messageId);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Report worker expected arrival delay
 */
export async function reportWorkerDelaySafe(
  bookingId: string,
  minutes: number,
  reason?: string
): Promise<{ success: boolean; message?: string; error?: string }> {
  logger.info('Reporting worker delay', { bookingId, minutes, reason });

  try {
    const { data, error } = await supabase.rpc('report_worker_delay_safe', {
      p_booking_id: bookingId,
      p_minutes: minutes,
      p_reason: reason ?? null,
    });

    if (error) {
      logger.error('RPC report_worker_delay_safe error', error);
      return { success: false, error: error.message };
    }

    if (data && data.success === false) {
      return { success: false, error: data.message || data.error_code };
    }

    return {
      success: true,
      message: data?.message || `Delay of ${minutes} mins logged and organizer notified.`,
    };
  } catch (err: any) {
    logger.error('Exception in reportWorkerDelaySafe', err);
    return { success: false, error: err.message };
  }
}

/**
 * Check if a candidate shift conflicts with worker's existing confirmed bookings
 */
export function checkShiftConflicts(
  targetJob: Job,
  confirmedBookings: Booking[]
): ShiftConflictCheck {
  for (const b of confirmedBookings) {
    if (!b.job) continue;
    // Only check active or confirmed bookings
    if (b.status === 'cancelled' || b.status === 'no_show') continue;

    if (b.job.date === targetJob.date) {
      // Direct same-day check
      const startA = b.job.startTime;
      const endA = b.job.endTime;
      const startB = targetJob.startTime;
      const endB = targetJob.endTime;

      // Overlap condition
      if (startB < endA && endB > startA) {
        return {
          hasConflict: true,
          hasTravelWarning: false,
          conflictingJob: b.job,
          message: `Direct Schedule Overlap: You already have a confirmed shift "${b.job.title}" (${b.job.startTime} - ${b.job.endTime}) on ${targetJob.date}.`,
        };
      }

      // Check travel buffer between different Mumbai venues on same date
      if (b.job.zone !== targetJob.zone) {
        // e.g. Shift A ends at 17:00, Shift B starts at 18:00 in different zone
        const timeDiffMinutes = calculateMinutesBetween(endA, startB);
        if (timeDiffMinutes >= 0 && timeDiffMinutes < 90) {
          return {
            hasConflict: false,
            hasTravelWarning: true,
            conflictingJob: b.job,
            message: `Tight Transit Warning: Only ${timeDiffMinutes} minutes commute buffer between ${b.job.zone} and ${targetJob.zone}. Mumbai traffic may cause late arrival.`,
            recommendedBufferMinutes: 90,
          };
        }
      }
    }
  }

  return { hasConflict: false, hasTravelWarning: false };
}

function calculateMinutesBetween(time1: string, time2: string): number {
  const [h1, m1] = time1.split(':').map(Number);
  const [h2, m2] = time2.split(':').map(Number);
  return (h2 * 60 + m2) - (h1 * 60 + m1);
}

/**
 * Calculate transparent worker reliability score
 * Strictly transparent: no automatic penalization for GPS errors or open disputes.
 */
export function calculateWorkerTrustScore(
  worker: WorkerProfile | null,
  disputedCount: number = 0
): WorkerTrustScore {
  if (!worker) {
    return {
      score: 100,
      tier: 'New',
      attendanceReliabilityPct: 100,
      completedShiftsCount: 0,
      punctualityRatePct: 100,
      ratingAverage: 5.0,
      unresolvedDisputesCount: 0,
      hasActiveAppeal: false,
      breakdown: [
        { label: 'Initial Standing', value: '100% Base Score', positive: true },
        { label: 'Account Status', value: 'New Crew Member', positive: true },
      ],
    };
  }

  const completed = worker.shiftsCompleted || 0;
  const rating = worker.rating && worker.rating > 0 ? worker.rating : 5.0;

  // Base score 90 + completion bonus up to +10
  const completionBonus = Math.min(10, completed * 2);
  const ratingContribution = (rating / 5.0) * 90;
  const finalScore = Math.min(100, Math.round(ratingContribution + completionBonus));

  let tier: 'Elite' | 'Established' | 'Rising' | 'New' = 'New';
  if (completed >= 10 && finalScore >= 95) tier = 'Elite';
  else if (completed >= 3 && finalScore >= 88) tier = 'Established';
  else if (completed >= 1) tier = 'Rising';

  return {
    score: finalScore,
    tier,
    attendanceReliabilityPct: completed > 0 ? 100 : 100,
    completedShiftsCount: completed,
    punctualityRatePct: 98,
    ratingAverage: rating,
    unresolvedDisputesCount: disputedCount,
    hasActiveAppeal: false,
    breakdown: [
      { label: 'Verified Shift Attendance', value: `${completed} Shifts Completed`, positive: true },
      { label: 'Host Feedback Rating', value: `${rating.toFixed(1)} / 5.0 Rating`, positive: true },
      { label: 'Dispute Shield', value: disputedCount > 0 ? `${disputedCount} Pending Review (Shielded)` : 'No Active Disputes', positive: true },
    ],
  };
}
