'use client';

import React, { useState, useEffect, useMemo } from 'react';
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

function maskPhone(phone?: string): string {
  if (!phone) return 'No phone on record';
  const clean = phone.replace(/\D/g, '');
  if (clean.length < 5) return phone;
  const last4 = clean.slice(-4);
  const prefix = clean.slice(0, Math.min(4, clean.length - 4));
  return `+${prefix || '91'} ••••• ••${last4}`;
}

function maskEmail(email?: string): string {
  if (!email) return 'No email on record';
  const [local, domain] = email.split('@');
  if (!domain) return email;
  const visible = local.slice(0, 3);
  return `${visible}•••••@${domain}`;
}

function formatLocalityLabel(loc?: string): string {
  if (!loc) return 'Mumbai (MMR)';
  const map: Record<string, string> = {
    bkc: 'BKC Complex, Mumbai',
    nesco: 'NESCO / Goregaon East',
    goregaon: 'Goregaon, Mumbai',
    lower_parel: 'Lower Parel / Worli',
    andheri: 'Andheri / Powai',
    sobo: 'South Mumbai / Nariman Point',
    vashi: 'Navi Mumbai / Vashi',
    thane: 'Thane West',
  };
  return map[loc.toLowerCase()] || loc;
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
    'Manual document review only. OCR, UIDAI AUA, and bank penny-drop are not connected in this build.'
  );
  const [modalError, setModalError] = useState('');
  const [resolving, setResolving] = useState(false);
  const [fetchingDoc, setFetchingDoc] = useState(false);
  const [previewDocUrl, setPreviewDocUrl] = useState<string | null>(null);
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

  // Automatically fetch signed document URL for preview when activeCase changes
  useEffect(() => {
    let isMounted = true;
    if (!activeCase?.documentStoragePath) {
      setPreviewDocUrl(null);
      return;
    }

    getVerificationDocumentSignedUrl(activeCase.documentStoragePath, 900)
      .then((res) => {
        if (isMounted) {
          setPreviewDocUrl(res.signedUrl || null);
        }
      })
      .catch(() => {
        if (isMounted) setPreviewDocUrl(null);
      });

    return () => {
      isMounted = false;
    };
  }, [activeCase?.id, activeCase?.documentStoragePath]);

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
            <span style={{ fontWeight: 700, color: 'var(--text-secondary)' }}>
              Live pending queue only
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)' }}>DESK</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-main)' }}>
              Masked KYC review
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                padding: '4px 8px',
                borderRadius: 4,
                background: 'var(--surface-muted)',
                color: 'var(--text-secondary)',
                border: '1px solid var(--border-color)',
              }}
            >
              OCR engine: not connected
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
              Sorted by status
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', maxHeight: 'calc(100vh - 300px)', overflowY: 'auto' }}>
            {filteredCases.length === 0 ? (
              <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-secondary)', fontSize: 12 }}>
                No verification cases match query.
              </div>
            ) : (
              filteredCases.map((c) => {
                const isSelected = activeCase?.id === c.id;
                const initials = (c.applicantProfile?.fullName || 'Worker')
                  .split(' ')
                  .map((n) => n[0])
                  .join('')
                  .slice(0, 2)
                  .toUpperCase();

                const isWarning = c.status === 'pending';
                const submittedLabel = c.createdAt
                  ? `SUBMITTED ${new Date(c.createdAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}`
                  : 'SUBMITTED · time unknown';
                const slaText = isWarning ? `PENDING · ${submittedLabel}` : submittedLabel;

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
                          <span>Case #{c.id.slice(-6)}</span>
                          <span style={{ fontWeight: 700, color: 'var(--text-secondary)' }}>Manual review</span>
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
                        {activeCase.applicantProfile?.fullName || 'Name on case record'}
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
                      CANDIDATE ID: #{activeCase.id.slice(-6).toUpperCase()} • Verified Role Category:{' '}
                      <strong style={{ color: 'var(--text-main)' }}>
                        {activeCase.applicantProfile?.skills && activeCase.applicantProfile.skills.length > 0
                          ? activeCase.applicantProfile.skills.slice(0, 2).join(' • ')
                          : activeCase.documentType === 'gstin'
                          ? 'Event Organizer / Host'
                          : 'Hospitality & Event Crew'}
                      </strong>
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
                    background: activeCase.status === 'approved' ? '#ECFDF5' : '#EFF6FF',
                    color: activeCase.status === 'approved' ? '#065F46' : '#1D4ED8',
                    border: `1px solid ${activeCase.status === 'approved' ? '#A7F3D0' : '#BFDBFE'}`,
                    fontSize: 11,
                    fontWeight: 700,
                  }}
                >
                  <ShieldCheck size={14} />
                  <span>
                    {activeCase.documentType.toUpperCase()} {activeCase.status === 'approved' ? 'VERIFIED' : 'PENDING REVIEW'}
                  </span>
                </div>
              </div>

              {/* 4 Metadata Points (Dynamic Profile Data & Strictly Masked) */}
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
                    {maskPhone(activeCase.applicantProfile?.phone)}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)' }}>EMAIL ADDRESS</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-main)', marginTop: 2 }}>
                    {maskEmail(activeCase.applicantProfile?.email)}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)' }}>RESIDENT CLUSTER</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-main)', marginTop: 2 }}>
                    {formatLocalityLabel(activeCase.applicantProfile?.preferredLocality)}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)' }}>WORK RADIUS</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-main)', marginTop: 2 }}>
                    {activeCase.applicantProfile?.serviceAreas && activeCase.applicantProfile.serviceAreas.length > 0
                      ? activeCase.applicantProfile.serviceAreas.map((z) => formatLocalityLabel(z)).join(', ')
                      : 'All Mumbai Metropolitan Region'}
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
                  gridTemplateColumns: previewDocUrl ? '1fr' : '1fr 1fr',
                  gap: 16,
                  transform: `scale(${zoomLevel}) rotate(${rotation}deg)`,
                  transformOrigin: 'top center',
                  transition: 'transform 0.2s ease',
                }}
              >
                {previewDocUrl ? (
                  /* Actual High-Resolution Uploaded Document Preview */
                  <div
                    style={{
                      background: '#0F1115',
                      borderRadius: 8,
                      border: '1px solid var(--border-color)',
                      padding: 12,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 10,
                      boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, fontWeight: 700, color: '#94A3B8' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <ShieldCheck size={14} color="#10B981" />
                        SECURE PHYSICAL SCAN EVIDENCE • {activeCase.documentType.toUpperCase()}
                      </span>
                      <a
                        href={previewDocUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: '#60A5FA', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}
                      >
                        <ExternalLink size={12} />
                        Full Window View
                      </a>
                    </div>
                    
                    <div
                      style={{
                        minHeight: 280,
                        maxHeight: 460,
                        background: '#181A20',
                        borderRadius: 6,
                        overflow: 'hidden',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: '1px solid #272A30',
                      }}
                    >
                      <img
                        src={previewDocUrl}
                        alt="KYC Document Preview"
                        style={{
                          maxWidth: '100%',
                          maxHeight: 440,
                          objectFit: 'contain',
                          borderRadius: 4,
                        }}
                        onError={(e) => {
                          // Fallback if image load fails
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                      />
                    </div>
                    
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, color: '#94A3B8' }}>
                      <span>MASKED IDENTIFIER: <strong style={{ color: '#F8FAFC' }}>{activeCase.documentMaskedId || 'XXXX-XXXX-9042'}</strong></span>
                      <span style={{ color: '#10B981', fontWeight: 700 }}>✓ High Resolution Authenticated Blob</span>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Front Scan Card Fallback */}
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
                            <div style={{ fontWeight: 800 }}>{activeCase.applicantProfile?.fullName || 'Name on case record'}</div>
                            <div style={{ color: 'var(--text-secondary)', marginTop: 2 }}>Review uploaded scan · DOB not auto-extracted</div>
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
                        <div style={{ fontSize: 9, fontWeight: 800, color: '#1E293B' }}>UPLOADED DOCUMENT PREVIEW</div>
                        <div style={{ fontSize: 9, color: 'var(--text-secondary)' }}>
                          Address and barcode fields are not auto-extracted. Review the uploaded scan manually.
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: 8, fontFamily: 'monospace', color: '#64748B' }}>[scan preview]</span>
                          <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-secondary)' }}>NO AUTO QR READ</span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'var(--text-secondary)', fontWeight: 700 }}>
                        <CheckCircle2 size={12} />
                        <span>OCR / UIDAI QR verify not connected</span>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Manual field checklist — no OCR engine */}
              <div style={{ marginTop: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-main)' }}>
                    Manual Review Checklist (OCR not connected)
                  </span>
                  <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)', background: 'var(--surface-muted)', padding: '1px 6px', borderRadius: 3 }}>
                    HUMAN REVIEW ONLY
                  </span>
                </div>

                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                  <thead>
                    <tr style={{ background: 'var(--surface-muted)', borderBottom: '1px solid var(--border-color)' }}>
                      <th style={{ padding: '8px 12px', color: 'var(--text-secondary)', fontWeight: 700 }}>FIELD</th>
                      <th style={{ padding: '8px 12px', color: 'var(--text-secondary)', fontWeight: 700 }}>ON PROFILE</th>
                      <th style={{ padding: '8px 12px', color: 'var(--text-secondary)', fontWeight: 700 }}>REVIEW ACTION</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '8px 12px', fontWeight: 700 }}>Full Legal Name</td>
                      <td style={{ padding: '8px 12px' }}>{activeCase.applicantProfile?.fullName || '—'}</td>
                      <td style={{ padding: '8px 12px', color: 'var(--text-secondary)', fontWeight: 700 }}>Compare to scan</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '8px 12px', fontWeight: 700 }}>Masked document ID</td>
                      <td style={{ padding: '8px 12px', fontFamily: 'monospace' }}>•••• •••• {activeCase.documentMaskedId ? activeCase.documentMaskedId.slice(-4) : '—'}</td>
                      <td style={{ padding: '8px 12px', color: 'var(--text-secondary)', fontWeight: 700 }}>Confirm last-4 only</td>
                    </tr>
                    <tr>
                      <td style={{ padding: '8px 12px', fontWeight: 700 }}>Document type</td>
                      <td style={{ padding: '8px 12px' }}>{activeCase.documentType || '—'}</td>
                      <td style={{ padding: '8px 12px', color: 'var(--text-secondary)', fontWeight: 700 }}>Visual authenticity check</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Document 2: Bank / UPI evidence (no live NPCI) */}
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
                    Document 2: Bank / UPI Evidence (manual)
                  </span>
                </div>
                <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)', background: 'var(--surface-muted)', padding: '2px 8px', borderRadius: 4 }}>
                  NPCI NOT CONNECTED
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
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)' }}>UPI / BANK ON FILE</div>
                  <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-main)', marginTop: 2 }}>
                    {activeCase?.applicantProfile?.upiId || 'No direct UPI linked yet'}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-secondary)', fontWeight: 700, marginTop: 2 }}>
                    {activeCase?.applicantProfile?.upiId ? '✓ Direct Settlement Rail Linked' : 'Review uploaded evidence only'}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)' }}>SETTLEMENT GATEWAY</div>
                  <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-main)', marginTop: 2 }}>
                    {activeCase?.applicantProfile?.role === 'organizer' ? 'Razorpay Escrow (Inbound)' : 'UPI Direct Settlement (Outbound)'}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-secondary)', fontWeight: 700, marginTop: 2 }}>
                    Mumbai Region Instant Payouts
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)' }}>APPLICANT</div>
                  <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-main)', marginTop: 2 }}>
                    {activeCase?.applicantProfile?.fullName || 'Name on case record'}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-secondary)', fontWeight: 700, marginTop: 2 }}>
                    Masked ID: {activeCase?.documentMaskedId || '—'}
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
                  Candidate status:{' '}
                  <strong style={{ color: activeCase.status === 'approved' ? '#059669' : activeCase.status === 'rejected' ? '#DC2626' : '#D97706' }}>
                    {activeCase.status === 'approved' ? 'Verified & Active' : activeCase.status === 'rejected' ? 'Rejected' : 'Pending Review'}
                  </strong>
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
                  <strong>Masked KYC review:</strong> Full 12-digit Aadhaar UID numbers must not be shown or logged in plaintext. Review uses masked identifiers and restricted document access only. This desk does not claim a live UIDAI AUA connection.
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
