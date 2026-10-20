'use client';

import React, { useState } from 'react';
import { PlatformSetting, SystemOperationalStatus } from '@opskil/shared';
import { EmptyRow, Modal, StatusPill, TableShell } from './ui';

interface PlatformSettingsPanelProps {
  settings: PlatformSetting[];
  systemStatus: SystemOperationalStatus;
  onToggleBookingPause: (reason?: string) => void | Promise<void>;
}

export const PlatformSettingsPanel: React.FC<PlatformSettingsPanelProps> = ({
  settings,
  systemStatus,
  onToggleBookingPause,
}) => {
  const [pauseReasonInput, setPauseReasonInput] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const openConfirm = () => {
    setError('');
    if (!systemStatus.isBookingPaused && pauseReasonInput.trim().length < 5) {
      setError('A pause reason of at least 5 characters is required.');
      return;
    }
    setConfirmOpen(true);
  };

  const handleConfirm = async () => {
    setSubmitting(true);
    setError('');
    try {
      await onToggleBookingPause(
        systemStatus.isBookingPaused ? undefined : pauseReasonInput.trim()
      );
      setConfirmOpen(false);
      if (!systemStatus.isBookingPaused) {
        setPauseReasonInput('');
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to update booking pause status.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h2 className="admin-section-title">System configuration</h2>
        <p className="admin-section-desc">
          Operational controls and database-backed platform settings.
        </p>
      </div>

      <div className={`admin-panel${systemStatus.isBookingPaused ? ' admin-panel--danger' : ''}`}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            flexWrap: 'wrap',
            gap: 16,
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <h3 style={{ fontSize: 16, fontWeight: 700 }}>Shift booking killswitch</h3>
              <StatusPill
                label={systemStatus.isBookingPaused ? 'PAUSED' : 'LIVE'}
                tone={systemStatus.isBookingPaused ? 'danger' : 'success'}
              />
            </div>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4, maxWidth: 560 }}>
              Pauses new shift applications across Worker and Organizer apps. Active shifts in progress remain
              functional.
            </p>
          </div>

          <button
            type="button"
            className={`admin-btn ${systemStatus.isBookingPaused ? 'admin-btn-success' : 'admin-btn-danger'}`}
            onClick={openConfirm}
          >
            {systemStatus.isBookingPaused ? 'Resume bookings' : 'Pause bookings'}
          </button>
        </div>

        {!systemStatus.isBookingPaused && (
          <div
            style={{
              marginTop: 16,
              paddingTop: 16,
              borderTop: '1px solid var(--surface-secondary)',
              display: 'flex',
              gap: 12,
              alignItems: 'center',
              flexWrap: 'wrap',
            }}
          >
            <label className="admin-label" htmlFor="settings-pause-reason" style={{ minWidth: 120, marginBottom: 0 }}>
              Pause reason
            </label>
            <input
              id="settings-pause-reason"
              className="admin-input"
              type="text"
              value={pauseReasonInput}
              onChange={(e) => setPauseReasonInput(e.target.value)}
              placeholder="e.g. Extreme weather advisory"
              style={{ flex: 1, minWidth: 200 }}
            />
          </div>
        )}

        {error && (
          <div className="admin-banner admin-banner--danger" role="alert" style={{ marginTop: 12 }}>
            {error}
          </div>
        )}
      </div>

      <TableShell>
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--border-color)',
            fontWeight: 700,
            color: 'var(--text-main)',
          }}
        >
          Database configuration keys
        </div>
        <table className="admin-table">
          <thead>
            <tr>
              <th>Setting key</th>
              <th>Current value</th>
              <th>Description</th>
              <th>Last updated</th>
            </tr>
          </thead>
          <tbody>
            {settings.length === 0 ? (
              <EmptyRow colSpan={4} message="No platform settings loaded." />
            ) : (
              settings.map((s) => (
                <tr key={s.key}>
                  <td className="cell-mono" style={{ fontWeight: 600 }}>
                    {s.key}
                  </td>
                  <td style={{ fontWeight: 700 }}>
                    {typeof s.value === 'object' ? JSON.stringify(s.value) : String(s.value)}
                  </td>
                  <td style={{ color: 'var(--text-secondary)' }}>{s.description || 'System setting'}</td>
                  <td style={{ color: 'var(--text-secondary)' }}>
                    {new Date(s.updatedAt).toLocaleDateString('en-IN')}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </TableShell>

      {confirmOpen && (
        <Modal
          title={systemStatus.isBookingPaused ? 'Resume shift bookings?' : 'Pause shift bookings?'}
          onClose={() => setConfirmOpen(false)}
        >
          <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            {systemStatus.isBookingPaused
              ? 'Confirm to resume marketplace bookings platform-wide.'
              : `Confirm pause with reason: “${pauseReasonInput.trim()}”`}
          </p>

          {error && (
            <div className="admin-banner admin-banner--danger" role="alert">
              {error}
            </div>
          )}

          <div className="admin-modal-actions">
            <button type="button" className="admin-btn admin-btn-secondary" onClick={() => setConfirmOpen(false)}>
              Cancel
            </button>
            <button
              type="button"
              className={`admin-btn ${systemStatus.isBookingPaused ? 'admin-btn-primary' : 'admin-btn-danger'}`}
              disabled={submitting}
              onClick={handleConfirm}
            >
              {submitting ? 'Updating…' : 'Confirm'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
};
