'use client';

import React, { useState } from 'react';
import { VerificationCase, getVerificationDocumentSignedUrl } from '@opskil/shared';
import {
  EmptyRow,
  Modal,
  Pagination,
  SegmentedControl,
  StatusPill,
  StatusTone,
  TableShell,
  maskId,
  useClientPagination,
} from './ui';

interface VerificationQueueProps {
  verifications: VerificationCase[];
  onResolveCase: (caseId: string, status: 'approved' | 'rejected', reason: string) => Promise<void>;
  compact?: boolean;
}

function statusTone(status: string): StatusTone {
  if (status === 'approved') return 'success';
  if (status === 'rejected') return 'danger';
  return 'warning';
}

export const VerificationQueue: React.FC<VerificationQueueProps> = ({
  verifications,
  onResolveCase,
  compact = false,
}) => {
  const [entityType, setEntityType] = useState<'all' | 'worker' | 'organizer'>('all');
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [search, setSearch] = useState('');
  const [selectedCase, setSelectedCase] = useState<VerificationCase | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [modalError, setModalError] = useState('');
  const [resolving, setResolving] = useState(false);
  const [fetchingDoc, setFetchingDoc] = useState(false);

  const filteredCases = verifications.filter((c) => {
    const isOrg = c.documentType === 'gstin' || c.applicantProfile?.role === 'organizer';
    if (entityType === 'worker' && isOrg) return false;
    if (entityType === 'organizer' && !isOrg) return false;

    if (filter !== 'all' && c.status !== filter) return false;
    if (search) {
      const q = search.toLowerCase();
      const profile = (c.applicantProfile?.fullName || c.profileId).toLowerCase();
      const email = (c.applicantProfile?.email || '').toLowerCase();
      const doc = c.documentType.toLowerCase();
      const mask = c.documentMaskedId.toLowerCase();
      return profile.includes(q) || email.includes(q) || doc.includes(q) || mask.includes(q);
    }
    return true;
  });

  const { page, pageCount, pageRows, setPage, summary } = useClientPagination(filteredCases, compact ? 5 : 10);

  const workerCasesCount = verifications.filter(
    (c) => c.documentType !== 'gstin' && c.applicantProfile?.role !== 'organizer'
  ).length;
  const orgCasesCount = verifications.filter(
    (c) => c.documentType === 'gstin' || c.applicantProfile?.role === 'organizer'
  ).length;

  const handleApprove = async () => {
    if (!selectedCase) return;
    setResolving(true);
    setModalError('');
    try {
      await onResolveCase(selectedCase.id, 'approved', '');
      setSelectedCase(null);
    } catch (err: any) {
      setModalError(err?.message || 'Failed to approve case');
    } finally {
      setResolving(false);
    }
  };

  const handleReject = async () => {
    if (!selectedCase) return;
    if (!rejectReason.trim()) {
      setModalError('A documented rejection reason is mandatory for compliance.');
      return;
    }
    setResolving(true);
    setModalError('');
    try {
      await onResolveCase(selectedCase.id, 'rejected', rejectReason);
      setSelectedCase(null);
      setRejectReason('');
    } catch (err: any) {
      setModalError(err?.message || 'Failed to reject case');
    } finally {
      setResolving(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="admin-toolbar">
        <div>
          <h2 className="admin-section-title">Verification queue</h2>
          <p className="admin-section-desc">
            Review KYC documents before granting verified status. Sensitive IDs are masked.
          </p>
        </div>

        <div className="admin-toolbar-actions">
          <SegmentedControl
            value={entityType}
            onChange={setEntityType}
            options={[
              { value: 'all', label: 'All', count: verifications.length },
              { value: 'worker', label: 'Workers', count: workerCasesCount },
              { value: 'organizer', label: 'Organizers', count: orgCasesCount },
            ]}
          />

          <input
            type="search"
            className="admin-input admin-input-sm"
            placeholder="Search name, doc, or ID…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: 200 }}
            aria-label="Search verification cases"
          />

          <SegmentedControl
            value={filter}
            onChange={setFilter}
            options={[
              { value: 'all', label: 'All' },
              { value: 'pending', label: 'Pending' },
              { value: 'approved', label: 'Approved' },
              { value: 'rejected', label: 'Rejected' },
            ]}
          />
        </div>
      </div>

      <TableShell
        footer={
          <Pagination page={page} pageCount={pageCount} onChange={setPage} summary={summary} />
        }
      >
        <table className="admin-table">
          <thead>
            <tr>
              <th>Applicant</th>
              <th>Document</th>
              <th>Masked ID</th>
              <th>Submitted</th>
              <th>Status</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.length === 0 ? (
              <EmptyRow colSpan={6} title="No cases" message="No verification cases match the current filters." />
            ) : (
              pageRows.map((c) => (
                <tr key={c.id}>
                  <td>
                    <div className="cell-primary">
                      {c.applicantProfile?.fullName || `Profile ${maskId(c.profileId)}`}
                    </div>
                    <div className="cell-muted">
                      {c.applicantProfile?.email ? `${c.applicantProfile.email} · ` : ''}
                      {c.applicantProfile?.role ? `${c.applicantProfile.role} · ` : ''}
                      Case {maskId(c.id)}
                    </div>
                  </td>
                  <td>
                    <span className="admin-status admin-status--neutral">{c.documentType}</span>
                  </td>
                  <td className="cell-mono">{c.documentMaskedId || maskId(c.documentMaskedId)}</td>
                  <td style={{ color: 'var(--text-secondary)' }}>
                    {new Date(c.createdAt).toLocaleDateString('en-IN', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </td>
                  <td>
                    <StatusPill label={c.status} tone={statusTone(c.status)} />
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <button
                      type="button"
                      className="admin-btn admin-btn-secondary admin-btn-sm"
                      onClick={() => {
                        setSelectedCase(c);
                        setRejectReason(c.rejectionReason || '');
                        setModalError('');
                      }}
                    >
                      Review
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </TableShell>

      {selectedCase && (
        <Modal title="Review verification case" onClose={() => setSelectedCase(null)}>
          <div className="admin-modal-body-card">
            <div className="admin-modal-row">
              <span>Profile</span>
              <span className="cell-mono">{maskId(selectedCase.profileId)}</span>
            </div>
            <div className="admin-modal-row">
              <span>Document</span>
              <span style={{ fontWeight: 600, textTransform: 'uppercase' }}>
                {selectedCase.documentType} ({selectedCase.documentMaskedId})
              </span>
            </div>
            <div className="admin-modal-row">
              <span>Storage</span>
              <span className="cell-muted" style={{ fontFamily: 'monospace', fontSize: 12 }}>
                {selectedCase.documentStoragePath
                  ? `…${selectedCase.documentStoragePath.slice(-24)}`
                  : 'No path on file'}
              </span>
            </div>
            {selectedCase.documentStoragePath && (
              <div style={{ marginTop: 6, display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="admin-btn admin-btn-primary admin-btn-sm"
                  disabled={fetchingDoc}
                  onClick={async () => {
                    if (!selectedCase.documentStoragePath) return;
                    setFetchingDoc(true);
                    setModalError('');
                    try {
                      const res = await getVerificationDocumentSignedUrl(
                        selectedCase.documentStoragePath,
                        300
                      );
                      if (res.signedUrl) {
                        window.open(res.signedUrl, '_blank', 'noopener,noreferrer');
                      } else {
                        setModalError(res.error || 'Unable to generate secure signed link.');
                      }
                    } catch (err: any) {
                      setModalError(err?.message || 'Error fetching secure document');
                    } finally {
                      setFetchingDoc(false);
                    }
                  }}
                >
                  {fetchingDoc ? 'Generating link…' : 'Open evidence'}
                </button>
              </div>
            )}
          </div>

          <div>
            <label className="admin-label" htmlFor="reject-reason">
              Rejection reason (required if rejecting)
            </label>
            <textarea
              id="reject-reason"
              className="admin-input"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="e.g. Blurry ID scan, name mismatch, expired certificate…"
              rows={3}
            />
          </div>

          {modalError && (
            <div className="admin-banner admin-banner--danger" role="alert">
              {modalError}
            </div>
          )}

          <div className="admin-modal-actions">
            <button type="button" className="admin-btn admin-btn-secondary" onClick={() => setSelectedCase(null)}>
              Cancel
            </button>
            <button type="button" className="admin-btn admin-btn-danger" disabled={resolving} onClick={handleReject}>
              Reject
            </button>
            <button type="button" className="admin-btn admin-btn-success" disabled={resolving} onClick={handleApprove}>
              Approve
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
};
