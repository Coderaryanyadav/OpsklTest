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
    title: string;
    body: string;
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

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const expoAccessToken = Deno.env.get('EXPO_ACCESS_TOKEN') || '';

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(JSON.stringify({ error: 'Missing Supabase service environment variables' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const payload: WebhookPayload = await req.json();

    if (payload.type !== 'INSERT' || !payload.record) {
      return new Response(JSON.stringify({ message: 'Ignored non-insert event' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { id: notificationId, user_id: userId, title, body, action_url, metadata, priority } = payload.record;

    // 1. Check user notification preferences
    const { data: pref } = await supabase
      .from('user_notification_preferences')
      .select('push_enabled')
      .eq('user_id', userId)
      .maybeSingle();

    if (pref && pref.push_enabled === false) {
      await supabase.from('notification_delivery_logs').insert({
        notification_id: notificationId,
        user_id: userId,
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
      .eq('user_id', userId)
      .eq('is_active', true);

    if (tokensError || !tokens || tokens.length === 0) {
      return new Response(JSON.stringify({ message: 'No active push tokens registered for user' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 3. Format Expo Push messages
    const pushMessages = tokens.map((t) => ({
      to: t.expo_push_token,
      sound: 'default',
      title: title || 'Opskl Shift Notification',
      body: body || '',
      priority: priority === 'urgent' || priority === 'high' ? 'high' : 'normal',
      data: {
        notificationId,
        actionUrl: action_url || '/(tabs)/my-shifts',
        ...metadata,
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

    // 5. Audit log and clean up stale/unregistered tokens
    for (let i = 0; i < tickets.length; i++) {
      const ticket = tickets[i];
      const tokenRecord = tokens[i];

      const isSuccess = ticket.status === 'ok';
      await supabase.from('notification_delivery_logs').insert({
        notification_id: notificationId,
        user_id: userId,
        channel: 'expo_push',
        status: isSuccess ? 'delivered' : 'failed',
        provider_response: ticket,
        error_message: ticket.message || (ticket.details ? JSON.stringify(ticket.details) : null),
      });

      if (ticket.status === 'error' && ticket.details?.error === 'DeviceNotRegistered') {
        // Deactivate invalid token
        await supabase
          .from('user_push_tokens')
          .update({ is_active: false })
          .eq('id', tokenRecord.id);
      }
    }

    return new Response(JSON.stringify({ success: true, ticketsCount: tickets.length }), {
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
