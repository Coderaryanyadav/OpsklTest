import { NextResponse } from 'next/server';

/**
 * Public readiness probe for deploy/smoke checks.
 * Does not expose secrets or query privileged data.
 */
export async function GET() {
  const supabaseConfigured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL
  );
  const anonConfigured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
  );

  const ok = supabaseConfigured && anonConfigured;
  const body = {
    status: ok ? 'ok' : 'degraded',
    service: 'opskil-admin',
    timestamp: new Date().toISOString(),
    checks: {
      supabaseUrl: supabaseConfigured,
      supabaseAnonKey: anonConfigured,
      appEnv: process.env.NEXT_PUBLIC_APP_ENV || process.env.NODE_ENV || 'unknown',
    },
  };

  return NextResponse.json(body, { status: ok ? 200 : 503 });
}
