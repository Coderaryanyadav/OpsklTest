'use client';

import React, { useState } from 'react';
import { Job, formatINR } from '@opskil/shared';

interface JobModerationTableProps {
  jobs: Job[];
  onModerateJob: (jobId: string, status: 'open' | 'paused' | 'cancelled', reason: string) => Promise<void>;
}

export const JobModerationTable: React.FC<JobModerationTableProps> = ({
  jobs,
  onModerateJob,
}) => {
  const [targetJob, setTargetJob] = useState<{
    job: Job;
    action: 'open' | 'paused' | 'cancelled';
  } | null>(null);
  const [reason, setReason] = useState('');
  const [modalError, setModalError] = useState('');
  const [submitting, setSubmitting] = useState(false);

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
      {/* Header */}
      <div>
        <h1 style={{ fontSize: 18, fontWeight: 800, color: '#101D36' }}>
          Shift Moderation & Minimum Wage Floor
        </h1>
        <p style={{ fontSize: 13, color: '#64748B', marginTop: 2 }}>
          Ensure all published shifts satisfy Mumbai living wage compliance (₹100/hr floor), reasonable hours, and verified safety criteria.
        </p>
      </div>

      {/* Table */}
      <div
        style={{
          backgroundColor: '#FFFFFF',
          border: '1px solid #E2E8F0',
          borderRadius: 12,
          overflow: 'hidden',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        }}
      >
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
          <thead>
            <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#475569', fontWeight: 700 }}>
              <th style={{ padding: '12px 16px' }}>Shift Title & Host</th>
              <th style={{ padding: '12px 16px' }}>Category</th>
              <th style={{ padding: '12px 16px' }}>Wage / Rate</th>
              <th style={{ padding: '12px 16px' }}>Headcount</th>
              <th style={{ padding: '12px 16px' }}>Status</th>
              <th style={{ padding: '12px 16px', textAlign: 'right' }}>Moderation Actions</th>
            </tr>
          </thead>
          <tbody>
            {jobs.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: '36px', textAlign: 'center', color: '#94A3B8' }}>
                  No shifts currently in moderation queue.
                </td>
              </tr>
            ) : (
              jobs.map((job) => (
                <tr key={job.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ fontWeight: 700, color: '#101D36' }}>{job.title}</div>
                    <div style={{ fontSize: 11, color: '#64748B' }}>
                      {job.organizer?.businessName || 'Event Host'} • {job.venueName}
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px', textTransform: 'capitalize' }}>
                    {job.category}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ fontWeight: 700, color: '#101D36' }}>
                      {formatINR(job.hourlyRate)}/hr
                    </div>
                    <div style={{ fontSize: 11, color: job.hourlyRate >= 150 ? '#16A34A' : '#D97706' }}>
                      {job.hourlyRate >= 150 ? '✓ Above living wage' : 'Standard wage'}
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    {job.slotsFilled} / {job.slotsTotal} filled
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span
                      style={{
                        padding: '2px 8px',
                        borderRadius: 12,
                        fontSize: 11,
                        fontWeight: 700,
                        backgroundColor:
                          job.status === 'open'
                            ? '#DCFCE7'
                            : job.status === 'paused'
                            ? '#FEF3C7'
                            : '#FEE2E2',
                        color:
                          job.status === 'open'
                            ? '#16A34A'
                            : job.status === 'paused'
                            ? '#D97706'
                            : '#DC2626',
                        textTransform: 'uppercase',
                      }}
                    >
                      {job.status}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', gap: 6 }}>
                      <button
                        onClick={() => {
                          setTargetJob({ job, action: 'open' });
                          setReason('');
                          setModalError('');
                        }}
                        style={{
                          padding: '5px 10px',
                          borderRadius: 6,
                          border: '1px solid #DCFCE7',
                          backgroundColor: '#F0FDF4',
                          color: '#16A34A',
                          fontWeight: 700,
                          fontSize: 11,
                          cursor: 'pointer',
                        }}
                      >
                        Approve
                      </button>

                      <button
                        onClick={() => {
                          setTargetJob({ job, action: 'paused' });
                          setReason('');
                          setModalError('');
                        }}
                        style={{
                          padding: '5px 10px',
                          borderRadius: 6,
                          border: '1px solid #FEF3C7',
                          backgroundColor: '#FFFBEB',
                          color: '#D97706',
                          fontWeight: 700,
                          fontSize: 11,
                          cursor: 'pointer',
                        }}
                      >
                        Pause
                      </button>

                      <button
                        onClick={() => {
                          setTargetJob({ job, action: 'cancelled' });
                          setReason('');
                          setModalError('');
                        }}
                        style={{
                          padding: '5px 10px',
                          borderRadius: 6,
                          border: '1px solid #FEE2E2',
                          backgroundColor: '#FEF2F2',
                          color: '#DC2626',
                          fontWeight: 700,
                          fontSize: 11,
                          cursor: 'pointer',
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Moderation Action Modal */}
      {targetJob && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: 16,
          }}
        >
          <div
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: 14,
              width: '100%',
              maxWidth: 500,
              padding: 24,
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: 18, fontWeight: 800, color: '#101D36' }}>
                Moderate Shift: {targetJob.action.toUpperCase()}
              </h2>
              <button
                onClick={() => setTargetJob(null)}
                style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#64748B' }}
              >
                ✕
              </button>
            </div>

            <div style={{ backgroundColor: '#F8FAFC', padding: 12, borderRadius: 8, fontSize: 13 }}>
              <strong>{targetJob.job.title}</strong> by {targetJob.job.organizer?.businessName || 'Organizer'}
            </div>

            {targetJob.action !== 'open' && (
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 6 }}>
                  Moderation Reason (Required):
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g. Sub-minimum wage, safety policy violation, venue cancellation..."
                  rows={3}
                  style={{
                    width: '100%',
                    padding: 10,
                    borderRadius: 8,
                    border: '1px solid #CBD5E1',
                    fontSize: 13,
                    outline: 'none',
                  }}
                />
              </div>
            )}

            {modalError && (
              <div style={{ color: '#DC2626', fontSize: 12, fontWeight: 600 }}>
                ⚠️ {modalError}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                onClick={() => setTargetJob(null)}
                style={{
                  padding: '9px 16px',
                  borderRadius: 8,
                  border: '1px solid #CBD5E1',
                  backgroundColor: '#FFFFFF',
                  color: '#475569',
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>

              <button
                onClick={handleConfirmAction}
                disabled={submitting}
                style={{
                  padding: '9px 18px',
                  borderRadius: 8,
                  border: 'none',
                  backgroundColor: targetJob.action === 'cancelled' ? '#DC2626' : '#000000',
                  color: '#FFFFFF',
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: 'pointer',
                }}
              >
                Confirm {targetJob.action}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
