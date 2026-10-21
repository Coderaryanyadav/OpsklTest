import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// In-memory sliding-window rate limiter for public registration endpoint
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
  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json(
      { success: false, error: 'Server authentication service is temporarily unavailable.' },
      { status: 500 }
    );
  }

  // Extract client IP for abuse rate-limiting
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
      return NextResponse.json({ success: false, error: 'A valid email address is required.' }, { status: 400 });
    }

    if (!password || password.length < 8) {
      return NextResponse.json({ success: false, error: 'Password must be at least 8 characters.' }, { status: 400 });
    }

    if (!cleanName || cleanName.length < 2 || cleanName.length > 100) {
      return NextResponse.json({ success: false, error: 'Full name must be between 2 and 100 characters.' }, { status: 400 });
    }

    // Phone format: Indian 10-digit mobile number starting with 6-9
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

    // 1. Direct database-backed uniqueness check (Replaces unscalable listUsers() pagination scan)
    const { data: existingUser } = await adminClient
      .from('profiles')
      .select('id, email, phone')
      .or(`email.eq.${cleanEmail}${cleanPhone ? `,phone.eq.${cleanPhone}` : ''}`)
      .maybeSingle();

    if (existingUser) {
      const isEmailMatch = existingUser.email?.toLowerCase() === cleanEmail;
      return NextResponse.json(
        {
          success: false,
          error: isEmailMatch
            ? 'An account with this email address already exists. Please sign in or use password reset.'
            : 'An account with this phone number already exists.',
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
        role: cleanRole,
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

    // Helper for compensating rollback on database write failure
    const rollbackAuthUser = async () => {
      try {
        await adminClient.from('worker_profiles').delete().eq('id', userId);
        await adminClient.from('organizer_profiles').delete().eq('id', userId);
        await adminClient.from('profiles').delete().eq('id', userId);
        await adminClient.auth.admin.deleteUser(userId);
      } catch (cleanupErr) {
        console.error(`[CRITICAL] Rollback failure for user ${userId}:`, cleanupErr);
      }
    };

    // 3. Initialize base profile record with neutral/verified defaults (NO fake/seeded city)
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
      return NextResponse.json(
        { success: false, error: `Failed to initialize user profile: ${profileErr.message}` },
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
        return NextResponse.json(
          { success: false, error: `Failed to initialize worker profile: ${workerErr.message}` },
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
        return NextResponse.json(
          { success: false, error: `Failed to initialize organizer profile: ${organizerErr.message}` },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      userId,
      message: 'Account successfully registered.',
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'Registration failed due to a server error.' },
      { status: 500 }
    );
  }
}

