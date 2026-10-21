import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function POST(req: NextRequest) {
  // Fail closed: privileged service-role account minting requires explicit opt-in in every environment.
  if (process.env.ALLOW_DIRECT_ORGANIZER_REGISTRATION !== 'true') {
    return NextResponse.json(
      {
        success: false,
        error:
          'Direct unverified organizer registration is disabled. Set ALLOW_DIRECT_ORGANIZER_REGISTRATION=true only for controlled non-production setup, or use standard verified registration.',
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

  try {
    const body = await req.json();
    const { email, password, businessName, phone } = body || {};

    const cleanEmail = (email || '').trim().toLowerCase();
    const cleanPhone = (phone || '').replace(/\D/g, '');
    const cleanName = (businessName || '').trim();

    if (!cleanEmail || !cleanEmail.includes('@')) {
      return NextResponse.json({ success: false, error: 'A valid email address is required.' }, { status: 400 });
    }
    if (!password || password.length < 6) {
      return NextResponse.json({ success: false, error: 'Password must be at least 6 characters.' }, { status: 400 });
    }
    if (!cleanName || cleanName.length < 2) {
      return NextResponse.json({ success: false, error: 'Organization name is required.' }, { status: 400 });
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // 1. Check if user already exists — NEVER overwrite existing accounts or reset passwords
    const { data: userList } = await adminClient.auth.admin.listUsers();
    const existing = userList?.users?.find((u) => u.email?.toLowerCase() === cleanEmail);

    if (existing) {
      return NextResponse.json(
        {
          success: false,
          error: 'An account with this email address already exists. Please sign in or use the password reset flow.',
        },
        { status: 409 }
      );
    }

    // 2. Create brand-new user with pre-confirmed email (bypassing Resend test-mode restrictions)
    const { data: newUser, error: createErr } = await adminClient.auth.admin.createUser({
      email: cleanEmail,
      password,
      email_confirm: true,
      user_metadata: {
        role: 'organizer',
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

    // Explicitly guarantee profiles and organizer_profiles exist — handle errors and rollback
    const { error: profileErr } = await adminClient.from('profiles').upsert({
      id: userId,
      role: 'organizer',
      full_name: cleanName,
      phone: cleanPhone,
      email: cleanEmail,
      city: 'Mumbai',
      is_active: true,
    });

    if (profileErr) {
      // Roll back created auth identity if profile insertion fails
      await adminClient.auth.admin.deleteUser(userId);
      return NextResponse.json(
        { success: false, error: `Failed to initialize organizer profile: ${profileErr.message}` },
        { status: 500 }
      );
    }

    const { error: orgProfileErr } = await adminClient.from('organizer_profiles').upsert({
      id: userId,
      business_name: cleanName,
      business_contact_phone: cleanPhone,
      business_contact_email: cleanEmail,
      business_type: 'event_agency',
      profile_completion_status: 'incomplete',
      verification_status: 'unverified',
    });

    if (orgProfileErr) {
      // Roll back profile and auth user if organizer profile insertion fails
      await adminClient.from('profiles').delete().eq('id', userId);
      await adminClient.auth.admin.deleteUser(userId);
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
