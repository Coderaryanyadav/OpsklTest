import { supabase } from './client';
import {
  AdminOverviewMetrics,
  VerificationCase,
  Dispute,
  SafetyReport,
  AuditLog,
  PlatformSetting,
  Job,
} from '../types';
import { logger } from '../utils/logger';

/**
 * Fetch platform overview metrics for admin dashboard
 */
export async function fetchAdminDashboardMetrics(): Promise<AdminOverviewMetrics> {
  logger.info('Fetching admin overview metrics');

  try {
    const [
      shiftsRes,
      workersRes,
      organizersRes,
      verificationsRes,
      disputesRes,
      safetyRes,
      paymentsRes,
    ] = await Promise.all([
      supabase.from('jobs').select('*', { count: 'exact', head: true }).in('status', ['open', 'filling']),
      supabase.from('worker_profiles').select('*', { count: 'exact', head: true }).eq('is_aadhaar_verified', true),
      supabase.from('organizer_profiles').select('*', { count: 'exact', head: true }).eq('is_gstin_verified', true),
      supabase.from('verification_cases').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('disputes').select('*', { count: 'exact', head: true }).in('status', ['open', 'under_review']),
      supabase.from('safety_reports').select('*', { count: 'exact', head: true }).in('severity', ['high', 'critical']).eq('status', 'open'),
      supabase.from('payment_records').select('amount, platform_fee').in('status', ['processing', 'settled']),
    ]);

    if (shiftsRes.error) logger.error('Failed to query active shifts count', shiftsRes.error);
    if (workersRes.error) logger.error('Failed to query verified workers count', workersRes.error);
    if (organizersRes.error) logger.error('Failed to query active organizers count', organizersRes.error);
    if (verificationsRes.error) logger.error('Failed to query verification queue count', verificationsRes.error);
    if (disputesRes.error) logger.error('Failed to query disputes count', disputesRes.error);
    if (safetyRes.error) logger.error('Failed to query safety reports count', safetyRes.error);

    let totalEscrow = 0;
    let platformFees = 0;
    if (paymentsRes && paymentsRes.data && Array.isArray(paymentsRes.data)) {
      for (const p of paymentsRes.data) {
        totalEscrow += Number(p.amount) || 0;
        platformFees += Number(p.platform_fee) || 0;
      }
    }

    return {
      activeShifts: shiftsRes.count ?? 0,
      totalEscrowHeld: Math.round(totalEscrow),
      verifiedWorkersCount: workersRes.count ?? 0,
      activeOrganizersCount: organizersRes.count ?? 0,
      platformFeesCollected: Math.round(platformFees),
      pendingVerificationsCount: verificationsRes.count ?? 0,
      openDisputesCount: disputesRes.count ?? 0,
      criticalSafetyReportsCount: safetyRes.count ?? 0,
    };
  } catch (err: any) {
    logger.error('Failed to fetch admin overview metrics', err);
    return {
      activeShifts: 0,
      totalEscrowHeld: 0,
      verifiedWorkersCount: 0,
      activeOrganizersCount: 0,
      platformFeesCollected: 0,
      pendingVerificationsCount: 0,
      openDisputesCount: 0,
      criticalSafetyReportsCount: 0,
    };
  }
}

/**
 * Fetch pending KYC and business verification cases
 */
export async function fetchVerificationQueue(): Promise<VerificationCase[]> {
  logger.info('Fetching verification queue');

  const { data, error } = await supabase
    .from('verification_cases')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    logger.error('Failed to fetch verification queue', error);
    return [];
  }

  return (data || []).map((d: any) => ({
    id: d.id,
    profileId: d.profile_id,
    documentType: d.document_type,
    documentMaskedId: d.document_masked_id,
    documentStoragePath: d.document_storage_path,
    status: d.status,
    rejectionReason: d.rejection_reason,
    reviewedBy: d.reviewed_by,
    reviewedAt: d.reviewed_at,
    createdAt: d.created_at,
  }));
}

/**
 * Resolve verification case (Approve or Reject with mandatory reason)
 */
export async function resolveVerificationCaseSafe(
  caseId: string,
  status: 'approved' | 'rejected',
  rejectionReason?: string,
  adminId?: string
): Promise<{ success: boolean; error?: string }> {
  logger.info('Resolving verification case', { caseId, status });

  try {
    const { data, error } = await supabase.rpc('admin_verify_case_safe', {
      p_case_id: caseId,
      p_status: status,
      p_rejection_reason: rejectionReason ?? null,
      p_admin_id: adminId ?? null,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: data?.success ?? true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Fetch disputes queue
 */
export async function fetchDisputesQueue(): Promise<Dispute[]> {
  logger.info('Fetching disputes queue');

  const { data, error } = await supabase
    .from('disputes')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    logger.error('Failed to fetch disputes queue', error);
    return [];
  }

  return (data || []).map((d: any) => ({
    id: d.id,
    bookingId: d.booking_id,
    raisedBy: d.raised_by,
    respondentId: d.respondent_id,
    reason: d.reason,
    details: d.details,
    status: d.status,
    resolutionNotes: d.resolution_notes,
    resolvedBy: d.resolved_by,
    resolvedAt: d.resolved_at,
    createdAt: d.created_at,
  }));
}

/**
 * Adjudicate Dispute (Adjust hours / release escrow / dismiss)
 */
export async function resolveDisputeSafe(
  disputeId: string,
  status: 'resolved' | 'dismissed',
  resolutionNotes: string,
  adjustedPayout?: number,
  adminId?: string
): Promise<{ success: boolean; error?: string }> {
  logger.info('Resolving dispute', { disputeId, status, adjustedPayout });

  try {
    const { data, error } = await supabase.rpc('admin_resolve_dispute_safe', {
      p_dispute_id: disputeId,
      p_status: status,
      p_resolution_notes: resolutionNotes,
      p_adjusted_payout: adjustedPayout ?? null,
      p_admin_id: adminId ?? null,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: data?.success ?? true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Fetch Trust & Safety Incident Reports
 */
export async function fetchSafetyReportsQueue(): Promise<SafetyReport[]> {
  logger.info('Fetching safety reports queue');

  const { data, error } = await supabase
    .from('safety_reports')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    logger.error('Failed to fetch safety reports queue', error);
    return [];
  }

  return (data || []).map((r: any) => ({
    id: r.id,
    reporterId: r.reporter_id,
    reportedId: r.reported_id,
    jobId: r.job_id,
    category: r.category,
    severity: r.severity,
    description: r.description,
    evidenceUrls: r.evidence_urls,
    status: r.status,
    staffNotes: r.staff_notes,
    actionTaken: r.action_taken,
    resolvedBy: r.resolved_by,
    resolvedAt: r.resolved_at,
    createdAt: r.created_at,
  }));
}

/**
 * Resolve Safety Report with Staff Decision & Audit
 */
export async function resolveSafetyReportSafe(
  reportId: string,
  status: 'resolved' | 'dismissed' | 'escalated',
  actionTaken: string,
  staffNotes: string,
  adminId?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { data, error } = await supabase.rpc('admin_resolve_safety_report_safe', {
      p_report_id: reportId,
      p_status: status,
      p_action_taken: actionTaken,
      p_staff_notes: staffNotes,
      p_admin_id: adminId ?? null,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: data?.success ?? true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Fetch Jobs for Moderation
 */
export async function fetchModerationJobs(): Promise<Job[]> {
  const { data, error } = await supabase
    .from('jobs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) {
    logger.error('Failed to fetch moderation jobs', error);
    return [];
  }

  return (data || []).map((j: any) => ({
    id: j.id,
    organizerId: j.organizer_id,
    title: j.title,
    category: j.category,
    venueName: j.venue_name || 'Exhibition Venue',
    venueAddress: j.venue_address || 'Mumbai, Maharashtra',
    city: j.city || 'Mumbai',
    zone: j.zone || j.locality || 'BKC',
    date: j.event_date || j.date || new Date().toISOString().split('T')[0],
    startTime: j.shift_start_time || j.start_time || '09:00',
    endTime: j.shift_end_time || j.end_time || '18:00',
    durationHours: Number(j.duration_hours) || 8,
    hourlyRate: Number(j.hourly_rate) || 150,
    totalPay: Number(j.wage_per_worker || j.total_pay) || 1200,
    slotsTotal: j.slots_total,
    slotsFilled: j.slots_filled,
    status: j.status,
    duties: j.duties || [],
    supervisorName: j.supervisor_name || 'Ops Supervisor',
    supervisorPhone: j.supervisor_phone || '+91 98201 98201',
    createdAt: j.created_at,
    updatedAt: j.updated_at || j.created_at,
  }));
}

/**
 * Moderate Job (Approve, Pause, Cancel with reason)
 */
export async function moderateJobSafe(
  jobId: string,
  newStatus: 'open' | 'paused' | 'cancelled',
  moderationReason: string,
  adminId?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { data, error } = await supabase.rpc('admin_moderate_job_safe', {
      p_job_id: jobId,
      p_new_status: newStatus,
      p_moderation_reason: moderationReason,
      p_admin_id: adminId ?? null,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: data?.success ?? true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Fetch Immutable Audit Logs
 */
export async function fetchAuditLogs(limit: number = 50): Promise<AuditLog[]> {
  const { data, error } = await supabase
    .from('audit_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    logger.error('Failed to fetch audit logs', error);
    return [];
  }

  return (data || []).map((a: any) => ({
    id: a.id,
    actorId: a.actor_id,
    action: a.action,
    entityType: a.entity_type,
    entityId: a.entity_id,
    changes: a.changes,
    ipAddress: a.ip_address,
    createdAt: a.created_at,
  }));
}

/**
 * Fetch System Configuration Settings
 */
export async function fetchPlatformSettings(): Promise<PlatformSetting[]> {
  const { data, error } = await supabase
    .from('platform_settings')
    .select('*');

  if (error) {
    logger.error('Failed to fetch platform settings', error);
    return [];
  }

  return (data || []).map((s: any) => ({
    key: s.key,
    value: s.value,
    description: s.description,
    updatedBy: s.updated_by,
    updatedAt: s.updated_at,
  }));
}
