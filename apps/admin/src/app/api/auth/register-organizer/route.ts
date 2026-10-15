import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(req: NextRequest) {
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

    // 1. Check if user already exists
    const { data: userList } = await adminClient.auth.admin.listUsers();
    const existing = userList?.users?.find((u) => u.email?.toLowerCase() === cleanEmail);

    if (existing) {
      // User exists: update password, role and confirm email
      const { error: updateErr } = await adminClient.auth.admin.updateUserById(existing.id, {
        password,
        email_confirm: true,
        user_metadata: {
          ...existing.user_metadata,
          role: 'organizer',
          full_name: cleanName,
          phone: cleanPhone,
        },
      });

      if (updateErr) {
        return NextResponse.json({ success: false, error: updateErr.message }, { status: 400 });
      }

      // Update profiles and organizer_profiles
      await adminClient.from('profiles').upsert({
        id: existing.id,
        role: 'organizer',
        full_name: cleanName,
        phone: cleanPhone,
        email: cleanEmail,
        city: 'Mumbai',
        is_active: true,
      });

      await adminClient.from('organizer_profiles').upsert({
        id: existing.id,
        business_name: cleanName,
        business_contact_phone: cleanPhone,
        business_contact_email: cleanEmail,
        business_type: 'event_agency',
        profile_completion_status: 'incomplete',
        verification_status: 'unverified',
      });

      return NextResponse.json({
        success: true,
        userId: existing.id,
        message: 'Existing account upgraded to Organizer profile.',
      });
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

    // Explicitly guarantee profiles and organizer_profiles exist
    await adminClient.from('profiles').upsert({
      id: userId,
      role: 'organizer',
      full_name: cleanName,
      phone: cleanPhone,
      email: cleanEmail,
      city: 'Mumbai',
      is_active: true,
    });

    await adminClient.from('organizer_profiles').upsert({
      id: userId,
      business_name: cleanName,
      business_contact_phone: cleanPhone,
      business_contact_email: cleanEmail,
      business_type: 'event_agency',
      profile_completion_status: 'incomplete',
      verification_status: 'unverified',
    });

    return NextResponse.json({
      success: true,
      userId,
      message: 'Organizer account successfully created and activated.',
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'Internal server error during registration.' },
      { status: 500 }
    );
  }
}
