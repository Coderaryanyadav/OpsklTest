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
          <h1 style={{ fontSize: 18, fontWeight: 800, color: '#111111' }}>
            Identity & Business Verification Queue
          </h1>
          <p style={{ fontSize: 13, color: '#737373', marginTop: 2 }}>
            Review KYC documents, Aadhaar records, and GST certificates before granting verified badges.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Entity Segment: Worker vs Organization */}
          <div style={{ display: 'flex', backgroundColor: '#F5F5F5', borderRadius: 8, padding: 3, border: '1px solid #E5E5E5' }}>
            <button
              onClick={() => setEntityType('all')}
              style={{
                padding: '6px 14px',
                borderRadius: 6,
                border: 'none',
                backgroundColor: entityType === 'all' ? '#000000' : 'transparent',
                color: entityType === 'all' ? '#FFFFFF' : '#737373',
                fontWeight: entityType === 'all' ? 700 : 500,
                fontSize: 12,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <span>All Submissions</span>
              <span style={{ fontSize: 10, padding: '1px 5px', borderRadius: 8, backgroundColor: entityType === 'all' ? '#262626' : '#E5E5E5', color: entityType === 'all' ? '#FFFFFF' : '#737373' }}>
                {verifications.length}
              </span>
            </button>
            <button
              onClick={() => setEntityType('worker')}
              style={{
                padding: '6px 14px',
                borderRadius: 6,
                border: 'none',
                backgroundColor: entityType === 'worker' ? '#000000' : 'transparent',
                color: entityType === 'worker' ? '#FFFFFF' : '#737373',
                fontWeight: entityType === 'worker' ? 700 : 500,
                fontSize: 12,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <span>Workers KYC</span>
              <span style={{ fontSize: 10, padding: '1px 5px', borderRadius: 8, backgroundColor: entityType === 'worker' ? '#262626' : '#E5E5E5', color: entityType === 'worker' ? '#FFFFFF' : '#737373' }}>
                {workerCasesCount}
              </span>
            </button>
            <button
              onClick={() => setEntityType('organizer')}
              style={{
                padding: '6px 14px',
                borderRadius: 6,
                border: 'none',
                backgroundColor: entityType === 'organizer' ? '#000000' : 'transparent',
                color: entityType === 'organizer' ? '#FFFFFF' : '#737373',
                fontWeight: entityType === 'organizer' ? 700 : 500,
                fontSize: 12,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <span>Agencies & Organizers</span>
              <span style={{ fontSize: 10, padding: '1px 5px', borderRadius: 8, backgroundColor: entityType === 'organizer' ? '#262626' : '#E5E5E5', color: entityType === 'organizer' ? '#FFFFFF' : '#737373' }}>
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
              border: '1px solid #E5E5E5',
              fontSize: 13,
              width: 200,
              outline: 'none',
              backgroundColor: '#FFFFFF',
              color: '#111111',
            }}
          />

          <div style={{ display: 'flex', backgroundColor: '#F5F5F5', borderRadius: 8, padding: 2, border: '1px solid #E5E5E5' }}>
            {(['all', 'pending', 'approved', 'rejected'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setFilter(tab)}
                style={{
                  padding: '6px 10px',
                  borderRadius: 6,
                  border: 'none',
                  backgroundColor: filter === tab ? '#000000' : 'transparent',
                  color: filter === tab ? '#FFFFFF' : '#737373',
                  fontWeight: filter === tab ? 700 : 500,
                  fontSize: 12,
                  cursor: 'pointer',
                  textTransform: 'capitalize',
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
          border: '1px solid #E5E5E5',
          borderRadius: 12,
          overflow: 'hidden',
          boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
        }}
      >
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
          <thead>
            <tr style={{ backgroundColor: '#FAFAFA', borderBottom: '1px solid #E5E5E5', color: '#737373', fontWeight: 600 }}>
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
                <td colSpan={6} style={{ padding: '36px', textAlign: 'center', color: '#737373' }}>
                  No verification cases found matching current filters.
                </td>
              </tr>
            ) : (
              filteredCases.map((c) => (
                <tr key={c.id} style={{ borderBottom: '1px solid #F5F5F5' }}>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ fontWeight: 700, color: '#111111' }}>
                      {c.applicantProfile?.fullName || `Profile #${c.profileId.substring(0, 8)}`}
                    </div>
                    <div style={{ fontSize: 11, color: '#737373' }}>
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
                        backgroundColor: '#F5F5F5',
                        color: '#111111',
                        border: '1px solid #E5E5E5',
                        textTransform: 'uppercase',
                      }}
                    >
                      {c.documentType}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', fontFamily: 'monospace', color: '#111111' }}>
                    {c.documentMaskedId}
                  </td>
                  <td style={{ padding: '12px 16px', color: '#737373' }}>
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
                            ? '#F0FDF4'
                            : c.status === 'rejected'
                            ? '#FEF2F2'
                            : '#FFFBEB',
                        color:
                          c.status === 'approved'
                            ? '#15803D'
                            : c.status === 'rejected'
                            ? '#DC2626'
                            : '#B45309',
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
                        color: '#111111',
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
            backgroundColor: 'rgba(0, 0, 0, 0.4)',
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
              border: '1px solid #E5E5E5',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.08)',
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: 18, fontWeight: 800, color: '#111111' }}>
                Adjudicate Verification Case
              </h2>
              <button
                onClick={() => setSelectedCase(null)}
                style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#737373' }}
              >
                ✕
              </button>
            </div>

            <div style={{ backgroundColor: '#FAFAFA', border: '1px solid #E5E5E5', padding: 14, borderRadius: 8, gap: 6, display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#737373' }}>Profile ID:</span>
                <span style={{ fontWeight: 700, color: '#111111' }}>{selectedCase.profileId}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#737373' }}>Document Submitted:</span>
                <span style={{ fontWeight: 600, textTransform: 'uppercase', color: '#111111' }}>{selectedCase.documentType} ({selectedCase.documentMaskedId})</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#737373' }}>Storage Reference:</span>
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
              <label style={{ fontSize: 12, fontWeight: 700, color: '#111111', display: 'block', marginBottom: 6 }}>
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
                  border: '1px solid #E5E5E5',
                  backgroundColor: '#FFFFFF',
                  color: '#111111',
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
                  border: '1px solid #E5E5E5',
                  backgroundColor: '#FFFFFF',
                  color: '#111111',
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
                  backgroundColor: '#15803D',
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
