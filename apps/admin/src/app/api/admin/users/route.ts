import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function getAdminClient() {
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Supabase service credentials are not configured on the admin server.');
  }
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/**
 * Server-side verification that caller has an active admin session
 */
async function verifyAdminAuth(req: NextRequest) {
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) {
    return { ok: false as const, status: 500, error: 'Supabase credentials are not configured.' };
  }

  const authHeader = req.headers.get('authorization');
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;

  const supabase = createServerClient(supabaseUrl, anonKey, {
    cookies: {
      getAll() {
        return req.cookies.getAll();
      },
      setAll() {},
    },
  });

  const {
    data: { user },
    error: authError,
  } = bearerToken
    ? await supabase.auth.getUser(bearerToken)
    : await supabase.auth.getUser();

  if (authError || !user) {
    return { ok: false as const, status: 401, error: 'Unauthorized: Valid admin authentication required.' };
  }

  const adminClient = getAdminClient();
  const { data: profile } = await adminClient
    .from('profiles')
    .select('role, is_active')
    .eq('id', user.id)
    .maybeSingle();

  if (!profile || profile.role !== 'admin' || !profile.is_active) {
    return { ok: false as const, status: 403, error: 'Forbidden: Caller is not an active platform administrator.' };
  }

  return { ok: true as const, user, profile, adminClient };
}

/**
 * Log administrative operations to audit_logs with actor attribution
 */
async function logAudit(
  adminClient: any,
  actorId: string,
  action: string,
  entityId: string,
  entityType: string,
  changes: Record<string, any>
) {
  try {
    await adminClient.from('audit_logs').insert({
      actor_id: actorId,
      action,
      entity_type: entityType,
      entity_id: entityId,
      changes,
      created_at: new Date().toISOString(),
    });
  } catch (err) {
    console.warn('[ADMIN AUDIT] Failed to persist audit log entry:', err);
  }
}

/**
 * POST /api/admin/users
 * Create a new Worker or Organizer account with pre-verified email and initialized profile.
 * Requires active platform admin authorization.
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await verifyAdminAuth(req);
    if (!auth.ok) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }
    const adminClient = auth.adminClient;
    const body = await req.json();

    const {
      role,
      fullName,
      email,
      phone,
      password,
      // Worker specific
      skills,
      preferredLocality,
      upiId,
      // Organizer specific
      businessName,
      businessType,
      gstin,
      // Shared KYC
      verificationStatus,
    } = body || {};

    const cleanRole = role === 'organizer' ? 'organizer' : 'worker';
    const cleanEmail = (email || '').trim().toLowerCase();
    const cleanPhone = (phone || '').replace(/\D/g, '');
    const cleanName = (fullName || '').trim();
    const defaultPassword = (password || '').trim() || 'OpsklPass!' + Math.floor(1000 + Math.random() * 9000);
    const isVerified = verificationStatus === 'verified';

    if (!cleanEmail || !cleanEmail.includes('@')) {
      return NextResponse.json({ success: false, error: 'A valid email address is required.' }, { status: 400 });
    }
    if (!cleanName || cleanName.length < 2) {
      return NextResponse.json({ success: false, error: 'Full name is required (min 2 characters).' }, { status: 400 });
    }
    if (cleanRole === 'organizer' && (!businessName || businessName.trim().length < 2)) {
      return NextResponse.json({ success: false, error: 'Business name is required for organizers.' }, { status: 400 });
    }

    // 1. Direct profile lookup to prevent duplicate email accounts without relying on pagination
    const { data: existingProfile } = await adminClient
      .from('profiles')
      .select('id, email')
      .ilike('email', cleanEmail)
      .maybeSingle();

    if (existingProfile) {
      return NextResponse.json(
        { success: false, error: `An account with email ${cleanEmail} already exists.` },
        { status: 409 }
      );
    }

    // 2. Create Auth User
    const { data: authData, error: authErr } = await adminClient.auth.admin.createUser({
      email: cleanEmail,
      password: defaultPassword,
      email_confirm: true,
      user_metadata: {
        role: cleanRole,
        full_name: cleanName,
        phone: cleanPhone,
      },
    });

    if (authErr || !authData.user) {
      return NextResponse.json(
        { success: false, error: authErr?.message || 'Failed to create auth identity' },
        { status: 400 }
      );
    }

    const userId = authData.user.id;
    const resolvedCity = (preferredLocality || body?.city || 'Mumbai').trim();

    // 3. Upsert profiles
    const { error: profileErr } = await adminClient.from('profiles').upsert({
      id: userId,
      role: cleanRole,
      full_name: cleanName,
      phone: cleanPhone || null,
      email: cleanEmail,
      city: resolvedCity,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    if (profileErr) {
      await adminClient.auth.admin.deleteUser(userId);
      return NextResponse.json(
        { success: false, error: `Failed to initialize profile: ${profileErr.message}` },
        { status: 500 }
      );
    }

    // 4. Upsert Role Specific Profile with rollback on failure
    if (cleanRole === 'worker') {
      const parsedSkills = Array.isArray(skills)
        ? skills
        : typeof skills === 'string'
        ? skills.split(',').map((s: string) => s.trim()).filter(Boolean)
        : ['Guest Relations / Hospitality'];

      const { error: workerErr } = await adminClient.from('worker_profiles').upsert({
        id: userId,
        preferred_locality: resolvedCity,
        service_areas: [resolvedCity],
        skills: parsedSkills,
        upi_id: upiId || null,
        profile_completion_status: isVerified ? 'completed' : 'incomplete',
        verification_status: verificationStatus || 'unverified',
        is_aadhaar_verified: isVerified,
        is_pan_verified: isVerified,
        availability_status: 'available',
      });

      if (workerErr) {
        console.error('[ADMIN WORKER ERROR]', workerErr);
        await adminClient.from('profiles').delete().eq('id', userId);
        await adminClient.auth.admin.deleteUser(userId);
        return NextResponse.json(
          { success: false, error: `Failed to create worker profile: ${workerErr.message}` },
          { status: 500 }
        );
      }
    } else {
      const cleanBizName = (businessName || cleanName).trim();
      const validBizTypes = ['event_agency', 'corporate', 'venue_manager', 'independent'];
      const cleanBizType = validBizTypes.includes(businessType) ? businessType : 'event_agency';

      const { error: orgErr } = await adminClient.from('organizer_profiles').upsert({
        id: userId,
        business_name: cleanBizName,
        business_contact_email: cleanEmail,
        business_contact_phone: cleanPhone || '9800000000',
        business_type: cleanBizType,
        gstin: gstin || null,
        is_gstin_verified: isVerified,
        profile_completion_status: isVerified ? 'completed' : 'incomplete',
        verification_status: verificationStatus || 'unverified',
        total_events_hosted: 0,
      });

      if (orgErr) {
        console.error('[ADMIN ORG ERROR]', orgErr);
        await adminClient.from('profiles').delete().eq('id', userId);
        await adminClient.auth.admin.deleteUser(userId);
        return NextResponse.json(
          { success: false, error: `Failed to create organizer profile: ${orgErr.message}` },
          { status: 500 }
        );
      }
    }

    // 5. Audit Log with Actor Attribution
    await logAudit(adminClient, auth.user.id, 'admin_create_user', userId, cleanRole, {
      email: cleanEmail,
      fullName: cleanName,
      role: cleanRole,
      verificationStatus: verificationStatus || 'unverified',
    });

    return NextResponse.json({
      success: true,
      user: {
        id: userId,
        fullName: cleanName,
        email: cleanEmail,
        phone: cleanPhone,
        role: cleanRole,
        isActive: true,
        createdAt: new Date().toISOString(),
        verificationStatus: verificationStatus || 'unverified',
        temporaryPassword: defaultPassword,
      },
    });
  } catch (err: any) {
    console.error('Error creating user via admin API:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Server error creating user.' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/users
 * Update user profile details, skills/business attributes, verification, or active status.
 * Requires active platform admin authorization.
 */
export async function PUT(req: NextRequest) {
  try {
    const auth = await verifyAdminAuth(req);
    if (!auth.ok) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }
    const adminClient = auth.adminClient;
    const body = await req.json();

    const {
      id,
      role,
      fullName,
      phone,
      isActive,
      // Worker specific
      skills,
      preferredLocality,
      upiId,
      // Organizer specific
      businessName,
      businessType,
      gstin,
      // Verification
      verificationStatus,
    } = body || {};

    if (!id) {
      return NextResponse.json({ success: false, error: 'User ID is required.' }, { status: 400 });
    }

    let userRole = role;
    if (!userRole) {
      const { data: pData } = await adminClient.from('profiles').select('role').eq('id', id).maybeSingle();
      userRole = pData?.role;
    }
    const cleanRole = userRole === 'organizer' ? 'organizer' : 'worker';
    const isVerified = verificationStatus === 'verified';

    // 1. Update profiles table
    const profileUpdates: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };
    if (fullName !== undefined) profileUpdates.full_name = fullName.trim();
    if (phone !== undefined) profileUpdates.phone = phone ? phone.replace(/\D/g, '') : null;
    if (isActive !== undefined) profileUpdates.is_active = Boolean(isActive);

    const { error: profileErr } = await adminClient
      .from('profiles')
      .update(profileUpdates)
      .eq('id', id);

    if (profileErr) {
      return NextResponse.json(
        { success: false, error: `Failed to update profile: ${profileErr.message}` },
        { status: 500 }
      );
    }

    // 2. Update role specific profile
    if (cleanRole === 'worker') {
      const parsedSkills = Array.isArray(skills)
        ? skills
        : typeof skills === 'string'
        ? skills.split(',').map((s: string) => s.trim()).filter(Boolean)
        : undefined;

      const workerUpdates: Record<string, any> = {
        updated_at: new Date().toISOString(),
      };
      if (parsedSkills !== undefined) workerUpdates.skills = parsedSkills;
      if (preferredLocality !== undefined) workerUpdates.preferred_locality = preferredLocality;
      if (upiId !== undefined) workerUpdates.upi_id = upiId || null;
      if (verificationStatus !== undefined) {
        workerUpdates.verification_status = verificationStatus;
        workerUpdates.is_aadhaar_verified = isVerified;
        workerUpdates.is_pan_verified = isVerified;
      }

      const { error: workerErr } = await adminClient
        .from('worker_profiles')
        .update(workerUpdates)
        .eq('id', id);

      if (workerErr) {
        console.error('[ADMIN WORKER UPDATE ERROR]', workerErr);
        return NextResponse.json(
          { success: false, error: `Failed to update worker profile: ${workerErr.message}` },
          { status: 400 }
        );
      }
    } else {
      const orgUpdates: Record<string, any> = {
        updated_at: new Date().toISOString(),
      };
      if (businessName !== undefined) orgUpdates.business_name = businessName.trim();
      if (businessType !== undefined) orgUpdates.business_type = businessType;
      if (gstin !== undefined) orgUpdates.gstin = gstin || null;
      if (verificationStatus !== undefined) {
        orgUpdates.verification_status = verificationStatus;
        orgUpdates.is_gstin_verified = isVerified;
      }

      const { error: orgErr } = await adminClient
        .from('organizer_profiles')
        .update(orgUpdates)
        .eq('id', id);

      if (orgErr) {
        console.error('[ADMIN ORG UPDATE ERROR]', orgErr);
        return NextResponse.json(
          { success: false, error: `Failed to update organizer profile: ${orgErr.message}` },
          { status: 400 }
        );
      }
    }

    // 3. Audit Log with Actor Attribution
    await logAudit(adminClient, auth.user.id, 'admin_update_user', id, cleanRole, {
      fullName,
      phone,
      isActive,
      verificationStatus,
    });

    return NextResponse.json({
      success: true,
      message: 'User details updated successfully.',
    });
  } catch (err: any) {
    console.error('Error updating user via admin API:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Server error updating user.' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/users
 * Delete user from auth and profiles, or safely soft-deactivate if dependent jobs/bookings exist.
 * Requires active platform admin authorization.
 */
export async function DELETE(req: NextRequest) {
  try {
    const auth = await verifyAdminAuth(req);
    if (!auth.ok) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }
    const adminClient = auth.adminClient;
    const url = new URL(req.url);
    const userId = url.searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ success: false, error: 'User ID is required.' }, { status: 400 });
    }

    // Check if user has active jobs or bookings
    const [jobsCheck, bookingsCheck] = await Promise.all([
      adminClient.from('jobs').select('id', { count: 'exact', head: true }).eq('organizer_id', userId),
      adminClient.from('bookings').select('id', { count: 'exact', head: true }).or(`worker_id.eq.${userId},organizer_id.eq.${userId}`),
    ]);

    const hasJobs = (jobsCheck.count || 0) > 0;
    const hasBookings = (bookingsCheck.count || 0) > 0;

    if (hasJobs || hasBookings) {
      // Due to relational integrity and payroll audit constraints, deactivate rather than hard-deleting
      await adminClient.from('profiles').update({ is_active: false, updated_at: new Date().toISOString() }).eq('id', userId);
      await logAudit(adminClient, auth.user.id, 'admin_archive_user_with_records', userId, 'user', {
        reason: 'Archived due to existing jobs/bookings history',
        jobsCount: jobsCheck.count,
        bookingsCount: bookingsCheck.count,
      });

      return NextResponse.json({
        success: true,
        archived: true,
        message: 'Account has active event/booking records. The account was safely deactivated and archived.',
      });
    }

    // Clean delete: delete worker/organizer profile, then profile, then auth user
    await Promise.all([
      adminClient.from('worker_profiles').delete().eq('id', userId),
      adminClient.from('organizer_profiles').delete().eq('id', userId),
    ]);
    await adminClient.from('profiles').delete().eq('id', userId);

    const { error: authDeleteErr } = await adminClient.auth.admin.deleteUser(userId);
    if (authDeleteErr) {
      console.warn('[ADMIN AUTH DELETE WARNING]', authDeleteErr);
    }

    await logAudit(adminClient, auth.user.id, 'admin_delete_user', userId, 'user', {
      deletedAt: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      message: 'Account and associated records were permanently deleted.',
    });
  } catch (err: any) {
    console.error('Error deleting user via admin API:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Server error deleting user.' },
      { status: 500 }
    );
  }
}
