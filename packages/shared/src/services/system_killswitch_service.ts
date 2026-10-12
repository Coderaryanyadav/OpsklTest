import { SystemOperationalStatus } from '../types';
import { logger } from '../utils/logger';

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
 * Check if shift bookings / new job applications are currently paused.
 */
export function isBookingPaused(): boolean {
  return currentOperationalStatus.isBookingPaused;
}

/**
 * Update system pause state (e.g. for severe weather, network disruption, or planned maintenance).
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
