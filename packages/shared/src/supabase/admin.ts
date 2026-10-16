import { getSharedSupabaseClient } from './client';
import { SupabaseClient } from '@supabase/supabase-js';
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

const getClient = (): SupabaseClient => getSharedSupabaseClient();

/**
 * Fetch platform overview metrics for admin dashboard
 */
export async function fetchAdminDashboardMetrics(): Promise<AdminOverviewMetrics> {
  logger.info('Fetching admin overview metrics');

  try {
    const client = getClient();
    const [
      shiftsRes,
      workersRes,
      organizersRes,
      verificationsRes,
      disputesRes,
      safetyRes,
      paymentsRes,
    ] = await Promise.all([
      client.from('jobs').select('*', { count: 'exact', head: true }).in('status', ['open', 'filling']),
      client.from('worker_profiles').select('*', { count: 'exact', head: true }).or('verification_status.eq.verified,is_aadhaar_verified.eq.true'),
      client.from('organizer_profiles').select('*', { count: 'exact', head: true }).or('verification_status.eq.verified,is_gstin_verified.eq.true'),
      client.from('verification_cases').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      client.from('disputes').select('*', { count: 'exact', head: true }).in('status', ['open', 'under_review']),
      client.from('safety_reports').select('*', { count: 'exact', head: true }).in('severity', ['high', 'critical']).eq('status', 'open'),
      client.from('payment_records').select('amount, platform_fee, status'),
    ]);

    const hasQueryErrors = Boolean(
      shiftsRes.error || workersRes.error || organizersRes.error ||
      verificationsRes.error || disputesRes.error || safetyRes.error || paymentsRes.error
    );

    if (shiftsRes.error) logger.error('Failed to query active shifts count', shiftsRes.error);
    if (workersRes.error) logger.error('Failed to query verified workers count', workersRes.error);
    if (organizersRes.error) logger.error('Failed to query active organizers count', organizersRes.error);
    if (verificationsRes.error) logger.error('Failed to query verification queue count', verificationsRes.error);
    if (disputesRes.error) logger.error('Failed to query disputes count', disputesRes.error);
    if (safetyRes.error) logger.error('Failed to query safety reports count', safetyRes.error);
    if (paymentsRes.error) logger.error('Failed to query payment records', paymentsRes.error);

    let totalEscrowHeld = 0;
    let settledPayouts = 0;
    let platformFees = 0;
    if (paymentsRes && paymentsRes.data && Array.isArray(paymentsRes.data)) {
      for (const p of paymentsRes.data) {
        if (p.status === 'pending') {
          totalEscrowHeld += Number(p.amount) || 0;
        } else if (p.status === 'settled') {
          settledPayouts += Number(p.amount) || 0;
          platformFees += Number(p.platform_fee) || 0;
        }
      }
    }

    return {
      activeShifts: shiftsRes.count ?? 0,
      totalEscrowHeld: Math.round(totalEscrowHeld),
      settledPayoutsTotal: Math.round(settledPayouts),
      verifiedWorkersCount: workersRes.count ?? 0,
      activeOrganizersCount: organizersRes.count ?? 0,
      platformFeesCollected: Math.round(platformFees),
      pendingVerificationsCount: verificationsRes.count ?? 0,
      openDisputesCount: disputesRes.count ?? 0,
      criticalSafetyReportsCount: safetyRes.count ?? 0,
      hasQueryErrors,
    };
  } catch (err: any) {
    logger.error('Failed to fetch admin overview metrics', err);
    return {
      activeShifts: 0,
      totalEscrowHeld: 0,
      settledPayoutsTotal: 0,
      verifiedWorkersCount: 0,
      activeOrganizersCount: 0,
      platformFeesCollected: 0,
      pendingVerificationsCount: 0,
      openDisputesCount: 0,
      criticalSafetyReportsCount: 0,
      hasQueryErrors: true,
    };
  }
}

/**
 * Fetch pending KYC and business verification cases
 */
export async function fetchVerificationQueue(): Promise<VerificationCase[]> {
  logger.info('Fetching verification queue');

  const { data, error } = await getClient()
    .from('verification_cases')
    .select('*, profiles!verification_cases_profile_id_fkey(full_name, email, role, phone)')
    .order('created_at', { ascending: false });

  if (error) {
    logger.error('Failed to fetch verification queue', error);
    throw new Error(`Failed to fetch verification queue: ${error.message}`);
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
    applicantProfile: d.profiles
      ? {
          fullName: d.profiles.full_name,
          email: d.profiles.email,
          role: d.profiles.role,
          phone: d.profiles.phone,
        }
      : undefined,
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
    const { data, error } = await getClient().rpc('admin_verify_case_safe', {
      p_case_id: caseId,
      p_status: status,
      p_rejection_reason: rejectionReason ?? null,
      p_admin_id: adminId ?? null,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    if (data && data.success === false) {
      return { success: false, error: data.error || 'Verification resolution failed' };
    }

    return { success: Boolean(data?.success ?? true) };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Generates an expiring signed URL to securely inspect verification evidence documents.
 */
export async function getVerificationDocumentSignedUrl(
  storagePath: string,
  expiresInSeconds: number = 300
): Promise<{ signedUrl: string | null; error?: string }> {
  try {
    if (!storagePath) return { signedUrl: null, error: 'No storage path provided' };
    const { data, error } = await getClient().storage
      .from('verification-documents')
      .createSignedUrl(storagePath, expiresInSeconds);

    if (error) {
      logger.error('Failed to generate signed document URL', error, { storagePath });
      return { signedUrl: null, error: error.message };
    }

    return { signedUrl: data?.signedUrl || null };
  } catch (err: any) {
    logger.error('Exception in getVerificationDocumentSignedUrl', err);
    return { signedUrl: null, error: err.message };
  }
}

/**
 * Fetch disputes queue
 */
export async function fetchDisputesQueue(): Promise<Dispute[]> {
  logger.info('Fetching disputes queue');

  const { data, error } = await getClient()
    .from('disputes')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    logger.error('Failed to fetch disputes queue', error);
    throw new Error(`Failed to fetch disputes queue: ${error.message}`);
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
    const { data, error } = await getClient().rpc('admin_resolve_dispute_safe', {
      p_dispute_id: disputeId,
      p_status: status,
      p_resolution_notes: resolutionNotes,
      p_adjusted_payout: adjustedPayout ?? null,
      p_admin_id: adminId ?? null,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    if (data && data.success === false) {
      return { success: false, error: data.error || 'Dispute resolution failed' };
    }

    return { success: Boolean(data?.success ?? true) };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Submit an authenticated safety or SOS incident report
 */
export async function createSafetyReportSafe(report: {
  reporterId: string;
  reportedId?: string;
  jobId?: string;
  category: 'safety' | 'harassment' | 'wage_theft' | 'unsafe_conditions' | 'fraud' | 'other';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  evidenceUrls?: string[];
}): Promise<{ success: boolean; reportId?: string; error?: string }> {
  logger.warn('Submitting safety report incident', { reporterId: report.reporterId, category: report.category, severity: report.severity });

  try {
    const { data, error } = await getClient()
      .from('safety_reports')
      .insert({
        reporter_id: report.reporterId,
        reported_id: report.reportedId || null,
        job_id: report.jobId || null,
        category: report.category,
        severity: report.severity,
        description: report.description,
        evidence_urls: report.evidenceUrls || [],
        status: 'open',
      })
      .select('id')
      .single();

    if (error) {
      logger.error('Failed to insert safety report', error);
      return { success: false, error: error.message };
    }

    return { success: true, reportId: data?.id };
  } catch (err: any) {
    logger.error('Exception in createSafetyReportSafe', err);
    return { success: false, error: err.message };
  }
}

/**
 * Fetch Trust & Safety Incident Reports
 */
export async function fetchSafetyReportsQueue(): Promise<SafetyReport[]> {
  logger.info('Fetching safety reports queue');

  const { data, error } = await getClient()
    .from('safety_reports')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    logger.error('Failed to fetch safety reports queue', error);
    throw new Error(`Failed to fetch safety reports queue: ${error.message}`);
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
    const { data, error } = await getClient().rpc('admin_resolve_safety_report_safe', {
      p_report_id: reportId,
      p_status: status,
      p_action_taken: actionTaken,
      p_staff_notes: staffNotes,
      p_admin_id: adminId ?? null,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    if (data && data.success === false) {
      return { success: false, error: data.error || 'Safety report resolution failed' };
    }

    return { success: Boolean(data?.success ?? true) };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Fetch Jobs for Moderation
 */
export async function fetchModerationJobs(): Promise<Job[]> {
  const { data, error } = await getClient()
    .from('jobs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) {
    logger.error('Failed to fetch moderation jobs', error);
    throw new Error(`Failed to fetch moderation jobs: ${error.message}`);
  }

  return (data || []).map((j: any) => ({
    id: j.id,
    organizerId: j.organizer_id,
    title: j.title,
    category: j.category,
    venueName: j.venue_name || '',
    venueAddress: j.venue_address || '',
    city: j.city || '',
    zone: j.zone || j.locality || '',
    date: j.event_date || j.date || '',
    startTime: j.shift_start_time || j.start_time || '',
    endTime: j.shift_end_time || j.end_time || '',
    durationHours: Number(j.duration_hours) || 0,
    hourlyRate: Number(j.hourly_rate) || 0,
    totalPay: Number(j.wage_per_worker || j.total_pay) || 0,
    slotsTotal: j.slots_total || 0,
    slotsFilled: j.slots_filled || 0,
    status: j.status,
    duties: j.duties || [],
    supervisorName: j.supervisor_name || '',
    supervisorPhone: j.supervisor_phone || '',
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
    const { data, error } = await getClient().rpc('admin_moderate_job_safe', {
      p_job_id: jobId,
      p_new_status: newStatus,
      p_moderation_reason: moderationReason,
      p_admin_id: adminId ?? null,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    if (data && data.success === false) {
      return { success: false, error: data.error || 'Job moderation failed' };
    }

    return { success: Boolean(data?.success ?? true) };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Fetch Immutable Audit Logs
 */
export async function fetchAuditLogs(limit: number = 50): Promise<AuditLog[]> {
  const { data, error } = await getClient()
    .from('audit_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    logger.error('Failed to fetch audit logs', error);
    throw new Error(`Failed to fetch audit logs: ${error.message}`);
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
  const { data, error } = await getClient()
    .from('platform_settings')
    .select('*');

  if (error) {
    logger.error('Failed to fetch platform settings', error);
    throw new Error(`Failed to fetch platform settings: ${error.message}`);
  }

  return (data || []).map((s: any) => ({
    key: s.key,
    value: s.value,
    description: s.description,
    updatedBy: s.updated_by,
    updatedAt: s.updated_at,
  }));
}

/**
 * Securely fetch admin overview metrics using the server-side authorized RPC
 */
export async function fetchAdminOverviewMetricsSafe(): Promise<AdminOverviewMetrics | null> {
  try {
    const client = getClient();
    const { data, error } = await client.rpc('get_admin_overview_metrics');
    if (error || !data || data.length === 0) {
      if (error) logger.warn('Failed to call get_admin_overview_metrics RPC', error);
      return null;
    }
    const row = data[0];
    return {
      activeShifts: Number(row.active_shifts || 0),
      totalEscrowHeld: Number(row.escrow_held_inr || 0),
      settledPayoutsTotal: Number(row.gmv_inr || 0),
      platformFeesCollected: Number(row.platform_fees_inr || 0),
      verifiedWorkersCount: Number(row.total_workers || 0),
      activeOrganizersCount: 0,
      pendingVerificationsCount: Number(row.pending_verifications || 0),
      openDisputesCount: Number(row.open_disputes || 0),
      criticalSafetyReportsCount: Number(row.open_safety_reports || 0),
    };
  } catch (err) {
    logger.error('Exception calling get_admin_overview_metrics RPC', err);
    return null;
  }
}

/**
 * Securely fetch audit logs using server-side authorized RPC with pagination
 */
export async function fetchAdminAuditLogsSafe(
  limit: number = 50,
  offset: number = 0
): Promise<AuditLog[]> {
  try {
    const client = getClient();
    const { data, error } = await client.rpc('get_admin_audit_logs', {
      p_limit: limit,
      p_offset: offset,
    });
    if (error) {
      logger.error('Failed to call get_admin_audit_logs RPC', error);
      return [];
    }
    return (data || []).map((row: any) => ({
      id: row.id,
      actorId: row.actor_id,
      action: row.action,
      entityType: row.entity_type,
      entityId: row.entity_id,
      oldState: row.old_state,
      newState: row.payload,
      createdAt: row.created_at,
    }));
  } catch (err) {
    logger.error('Exception calling get_admin_audit_logs RPC', err);
    return [];
  }
}

