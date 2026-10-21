// Supabase Edge Function: dispatch-push-notifications
// Triggered on INSERT to public.notifications via Database Webhooks

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface WebhookPayload {
  type: 'INSERT' | 'UPDATE' | 'DELETE';
  table: string;
  schema: string;
  record: {
    id: string;
    user_id: string;
    title?: string;
    body?: string;
    action_url?: string;
    channel?: string;
    priority?: string;
    metadata?: Record<string, any>;
    created_at?: string;
  };
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  const webhookSecret = (Deno.env.get('WEBHOOK_SECRET') || '').trim();
  const expoAccessToken = Deno.env.get('EXPO_ACCESS_TOKEN') || '';

  if (!supabaseUrl || !supabaseServiceKey) {
    return new Response(JSON.stringify({ error: 'Missing Supabase service environment variables' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const authHeader = req.headers.get('Authorization') || '';
  const incomingToken = authHeader.replace(/^Bearer\s+/i, '').trim();

  // P1-07: Require verified service_role or dedicated high-entropy webhook secret
  const isAuthorized =
    (incomingToken !== '' && incomingToken === supabaseServiceKey) ||
    (webhookSecret !== '' && incomingToken === webhookSecret);

  if (!isAuthorized) {
    return new Response(JSON.stringify({ error: 'Unauthorized: Valid webhook authorization required' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const payload: WebhookPayload = await req.json();

    // Verify event source, table and schema
    if (payload.type !== 'INSERT' || payload.table !== 'notifications' || !payload.record?.id) {
      return new Response(JSON.stringify({ message: 'Ignored non-notification insert event' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { id: notificationId, user_id: payloadUserId } = payload.record;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // P1-07: Fetch authoritative notification row from trusted DB to prevent payload tampering/forgery
    const { data: dbNotification, error: notifError } = await supabase
      .from('notifications')
      .select('id, user_id, title, body, action_url, channel, metadata')
      .eq('id', notificationId)
      .maybeSingle();

    if (notifError || !dbNotification) {
      return new Response(JSON.stringify({ error: 'Notification record not found in database' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify recipient matches database record
    if (payloadUserId && dbNotification.user_id !== payloadUserId) {
      return new Response(JSON.stringify({ error: 'Payload user mismatch against verified database record' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const recipientUserId = dbNotification.user_id;

    // 1. Check user notification preferences
    const { data: pref } = await supabase
      .from('user_notification_preferences')
      .select('push_enabled')
      .eq('user_id', recipientUserId)
      .maybeSingle();

    if (pref && pref.push_enabled === false) {
      await supabase.from('notification_delivery_logs').insert({
        notification_id: notificationId,
        user_id: recipientUserId,
        channel: 'expo_push',
        status: 'opted_out',
        error_message: 'User has disabled push notifications in settings',
      });

      return new Response(JSON.stringify({ message: 'User opted out of push' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 2. Fetch active push tokens for user
    const { data: tokens, error: tokensError } = await supabase
      .from('user_push_tokens')
      .select('id, expo_push_token')
      .eq('user_id', recipientUserId)
      .eq('is_active', true);

    if (tokensError || !tokens || tokens.length === 0) {
      return new Response(JSON.stringify({ message: 'No active push tokens registered for user' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 3. Format Expo Push messages using trusted database content
    const pushMessages = tokens.map((t) => ({
      to: t.expo_push_token,
      sound: 'default',
      title: dbNotification.title || 'Opskl Shift Notification',
      body: dbNotification.body || '',
      priority: 'high',
      data: {
        notificationId: dbNotification.id,
        actionUrl: dbNotification.action_url || '/(tabs)/my-shifts',
        ...dbNotification.metadata,
      },
      channelId: 'opskil_shifts',
    }));

    // 4. Send to Expo Push Notification API
    const expoHeaders: Record<string, string> = {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    };
    if (expoAccessToken) {
      expoHeaders['Authorization'] = `Bearer ${expoAccessToken.trim()}`;
    }

    const expoRes = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: expoHeaders,
      body: JSON.stringify(pushMessages),
    });

    const expoData = await expoRes.json();
    const tickets = expoData.data || [];

    // 5. Audit log: Distinguish provider_accepted from delivered
    for (let i = 0; i < tickets.length; i++) {
      const ticket = tickets[i];
      const tokenRecord = tokens[i];

      const isAccepted = ticket.status === 'ok';
      await supabase.from('notification_delivery_logs').insert({
        notification_id: notificationId,
        user_id: recipientUserId,
        channel: 'expo_push',
        status: isAccepted ? 'provider_accepted' : 'failed',
        provider_response: ticket,
        error_message: ticket.message || (ticket.details ? JSON.stringify(ticket.details) : null),
      });

      if (ticket.status === 'error' && ticket.details?.error === 'DeviceNotRegistered') {
        await supabase
          .from('user_push_tokens')
          .update({ is_active: false })
          .eq('id', tokenRecord.id);
      }
    }

    return new Response(JSON.stringify({ success: true, ticketsCount: tickets.length, status: 'provider_accepted' }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err?.message || 'Internal dispatch error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

