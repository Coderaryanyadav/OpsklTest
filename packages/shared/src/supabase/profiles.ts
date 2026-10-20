import { supabase } from './client';
import { logger } from '../utils/logger';
import { Profile, WorkerProfile, OrganizerProfile, VerificationCase } from '../types';

export async function fetchLatestVerificationCase(userId: string): Promise<VerificationCase | null> {
  const { data, error } = await supabase
    .from('verification_cases')
    .select('*')
    .eq('profile_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    logger.warn('Failed to fetch verification case', { userId, error });
    return null;
  }

  if (!data) return null;

  return {
    id: data.id,
    profileId: data.profile_id,
    documentType: data.document_type,
    documentMaskedId: data.document_masked_id,
    documentStoragePath: data.document_storage_path,
    status: data.status,
    rejectionReason: data.rejection_reason,
    reviewedBy: data.reviewed_by,
    reviewedAt: data.reviewed_at,
    createdAt: data.created_at,
  };
}


export async function fetchUserProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      // Row not found
      return null;
    }
    logger.error('Failed to fetch user profile due to network/database error', error, { userId });
    const err = new Error(error.message || 'Failed to fetch user profile');
    (err as any).code = error.code;
    throw err;
  }

  if (!data) return null;

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

/**
 * Cancel pending account deletion and restore active account status
 */
export async function cancelAccountDeletionSafe(): Promise<{ success: boolean; error?: string }> {
  try {
    const { data, error } = await supabase.rpc('cancel_account_deletion_safe');
    if (error) {
      logger.error('cancel_account_deletion_safe RPC error', error);
      return { success: false, error: error.message };
    }
    return { success: !!data?.success, error: data?.error };
  } catch (err: any) {
    logger.error('cancelAccountDeletionSafe exception', err);
    return { success: false, error: err.message };
  }
}

/**
 * Submit user KYC or business verification document (Aadhaar, PAN, GSTIN)
 */
export async function submitVerificationCaseSafe(
  documentType: 'aadhaar' | 'pan' | 'gstin',
  maskedId: string,
  storagePath: string
): Promise<{ success: boolean; caseId?: string; status?: string; error?: string }> {
  try {
    const { data, error } = await supabase.rpc('submit_verification_case_safe', {
      p_document_type: documentType,
      p_masked_id: maskedId,
      p_storage_path: storagePath,
    });

    if (error) {
      logger.error('submit_verification_case_safe RPC error', error);
      return { success: false, error: error.message };
    }

    if (data && data.success === false) {
      return { success: false, error: data.error };
    }

    return {
      success: true,
      caseId: data?.case_id,
      status: data?.status || 'pending',
    };
  } catch (err: any) {
    logger.error('submitVerificationCaseSafe exception', err);
    return { success: false, error: err.message };
  }
}

/**
 * Maps a MIME content type to the storage object file extension.
 * Plain-text GSTIN evidence must not be stored as `.pdf` (admin review / Content-Type mismatch).
 */
export function resolveVerificationDocumentExtension(contentType: string = 'application/pdf'): string {
  const ct = (contentType || '').toLowerCase();
  if (ct.includes('png')) return 'png';
  if (ct.includes('jpeg') || ct.includes('jpg')) return 'jpg';
  if (ct.includes('text') || ct.includes('plain')) return 'txt';
  return 'pdf';
}

/**
 * Uploads a verification document (PDF/Image) to the private verification-documents bucket.
 * The storage path is strictly user-scoped to `${userId}/kyc_${documentType}_${Date.now()}.${extension}`.
 */
export async function uploadVerificationDocument(
  userId: string,
  documentType: 'aadhaar' | 'pan' | 'gstin',
  fileData: any,
  contentType: string = 'application/pdf'
): Promise<{ success: boolean; storagePath?: string; error?: string }> {
  try {
    const extension = resolveVerificationDocumentExtension(contentType);
    const storagePath = `${userId}/kyc_${documentType}_${Date.now()}.${extension}`;

    let uploadPayload = fileData;
    if (fileData && typeof fileData === 'object' && typeof fileData.uri === 'string') {
      try {
        const res = await fetch(fileData.uri);
        uploadPayload = await res.blob();
      } catch (blobErr) {
        logger.warn('Could not convert URI to blob, falling back to direct payload', { error: blobErr });
      }
    }

    const { error } = await supabase.storage
      .from('verification-documents')
      .upload(storagePath, uploadPayload, {
        contentType,
        upsert: true,
      });

    if (error) {
      logger.error('Failed to upload KYC document to storage', error);
      return { success: false, error: `Document upload failed: ${error.message}` };
    }

    return { success: true, storagePath };
  } catch (err: any) {
    logger.error('Unexpected exception during document upload', err);
    return { success: false, error: err?.message || 'Storage upload error' };
  }
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
    preferredLocality: string;
    experienceYears: number;
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
  if (updates.preferredLocality !== undefined) payload.preferred_locality = updates.preferredLocality;
  if (updates.experienceYears !== undefined) payload.experience_years = updates.experienceYears;
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

export async function updateUserProfile(
  userId: string,
  updates: Partial<{
    fullName: string;
    city: string;
    avatarUrl: string;
  }>
) {
  logger.info('Updating user base profile', { userId });

  const payload: Record<string, any> = {};
  if (updates.fullName !== undefined) payload.full_name = updates.fullName;
  if (updates.city !== undefined) payload.city = updates.city;
  if (updates.avatarUrl !== undefined) payload.avatar_url = updates.avatarUrl;

  const { data, error } = await supabase
    .from('profiles')
    .update(payload)
    .eq('id', userId)
    .select()
    .single();

  if (error) {
    logger.error('Failed to update user profile', error, { userId });
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
