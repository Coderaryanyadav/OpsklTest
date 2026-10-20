'use client';

import React, { useEffect, useState } from 'react';
import { SystemOperationalStatus } from '@opskil/shared';
import { Play, Pause, Check, X, Menu } from 'lucide-react';
import { Modal } from './ui';

interface AdminHeaderProps {
  title: string;
  subtitle?: string;
  systemStatus: SystemOperationalStatus;
  onToggleBookingPause: (reason?: string) => void | Promise<void>;
  actionSuccessMessage?: string;
  onDismissMessage?: () => void;
  onOpenSidebar?: () => void;
}

export const AdminHeader: React.FC<AdminHeaderProps> = ({
  title,
  subtitle,
  systemStatus,
  onToggleBookingPause,
  actionSuccessMessage,
  onDismissMessage,
  onOpenSidebar,
}) => {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pauseReason, setPauseReason] = useState('');
  const [confirmError, setConfirmError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!actionSuccessMessage || !onDismissMessage) return;
    const t = window.setTimeout(() => onDismissMessage(), 4000);
    return () => window.clearTimeout(t);
  }, [actionSuccessMessage, onDismissMessage]);

  const openConfirm = () => {
    setPauseReason('');
    setConfirmError('');
    setConfirmOpen(true);
  };

  const handleConfirm = async () => {
    const nextPaused = !systemStatus.isBookingPaused;
    if (nextPaused && pauseReason.trim().length < 5) {
      setConfirmError('A pause reason of at least 5 characters is required.');
      return;
    }
    setSubmitting(true);
    setConfirmError('');
    try {
      await onToggleBookingPause(nextPaused ? pauseReason.trim() : undefined);
      setConfirmOpen(false);
    } catch (err: any) {
      setConfirmError(err?.message || 'Failed to update booking pause status.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <header className="admin-header">
      <div className="admin-header-row">
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          {onOpenSidebar && (
            <button
              type="button"
              className="admin-menu-btn"
              onClick={onOpenSidebar}
              aria-label="Open navigation"
            >
              <Menu size={20} />
            </button>
          )}
          <div>
            <h1 className="admin-header-title">{title}</h1>
            {subtitle && <p className="admin-header-subtitle">{subtitle}</p>}
          </div>
        </div>

        <button
          type="button"
          className={`admin-btn ${systemStatus.isBookingPaused ? 'admin-btn-success' : 'admin-btn-danger'} admin-btn-sm`}
          onClick={openConfirm}
          style={{ minHeight: 44 }}
        >
          {systemStatus.isBookingPaused ? (
            <>
              <Play size={13} strokeWidth={2.5} />
              <span>Resume bookings</span>
            </>
          ) : (
            <>
              <Pause size={13} strokeWidth={2.5} />
              <span>Pause bookings</span>
            </>
          )}
        </button>
      </div>

      {actionSuccessMessage && (
        <div className="admin-banner admin-banner--success" role="status">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Check size={14} strokeWidth={2.5} aria-hidden="true" />
            <span>{actionSuccessMessage}</span>
          </div>
          {onDismissMessage && (
            <button
              type="button"
              className="admin-btn admin-btn-ghost"
              onClick={onDismissMessage}
              aria-label="Dismiss message"
              style={{ minHeight: 32, color: 'var(--success-color)' }}
            >
              <X size={14} strokeWidth={2} />
            </button>
          )}
        </div>
      )}

      {confirmOpen && (
        <Modal
          title={systemStatus.isBookingPaused ? 'Resume shift bookings?' : 'Pause shift bookings?'}
          onClose={() => setConfirmOpen(false)}
        >
          <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            {systemStatus.isBookingPaused
              ? 'Workers will be able to apply to open shifts again. Confirm to resume marketplace bookings.'
              : 'New shift applications will be blocked platform-wide. Active shifts in progress remain unaffected.'}
          </p>

          {!systemStatus.isBookingPaused && (
            <div>
              <label className="admin-label" htmlFor="killswitch-reason">
                Pause reason (required)
              </label>
              <input
                id="killswitch-reason"
                className="admin-input"
                value={pauseReason}
                onChange={(e) => setPauseReason(e.target.value)}
                placeholder="e.g. Extreme weather advisory"
                autoFocus
              />
            </div>
          )}

          {confirmError && (
            <div className="admin-banner admin-banner--danger" role="alert">
              {confirmError}
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
              {submitting
                ? 'Updating…'
                : systemStatus.isBookingPaused
                ? 'Confirm resume'
                : 'Confirm pause'}
            </button>
          </div>
        </Modal>
      )}
    </header>
  );
};
