import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import crypto from 'crypto';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const adminInternalApiKey = process.env.ADMIN_INTERNAL_API_KEY;

// Secondary in-memory sliding-window rate limiter (defense-in-depth)
interface RateLimitEntry {
  count: number;
  resetAt: number;
}
const rateLimitMap = new Map<string, RateLimitEntry>();
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const MAX_REGISTRATIONS_PER_IP = 10;
const MAX_REGISTRATIONS_PER_CONTACT = 3;

function checkLocalRateLimit(key: string, limit: number, windowMs: number = RATE_LIMIT_WINDOW_MS): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(key);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (entry.count >= limit) {
    return false;
  }
  entry.count += 1;
  return true;
}

/**
 * Shared atomic rate limiter using database RPC backed by PostgreSQL row-level locks.
 * Falls back to secondary in-memory limiter if database is temporarily unreachable.
 */
async function checkSharedRateLimit(
  adminClient: any,
  key: string,
  limit: number,
  windowMs: number = RATE_LIMIT_WINDOW_MS
): Promise<boolean> {
  // Check secondary local limiter first as fast filter
  const localAllowed = checkLocalRateLimit(key, limit, windowMs);
  if (!localAllowed) {
    return false;
  }

  try {
    const windowSeconds = Math.ceil(windowMs / 1000);
    const { data, error } = await adminClient.rpc('check_rate_limit_atomic', {
      p_key: key,
      p_max_requests: limit,
      p_window_seconds: windowSeconds,
    });

    if (error) {
      console.warn(`[RATE_LIMIT] Database atomic rate check failed, relying on local limiter: ${error.message}`);
      return localAllowed;
    }

    return Boolean(data);
  } catch (err: any) {
    console.warn(`[RATE_LIMIT] Database rate limit RPC threw exception: ${err?.message}`);
    return localAllowed;
  }
}

/**
 * Robust Client IP Extraction:
 * Validates IP against spoofing. In trusted reverse proxy setups (e.g. Cloudflare / Nginx / ALB),
 * prefers cf-connecting-ip or x-real-ip. If x-forwarded-for is used, extracts the trusted
 * rightmost valid IPv4/IPv6 address to prevent client header injection.
 */
function extractClientIp(req: NextRequest): string {
  const cfIp = req.headers.get('cf-connecting-ip');
  if (cfIp && isValidIp(cfIp.trim())) {
    return cfIp.trim();
  }

  const realIp = req.headers.get('x-real-ip');
  if (realIp && isValidIp(realIp.trim())) {
    return realIp.trim();
  }

  const forwardedFor = req.headers.get('x-forwarded-for');
  if (forwardedFor) {
    const parts = forwardedFor.split(',').map((p) => p.trim()).filter(Boolean);
    // When behind reverse proxies that append, the last entry added by the proxy is the verified hop
    for (let i = parts.length - 1; i >= 0; i--) {
      if (isValidIp(parts[i])) {
        return parts[i];
      }
    }
  }

  return '127.0.0.1';
}

function isValidIp(ip: string): boolean {
  // Strict IPv4 and IPv6 validation regex
  const ipv4 = /^(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(?:\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;
  const ipv6 = /^(?:[a-fA-F0-9]{1,4}:){7}[a-fA-F0-9]{1,4}$|^::1$|^[a-fA-F0-9:]+$/;
  return ipv4.test(ip) || ipv6.test(ip);
}

/**
 * Authorize caller for privileged service-role user creation:
 * Must be either an active platform administrator session,
 * an authorized server-to-server internal API key,
 * or explicitly enabled for non-production environments via ALLOW_DIRECT_USER_REGISTRATION=true.
 */
async function authorizeWorkflow(req: NextRequest, adminClient: any): Promise<{ authorized: boolean; reason?: string }> {
  // 1. Internal server-to-server API key
  const internalKey = req.headers.get('x-admin-internal-key');
  if (adminInternalApiKey && internalKey && internalKey === adminInternalApiKey) {
    return { authorized: true };
  }

  // 2. Active Administrator Session
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (supabaseUrl && anonKey) {
    const authHeader = req.headers.get('authorization');
    const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;

    try {
      const authServerClient = createServerClient(supabaseUrl, anonKey, {
        cookies: {
          getAll() {
            return req.cookies.getAll();
          },
          setAll() {},
        },
      });

      const { data: { user }, error: authErr } = bearerToken
        ? await authServerClient.auth.getUser(bearerToken)
        : await authServerClient.auth.getUser();

      if (!authErr && user) {
        const { data: profile } = await adminClient
          .from('profiles')
          .select('role, is_active')
          .eq('id', user.id)
          .maybeSingle();

        if (profile && profile.role === 'admin' && profile.is_active) {
          return { authorized: true };
        }
      }
    } catch {
      // Proceed to check next authorization mechanism
    }
  }

  // 3. Explicit non-production opt-in environment flag
  if (process.env.ALLOW_DIRECT_USER_REGISTRATION === 'true') {
    return { authorized: true };
  }

  return {
    authorized: false,
    reason: 'Direct user registration via admin service role is restricted to authorized administrative workflows. Standard users must register via client auth verification.',
  };
}

export async function POST(req: NextRequest) {
  const correlationId = crypto.randomUUID();

  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json(
      {
        success: false,
        error: 'Authentication service is temporarily unavailable.',
        code: 'SERVICE_UNAVAILABLE',
        correlationId,
      },
      { status: 500 }
    );
  }

  const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Verify that the route is invoked by a trusted server-side workflow or administrator
  const authCheck = await authorizeWorkflow(req, adminClient);
  if (!authCheck.authorized) {
    return NextResponse.json(
      {
        success: false,
        error: authCheck.reason || 'Unauthorized registration request.',
        code: 'FORBIDDEN',
        correlationId,
      },
      { status: 403 }
    );
  }

  // Extract client IP with proxy spoofing protection
  const clientIp = extractClientIp(req);

  // Shared atomic rate limiting for IP
  const ipAllowed = await checkSharedRateLimit(adminClient, `ip:${clientIp}`, MAX_REGISTRATIONS_PER_IP);
  if (!ipAllowed) {
    return NextResponse.json(
      {
        success: false,
        error: 'Too many registration attempts. Please try again later.',
        code: 'RATE_LIMIT_EXCEEDED',
        correlationId,
      },
      { status: 429 }
    );
  }

  try {
    const body = await req.json();
    const { email, password, role, fullName, phone, city, locality } = body || {};

    const cleanEmail = (email || '').trim().toLowerCase();
    const cleanPhone = (phone || '').replace(/\D/g, '');
    const cleanName = (fullName || '').trim();
    const cleanRole = role === 'organizer' ? 'organizer' : 'worker';
    const cleanCity = city ? String(city).trim() : null;
    const cleanLocality = locality ? String(locality).trim() : null;

    // Strict input validation
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!cleanEmail || !emailRegex.test(cleanEmail)) {
      return NextResponse.json(
        { success: false, error: 'A valid email address is required.', code: 'INVALID_EMAIL', correlationId },
        { status: 400 }
      );
    }

    if (!password || password.length < 8) {
      return NextResponse.json(
        { success: false, error: 'Password must be at least 8 characters.', code: 'INVALID_PASSWORD', correlationId },
        { status: 400 }
      );
    }

    if (!cleanName || cleanName.length < 2 || cleanName.length > 100) {
      return NextResponse.json(
        { success: false, error: 'Full name must be between 2 and 100 characters.', code: 'INVALID_NAME', correlationId },
        { status: 400 }
      );
    }

    // Phone format: Indian 10-digit mobile number starting with 6-9
    if (cleanPhone && !/^[6-9]\d{9}$/.test(cleanPhone)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Phone number must be a valid 10-digit mobile number starting with 6, 7, 8, or 9.',
          code: 'INVALID_PHONE',
          correlationId,
        },
        { status: 400 }
      );
    }

    // Shared atomic rate limiting for contact identifier (email)
    const emailAllowed = await checkSharedRateLimit(adminClient, `contact:${cleanEmail}`, MAX_REGISTRATIONS_PER_CONTACT);
    if (!emailAllowed) {
      return NextResponse.json(
        {
          success: false,
          error: 'Too many registration attempts for this email address. Please try again later.',
          code: 'RATE_LIMIT_EXCEEDED',
          correlationId,
        },
        { status: 429 }
      );
    }

    // 1. Direct database-backed uniqueness check: FAIL CLOSED on query errors
    const { data: existingUser, error: lookupErr } = await adminClient
      .from('profiles')
      .select('id, email, phone')
      .or(`email.eq.${cleanEmail}${cleanPhone ? `,phone.eq.${cleanPhone}` : ''}`)
      .maybeSingle();

    if (lookupErr) {
      console.error(`[AUTH_REGISTRATION][${correlationId}] Duplicate check database query error: ${lookupErr.message}`);
      return NextResponse.json(
        {
          success: false,
          error: 'Unable to verify account availability. Please try again.',
          code: 'VERIFICATION_UNAVAILABLE',
          correlationId,
        },
        { status: 500 }
      );
    }

    if (existingUser) {
      const isEmailMatch = existingUser.email?.toLowerCase() === cleanEmail;
      return NextResponse.json(
        {
          success: false,
          error: isEmailMatch
            ? 'An account with this email address already exists. Please sign in or use password reset.'
            : 'An account with this phone number already exists.',
          code: 'ACCOUNT_EXISTS',
          correlationId,
        },
        { status: 409 }
      );
    }

    // 2. Create Auth User identity
    // CRITICAL SECURITY FIX: email_confirm is set to FALSE so unverified accounts are NOT
    // marked as confirmed without completing proof-of-control email/OTP verification.
    const { data: newUser, error: createErr } = await adminClient.auth.admin.createUser({
      email: cleanEmail,
      password,
      email_confirm: false,
      user_metadata: {
        role: cleanRole,
        full_name: cleanName,
        phone: cleanPhone || null,
      },
    });

    if (createErr || !newUser.user) {
      const errMsg = createErr?.message || '';
      console.error(`[AUTH_REGISTRATION][${correlationId}] Auth user creation error: ${errMsg}`);

      const isDuplicate = errMsg.toLowerCase().includes('already') || errMsg.toLowerCase().includes('exists');
      if (isDuplicate) {
        return NextResponse.json(
          {
            success: false,
            error: 'An account with this email address already exists. Please sign in or use password reset.',
            code: 'ACCOUNT_EXISTS',
            correlationId,
          },
          { status: 409 }
        );
      }

      return NextResponse.json(
        {
          success: false,
          error: 'Failed to create user account. Please check your details and try again.',
          code: 'USER_CREATION_FAILED',
          correlationId,
        },
        { status: 400 }
      );
    }

    const userId = newUser.user.id;

    // Helper for compensating rollback on database write failure
    const rollbackAuthUser = async () => {
      try {
        await adminClient.from('worker_profiles').delete().eq('id', userId);
        await adminClient.from('organizer_profiles').delete().eq('id', userId);
        await adminClient.from('profiles').delete().eq('id', userId);
        await adminClient.auth.admin.deleteUser(userId);
      } catch (cleanupErr: any) {
        console.error(`[CRITICAL][${correlationId}] Rollback failure for user ${userId}:`, cleanupErr?.message);
      }
    };

    // 3. Initialize base profile record with neutral/verified defaults
    const { error: profileErr } = await adminClient.from('profiles').upsert({
      id: userId,
      role: cleanRole,
      full_name: cleanName,
      phone: cleanPhone || null,
      email: cleanEmail,
      city: cleanCity,
      is_active: true,
    });

    if (profileErr) {
      await rollbackAuthUser();
      console.error(`[AUTH_REGISTRATION][${correlationId}] Profile init failed: ${profileErr.message}`);
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to initialize user profile. Please contact support.',
          code: 'PROFILE_INIT_FAILED',
          correlationId,
        },
        { status: 500 }
      );
    }

    // 4. Initialize role-specific profile record with unseeded, neutral empty states
    if (cleanRole === 'worker') {
      const { error: workerErr } = await adminClient.from('worker_profiles').upsert({
        id: userId,
        preferred_locality: cleanLocality,
        service_areas: cleanLocality ? [cleanLocality] : [],
        skills: [],
        profile_completion_status: 'incomplete',
        verification_status: 'unverified',
      });

      if (workerErr) {
        await rollbackAuthUser();
        console.error(`[AUTH_REGISTRATION][${correlationId}] Worker profile init failed: ${workerErr.message}`);
        return NextResponse.json(
          {
            success: false,
            error: 'Failed to initialize worker profile. Please contact support.',
            code: 'WORKER_INIT_FAILED',
            correlationId,
          },
          { status: 500 }
        );
      }
    } else {
      const { error: organizerErr } = await adminClient.from('organizer_profiles').upsert({
        id: userId,
        business_name: cleanName,
        business_contact_phone: cleanPhone || null,
        business_contact_email: cleanEmail,
        business_type: null,
        profile_completion_status: 'incomplete',
        verification_status: 'unverified',
      });

      if (organizerErr) {
        await rollbackAuthUser();
        console.error(`[AUTH_REGISTRATION][${correlationId}] Organizer profile init failed: ${organizerErr.message}`);
        return NextResponse.json(
          {
            success: false,
            error: 'Failed to initialize organizer profile. Please contact support.',
            code: 'ORGANIZER_INIT_FAILED',
            correlationId,
          },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      userId,
      emailVerified: false,
      message: 'Account registered successfully. Please verify your email or phone to activate contact-verified features.',
      correlationId,
    });
  } catch (err: any) {
    console.error(`[AUTH_REGISTRATION][${correlationId}] Unexpected caught exception:`, err?.stack || err?.message || String(err));
    return NextResponse.json(
      {
        success: false,
        error: 'Registration failed due to a server error. Please try again later.',
        code: 'INTERNAL_SERVER_ERROR',
        correlationId,
      },
      { status: 500 }
    );
  }
}
