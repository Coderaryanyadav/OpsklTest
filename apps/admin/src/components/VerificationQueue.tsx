'use client';

import React, { useState } from 'react';
import { VerificationCase, getVerificationDocumentSignedUrl } from '@opskil/shared';

interface VerificationQueueProps {
  verifications: VerificationCase[];
  onResolveCase: (caseId: string, status: 'approved' | 'rejected', reason: string) => Promise<void>;
}

export const VerificationQueue: React.FC<VerificationQueueProps> = ({
  verifications,
  onResolveCase,
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
    // Entity type filtering: worker (Aadhaar/PAN or role worker) vs organizer (GSTIN or role organizer)
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

  const workerCasesCount = verifications.filter((c) => c.documentType !== 'gstin' && c.applicantProfile?.role !== 'organizer').length;
  const orgCasesCount = verifications.filter((c) => c.documentType === 'gstin' || c.applicantProfile?.role === 'organizer').length;

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
      {/* Header and Controls */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 800, color: '#101D36' }}>
            Identity & Business Verification Queue
          </h1>
          <p style={{ fontSize: 13, color: '#64748B', marginTop: 2 }}>
            Review KYC documents, Aadhaar records, and GST certificates before granting verified badges.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Entity Segment: Worker vs Organization */}
          <div style={{ display: 'flex', backgroundColor: '#F1F5F9', borderRadius: 8, padding: 3, border: '1px solid #E2E8F0' }}>
            <button
              onClick={() => setEntityType('all')}
              style={{
                padding: '6px 14px',
                borderRadius: 6,
                border: 'none',
                backgroundColor: entityType === 'all' ? '#101D36' : 'transparent',
                color: entityType === 'all' ? '#FFFFFF' : '#64748B',
                fontWeight: entityType === 'all' ? 700 : 500,
                fontSize: 12,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <span>All Submissions</span>
              <span style={{ fontSize: 10, padding: '1px 5px', borderRadius: 8, backgroundColor: entityType === 'all' ? '#334155' : '#E2E8F0', color: entityType === 'all' ? '#FFFFFF' : '#475569' }}>
                {verifications.length}
              </span>
            </button>
            <button
              onClick={() => setEntityType('worker')}
              style={{
                padding: '6px 14px',
                borderRadius: 6,
                border: 'none',
                backgroundColor: entityType === 'worker' ? '#101D36' : 'transparent',
                color: entityType === 'worker' ? '#FFFFFF' : '#64748B',
                fontWeight: entityType === 'worker' ? 700 : 500,
                fontSize: 12,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <span>Workers KYC</span>
              <span style={{ fontSize: 10, padding: '1px 5px', borderRadius: 8, backgroundColor: entityType === 'worker' ? '#334155' : '#E2E8F0', color: entityType === 'worker' ? '#FFFFFF' : '#475569' }}>
                {workerCasesCount}
              </span>
            </button>
            <button
              onClick={() => setEntityType('organizer')}
              style={{
                padding: '6px 14px',
                borderRadius: 6,
                border: 'none',
                backgroundColor: entityType === 'organizer' ? '#101D36' : 'transparent',
                color: entityType === 'organizer' ? '#FFFFFF' : '#64748B',
                fontWeight: entityType === 'organizer' ? 700 : 500,
                fontSize: 12,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <span>Agencies & Organizers</span>
              <span style={{ fontSize: 10, padding: '1px 5px', borderRadius: 8, backgroundColor: entityType === 'organizer' ? '#334155' : '#E2E8F0', color: entityType === 'organizer' ? '#FFFFFF' : '#475569' }}>
                {orgCasesCount}
              </span>
            </button>
          </div>

          <input
            type="text"
            placeholder="Search name, doc, or ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              padding: '7px 12px',
              borderRadius: 8,
              border: '1px solid #CBD5E1',
              fontSize: 13,
              width: 200,
              outline: 'none',
            }}
          />

          <div style={{ display: 'flex', backgroundColor: '#F1F5F9', borderRadius: 8, padding: 2, border: '1px solid #E2E8F0' }}>
            {(['all', 'pending', 'approved', 'rejected'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setFilter(tab)}
                style={{
                  padding: '6px 10px',
                  borderRadius: 6,
                  border: 'none',
                  backgroundColor: filter === tab ? '#FFFFFF' : 'transparent',
                  color: filter === tab ? '#101D36' : '#64748B',
                  fontWeight: filter === tab ? 700 : 500,
                  fontSize: 12,
                  cursor: 'pointer',
                  textTransform: 'capitalize',
                  boxShadow: filter === tab ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
                }}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Verification Cases Table */}
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
              <th style={{ padding: '12px 16px' }}>Applicant Profile</th>
              <th style={{ padding: '12px 16px' }}>Document Type</th>
              <th style={{ padding: '12px 16px' }}>Masked ID Number</th>
              <th style={{ padding: '12px 16px' }}>Submitted</th>
              <th style={{ padding: '12px 16px' }}>Status</th>
              <th style={{ padding: '12px 16px', textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredCases.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: '36px', textAlign: 'center', color: '#94A3B8' }}>
                  No verification cases found matching current filters.
                </td>
              </tr>
            ) : (
              filteredCases.map((c) => (
                <tr key={c.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ fontWeight: 700, color: '#101D36' }}>
                      {c.applicantProfile?.fullName || `Profile #${c.profileId.substring(0, 8)}`}
                    </div>
                    <div style={{ fontSize: 11, color: '#64748B' }}>
                      {c.applicantProfile?.email ? `${c.applicantProfile.email} • ` : ''}
                      {c.applicantProfile?.role ? `${c.applicantProfile.role.toUpperCase()} • ` : ''}
                      Case #{c.id.substring(0, 8)}
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span
                      style={{
                        padding: '2px 8px',
                        borderRadius: 12,
                        fontSize: 11,
                        fontWeight: 700,
                        backgroundColor: '#EFF6FF',
                        color: '#1D4ED8',
                        textTransform: 'uppercase',
                      }}
                    >
                      {c.documentType}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', fontFamily: 'monospace', color: '#334155' }}>
                    {c.documentMaskedId}
                  </td>
                  <td style={{ padding: '12px 16px', color: '#64748B' }}>
                    {new Date(c.createdAt).toLocaleDateString('en-IN', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span
                      style={{
                        display: 'inline-block',
                        padding: '3px 10px',
                        borderRadius: 12,
                        fontSize: 11,
                        fontWeight: 700,
                        whiteSpace: 'nowrap',
                        letterSpacing: 0.5,
                        backgroundColor:
                          c.status === 'approved'
                            ? '#DCFCE7'
                            : c.status === 'rejected'
                            ? '#FEE2E2'
                            : '#FEF3C7',
                        color:
                          c.status === 'approved'
                            ? '#16A34A'
                            : c.status === 'rejected'
                            ? '#DC2626'
                            : '#D97706',
                        textTransform: 'uppercase',
                      }}
                    >
                      {c.status}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                    <button
                      onClick={() => {
                        setSelectedCase(c);
                        setRejectReason(c.rejectionReason || '');
                        setModalError('');
                      }}
                      style={{
                        padding: '6px 12px',
                        borderRadius: 6,
                        border: '1px solid #E5E5E5',
                        backgroundColor: '#FFFFFF',
                        color: '#000000',
                        fontWeight: 600,
                        fontSize: 12,
                        cursor: 'pointer',
                      }}
                    >
                      Review Documents
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Adjudicate Review Modal */}
      {selectedCase && (
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
              maxWidth: 580,
              padding: 24,
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: 18, fontWeight: 800, color: '#101D36' }}>
                Adjudicate Verification Case
              </h2>
              <button
                onClick={() => setSelectedCase(null)}
                style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#64748B' }}
              >
                ✕
              </button>
            </div>

            <div style={{ backgroundColor: '#F8FAFC', padding: 14, borderRadius: 8, gap: 6, display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748B' }}>Profile ID:</span>
                <span style={{ fontWeight: 700, color: '#101D36' }}>{selectedCase.profileId}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748B' }}>Document Submitted:</span>
                <span style={{ fontWeight: 600, textTransform: 'uppercase' }}>{selectedCase.documentType} ({selectedCase.documentMaskedId})</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#64748B' }}>Storage Reference:</span>
                <span style={{ fontSize: 12, color: '#737373', fontFamily: 'monospace' }}>{selectedCase.documentStoragePath || 'Secured Private Vault'}</span>
              </div>
              {selectedCase.documentStoragePath && (
                <div style={{ marginTop: 6, display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    disabled={fetchingDoc}
                    onClick={async () => {
                      if (!selectedCase.documentStoragePath) return;
                      setFetchingDoc(true);
                      setModalError('');
                      try {
                        const res = await getVerificationDocumentSignedUrl(selectedCase.documentStoragePath, 300);
                        if (res.signedUrl) {
                          window.open(res.signedUrl, '_blank', 'noopener,noreferrer');
                        } else {
                          setModalError(res.error || 'Unable to generate secure signed link for this document.');
                        }
                      } catch (err: any) {
                        setModalError(err?.message || 'Error fetching secure document');
                      } finally {
                        setFetchingDoc(false);
                      }
                    }}
                    style={{
                      padding: '6px 12px',
                      borderRadius: 6,
                      border: '1px solid #000000',
                      backgroundColor: '#000000',
                      color: '#FFFFFF',
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    {fetchingDoc ? 'Generating Secure Link…' : 'Inspect Uploaded Evidence ↗'}
                  </button>
                </div>
              )}
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 6 }}>
                Rejection Rationale (Mandatory if declining verification):
              </label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="e.g. Blurry government ID scan, mismatch in full name, expired certificate..."
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

            {modalError && (
              <div style={{ color: '#DC2626', fontSize: 12, fontWeight: 600 }}>
                ⚠️ {modalError}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
              <button
                onClick={() => setSelectedCase(null)}
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
                onClick={handleReject}
                disabled={resolving}
                style={{
                  padding: '9px 16px',
                  borderRadius: 8,
                  border: 'none',
                  backgroundColor: '#DC2626',
                  color: '#FFFFFF',
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: 'pointer',
                  opacity: resolving ? 0.7 : 1,
                }}
              >
                Reject Case
              </button>

              <button
                onClick={handleApprove}
                disabled={resolving}
                style={{
                  padding: '9px 18px',
                  borderRadius: 8,
                  border: 'none',
                  backgroundColor: '#16A34A',
                  color: '#FFFFFF',
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: 'pointer',
                  opacity: resolving ? 0.7 : 1,
                }}
              >
                Approve & Grant Badge
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
