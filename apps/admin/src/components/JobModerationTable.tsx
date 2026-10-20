'use client';

import React, { useState } from 'react';
import { Job, formatINR } from '@opskil/shared';
import {
  EmptyRow,
  Modal,
  Pagination,
  StatusPill,
  StatusTone,
  TableShell,
  useClientPagination,
} from './ui';

/** Product / schema minimum wage floor (ShiftCreateSchema.min(100)). */
const WAGE_FLOOR_INR = 100;

interface JobModerationTableProps {
  jobs: Job[];
  onModerateJob: (jobId: string, status: 'open' | 'paused' | 'cancelled', reason: string) => Promise<void>;
}

function statusTone(status: string): StatusTone {
  if (status === 'open') return 'success';
  if (status === 'paused') return 'warning';
  return 'danger';
}

export const JobModerationTable: React.FC<JobModerationTableProps> = ({ jobs, onModerateJob }) => {
  const [targetJob, setTargetJob] = useState<{
    job: Job;
    action: 'open' | 'paused' | 'cancelled';
  } | null>(null);
  const [reason, setReason] = useState('');
  const [modalError, setModalError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const { page, pageCount, pageRows, setPage, summary } = useClientPagination(jobs, 10);

  const handleConfirmAction = async () => {
    if (!targetJob) return;
    if (targetJob.action !== 'open' && !reason.trim()) {
      setModalError('A documented rationale is mandatory for pausing or cancelling shifts.');
      return;
    }
    setSubmitting(true);
    setModalError('');
    try {
      await onModerateJob(targetJob.job.id, targetJob.action, reason);
      setTargetJob(null);
      setReason('');
    } catch (err: any) {
      setModalError(err?.message || 'Failed to update shift status');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <h2 className="admin-section-title">Shift moderation</h2>
        <p className="admin-section-desc">
          Enforce the ₹{WAGE_FLOOR_INR}/hr wage floor, reasonable hours, and safety criteria.
        </p>
      </div>

      <TableShell
        footer={<Pagination page={page} pageCount={pageCount} onChange={setPage} summary={summary} />}
      >
        <table className="admin-table">
          <thead>
            <tr>
              <th>Shift & host</th>
              <th>Category</th>
              <th>Wage</th>
              <th>Headcount</th>
              <th>Status</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.length === 0 ? (
              <EmptyRow colSpan={6} title="No shifts" message="No shifts currently in the moderation queue." />
            ) : (
              pageRows.map((job) => {
                const meetsFloor = job.hourlyRate >= WAGE_FLOOR_INR;
                return (
                  <tr key={job.id}>
                    <td>
                      <div className="cell-primary">{job.title}</div>
                      <div className="cell-muted">
                        {job.organizer?.businessName || 'Event host'} · {job.venueName}
                      </div>
                    </td>
                    <td style={{ textTransform: 'capitalize' }}>{job.category}</td>
                    <td>
                      <div style={{ fontWeight: 700 }}>{formatINR(job.hourlyRate)}/hr</div>
                      <div style={{ marginTop: 4 }}>
                        <StatusPill
                          label={meetsFloor ? `Meets ₹${WAGE_FLOOR_INR}/hr floor` : `Below ₹${WAGE_FLOOR_INR}/hr floor`}
                          tone={meetsFloor ? 'success' : 'warning'}
                          showDot={false}
                        />
                      </div>
                    </td>
                    <td>
                      {job.slotsFilled} / {job.slotsTotal} filled
                    </td>
                    <td>
                      <StatusPill label={job.status} tone={statusTone(job.status)} />
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                        <button
                          type="button"
                          className="admin-btn admin-btn-secondary admin-btn-sm"
                          onClick={() => {
                            setTargetJob({ job, action: 'open' });
                            setReason('');
                            setModalError('');
                          }}
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          className="admin-btn admin-btn-warning admin-btn-sm"
                          onClick={() => {
                            setTargetJob({ job, action: 'paused' });
                            setReason('');
                            setModalError('');
                          }}
                        >
                          Pause
                        </button>
                        <button
                          type="button"
                          className="admin-btn admin-btn-danger admin-btn-sm"
                          onClick={() => {
                            setTargetJob({ job, action: 'cancelled' });
                            setReason('');
                            setModalError('');
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </TableShell>

      {targetJob && (
        <Modal title={`Moderate shift: ${targetJob.action}`} onClose={() => setTargetJob(null)}>
          <div className="admin-modal-body-card">
            <strong>{targetJob.job.title}</strong> by {targetJob.job.organizer?.businessName || 'Organizer'}
          </div>

          {targetJob.action !== 'open' && (
            <div>
              <label className="admin-label" htmlFor="moderation-reason">
                Moderation reason (required)
              </label>
              <textarea
                id="moderation-reason"
                className="admin-input"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Below wage floor, safety policy violation, venue cancellation…"
                rows={3}
              />
            </div>
          )}

          {modalError && (
            <div className="admin-banner admin-banner--danger" role="alert">
              {modalError}
            </div>
          )}

          <div className="admin-modal-actions">
            <button type="button" className="admin-btn admin-btn-secondary" onClick={() => setTargetJob(null)}>
              Back
            </button>
            <button
              type="button"
              className={`admin-btn ${targetJob.action === 'cancelled' ? 'admin-btn-danger' : 'admin-btn-primary'}`}
              disabled={submitting}
              onClick={handleConfirmAction}
            >
              Confirm {targetJob.action}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
};
