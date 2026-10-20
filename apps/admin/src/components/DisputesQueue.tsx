'use client';

import React, { useState } from 'react';
import { Dispute } from '@opskil/shared';
import {
  EmptyRow,
  Modal,
  Pagination,
  StatusPill,
  StatusTone,
  TableShell,
  maskId,
  useClientPagination,
} from './ui';

interface DisputesQueueProps {
  disputes: Dispute[];
  onResolveDispute: (
    disputeId: string,
    status: 'resolved' | 'dismissed',
    notes: string,
    adjustedPayout?: number
  ) => Promise<void>;
  compact?: boolean;
}

function statusTone(status: string): StatusTone {
  if (status === 'resolved') return 'success';
  if (status === 'dismissed') return 'neutral';
  if (status === 'under_review') return 'info';
  return 'warning';
}

function statusLabel(status: string): string {
  return status.replace(/_/g, ' ');
}

export const DisputesQueue: React.FC<DisputesQueueProps> = ({
  disputes,
  onResolveDispute,
  compact = false,
}) => {
  const [selectedDispute, setSelectedDispute] = useState<Dispute | null>(null);
  const [resolutionStatus, setResolutionStatus] = useState<'resolved' | 'dismissed'>('resolved');
  const [notes, setNotes] = useState('');
  const [adjustedPayout, setAdjustedPayout] = useState('');
  const [modalError, setModalError] = useState('');
  const [resolving, setResolving] = useState(false);

  const { page, pageCount, pageRows, setPage, summary } = useClientPagination(disputes, compact ? 5 : 10);

  const handleResolve = async () => {
    if (!selectedDispute) return;
    if (!notes.trim()) {
      setModalError('Documented case notes and investigation rationale are required.');
      return;
    }
    setResolving(true);
    setModalError('');
    try {
      const payoutNum = adjustedPayout ? parseFloat(adjustedPayout) : undefined;
      await onResolveDispute(selectedDispute.id, resolutionStatus, notes, payoutNum);
      setSelectedDispute(null);
      setNotes('');
      setAdjustedPayout('');
    } catch (err: any) {
      setModalError(err?.message || 'Failed to adjudicate dispute');
    } finally {
      setResolving(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <h2 className="admin-section-title">Attendance & wage disputes</h2>
        <p className="admin-section-desc">
          Investigate attendance disputes and wage adjustments. Dismissed cases are not counted as active.
        </p>
      </div>

      <TableShell
        footer={<Pagination page={page} pageCount={pageCount} onChange={setPage} summary={summary} />}
      >
        <table className="admin-table">
          <thead>
            <tr>
              <th>Shift & booking</th>
              <th>Raised by</th>
              <th>Claim</th>
              <th>Details</th>
              <th>Status</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.length === 0 ? (
              <EmptyRow colSpan={6} title="No disputes" message="No attendance or wage disputes reported." />
            ) : (
              pageRows.map((d) => (
                <tr key={d.id}>
                  <td>
                    <div className="cell-primary">Booking {maskId(d.bookingId)}</div>
                    <div className="cell-muted">
                      Case {maskId(d.id)} · Filed {new Date(d.createdAt).toLocaleDateString('en-IN')}
                    </div>
                  </td>
                  <td className="cell-mono">{maskId(d.raisedBy)}</td>
                  <td style={{ fontWeight: 600 }}>{d.reason}</td>
                  <td style={{ color: 'var(--text-secondary)', maxWidth: 260 }}>
                    <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {d.details}
                    </div>
                  </td>
                  <td>
                    <StatusPill label={statusLabel(d.status)} tone={statusTone(d.status)} />
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <button
                      type="button"
                      className="admin-btn admin-btn-secondary admin-btn-sm"
                      onClick={() => {
                        setSelectedDispute(d);
                        setAdjustedPayout('');
                        setNotes('');
                        setModalError('');
                        setResolutionStatus('resolved');
                      }}
                    >
                      Investigate
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </TableShell>

      {selectedDispute && (
        <Modal title="Adjudicate dispute" onClose={() => setSelectedDispute(null)}>
          <div className="admin-modal-body-card">
            <div className="admin-modal-row">
              <span>Booking</span>
              <span className="cell-mono">{maskId(selectedDispute.bookingId)}</span>
            </div>
            <div className="admin-modal-row">
              <span>Claim</span>
              <span style={{ fontWeight: 600 }}>{selectedDispute.reason}</span>
            </div>
            <div>
              <span style={{ color: 'var(--text-secondary)', display: 'block', marginBottom: 2 }}>Details</span>
              <span style={{ fontSize: 12 }}>{selectedDispute.details}</span>
            </div>
          </div>

          <div>
            <label className="admin-label" htmlFor="dispute-resolution">
              Resolution
            </label>
            <select
              id="dispute-resolution"
              className="admin-select"
              value={resolutionStatus}
              onChange={(e) => setResolutionStatus(e.target.value as 'resolved' | 'dismissed')}
            >
              <option value="resolved">Resolved (authorize adjusted settlement)</option>
              <option value="dismissed">Dismissed (no adjustment)</option>
            </select>
          </div>

          <div>
            <label className="admin-label" htmlFor="adjusted-payout">
              Adjusted net payout (₹)
            </label>
            <input
              id="adjusted-payout"
              className="admin-input"
              type="number"
              value={adjustedPayout}
              onChange={(e) => setAdjustedPayout(e.target.value)}
              placeholder="Optional adjusted wage amount"
            />
          </div>

          <div>
            <label className="admin-label" htmlFor="dispute-notes">
              Investigation notes (required)
            </label>
            <textarea
              id="dispute-notes"
              className="admin-input"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="GPS logs, supervisor confirmation, check-in timestamps…"
              rows={3}
            />
          </div>

          {modalError && (
            <div className="admin-banner admin-banner--danger" role="alert">
              {modalError}
            </div>
          )}

          <div className="admin-modal-actions">
            <button type="button" className="admin-btn admin-btn-secondary" onClick={() => setSelectedDispute(null)}>
              Cancel
            </button>
            <button type="button" className="admin-btn admin-btn-primary" disabled={resolving} onClick={handleResolve}>
              Confirm adjudication
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
};
