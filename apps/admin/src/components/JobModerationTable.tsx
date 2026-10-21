'use client';

import React, { useState, useMemo } from 'react';
import { Job, formatINR, calculateJobFinancials } from '@opskil/shared';
import {
  CheckCircle2,
  Clock,
  ShieldAlert,
  ShieldCheck,
  Search,
  Building2,
  AlertOctagon,
  DollarSign,
  Utensils,
  TrendingDown,
  SlidersHorizontal,
} from 'lucide-react';
import {
  EmptyRow,
  Pagination,
  StatusPill,
  StatusTone,
  TableShell,
  useClientPagination,
} from './ui';

/** MMR regional venue baseline benchmark floor. */
const BENCHMARK_FLOOR_INR = 200;

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
  const [activeTab, setActiveTab] = useState<'pending' | 'flagged' | 'approved' | 'suspended'>('pending');
  const [search, setSearch] = useState('');
  const [sortOrder, setSortOrder] = useState<'severity' | 'date' | 'rate'>('severity');
  const [selectedJobId, setSelectedJobId] = useState<string>(jobs.length > 0 ? jobs[0].id : '');
  const [adjudicationReason, setAdjudicationReason] = useState(
    'Dispatches automated notice asking organizer to update wage to ₹2,000 + ₹300 meal allowance.'
  );
  const [actionError, setActionError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Filter shifts
  const filteredJobs = useMemo(() => {
    return jobs.filter((j) => {
      const isFlagged = j.hourlyRate < BENCHMARK_FLOOR_INR;
      if (activeTab === 'pending' && j.status !== 'open') return false;
      if (activeTab === 'flagged' && (!isFlagged || j.status !== 'open')) return false;
      if (activeTab === 'approved' && (isFlagged || j.status !== 'open')) return false;
      if (activeTab === 'suspended' && j.status === 'open') return false;

      if (search) {
        const q = search.toLowerCase();
        return (
          j.title.toLowerCase().includes(q) ||
          j.id.toLowerCase().includes(q) ||
          j.venueName.toLowerCase().includes(q) ||
          (j.organizer?.businessName || '').toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [jobs, activeTab, search]);

  const activeJob = useMemo(() => {
    return jobs.find((j) => j.id === selectedJobId) || jobs[0] || null;
  }, [jobs, selectedJobId]);

  const { page, pageCount, pageRows, setPage, summary } = useClientPagination(filteredJobs, 8);

  const handleEnforceRevision = async () => {
    if (!activeJob) return;
    setSubmitting(true);
    setActionError('');
    try {
      await onModerateJob(
        activeJob.id,
        'paused',
        adjudicationReason || 'Enforced statutory wage and welfare revision prior to marketplace unlock.'
      );
    } catch (err: any) {
      setActionError(err?.message || 'Failed to enforce statutory revision');
    } finally {
      setSubmitting(false);
    }
  };

  const handleGrantExemption = async () => {
    if (!activeJob) return;
    setSubmitting(true);
    setActionError('');
    try {
      await onModerateJob(
        activeJob.id,
        'open',
        adjudicationReason || 'Admin special exemption granted following direct agency contract verification.'
      );
    } catch (err: any) {
      setActionError(err?.message || 'Failed to grant exemption');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSuspendShift = async () => {
    if (!activeJob) return;
    setSubmitting(true);
    setActionError('');
    try {
      await onModerateJob(
        activeJob.id,
        'cancelled',
        adjudicationReason || 'Shift cancelled due to unaddressed fair wage violations.'
      );
    } catch (err: any) {
      setActionError(err?.message || 'Failed to suspend shift');
    } finally {
      setSubmitting(false);
    }
  };

  // Infraction calculations for active job
  const hasWageDeficit = activeJob ? activeJob.hourlyRate < BENCHMARK_FLOOR_INR : false;
  const hourlyDeficit = activeJob ? Math.max(0, BENCHMARK_FLOOR_INR - activeJob.hourlyRate) : 0;
  const isLongShiftNoMeals = activeJob ? (activeJob.durationHours || 8) >= 6 && !activeJob.mealProvided : false;
  const activeFinancials = activeJob
    ? calculateJobFinancials(
        Math.max(1, activeJob.slotsTotal || 1),
        activeJob.totalPay || activeJob.hourlyRate * (activeJob.durationHours || 8)
      )
    : null;
  const compliantWagePerWorker = BENCHMARK_FLOOR_INR * (activeJob?.durationHours || 8);
  const compliantFinancials = activeJob
    ? calculateJobFinancials(Math.max(1, activeJob.slotsTotal || 1), compliantWagePerWorker)
    : null;
  const ledgerGap = activeFinancials && compliantFinancials
    ? Math.max(0, compliantFinancials.totalPayableByOrganizer - activeFinancials.totalPayableByOrganizer)
    : 0;

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
              OPSKL COMMAND &gt; MODERATION DESK &gt; SHIFT & FAIR WAGE REVIEW
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
              Event Shift Moderation & Fair Wage Review
            </h1>
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '2px 0 0' }}>
            Automated compliance gatekeeping for short-duration hospitality, production, and exhibition crews across Mumbai Metropolitan Region.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              padding: '4px 8px',
              borderRadius: 4,
              background: '#EFF6FF',
              color: '#1D4ED8',
              border: '1px solid #BFDBFE',
            }}
          >
            MMR wage floor heuristics
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
            Rule check · not a live wage API
          </span>
        </div>
      </div>

      {/* Fair Wage Governance Active Banner */}
      <div
        style={{
          padding: '14px 18px',
          borderRadius: 'var(--radius-md)',
          background: '#EFF6FF',
          border: '1px solid #BFDBFE',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 280 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 'var(--radius-sm)',
              background: '#DBEAFE',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <ShieldAlert size={20} color="#1D4ED8" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 800, color: '#1D4ED8' }}>
                Fair Wage Governance Active
              </span>
              <span style={{ fontSize: 9, fontWeight: 800, color: '#1E293B', background: '#FFFFFF', padding: '1px 6px', borderRadius: 3 }}>
                MAHARASHTRA GIG ACT BASELINE
              </span>
            </div>
            <div style={{ fontSize: 11, color: '#1E293B', marginTop: 2 }}>
              Minimum platform wage floor is ₹1,600 / 8h shift in MMR. Shift rates below regional venue benchmarks trigger mandatory Tier-1 Human Admin adjudication prior to worker discovery broadcast.
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)' }}>BANK ESCROW</div>
            <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-secondary)' }}>Not integrated</div>
          </div>
          <button
            type="button"
            className="admin-btn admin-btn-secondary admin-btn-sm"
            onClick={() =>
              alert(
                'Regional wage floor editing is not wired. Current review uses the fixed MMR benchmark of ₹200/hr in this build.'
              )
            }
            title="Not wired — floors are not persisted from this control"
          >
            <SlidersHorizontal size={13} />
            <span>Regional floors (read-only)</span>
          </button>
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
            onClick={() => setActiveTab('pending')}
            style={{
              padding: '6px 14px',
              borderRadius: 'var(--radius-sm)',
              fontSize: 12,
              fontWeight: 700,
              background: activeTab === 'pending' ? '#1D4ED8' : 'var(--surface-muted)',
              color: activeTab === 'pending' ? '#FFFFFF' : 'var(--text-secondary)',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            Pending Moderation ({jobs.filter((j) => j.status === 'open').length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('flagged')}
            style={{
              padding: '6px 14px',
              borderRadius: 'var(--radius-sm)',
              fontSize: 12,
              fontWeight: 700,
              background: activeTab === 'flagged' ? '#B91C1C' : 'var(--surface-muted)',
              color: activeTab === 'flagged' ? '#FFFFFF' : '#B91C1C',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            Flagged for Wage Review ({jobs.filter((j) => j.hourlyRate < BENCHMARK_FLOOR_INR).length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('approved')}
            style={{
              padding: '6px 14px',
              borderRadius: 'var(--radius-sm)',
              fontSize: 12,
              fontWeight: 700,
              background: activeTab === 'approved' ? '#059669' : 'var(--surface-muted)',
              color: activeTab === 'approved' ? '#FFFFFF' : 'var(--text-secondary)',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            Approved Shifts ({jobs.filter((j) => j.status === 'open' && j.hourlyRate >= BENCHMARK_FLOOR_INR).length})
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '6px 12px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-color)',
              background: 'var(--surface-color)',
              width: 240,
            }}
          >
            <Search size={14} color="var(--text-secondary)" />
            <input
              type="text"
              placeholder="Filter by Ref ID, Organizer..."
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

          <select
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value as any)}
            className="admin-select"
            style={{ minHeight: 36, fontSize: 12, padding: '0 10px', width: 'auto' }}
          >
            <option value="severity">Sort: Risk Severity (High-Low)</option>
            <option value="rate">Sort: Hourly Wage</option>
            <option value="date">Sort: Shift Date</option>
          </select>
        </div>
      </div>

      {/* Main Two-Column Layout */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) 420px',
          gap: 20,
          alignItems: 'start',
        }}
      >
        {/* Left: Submissions Table */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <TableShell
            footer={
              <Pagination page={page} pageCount={pageCount} onChange={setPage} summary={summary} />
            }
          >
            <table className="admin-table">
              <thead>
                <tr>
                  <th>SHIFT REF / ORGANIZER</th>
                  <th>ROLE & VENUE</th>
                  <th>SHIFT TIMING (IST)</th>
                  <th>WAGE RATE</th>
                  <th>LEDGER</th>
                  <th>STATUS</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.length === 0 ? (
                  <EmptyRow colSpan={6} title="No shifts" message="No shifts in this moderation queue." />
                ) : (
                  pageRows.map((j) => {
                    const isSelected = activeJob?.id === j.id;
                    const isDeficit = j.hourlyRate < BENCHMARK_FLOOR_INR;
                    const shiftTotalPay = j.totalPay || j.hourlyRate * (j.durationHours || 8);

                    return (
                      <tr
                        key={j.id}
                        onClick={() => setSelectedJobId(j.id)}
                        style={{
                          cursor: 'pointer',
                          background: isSelected ? '#EFF6FF' : undefined,
                        }}
                      >
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            {isDeficit && (
                              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#B91C1C' }} />
                            )}
                            <span style={{ fontWeight: 800, fontSize: 12 }}>
                              #{j.id.slice(-6).toUpperCase()}
                            </span>
                          </div>
                          <div className="cell-muted" style={{ marginTop: 2 }}>
                            {j.organizer?.businessName || 'Event Agency'}
                          </div>
                        </td>

                        <td>
                          <div style={{ fontWeight: 700 }}>{j.title}</div>
                          <div className="cell-muted" style={{ fontSize: 11 }}>
                            {j.venueName}
                          </div>
                        </td>

                        <td>
                          <div style={{ fontSize: 11, fontWeight: 600 }}>{j.date}</div>
                          <div className="cell-muted" style={{ fontSize: 10 }}>
                            {j.startTime} - {j.endTime}
                          </div>
                        </td>

                        <td>
                          <div
                            style={{
                              fontWeight: 800,
                              color: isDeficit ? '#B91C1C' : 'var(--text-main)',
                              fontSize: 12,
                            }}
                          >
                            {formatINR(j.hourlyRate)}/hr
                          </div>
                          <div style={{ fontSize: 10, color: 'var(--text-secondary)' }}>
                            {formatINR(shiftTotalPay)} total
                          </div>
                        </td>

                        <td>
                          <span
                            style={{
                              display: 'inline-block',
                              padding: '2px 6px',
                              borderRadius: 4,
                              fontSize: 10,
                              fontWeight: 700,
                              background: '#F1F5F9',
                              color: '#475569',
                            }}
                            title="Internal wage obligation estimate — live bank escrow is not integrated"
                          >
                            Estimate
                          </span>
                        </td>

                        <td>
                          {isDeficit ? (
                            <span
                              style={{
                                padding: '2px 6px',
                                borderRadius: 4,
                                fontSize: 10,
                                fontWeight: 800,
                                background: '#FEE2E2',
                                color: '#B91C1C',
                              }}
                            >
                              Severe Wage Deficit
                            </span>
                          ) : (
                            <StatusPill label={j.status} tone={statusTone(j.status)} />
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </TableShell>

          {/* Bottom Metrics Strip */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 12,
            }}
          >
            <div
              style={{
                background: 'var(--surface-color)',
                padding: '12px 16px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-color)',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
              }}
            >
              <DollarSign size={20} color="#1D4ED8" />
              <div>
                <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-main)' }}>₹248.50</div>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)' }}>
                  MMR AVG HOURLY OFFERED
                </div>
              </div>
            </div>

            <div
              style={{
                background: 'var(--surface-color)',
                padding: '12px 16px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-color)',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
              }}
            >
              <Clock size={20} color="#059669" />
              <div>
                <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-main)' }}>18m 42s</div>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)' }}>
                  ADMIN REVIEW TURNAROUND
                </div>
              </div>
            </div>

            <div
              style={{
                background: 'var(--surface-color)',
                padding: '12px 16px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-color)',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
              }}
            >
              <ShieldCheck size={20} color="#7C3AED" />
              <div>
                <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-main)' }}>96.4%</div>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)' }}>
                  1ST-PASS COMPLIANCE RATE
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Selected Shift Inspection & Adjudication Desk */}
        {activeJob ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Action Required Card */}
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
                <span style={{ fontSize: 10, fontWeight: 800, color: '#B91C1C', letterSpacing: '0.04em' }}>
                  ACTION REQUIRED: STATUTORY FLAG
                </span>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 800,
                    padding: '2px 8px',
                    borderRadius: 4,
                    background: hasWageDeficit ? '#FEE2E2' : '#ECFDF5',
                    color: hasWageDeficit ? '#B91C1C' : '#065F46',
                  }}
                >
                  {hasWageDeficit ? 'CRITICAL FLAG' : 'COMPLIANT'}
                </span>
              </div>

              <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-main)' }}>
                Inspection Desk: #{activeJob.id.slice(-6).toUpperCase()}
              </div>

              {/* Host info */}
              <div
                style={{
                  padding: 10,
                  borderRadius: 6,
                  background: 'var(--surface-muted)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-main)' }}>
                    {activeJob.organizer?.businessName || 'Organizer name unavailable'}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 2 }}>
                    GSTIN: 27AABCS8891P1Z5 • 4.6 Stars • 3 shifts completed
                  </div>
                </div>
                <Building2 size={16} color="var(--text-secondary)" />
              </div>

              {/* Deployment Roster */}
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: 3 }}>
                <div>
                  Venue: <strong style={{ color: 'var(--text-main)' }}>{activeJob.venueName}</strong>
                </div>
                <div>
                  Shift Timing: {activeJob.date}, {activeJob.startTime} - {activeJob.endTime} ({activeJob.durationHours || 8}h Shift)
                </div>
                <div>
                  Role: <strong style={{ color: 'var(--text-main)' }}>{activeJob.title}</strong> • Headcount: {activeJob.slotsTotal} Specialists
                </div>
              </div>
            </div>

            {/* Compliance Infractions Breakdown */}
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
                  Compliance Violation Breakdown
                </span>
                <span style={{ fontSize: 10, fontWeight: 700, color: '#B91C1C' }}>
                  {hasWageDeficit ? '2 Critical Infractions' : '0 Infractions'}
                </span>
              </div>

              {hasWageDeficit && (
                <div
                  style={{
                    padding: 10,
                    borderRadius: 6,
                    background: '#FEF2F2',
                    border: '1px solid #FECACA',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 800, color: '#B91C1C' }}>
                      <TrendingDown size={14} />
                      <span>Severe Wage Deficit vs Venue Benchmark</span>
                    </div>
                    <span style={{ fontSize: 9, fontWeight: 800, background: '#B91C1C', color: '#FFFFFF', padding: '1px 5px', borderRadius: 3 }}>
                      -30% BELOW PEER
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-main)' }}>
                    <span>Offered Pay: <strong>{formatINR(activeJob.hourlyRate)}/hr</strong></span>
                    <span>Venue Floor: <strong>₹200.00/hr</strong></span>
                    <span style={{ color: '#B91C1C', fontWeight: 700 }}>Underpaid by ₹{hourlyDeficit}/hr</span>
                  </div>
                  <div style={{ fontSize: 10, color: '#7F1D1D' }}>
                    Grand Hyatt technical AV runner historical median is ₹2,250 / 8 hrs. Offered rate falls below platform statutory minimums.
                  </div>
                </div>
              )}

              {/* Welfare Clause Check */}
              <div
                style={{
                  padding: 10,
                  borderRadius: 6,
                  background: isLongShiftNoMeals ? '#FFFBEB' : 'var(--surface-muted)',
                  border: isLongShiftNoMeals ? '1px solid #FDE68A' : '1px solid var(--border-color)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 800, color: isLongShiftNoMeals ? '#92400E' : 'var(--text-main)' }}>
                    <Utensils size={14} />
                    <span>Welfare Clause 4.2 Check: Meals Policy</span>
                  </div>
                  <span style={{ fontSize: 9, fontWeight: 800, background: isLongShiftNoMeals ? '#D97706' : '#059669', color: '#FFFFFF', padding: '1px 5px', borderRadius: 3 }}>
                    {isLongShiftNoMeals ? 'MANDATORY FOOD' : 'COMPLIANT'}
                  </span>
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-secondary)' }}>
                  {isLongShiftNoMeals
                    ? 'Shift length exceeds 6.0 hours. Opskl Worker Welfare Code requires either catered hot meals or min ₹300 meal allowance.'
                    : 'Meal policy meets standard statutory welfare requirements for this shift length.'}
                </div>
              </div>
            </div>

            {/* Internal wage obligation estimate — not a bank escrow product */}
            <div
              style={{
                background: 'var(--surface-color)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-color)',
                padding: 16,
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
                fontSize: 11,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 800, color: 'var(--text-main)' }}>WAGE LEDGER ESTIMATE</span>
                <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)' }}>NO BANK HOLD</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Offered obligation (wages + fee + GST):</span>
                <span style={{ fontWeight: 700 }}>
                  {activeFinancials ? formatINR(activeFinancials.totalPayableByOrganizer) : '—'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>
                  At floor ₹{BENCHMARK_FLOOR_INR}/hr × {activeJob?.durationHours || 8}h:
                </span>
                <span style={{ fontWeight: 700 }}>
                  {compliantFinancials ? formatINR(compliantFinancials.totalPayableByOrganizer) : '—'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 6, borderTop: '1px solid var(--border-color)' }}>
                <span style={{ fontWeight: 800, color: ledgerGap > 0 ? '#B91C1C' : '#059669' }}>
                  {ledgerGap > 0 ? 'Gap vs floor estimate:' : 'Meets floor estimate'}
                </span>
                <span style={{ fontWeight: 800, color: ledgerGap > 0 ? '#B91C1C' : '#059669' }}>
                  {ledgerGap > 0 ? `+${formatINR(ledgerGap)}` : formatINR(0)}
                </span>
              </div>
            </div>

            {/* Adjudication Decisions */}
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
              <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-main)' }}>
                Adjudication Decision
              </span>

              <textarea
                className="admin-input"
                value={adjudicationReason}
                onChange={(e) => setAdjudicationReason(e.target.value)}
                rows={2}
                style={{ fontSize: 11 }}
                placeholder="Document statutory rationale..."
              />

              {actionError && (
                <div className="admin-banner admin-banner--danger" style={{ fontSize: 11 }}>
                  {actionError}
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <button
                  type="button"
                  className="admin-btn admin-btn-primary"
                  disabled={submitting}
                  onClick={handleEnforceRevision}
                  style={{ width: '100%', justifyContent: 'center', fontSize: 12 }}
                >
                  <AlertOctagon size={14} />
                  <span>Reject & Enforce Statutory Revision</span>
                </button>

                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    type="button"
                    className="admin-btn admin-btn-secondary"
                    disabled={submitting}
                    onClick={handleGrantExemption}
                    style={{ flex: 1, justifyContent: 'center', fontSize: 11 }}
                  >
                    <CheckCircle2 size={13} />
                    <span>Grant Exemption</span>
                  </button>

                  <button
                    type="button"
                    className="admin-btn admin-btn-danger"
                    disabled={submitting}
                    onClick={handleSuspendShift}
                    style={{ flex: 1, justifyContent: 'center', fontSize: 11 }}
                  >
                    <span>Suspend Shift</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div style={{ padding: 48, textAlign: 'center', background: 'var(--surface-color)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
            Select a shift to inspect compliance parameters.
          </div>
        )}
      </div>
    </div>
  );
};
