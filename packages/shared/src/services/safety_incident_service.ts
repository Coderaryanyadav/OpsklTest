import { getSharedSupabaseClient } from '../supabase/client';
import { logger } from '../utils/logger';
import { enqueueOfflineMutation } from './offline_queue_service';

export type IncidentCategory =
  | 'safety'
  | 'harassment'
  | 'hours'
  | 'wage'
  | 'access';

export type IncidentSeverity =
  | 'standard'
  | 'urgent'
  | 'immediate';

export interface SafetyIncidentPayload {
  reporterId: string;
  shiftId?: string;
  venueName?: string;
  category: IncidentCategory;
  severity: IncidentSeverity;
  locationDescription: string;
  notes: string;
  /** Storage object paths under private verification-documents (not device file:// URIs). */
  evidenceUrls?: string[];
  hasAudioMemo?: boolean;
  witnessDeclared: boolean;
  clientTimestamp?: string;
}

/**
 * Uses the existing private `verification-documents` bucket (already provisioned + RLS'd)
 * with user-scoped `incident_` object names so evidence works without a new live migration.
 * Dedicated `incident-evidence` bucket migration remains in supabase/migrations for later apply.
 */
const INCIDENT_EVIDENCE_BUCKET = 'verification-documents';

function resolveIncidentImageExtension(contentType: string, uri?: string): string {
  const ct = (contentType || '').toLowerCase();
  if (ct.includes('png') || uri?.toLowerCase().includes('.png')) return 'png';
  if (ct.includes('webp') || uri?.toLowerCase().includes('.webp')) return 'webp';
  return 'jpg';
}

/**
 * Uploads a local incident photo into private storage.
 * Returns a storage path scoped to `${userId}/incident_...` — never a device URI.
 */
export async function uploadIncidentEvidence(
  userId: string,
  localUri: string,
  contentType: string = 'image/jpeg'
): Promise<{ success: boolean; storagePath?: string; error?: string }> {
  if (!userId) {
    return { success: false, error: 'Authentication required to upload evidence.' };
  }
  if (localUri?.startsWith(`${userId}/`)) {
    return { success: true, storagePath: localUri };
  }
  if (!localUri || localUri.startsWith('http://') || localUri.startsWith('https://')) {
    return { success: false, error: 'Evidence must be a local photo URI or owned storage path.' };
  }

  try {
    const client = getSharedSupabaseClient();
    const extension = resolveIncidentImageExtension(contentType, localUri);
    const storagePath = `${userId}/incident_${Date.now()}.${extension}`;

    const res = await fetch(localUri);
    if (!res.ok) {
      return { success: false, error: `Could not read photo for upload (${res.status}).` };
    }
    const blob = await res.blob();

    const { error } = await client.storage.from(INCIDENT_EVIDENCE_BUCKET).upload(storagePath, blob, {
      contentType: contentType || blob.type || 'image/jpeg',
      upsert: false,
    });

    if (error) {
      logger.error('Failed to upload incident evidence', error);
      return { success: false, error: `Evidence upload failed: ${error.message}` };
    }

    return { success: true, storagePath };
  } catch (err: any) {
    logger.error('Unexpected exception during incident evidence upload', err);
    return { success: false, error: err?.message || 'Evidence storage upload error' };
  }
}

/**
 * Uploads each local photo URI and returns storage paths.
 * Fails closed if any upload fails so device URIs are never persisted as evidence_urls.
 */
export async function uploadIncidentEvidenceBatch(
  userId: string,
  localUris: string[]
): Promise<{ success: boolean; storagePaths?: string[]; error?: string }> {
  const paths: string[] = [];
  for (const uri of localUris) {
    if (!uri) continue;
    if (uri.startsWith(`${userId}/`)) {
      paths.push(uri);
      continue;
    }
    const uploaded = await uploadIncidentEvidence(userId, uri);
    if (!uploaded.success || !uploaded.storagePath) {
      return { success: false, error: uploaded.error || 'Evidence upload failed.' };
    }
    paths.push(uploaded.storagePath);
  }
  return { success: true, storagePaths: paths };
}

export interface SafetyIncidentResult {
  success: boolean;
  status: 'server_accepted' | 'locally_queued' | 'validation_failed';
  reportId?: string;
  caseRef?: string;
  error?: string;
  offlineNotice?: string;
}

/**
 * Maps the 5 tactical field categories to backend database enum values
 */
function mapCategoryToDbEnum(cat: IncidentCategory): 'safety' | 'harassment' | 'wage_theft' | 'unsafe_conditions' | 'fraud' | 'other' {
  switch (cat) {
    case 'safety':
      return 'safety';
    case 'harassment':
      return 'harassment';
    case 'hours':
      return 'unsafe_conditions';
    case 'wage':
      return 'wage_theft';
    case 'access':
    default:
      return 'other';
  }
}

/**
 * Maps field severity to backend database enum values
 */
function mapSeverityToDbEnum(sev: IncidentSeverity): 'low' | 'medium' | 'high' | 'critical' {
  switch (sev) {
    case 'standard':
      return 'low';
    case 'urgent':
      return 'high';
    case 'immediate':
      return 'critical';
  }
}

/**
 * Submits an encrypted safety or operational incident report.
 * Strictly verifies client witness declaration and required details.
 * If server is unreachable or offline, queues mutation locally and returns 'locally_queued'
 * without pretending server acceptance occurred.
 */
export async function submitSafetyIncidentSafe(
  payload: SafetyIncidentPayload,
  isOnline: boolean = true
): Promise<SafetyIncidentResult> {
  // 1. Validation Checks
  if (!payload.witnessDeclared) {
    return {
      success: false,
      status: 'validation_failed',
      error: 'Witness Declaration and Identity Shield confirmation is mandatory.',
    };
  }

  if (!payload.notes || payload.notes.trim().length < 10) {
    return {
      success: false,
      status: 'validation_failed',
      error: 'Detailed incident log must be at least 10 characters long.',
    };
  }

  if (!payload.locationDescription || payload.locationDescription.trim().length === 0) {
    return {
      success: false,
      status: 'validation_failed',
      error: 'Specific Hall or Gate location within venue is required.',
    };
  }

  const caseRef = `TK-BKC-${Math.floor(1000 + Math.random() * 9000)}`;
  const timestamp = payload.clientTimestamp || new Date().toISOString();

  // 2. Offline / Degraded Network Mode Handling
  if (!isOnline) {
    logger.warn('[SAFETY ESCALATION] Device offline — queueing incident report locally', {
      caseRef,
      category: payload.category,
      severity: payload.severity,
    });

    const enqueued = await enqueueOfflineMutation({
      type: 'incident_report',
      payload: {
        ...payload,
        caseRef,
        queuedAt: timestamp,
      },
      summaryTitle: `Incident: ${payload.category.toUpperCase()} (${payload.severity})`,
      summaryMeta: `${new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} IST • Queued locally (#${caseRef})`,
    });

    return {
      success: true,
      status: 'locally_queued',
      reportId: enqueued.item.id,
      caseRef,
      offlineNotice:
        'Report cached in local device storage. It will sync when network connectivity is restored. Bluetooth peer mesh is not available in this build.',
    };
  }

  // 3. Online Server Submission via Supabase
  try {
    const client = getSharedSupabaseClient();
    const dbCategory = mapCategoryToDbEnum(payload.category);
    const dbSeverity = mapSeverityToDbEnum(payload.severity);

    // Reject device URIs and arbitrary URLs — only user-scoped storage paths may be persisted.
    const evidenceUrls = payload.evidenceUrls || [];
    const ownerPrefix = `${payload.reporterId}/`;
    const unsafeEvidence = evidenceUrls.find((u) => !!u && !u.startsWith(ownerPrefix));
    if (unsafeEvidence) {
      return {
        success: false,
        status: 'validation_failed',
        error: 'Photo evidence must be uploaded to secure storage before submission.',
      };
    }

    const fullDescription = `[LOCATION: ${payload.locationDescription}] [VENUE: ${payload.venueName || 'Unspecified'}] ${payload.notes}`;

    const { data, error } = await client
      .from('safety_reports')
      .insert({
        reporter_id: payload.reporterId,
        category: dbCategory,
        severity: dbSeverity,
        description: fullDescription,
        evidence_urls: evidenceUrls,
        status: 'open',
      })
      .select('id')
      .maybeSingle();

    if (error) {
      logger.error('Failed to insert safety report to server, fallback queueing', error);

      // Graceful fallback to offline queue rather than failing completely
      const enqueued = await enqueueOfflineMutation({
        type: 'incident_report',
        payload: { ...payload, caseRef },
        summaryTitle: `Incident: ${payload.category.toUpperCase()} (${payload.severity})`,
        summaryMeta: `Queued locally (#${caseRef})`,
      });

      return {
        success: true,
        status: 'locally_queued',
        reportId: enqueued.item.id,
        caseRef,
        offlineNotice:
          'Network request failed. Report has been safely cached locally and will retry synchronization.',
      };
    }

    logger.info('[SAFETY ESCALATION] Incident accepted by server', {
      reportId: data?.id,
      caseRef,
    });

    return {
      success: true,
      status: 'server_accepted',
      reportId: data?.id,
      caseRef,
    };
  } catch (err: any) {
    logger.error('Exception during safety incident submission', err);
    return {
      success: false,
      status: 'validation_failed',
      error: err?.message || 'Unexpected error processing incident report.',
    };
  }
}
