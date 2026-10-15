import { supabase } from '../supabase/client';
import { Notification } from '../types';
import { logger } from '../utils/logger';

/**
 * Helper to safely clean up any existing channel instance before recreating.
 * Prevents "cannot add postgres_changes callbacks after subscribe()" when
 * components re-render or hot-reload.
 */
function safelyCleanExistingChannel(channelName: string): void {
  if (typeof (supabase as any).getChannels === 'function') {
    const existing = (supabase as any).getChannels().find(
      (c: any) => c.topic === `realtime:${channelName}` || c.topic === channelName
    );
    if (existing) {
      (supabase as any).removeChannel(existing);
    }
  }
}

/**
 * Subscribes to Realtime in-app notifications for a user.
 * Returns a teardown function for useEffect cleanup.
 */
export function subscribeToUserNotifications(
  userId: string,
  onNotification: (notification: Notification) => void
): () => void {
  const channelName = `user-notifs-${userId}`;
  logger.info('Subscribing to Realtime notifications channel', { channelName });

  safelyCleanExistingChannel(channelName);

  const channel = supabase
    .channel(channelName)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${userId}`,
      },
      (payload: any) => {
        logger.info('Realtime notification received', { id: payload.new?.id });
        if (payload.new) {
          onNotification({
            id: payload.new.id,
            userId: payload.new.user_id,
            title: payload.new.title,
            body: payload.new.body,
            type: payload.new.type,
            channel: payload.new.channel,
            idempotencyKey: payload.new.idempotency_key,
            deliveryStatus: payload.new.delivery_status,
            actionUrl: payload.new.action_url,
            priority: payload.new.priority,
            read: payload.new.read,
            metadata: payload.new.metadata,
            createdAt: payload.new.created_at,
          });
        }
      }
    )
    .subscribe();

  // Return teardown function
  return () => {
    logger.info('Unsubscribing from Realtime notifications channel', { channelName });
    supabase.removeChannel(channel);
  };
}

/**
 * Subscribes to live shift attendance updates for organizers (arrival, check-in, check-out).
 * Returns a teardown function for useEffect cleanup.
 */
export function subscribeToShiftRoster(
  jobId: string,
  onRosterChange: (change: { event: 'INSERT' | 'UPDATE' | 'DELETE'; record: any }) => void
): () => void {
  const channelName = `roster-${jobId}`;
  logger.info('Subscribing to Realtime shift roster channel', { channelName });

  safelyCleanExistingChannel(channelName);

  const channel = supabase
    .channel(channelName)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'bookings',
        filter: `job_id=eq.${jobId}`,
      },
      (payload: any) => {
        onRosterChange({
          event: payload.eventType,
          record: payload.new || payload.old,
        });
      }
    )
    .subscribe();

  return () => {
    logger.info('Unsubscribing from Realtime shift roster channel', { channelName });
    supabase.removeChannel(channel);
  };
}

/**
 * Subscribes to new worker applications for a specific shift in real time.
 */
export function subscribeToShiftApplications(
  jobId: string,
  onApplicationChange: (change: { event: string; record: any }) => void
): () => void {
  const channelName = `shift-apps-${jobId}`;
  safelyCleanExistingChannel(channelName);

  const channel = supabase
    .channel(channelName)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'job_applications',
        filter: `job_id=eq.${jobId}`,
      },
      (payload: any) => {
        onApplicationChange({
          event: payload.eventType,
          record: payload.new || payload.old,
        });
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

/**
 * Subscribes to live applicant and booking updates for an organizer dashboard.
 */
export function subscribeToOrganizerRoster(
  organizerId: string,
  onChange: () => void
): () => void {
  const channelName = `org-live-roster-${organizerId}`;
  safelyCleanExistingChannel(channelName);

  const channel = supabase
    .channel(channelName)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'job_applications',
      },
      () => {
        onChange();
      }
    )
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'bookings',
      },
      () => {
        onChange();
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

