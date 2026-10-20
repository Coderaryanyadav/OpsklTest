#!/usr/bin/env node
/**
 * Opskl Push Notification Dispatch Worker
 * Dispatches pending notifications to user mobile devices via Expo Push Service.
 * Can be run on a recurring cron schedule, as a daemon, or invoked on demand.
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// Parse root .env
try {
  const envPath = path.resolve(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const idx = trimmed.indexOf('=');
      if (idx !== -1) {
        const key = trimmed.slice(0, idx).trim();
        let val = trimmed.slice(idx + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  }
} catch (e) {
  // Ignore
}

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const EXPO_ACCESS_TOKEN = process.env.EXPO_ACCESS_TOKEN || process.env.EXPO_TOKEN;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_KEY in environment.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function isValidExpoPushToken(token) {
  if (!token || typeof token !== 'string') return false;
  return /^(Expo(nent)?PushToken)\[[a-zA-Z0-9_\-\.]+\]$/.test(token.trim());
}

async function dispatchPendingPushNotifications() {
  console.log('🔔 [Opskl Push Worker] Starting notification dispatch sweep...');

  // 1. Fetch recent unlogged notifications from the last 24h
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: notifications, error: notifErr } = await supabase
    .from('notifications')
    .select('id, user_id, title, body, action_url, priority, metadata, created_at')
    .gte('created_at', yesterday)
    .order('created_at', { ascending: true })
    .limit(100);

  if (notifErr) {
    console.error('❌ Failed to fetch notifications:', notifErr.message);
    process.exit(1);
  }

  if (!notifications || notifications.length === 0) {
    console.log('✅ No notifications found in queue.');
    return;
  }

  // 2. Fetch existing delivery logs for expo_push to avoid duplicate sends
  const notifIds = notifications.map((n) => n.id);
  const { data: existingLogs } = await supabase
    .from('notification_delivery_logs')
    .select('notification_id')
    .in('notification_id', notifIds)
    .eq('channel', 'expo_push');

  const dispatchedSet = new Set((existingLogs || []).map((l) => l.notification_id));
  const pendingNotifications = notifications.filter((n) => !dispatchedSet.has(n.id));

  if (pendingNotifications.length === 0) {
    console.log(`✅ All ${notifications.length} recent notifications have already been processed.`);
    return;
  }

  console.log(`📋 Found ${pendingNotifications.length} notifications pending push delivery.`);

  let totalDispatched = 0;
  let totalSkipped = 0;
  let totalErrors = 0;

  for (const notif of pendingNotifications) {
    // Check preferences
    const { data: pref } = await supabase
      .from('user_notification_preferences')
      .select('push_enabled')
      .eq('user_id', notif.user_id)
      .maybeSingle();

    if (pref && pref.push_enabled === false) {
      await supabase.from('notification_delivery_logs').insert({
        notification_id: notif.id,
        user_id: notif.user_id,
        channel: 'expo_push',
        status: 'opted_out',
        error_message: 'User opted out of mobile push',
      });
      totalSkipped++;
      continue;
    }

    // Fetch active tokens
    const { data: tokens } = await supabase
      .from('user_push_tokens')
      .select('id, expo_push_token')
      .eq('user_id', notif.user_id)
      .eq('is_active', true);

    const validTokens = (tokens || []).filter((t) => isValidExpoPushToken(t.expo_push_token));

    if (validTokens.length === 0) {
      totalSkipped++;
      continue;
    }

    const messages = validTokens.map((t) => ({
      to: t.expo_push_token,
      sound: 'default',
      title: notif.title || 'Opskl Shift Notification',
      body: notif.body || '',
      priority: notif.priority === 'urgent' || notif.priority === 'high' ? 'high' : 'normal',
      data: {
        notificationId: notif.id,
        actionUrl: notif.action_url || '/(tabs)/my-shifts',
        ...notif.metadata,
      },
      channelId: 'opskil_shifts',
    }));

    try {
      const headers = {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      };
      if (EXPO_ACCESS_TOKEN) {
        headers.Authorization = `Bearer ${EXPO_ACCESS_TOKEN.trim()}`;
      }

      const res = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers,
        body: JSON.stringify(messages),
      });

      if (!res.ok) {
        console.warn(`⚠️ Expo Push HTTP ${res.status} for notification ${notif.id}`);
        totalErrors++;
        continue;
      }

      const result = await res.json();
      const tickets = result.data || [];

      for (let i = 0; i < tickets.length; i++) {
        const ticket = tickets[i];
        const tokenRec = validTokens[i];
        const isSuccess = ticket.status === 'ok';

        await supabase.from('notification_delivery_logs').insert({
          notification_id: notif.id,
          user_id: notif.user_id,
          channel: 'expo_push',
          status: isSuccess ? 'delivered' : 'failed',
          provider_response: ticket,
          error_message: ticket.message || (ticket.details ? JSON.stringify(ticket.details) : null),
        });

        if (ticket.status === 'error' && ticket.details?.error === 'DeviceNotRegistered') {
          console.log(`🧹 Deactivating unregistered push token ${tokenRec.expo_push_token}`);
          await supabase.from('user_push_tokens').update({ is_active: false }).eq('id', tokenRec.id);
        }
      }

      totalDispatched += messages.length;
    } catch (sendErr) {
      console.error(`❌ Error dispatching notification ${notif.id}:`, sendErr.message);
      totalErrors++;
    }
  }

  console.log(`\n🎉 [Opskl Push Worker] Sweep complete:`);
  console.log(`   - Dispatched to devices: ${totalDispatched}`);
  console.log(`   - Skipped (opted out / no token): ${totalSkipped}`);
  console.log(`   - Errors encountered: ${totalErrors}\n`);
}

dispatchPendingPushNotifications()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Fatal dispatch error:', err);
    process.exit(1);
  });
