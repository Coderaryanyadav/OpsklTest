'use client';

import React, { useState } from 'react';
import {
  EmergencyBroadcastDetails,
  SystemOperationalStatus,
} from '@opskil/shared';
import {
  ShieldAlert,
  ShieldCheck,
  Lock,
  Unlock,
  X,
} from 'lucide-react';

export interface EmergencyLockdownModalProps {
  isOpen: boolean;
  onClose: () => void;
  systemStatus: SystemOperationalStatus;
  onToggleBookingPause: (
    reason?: string,
    broadcast?: EmergencyBroadcastDetails
  ) => Promise<void> | void;
}

export function EmergencyLockdownModal({
  isOpen,
  onClose,
  systemStatus,
  onToggleBookingPause,
}: EmergencyLockdownModalProps) {
  const isPaused = systemStatus.isBookingPaused;

  const [trigger, setTrigger] = useState(
    'Severe IMD Red Alert / Heavy Waterlogging in MMR Region & Venue Safety Curfew'
  );
  const [affectedRadius, setAffectedRadius] = useState(
    'All Mumbai Zones (South, Suburbs & Thane)'
  );
  const [reason, setReason] = useState(systemStatus.pauseReason || '');
  const [confirmedAuth, setConfirmedAuth] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleEnforceLockdown = async () => {
    setError(null);
    if (!confirmedAuth && !isPaused) {
      setError('You must confirm authorization before enacting platform suspension.');
      return;
    }
    if (!isPaused && reason.trim().length < 5) {
      setError('A documented rationale of at least 5 characters is required.');
      return;
    }

    setSubmitting(true);
    try {
      const broadcastDetails: EmergencyBroadcastDetails = {
        broadcastReference: 'EMG-MUM-2025-08',
        alertLevel: 'red',
        declaredTrigger: trigger,
        affectedRadius,
        effectiveFrom: new Date().toISOString(),
        wageProtectionSecured: true,
        operationalScope:
          'All open shift applications, new dispatches, and check-ins temporarily halted for worker safety.',
      };

      await onToggleBookingPause(
        !isPaused ? reason.trim() : undefined,
        !isPaused ? broadcastDetails : undefined
      );
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to update marketplace killswitch.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 620,
          background: 'var(--surface-color, #FFFFFF)',
          borderRadius: 'var(--radius-lg, 12px)',
          border: '1px solid var(--border-color, #E2E8F0)',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '90vh',
        }}
      >
        {/* Header Bar */}
        <div
          style={{
            padding: '16px 20px',
            background: isPaused ? '#059669' : '#DC2626',
            color: '#FFFFFF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {isPaused ? <Unlock size={22} /> : <ShieldAlert size={22} />}
            <div>
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 800,
                  letterSpacing: '0.8px',
                  textTransform: 'uppercase',
                  opacity: 0.9,
                }}
              >
                OPS PROTOCOL • AUTHORIZED COMMAND
              </div>
              <h2 style={{ fontSize: 18, fontWeight: 800, margin: 0, lineHeight: 1.2 }}>
                {isPaused
                  ? 'Active Emergency Protocol • Marketplace Suspended'
                  : 'Enforce Emergency Marketplace Suspension'}
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#FFFFFF',
              cursor: 'pointer',
              padding: 4,
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: 20, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Active Broadcast Summary if already suspended */}
          {isPaused && (
            <div
              style={{
                padding: 14,
                borderRadius: 'var(--radius-md, 8px)',
                background: '#FEF2F2',
                border: '1px solid #FECACA',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 800,
                    color: '#B91C1C',
                    letterSpacing: '0.5px',
                  }}
                >
                  BROADCAST REF #EMG-MUM-2025-08
                </span>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 800,
                    padding: '2px 8px',
                    borderRadius: 9999,
                    background: '#FEE2E2',
                    color: '#991B1B',
                  }}
                >
                  SUSPENSION ACTIVE
                </span>
              </div>
              <p style={{ fontSize: 13, color: '#1E293B', margin: 0, fontWeight: 600 }}>
                {systemStatus.activeOutageMessage ||
                  'New shift bookings and dispatches are halted across MMR.'}
              </p>
              <div style={{ fontSize: 11, color: '#64748B' }}>
                Enacted by: <strong>{systemStatus.pausedBy || 'Ops Admin'}</strong> at{' '}
                {systemStatus.pausedAt
                  ? new Date(systemStatus.pausedAt).toLocaleString()
                  : 'Active Session'}
              </div>
            </div>
          )}

          {/* Operational Scope Notice */}
          <div
            style={{
              padding: 12,
              borderRadius: 'var(--radius-md, 8px)',
              background: '#F8FAFC',
              border: '1px solid #E2E8F0',
              display: 'flex',
              alignItems: 'flex-start',
              gap: 10,
            }}
          >
            <ShieldCheck size={20} color="#003C90" style={{ flexShrink: 0, marginTop: 2 }} />
            <div style={{ fontSize: 12, color: '#334155', lineHeight: 1.5 }}>
              <strong>100% Wage Protection Guarantee:</strong> Enforcing suspension immediately
              safeguards workers currently deployed at venues. Active worker wages remain pre-funded
              and protected in the ICICI nodal escrow account without transit absence penalties.
            </div>
          </div>

          {!isPaused ? (
            <>
              {/* Trigger Selector */}
              <div>
                <label
                  style={{
                    fontSize: 11,
                    fontWeight: 800,
                    color: '#0F172A',
                    letterSpacing: '0.5px',
                    display: 'block',
                    marginBottom: 6,
                  }}
                >
                  DECLARED SAFETY TRIGGER
                </label>
                <select
                  value={trigger}
                  onChange={(e) => setTrigger(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-sm, 6px)',
                    border: '1px solid #CBD5E1',
                    fontSize: 13,
                    background: '#FFFFFF',
                  }}
                >
                  <option value="Severe IMD Red Alert / Heavy Waterlogging in MMR Region & Venue Safety Curfew">
                    Severe IMD Red Alert / Heavy Waterlogging in MMR Region & Venue Safety Curfew
                  </option>
                  <option value="Civil Disruption / Mumbai Transit Gridlock">
                    Civil Disruption / Mumbai Transit Gridlock
                  </option>
                  <option value="Severe Ground Incident / Building Facility Evacuation">
                    Severe Ground Incident / Building Facility Evacuation
                  </option>
                  <option value="Planned Emergency Platform Maintenance">
                    Planned Emergency Platform Maintenance
                  </option>
                </select>
              </div>

              {/* Affected Radius */}
              <div>
                <label
                  style={{
                    fontSize: 11,
                    fontWeight: 800,
                    color: '#0F172A',
                    letterSpacing: '0.5px',
                    display: 'block',
                    marginBottom: 6,
                  }}
                >
                  AFFECTED OPERATIONAL RADIUS
                </label>
                <select
                  value={affectedRadius}
                  onChange={(e) => setAffectedRadius(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-sm, 6px)',
                    border: '1px solid #CBD5E1',
                    fontSize: 13,
                    background: '#FFFFFF',
                  }}
                >
                  <option value="All Mumbai Zones (South, Suburbs & Thane)">
                    All Mumbai Zones (South, Suburbs & Thane)
                  </option>
                  <option value="MMR Western Suburbs (Bandra to Dahisar)">
                    MMR Western Suburbs (Bandra to Dahisar)
                  </option>
                  <option value="MMR Central & Navi Mumbai Zones">
                    MMR Central & Navi Mumbai Zones
                  </option>
                </select>
              </div>

              {/* Documented Rationale */}
              <div>
                <label
                  style={{
                    fontSize: 11,
                    fontWeight: 800,
                    color: '#0F172A',
                    letterSpacing: '0.5px',
                    display: 'block',
                    marginBottom: 6,
                  }}
                >
                  MANDATORY AUDIT RATIONALE (MIN 5 CHARACTERS)
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="State the authoritative basis for enacting marketplace suspension..."
                  rows={3}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-sm, 6px)',
                    border: '1px solid #CBD5E1',
                    fontSize: 13,
                    fontFamily: 'inherit',
                  }}
                />
              </div>

              {/* Authorization Confirmation Checkbox */}
              <label
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 10,
                  fontSize: 12,
                  color: '#1E293B',
                  cursor: 'pointer',
                }}
              >
                <input
                  type="checkbox"
                  checked={confirmedAuth}
                  onChange={(e) => setConfirmedAuth(e.target.checked)}
                  style={{ marginTop: 2 }}
                />
                <span>
                  I confirm that I hold administrative authority to enforce this safety lockdown.
                  An immutable audit entry will be recorded in the centralized governance ledger.
                </span>
              </label>
            </>
          ) : (
            <div>
              <p style={{ fontSize: 13, color: '#334155', lineHeight: 1.6 }}>
                Resuming the marketplace will re-enable worker check-ins, job listings, and shift
                confirmations across all operational zones. Ensure safety curfews have been formally
                lifted by municipal authorities before proceeding.
              </p>
            </div>
          )}

          {error && (
            <div
              style={{
                padding: '8px 12px',
                borderRadius: 'var(--radius-sm, 6px)',
                background: '#FEE2E2',
                border: '1px solid #FCA5A5',
                color: '#B91C1C',
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              {error}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div
          style={{
            padding: '16px 20px',
            borderTop: '1px solid var(--border-color, #E2E8F0)',
            background: 'var(--surface-color, #FFFFFF)',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 10,
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '8px 16px',
              borderRadius: 'var(--radius-sm, 6px)',
              background: '#F1F5F9',
              border: '1px solid #CBD5E1',
              color: '#334155',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleEnforceLockdown}
            disabled={submitting}
            style={{
              padding: '8px 20px',
              borderRadius: 'var(--radius-sm, 6px)',
              background: isPaused ? '#059669' : '#DC2626',
              border: 'none',
              color: '#FFFFFF',
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              opacity: submitting ? 0.7 : 1,
            }}
          >
            {isPaused ? <Unlock size={16} /> : <Lock size={16} />}
            <span>
              {submitting
                ? 'Persisting to Database…'
                : isPaused
                ? 'Resume Marketplace Operations'
                : 'Enforce Safety Suspension'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
