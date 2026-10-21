import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// In-memory sliding-window rate limiter
interface RateLimitEntry {
  count: number;
  resetAt: number;
}
const rateLimitMap = new Map<string, RateLimitEntry>();
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const MAX_REGISTRATIONS_PER_IP = 10;
const MAX_REGISTRATIONS_PER_CONTACT = 3;

function checkRateLimit(key: string, limit: number): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(key);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (entry.count >= limit) {
    return false;
  }
  entry.count += 1;
  return true;
}

export async function POST(req: NextRequest) {
  // Fail closed: privileged service-role account minting requires explicit opt-in in every environment.
  if (process.env.ALLOW_DIRECT_ORGANIZER_REGISTRATION !== 'true') {
    return NextResponse.json(
      {
        success: false,
        error:
          'Direct organizer registration is disabled. Set ALLOW_DIRECT_ORGANIZER_REGISTRATION=true only for controlled non-production setup, or use standard verified registration.',
      },
      { status: 403 }
    );
  }

  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json(
      { success: false, error: 'Server authentication service is temporarily unavailable.' },
      { status: 500 }
    );
  }

  const forwardedFor = req.headers.get('x-forwarded-for');
  const clientIp = forwardedFor ? forwardedFor.split(',')[0].trim() : '127.0.0.1';

  if (!checkRateLimit(`ip:${clientIp}`, MAX_REGISTRATIONS_PER_IP)) {
    return NextResponse.json(
      { success: false, error: 'Too many registration attempts from this IP. Please try again later.' },
      { status: 429 }
    );
  }

  try {
    const body = await req.json();
    const { email, password, businessName, phone, city } = body || {};

    const cleanEmail = (email || '').trim().toLowerCase();
    const cleanPhone = (phone || '').replace(/\D/g, '');
    const cleanName = (businessName || '').trim();
    const cleanCity = city ? String(city).trim() : null;

    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!cleanEmail || !emailRegex.test(cleanEmail)) {
      return NextResponse.json({ success: false, error: 'A valid email address is required.' }, { status: 400 });
    }
    if (!password || password.length < 8) {
      return NextResponse.json({ success: false, error: 'Password must be at least 8 characters.' }, { status: 400 });
    }
    if (!cleanName || cleanName.length < 2 || cleanName.length > 100) {
      return NextResponse.json({ success: false, error: 'Organization name must be between 2 and 100 characters.' }, { status: 400 });
    }
    if (cleanPhone && !/^[6-9]\d{9}$/.test(cleanPhone)) {
      return NextResponse.json(
        { success: false, error: 'Phone number must be a valid 10-digit mobile number starting with 6, 7, 8, or 9.' },
        { status: 400 }
      );
    }

    if (!checkRateLimit(`contact:${cleanEmail}`, MAX_REGISTRATIONS_PER_CONTACT)) {
      return NextResponse.json(
        { success: false, error: 'Too many attempts for this email address. Please try again later.' },
        { status: 429 }
      );
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // 1. Direct database check on profiles (replaces listUsers scan)
    const { data: existingUser } = await adminClient
      .from('profiles')
      .select('id, email, phone')
      .or(`email.eq.${cleanEmail}${cleanPhone ? `,phone.eq.${cleanPhone}` : ''}`)
      .maybeSingle();

    if (existingUser) {
      return NextResponse.json(
        {
          success: false,
          error: 'An account with this email address or phone number already exists.',
        },
        { status: 409 }
      );
    }

    // 2. Create Auth User identity
    const { data: newUser, error: createErr } = await adminClient.auth.admin.createUser({
      email: cleanEmail,
      password,
      email_confirm: true,
      user_metadata: {
        role: 'organizer',
        full_name: cleanName,
        phone: cleanPhone || null,
      },
    });

    if (createErr || !newUser.user) {
      return NextResponse.json(
        { success: false, error: createErr?.message || 'Failed to create user identity.' },
        { status: 400 }
      );
    }

    const userId = newUser.user.id;

    // Compensating rollback on failure
    const rollbackAuthUser = async () => {
      try {
        await adminClient.from('organizer_profiles').delete().eq('id', userId);
        await adminClient.from('profiles').delete().eq('id', userId);
        await adminClient.auth.admin.deleteUser(userId);
      } catch (cleanupErr) {
        console.error(`[CRITICAL] Rollback failure for user ${userId}:`, cleanupErr);
      }
    };

    // 3. Initialize profile record with neutral unseeded defaults
    const { error: profileErr } = await adminClient.from('profiles').upsert({
      id: userId,
      role: 'organizer',
      full_name: cleanName,
      phone: cleanPhone || null,
      email: cleanEmail,
      city: cleanCity,
      is_active: true,
    });

    if (profileErr) {
      await rollbackAuthUser();
      return NextResponse.json(
        { success: false, error: `Failed to initialize organizer profile: ${profileErr.message}` },
        { status: 500 }
      );
    }

    // 4. Initialize organizer_profiles with null unseeded business_type
    const { error: orgProfileErr } = await adminClient.from('organizer_profiles').upsert({
      id: userId,
      business_name: cleanName,
      business_contact_phone: cleanPhone || null,
      business_contact_email: cleanEmail,
      business_type: null,
      profile_completion_status: 'incomplete',
      verification_status: 'unverified',
    });

    if (orgProfileErr) {
      await rollbackAuthUser();
      return NextResponse.json(
        { success: false, error: `Failed to initialize organizer business profile: ${orgProfileErr.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      userId,
      message: 'Organizer account successfully created and activated.',
    });
  } catch (err: any) {
    const safeError =
      err?.message && !err.message.includes('key') && !err.message.includes('postgres') && !err.message.includes('password')
        ? err.message
        : 'Registration failed due to a server error. Please try again.';
    return NextResponse.json(
      { success: false, error: safeError },
      { status: 500 }
    );
  }
}

