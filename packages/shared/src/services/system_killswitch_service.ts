import { SystemOperationalStatus } from '../types';
import { logger } from '../utils/logger';
import { supabase } from '../supabase/client';

let currentOperationalStatus: SystemOperationalStatus = {
  isOperational: true,
  isBookingPaused: false,
  pauseReason: undefined,
  pausedBy: undefined,
  pausedAt: undefined,
  activeOutageMessage: undefined,
  apiSuccessRatePct: 99.94,
  p95DatabaseLatencyMs: 42,
  reconciliationDiscrepancyCount: 0,
};

/**
 * Returns current system operational status and booking killswitch state.
 */
export function getSystemOperationalStatus(): SystemOperationalStatus {
  return { ...currentOperationalStatus };
}

/**
 * Synchronize authoritative killswitch state from database
 */
export async function syncKillswitchFromDatabase(): Promise<SystemOperationalStatus> {
  try {
    const { data } = await supabase
      .from('platform_settings')
      .select('value')
      .eq('key', 'booking_killswitch')
      .maybeSingle();

    if (data && data.value) {
      const isPaused = Boolean(data.value.is_paused);
      currentOperationalStatus = {
        ...currentOperationalStatus,
        isBookingPaused: isPaused,
        pauseReason: data.value.reason || undefined,
        pausedBy: data.value.paused_by || undefined,
        pausedAt: data.value.paused_at || undefined,
        activeOutageMessage: data.value.outage_message || undefined,
      };
    }
  } catch (err) {
    logger.error('Failed to sync killswitch from database', err);
  }
  return { ...currentOperationalStatus };
}

/**
 * Check if shift bookings / new job applications are currently paused.
 */
export function isBookingPaused(): boolean {
  return currentOperationalStatus.isBookingPaused;
}

/**
 * Authoritative, synchronous-await booking killswitch state updater.
 * Strictly verifies database persistence before reporting success.
 */
export async function setBookingPauseStatusSafe(
  paused: boolean,
  reason?: string,
  pausedBy: string = 'Ops Admin',
  outageMessage?: string
): Promise<{ success: boolean; status: SystemOperationalStatus; error?: string }> {
  const nextPausedAt = paused ? new Date().toISOString() : undefined;
  const nextOutageMessage = paused
    ? outageMessage || 'New bookings are temporarily paused for routine maintenance or weather safety.'
    : undefined;

  try {
    const userRes = await supabase.auth.getUser();
    const effectiveActor = userRes.data?.user?.email || userRes.data?.user?.id || pausedBy;

    const { error } = await supabase
      .from('platform_settings')
      .upsert({
        key: 'booking_killswitch',
        value: {
          is_paused: paused,
          reason: reason ?? null,
          paused_by: effectiveActor,
          paused_at: nextPausedAt,
          outage_message: nextOutageMessage ?? null,
        },
        description: 'Platform-wide emergency booking pause killswitch',
        updated_at: new Date().toISOString(),
      });

    if (error) {
      logger.error('Failed to persist booking killswitch to platform_settings', error);
      return { success: false, status: { ...currentOperationalStatus }, error: error.message };
    }

    currentOperationalStatus = {
      ...currentOperationalStatus,
      isBookingPaused: paused,
      pauseReason: paused ? reason : undefined,
      pausedBy: paused ? pausedBy : undefined,
      pausedAt: nextPausedAt,
      activeOutageMessage: nextOutageMessage,
    };

    logger.info(
      paused ? '[OPSKL SAFETY] Bookings PAUSED' : '[OPSKL SAFETY] Bookings RESUMED',
      {
        paused,
        reason,
        pausedBy,
        timestamp: currentOperationalStatus.pausedAt,
      }
    );

    return { success: true, status: { ...currentOperationalStatus } };
  } catch (err: any) {
    logger.error('Error persisting booking killswitch', err);
    return { success: false, status: { ...currentOperationalStatus }, error: err.message };
  }
}

/**
 * Update system pause state (e.g. for severe weather, network disruption, or planned maintenance).
 * Persists to database platform_settings table as single authoritative source of truth.
 */
export function setBookingPauseStatus(
  paused: boolean,
  reason?: string,
  pausedBy: string = 'Ops Admin',
  outageMessage?: string
): SystemOperationalStatus {
  currentOperationalStatus = {
    ...currentOperationalStatus,
    isBookingPaused: paused,
    pauseReason: paused ? reason : undefined,
    pausedBy: paused ? pausedBy : undefined,
    pausedAt: paused ? new Date().toISOString() : undefined,
    activeOutageMessage: paused
      ? outageMessage || 'New bookings are temporarily paused for routine maintenance or weather safety.'
      : undefined,
  };

  logger.info(
    paused ? '[OPSKL SAFETY] Bookings PAUSED' : '[OPSKL SAFETY] Bookings RESUMED',
    {
      paused,
      reason,
      pausedBy,
      timestamp: currentOperationalStatus.pausedAt,
    }
  );

  // Authoritatively persist to database platform_settings table
  try {
    supabase
      .from('platform_settings')
      .upsert({
        key: 'booking_killswitch',
        value: {
          is_paused: paused,
          reason: reason ?? null,
          paused_by: pausedBy,
          paused_at: currentOperationalStatus.pausedAt,
          outage_message: currentOperationalStatus.activeOutageMessage ?? null,
        },
        description: 'Platform-wide emergency booking pause killswitch',
        updated_at: new Date().toISOString(),
      })
      .then(
        ({ error }: any) => {
          if (error) {
            if (process.env.NODE_ENV !== 'test') {
              logger.error('Failed to persist booking killswitch to platform_settings', error);
            }
          } else {
            logger.info('Authoritative booking killswitch persisted to platform_settings');
          }
        },
        (err: any) => {
          if (process.env.NODE_ENV !== 'test') {
            logger.error('Error invoking database persistence for booking killswitch', err);
          }
        }
      );
  } catch (err) {
    if (process.env.NODE_ENV !== 'test') {
      logger.error('Error invoking database persistence for booking killswitch', err);
    }
  }

  return { ...currentOperationalStatus };
}

/**
 * Record API / telemetry health metrics for release safety monitoring.
 */
export function updateSystemHealthMetrics(
  apiSuccessRatePct: number,
  p95DatabaseLatencyMs: number,
  reconciliationDiscrepancyCount: number = 0
): SystemOperationalStatus {
  currentOperationalStatus = {
    ...currentOperationalStatus,
    apiSuccessRatePct,
    p95DatabaseLatencyMs,
    reconciliationDiscrepancyCount,
    isOperational: apiSuccessRatePct >= 99.0 && reconciliationDiscrepancyCount === 0,
  };
  return { ...currentOperationalStatus };
}
