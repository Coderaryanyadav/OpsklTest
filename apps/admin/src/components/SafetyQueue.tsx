'use client';

import React, { useState } from 'react';
import { SafetyReport } from '@opskil/shared';
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

interface SafetyQueueProps {
  safetyReports: SafetyReport[];
  onResolveSafetyReport: (reportId: string, actionTaken: string) => Promise<void>;
}

function severityTone(severity: string): StatusTone {
  if (severity === 'critical') return 'danger';
  if (severity === 'high') return 'warning';
  return 'neutral';
}

function statusTone(status: string): StatusTone {
  return status === 'resolved' ? 'success' : 'warning';
}

export const SafetyQueue: React.FC<SafetyQueueProps> = ({
  safetyReports,
  onResolveSafetyReport,
}) => {
  const [selectedReport, setSelectedReport] = useState<SafetyReport | null>(null);
  const [actionNotes, setActionNotes] = useState('');
  const [modalError, setModalError] = useState('');
  const [resolving, setResolving] = useState(false);

  const { page, pageCount, pageRows, setPage, summary } = useClientPagination(safetyReports, 10);

  const handleResolve = async () => {
    if (!selectedReport) return;
    if (!actionNotes.trim()) {
      setModalError('Action summary and mitigation notes are required.');
      return;
    }
    setResolving(true);
    setModalError('');
    try {
      await onResolveSafetyReport(selectedReport.id, actionNotes);
      setSelectedReport(null);
      setActionNotes('');
    } catch (err: any) {
      setModalError(err?.message || 'Failed to resolve safety report');
    } finally {
      setResolving(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <h2 className="admin-section-title">Safety reports</h2>
        <p className="admin-section-desc">
          Workplace safety reports, venue hazards, SOS triggers, and harassment grievances.
        </p>
      </div>

      <TableShell
        footer={<Pagination page={page} pageCount={pageCount} onChange={setPage} summary={summary} />}
      >
        <table className="admin-table">
          <thead>
            <tr>
              <th>Incident / shift</th>
              <th>Urgency</th>
              <th>Category</th>
              <th>Description</th>
              <th>Status</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.length === 0 ? (
              <EmptyRow colSpan={6} title="No reports" message="No active safety complaints reported." />
            ) : (
              pageRows.map((r) => (
                <tr key={r.id}>
                  <td>
                    <div className="cell-primary">{r.jobTitle || `Incident ${maskId(r.id)}`}</div>
                    <div className="cell-muted">
                      Reported {new Date(r.createdAt).toLocaleDateString('en-IN')}
                    </div>
                  </td>
                  <td>
                    <StatusPill label={r.severity} tone={severityTone(r.severity)} />
                  </td>
                  <td style={{ textTransform: 'capitalize' }}>{r.category.replace(/_/g, ' ')}</td>
                  <td style={{ color: 'var(--text-secondary)', maxWidth: 280 }}>
                    <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {r.description}
                    </div>
                  </td>
                  <td>
                    <StatusPill label={r.status} tone={statusTone(r.status)} />
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <button
                      type="button"
                      className="admin-btn admin-btn-secondary admin-btn-sm"
                      onClick={() => {
                        setSelectedReport(r);
                        setActionNotes('');
                        setModalError('');
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

      {selectedReport && (
        <Modal title="Safety investigation" onClose={() => setSelectedReport(null)}>
          <div className="admin-modal-body-card">
            <div>
              <strong>Category:</strong> {selectedReport.category.replace(/_/g, ' ')}
            </div>
            <div>
              <strong>Severity:</strong> {selectedReport.severity}
            </div>
            <div>
              <strong>Details:</strong> {selectedReport.description}
            </div>
          </div>

          <div>
            <label className="admin-label" htmlFor="safety-actions">
              Resolution actions taken (required)
            </label>
            <textarea
              id="safety-actions"
              className="admin-input"
              value={actionNotes}
              onChange={(e) => setActionNotes(e.target.value)}
              placeholder="Emergency contact, medical support, supervisor warnings…"
              rows={3}
            />
          </div>

          {modalError && (
            <div className="admin-banner admin-banner--danger" role="alert">
              {modalError}
            </div>
          )}

          <div className="admin-modal-actions">
            <button type="button" className="admin-btn admin-btn-secondary" onClick={() => setSelectedReport(null)}>
              Cancel
            </button>
            <button type="button" className="admin-btn admin-btn-success" disabled={resolving} onClick={handleResolve}>
              Mark resolved
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
};
