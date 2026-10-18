import { supabase } from './client';
import { logger } from '../utils/logger';
import {
  Job,
  JobApplication,
  Booking,
  DiscoveryFeedOptions,
  DiscoveryFeedResult,
  ApplicationResult,
  OrganizerMetrics,
  ShiftStatus,
} from '../types';

function mapJobRow(row: any): Job {
  return {
    id: row.id,
    organizerId: row.organizer_id,
    title: row.title,
    category: row.category,
    venueName: row.venue_name,
    venueAddress: row.venue_address,
    landmark: row.landmark,
    city: row.city,
    zone: row.zone,
    date: row.date,
    startTime: row.start_time,
    endTime: row.end_time,
    durationHours: Number(row.duration_hours),
    hourlyRate: Number(row.hourly_rate),
    totalPay: Number(row.total_pay),
    slotsTotal: row.slots_total,
    slotsFilled: row.slots_filled,
    dressCode: row.dress_code,
    duties: row.duties || [],
    perks: row.perks || [],
    requiredSkills: row.required_skills || [],
    eligibilityCriteria: row.eligibility_criteria,
    applicationDeadline: row.application_deadline,
    breaksMinutes: row.breaks_minutes ?? 30,
    mealProvided: Boolean(row.meal_provided),
    transportProvided: Boolean(row.transport_provided),
    overtimePolicy: row.overtime_policy,
    latitude: row.latitude ? Number(row.latitude) : undefined,
    longitude: row.longitude ? Number(row.longitude) : undefined,
    reportingInstructions: row.reporting_instructions,
    cancellationPolicy: row.cancellation_policy,
    paymentDeadline: row.payment_deadline,
    supervisorName: row.supervisor_name,
    supervisorPhone: row.supervisor_phone,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    organizer: row.organizer_profiles
      ? {
          id: row.organizer_profiles.id || row.organizer_id,
          businessName: row.organizer_profiles.business_name || 'Event Host',
          verificationStatus: row.organizer_profiles.verification_status || 'unverified',
          rating: Number(row.organizer_profiles.rating ?? 0),
          totalEventsHosted: row.organizer_profiles.total_events_hosted ?? 0,
          businessContactPhone: row.organizer_profiles.business_contact_phone || '',
          businessType: row.organizer_profiles.business_type || 'event_agency',
          profileCompletionStatus: row.organizer_profiles.profile_completion_status || 'incomplete',
          createdAt: row.organizer_profiles.created_at || row.created_at,
          updatedAt: row.organizer_profiles.updated_at || row.updated_at,
        }
      : undefined,
  };
}

/**
 * Enriches jobs with public organizer card projection without relying on sensitive base table
 */
async function enrichJobsWithOrganizerCards(rawJobs: any[]): Promise<Job[]> {
  if (!rawJobs || rawJobs.length === 0) return [];
  const organizerIds = Array.from(
    new Set(rawJobs.map((r: any) => r.organizer_id).filter(Boolean))
  );

  const cardsMap = new Map<string, any>();
  if (organizerIds.length > 0) {
    try {
      const { data: cards, error } = await supabase
        .from('public_organizer_cards')
        .select('*')
        .in('id', organizerIds);

      if (!error && cards) {
        cards.forEach((c: any) => cardsMap.set(c.id, c));
      }
    } catch (err) {
      logger.warn('Failed to query public_organizer_cards view', { err });
    }
  }

  return rawJobs.map((row: any) => {
    const card = cardsMap.get(row.organizer_id);
    const org = card
      ? {
          id: card.id,
          businessName: card.business_name || 'Event Host',
          businessContactPhone: '',
          businessType: card.business_type || 'event_agency',
          verificationStatus: card.verification_status || 'unverified',
          profileCompletionStatus: 'completed',
          rating: Number(card.rating ?? 0),
          totalEventsHosted: card.total_events_hosted ?? 0,
          createdAt: card.created_at || row.created_at,
          updatedAt: card.created_at || row.updated_at,
        }
      : row.organizer_profiles
      ? {
          id: row.organizer_profiles.id || row.organizer_id,
          businessName: row.organizer_profiles.business_name || 'Event Host',
          verificationStatus: row.organizer_profiles.verification_status || 'unverified',
          rating: Number(row.organizer_profiles.rating ?? 0),
          totalEventsHosted: row.organizer_profiles.total_events_hosted ?? 0,
          businessContactPhone: row.organizer_profiles.business_contact_phone || '',
          businessType: row.organizer_profiles.business_type || 'event_agency',
          profileCompletionStatus: row.organizer_profiles.profile_completion_status || 'incomplete',
          createdAt: row.organizer_profiles.created_at || row.created_at,
          updatedAt: row.organizer_profiles.updated_at || row.updated_at,
        }
      : undefined;

    return mapJobRow({
      ...row,
      organizer_profiles: org,
    });
  });
}

/**
 * Fetch discovery feed for workers with deterministic ordering, server-side filtering,
 * and exclusion of already-swiped or already-applied jobs.
 */
export async function fetchDiscoveryFeed(
  options: DiscoveryFeedOptions = {}
): Promise<DiscoveryFeedResult> {
  const { workerId, filters, page = 1, pageSize = 20, includePassed = false } = options;
  const offset = (page - 1) * pageSize;

  try {
    let excludedJobIds: string[] = [];

    // Exclude jobs the worker has already applied to or swiped left on
    if (workerId && !includePassed) {
      const [applicationsRes, swipeEventsRes] = await Promise.all([
        supabase
          .from('job_applications')
          .select('job_id')
          .eq('worker_id', workerId),
        supabase
          .from('swipe_events')
          .select('job_id')
          .eq('worker_id', workerId)
          .eq('direction', 'left'),
      ]);

      if (applicationsRes.error) {
        logger.error('Failed to query applied jobs for discovery exclusion', applicationsRes.error);
        return {
          jobs: [],
          totalCount: 0,
          page,
          hasMore: false,
          error: `Error checking prior applications: ${applicationsRes.error.message}`,
        };
      }

      if (swipeEventsRes.error) {
        logger.error('Failed to query swipe events for discovery exclusion', swipeEventsRes.error);
        return {
          jobs: [],
          totalCount: 0,
          page,
          hasMore: false,
          error: `Error checking swipe history: ${swipeEventsRes.error.message}`,
        };
      }

      const appliedIds = (applicationsRes.data || []).map((a: any) => a.job_id);
      const passedIds = (swipeEventsRes.data || []).map((s: any) => s.job_id);
      excludedJobIds = Array.from(new Set([...appliedIds, ...passedIds]));
    }

    let query = supabase
      .from('public_jobs')
      .select('*', { count: 'exact' });

    // Exclude already processed jobs
    if (excludedJobIds.length > 0) {
      query = query.not('id', 'in', `(${excludedJobIds.join(',')})`);
    }

    // Server-side filters
    if (filters?.city) {
      query = query.eq('city', filters.city);
    }
    if (filters?.zone && filters.zone !== 'All Zones') {
      query = query.eq('zone', filters.zone);
    }
    if (filters?.category && filters.category !== 'all') {
      query = query.eq('category', filters.category);
    }
    if (filters?.minWage && filters.minWage > 0) {
      query = query.gte('hourly_rate', filters.minWage);
    }
    if (filters?.date) {
      query = query.eq('date', filters.date);
    }
    if (filters?.requiredSkill) {
      query = query.contains('required_skills', [filters.requiredSkill]);
    }

    // Deterministic ordering: date ascending, highest total pay first, creation timestamp
    query = query
      .order('date', { ascending: true })
      .order('total_pay', { ascending: false })
      .order('created_at', { ascending: false })
      .range(offset, offset + pageSize - 1);

    const { data, count, error } = await query;

    if (error) {
      logger.error('Failed to fetch discovery feed', error);
      return { jobs: [], totalCount: 0, page, hasMore: false, error: error.message || 'Database error fetching shifts feed.' };
    }

    const jobs = await enrichJobsWithOrganizerCards(data || []);
    const totalCount = count || jobs.length;
    const hasMore = offset + jobs.length < totalCount;

    return {
      jobs,
      totalCount,
      page,
      hasMore,
    };
  } catch (err: any) {
    logger.error('Unexpected error fetching discovery feed', err);
    return { jobs: [], totalCount: 0, page, hasMore: false, error: err?.message || 'Network error fetching shifts feed.' };
  }
}

/**
 * Standard fetchJobs backward compatibility
 */
export async function fetchJobs(filters?: {
  city?: string;
  category?: string;
  zone?: string;
}): Promise<Job[]> {
  const result = await fetchDiscoveryFeed({
    filters: {
      city: filters?.city,
      category: filters?.category as any,
      zone: filters?.zone,
    },
    pageSize: 50,
  });
  return result.jobs;
}

/**
 * Fetch a single job by ID with full details
 */
export async function fetchJobById(jobId: string): Promise<Job | null> {
  // 1. Try fetching full job (accessible to organizers and confirmed crew)
  const { data, error } = await supabase
    .from('jobs')
    .select('*')
    .eq('id', jobId)
    .single();

  if (data) {
    const [enriched] = await enrichJobsWithOrganizerCards([data]);
    return enriched || mapJobRow(data);
  }

  // 2. Fallback to public_jobs view for unconfirmed applicants and discovery visitors
  const { data: publicData, error: publicError } = await supabase
    .from('public_jobs')
    .select('*')
    .eq('id', jobId)
    .single();

  if (publicError || !publicData) {
    logger.error('Failed to fetch job by ID from public_jobs view', publicError || error, { jobId });
    return null;
  }

  const [enriched] = await enrichJobsWithOrganizerCards([publicData]);
  return enriched || mapJobRow(publicData);
}

/**
 * Atomic Application with Server-side Eligibility Validation
 * Never trusts client state. Enforces capacity, deadline, status, and duplicate check.
 */
export async function applyForJobSafe(
  jobId: string,
  workerId: string,
  notes?: string
): Promise<ApplicationResult> {
  logger.info('Executing safe job application submission', { jobId, workerId });

  try {
    // 1. Invoke authoritative atomic RPC function
    const { data: rpcData, error: rpcError } = await supabase.rpc('apply_for_job_safe', {
      p_job_id: jobId,
      p_notes: notes ?? null,
    });

    if (rpcError) {
      logger.error('RPC error in apply_for_job_safe — failing closed', rpcError);
      return {
        success: false,
        errorCode: rpcError.code || 'TRANSACTION_ERROR',
        errorMessage: rpcError.message || 'Application transaction failed on server.',
      };
    }

    if (rpcData) {
      if (rpcData.success) {
        const appId = rpcData.application?.id || rpcData.application_id;
        return {
          success: true,
          application: {
            id: appId,
            jobId: rpcData.application?.job_id || jobId,
            workerId: rpcData.application?.worker_id || workerId,
            status: rpcData.application?.status || rpcData.status || 'applied',
            appliedAt: rpcData.application?.applied_at || new Date().toISOString(),
            notes: rpcData.application?.notes || notes,
          },
        };
      }
      return {
        success: false,
        errorCode: rpcData.error_code,
        errorMessage: rpcData.message,
      };
    }

    return {
      success: false,
      errorCode: 'UNKNOWN_RESPONSE',
      errorMessage: 'No data returned from application transaction.',
    };
  } catch (err: any) {
    logger.error('Unexpected error applying for job', err);
    return {
      success: false,
      errorCode: 'NETWORK_ERROR',
      errorMessage: err.message || 'Network connection failed. Please retry.',
    };
  }
}

/**
 * Legacy applyForJob wrapper
 */
export async function applyForJob(jobId: string, workerId: string, notes?: string) {
  const res = await applyForJobSafe(jobId, workerId, notes);
  if (!res.success) {
    throw new Error(res.errorMessage || res.errorCode || 'Failed to apply');
  }
  return res.application;
}

/**
 * Record a left swipe (pass) on a shift card
 */
export async function recordSwipePass(
  jobId: string,
  _workerId?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { data: rpcData, error: rpcError } = await supabase.rpc('record_swipe_pass', {
      p_job_id: jobId,
    });

    if (rpcError) {
      logger.error('RPC error in record_swipe_pass', rpcError, { jobId, workerId: _workerId });
      return { success: false, error: rpcError.message };
    }

    if (rpcData && !rpcData.success) {
      return { success: false, error: rpcData.message || rpcData.error_code };
    }

    return { success: true };
  } catch (err: any) {
    logger.error('Unexpected error in recordSwipePass', err, { jobId, workerId: _workerId });
    return { success: false, error: err.message };
  }
}

/**
 * Undo a left swipe (skip undo) to restore card
 */
export async function undoSwipePass(
  jobId: string,
  _workerId?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { data: rpcData, error: rpcError } = await supabase.rpc('undo_swipe_event', {
      p_job_id: jobId,
    });

    if (rpcError) {
      logger.error('RPC error in undo_swipe_event', rpcError, { jobId, workerId: _workerId });
      return { success: false, error: rpcError.message };
    }

    if (rpcData && !rpcData.success) {
      return { success: false, error: rpcData.message || rpcData.error_code };
    }

    return { success: true };
  } catch (err: any) {
    logger.error('Unexpected error in undoSwipePass', err, { jobId, workerId: _workerId });
    return { success: false, error: err.message };
  }
}

/**
 * Fetch all applications for a worker with job details and safe organizer card projection
 */
export async function fetchWorkerApplications(workerId: string): Promise<JobApplication[]> {
  const { data, error } = await supabase
    .from('job_applications')
    .select('*, public_jobs(*)')
    .eq('worker_id', workerId)
    .order('applied_at', { ascending: false });

  if (error) {
    logger.error('Failed to fetch worker applications', error);
    throw new Error(`Failed to load worker applications: ${error.message}`);
  }

  const rawJobs = (data || []).map((r: any) => r.public_jobs).filter(Boolean);
  const enrichedJobs = await enrichJobsWithOrganizerCards(rawJobs);
  const jobsById = new Map<string, Job>();
  enrichedJobs.forEach((j) => jobsById.set(j.id, j));

  return (data || []).map((row: any) => ({
    id: row.id,
    jobId: row.job_id,
    workerId: row.worker_id,
    status: row.status,
    appliedAt: row.applied_at,
    notes: row.notes,
    job: row.public_jobs ? jobsById.get(row.public_jobs.id) || mapJobRow(row.public_jobs) : undefined,
  }));
}

export async function fetchApplicationsForJob(jobId: string): Promise<JobApplication[]> {
  const { data, error } = await supabase
    .from('job_applications')
    .select(`
      id,
      job_id,
      worker_id,
      status,
      applied_at,
      notes,
      profiles:worker_id (
        id,
        full_name,
        phone,
        avatar_url
      )
    `)
    .eq('job_id', jobId)
    .order('applied_at', { ascending: false });

  if (error) {
    logger.error('Failed to fetch job applications', error, { jobId });
    return [];
  }

  const workerIds = Array.from(
    new Set((data || []).map((row: any) => row.worker_id).filter(Boolean))
  );
  const workerProfilesMap = new Map<string, any>();
  if (workerIds.length > 0) {
    try {
      const { data: wapData } = await supabase
        .from('worker_applicant_profiles')
        .select('*')
        .in('id', workerIds);
      (wapData || []).forEach((wp: any) => workerProfilesMap.set(wp.id, wp));
    } catch (wapErr) {
      logger.warn('Failed to fetch worker_applicant_profiles view', { wapErr });
    }
  }

  return (data || []).map((row: any) => {
    const wap = workerProfilesMap.get(row.worker_id) || {};
    const prof = row.profiles;
    return {
      id: row.id,
      jobId: row.job_id,
      workerId: row.worker_id,
      status: row.status,
      appliedAt: row.applied_at,
      notes: row.notes,
      worker: {
        id: row.worker_id,
        preferredLocality: wap.preferred_locality || '',
        serviceAreas: [],
        skills: wap.skills || [],
        experienceYears: wap.experience_years || 0,
        availabilityStatus: 'available',
        profileCompletionStatus: 'completed',
        verificationStatus: wap.verification_status || 'unverified',
        rating: wap.rating != null ? Number(wap.rating) : 0,
        totalReviews: wap.total_reviews || 0,
        shiftsCompleted: wap.shifts_completed || 0,
        createdAt: '',
        updatedAt: '',
        profile: prof
          ? {
              id: prof.id,
              role: 'worker',
              phone: prof.phone || '',
              fullName: prof.full_name || 'Worker',
              avatarUrl: prof.avatar_url,
              city: 'Mumbai',
              isActive: true,
              createdAt: '',
              updatedAt: '',
            }
          : undefined,
      },
    };
  });
}

export async function confirmWorkerBooking(
  jobId: string,
  workerId: string,
  organizerId: string,
  hourlyRate: number,
  totalPay: number
): Promise<Booking> {
  logger.info('Organizer confirming worker booking via secure transaction', {
    jobId,
    workerId,
    organizerId,
    hourlyRate,
    totalPay,
  });

  const result = await confirmWorkerBookingSafe(jobId, workerId, organizerId);
  if (!result.success || !result.booking) {
    throw new Error(result.error || 'Failed to confirm worker booking via authoritative transaction');
  }

  return result.booking;
}

/**
 * ============================================================================
 * PHASE 4 — ORGANIZER MANAGEMENT & HIRING ENGINE SERVICES
 * ============================================================================
 */

/**
 * Create a new job with client & server-side validation and audit log recording.
 */
export async function createJobSafe(
  job: Partial<Job>,
  organizerId: string
): Promise<{ success: boolean; jobId?: string; error?: string; errorCode?: string }> {
  logger.info('Organizer creating new shift listing', { organizerId, title: job.title });

  try {
    const resolvedOrganizerId = organizerId || (await supabase.auth.getSession()).data.session?.user?.id;
    if (!resolvedOrganizerId) {
      return {
        success: false,
        error: 'Please sign in to publish shifts.',
        errorCode: 'UNAUTHENTICATED',
      };
    }

    // 1. Invoke atomic RPC function if available
    const { data: rpcData, error: rpcError } = await supabase.rpc('create_job_safe', {
      p_job: {
        organizer_id: resolvedOrganizerId,
        title: job.title,
        category: job.category,
        venue_name: job.venueName,
        venue_address: job.venueAddress,
        landmark: job.landmark ?? null,
        city: job.city ?? 'Mumbai',
        zone: job.zone,
        latitude: job.latitude ?? null,
        longitude: job.longitude ?? null,
        crosses_midnight: (job as any).crossesMidnight ?? false,
        date: job.date,
        start_time: job.startTime,
        end_time: job.endTime,
        duration_hours: job.durationHours,
        hourly_rate: job.hourlyRate,
        total_pay: job.totalPay ?? (job.hourlyRate! * job.durationHours!),
        slots_total: job.slotsTotal,
        dress_code: job.dressCode ?? null,
        duties: job.duties ?? [],
        perks: job.perks ?? [],
        required_skills: job.requiredSkills ?? [],
        breaks_minutes: job.breaksMinutes ?? 30,
        meal_provided: job.mealProvided ?? false,
        transport_provided: job.transportProvided ?? false,
        overtime_policy: job.overtimePolicy ?? null,
        reporting_instructions: job.reportingInstructions ?? null,
        cancellation_policy: job.cancellationPolicy ?? 'Free cancellation up to 24h prior to shift.',
        application_deadline: job.applicationDeadline ?? null,
        payment_deadline: job.paymentDeadline ?? null,
        supervisor_name: job.supervisorName,
        supervisor_phone: job.supervisorPhone,
        status: job.status ?? 'open',
      },
      p_organizer_id: resolvedOrganizerId,
    });

    if (rpcError) {
      logger.error('RPC error in create_job_safe', rpcError);
      return { success: false, error: rpcError.message || 'Server error creating shift listing.' };
    }

    if (rpcData) {
      if (rpcData.success) {
        return { success: true, jobId: rpcData.job_id };
      }
      return {
        success: false,
        errorCode: rpcData.error_code,
        error: rpcData.message || rpcData.error_code,
      };
    }

    return { success: false, error: 'Unexpected empty response from create_job_safe.' };
  } catch (err: any) {
    logger.error('Unexpected error in createJobSafe', err);
    return { success: false, error: err.message };
  }
}

/**
 * Update shift status (draft, open, paused, filled, cancelled)
 */
export async function updateJobStatus(
  jobId: string,
  organizerId: string,
  newStatus: ShiftStatus
): Promise<{ success: boolean; error?: string }> {
  try {
    logger.info('Updating job status', { jobId, organizerId, newStatus });
    const { data: rpcData, error: rpcError } = await supabase.rpc('update_job_status_safe', {
      p_job_id: jobId,
      p_new_status: newStatus,
    });

    if (rpcError) {
      logger.error('RPC error in update_job_status_safe', rpcError, { jobId, organizerId });
      return { success: false, error: rpcError.message || 'Failed to update shift status.' };
    }

    if (rpcData) {
      if (rpcData.success) {
        return { success: true };
      }
      return { success: false, error: rpcData.message || rpcData.error_code || 'Failed to update shift status.' };
    }

    return { success: false, error: 'Empty response from shift status update transaction.' };
  } catch (err: any) {
    logger.error('Unexpected error in updateJobStatus', err, { jobId, organizerId });
    return { success: false, error: err.message };
  }
}

/**
 * Fetch all shifts created by an organizer
 */
export async function fetchOrganizerJobs(organizerId: string): Promise<Job[]> {
  const { data, error } = await supabase
    .from('jobs')
    .select('*, organizer_profiles(id, business_name, business_type, verification_status, rating, total_events_hosted, created_at)')
    .eq('organizer_id', organizerId)
    .order('date', { ascending: false });

  if (error) {
    logger.error('Failed to fetch organizer jobs', error, { organizerId });
    throw new Error(`Failed to fetch organizer jobs: ${error.message}`);
  }

  return (data || []).map(mapJobRow);
}

/**
 * Fetch applications for an organizer's shifts with complete worker profile data
 */
export async function fetchOrganizerApplications(
  organizerId: string,
  jobId?: string
): Promise<JobApplication[]> {
  let query = supabase
    .from('job_applications')
    .select(`
      id,
      job_id,
      worker_id,
      status,
      applied_at,
      notes,
      jobs!inner (
        id,
        title,
        organizer_id,
        date,
        start_time,
        end_time,
        hourly_rate,
        total_pay,
        slots_total,
        slots_filled
      ),
      profiles:worker_id (
        id,
        full_name,
        phone,
        avatar_url
      )
    `)
    .order('applied_at', { ascending: false });

  if (jobId) {
    query = query.eq('job_id', jobId);
  } else {
    query = query.eq('jobs.organizer_id', organizerId);
  }

  const { data, error } = await query;

  let rawList: any[] = data || [];

  // Fallback to RPC if direct query returns empty (e.g. co-host organizer or team member)
  if (rawList.length === 0) {
    const { data: rpcRows, error: rpcErr } = await supabase.rpc('get_organizer_applications_safe', {
      p_organizer_id: organizerId || null,
      p_job_id: jobId || null,
    });
    if (!rpcErr && Array.isArray(rpcRows) && rpcRows.length > 0) {
      rawList = rpcRows.map((r: any) => ({
        id: r.id,
        job_id: r.job_id,
        worker_id: r.worker_id,
        status: r.status,
        applied_at: r.applied_at,
        notes: r.notes,
        jobs: {
          id: r.job_id,
          title: r.job_title,
          organizer_id: r.job_organizer_id,
          date: r.job_date,
          start_time: r.job_start_time,
          end_time: r.job_end_time,
          hourly_rate: r.job_hourly_rate,
          total_pay: r.job_total_pay,
          slots_total: r.job_slots_total,
          slots_filled: r.job_slots_filled,
        },
        profiles: {
          id: r.worker_id,
          full_name: r.worker_full_name,
          phone: r.worker_phone,
          avatar_url: r.worker_avatar_url,
        },
      }));
    }
  }

  if (error && rawList.length === 0) {
    logger.error('Failed to fetch organizer applications', error);
    throw new Error(`Failed to fetch organizer applications: ${error.message}`);
  }

  const workerIds = Array.from(
    new Set((rawList || []).map((row: any) => row.worker_id).filter(Boolean))
  );
  const workerProfilesMap = new Map<string, any>();
  if (workerIds.length > 0) {
    try {
      const { data: wapData } = await supabase
        .from('worker_applicant_profiles')
        .select('*')
        .in('id', workerIds);
      (wapData || []).forEach((wp: any) => workerProfilesMap.set(wp.id, wp));
    } catch (wapErr) {
      logger.warn('Failed to fetch worker_applicant_profiles view', { wapErr });
    }
  }

  return (rawList || []).map((row: any) => {
    const wap = workerProfilesMap.get(row.worker_id) || {};
    const prof = row.profiles;
    return {
      id: row.id,
      jobId: row.job_id,
      workerId: row.worker_id,
      status: row.status,
      appliedAt: row.applied_at,
      notes: row.notes,
      job: row.jobs ? mapJobRow(row.jobs) : undefined,
      worker: {
        id: row.worker_id,
        preferredLocality: wap.preferred_locality || '',
        serviceAreas: [],
        skills: wap.skills || [],
        experienceYears: wap.experience_years || 0,
        availabilityStatus: 'available',
        profileCompletionStatus: 'completed',
        verificationStatus: wap.verification_status || 'unverified',
        rating: wap.rating != null ? Number(wap.rating) : 0,
        totalReviews: wap.total_reviews || 0,
        shiftsCompleted: wap.shifts_completed || 0,
        createdAt: '',
        updatedAt: '',
        profile: prof
          ? {
              id: prof.id,
              role: 'worker',
              phone: prof.phone || '',
              fullName: prof.full_name || 'Worker',
              avatarUrl: prof.avatar_url,
              city: 'Mumbai',
              isActive: true,
              createdAt: '',
              updatedAt: '',
            }
          : undefined,
      },
    };
  });
}

/**
 * Concurrency-safe Worker Confirmation (Hiring Engine)
 * Enforces headcount capacity, prevents duplicate bookings, creates notifications, and logs audit trail.
 */
export async function confirmWorkerBookingSafe(
  jobId: string,
  workerId: string,
  organizerId: string,
  notes?: string
): Promise<{ success: boolean; booking?: Booking; error?: string }> {
  logger.info('Executing safe worker booking confirmation', { jobId, workerId, organizerId });

  try {
    // Invoke authoritative atomic database transaction
    const { data: rpcData, error: rpcError } = await supabase.rpc('confirm_worker_booking_safe', {
      p_job_id: jobId,
      p_worker_id: workerId,
      p_notes: notes ?? null,
    });

    if (rpcError) {
      logger.error('RPC error in confirm_worker_booking_safe', rpcError);
      return {
        success: false,
        error: rpcError.message || 'Server-side booking confirmation transaction failed.',
      };
    }

    if (rpcData) {
      if (rpcData.success) {
        return {
          success: true,
          booking: rpcData.booking,
        };
      }
      return {
        success: false,
        error: rpcData.message || rpcData.error_code || 'Worker selection could not be confirmed.',
      };
    }

    return {
      success: false,
      error: 'Unexpected empty response from booking confirmation transaction.',
    };
  } catch (err: any) {
    logger.error('Unexpected error confirming worker', err);
    return { success: false, error: err.message };
  }
}

/**
 * Shortlist or Reject an applicant
 */
export async function updateApplicationStatusSafe(
  applicationId: string,
  newStatus: 'shortlisted' | 'rejected',
  organizerId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    logger.info('Updating application status safe', { applicationId, newStatus, organizerId });
    const { data: rpcData, error: rpcError } = await supabase.rpc('update_application_status_safe', {
      p_application_id: applicationId,
      p_new_status: newStatus,
    });

    if (rpcError) {
      logger.error('RPC error in update_application_status_safe', rpcError);
      return { success: false, error: rpcError.message || 'Server error updating application status.' };
    }

    if (rpcData) {
      return { success: rpcData.success, error: rpcData.message };
    }

    return { success: false, error: 'Empty response updating application status.' };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Fetch aggregate metrics for organizer dashboard
 */
export async function fetchOrganizerMetrics(organizerId: string): Promise<OrganizerMetrics> {
  try {
    const [jobsRes, applicationsRes, bookingsRes] = await Promise.all([
      supabase.from('jobs').select('status, slots_total, slots_filled, date, total_pay').eq('organizer_id', organizerId),
      supabase.from('job_applications').select('status, jobs!inner(organizer_id)').eq('jobs.organizer_id', organizerId),
      supabase.from('bookings').select('status, agreed_total_pay').eq('organizer_id', organizerId),
    ]);

    const jobs = jobsRes.data || [];
    const applications = applicationsRes.data || [];
    const bookings = bookingsRes.data || [];

    const todayStr = new Date().toISOString().split('T')[0];

    const activeJobs = jobs.filter((j: any) => ['open', 'filling'].includes(j.status)).length;
    const openPositions = jobs
      .filter((j: any) => ['open', 'filling'].includes(j.status))
      .reduce((acc: number, j: any) => acc + Math.max(0, j.slots_total - j.slots_filled), 0);
    const newApplications = applications.filter((a: any) => a.status === 'applied').length;
    const shortlistedApplicants = applications.filter((a: any) => a.status === 'shortlisted').length;
    const confirmedWorkers = bookings.filter((b: any) => ['confirmed', 'checked_in', 'completed'].includes(b.status)).length;
    const upcomingEvents = jobs.filter((j: any) => j.date >= todayStr).length;
    const completedShifts = jobs.filter((j: any) => j.status === 'completed').length;
    const totalStaffingSpend = bookings.reduce((acc: number, b: any) => acc + Number(b.agreed_total_pay || 0), 0);

    return {
      activeJobs,
      openPositions,
      newApplications,
      shortlistedApplicants,
      confirmedWorkers,
      upcomingEvents,
      completedShifts,
      totalStaffingSpend,
    };
  } catch (err: any) {
    logger.error('Failed to fetch organizer metrics', err);
    return {
      activeJobs: 0,
      openPositions: 0,
      newApplications: 0,
      shortlistedApplicants: 0,
      confirmedWorkers: 0,
      upcomingEvents: 0,
      completedShifts: 0,
      totalStaffingSpend: 0,
    };
  }
}

/**
 * ============================================================================
 * PHASE 5 — BOOKING & ATTENDANCE ENGINE SERVICES
 * ============================================================================
 */

function mapBookingRow(row: any): Booking {
  return {
    id: row.id,
    jobId: row.job_id,
    workerId: row.worker_id,
    organizerId: row.organizer_id,
    status: row.status,
    agreedHourlyRate: Number(row.agreed_hourly_rate),
    agreedTotalPay: Number(row.agreed_total_pay),
    checkInCode: row.check_in_code || `OP-${row.id.slice(0, 4).toUpperCase()}`,
    checkInTime: row.check_in_time,
    checkOutTime: row.check_out_time,
    cancellationReason: row.cancellation_reason,
    cancelledBy: row.cancelled_by,
    noShowReason: row.no_show_reason,
    disputeReason: row.dispute_reason,
    confirmedAt: row.confirmed_at,
    completedAt: row.completed_at,
    job: row.jobs ? mapJobRow(row.jobs) : undefined,
    worker: row.worker_profiles
      ? {
          id: row.worker_profiles.id,
          preferredLocality: row.worker_profiles.preferred_locality,
          serviceAreas: [],
          skills: row.worker_profiles.skills || [],
          experienceYears: row.worker_profiles.experience_years || 0,
          availabilityStatus: 'available',
          profileCompletionStatus: 'completed',
          verificationStatus: row.worker_profiles.verification_status || 'unverified',
          rating: row.worker_profiles.rating != null ? Number(row.worker_profiles.rating) : 0,
          totalReviews: row.worker_profiles.total_reviews || 0,
          shiftsCompleted: row.worker_profiles.shifts_completed || 0,
          createdAt: '',
          updatedAt: '',
          profile: row.worker_profiles.profiles
            ? {
                id: row.worker_profiles.profiles.id,
                role: 'worker',
                phone: row.worker_profiles.profiles.phone,
                fullName: row.worker_profiles.profiles.full_name,
                avatarUrl: row.worker_profiles.profiles.avatar_url,
                city: 'Mumbai',
                isActive: true,
                createdAt: '',
                updatedAt: '',
              }
            : undefined,
        }
      : undefined,
  };
}

/**
 * Fetch all bookings for a worker (upcoming, active, completed, cancelled)
 */
export async function fetchWorkerBookings(workerId: string): Promise<Booking[]> {
  const { data, error } = await supabase
    .from('bookings')
    .select('*, jobs(*)')
    .eq('worker_id', workerId)
    .order('confirmed_at', { ascending: false });

  if (error) {
    logger.error('Failed to fetch worker bookings', error, { workerId });
    throw new Error(`Failed to fetch worker bookings: ${error.message}`);
  }

  const rawJobs = (data || []).map((r: any) => r.jobs).filter(Boolean);
  const enrichedJobs = await enrichJobsWithOrganizerCards(rawJobs);
  const jobsById = new Map<string, Job>();
  enrichedJobs.forEach((j) => jobsById.set(j.id, j));

  return (data || []).map((row: any) => {
    const b = mapBookingRow(row);
    if (row.jobs && jobsById.has(row.jobs.id)) {
      b.job = jobsById.get(row.jobs.id);
    }
    return b;
  });
}

/**
 * Fetch all confirmed bookings for a specific shift with safe worker applicant profile projection
 */
export async function fetchJobBookings(jobId: string): Promise<Booking[]> {
  const { data, error } = await supabase
    .from('bookings')
    .select(`
      *,
      profiles:worker_id (
        id,
        full_name,
        phone,
        avatar_url
      )
    `)
    .eq('job_id', jobId)
    .order('confirmed_at', { ascending: false });

  if (error) {
    logger.error('Failed to fetch job bookings', error, { jobId });
    return [];
  }

  const workerIds = Array.from(
    new Set((data || []).map((row: any) => row.worker_id).filter(Boolean))
  );
  const workerProfilesMap = new Map<string, any>();
  if (workerIds.length > 0) {
    try {
      const { data: wapData } = await supabase
        .from('worker_applicant_profiles')
        .select('*')
        .in('id', workerIds);
      (wapData || []).forEach((wp: any) => workerProfilesMap.set(wp.id, wp));
    } catch (wapErr) {
      logger.warn('Failed to fetch worker_applicant_profiles view for bookings', { wapErr });
    }
  }

  return (data || []).map((row: any) => {
    const wap = workerProfilesMap.get(row.worker_id) || {};
    const prof = row.profiles;
    const b = mapBookingRow(row);
    b.worker = {
      id: row.worker_id,
      preferredLocality: wap.preferred_locality || '',
      serviceAreas: [],
      skills: wap.skills || [],
      experienceYears: wap.experience_years || 0,
      availabilityStatus: 'available',
      profileCompletionStatus: 'completed',
      verificationStatus: wap.verification_status || 'unverified',
      rating: wap.rating != null ? Number(wap.rating) : 0,
      totalReviews: wap.total_reviews || 0,
      shiftsCompleted: wap.shifts_completed || 0,
      createdAt: '',
      updatedAt: '',
      profile: prof
        ? {
            id: prof.id,
            role: 'worker',
            phone: prof.phone || '',
            fullName: prof.full_name || 'Worker',
            avatarUrl: prof.avatar_url,
            city: 'Mumbai',
            isActive: true,
            createdAt: '',
            updatedAt: '',
          }
        : undefined,
    };
    return b;
  });
}

/**
 * Check-in worker on-site (auditable venue token / supervisor verification)
 */
export async function checkInWorkerSafe(
  bookingId: string,
  code: string,
  lat?: number,
  lng?: number
): Promise<{ success: boolean; status?: string; distanceKm?: number; error?: string; errorCode?: string }> {
  logger.info('Executing check-in for booking', { bookingId, code, lat, lng });

  try {
    const { data: rpcData, error: rpcError } = await supabase.rpc('check_in_worker_safe', {
      p_booking_id: bookingId,
      p_code: code,
      p_lat: lat ?? null,
      p_lng: lng ?? null,
    });

    if (!rpcError && rpcData) {
      if (rpcData.success) {
        return {
          success: true,
          status: rpcData.status,
          distanceKm: rpcData.distance_km,
        };
      }
      return {
        success: false,
        errorCode: rpcData.error_code,
        error: rpcData.error_code && rpcData.message
          ? `[${rpcData.error_code}] ${rpcData.message}`
          : (rpcData.message || rpcData.error_code),
      };
    }

    logger.error('RPC error in check_in_worker_safe — failing closed', rpcError);
    return {
      success: false,
      error: rpcError?.message || 'Server-side attendance verification check failed.',
    };
  } catch (err: any) {
    logger.error('Unexpected exception during check-in', err);
    return { success: false, error: err.message };
  }
}

/**
 * Check-out worker from shift
 */
export async function checkOutWorkerSafe(
  bookingId: string,
  notes?: string
): Promise<{ success: boolean; status?: string; hoursWorked?: number; error?: string }> {
  try {
    const { data: rpcData, error: rpcError } = await supabase.rpc('check_out_worker_safe', {
      p_booking_id: bookingId,
      p_notes: notes ?? null,
    });

    if (!rpcError && rpcData) {
      if (rpcData.success) {
        return {
          success: true,
          status: rpcData.status,
          hoursWorked: rpcData.hours_worked,
        };
      }
      return { success: false, error: rpcData.message || rpcData.error_code };
    }

    logger.error('RPC error in check_out_worker_safe — failing closed', rpcError);
    return {
      success: false,
      error: rpcError?.message || 'Server-side check-out transaction failed.',
    };
  } catch (err: any) {
    logger.error('Unexpected exception during check-out', err);
    return { success: false, error: err.message };
  }
}

/**
 * Complete shift & approve attendance
 */
export async function completeShiftAndApproveAttendance(
  bookingId: string,
  verifiedHours?: number
): Promise<{ success: boolean; error?: string }> {
  try {
    const { data: rpcData, error: rpcError } = await supabase.rpc(
      'complete_shift_and_approve_attendance',
      {
        p_booking_id: bookingId,
        p_verified_hours: verifiedHours ?? null,
      }
    );

    if (!rpcError && rpcData) {
      return { success: rpcData.success, error: rpcData.message || rpcData.error_code };
    }

    logger.error('RPC error in complete_shift_and_approve_attendance — failing closed', rpcError);
    return {
      success: false,
      error: rpcError?.message || 'Server-side attendance approval and shift completion failed.',
    };
  } catch (err: any) {
    logger.error('Unexpected exception completing shift', err);
    return { success: false, error: err.message };
  }
}

/**
 * Cancel booking (worker or organizer initiated, triggers replacement workflow)
 */
export async function cancelBookingSafe(
  bookingId: string,
  reason: string,
  userId?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { data: rpcData, error: rpcError } = await supabase.rpc('cancel_booking_safe', {
      p_booking_id: bookingId,
      p_reason: reason,
      p_user_id: userId ?? null,
    });

    if (!rpcError && rpcData) {
      return { success: rpcData.success, error: rpcData.message || rpcData.error_code };
    }

    logger.error('RPC error in cancel_booking_safe — failing closed', rpcError);
    return {
      success: false,
      error: rpcError?.message || 'Server-side booking cancellation failed.',
    };
  } catch (err: any) {
    logger.error('Unexpected exception cancelling booking', err);
    return { success: false, error: err.message };
  }
}

/**
 * Record no-show (reviewable process)
 */
export async function recordNoShowSafe(
  bookingId: string,
  reason: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { data: rpcData, error: rpcError } = await supabase.rpc('record_no_show_safe', {
      p_booking_id: bookingId,
      p_reason: reason,
    });

    if (!rpcError && rpcData) {
      return { success: rpcData.success, error: rpcData.message || rpcData.error_code };
    }

    logger.error('RPC error in record_no_show_safe — failing closed', rpcError);
    return {
      success: false,
      error: rpcError?.message || 'Server-side record no-show failed.',
    };
  } catch (err: any) {
    logger.error('Unexpected exception recording no-show', err);
    return { success: false, error: err.message };
  }
}

/**
 * Dispute booking record (creates admin dispute case)
 */
export async function disputeBookingSafe(
  bookingId: string,
  reason: string,
  evidence?: string
): Promise<{ success: boolean; disputeId?: string; error?: string }> {
  try {
    const { data: rpcData, error: rpcError } = await supabase.rpc('dispute_booking_safe', {
      p_booking_id: bookingId,
      p_reason: reason,
      p_evidence: evidence ?? null,
    });

    if (!rpcError && rpcData) {
      return {
        success: rpcData.success,
        disputeId: rpcData.dispute_id,
        error: rpcData.message || rpcData.error_code,
      };
    }

    logger.error('RPC error in dispute_booking_safe — failing closed', rpcError);
    return {
      success: false,
      error: rpcError?.message || 'Server-side dispute registration failed.',
    };
  } catch (err: any) {
    logger.error('Unexpected exception creating dispute', err);
    return { success: false, error: err.message };
  }
}

/**
 * Check if a worker has already applied or is booked for a specific shift
 */
export async function fetchWorkerJobStatus(
  jobId: string,
  workerId: string
): Promise<{ hasApplied: boolean; isBooked: boolean; applicationStatus?: string; bookingStatus?: string }> {
  try {
    const [appRes, bookRes] = await Promise.all([
      supabase
        .from('job_applications')
        .select('status')
        .eq('job_id', jobId)
        .eq('worker_id', workerId)
        .maybeSingle(),
      supabase
        .from('bookings')
        .select('status')
        .eq('job_id', jobId)
        .eq('worker_id', workerId)
        .maybeSingle(),
    ]);

    return {
      hasApplied: !!appRes.data,
      isBooked: !!bookRes.data,
      applicationStatus: appRes.data?.status,
      bookingStatus: bookRes.data?.status,
    };
  } catch (err) {
    logger.error('Failed to query worker job status', err, { jobId, workerId });
    return { hasApplied: false, isBooked: false };
  }
}

export async function getJobContact(jobId: string): Promise<{
  success: boolean;
  supervisorName?: string;
  supervisorPhone?: string;
  errorCode?: string;
  message?: string;
}> {
  try {
    const { data, error } = await supabase.rpc('get_job_contact', { p_job_id: jobId });
    if (error) {
      logger.error('RPC error in get_job_contact', error);
      return { success: false, errorCode: error.code, message: error.message };
    }
    return {
      success: data?.success || false,
      supervisorName: data?.supervisor_name,
      supervisorPhone: data?.supervisor_phone,
      errorCode: data?.error_code,
      message: data?.message,
    };
  } catch (err: any) {
    logger.error('Unexpected error fetching job contact', err);
    return { success: false, errorCode: 'NETWORK_ERROR', message: err?.message || 'Network error' };
  }
}

/**
 * Authoritative Application Withdrawal RPC
 * Enforces worker ownership and 2-hour pre-shift cutoff window.
 */
export async function withdrawJobApplicationSafe(
  applicationId: string,
  reason?: string
): Promise<{ success: boolean; errorCode?: string; message?: string }> {
  try {
    const { data, error } = await supabase.rpc('withdraw_job_application_safe', {
      p_application_id: applicationId,
      p_reason: reason ?? null,
    });

    if (error) {
      logger.error('RPC error in withdraw_job_application_safe', error);
      return { success: false, errorCode: error.code || 'TRANSACTION_ERROR', message: error.message };
    }

    return {
      success: data?.success || false,
      errorCode: data?.error_code,
      message: data?.message,
    };
  } catch (err: any) {
    logger.error('Unexpected error withdrawing job application', err);
    return { success: false, errorCode: 'NETWORK_ERROR', message: err?.message || 'Network error' };
  }
}

/**
 * Authoritative Shift Editing RPC
 * Prevents reducing capacity below confirmed workers, altering date/times, or reducing wages.
 */
export async function editJobSafe(
  jobId: string,
  jobUpdates: Record<string, any>
): Promise<{ success: boolean; jobId?: string; errorCode?: string; message?: string }> {
  try {
    const { data, error } = await supabase.rpc('edit_job_safe', {
      p_job_id: jobId,
      p_job: jobUpdates,
    });

    if (error) {
      logger.error('RPC error in edit_job_safe', error);
      return { success: false, errorCode: error.code || 'TRANSACTION_ERROR', message: error.message };
    }

    return {
      success: data?.success || false,
      jobId: data?.job_id,
      errorCode: data?.error_code,
      message: data?.message,
    };
  } catch (err: any) {
    logger.error('Unexpected error editing job', err);
    return { success: false, errorCode: 'NETWORK_ERROR', message: err?.message || 'Network error' };
  }
}

/**
 * Keyset-paginated Discovery Feed RPC
 * Excludes ineligible, past, applied, and passed shifts with composable SQL filters.
 */
export async function getDiscoveryFeedRpc(
  filters: Record<string, any> = {},
  limit: number = 20,
  cursor: Record<string, any> | null = null
): Promise<{ success: boolean; jobs: Job[]; error?: string }> {
  try {
    const { data, error } = await supabase.rpc('get_discovery_feed', {
      p_filters: filters,
      p_limit: limit,
      p_cursor: cursor,
    });

    if (error) {
      logger.error('RPC error in get_discovery_feed', error);
      return { success: false, jobs: [], error: error.message };
    }

    const mappedJobs = (data || []).map((row: any) => mapJobRow(row));
    return { success: true, jobs: mappedJobs };
  } catch (err: any) {
    logger.error('Unexpected error calling get_discovery_feed', err);
    return { success: false, jobs: [], error: err?.message || 'Network error' };
  }
}

