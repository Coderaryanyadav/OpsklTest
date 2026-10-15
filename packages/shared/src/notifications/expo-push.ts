import { NotificationPayload } from './events';

export interface ExpoPushMessage {
  to: string;
  sound: 'default' | null;
  title: string;
  body: string;
  data?: Record<string, any>;
  priority?: 'default' | 'normal' | 'high';
  channelId?: string;
}

export interface ExpoPushTicket {
  status: 'ok' | 'error';
  id?: string;
  message?: string;
  details?: { error?: 'DeviceNotRegistered' | 'InvalidCredentials' | 'MessageTooBig' | 'MessageRateExceeded' };
}

/**
 * Validates Expo Push Token format
 */
export function isValidExpoPushToken(token: string): boolean {
  if (!token || typeof token !== 'string') return false;
  return /^(Expo(nent)?PushToken)\[[a-zA-Z0-9_\-\.]+\]$/.test(token.trim());
}

/**
 * Builds an Expo push message payload from standard notification
 */
export function buildExpoPushMessage(
  expoPushToken: string,
  notification: NotificationPayload
): ExpoPushMessage {
  return {
    to: expoPushToken,
    sound: 'default',
    title: notification.title,
    body: notification.body,
    priority: notification.priority === 'urgent' || notification.priority === 'high' ? 'high' : 'normal',
    data: {
      type: notification.type,
      idempotencyKey: notification.idempotencyKey,
      actionUrl: notification.actionUrl,
      ...notification.metadata,
    },
    channelId: 'opskil_shifts',
  };
}

/**
 * Dispatches push notification batch to Expo Push Notification Service
 */
export async function sendExpoPushBatch(
  messages: ExpoPushMessage[]
): Promise<{ success: boolean; tickets: ExpoPushTicket[]; invalidTokens: string[] }> {
  const validMessages = messages.filter((m) => isValidExpoPushToken(m.to));
  const invalidTokens = messages.filter((m) => !isValidExpoPushToken(m.to)).map((m) => m.to);

  if (validMessages.length === 0) {
    return { success: false, tickets: [], invalidTokens };
  }

  try {
    const expoToken = process.env.EXPO_ACCESS_TOKEN || process.env.EXPO_TOKEN;
    const headers: Record<string, string> = {
      Accept: 'application/json',
      'Accept-encoding': 'gzip, deflate',
      'Content-Type': 'application/json',
    };
    if (expoToken) {
      headers.Authorization = `Bearer ${expoToken.trim()}`;
    }

    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers,
      body: JSON.stringify(validMessages),
    });

    if (!response.ok) {
      return {
        success: false,
        tickets: validMessages.map(() => ({ status: 'error', message: `HTTP ${response.status}` })),
        invalidTokens,
      };
    }

    const data = await response.json();
    const tickets: ExpoPushTicket[] = data.data || [];

    // Scan for unregistered devices to clean up tokens
    tickets.forEach((ticket, idx) => {
      if (ticket.status === 'error' && ticket.details?.error === 'DeviceNotRegistered') {
        invalidTokens.push(validMessages[idx].to);
      }
    });

    return { success: true, tickets, invalidTokens };
  } catch (err: any) {
    return {
      success: false,
      tickets: validMessages.map(() => ({ status: 'error', message: err.message })),
      invalidTokens,
    };
  }
}
