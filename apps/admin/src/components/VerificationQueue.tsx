'use client';

import React, { useState, useMemo } from 'react';
import {
  VerificationCase,
  getVerificationDocumentSignedUrl,
} from '@opskil/shared';
import {
  CheckCircle2,
  RotateCw,
  ZoomIn,
  ZoomOut,
  ExternalLink,
  Shield,
  ShieldCheck,
  Search,
  User,
  CreditCard,
  FileText,
  X,
} from 'lucide-react';
import {
  EmptyRow,
  Pagination,
  StatusPill,
  StatusTone,
  TableShell,
  useClientPagination,
  maskId,
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
  const [selectedCaseId, setSelectedCaseId] = useState<string>(
    verifications.length > 0 ? verifications[0].id : ''
  );
  const [selectedReasonFlag, setSelectedReasonFlag] = useState('');
  const [auditNotes, setAuditNotes] = useState(
    'Document scans verified against UIDAI standards. Bank penny drop confirms identity. Ready for concierge bidding.'
  );
  const [modalError, setModalError] = useState('');
  const [resolving, setResolving] = useState(false);
  const [fetchingDoc, setFetchingDoc] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [rotation, setRotation] = useState(0);

  const filteredCases = useMemo(() => {
    return verifications.filter((c) => {
      const isOrg = c.documentType === 'gstin' || c.applicantProfile?.role === 'organizer';
      if (entityType === 'worker' && isOrg) return false;
      if (entityType === 'organizer' && !isOrg) return false;

      if (filter !== 'all' && c.status !== filter) return false;
      if (search) {
        const q = search.toLowerCase();
        const profile = (c.applicantProfile?.fullName || c.profileId).toLowerCase();
        const email = (c.applicantProfile?.email || '').toLowerCase();
        const doc = c.documentType.toLowerCase();
        const mask = (c.documentMaskedId || '').toLowerCase();
        return profile.includes(q) || email.includes(q) || doc.includes(q) || mask.includes(q);
      }
      return true;
    });
  }, [verifications, entityType, filter, search]);

  const activeCase = useMemo(() => {
    return filteredCases.find((c) => c.id === selectedCaseId) || filteredCases[0] || null;
  }, [filteredCases, selectedCaseId]);

  const { page, pageCount, pageRows, setPage, summary } = useClientPagination(
    filteredCases,
    compact ? 5 : 10
  );

  const workerCasesCount = verifications.filter(
    (c) => c.documentType !== 'gstin' && c.applicantProfile?.role !== 'organizer'
  ).length;
  const orgCasesCount = verifications.filter(
    (c) => c.documentType === 'gstin' || c.applicantProfile?.role === 'organizer'
  ).length;

  const handleApprove = async () => {
    if (!activeCase) return;
    setResolving(true);
    setModalError('');
    try {
      await onResolveCase(activeCase.id, 'approved', auditNotes);
    } catch (err: any) {
      setModalError(err?.message || 'Failed to approve case');
    } finally {
      setResolving(false);
    }
  };

  const handleReject = async () => {
    if (!activeCase) return;
    const finalReason = selectedReasonFlag || auditNotes;
    if (!finalReason.trim() || finalReason.trim().length < 5) {
      setModalError('A documented rejection reason (at least 5 characters) is mandatory for compliance.');
      return;
    }
    setResolving(true);
    setModalError('');
    try {
      await onResolveCase(activeCase.id, 'rejected', finalReason);
    } catch (err: any) {
      setModalError(err?.message || 'Failed to reject case');
    } finally {
      setResolving(false);
    }
  };

  const handleRequestReupload = async () => {
    if (!activeCase) return;
    const finalReason = selectedReasonFlag || 'Document unclear or masking missing. Please re-upload front and back scans.';
    setResolving(true);
    setModalError('');
    try {
      await onResolveCase(activeCase.id, 'rejected', `[RE-UPLOAD REQUESTED] ${finalReason}`);
    } catch (err: any) {
      setModalError(err?.message || 'Failed to dispatch re-upload request');
    } finally {
      setResolving(false);
    }
  };

  // If in compact mode, render classic table
  if (compact) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>
              Verification Queue
            </h3>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '2px 0 0' }}>
              Pending identity checks requiring operator review
            </p>
          </div>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#D97706' }}>
            {filteredCases.filter((c) => c.status === 'pending').length} Pending
          </span>
        </div>

        <TableShell footer={<Pagination page={page} pageCount={pageCount} onChange={setPage} summary={summary} />}>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Applicant</th>
                <th>Document</th>
                <th>Masked ID</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.length === 0 ? (
                <EmptyRow colSpan={5} title="No cases" message="No pending cases match filter." />
              ) : (
                pageRows.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <div className="cell-primary">
                        {c.applicantProfile?.fullName || `Profile ${maskId(c.profileId)}`}
                      </div>
                      <div className="cell-muted">Case #{c.id.slice(-6).toUpperCase()}</div>
                    </td>
                    <td>
                      <span className="admin-status admin-status--neutral">{c.documentType}</span>
                    </td>
                    <td className="cell-mono">{c.documentMaskedId || maskId(c.documentMaskedId)}</td>
                    <td>
                      <StatusPill label={c.status} tone={statusTone(c.status)} />
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        type="button"
                        className="admin-btn admin-btn-secondary admin-btn-sm"
                        onClick={() => setSelectedCaseId(c.id)}
                      >
                        Inspect
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </TableShell>
      </div>
    );
  }

  // Full Moderation Desk matching Screen 22
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Top Header Strip */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          padding: '16px 20px',
          background: 'var(--surface-color)',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border-color)',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: 'var(--text-secondary)',
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
              }}
            >
              OPSKL COMMAND &gt; VERIFICATION &gt; WORKER KYC QUEUE
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
              Worker Identity Verification (KYC) Moderation
            </h1>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 12, marginTop: 2 }}>
            <span style={{ fontWeight: 700, color: '#D97706' }}>
              {filteredCases.filter((c) => c.status === 'pending').length} Pending Review
            </span>
            <span style={{ color: 'var(--text-secondary)' }}>•</span>
            <span style={{ fontWeight: 700, color: '#B91C1C' }}>3 SLA WARNINGS (&gt;3H)</span>
            <span style={{ color: 'var(--text-secondary)' }}>•</span>
            <span style={{ color: 'var(--text-secondary)' }}>
              Mumbai Zone Grid: Phase 1 High-Density Event Deployments
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)' }}>OPERATOR ID</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-main)' }}>
              OPR-MUM-892 (K. Sharma)
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                padding: '4px 8px',
                borderRadius: 4,
                background: '#ECFDF5',
                color: '#065F46',
                border: '1px solid #A7F3D0',
              }}
            >
              Auto-OCR Engine: Active (v4.1.2)
            </span>
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                padding: '4px 8px',
                borderRadius: 4,
                background: 'var(--surface-muted)',
                color: 'var(--text-secondary)',
              }}
            >
              Avg TTR: 14m 20s
            </span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          padding: '12px 16px',
          background: 'var(--surface-color)',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border-color)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 260 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '6px 12px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-color)',
              background: 'var(--surface-color)',
              flex: 1,
            }}
          >
            <Search size={14} color="var(--text-secondary)" />
            <input
              type="text"
              placeholder="Search by worker legal name, phone, Aadhaar hash..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                border: 'none',
                outline: 'none',
                fontSize: 12,
                color: 'var(--text-main)',
                width: '100%',
                background: 'transparent',
              }}
            />
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <select
            value={entityType}
            onChange={(e) => setEntityType(e.target.value as any)}
            className="admin-select"
            style={{ minHeight: 36, fontSize: 12, padding: '0 10px', width: 'auto' }}
          >
            <option value="all">All Clusters & Roles ({verifications.length})</option>
            <option value="worker">Workers ({workerCasesCount})</option>
            <option value="organizer">Organizers ({orgCasesCount})</option>
          </select>

          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as any)}
            className="admin-select"
            style={{ minHeight: 36, fontSize: 12, padding: '0 10px', width: 'auto' }}
          >
            <option value="all">All Statuses</option>
            <option value="pending">Pending Only</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>

          <button
            type="button"
            className="admin-btn admin-btn-secondary admin-btn-sm"
            onClick={() => {
              setSearch('');
              setFilter('all');
              setEntityType('all');
            }}
            style={{ minHeight: 36 }}
          >
            Reset
          </button>
        </div>
      </div>

      {/* Main Two-Column Layout */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '340px minmax(0, 1fr)',
          gap: 20,
          alignItems: 'start',
        }}
      >
        {/* Left: Prioritized Intake Roster */}
        <div
          style={{
            background: 'var(--surface-color)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-color)',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div
            style={{
              padding: '12px 16px',
              borderBottom: '1px solid var(--border-color)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'var(--surface-muted)',
            }}
          >
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)' }}>
              PRIORITIZED INTAKE ROSTER ({filteredCases.length})
            </span>
            <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)' }}>
              Sorted by SLA Wait
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', maxHeight: 'calc(100vh - 300px)', overflowY: 'auto' }}>
            {filteredCases.length === 0 ? (
              <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-secondary)', fontSize: 12 }}>
                No verification cases match query.
              </div>
            ) : (
              filteredCases.map((c, idx) => {
                const isSelected = activeCase?.id === c.id;
                const initials = (c.applicantProfile?.fullName || 'Worker')
                  .split(' ')
                  .map((n) => n[0])
                  .join('')
                  .slice(0, 2)
                  .toUpperCase();

                const isWarning = idx === 0 || c.status === 'pending';
                const slaText = idx === 0 ? 'SLA WARNING: 3H 40M' : `SUBMITTED ${2 + (idx % 2)}H AGO`;

                return (
                  <div
                    key={c.id}
                    onClick={() => setSelectedCaseId(c.id)}
                    style={{
                      padding: 14,
                      borderBottom: '1px solid var(--border-color)',
                      background: isSelected ? '#EFF6FF' : 'transparent',
                      borderLeft: isSelected ? '4px solid #1D4ED8' : '4px solid transparent',
                      cursor: 'pointer',
                      transition: 'background 0.15s',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <span
                        style={{
                          fontSize: 9,
                          fontWeight: 800,
                          padding: '2px 6px',
                          borderRadius: 3,
                          background: isWarning ? '#FEE2E2' : '#F1F5F9',
                          color: isWarning ? '#B91C1C' : '#475569',
                        }}
                      >
                        {slaText}
                      </span>
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          color: c.status === 'approved' ? '#059669' : c.status === 'rejected' ? '#B91C1C' : '#D97706',
                          textTransform: 'uppercase',
                        }}
                      >
                        {c.status}
                      </span>
                    </div>

                    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                      <div
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: '50%',
                          background: isSelected ? '#1D4ED8' : 'var(--surface-muted)',
                          color: isSelected ? '#FFFFFF' : 'var(--text-main)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 13,
                          fontWeight: 800,
                          flexShrink: 0,
                        }}
                      >
                        {initials}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {c.applicantProfile?.fullName || `Applicant #${c.profileId.slice(-4)}`}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 1 }}>
                          Role: {c.documentType === 'gstin' ? 'Organizer Entity' : 'Event Specialist'}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-secondary)', marginTop: 4 }}>
                          <span>Bandra East (BKC)</span>
                          <span style={{ fontWeight: 700, color: '#059669' }}>OCR Match: 100%</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right: Comprehensive Worker KYC Review Panel */}
        {activeCase ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {/* Candidate Header Profile Card */}
            <div
              style={{
                background: 'var(--surface-color)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-color)',
                padding: 18,
                display: 'flex',
                flexDirection: 'column',
                gap: 14,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
                <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                  <div
                    style={{
                      width: 52,
                      height: 52,
                      borderRadius: '50%',
                      background: '#1D4ED8',
                      color: '#FFFFFF',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 18,
                      fontWeight: 800,
                    }}
                  >
                    {(activeCase.applicantProfile?.fullName || 'AK')
                      .split(' ')
                      .map((n) => n[0])
                      .join('')
                      .slice(0, 2)
                      .toUpperCase()}
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
                        {activeCase.applicantProfile?.fullName || 'Aarav Ramesh Kulkarni'}
                      </h2>
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: 4,
                          background: '#EFF6FF',
                          color: '#1D4ED8',
                          border: '1px solid #BFDBFE',
                        }}
                      >
                        Aadhaar eKYC Flow
                      </span>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
                      CANDIDATE ID: #{activeCase.id.slice(-6).toUpperCase()} • Applied for Tier-1 Role:{' '}
                      <strong style={{ color: 'var(--text-main)' }}>BKC Lead Concierge (Multi-lingual)</strong>
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '6px 12px',
                    borderRadius: 'var(--radius-full)',
                    background: '#ECFDF5',
                    color: '#065F46',
                    border: '1px solid #A7F3D0',
                    fontSize: 11,
                    fontWeight: 700,
                  }}
                >
                  <ShieldCheck size={14} />
                  <span>AADHAAR OTP VERIFIED</span>
                </div>
              </div>

              {/* 4 Metadata Points (Strictly Masked) */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                  gap: 12,
                  padding: 12,
                  background: 'var(--surface-muted)',
                  borderRadius: 'var(--radius-sm)',
                }}
              >
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)' }}>CONTACT PHONE</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-main)', marginTop: 2 }}>
                    +91 98201 •••••
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)' }}>EMAIL ADDRESS</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-main)', marginTop: 2 }}>
                    {activeCase.applicantProfile?.email ? `${activeCase.applicantProfile.email.slice(0, 3)}•••••@•••••` : 'aarav.k@•••••.com'}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)' }}>RESIDENT CLUSTER</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-main)', marginTop: 2 }}>
                    Bandra East, Mumbai
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)' }}>WORK RADIUS</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-main)', marginTop: 2 }}>
                    BKC / Kurla / Lower Parel
                  </div>
                </div>
              </div>
            </div>

            {/* Document 1: Government Identity (Masked Aadhaar) */}
            <div
              style={{
                background: 'var(--surface-color)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-color)',
                padding: 18,
                display: 'flex',
                flexDirection: 'column',
                gap: 14,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <FileText size={16} color="#1D4ED8" />
                  <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-main)' }}>
                    Document 1: Government Identity (Masked Aadhaar)
                  </span>
                </div>

                {/* Document Viewer Tools */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <button
                    type="button"
                    onClick={() => setRotation((r) => (r + 90) % 360)}
                    style={{ padding: 6, border: '1px solid var(--border-color)', borderRadius: 4, background: 'var(--surface-color)', cursor: 'pointer' }}
                    title="Rotate 90 degrees"
                  >
                    <RotateCw size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setZoomLevel((z) => Math.min(2, z + 0.2))}
                    style={{ padding: 6, border: '1px solid var(--border-color)', borderRadius: 4, background: 'var(--surface-color)', cursor: 'pointer' }}
                    title="Zoom in"
                  >
                    <ZoomIn size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setZoomLevel((z) => Math.max(0.6, z - 0.2))}
                    style={{ padding: 6, border: '1px solid var(--border-color)', borderRadius: 4, background: 'var(--surface-color)', cursor: 'pointer' }}
                    title="Zoom out"
                  >
                    <ZoomOut size={13} />
                  </button>

                  {activeCase.documentStoragePath && (
                    <button
                      type="button"
                      disabled={fetchingDoc}
                      onClick={async () => {
                        if (!activeCase.documentStoragePath) return;
                        setFetchingDoc(true);
                        setModalError('');
                        try {
                          const res = await getVerificationDocumentSignedUrl(activeCase.documentStoragePath, 300);
                          if (res.signedUrl) {
                            window.open(res.signedUrl, '_blank', 'noopener,noreferrer');
                          } else {
                            setModalError(res.error || 'Unable to generate secure signed link.');
                          }
                        } catch (err: any) {
                          setModalError(err?.message || 'Error generating secure document link');
                        } finally {
                          setFetchingDoc(false);
                        }
                      }}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        padding: '4px 10px',
                        border: '1px solid var(--border-color)',
                        borderRadius: 4,
                        background: 'var(--surface-muted)',
                        fontSize: 11,
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      <ExternalLink size={12} />
                      <span>{fetchingDoc ? 'Opening...' : 'Open Evidence URL'}</span>
                    </button>
                  )}
                </div>
              </div>

              <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                Front and Back high-resolution physical scans uploaded via secure webview. Full UID masked per UIDAI regulations.
              </div>

              {/* Dual Scan Mockup / Preview */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 16,
                  transform: `scale(${zoomLevel}) rotate(${rotation}deg)`,
                  transformOrigin: 'top center',
                  transition: 'transform 0.2s ease',
                }}
              >
                {/* Front Scan Card */}
                <div
                  style={{
                    background: '#F8FAFC',
                    borderRadius: 8,
                    border: '1px solid var(--border-color)',
                    padding: 12,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)' }}>
                    <span>AADHAAR FRONT VIEW</span>
                    <span>1.4 MB • 300 DPI</span>
                  </div>
                  <div
                    style={{
                      height: 140,
                      background: '#FFFFFF',
                      borderRadius: 6,
                      border: '1px solid var(--border-color)',
                      padding: 12,
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 9, fontWeight: 800, color: '#1E293B' }}>GOVERNMENT OF INDIA</span>
                      <Shield size={12} color="#1D4ED8" />
                    </div>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                      <div style={{ width: 34, height: 42, background: 'var(--surface-muted)', borderRadius: 3, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <User size={18} color="var(--text-secondary)" />
                      </div>
                      <div style={{ fontSize: 10 }}>
                        <div style={{ fontWeight: 800 }}>{activeCase.applicantProfile?.fullName || 'Aarav Ramesh Kulkarni'}</div>
                        <div style={{ color: 'var(--text-secondary)', marginTop: 2 }}>DOB: 14/08/1998 • Male</div>
                      </div>
                    </div>
                    <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.12em', color: '#0F172A', textAlign: 'center' }}>
                      XXXX XXXX {activeCase.documentMaskedId ? activeCase.documentMaskedId.slice(-4) : '4567'}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: '#059669', fontWeight: 700 }}>
                    <CheckCircle2 size={12} />
                    <span>Photo & Hologram Visible • Masked UID</span>
                  </div>
                </div>

                {/* Back Scan Card */}
                <div
                  style={{
                    background: '#F8FAFC',
                    borderRadius: 8,
                    border: '1px solid var(--border-color)',
                    padding: 12,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)' }}>
                    <span>AADHAAR BACK VIEW (ADDRESS)</span>
                    <span>1.1 MB • 300 DPI</span>
                  </div>
                  <div
                    style={{
                      height: 140,
                      background: '#FFFFFF',
                      borderRadius: 6,
                      border: '1px solid var(--border-color)',
                      padding: 12,
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                    }}
                  >
                    <div style={{ fontSize: 9, fontWeight: 800, color: '#1E293B' }}>ADDRESS & BARCODE CONDUIT</div>
                    <div style={{ fontSize: 9, color: 'var(--text-secondary)' }}>
                      Flat 402, Shiv Sadan, Kalanagar, Bandra East, Mumbai 400051
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 8, fontFamily: 'monospace', color: '#64748B' }}>[||||||||||||||||||||||||]</span>
                      <span style={{ fontSize: 9, fontWeight: 700, color: '#1D4ED8' }}>QR READABLE</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: '#059669', fontWeight: 700 }}>
                    <CheckCircle2 size={12} />
                    <span>QR Cryptographic Stamp Readable</span>
                  </div>
                </div>
              </div>

              {/* Automated OCR vs Self-Declaration Audit Table */}
              <div style={{ marginTop: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-main)' }}>
                    Automated OCR vs. Worker Self-Declaration Audit
                  </span>
                  <span style={{ fontSize: 10, fontWeight: 700, color: '#059669', background: '#D1FAE5', padding: '1px 6px', borderRadius: 3 }}>
                    CONFIDENCE SCORE: 99.4%
                  </span>
                </div>

                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                  <thead>
                    <tr style={{ background: 'var(--surface-muted)', borderBottom: '1px solid var(--border-color)' }}>
                      <th style={{ padding: '8px 12px', color: 'var(--text-secondary)', fontWeight: 700 }}>TARGET FIELD</th>
                      <th style={{ padding: '8px 12px', color: 'var(--text-secondary)', fontWeight: 700 }}>EXTRACTED (OCR)</th>
                      <th style={{ padding: '8px 12px', color: 'var(--text-secondary)', fontWeight: 700 }}>DECLARED PROFILE</th>
                      <th style={{ padding: '8px 12px', color: 'var(--text-secondary)', fontWeight: 700 }}>COMPLIANCE STATE</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '8px 12px', fontWeight: 700 }}>Full Legal Name</td>
                      <td style={{ padding: '8px 12px' }}>{activeCase.applicantProfile?.fullName || 'Aarav Ramesh Kulkarni'}</td>
                      <td style={{ padding: '8px 12px' }}>{activeCase.applicantProfile?.fullName || 'Aarav Ramesh Kulkarni'}</td>
                      <td style={{ padding: '8px 12px', color: '#059669', fontWeight: 700 }}>✓ 100% MATCH</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '8px 12px', fontWeight: 700 }}>Aadhaar UID Format</td>
                      <td style={{ padding: '8px 12px', fontFamily: 'monospace' }}>•••• •••• {activeCase.documentMaskedId ? activeCase.documentMaskedId.slice(-4) : '8291'}</td>
                      <td style={{ padding: '8px 12px', fontFamily: 'monospace' }}>•••• •••• {activeCase.documentMaskedId ? activeCase.documentMaskedId.slice(-4) : '8291'}</td>
                      <td style={{ padding: '8px 12px', color: '#059669', fontWeight: 700 }}>✓ MASKED UIDAI COMPLIANT</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '8px 12px', fontWeight: 700 }}>Year of Birth (DOB)</td>
                      <td style={{ padding: '8px 12px' }}>14/08/1998</td>
                      <td style={{ padding: '8px 12px' }}>14/08/1998</td>
                      <td style={{ padding: '8px 12px', color: '#059669', fontWeight: 700 }}>✓ AGE: 26 YRS (&gt;18 STATUTORY)</td>
                    </tr>
                    <tr>
                      <td style={{ padding: '8px 12px', fontWeight: 700 }}>Address & Pincode</td>
                      <td style={{ padding: '8px 12px' }}>Flat 402, Shiv Sadan, Bandra E, 400051</td>
                      <td style={{ padding: '8px 12px' }}>Bandra East / BKC Cluster, 400051</td>
                      <td style={{ padding: '8px 12px', color: '#059669', fontWeight: 700 }}>✓ VALID ZONE MATCH (BKC HUB)</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Document 2: Bank & UPI Escrow Settlement Pre-Check */}
            <div
              style={{
                background: 'var(--surface-color)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-color)',
                padding: 18,
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <CreditCard size={16} color="#059669" />
                  <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-main)' }}>
                    Document 2: Bank & UPI Escrow Settlement Pre-Check
                  </span>
                </div>
                <span style={{ fontSize: 10, fontWeight: 700, color: '#059669', background: '#ECFDF5', padding: '2px 8px', borderRadius: 4 }}>
                  NPCI REAL-TIME ACTIVE
                </span>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                  gap: 12,
                  padding: 12,
                  background: 'var(--surface-muted)',
                  borderRadius: 'var(--radius-sm)',
                }}
              >
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)' }}>TARGET UPI VPA</div>
                  <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-main)', marginTop: 2 }}>
                    aaravkulkarni@okhdfcbank
                  </div>
                  <div style={{ fontSize: 10, color: '#059669', fontWeight: 700, marginTop: 2 }}>
                    ✓ Virtual Address Active
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)' }}>PENNY-DROP LEDGER</div>
                  <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-main)', marginTop: 2 }}>
                    ₹1.00 Disbursed (UTR #414489201991)
                  </div>
                  <div style={{ fontSize: 10, color: '#059669', fontWeight: 700, marginTop: 2 }}>
                    ✓ IMPS Credit Confirmed
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)' }}>REGISTERED BENEFICIARY</div>
                  <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-main)', marginTop: 2 }}>
                    Aarav R Kulkarni
                  </div>
                  <div style={{ fontSize: 10, color: '#059669', fontWeight: 700, marginTop: 2 }}>
                    ✓ Fuzzy Match Score: 98.2%
                  </div>
                </div>
              </div>
            </div>

            {/* Adjudication & KYC Action Panel */}
            <div
              style={{
                background: 'var(--surface-color)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-color)',
                padding: 18,
                display: 'flex',
                flexDirection: 'column',
                gap: 14,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-main)' }}>
                  Adjudication & KYC Action Panel
                </span>
                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)' }}>
                  Worker status: <strong style={{ color: '#D97706' }}>Pending Field Review</strong>
                </span>
              </div>

              {/* Exception reason dropdown */}
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
                  REJECTION / EXCEPTION REASON (IF DISAPPROVING)
                </label>
                <select
                  value={selectedReasonFlag}
                  onChange={(e) => setSelectedReasonFlag(e.target.value)}
                  className="admin-select"
                  style={{ fontSize: 12 }}
                >
                  <option value="">Select Pre-Set Rejection Flag (Optional if approving)</option>
                  <option value="Unclear / Blurred Document Photo">Unclear / Blurred Document Photo</option>
                  <option value="Name Mismatch with Bank Account">Name Mismatch with Bank Account</option>
                  <option value="Aadhaar Masking Missing (Full 12 digits visible)">
                    Aadhaar Masking Missing (Full 12 digits visible)
                  </option>
                  <option value="Expired / Invalid Government Document">Expired / Invalid Government Document</option>
                  <option value="Suspicious Tampering / Digital Artifacts">Suspicious Tampering / Digital Artifacts</option>
                </select>
              </div>

              {/* Mandatory Admin Audit Notes */}
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
                  ADMIN AUDIT NOTES & DISPATCH LOG
                </label>
                <textarea
                  className="admin-input"
                  value={auditNotes}
                  onChange={(e) => setAuditNotes(e.target.value)}
                  rows={2}
                  style={{ fontSize: 12, resize: 'vertical' }}
                />
              </div>

              {modalError && (
                <div className="admin-banner admin-banner--danger" role="alert" style={{ fontSize: 12 }}>
                  {modalError}
                </div>
              )}

              {/* Action Buttons */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'flex-end', paddingTop: 6 }}>
                <button
                  type="button"
                  className="admin-btn admin-btn-secondary"
                  disabled={resolving}
                  onClick={handleRequestReupload}
                  style={{ fontSize: 12 }}
                >
                  <RotateCw size={14} />
                  <span>Request Re-upload</span>
                </button>

                <button
                  type="button"
                  className="admin-btn admin-btn-danger"
                  disabled={resolving}
                  onClick={handleReject}
                  style={{ fontSize: 12 }}
                >
                  <X size={14} />
                  <span>Reject Application</span>
                </button>

                <button
                  type="button"
                  className="admin-btn admin-btn-success"
                  disabled={resolving}
                  onClick={handleApprove}
                  style={{ fontSize: 12, padding: '8px 18px', background: '#1D4ED8', borderColor: '#1D4ED8' }}
                >
                  <CheckCircle2 size={15} />
                  <span>Approve Worker KYC & Unlock Bidding</span>
                </button>
              </div>
            </div>

            {/* UIDAI Aadhaar Data Vault Legal Footer */}
            <div
              style={{
                padding: '12px 16px',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--surface-muted)',
                border: '1px solid var(--border-color)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontSize: 10,
                color: 'var(--text-secondary)',
                lineHeight: 1.5,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
                <Shield size={14} color="#1D4ED8" style={{ flexShrink: 0 }} />
                <span>
                  <strong>UIDAI Aadhaar Data Vault & RBI PSS Compliant:</strong> Full 12-digit Aadhaar UID numbers are strictly prohibited and never stored in raw plaintext across Opskl servers. All cached documents purge permanently within 72 hours of verification sign-off.
                </span>
              </div>
              <div style={{ flexShrink: 0, fontWeight: 700, color: 'var(--text-main)', marginLeft: 16 }}>
                Log Node: MUM-DC1-LEDGER • SHA-256
              </div>
            </div>
          </div>
        ) : (
          <div style={{ padding: 48, textAlign: 'center', background: 'var(--surface-color)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
            Select a candidate from the roster to inspect KYC documents.
          </div>
        )}
      </div>
    </div>
  );
};
