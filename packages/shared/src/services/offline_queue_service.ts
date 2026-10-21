import { universalStorage } from '../supabase/client';
import { logger } from '../utils/logger';

export interface OfflineMutationItem {
  id: string;
  idempotencyKey: string;
  type: 'check_in' | 'acknowledgment' | 'incident_report';
  payload: Record<string, any>;
  createdAt: string;
  status: 'queued' | 'syncing' | 'synced' | 'failed';
  retryCount: number;
  lastError?: string;
  serverAcknowledgedAt?: string;
  summaryTitle: string;
  summaryMeta: string;
}

export interface OfflineGateKey {
  backupPin: string;
  tokenHash: string;
  expiresAt: string;
  validForSeconds: number;
  venueName: string;
  workerId: string;
}

const OFFLINE_QUEUE_STORAGE_KEY = 'opskil_offline_queue_v1';

/** In-memory mirror of persisted queue — never seed demo mutations. */
let memoryQueueFallback: OfflineMutationItem[] = [];

/**
 * Fetch all locally queued mutations
 */
export async function getOfflineQueue(): Promise<OfflineMutationItem[]> {
  try {
    const raw = await universalStorage.getItem(OFFLINE_QUEUE_STORAGE_KEY);
    if (!raw) {
      return [...memoryQueueFallback];
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      memoryQueueFallback = parsed;
      return parsed;
    }
  } catch (err) {
    logger.warn('Failed to parse offline queue from storage, using in-memory state', err);
  }
  return [...memoryQueueFallback];
}

/**
 * Save offline queue state to universal storage
 */
async function saveOfflineQueue(items: OfflineMutationItem[]): Promise<void> {
  memoryQueueFallback = items;
  try {
    await universalStorage.setItem(OFFLINE_QUEUE_STORAGE_KEY, JSON.stringify(items));
  } catch (err) {
    logger.warn('Failed to persist offline queue to storage', err);
  }
}

/**
 * Enqueue a mutation locally when network is unavailable or degraded.
 * Enforces strict client idempotencyKey to prevent duplicate replay.
 */
export async function enqueueOfflineMutation(mutation: {
  type: 'check_in' | 'acknowledgment' | 'incident_report';
  payload: Record<string, any>;
  summaryTitle: string;
  summaryMeta: string;
  idempotencyKey?: string;
}): Promise<{ item: OfflineMutationItem; isDuplicate: boolean }> {
  const current = await getOfflineQueue();
  const idempotencyKey =
    mutation.idempotencyKey ||
    `idemp-${mutation.type}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

  // Idempotency check: do not add duplicate mutation with same key
  const existing = current.find((q) => q.idempotencyKey === idempotencyKey);
  if (existing) {
    logger.info('[OFFLINE QUEUE] Ignored duplicate mutation enqueue', { idempotencyKey });
    return { item: existing, isDuplicate: true };
  }

  const newItem: OfflineMutationItem = {
    id: `off-mut-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    idempotencyKey,
    type: mutation.type,
    payload: mutation.payload,
    createdAt: new Date().toISOString(),
    status: 'queued',
    retryCount: 0,
    summaryTitle: mutation.summaryTitle,
    summaryMeta: mutation.summaryMeta,
  };

  const updated = [newItem, ...current];
  await saveOfflineQueue(updated);

  logger.info('[OFFLINE QUEUE] Enqueued local mutation', {
    id: newItem.id,
    type: newItem.type,
    idempotencyKey,
  });

  return { item: newItem, isDuplicate: false };
}

/**
 * Synchronize offline queue when connectivity is restored or BLE mesh linked.
 * Executes each item idempotently and updates queue status.
 */
export async function syncOfflineQueueSafe(
  isOnline: boolean = true,
  executor?: (item: OfflineMutationItem) => Promise<{ success: boolean; error?: string }>
): Promise<{
  total: number;
  syncedCount: number;
  failedCount: number;
  remainingQueue: OfflineMutationItem[];
}> {
  const queue = await getOfflineQueue();

  if (!isOnline) {
    logger.info('[OFFLINE QUEUE] Cannot sync while network is disconnected');
    return {
      total: queue.length,
      syncedCount: 0,
      failedCount: queue.length,
      remainingQueue: queue,
    };
  }

  let synced = 0;
  let failed = 0;
  const nextQueue: OfflineMutationItem[] = [];

  for (const item of queue) {
    if (item.status === 'synced') {
      continue; // Skip already synced items
    }

    item.status = 'syncing';
    try {
      if (executor) {
        const result = await executor(item);
        if (result.success) {
          item.status = 'synced';
          item.serverAcknowledgedAt = new Date().toISOString();
          synced++;
        } else {
          item.status = 'failed';
          item.retryCount += 1;
          item.lastError = result.error || 'Server rejected mutation';
          failed++;
          nextQueue.push(item);
        }
      } else {
        item.status = 'failed';
        item.retryCount += 1;
        item.lastError = 'No execution handler provided for offline mutation sync';
        failed++;
        nextQueue.push(item);
      }
    } catch (err: any) {
      item.status = 'failed';
      item.retryCount += 1;
      item.lastError = err?.message || 'Sync network error';
      failed++;
      nextQueue.push(item);
    }
  }

  await saveOfflineQueue(nextQueue);

  logger.info('[OFFLINE QUEUE] Sync complete', {
    synced,
    failed,
    remaining: nextQueue.length,
  });

  return {
    total: queue.length,
    syncedCount: synced,
    failedCount: failed,
    remainingQueue: nextQueue,
  };
}

/**
 * Generate a deterministic offline gate key & backup PIN
 */
export function generateOfflineGateKey(workerId: string = 'WKR-9021', venueName: string = 'NESCO Center'): OfflineGateKey {
  // Deterministic 6-digit PIN format "884 - 219"
  return {
    backupPin: '884 - 219',
    tokenHash: '7f83b1657ff1fc53b92dc',
    expiresAt: new Date(Date.now() + 42 * 60 * 1000).toISOString(),
    validForSeconds: 42 * 60 - 12,
    venueName,
    workerId,
  };
}
