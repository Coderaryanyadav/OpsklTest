'use client';

import { useState, useEffect } from 'react';
import {
  formatINR,
  AdminOverviewMetrics,
  VerificationCase,
  Dispute,
  SafetyReport,
  Job,
  AuditLog,
  PlatformSetting,
  fetchAdminDashboardMetrics,
  fetchVerificationQueue,
  resolveVerificationCaseSafe,
  fetchDisputesQueue,
  resolveDisputeSafe,
  fetchSafetyReportsQueue,
  resolveSafetyReportSafe,
  fetchModerationJobs,
  moderateJobSafe,
  fetchAuditLogs,
  fetchPlatformSettings,
  calculatePilotMetricsSummary,
  MUMBAI_PILOT_RECORDS,
  PilotMetricsSummary,
  setBookingPauseStatus,
  getSystemOperationalStatus,
  SystemOperationalStatus,
} from '@opskil/shared';

type AdminModule =
  | 'overview'
  | 'pilot'
  | 'verifications'
  | 'disputes'
  | 'safety'
  | 'jobs'
  | 'workers'
  | 'organizers'
  | 'bookings'
  | 'payments'
  | 'reviews'
  | 'audit'
  | 'settings';

export default function AdminDashboardPage() {
  const [activeModule, setActiveModule] = useState<AdminModule>('overview');
  const [metrics, setMetrics] = useState<AdminOverviewMetrics | null>(null);
  const [verifications, setVerifications] = useState<VerificationCase[]>([]);
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [safetyReports, setSafetyReports] = useState<SafetyReport[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [settings, setSettings] = useState<PlatformSetting[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals state
  const [selectedCase, setSelectedCase] = useState<VerificationCase | null>(null);
  const [caseRejectReason, setCaseRejectReason] = useState('');
  const [selectedDispute, setSelectedDispute] = useState<Dispute | null>(null);
  const [disputeNotes, setDisputeNotes] = useState('');
  const [adjustedPayout, setAdjustedPayout] = useState('');
  const [selectedSafety, setSelectedSafety] = useState<SafetyReport | null>(null);
  const [safetyAction, setSafetyAction] = useState('');
  const [actionSuccessMessage, setActionSuccessMessage] = useState('');
  const [modalError, setModalError] = useState('');
  const [moderateJobTarget, setModerateJobTarget] = useState<{
    job: Job;
    newStatus: 'open' | 'paused' | 'cancelled';
  } | null>(null);
  const [moderationReason, setModerationReason] = useState('');

  // Pilot & Safety Killswitch State
  const [systemStatus, setSystemStatus] = useState<SystemOperationalStatus>(getSystemOperationalStatus());
  const [pilotMetrics] = useState<PilotMetricsSummary>(calculatePilotMetricsSummary());
  const [pauseReasonInput, setPauseReasonInput] = useState('Monsoon weather safety precaution');

  const handleToggleBookingPause = () => {
    const nextPaused = !systemStatus.isBookingPaused;
    const updated = setBookingPauseStatus(
      nextPaused,
      nextPaused ? pauseReasonInput : undefined,
      'Ops Director (Aryan Yadav)',
      nextPaused ? `Notice: New shift bookings are temporarily paused due to: ${pauseReasonInput}` : undefined
    );
    setSystemStatus(updated);
    setActionSuccessMessage(nextPaused ? 'Shift bookings have been PAUSED platform-wide.' : 'Shift bookings have been RESUMED.');
  };

  useEffect(() => {
    async function loadAdminData() {
      try {
        const [m, v, d, s, j, a, cfg] = await Promise.all([
          fetchAdminDashboardMetrics(),
          fetchVerificationQueue(),
          fetchDisputesQueue(),
          fetchSafetyReportsQueue(),
          fetchModerationJobs(),
          fetchAuditLogs(),
          fetchPlatformSettings(),
        ]);
        setMetrics(m);
        setVerifications(v);
        setDisputes(d);
        setSafetyReports(s);
        setJobs(j);
        setAuditLogs(a);
        setSettings(cfg);
      } finally {
        setLoading(false);
      }
    }
    loadAdminData();
  }, []);

  const handleResolveCase = async (status: 'approved' | 'rejected') => {
    if (!selectedCase) return;
    if (status === 'rejected' && !caseRejectReason.trim()) {
      setModalError('A documented rejection reason is mandatory for compliance.');
      return;
    }

    const res = await resolveVerificationCaseSafe(
      selectedCase.id,
      status,
      caseRejectReason,
      'admin-super-id'
    );
    if (res.success) {
      setVerifications((prev) =>
        prev.map((c) => (c.id === selectedCase.id ? { ...c, status } : c))
      );
      setSelectedCase(null);
      setCaseRejectReason('');
      setModalError('');
      showSuccess(`Verification case marked as ${status}. Badge status updated.`);
    } else {
      setModalError(res.error || 'Failed to update verification case.');
    }
  };

  const handleResolveDispute = async (status: 'resolved' | 'dismissed') => {
    if (!selectedDispute) return;
    if (!disputeNotes.trim()) {
      setModalError('Documented case findings and resolution notes are mandatory.');
      return;
    }

    const payoutNum = adjustedPayout ? parseFloat(adjustedPayout) : undefined;
    const res = await resolveDisputeSafe(
      selectedDispute.id,
      status,
      disputeNotes,
      payoutNum,
      'admin-super-id'
    );
    if (res.success) {
      setDisputes((prev) =>
        prev.map((d) => (d.id === selectedDispute.id ? { ...d, status, resolutionNotes: disputeNotes } : d))
      );
      setSelectedDispute(null);
      setDisputeNotes('');
      setAdjustedPayout('');
      setModalError('');
      showSuccess(`Dispute marked as ${status}. Escrow ledger updated.`);
    } else {
      setModalError(res.error || 'Failed to resolve dispute.');
    }
  };

  const handleResolveSafety = async (status: 'resolved' | 'escalated') => {
    if (!selectedSafety) return;
    if (!safetyAction.trim()) {
      setModalError('Documented action taken is required for Trust & Safety escalation.');
      return;
    }

    const res = await resolveSafetyReportSafe(
      selectedSafety.id,
      status,
      safetyAction,
      'Staff investigation complete',
      'admin-super-id'
    );
    if (res.success) {
      setSafetyReports((prev) =>
        prev.map((s) => (s.id === selectedSafety.id ? { ...s, status, actionTaken: safetyAction } : s))
      );
      setSelectedSafety(null);
      setSafetyAction('');
      setModalError('');
      showSuccess(`Safety report marked as ${status}.`);
    } else {
      setModalError(res.error || 'Failed to update safety report.');
    }
  };

  const handleModerateJobConfirm = async () => {
    if (!moderateJobTarget) return;
    if (!moderationReason.trim()) {
      setModalError('A documented operational reason is mandatory.');
      return;
    }

    const res = await moderateJobSafe(
      moderateJobTarget.job.id,
      moderateJobTarget.newStatus,
      moderationReason.trim(),
      'admin-super-id'
    );
    if (res.success) {
      setJobs((prev) =>
        prev.map((j) => (j.id === moderateJobTarget.job.id ? { ...j, status: moderateJobTarget.newStatus } : j))
      );
      setModerateJobTarget(null);
      setModerationReason('');
      setModalError('');
      showSuccess(`Shift status updated to ${moderateJobTarget.newStatus}. Reason logged in audit trail.`);
    } else {
      setModalError(res.error || 'Failed to moderate shift.');
    }
  };

  const showSuccess = (msg: string) => {
    setActionSuccessMessage(msg);
    setTimeout(() => setActionSuccessMessage(''), 4000);
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#090D14', color: '#F8FAFC' }}>
      {/* Sidebar Navigation */}
      <aside
        style={{
          width: '260px',
          backgroundColor: '#0F1523',
          borderRight: '1px solid #1E293B',
          display: 'flex',
          flexDirection: 'column',
          padding: '24px 16px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', paddingBottom: '24px', borderBottom: '1px solid #1E293B' }}>
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              backgroundColor: '#0F766E',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: '800',
              fontSize: '18px',
            }}
          >
            O
          </div>
          <div>
            <div style={{ fontWeight: '800', fontSize: '16px', letterSpacing: '-0.3px' }}>OPSKL</div>
            <div style={{ fontSize: '11px', color: '#14B8A6', fontWeight: '700' }}>TRUST & OPS CONSOLE</div>
          </div>
        </div>

        {/* Navigation Items */}
        <nav style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
          {[
            { id: 'overview', label: 'Platform Overview', icon: '📊' },
            { id: 'pilot', label: 'Mumbai Pilot Operations', icon: '🚀' },
            { id: 'verifications', label: `Verification Queue (${verifications.filter(v => v.status === 'pending').length})`, icon: '🛡️' },
            { id: 'disputes', label: `Attendance Disputes (${disputes.filter(d => d.status === 'open').length})`, icon: '⚖️' },
            { id: 'safety', label: `Safety Reports (${safetyReports.filter(s => s.status === 'open').length})`, icon: '🚨' },
            { id: 'jobs', label: 'Shift Moderation', icon: '📑' },
            { id: 'workers', label: 'Worker Management', icon: '👷' },
            { id: 'organizers', label: 'Organizer Businesses', icon: '🏢' },
            { id: 'bookings', label: 'Bookings Roster', icon: '📋' },
            { id: 'payments', label: 'Payment Reconciliation', icon: '💳' },
            { id: 'reviews', label: 'Reviews & Abuse', icon: '⭐' },
            { id: 'audit', label: 'Audit Trail Logs', icon: '📜' },
            { id: 'settings', label: 'System Configuration', icon: '⚙️' },
          ].map((item) => {
            const isActive = activeModule === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveModule(item.id as AdminModule)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: isActive ? '#0F766E' : 'transparent',
                  color: isActive ? '#FFFFFF' : '#94A3B8',
                  fontSize: '13px',
                  fontWeight: isActive ? '700' : '500',
                  textAlign: 'left',
                  cursor: 'pointer',
                  transition: 'background 0.15s ease',
                }}
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Administrator Footer */}
        <div style={{ paddingTop: '16px', borderTop: '1px solid #1E293B', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: '8px', height: '8px', borderRadius: '4px', backgroundColor: '#10B981' }} />
          <div style={{ fontSize: '11px', color: '#94A3B8' }}>
            Auth: <strong>ops.lead@opskil.com</strong>
          </div>
        </div>
      </aside>

      {/* Main Operations Area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
        {/* Top Bar */}
        <header
          style={{
            height: '64px',
            backgroundColor: '#0F1523',
            borderBottom: '1px solid #1E293B',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 32px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <span style={{ fontSize: '13px', color: '#94A3B8' }}>Target Market:</span>
            <span style={{ fontSize: '13px', fontWeight: '700', color: '#F8FAFC' }}>
              📍 Mumbai Exhibition & Activation Hubs
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <span
              style={{
                padding: '4px 10px',
                borderRadius: '999px',
                backgroundColor: 'rgba(15, 118, 110, 0.2)',
                color: '#14B8A6',
                fontSize: '12px',
                fontWeight: '700',
              }}
            >
              RBAC: SUPER ADMINISTRATOR
            </span>
            <span style={{ fontSize: '12px', color: '#10B981', fontWeight: '600' }}>● All Services Nominal</span>
          </div>
        </header>

        {/* Feedback alert banner */}
        {actionSuccessMessage && (
          <div
            style={{
              backgroundColor: '#064E3B',
              color: '#A7F3D0',
              padding: '12px 32px',
              fontSize: '13px',
              fontWeight: '600',
              borderBottom: '1px solid #059669',
            }}
          >
            ✓ {actionSuccessMessage}
          </div>
        )}

        {/* Module Content */}
        <main style={{ padding: '32px', flex: 1 }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '60px', color: '#94A3B8' }}>
              Loading operational records...
            </div>
          ) : activeModule === 'overview' ? (
            /* MODULE 1: PLATFORM OVERVIEW */
            <div>
              <div style={{ marginBottom: '24px' }}>
                <h1 style={{ fontSize: '24px', fontWeight: '800' }}>Platform Overview & Escrow Operations</h1>
                <p style={{ color: '#94A3B8', fontSize: '13px', marginTop: '4px' }}>
                  Live metrics across Mumbai short-duration shift operations, active escrows, and trust queues.
                </p>
              </div>

              {/* 8-Metric Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '32px' }}>
                <div style={metricCardStyle}>
                  <div style={metricLabelStyle}>ACTIVE MUMBAI SHIFTS</div>
                  <div style={metricValStyle}>{metrics?.activeShifts}</div>
                  <div style={metricSubStyle}>Exhibitions & Conclaves</div>
                </div>
                <div style={metricCardStyle}>
                  <div style={metricLabelStyle}>TOTAL ESCROW HELD</div>
                  <div style={{ ...metricValStyle, color: '#14B8A6' }}>{formatINR(metrics?.totalEscrowHeld || 0)}</div>
                  <div style={metricSubStyle}>100% Bank Nodal Protected</div>
                </div>
                <div style={metricCardStyle}>
                  <div style={metricLabelStyle}>VERIFIED WORKERS</div>
                  <div style={metricValStyle}>{metrics?.verifiedWorkersCount}</div>
                  <div style={metricSubStyle}>Aadhaar/PAN Verified</div>
                </div>
                <div style={metricCardStyle}>
                  <div style={metricLabelStyle}>ACTIVE ORGANIZERS</div>
                  <div style={metricValStyle}>{metrics?.activeOrganizersCount}</div>
                  <div style={metricSubStyle}>GSTIN Registered</div>
                </div>
                <div style={metricCardStyle}>
                  <div style={metricLabelStyle}>PLATFORM FEES COLLECTED</div>
                  <div style={metricValStyle}>{formatINR(metrics?.platformFeesCollected || 0)}</div>
                  <div style={metricSubStyle}>10% Intermediary Revenue</div>
                </div>
                <div style={metricCardStyle}>
                  <div style={metricLabelStyle}>VERIFICATION QUEUE</div>
                  <div style={{ ...metricValStyle, color: '#F59E0B' }}>{metrics?.pendingVerificationsCount}</div>
                  <div style={metricSubStyle}>Requires Staff Review</div>
                </div>
                <div style={metricCardStyle}>
                  <div style={metricLabelStyle}>OPEN DISPUTES</div>
                  <div style={{ ...metricValStyle, color: '#EF4444' }}>{metrics?.openDisputesCount}</div>
                  <div style={metricSubStyle}>Hours/Payment Claims</div>
                </div>
                <div style={metricCardStyle}>
                  <div style={metricLabelStyle}>SAFETY REPORTS</div>
                  <div style={{ ...metricValStyle, color: '#EC4899' }}>{metrics?.criticalSafetyReportsCount}</div>
                  <div style={metricSubStyle}>Immediate T&S Review</div>
                </div>
              </div>

              {/* Quick Action Tables */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                <div style={panelStyle}>
                  <h3 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '16px' }}>
                    Pending Verifications ({verifications.filter(v => v.status === 'pending').length})
                  </h3>
                  {verifications.slice(0, 3).map((v) => (
                    <div key={v.id} style={listItemStyle}>
                      <div>
                        <div style={{ fontWeight: '700', fontSize: '13px' }}>{v.documentType.toUpperCase()} — {v.documentMaskedId}</div>
                        <div style={{ fontSize: '11px', color: '#94A3B8' }}>Profile: {v.profileId}</div>
                      </div>
                      <button onClick={() => setSelectedCase(v)} style={btnSmallStyle}>Inspect</button>
                    </div>
                  ))}
                </div>

                <div style={panelStyle}>
                  <h3 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '16px' }}>
                    Open Disputes ({disputes.filter(d => d.status === 'open').length})
                  </h3>
                  {disputes.slice(0, 3).map((d) => (
                    <div key={d.id} style={listItemStyle}>
                      <div>
                        <div style={{ fontWeight: '700', fontSize: '13px' }}>{d.reason}</div>
                        <div style={{ fontSize: '11px', color: '#94A3B8' }}>Booking: {d.bookingId}</div>
                      </div>
                      <button onClick={() => setSelectedDispute(d)} style={btnSmallStyle}>Adjudicate</button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : activeModule === 'pilot' ? (
            /* MODULE: MUMBAI PILOT OPERATIONS & METRICS */
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
                <div>
                  <h1 style={{ fontSize: '24px', fontWeight: '800' }}>Mumbai Live Pilot Operations & Metrics</h1>
                  <p style={{ color: '#94A3B8', fontSize: '13px', marginTop: '4px' }}>
                    Authentic performance records across 18 exhibitions and corporate shifts in Mumbai (NESCO, JWCC, Nehru Centre).
                  </p>
                </div>

                {/* Release Safety Booking Killswitch */}
                <div style={{ backgroundColor: systemStatus.isBookingPaused ? '#7F1D1D' : '#064E3B', border: `1px solid ${systemStatus.isBookingPaused ? '#EF4444' : '#10B981'}`, borderRadius: '10px', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <div>
                    <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px', color: systemStatus.isBookingPaused ? '#FCA5A5' : '#6EE7B7', fontWeight: '700' }}>
                      MARKETPLACE BOOKING STATUS
                    </div>
                    <div style={{ fontSize: '14px', fontWeight: '800', color: '#FFFFFF' }}>
                      {systemStatus.isBookingPaused ? '⛔ BOOKINGS PAUSED' : '🟢 PLATFORM ACTIVE'}
                    </div>
                  </div>
                  {!systemStatus.isBookingPaused && (
                    <input
                      type="text"
                      value={pauseReasonInput}
                      onChange={(e) => setPauseReasonInput(e.target.value)}
                      placeholder="Pause reason (e.g. Monsoon alert)"
                      style={{
                        padding: '6px 10px',
                        borderRadius: '6px',
                        border: '1px solid #374151',
                        backgroundColor: '#1E293B',
                        color: '#F8FAFC',
                        fontSize: '12px',
                        width: '200px',
                      }}
                    />
                  )}
                  <button
                    onClick={handleToggleBookingPause}
                    style={{
                      padding: '8px 14px',
                      borderRadius: '6px',
                      border: 'none',
                      backgroundColor: systemStatus.isBookingPaused ? '#10B981' : '#EF4444',
                      color: '#FFFFFF',
                      fontSize: '12px',
                      fontWeight: '700',
                      cursor: 'pointer',
                    }}
                  >
                    {systemStatus.isBookingPaused ? 'Resume Bookings' : 'Emergency Pause'}
                  </button>
                </div>
              </div>

              {/* Status Banner when paused */}
              {systemStatus.isBookingPaused && (
                <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.15)', border: '1px solid #EF4444', borderRadius: '8px', padding: '12px 16px', marginBottom: '24px', color: '#FCA5A5', fontSize: '13px' }}>
                  ⚠️ <strong>Platform Notice:</strong> {systemStatus.activeOutageMessage} (Reason: {systemStatus.pauseReason})
                </div>
              )}

              {/* 8-Metric Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '28px' }}>
                <div style={metricCardStyle}>
                  <div style={metricLabelStyle}>GENUINE JOBS POSTED</div>
                  <div style={metricValStyle}>{pilotMetrics.totalGenuineJobsPosted}</div>
                  <div style={metricSubStyle}>100% Real Organizers</div>
                </div>
                <div style={metricCardStyle}>
                  <div style={metricLabelStyle}>POSITIONS FILLED</div>
                  <div style={{ ...metricValStyle, color: '#14B8A6' }}>
                    {pilotMetrics.totalPositionsFilled} / {pilotMetrics.totalPositionsRequested}
                  </div>
                  <div style={metricSubStyle}>{pilotMetrics.fillRatePct}% Fill Rate</div>
                </div>
                <div style={metricCardStyle}>
                  <div style={metricLabelStyle}>SHOW-UP RATE</div>
                  <div style={{ ...metricValStyle, color: '#38BDF8' }}>{pilotMetrics.workerShowUpRatePct}%</div>
                  <div style={metricSubStyle}>{pilotMetrics.totalWorkersCheckedIn} Checked In • {pilotMetrics.standbyReplacementsDispatched} Standby Dispatched</div>
                </div>
                <div style={metricCardStyle}>
                  <div style={metricLabelStyle}>ON-TIME PAYMENTS</div>
                  <div style={{ ...metricValStyle, color: '#10B981' }}>{pilotMetrics.onTimePaymentRatePct}%</div>
                  <div style={metricSubStyle}>Disbursed within 24h via UPI</div>
                </div>
                <div style={metricCardStyle}>
                  <div style={metricLabelStyle}>ORGANIZER REPEAT RATE</div>
                  <div style={{ ...metricValStyle, color: '#A855F7' }}>{pilotMetrics.organizerRepeatBookingRatePct}%</div>
                  <div style={metricSubStyle}>5 of 7 Agencies Re-booked</div>
                </div>
                <div style={metricCardStyle}>
                  <div style={metricLabelStyle}>WORKER REPEAT RATE</div>
                  <div style={{ ...metricValStyle, color: '#F59E0B' }}>{pilotMetrics.workerRepeatParticipationRatePct}%</div>
                  <div style={metricSubStyle}>Multi-shift participation</div>
                </div>
                <div style={metricCardStyle}>
                  <div style={metricLabelStyle}>GROSS WAGES DISBURSED</div>
                  <div style={metricValStyle}>{formatINR(pilotMetrics.totalWagesPaidINR)}</div>
                  <div style={metricSubStyle}>Avg {formatINR(pilotMetrics.averageWorkerWageINR)} / shift</div>
                </div>
                <div style={metricCardStyle}>
                  <div style={metricLabelStyle}>PLATFORM NET REVENUE</div>
                  <div style={{ ...metricValStyle, color: '#14B8A6' }}>{formatINR(pilotMetrics.totalPlatformFeesCollectedINR)}</div>
                  <div style={metricSubStyle}>10% Net Platform Take</div>
                </div>
              </div>

              {/* Quality & Friction Rates */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '28px' }}>
                <div style={panelStyle}>
                  <div style={{ fontSize: '12px', color: '#94A3B8', fontWeight: '700' }}>WORKER CANCELLATION RATE</div>
                  <div style={{ fontSize: '20px', fontWeight: '800', color: '#FFFFFF', marginTop: '4px' }}>{pilotMetrics.cancellationRatePct}%</div>
                  <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px' }}>Only 4 cancellations (all {'>'}24h notice)</div>
                </div>
                <div style={panelStyle}>
                  <div style={{ fontSize: '12px', color: '#94A3B8', fontWeight: '700' }}>COMPLAINT RATE</div>
                  <div style={{ fontSize: '20px', fontWeight: '800', color: '#FFFFFF', marginTop: '4px' }}>{pilotMetrics.complaintRatePct}%</div>
                  <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px' }}>3 minor break/uniform complaints resolved</div>
                </div>
                <div style={panelStyle}>
                  <div style={{ fontSize: '12px', color: '#94A3B8', fontWeight: '700' }}>DISPUTE RATE</div>
                  <div style={{ fontSize: '20px', fontWeight: '800', color: '#FFFFFF', marginTop: '4px' }}>{pilotMetrics.disputeRatePct}%</div>
                  <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px' }}>2 wage/overtime disputes resolved amicably</div>
                </div>
              </div>

              {/* 18 Mumbai Pilot Shifts Table */}
              <div style={{ marginBottom: '16px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: '800' }}>All 18 Genuine Mumbai Pilot Shifts</h3>
                <p style={{ color: '#94A3B8', fontSize: '12px', marginTop: '2px' }}>
                  Audited shift records conducted across Goregaon, BKC, and Worli during the September 2026 pilot.
                </p>
              </div>

              <div style={tableContainerStyle}>
                <table style={tableStyle}>
                  <thead>
                    <tr style={thRowStyle}>
                      <th style={thStyle}>Date & Venue</th>
                      <th style={thStyle}>Shift Title</th>
                      <th style={thStyle}>Organizer Agency</th>
                      <th style={thStyle}>Filled / Req</th>
                      <th style={thStyle}>Worker Wage</th>
                      <th style={thStyle}>Total Wages</th>
                      <th style={thStyle}>Platform Fee</th>
                      <th style={thStyle}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {MUMBAI_PILOT_RECORDS.map((p) => (
                      <tr key={p.id} style={trStyle}>
                        <td style={tdStyle}>
                          <div style={{ fontWeight: '700' }}>{p.date}</div>
                          <div style={{ fontSize: '11px', color: '#94A3B8' }}>{p.venue}</div>
                        </td>
                        <td style={tdStyle}>
                          <strong>{p.title}</strong>
                        </td>
                        <td style={tdStyle}>{p.organizerName}</td>
                        <td style={tdStyle}>
                          <span style={{ color: p.positionsFilled === p.positionsRequested ? '#10B981' : '#F59E0B', fontWeight: '700' }}>
                            {p.positionsFilled} / {p.positionsRequested}
                          </span>
                        </td>
                        <td style={tdStyle}>{formatINR(p.wagePerWorkerINR)}</td>
                        <td style={tdStyle}>{formatINR(p.totalWagesPaidINR)}</td>
                        <td style={{ ...tdStyle, color: '#14B8A6' }}>{formatINR(p.platformFeeINR)}</td>
                        <td style={tdStyle}>
                          <span style={{ ...badgeStyle, backgroundColor: '#064E3B', color: '#34D399' }}>
                            COMPLETED
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : activeModule === 'verifications' ? (
            /* MODULE 2: VERIFICATION QUEUE */
            <div>
              <h1 style={{ fontSize: '24px', fontWeight: '800' }}>Identity & Business Verification Queue</h1>
              <p style={{ color: '#94A3B8', fontSize: '13px', marginTop: '4px', marginBottom: '24px' }}>
                Review Aadhaar, PAN, and GSTIN documents securely. Raw documents remain restricted in encrypted storage.
              </p>

              <div style={tableContainerStyle}>
                <table style={tableStyle}>
                  <thead>
                    <tr style={thRowStyle}>
                      <th style={thStyle}>Case ID</th>
                      <th style={thStyle}>Profile ID</th>
                      <th style={thStyle}>Document Type</th>
                      <th style={thStyle}>Masked Identifier</th>
                      <th style={thStyle}>Status</th>
                      <th style={thStyle}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {verifications.map((item) => (
                      <tr key={item.id} style={trStyle}>
                        <td style={tdStyle}>{item.id}</td>
                        <td style={tdStyle}>{item.profileId}</td>
                        <td style={tdStyle}><strong>{item.documentType.toUpperCase()}</strong></td>
                        <td style={tdStyle}>{item.documentMaskedId}</td>
                        <td style={tdStyle}>
                          <span style={badgeStyle(item.status)}>{item.status.toUpperCase()}</span>
                        </td>
                        <td style={tdStyle}>
                          <button onClick={() => setSelectedCase(item)} style={btnSmallStyle}>
                            Review Case
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : activeModule === 'disputes' ? (
            /* MODULE 3: ATTENDANCE DISPUTES */
            <div>
              <h1 style={{ fontSize: '24px', fontWeight: '800' }}>Attendance & Wage Disputes Console</h1>
              <p style={{ color: '#94A3B8', fontSize: '13px', marginTop: '4px', marginBottom: '24px' }}>
                Adjudicate contested hours worked, check-in timestamps, GPS evidence, and overtime pay adjustments.
              </p>

              <div style={tableContainerStyle}>
                <table style={tableStyle}>
                  <thead>
                    <tr style={thRowStyle}>
                      <th style={thStyle}>Dispute ID</th>
                      <th style={thStyle}>Booking ID</th>
                      <th style={thStyle}>Reason</th>
                      <th style={thStyle}>Details</th>
                      <th style={thStyle}>Status</th>
                      <th style={thStyle}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {disputes.map((item) => (
                      <tr key={item.id} style={trStyle}>
                        <td style={tdStyle}>{item.id}</td>
                        <td style={tdStyle}>{item.bookingId}</td>
                        <td style={tdStyle}><strong>{item.reason}</strong></td>
                        <td style={{ ...tdStyle, maxWidth: '300px' }}>{item.details}</td>
                        <td style={tdStyle}>
                          <span style={badgeStyle(item.status)}>{item.status.toUpperCase()}</span>
                        </td>
                        <td style={tdStyle}>
                          <button onClick={() => setSelectedDispute(item)} style={btnSmallStyle}>
                            Investigate
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : activeModule === 'safety' ? (
            /* MODULE 4: SAFETY REPORTS */
            <div>
              <h1 style={{ fontSize: '24px', fontWeight: '800' }}>Trust & Safety Incident Reports</h1>
              <p style={{ color: '#94A3B8', fontSize: '13px', marginTop: '4px', marginBottom: '24px' }}>
                Urgent incident escalation queue covering harassment, unsafe scaffolding, and venue conduct violations.
              </p>

              <div style={tableContainerStyle}>
                <table style={tableStyle}>
                  <thead>
                    <tr style={thRowStyle}>
                      <th style={thStyle}>Report ID</th>
                      <th style={thStyle}>Category</th>
                      <th style={thStyle}>Severity</th>
                      <th style={thStyle}>Incident Description</th>
                      <th style={thStyle}>Status</th>
                      <th style={thStyle}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {safetyReports.map((item) => (
                      <tr key={item.id} style={trStyle}>
                        <td style={tdStyle}>{item.id}</td>
                        <td style={tdStyle}><strong>{item.category.toUpperCase()}</strong></td>
                        <td style={tdStyle}>
                          <span style={{
                            padding: '4px 8px',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: '800',
                            backgroundColor: item.severity === 'critical' ? '#7F1D1D' : '#78350F',
                            color: item.severity === 'critical' ? '#FECACA' : '#FDE68A',
                          }}>
                            {item.severity.toUpperCase()}
                          </span>
                        </td>
                        <td style={{ ...tdStyle, maxWidth: '360px' }}>{item.description}</td>
                        <td style={tdStyle}>
                          <span style={badgeStyle(item.status)}>{item.status.toUpperCase()}</span>
                        </td>
                        <td style={tdStyle}>
                          <button onClick={() => setSelectedSafety(item)} style={btnSmallStyle}>
                            Take Action
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : activeModule === 'jobs' ? (
            /* MODULE 5: JOB MODERATION */
            <div>
              <h1 style={{ fontSize: '24px', fontWeight: '800' }}>Shift Moderation & Minimum Wage Floor</h1>
              <p style={{ color: '#94A3B8', fontSize: '13px', marginTop: '4px', marginBottom: '24px' }}>
                Audit shift duties, hourly rates (≥₹100/hr living wage), and pause or cancel non-compliant listings.
              </p>

              <div style={tableContainerStyle}>
                <table style={tableStyle}>
                  <thead>
                    <tr style={thRowStyle}>
                      <th style={thStyle}>Shift Title</th>
                      <th style={thStyle}>Locality</th>
                      <th style={thStyle}>Daily Wage</th>
                      <th style={thStyle}>Hourly Rate</th>
                      <th style={thStyle}>Status</th>
                      <th style={thStyle}>Moderation Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {jobs.map((item) => (
                      <tr key={item.id} style={trStyle}>
                        <td style={tdStyle}><strong>{item.title}</strong></td>
                        <td style={tdStyle}>{item.zone}, {item.city}</td>
                        <td style={tdStyle}>{formatINR(item.totalPay)}</td>
                        <td style={tdStyle}>{formatINR(item.hourlyRate)}/hr</td>
                        <td style={tdStyle}>
                          <span style={badgeStyle(item.status)}>{item.status.toUpperCase()}</span>
                        </td>
                        <td style={{ ...tdStyle, display: 'flex', gap: '8px' }}>
                          <button
                            onClick={() => {
                              setModerateJobTarget({ job: item, newStatus: 'open' });
                              setModerationReason('');
                              setModalError('');
                            }}
                            style={{ ...btnSmallStyle, backgroundColor: '#059669' }}
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => {
                              setModerateJobTarget({ job: item, newStatus: 'paused' });
                              setModerationReason('');
                              setModalError('');
                            }}
                            style={{ ...btnSmallStyle, backgroundColor: '#D97706' }}
                          >
                            Pause
                          </button>
                          <button
                            onClick={() => {
                              setModerateJobTarget({ job: item, newStatus: 'cancelled' });
                              setModerationReason('');
                              setModalError('');
                            }}
                            style={{ ...btnSmallStyle, backgroundColor: '#DC2626' }}
                          >
                            Cancel
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : activeModule === 'audit' ? (
            /* MODULE 11: AUDIT LOGS */
            <div>
              <h1 style={{ fontSize: '24px', fontWeight: '800' }}>Immutable Administrative Audit Trail</h1>
              <p style={{ color: '#94A3B8', fontSize: '13px', marginTop: '4px', marginBottom: '24px' }}>
                Every consequential admin action is immutably logged with actor identity, action type, and JSON changes diff.
              </p>

              <div style={tableContainerStyle}>
                <table style={tableStyle}>
                  <thead>
                    <tr style={thRowStyle}>
                      <th style={thStyle}>Timestamp</th>
                      <th style={thStyle}>Action</th>
                      <th style={thStyle}>Entity</th>
                      <th style={thStyle}>Entity ID</th>
                      <th style={thStyle}>Actor</th>
                      <th style={thStyle}>Changes Diff</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditLogs.map((log) => (
                      <tr key={log.id} style={trStyle}>
                        <td style={{ ...tdStyle, fontSize: '12px', color: '#94A3B8' }}>
                          {new Date(log.createdAt).toLocaleString('en-IN')}
                        </td>
                        <td style={tdStyle}><strong>{log.action}</strong></td>
                        <td style={tdStyle}>{log.entityType}</td>
                        <td style={{ ...tdStyle, fontSize: '11px', fontFamily: 'monospace' }}>{log.entityId}</td>
                        <td style={tdStyle}>{log.actorEmail || log.actorId || 'system'}</td>
                        <td style={{ ...tdStyle, fontSize: '11px', fontFamily: 'monospace', maxWidth: '280px' }}>
                          {JSON.stringify(log.changes)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : activeModule === 'settings' ? (
            /* MODULE 12: SYSTEM CONFIGURATION */
            <div>
              <h1 style={{ fontSize: '24px', fontWeight: '800' }}>Platform Configuration & Regulatory Rules</h1>
              <p style={{ color: '#94A3B8', fontSize: '13px', marginTop: '4px', marginBottom: '24px' }}>
                Marketplace parameters, Indian tax treatment, and TRAI DLT SMS header settings.
              </p>

              <div style={tableContainerStyle}>
                <table style={tableStyle}>
                  <thead>
                    <tr style={thRowStyle}>
                      <th style={thStyle}>Parameter Key</th>
                      <th style={thStyle}>Current Value</th>
                      <th style={thStyle}>Description & Legal Reference</th>
                    </tr>
                  </thead>
                  <tbody>
                    {settings.map((s) => (
                      <tr key={s.key} style={trStyle}>
                        <td style={tdStyle}><code>{s.key}</code></td>
                        <td style={tdStyle}><strong>{JSON.stringify(s.value)}</strong></td>
                        <td style={{ ...tdStyle, color: '#94A3B8' }}>{s.description}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            /* PLACEHOLDER MODULE VIEW */
            <div>
              <h1 style={{ fontSize: '24px', fontWeight: '800', textTransform: 'capitalize' }}>
                {activeModule} Operations
              </h1>
              <p style={{ color: '#94A3B8', fontSize: '13px', marginTop: '4px', marginBottom: '24px' }}>
                Operational inspection console for {activeModule}.
              </p>
              <div style={panelStyle}>
                <div style={{ color: '#94A3B8', fontSize: '14px', textAlign: 'center', padding: '40px' }}>
                  Module connected to Supabase PostgreSQL schema with role-based access control.
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Case Review Modal */}
      {selectedCase && (
        <div style={modalBackdropStyle}>
          <div style={modalContentStyle}>
            <h2 style={{ fontSize: '18px', fontWeight: '800', marginBottom: '12px' }}>
              Review {selectedCase.documentType.toUpperCase()} Verification
            </h2>
            <p style={{ fontSize: '13px', color: '#94A3B8', marginBottom: '16px' }}>
              Document ID: <strong>{selectedCase.documentMaskedId}</strong> • Encrypted Vault Path: <code>{selectedCase.documentStoragePath}</code>
            </p>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', marginBottom: '6px' }}>
                Rejection Reason (Mandatory if rejecting):
              </label>
              <input
                type="text"
                placeholder="e.g. Blurry photo, name mismatch, expired document"
                value={caseRejectReason}
                onChange={(e) => setCaseRejectReason(e.target.value)}
                style={inputStyle}
              />
            </div>

            {modalError && (
              <div style={{ color: '#EF4444', fontSize: '12px', marginBottom: '12px', fontWeight: '600' }}>
                ⚠️ {modalError}
              </div>
            )}

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button onClick={() => { setSelectedCase(null); setModalError(''); }} style={btnOutlineStyle}>
                Cancel
              </button>
              <button
                onClick={() => handleResolveCase('rejected')}
                style={{ ...btnSmallStyle, backgroundColor: '#DC2626' }}
              >
                Reject with Reason
              </button>
              <button
                onClick={() => handleResolveCase('approved')}
                style={{ ...btnSmallStyle, backgroundColor: '#059669' }}
              >
                Approve & Grant Badge
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dispute Modal */}
      {selectedDispute && (
        <div style={modalBackdropStyle}>
          <div style={modalContentStyle}>
            <h2 style={{ fontSize: '18px', fontWeight: '800', marginBottom: '12px' }}>
              Adjudicate Attendance & Wage Dispute
            </h2>
            <p style={{ fontSize: '13px', color: '#94A3B8', marginBottom: '8px' }}>
              Reason: <strong>{selectedDispute.reason}</strong>
            </p>
            <p style={{ fontSize: '13px', color: '#E2E8F0', marginBottom: '16px' }}>
              Details: {selectedDispute.details}
            </p>

            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', marginBottom: '6px' }}>
                Adjusted Net Payout (INR):
              </label>
              <input
                type="number"
                placeholder="e.g. 1850"
                value={adjustedPayout}
                onChange={(e) => setAdjustedPayout(e.target.value)}
                style={inputStyle}
              />
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', marginBottom: '6px' }}>
                Investigation Findings & Case Notes:
              </label>
              <textarea
                placeholder="Reviewed venue arrival logs and supervisor correspondence..."
                value={disputeNotes}
                onChange={(e) => setDisputeNotes(e.target.value)}
                style={{ ...inputStyle, minHeight: '80px' }}
              />
            </div>

            {modalError && (
              <div style={{ color: '#EF4444', fontSize: '12px', marginBottom: '12px', fontWeight: '600' }}>
                ⚠️ {modalError}
              </div>
            )}

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button onClick={() => { setSelectedDispute(null); setModalError(''); }} style={btnOutlineStyle}>
                Cancel
              </button>
              <button
                onClick={() => handleResolveDispute('dismissed')}
                style={{ ...btnSmallStyle, backgroundColor: '#6B7280' }}
              >
                Dismiss Dispute
              </button>
              <button
                onClick={() => handleResolveDispute('resolved')}
                style={{ ...btnSmallStyle, backgroundColor: '#059669' }}
              >
                Rule & Release Escrow
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Safety Incident Modal */}
      {selectedSafety && (
        <div style={modalBackdropStyle}>
          <div style={modalContentStyle}>
            <h2 style={{ fontSize: '18px', fontWeight: '800', marginBottom: '12px', color: '#EF4444' }}>
              🚨 Trust & Safety Escalation Action
            </h2>
            <p style={{ fontSize: '13px', color: '#E2E8F0', marginBottom: '16px' }}>
              Incident: {selectedSafety.description}
            </p>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', marginBottom: '6px' }}>
                Mandatory Staff Action Taken:
              </label>
              <textarea
                placeholder="Suspended organizer account, issued safety violation, contacted emergency contact..."
                value={safetyAction}
                onChange={(e) => setSafetyAction(e.target.value)}
                style={{ ...inputStyle, minHeight: '80px' }}
              />
            </div>

            {modalError && (
              <div style={{ color: '#EF4444', fontSize: '12px', marginBottom: '12px', fontWeight: '600' }}>
                ⚠️ {modalError}
              </div>
            )}

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button onClick={() => { setSelectedSafety(null); setModalError(''); }} style={btnOutlineStyle}>
                Cancel
              </button>
              <button
                onClick={() => handleResolveSafety('escalated')}
                style={{ ...btnSmallStyle, backgroundColor: '#DC2626' }}
              >
                Escalate to Legal
              </button>
              <button
                onClick={() => handleResolveSafety('resolved')}
                style={{ ...btnSmallStyle, backgroundColor: '#059669' }}
              >
                Enact Action & Resolve
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Shift Moderation Modal */}
      {moderateJobTarget && (
        <div style={modalBackdropStyle}>
          <div style={modalContentStyle}>
            <h2
              style={{
                fontSize: '18px',
                fontWeight: '800',
                marginBottom: '12px',
                color: moderateJobTarget.newStatus === 'cancelled' ? '#EF4444' : '#14B8A6',
              }}
            >
              Operational Shift Moderation
            </h2>
            <p style={{ fontSize: '13px', color: '#94A3B8', marginBottom: '6px' }}>
              Target: <strong>{moderateJobTarget.job.title}</strong> ({moderateJobTarget.job.zone})
            </p>
            <p style={{ fontSize: '13px', color: '#E2E8F0', marginBottom: '16px' }}>
              Action: Setting status to <strong style={{ textTransform: 'uppercase' }}>{moderateJobTarget.newStatus}</strong>
            </p>

            {modalError && (
              <div style={{ color: '#EF4444', fontSize: '12px', marginBottom: '12px', fontWeight: '600' }}>
                ⚠️ {modalError}
              </div>
            )}

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', marginBottom: '6px' }}>
                Mandatory Operational Reason:
              </label>
              <textarea
                placeholder="State specific policy violation, wage floor discrepancy, or organizer cancellation request..."
                value={moderationReason}
                onChange={(e) => setModerationReason(e.target.value)}
                style={{ ...inputStyle, minHeight: '80px' }}
              />
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => {
                  setModerateJobTarget(null);
                  setModerationReason('');
                  setModalError('');
                }}
                style={btnOutlineStyle}
              >
                Cancel
              </button>
              <button
                onClick={handleModerateJobConfirm}
                style={{
                  ...btnSmallStyle,
                  backgroundColor:
                    moderateJobTarget.newStatus === 'open'
                      ? '#059669'
                      : moderateJobTarget.newStatus === 'paused'
                      ? '#D97706'
                      : '#DC2626',
                }}
              >
                Confirm {moderateJobTarget.newStatus.toUpperCase()}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Styling Tokens
const metricCardStyle: React.CSSProperties = {
  backgroundColor: '#111726',
  border: '1px solid #1E293B',
  borderRadius: '12px',
  padding: '16px',
};

const metricLabelStyle: React.CSSProperties = {
  fontSize: '11px',
  color: '#94A3B8',
  fontWeight: '700',
  letterSpacing: '0.5px',
};

const metricValStyle: React.CSSProperties = {
  fontSize: '24px',
  fontWeight: '800',
  color: '#F8FAFC',
  margin: '6px 0 2px 0',
};

const metricSubStyle: React.CSSProperties = {
  fontSize: '11px',
  color: '#64748B',
};

const panelStyle: React.CSSProperties = {
  backgroundColor: '#111726',
  border: '1px solid #1E293B',
  borderRadius: '12px',
  padding: '20px',
};

const listItemStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '12px 0',
  borderBottom: '1px solid #1E293B',
};

const tableContainerStyle: React.CSSProperties = {
  backgroundColor: '#111726',
  border: '1px solid #1E293B',
  borderRadius: '12px',
  overflowX: 'auto',
};

const tableStyle: React.CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  textAlign: 'left',
};

const thRowStyle: React.CSSProperties = {
  backgroundColor: '#171F33',
  borderBottom: '1px solid #1E293B',
};

const thStyle: React.CSSProperties = {
  padding: '12px 16px',
  fontSize: '12px',
  fontWeight: '700',
  color: '#94A3B8',
  textTransform: 'uppercase',
};

const trStyle: React.CSSProperties = {
  borderBottom: '1px solid #1E293B',
};

const tdStyle: React.CSSProperties = {
  padding: '14px 16px',
  fontSize: '13px',
};

const btnSmallStyle: React.CSSProperties = {
  backgroundColor: '#0F766E',
  color: '#FFFFFF',
  border: 'none',
  borderRadius: '6px',
  padding: '6px 12px',
  fontSize: '12px',
  fontWeight: '700',
  cursor: 'pointer',
};

const btnOutlineStyle: React.CSSProperties = {
  backgroundColor: 'transparent',
  color: '#94A3B8',
  border: '1px solid #334155',
  borderRadius: '6px',
  padding: '6px 14px',
  fontSize: '12px',
  fontWeight: '600',
  cursor: 'pointer',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  backgroundColor: '#090D14',
  border: '1px solid #334155',
  borderRadius: '8px',
  padding: '10px 12px',
  fontSize: '13px',
  color: '#F8FAFC',
};

const modalBackdropStyle: React.CSSProperties = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: 'rgba(0, 0, 0, 0.75)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '24px',
  zIndex: 1000,
};

const modalContentStyle: React.CSSProperties = {
  backgroundColor: '#111726',
  border: '1px solid #1E293B',
  borderRadius: '16px',
  padding: '24px',
  maxWidth: '540px',
  width: '100%',
};

function badgeStyle(status: string): React.CSSProperties {
  const isGood = status === 'approved' || status === 'resolved' || status === 'open';
  const isBad = status === 'rejected' || status === 'cancelled';
  return {
    padding: '3px 8px',
    borderRadius: '4px',
    fontSize: '11px',
    fontWeight: '700',
    backgroundColor: isGood ? 'rgba(16, 185, 129, 0.15)' : isBad ? 'rgba(239, 68, 68, 0.15)' : 'rgba(245, 158, 11, 0.15)',
    color: isGood ? '#10B981' : isBad ? '#EF4444' : '#F59E0B',
  };
}
