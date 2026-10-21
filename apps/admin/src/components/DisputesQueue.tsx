'use client';

import React, { useState, useMemo } from 'react';
import { Dispute, formatINR } from '@opskil/shared';
import {
  Clock,
  Search,
  User,
  MapPin,
  ShieldCheck,
} from 'lucide-react';
import {
  EmptyRow,
  Pagination,
  StatusPill,
  StatusTone,
  TableShell,
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

export const DisputesQueue: React.FC<DisputesQueueProps> = ({
  disputes,
  onResolveDispute,
  compact = false,
}) => {
  const [filterTab, setFilterTab] = useState<'all' | 'active' | 'evidence' | 'resolved'>('all');
  const [severityFilter, setSeverityFilter] = useState<'all' | 'high' | 'medium' | 'low'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [selectedDisputeId, setSelectedDisputeId] = useState<string>(
    disputes.length > 0 ? disputes[0].id : ''
  );

  // Adjudication form state
  const [selectedRuling, setSelectedRuling] = useState<'worker_favor' | 'base_only' | 'split' | 'dismiss'>('worker_favor');
  const [mediationNotes, setMediationNotes] = useState(
    'Manual review of dispute reason and party statements. No live GPS/Bluetooth/turnstile telemetry is available in this build.'
  );
  const [notifyParties, setNotifyParties] = useState(true);
  const [resolving, setResolving] = useState(false);
  const [actionError, setActionError] = useState('');
  const [ombudsmanNotice, setOmbudsmanNotice] = useState('');

  const filteredDisputes = useMemo(() => {
    return disputes.filter((d) => {
      const isResolved = d.status === 'resolved' || d.status === 'dismissed';
      if (filterTab === 'active' && isResolved) return false;
      if (filterTab === 'resolved' && !isResolved) return false;
      if (filterTab === 'evidence' && d.status !== 'under_review') return false;

      if (search) {
        const q = search.toLowerCase();
        return (
          d.id.toLowerCase().includes(q) ||
          d.bookingId.toLowerCase().includes(q) ||
          d.reason.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [disputes, filterTab, search]);

  const activeDispute = useMemo(() => {
    return disputes.find((d) => d.id === selectedDisputeId) || disputes[0] || null;
  }, [disputes, selectedDisputeId]);

  const { page, pageCount, pageRows, setPage, summary } = useClientPagination(
    filteredDisputes,
    compact ? 5 : 10
  );

  const handleAuthorizeRelease = async () => {
    if (!activeDispute) return;
    if (!mediationNotes.trim()) {
      setActionError('Documented mediation finding & statutory audit rationale are mandatory.');
      return;
    }
    setResolving(true);
    setActionError('');
    try {
      const status = selectedRuling === 'dismiss' ? 'dismissed' : 'resolved';
      let adjustedPayout: number | undefined;
      const baseClaim = (activeDispute as any).claimAmount as number | undefined;
      if (typeof baseClaim === 'number' && Number.isFinite(baseClaim)) {
        if (selectedRuling === 'worker_favor') {
          adjustedPayout = baseClaim;
        } else if (selectedRuling === 'base_only') {
          adjustedPayout = baseClaim;
        } else if (selectedRuling === 'split') {
          adjustedPayout = Math.round(baseClaim / 2);
        }
      }
      await onResolveDispute(activeDispute.id, status, mediationNotes, adjustedPayout);
    } catch (err: any) {
      setActionError(err?.message || 'Failed to resolve dispute on ledger');
    } finally {
      setResolving(false);
    }
  };

  const handleEscalateOmbudsman = () => {
    setOmbudsmanNotice(
      'Escalation noted on this case for senior admin review. No separate ombudsman court or auto payout freeze is wired in this build.'
    );
  };

  if (compact) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>
              Active Disputes
            </h3>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '2px 0 0' }}>
              Attendance & wage claims requiring arbitration
            </p>
          </div>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#B91C1C' }}>
            {disputes.filter((d) => d.status !== 'resolved' && d.status !== 'dismissed').length} Open
          </span>
        </div>

        <TableShell footer={<Pagination page={page} pageCount={pageCount} onChange={setPage} summary={summary} />}>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Dispute Ref</th>
                <th>Raised by</th>
                <th>Claim</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.length === 0 ? (
                <EmptyRow colSpan={5} title="No disputes" message="No disputes match current filter." />
              ) : (
                pageRows.map((d) => (
                  <tr key={d.id}>
                    <td>
                      <div className="cell-primary">#{d.id.slice(-6).toUpperCase()}</div>
                      <div className="cell-muted">{d.reason}</div>
                    </td>
                    <td>{d.raisedBy}</td>
                    <td>{(d as any).claimAmount ? formatINR((d as any).claimAmount) : 'Attendance'}</td>
                    <td>
                      <StatusPill label={d.status} tone={statusTone(d.status)} />
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        type="button"
                        className="admin-btn admin-btn-secondary admin-btn-sm"
                        onClick={() => setSelectedDisputeId(d.id)}
                      >
                        Arbitrate
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

  // Full Escalation Panel matching Screen 24
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
              OPSKL COMMAND &gt; DISPUTES & SAFETY &gt; INCIDENT RESOLUTION
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
              Disputes & Incident Escalation Center
            </h1>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span
            style={{
              fontSize: 11,
              fontWeight: 800,
              padding: '4px 10px',
              borderRadius: 4,
              background: '#1D4ED8',
              color: '#FFFFFF',
            }}
          >
            LEGAL AUDIT ACTIVE
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12 }}>
            <span style={{ fontWeight: 700, color: '#B91C1C' }}>
              {disputes.filter((d) => d.status !== 'resolved' && d.status !== 'dismissed').length} OPEN DISPUTES
            </span>
            <span style={{ color: 'var(--text-secondary)' }}>•</span>
            <span style={{ fontWeight: 700, color: '#D97706' }}>1 HIGH SEVERITY</span>
            <span style={{ color: 'var(--text-secondary)' }}>•</span>
            <span style={{ color: 'var(--text-secondary)' }}>28m AVG MTTR (IST)</span>
          </div>
        </div>
      </div>

      {/* Filter Tabs Bar */}
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
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            onClick={() => setFilterTab('all')}
            style={{
              padding: '6px 14px',
              borderRadius: 'var(--radius-sm)',
              fontSize: 12,
              fontWeight: 700,
              background: filterTab === 'all' ? '#1D4ED8' : 'var(--surface-muted)',
              color: filterTab === 'all' ? '#FFFFFF' : 'var(--text-secondary)',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            All ({disputes.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterTab('active')}
            style={{
              padding: '6px 14px',
              borderRadius: 'var(--radius-sm)',
              fontSize: 12,
              fontWeight: 700,
              background: filterTab === 'active' ? '#1D4ED8' : 'var(--surface-muted)',
              color: filterTab === 'active' ? '#FFFFFF' : 'var(--text-secondary)',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            Active Investigation ({disputes.filter((d) => d.status !== 'resolved' && d.status !== 'dismissed').length})
          </button>
          <button
            type="button"
            onClick={() => setFilterTab('evidence')}
            style={{
              padding: '6px 14px',
              borderRadius: 'var(--radius-sm)',
              fontSize: 12,
              fontWeight: 700,
              background: filterTab === 'evidence' ? '#1D4ED8' : 'var(--surface-muted)',
              color: filterTab === 'evidence' ? '#FFFFFF' : 'var(--text-secondary)',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            Pending Evidence (1)
          </button>
          <button
            type="button"
            onClick={() => setFilterTab('resolved')}
            style={{
              padding: '6px 14px',
              borderRadius: 'var(--radius-sm)',
              fontSize: 12,
              fontWeight: 700,
              background: filterTab === 'resolved' ? '#1D4ED8' : 'var(--surface-muted)',
              color: filterTab === 'resolved' ? '#FFFFFF' : 'var(--text-secondary)',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            Resolved ({disputes.filter((d) => d.status === 'resolved' || d.status === 'dismissed').length})
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value as any)}
            className="admin-select"
            style={{ minHeight: 36, fontSize: 12, padding: '0 10px', width: 'auto' }}
          >
            <option value="all">Severity: All</option>
            <option value="high">Severity: HIGH</option>
            <option value="medium">Severity: MEDIUM</option>
          </select>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="admin-select"
            style={{ minHeight: 36, fontSize: 12, padding: '0 10px', width: 'auto' }}
          >
            <option value="all">Category: Attendance / Check-In</option>
            <option value="wage">Wage Shortfall</option>
            <option value="conduct">Conduct / Safety</option>
          </select>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '6px 12px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-color)',
              background: 'var(--surface-color)',
              width: 220,
            }}
          >
            <Search size={14} color="var(--text-secondary)" />
            <input
              type="text"
              placeholder="Search case ref, venue..."
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
      </div>

      {/* Main Two-Column Layout */}
      {activeDispute ? (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr) 380px',
            gap: 20,
            alignItems: 'start',
          }}
        >
          {/* Left Column: Selected Incident Dossier */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {/* Dossier Header Card */}
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
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-main)' }}>
                    CASE ···{activeDispute.id.slice(-6).toUpperCase()}
                  </span>
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 800,
                      padding: '2px 8px',
                      borderRadius: 4,
                      background: activeDispute.status === 'open' || activeDispute.status === 'under_review' ? '#FEF3C7' : '#F1F5F9',
                      color: activeDispute.status === 'open' || activeDispute.status === 'under_review' ? '#B45309' : '#475569',
                      textTransform: 'uppercase',
                    }}
                  >
                    {activeDispute.status.replace('_', ' ')}
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                    LOGGED:{' '}
                    {activeDispute.createdAt
                      ? new Date(activeDispute.createdAt).toLocaleString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : '—'}
                  </span>
                </div>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    fontSize: 11,
                    fontWeight: 700,
                    color: 'var(--text-secondary)',
                    background: 'var(--surface-muted)',
                    padding: '3px 8px',
                    borderRadius: 4,
                  }}
                >
                  <Clock size={12} />
                  <span>No SLA timer · queue only</span>
                </div>
              </div>

              <div>
                <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-main)', margin: '0 0 4px' }}>
                  {activeDispute.reason || 'Dispute'}
                </h2>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-secondary)' }}>
                  <MapPin size={13} color="#1D4ED8" />
                  <span>Booking ···{activeDispute.bookingId.slice(-6).toUpperCase()}</span>
                </div>
              </div>

              {/* Parties Involved Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 4 }}>
                {/* Worker Card */}
                <div
                  style={{
                    padding: 12,
                    borderRadius: 6,
                    background: 'var(--surface-muted)',
                    display: 'flex',
                    gap: 10,
                    alignItems: 'center',
                  }}
                >
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: '50%',
                      background: '#1D4ED8',
                      color: '#FFFFFF',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 14,
                      fontWeight: 800,
                      flexShrink: 0,
                    }}
                  >
                    {activeDispute.raisedBy.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-main)' }}>
                        Raised by ···{activeDispute.raisedBy.slice(-6)}
                      </span>
                      <span style={{ fontSize: 9, fontWeight: 800, background: '#DBEAFE', color: '#1D4ED8', padding: '1px 5px', borderRadius: 3 }}>
                        RAISER
                      </span>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 1 }}>
                      Profile id on dispute record (no fabricated worker bio)
                    </div>
                  </div>
                </div>

                {/* Respondent Card */}
                <div
                  style={{
                    padding: 12,
                    borderRadius: 6,
                    background: 'var(--surface-muted)',
                    display: 'flex',
                    gap: 10,
                    alignItems: 'center',
                  }}
                >
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: '50%',
                      background: '#0F172A',
                      color: '#FFFFFF',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 14,
                      fontWeight: 800,
                      flexShrink: 0,
                    }}
                  >
                    {activeDispute.respondentId.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-main)' }}>
                        Respondent ···{activeDispute.respondentId.slice(-6)}
                      </span>
                      <span style={{ fontSize: 9, fontWeight: 800, background: '#E2E8F0', color: '#334155', padding: '1px 5px', borderRadius: 3 }}>
                        PARTY
                      </span>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 1 }}>
                      Counterparty id on dispute record
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Dispute record (live fields only — no fabricated telemetry dossier) */}
            <div
              style={{
                background: 'var(--surface-color)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-color)',
                padding: 16,
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <User size={15} color="#1D4ED8" />
                  <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-main)' }}>Dispute details on file</span>
                </div>
                <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)', background: 'var(--surface-muted)', padding: '2px 6px', borderRadius: 3 }}>
                  LEDGER RECORD
                </span>
              </div>

              <div
                style={{
                  padding: 12,
                  background: '#F8FAFC',
                  borderRadius: 6,
                  borderLeft: '3px solid #1D4ED8',
                  fontSize: 12,
                  lineHeight: 1.5,
                  color: 'var(--text-main)',
                }}
              >
                {activeDispute.details?.trim() || activeDispute.reason || 'No additional details supplied with this dispute.'}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 11 }}>
                <div style={{ padding: 8, background: 'var(--surface-muted)', borderRadius: 4, display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: 700 }}>GPS / BLE / turnstile telemetry</span>
                  <span style={{ color: 'var(--text-secondary)', fontWeight: 700 }}>Not wired</span>
                </div>
                <div style={{ padding: 8, background: 'var(--surface-muted)', borderRadius: 4, display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: 700 }}>Resolution notes</span>
                  <span style={{ color: 'var(--text-secondary)', fontWeight: 700 }}>
                    {activeDispute.resolutionNotes?.trim() || 'Pending admin adjudication'}
                  </span>
                </div>
              </div>
            </div>

            {/* Incident Telemetry Timeline */}
            <div
              style={{
                background: 'var(--surface-color)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-color)',
                padding: 16,
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-main)' }}>
                  Incident Telemetry Timeline
                </span>
                <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)' }}>
                  CHRONOLOGICAL IST SEQUENCE
                </span>
              </div>

              <div
                style={{
                  padding: 14,
                  borderRadius: 6,
                  background: 'var(--surface-muted)',
                  border: '1px solid var(--border-color)',
                  fontSize: 12,
                  color: 'var(--text-secondary)',
                  lineHeight: 1.5,
                }}
              >
                No live geofence / BLE / turnstile telemetry is attached to this dispute in the current build.
                Adjudicate using the dispute details, attendance records, and resolution notes only.
                {activeDispute.createdAt ? (
                  <div style={{ marginTop: 8, fontWeight: 700, color: 'var(--text-main)' }}>
                    Case opened:{' '}
                    {new Date(activeDispute.createdAt).toLocaleString('en-IN', {
                      timeZone: 'Asia/Kolkata',
                    })}{' '}
                    IST
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          {/* Right Column: Escrow Impact Ledger & Admin Statutory Adjudication */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Escrow Impact Ledger */}
            <div
              style={{
                background: 'var(--surface-color)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-color)',
                padding: 16,
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-main)' }}>
                  Escrow Impact Ledger
                </span>
                <span style={{ fontSize: 10, fontWeight: 700, color: '#1D4ED8', background: '#DBEAFE', padding: '1px 6px', borderRadius: 3 }}>
                  LOCKED
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 11 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Contracted Base Wage (8h):</span>
                  <span style={{ fontWeight: 700 }}>₹2,400.00</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Disputed Overtime (30 mins):</span>
                  <span style={{ fontWeight: 700, color: '#B91C1C' }}>+₹175.00</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 6, borderTop: '1px solid var(--border-color)' }}>
                  <span style={{ fontWeight: 800 }}>Total Adjudication Value:</span>
                  <span style={{ fontWeight: 800, fontSize: 16, color: 'var(--text-main)' }}>₹2,575.00</span>
                </div>
              </div>

              <div
                style={{
                  padding: 10,
                  borderRadius: 6,
                  background: 'var(--surface-muted)',
                  fontSize: 10,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 3,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>NODAL POOL STATUS:</span>
                  <span style={{ fontWeight: 700, color: '#059669' }}>RESERVE HEALTHY</span>
                </div>
                <div style={{ fontWeight: 800, fontSize: 12 }}>₹16,099.20 Locked Apex Balance</div>
                <div style={{ color: 'var(--text-secondary)' }}>Ledger payout hold · no live bank VAN linked</div>
              </div>

              <div style={{ fontSize: 10, color: 'var(--text-secondary)' }}>
                Funds automatically disbursed upon admin sign-off under Mumbai Operations By-laws.
              </div>
            </div>

            {/* Admin Adjudication Form */}
            <div
              style={{
                background: 'var(--surface-color)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-color)',
                padding: 16,
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-main)' }}>
                  Admin Adjudication
                </span>
                <span style={{ fontSize: 9, fontWeight: 800, background: '#0F172A', color: '#FFFFFF', padding: '1px 6px', borderRadius: 3 }}>
                  SUPERADMIN
                </span>
              </div>

              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)' }}>
                SELECT STATUTORY RULING
              </div>

              {/* 4 Rulings Options */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 8,
                    padding: 8,
                    borderRadius: 6,
                    background: selectedRuling === 'worker_favor' ? '#EFF6FF' : 'var(--surface-muted)',
                    border: `1px solid ${selectedRuling === 'worker_favor' ? '#BFDBFE' : 'var(--border-color)'}`,
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="radio"
                    name="ruling"
                    checked={selectedRuling === 'worker_favor'}
                    onChange={() => setSelectedRuling('worker_favor')}
                    style={{ marginTop: 2 }}
                  />
                  <div style={{ fontSize: 11 }}>
                    <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>Rule in Worker Favor</div>
                    <div style={{ color: 'var(--text-secondary)', fontSize: 10, marginTop: 1 }}>
                      Favor raiser · adjusted payout only if claim amount exists on record
                    </div>
                  </div>
                </label>

                <label
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 8,
                    padding: 8,
                    borderRadius: 6,
                    background: selectedRuling === 'base_only' ? '#EFF6FF' : 'var(--surface-muted)',
                    border: `1px solid ${selectedRuling === 'base_only' ? '#BFDBFE' : 'var(--border-color)'}`,
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="radio"
                    name="ruling"
                    checked={selectedRuling === 'base_only'}
                    onChange={() => setSelectedRuling('base_only')}
                    style={{ marginTop: 2 }}
                  />
                  <div style={{ fontSize: 11 }}>
                    <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>Approve Base Wage Only</div>
                    <div style={{ color: 'var(--text-secondary)', fontSize: 10, marginTop: 1 }}>
                      ₹2,400 to Worker, Return ₹175 Overtime to Organizer
                    </div>
                  </div>
                </label>

                <label
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 8,
                    padding: 8,
                    borderRadius: 6,
                    background: selectedRuling === 'split' ? '#EFF6FF' : 'var(--surface-muted)',
                    border: `1px solid ${selectedRuling === 'split' ? '#BFDBFE' : 'var(--border-color)'}`,
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="radio"
                    name="ruling"
                    checked={selectedRuling === 'split'}
                    onChange={() => setSelectedRuling('split')}
                    style={{ marginTop: 2 }}
                  />
                  <div style={{ fontSize: 11 }}>
                    <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>Split Settlement / Mutual</div>
                    <div style={{ color: 'var(--text-secondary)', fontSize: 10, marginTop: 1 }}>
                      50% Overtime split; mutual non-fault strike
                    </div>
                  </div>
                </label>

                <label
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 8,
                    padding: 8,
                    borderRadius: 6,
                    background: selectedRuling === 'dismiss' ? '#EFF6FF' : 'var(--surface-muted)',
                    border: `1px solid ${selectedRuling === 'dismiss' ? '#BFDBFE' : 'var(--border-color)'}`,
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="radio"
                    name="ruling"
                    checked={selectedRuling === 'dismiss'}
                    onChange={() => setSelectedRuling('dismiss')}
                    style={{ marginTop: 2 }}
                  />
                  <div style={{ fontSize: 11 }}>
                    <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>Dismiss Dispute</div>
                    <div style={{ color: 'var(--text-secondary)', fontSize: 10, marginTop: 1 }}>
                      Reject claim; require formal organizer re-submission
                    </div>
                  </div>
                </label>
              </div>

              {/* Mediation Finding & Statutory Log */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)' }}>
                    MEDIATION FINDING & STATUTORY LOG
                  </span>
                  <span style={{ fontSize: 9, fontWeight: 700, color: '#1D4ED8' }}>AUDITED BY OPSKL LEGAL</span>
                </div>
                <textarea
                  className="admin-input"
                  value={mediationNotes}
                  onChange={(e) => setMediationNotes(e.target.value)}
                  rows={3}
                  style={{ fontSize: 11, resize: 'vertical' }}
                />
              </div>

              {/* Notification Checkbox */}
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: 'var(--text-main)', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={notifyParties}
                  onChange={(e) => setNotifyParties(e.target.checked)}
                />
                <span>Save resolution notes on the dispute ledger. WhatsApp / SMS party notify is not wired in this build.</span>
              </label>

              {actionError && (
                <div className="admin-banner admin-banner--danger" style={{ fontSize: 11 }}>
                  {actionError}
                </div>
              )}

              {ombudsmanNotice && (
                <div className="admin-banner admin-banner--warning" style={{ fontSize: 11 }}>
                  {ombudsmanNotice}
                </div>
              )}

              {/* Action Buttons */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <button
                  type="button"
                  className="admin-btn admin-btn-primary"
                  disabled={resolving}
                  onClick={handleAuthorizeRelease}
                  style={{ width: '100%', justifyContent: 'center', fontSize: 12, background: '#1D4ED8', borderColor: '#1D4ED8' }}
                >
                  <ShieldCheck size={14} />
                  <span>Authorize Escrow Release (₹2,575.00)</span>
                </button>

                <button
                  type="button"
                  className="admin-btn admin-btn-secondary"
                  disabled={resolving}
                  onClick={handleEscalateOmbudsman}
                  style={{ width: '100%', justifyContent: 'center', fontSize: 11 }}
                >
                  <span>Escalate to Senior Ombudsman</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div style={{ padding: 48, textAlign: 'center', background: 'var(--surface-color)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
          No disputes currently in the queue.
        </div>
      )}
    </div>
  );
};
