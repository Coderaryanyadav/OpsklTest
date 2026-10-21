'use client';

import React, { useState, useMemo } from 'react';
import { Dispute, formatINR } from '@opskil/shared';
import {
  Clock,
  Search,
  User,
  Building2,
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
    'GPS and Bluetooth telemetry corroborates Aarav Kulkarni\'s presence in JWCC Hall 2 from 09:26 to 19:34 IST. Scanner hardware latency at Gate 4 accepted as mitigating infrastructure fault.'
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
      const baseClaim = (activeDispute as any).claimAmount || 2400;
      if (selectedRuling === 'worker_favor') {
        adjustedPayout = baseClaim + 175;
      } else if (selectedRuling === 'base_only') {
        adjustedPayout = baseClaim;
      } else if (selectedRuling === 'split') {
        adjustedPayout = baseClaim + 87.5;
      }
      await onResolveDispute(activeDispute.id, status, mediationNotes, adjustedPayout);
    } catch (err: any) {
      setActionError(err?.message || 'Failed to authorize escrow release');
    } finally {
      setResolving(false);
    }
  };

  const handleEscalateOmbudsman = () => {
    setOmbudsmanNotice(
      'Senior Ombudsman Escalation: Case flagged for tier-2 legal arbitration. Shift payout frozen until hearing.'
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
                    CASE REF #DIS-MUM-4109
                  </span>
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 800,
                      padding: '2px 8px',
                      borderRadius: 4,
                      background: '#FEE2E2',
                      color: '#B91C1C',
                    }}
                  >
                    SEVERITY: HIGH
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                    LOGGED: 19:42 IST • 22 FEB 2025
                  </span>
                </div>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    fontSize: 11,
                    fontWeight: 700,
                    color: '#B91C1C',
                    background: '#FEF2F2',
                    padding: '3px 8px',
                    borderRadius: 4,
                  }}
                >
                  <Clock size={12} />
                  <span>PRIORITY SLA: 12m Remaining</span>
                </div>
              </div>

              <div>
                <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-main)', margin: '0 0 4px' }}>
                  Gate 4 Check-In Turnstile Dispute & Overtime Claim
                </h2>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-secondary)' }}>
                  <MapPin size={13} color="#1D4ED8" />
                  <span>India FinTech Conclave 2025 • Jio World Convention Centre, Hall 2, BKC, Mumbai</span>
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
                    AK
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-main)' }}>Aarav Kulkarni</span>
                      <span style={{ fontSize: 9, fontWeight: 800, background: '#DBEAFE', color: '#1D4ED8', padding: '1px 5px', borderRadius: 3 }}>
                        WORKER
                      </span>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 1 }}>
                      Lead VIP Concierge • ID: WRK-MUM-8821
                    </div>
                    <div style={{ fontSize: 10, color: '#059669', fontWeight: 700, marginTop: 2 }}>
                      ★ 4.92 (38 Shifts) • KYC AADHAAR VERIFIED
                    </div>
                  </div>
                </div>

                {/* Organizer Card */}
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
                    RM
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-main)' }}>Rohit Mehta</span>
                      <span style={{ fontSize: 9, fontWeight: 800, background: '#E2E8F0', color: '#334155', padding: '1px 5px', borderRadius: 3 }}>
                        ORGANIZER
                      </span>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 1 }}>
                      Head of Production, Apex Live Experiences
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 2 }}>
                      GSTIN: 27AABCA1234F1Z9 • Escrow Tier A
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Dual Dossier Positions */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              {/* Worker Statement */}
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
                    <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-main)' }}>Worker Statement</span>
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 700, color: '#1D4ED8', background: '#EFF6FF', padding: '2px 6px', borderRadius: 3 }}>
                    AFFIRMATION LOGGED
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
                    fontStyle: 'italic',
                    color: 'var(--text-main)',
                  }}
                >
                  &quot;Arrived at Gate 4 at 09:24 AM IST. Supervisor scanner was lagging due to poor network inside turnstile concourse. Supervisor marked me absent at 10:05 AM even though I was physically present in Hall 2 doing VIP seating till 19:30 PM (30m overtime).&quot;
                </div>

                {/* Automated Telemetry Audit */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--text-secondary)' }}>
                      AUTOMATED TELEMETRY AUDIT
                    </span>
                    <span style={{ fontSize: 10, fontWeight: 700, color: '#059669' }}>3 of 3 Captured</span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 11 }}>
                    <div style={{ padding: 8, background: 'var(--surface-muted)', borderRadius: 4 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontWeight: 700 }}>Geofence Ping (Arrival)</span>
                        <span style={{ color: '#059669', fontWeight: 700 }}>VALIDATED</span>
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 2 }}>
                        09:26:14 AM IST inside JWCC radius (19.0645° N, 72.8679° E, ±3.1m)
                      </div>
                    </div>

                    <div style={{ padding: 8, background: 'var(--surface-muted)', borderRadius: 4 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontWeight: 700 }}>Offline Backup Token PIN</span>
                        <span style={{ color: '#059669', fontWeight: 700 }}>RECORDED</span>
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 2 }}>
                        PIN #884-219 generated on local device at 09:32 AM IST
                      </div>
                    </div>

                    <div style={{ padding: 8, background: 'var(--surface-muted)', borderRadius: 4 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontWeight: 700 }}>Concourse BLE Beacon</span>
                        <span style={{ color: '#059669', fontWeight: 700 }}>VALIDATED</span>
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 2 }}>
                        Beacon #B-BKC-JWCC-CON2 logged terminal exit at 19:34:02 PM IST (-67 dBm)
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Organizer Position */}
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
                    <Building2 size={15} color="var(--text-main)" />
                    <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-main)' }}>Organizer Position</span>
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 700, color: '#475569', background: '#F1F5F9', padding: '2px 6px', borderRadius: 3 }}>
                    FIELD REBUTTAL
                  </span>
                </div>

                <div
                  style={{
                    padding: 12,
                    background: '#F8FAFC',
                    borderRadius: 6,
                    borderLeft: '3px solid #64748B',
                    fontSize: 12,
                    lineHeight: 1.5,
                    fontStyle: 'italic',
                    color: 'var(--text-main)',
                  }}
                >
                  &quot;Initial muster call at 09:30 AM missed. Aarav reported directly to Hall 2 without scanning Gate 4 turnstile. Acknowledged worked full shift but dispute overtime because closing was scheduled for 19:00 PM.&quot;
                </div>

                {/* Supervisor Roster Logs */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--text-secondary)' }}>
                      SUPERVISOR ROSTER LOGS
                    </span>
                    <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)' }}>2 Entries</span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 11 }}>
                    <div style={{ padding: 8, background: 'var(--surface-muted)', borderRadius: 4 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontWeight: 700 }}>Shift Lead Reconciliation</span>
                        <span style={{ color: 'var(--text-secondary)' }}>14:00 IST</span>
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 2 }}>
                        Worker spotted at 11:15 AM managing VIP Lounge. Approved base 8h manually, pending overtime.
                      </div>
                    </div>

                    <div style={{ padding: 8, background: '#FEF2F2', borderRadius: 4, border: '1px solid #FECACA' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontWeight: 700, color: '#B91C1C' }}>Infrastructure Note</span>
                        <span style={{ color: '#B91C1C', fontWeight: 700 }}>INCIDENT CONFIRMED</span>
                      </div>
                      <div style={{ fontSize: 10, color: '#7F1D1D', marginTop: 2 }}>
                        #INC-GW-092 reported 22-min packet loss on BKC fiber turnstiles between 09:15 - 09:37 AM IST.
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 8px', background: 'var(--surface-muted)', borderRadius: 4 }}>
                      <span style={{ fontSize: 10, fontWeight: 700 }}>Turnstile Hardware Drift:</span>
                      <span style={{ fontSize: 10, fontWeight: 800, color: '#059669' }}>98.4% Match (Corroborated)</span>
                    </div>
                  </div>
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
                  display: 'grid',
                  gridTemplateColumns: 'repeat(4, 1fr)',
                  gap: 10,
                }}
              >
                <div style={{ padding: 10, borderRadius: 6, background: '#EFF6FF', border: '1px solid #BFDBFE' }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: '#1D4ED8' }}>09:26 IST</div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-main)', marginTop: 2 }}>Geofence Lock</div>
                  <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 2 }}>Crossed 50m perimeter</div>
                </div>

                <div style={{ padding: 10, borderRadius: 6, background: '#FEF2F2', border: '1px solid #FECACA' }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: '#B91C1C' }}>10:05 IST</div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-main)', marginTop: 2 }}>Auto Absent Flag</div>
                  <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 2 }}>Missed muster tag</div>
                </div>

                <div style={{ padding: 10, borderRadius: 6, background: 'var(--surface-muted)', border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-main)' }}>14:00 IST</div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-main)', marginTop: 2 }}>Manual Override</div>
                  <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 2 }}>Supervisor validates VIP duty</div>
                </div>

                <div style={{ padding: 10, borderRadius: 6, background: '#ECFDF5', border: '1px solid #A7F3D0' }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: '#059669' }}>19:34 IST</div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-main)', marginTop: 2 }}>Exit Ping</div>
                  <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 2 }}>BLE beacon logs 30m overtime</div>
                </div>
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
                <div style={{ color: 'var(--text-secondary)' }}>ICICI Nodal Escrow #OPSKLAPEX04018</div>
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
                      Full wage ₹2,400 + Overtime ₹175 to Worker from Escrow (100% telemetry match)
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
                <span>Publish this resolution to the immutable state ledger and notify both parties via WhatsApp & SMS.</span>
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
