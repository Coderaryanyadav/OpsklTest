import { supabase } from './client';
import { logger } from '../utils/logger';
import { Profile, WorkerProfile, OrganizerProfile } from '../types';

export async function fetchUserProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) {
    logger.error('Failed to fetch user profile', error, { userId });
    return null;
  }

  return {
    id: data.id,
    role: data.role,
    phone: data.phone,
    fullName: data.full_name,
    email: data.email,
    avatarUrl: data.avatar_url,
    city: data.city,
    isActive: data.is_active,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

export async function fetchWorkerProfile(userId: string): Promise<WorkerProfile | null> {
  const { data, error } = await supabase
    .from('worker_profiles')
    .select('*, profiles(*)')
    .eq('id', userId)
    .single();

  if (error) {
    logger.warn('Worker profile not found or query error', { userId });
    return null;
  }

  return {
    id: data.id,
    preferredLocality: data.preferred_locality,
    serviceAreas: data.service_areas || [],
    skills: data.skills || [],
    experienceYears: Number(data.experience_years) || 0,
    bio: data.bio,
    availabilityStatus: data.availability_status,
    profileCompletionStatus: data.profile_completion_status,
    verificationStatus: data.verification_status,
    rating: data.rating !== null && data.rating !== undefined ? Number(data.rating) : 0,
    totalReviews: data.total_reviews || 0,
    shiftsCompleted: data.shifts_completed || 0,
    upiId: data.upi_id,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

export async function fetchOrganizerProfile(userId: string): Promise<OrganizerProfile | null> {
  const { data, error } = await supabase
    .from('organizer_profiles')
    .select('*, profiles(*)')
    .eq('id', userId)
    .single();

  if (error) {
    logger.warn('Organizer profile not found or query error', { userId });
    return null;
  }

  return {
    id: data.id,
    businessName: data.business_name,
    businessContactEmail: data.business_contact_email,
    businessContactPhone: data.business_contact_phone,
    gstin: data.gstin,
    businessType: data.business_type,
    billingAddress: data.billing_address,
    verificationStatus: data.verification_status,
    profileCompletionStatus: data.profile_completion_status,
    rating: data.rating !== null && data.rating !== undefined ? Number(data.rating) : 0,
    totalEventsHosted: data.total_events_hosted || 0,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

export async function updateWorkerProfile(
  userId: string,
  updates: Partial<{
    skills: string[];
    serviceAreas: string[];
    bio: string;
    upiId: string;
    availabilityStatus: 'available' | 'busy' | 'paused';
    profileCompletionStatus: 'incomplete' | 'completed';
  }>
) {
  logger.info('Updating worker profile', { userId });

  const payload: Record<string, any> = {};
  if (updates.skills !== undefined) payload.skills = updates.skills;
  if (updates.serviceAreas !== undefined) payload.service_areas = updates.serviceAreas;
  if (updates.bio !== undefined) payload.bio = updates.bio;
  if (updates.upiId !== undefined) payload.upi_id = updates.upiId;
  if (updates.availabilityStatus !== undefined) payload.availability_status = updates.availabilityStatus;
  if (updates.profileCompletionStatus !== undefined) payload.profile_completion_status = updates.profileCompletionStatus;

  const { data, error } = await supabase
    .from('worker_profiles')
    .update(payload)
    .eq('id', userId)
    .select()
    .single();

  if (error) {
    logger.error('Failed to update worker profile', error, { userId });
    throw error;
  }

  return data;
}

export async function updateOrganizerProfile(
  userId: string,
  updates: Partial<{
    businessName: string;
    gstin: string;
    contactPhone: string;
    billingAddress: string;
    profileCompletionStatus: 'incomplete' | 'completed';
  }>
) {
  logger.info('Updating organizer profile', { userId });

  const payload: Record<string, any> = {};
  if (updates.businessName !== undefined) payload.business_name = updates.businessName;
  if (updates.gstin !== undefined) payload.gstin = updates.gstin;
  if (updates.contactPhone !== undefined) payload.business_contact_phone = updates.contactPhone;
  if (updates.billingAddress !== undefined) payload.billing_address = updates.billingAddress;
  if (updates.profileCompletionStatus !== undefined) payload.profile_completion_status = updates.profileCompletionStatus;

  const { data, error } = await supabase
    .from('organizer_profiles')
    .update(payload)
    .eq('id', userId)
    .select()
    .single();

  if (error) {
    logger.error('Failed to update organizer profile', error, { userId });
    throw error;
  }

  return data;
}

/**
 * Submit an authoritative account deletion request.
 * Persists an immutable audit log record and triggers account deactivation.
 */
export async function requestAccountDeletionSafe(
  userId: string,
  reason: string = 'User initiated account deletion in-app'
): Promise<{ success: boolean; requestedAt: string; status?: string; scheduledPurgeAt?: string; error?: string }> {
  logger.info('Submitting account deletion request', { userId, reason });

  try {
    const { data, error } = await supabase.rpc('request_account_deletion_safe', {
      p_reason: reason,
    });

    if (error) {
      logger.error('RPC request_account_deletion_safe failed', error, { userId });
      return {
        success: false,
        requestedAt: new Date().toISOString(),
        error: error.message || 'Unable to register deletion request',
      };
    }

    if (!data?.success) {
      logger.warn('Account deletion request rejected by policy', { userId, data });
      return {
        success: false,
        requestedAt: new Date().toISOString(),
        error: data?.message || data?.error || 'Account deletion request rejected',
      };
    }

    return {
      success: true,
      requestedAt: data.requested_at || new Date().toISOString(),
      status: data.status || 'queued',
      scheduledPurgeAt: data.scheduled_purge_at,
    };
  } catch (err: any) {
    logger.error('Account deletion execution error', err, { userId });
    return {
      success: false,
      requestedAt: new Date().toISOString(),
      error: err?.message || 'Unable to register deletion request',
    };
  }
}
