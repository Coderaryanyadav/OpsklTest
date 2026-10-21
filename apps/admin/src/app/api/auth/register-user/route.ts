import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function POST(req: NextRequest) {
  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json(
      { success: false, error: 'Server authentication service is temporarily unavailable.' },
      { status: 500 }
    );
  }

  try {
    const body = await req.json();
    const { email, password, role, fullName, phone } = body || {};

    const cleanEmail = (email || '').trim().toLowerCase();
    const cleanPhone = (phone || '').replace(/\D/g, '');
    const cleanName = (fullName || '').trim();
    const cleanRole = role === 'organizer' ? 'organizer' : 'worker';

    if (!cleanEmail || !cleanEmail.includes('@')) {
      return NextResponse.json({ success: false, error: 'A valid email address is required.' }, { status: 400 });
    }
    if (!password || password.length < 6) {
      return NextResponse.json({ success: false, error: 'Password must be at least 6 characters.' }, { status: 400 });
    }
    if (!cleanName || cleanName.length < 2) {
      return NextResponse.json({ success: false, error: 'Full name is required.' }, { status: 400 });
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // 1. Check if user already exists
    const { data: userList } = await adminClient.auth.admin.listUsers();
    const existing = userList?.users?.find((u) => u.email?.toLowerCase() === cleanEmail);

    if (existing) {
      return NextResponse.json(
        {
          success: false,
          error: 'An account with this email address already exists. Please sign in or use password reset.',
        },
        { status: 409 }
      );
    }

    // 2. Create user with pre-confirmed email (bypasses Supabase default SMTP error sending confirmation email)
    const { data: newUser, error: createErr } = await adminClient.auth.admin.createUser({
      email: cleanEmail,
      password,
      email_confirm: true,
      user_metadata: {
        role: cleanRole,
        full_name: cleanName,
        phone: cleanPhone,
      },
    });

    if (createErr || !newUser.user) {
      return NextResponse.json(
        { success: false, error: createErr?.message || 'Failed to create user identity.' },
        { status: 400 }
      );
    }

    const userId = newUser.user.id;

    // 3. Initialize profile record
    const { error: profileErr } = await adminClient.from('profiles').upsert({
      id: userId,
      role: cleanRole,
      full_name: cleanName,
      phone: cleanPhone,
      email: cleanEmail,
      city: 'Mumbai',
      is_active: true,
    });

    if (profileErr) {
      await adminClient.auth.admin.deleteUser(userId);
      return NextResponse.json(
        { success: false, error: `Failed to initialize profile: ${profileErr.message}` },
        { status: 500 }
      );
    }

    // 4. Initialize role-specific profile record
    if (cleanRole === 'worker') {
      await adminClient.from('worker_profiles').upsert({
        id: userId,
        preferred_locality: 'bkc',
        service_areas: ['bkc'],
        skills: ['Guest Relations / Hospitality', 'Registration & Badge Desk'],
        profile_completion_status: 'incomplete',
        verification_status: 'unverified',
      });
    } else {
      await adminClient.from('organizer_profiles').upsert({
        id: userId,
        business_name: cleanName,
        business_contact_phone: cleanPhone,
        business_contact_email: cleanEmail,
        business_type: 'event_agency',
        profile_completion_status: 'incomplete',
        verification_status: 'unverified',
      });
    }

    return NextResponse.json({
      success: true,
      userId,
      message: 'Account successfully registered and pre-activated.',
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'Registration failed due to a server error.' },
      { status: 500 }
    );
  }
}
