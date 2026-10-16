import { supabase } from './client';
import {
  Notification,
  UserNotificationPreferences,
  NotificationChannel,
} from '../types';
import { NotificationPayload } from '../notifications/events';
import { logger } from '../utils/logger';

/**
 * Fetch in-app notifications for user
 */
export async function fetchUserNotifications(
  userId: string,
  limit: number = 30
): Promise<Notification[]> {
  logger.info('Fetching user notifications', { userId, limit });

  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .neq('delivery_status', 'suppressed')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    logger.error('Failed to fetch user notifications', error, { userId });
    throw new Error(error.message || 'Failed to fetch user notifications');
  }

  if (!data) return [];

  return data.map((n: any) => ({
    id: n.id,
    userId: n.user_id,
    title: n.title,
    body: n.body,
    type: n.type,
    channel: n.channel,
    idempotencyKey: n.idempotency_key,
    deliveryStatus: n.delivery_status,
    actionUrl: n.action_url,
    priority: n.priority,
    read: n.read,
    metadata: n.data || n.metadata,
    createdAt: n.created_at,
  }));
}

/**
 * Fetch count of unread, delivered in-app notifications
 */
export async function fetchUnreadNotificationsCount(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('read', false)
    .neq('delivery_status', 'suppressed');

  if (error) {
    logger.error('Failed to fetch unread notifications count', error, { userId });
    throw new Error(`Failed to fetch unread notifications count: ${error.message}`);
  }

  return count ?? 0;
}

/**
 * Mark a single notification as read
 */
export async function markNotificationAsRead(notificationId: string): Promise<boolean> {
  const { error } = await supabase
    .from('notifications')
    .update({ read: true })
    .eq('id', notificationId);

  return !error;
}

/**
 * Mark all notifications for a user as read
 */
export async function markAllNotificationsAsRead(userId: string): Promise<boolean> {
  const { error } = await supabase
    .from('notifications')
    .update({ read: true })
    .eq('user_id', userId)
    .eq('read', false);

  return !error;
}

/**
 * Fetch user notification preferences
 */
export async function fetchUserNotificationPreferences(
  userId: string
): Promise<UserNotificationPreferences> {
  const { data, error } = await supabase
    .from('user_notification_preferences')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error || !data) {
    return {
      userId,
      pushEnabled: true,
      inAppEnabled: true,
      whatsappEnabled: false,
      smsEnabled: true,
      notifyShiftOpportunities: true,
      notifyApplications: true,
      notifySelectionAndConfirmations: true,
      notifyShiftReminders: true,
      notifyAttendanceUpdates: true,
      notifyPayouts: true,
      notifyDisputes: true,
    };
  }

  return {
    userId: data.user_id,
    pushEnabled: data.push_enabled,
    inAppEnabled: data.in_app_enabled,
    whatsappEnabled: data.whatsapp_enabled,
    smsEnabled: data.sms_enabled,
    notifyShiftOpportunities: data.notify_shift_opportunities,
    notifyApplications: data.notify_applications,
    notifySelectionAndConfirmations: data.notify_selection_and_confirmations,
    notifyShiftReminders: data.notify_shift_reminders,
    notifyAttendanceUpdates: data.notify_attendance_updates,
    notifyPayouts: data.notify_payouts,
    notifyDisputes: data.notify_disputes,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

/**
 * Update user notification preferences
 */
export async function updateUserNotificationPreferences(
  userId: string,
  prefs: Partial<UserNotificationPreferences>
): Promise<boolean> {
  const payload: any = {
    user_id: userId,
    updated_at: new Date().toISOString(),
  };

  if (prefs.pushEnabled !== undefined) payload.push_enabled = prefs.pushEnabled;
  if (prefs.inAppEnabled !== undefined) payload.in_app_enabled = prefs.inAppEnabled;
  if (prefs.whatsappEnabled !== undefined) payload.whatsapp_enabled = prefs.whatsappEnabled;
  if (prefs.smsEnabled !== undefined) payload.sms_enabled = prefs.smsEnabled;
  if (prefs.notifyShiftOpportunities !== undefined) payload.notify_shift_opportunities = prefs.notifyShiftOpportunities;
  if (prefs.notifyApplications !== undefined) payload.notify_applications = prefs.notifyApplications;
  if (prefs.notifySelectionAndConfirmations !== undefined) payload.notify_selection_and_confirmations = prefs.notifySelectionAndConfirmations;
  if (prefs.notifyShiftReminders !== undefined) payload.notify_shift_reminders = prefs.notifyShiftReminders;
  if (prefs.notifyAttendanceUpdates !== undefined) payload.notify_attendance_updates = prefs.notifyAttendanceUpdates;
  if (prefs.notifyPayouts !== undefined) payload.notify_payouts = prefs.notifyPayouts;
  if (prefs.notifyDisputes !== undefined) payload.notify_disputes = prefs.notifyDisputes;

  const { error } = await supabase
    .from('user_notification_preferences')
    .upsert(payload);

  return !error;
}

/**
 * Register active Expo Push Token
 */
export async function registerPushTokenSafe(
  userId: string,
  token: string,
  platform: 'ios' | 'android' | 'web',
  deviceName?: string
): Promise<boolean> {
  const { data, error } = await supabase.rpc('register_push_token_safe', {
    p_user_id: userId,
    p_expo_token: token,
    p_platform: platform,
    p_device_name: deviceName ?? null,
  });

  return !error && !!data?.success;
}

/**
 * Revoke push token upon user logout
 */
export async function revokePushTokenSafe(userId: string, token: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('revoke_push_token_safe', {
    p_user_id: userId,
    p_expo_token: token,
  });

  return !error && !!data?.success;
}

/**
 * Send notification safe (Server RPC with idempotency & preferences validation)
 */
export async function sendNotificationSafe(
  payload: NotificationPayload,
  channel: NotificationChannel = 'in_app'
): Promise<{ success: boolean; duplicate?: boolean; suppressed?: boolean; notificationId?: string; error?: string }> {
  try {
    const { data: rpcData, error: rpcError } = await supabase.rpc('send_notification_safe', {
      p_user_id: payload.userId,
      p_title: payload.title,
      p_body: payload.body,
      p_type: payload.type,
      p_channel: channel,
      p_idempotency_key: payload.idempotencyKey,
      p_metadata: payload.metadata || {},
      p_action_url: payload.actionUrl ?? null,
      p_priority: payload.priority || 'normal',
    });

    if (rpcError) {
      logger.error('send_notification_safe RPC failed', rpcError, { userId: payload.userId, idempotencyKey: payload.idempotencyKey });
      return { success: false, error: rpcError.message };
    }

    if (rpcData) {
      return {
        success: !!rpcData.success,
        duplicate: rpcData.duplicate,
        suppressed: rpcData.suppressed,
        notificationId: rpcData.notification_id,
        error: rpcData.error,
      };
    }

    return { success: false, error: 'No response from notification service' };
  } catch (err: any) {
    logger.error('sendNotificationSafe exception', err, { userId: payload.userId });
    return { success: false, error: err.message };
  }
}
