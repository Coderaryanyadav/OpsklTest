'use client';

import { useState, useEffect } from 'react';
import {
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
  PilotMetricsSummary,
  setBookingPauseStatus,
  getSystemOperationalStatus,
  syncKillswitchFromDatabase,
  SystemOperationalStatus,
} from '@opskil/shared';

import { AdminSidebar, AdminModule } from '../components/AdminSidebar';
import { AdminHeader } from '../components/AdminHeader';
import { MetricCards } from '../components/MetricCards';
import { VerificationQueue } from '../components/VerificationQueue';
import { DisputesQueue } from '../components/DisputesQueue';
import { SafetyQueue } from '../components/SafetyQueue';
import { JobModerationTable } from '../components/JobModerationTable';
import { AuditLogsTable } from '../components/AuditLogsTable';
import { PlatformSettingsPanel } from '../components/PlatformSettingsPanel';
import { MumbaiPilotDashboard } from '../components/MumbaiPilotDashboard';

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

  // Status and feedback
  const [systemStatus, setSystemStatus] = useState<SystemOperationalStatus>(getSystemOperationalStatus());
  const [pilotMetrics] = useState<PilotMetricsSummary>(calculatePilotMetricsSummary());
  const [actionSuccessMessage, setActionSuccessMessage] = useState('');

  const loadAdminData = async () => {
    try {
      const [m, v, d, s, j, a, cfg, syncedStatus] = await Promise.all([
        fetchAdminDashboardMetrics(),
        fetchVerificationQueue(),
        fetchDisputesQueue(),
        fetchSafetyReportsQueue(),
        fetchModerationJobs(),
        fetchAuditLogs(),
        fetchPlatformSettings(),
        syncKillswitchFromDatabase(),
      ]);
      setMetrics(m);
      setVerifications(v);
      setDisputes(d);
      setSafetyReports(s);
      setJobs(j);
      setAuditLogs(a);
      setSettings(cfg);
      if (syncedStatus) {
        setSystemStatus(syncedStatus);
      }
    } catch (err) {
      console.error('Failed to load admin data', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAdminData();
  }, []);

  const handleToggleBookingPause = (reason?: string) => {
    const nextPaused = !systemStatus.isBookingPaused;
    const pauseReason = reason || 'Administrative precaution';
    const updated = setBookingPauseStatus(
      nextPaused,
      nextPaused ? pauseReason : undefined,
      'Ops Director (Aryan Yadav)',
      nextPaused ? `Notice: New shift bookings are temporarily paused due to: ${pauseReason}` : undefined
    );
    setSystemStatus(updated);
    setActionSuccessMessage(
      nextPaused ? 'Shift bookings have been PAUSED platform-wide.' : 'Shift bookings have been RESUMED.'
    );
  };

  const handleResolveCase = async (
    caseId: string,
    status: 'approved' | 'rejected',
    reason: string
  ) => {
    const res = await resolveVerificationCaseSafe(
      caseId,
      status,
      reason,
      'admin-super-id'
    );
    if (res.success) {
      setVerifications((prev) =>
        prev.map((c) => (c.id === caseId ? { ...c, status } : c))
      );
      setActionSuccessMessage(`Verification case has been ${status}.`);
    } else {
      throw new Error(res.error || 'Failed to resolve verification case');
    }
  };

  const handleResolveDispute = async (
    disputeId: string,
    status: 'resolved' | 'dismissed',
    notes: string,
    adjustedPayout?: number
  ) => {
    const res = await resolveDisputeSafe(
      disputeId,
      status,
      notes,
      adjustedPayout,
      'admin-super-id'
    );
    if (res.success) {
      setDisputes((prev) =>
        prev.map((d) => (d.id === disputeId ? { ...d, status } : d))
      );
      setActionSuccessMessage('Attendance dispute successfully adjudicated.');
    } else {
      throw new Error(res.error || 'Failed to adjudicate dispute');
    }
  };

  const handleResolveSafetyReport = async (reportId: string, actionTaken: string) => {
    const res = await resolveSafetyReportSafe(
      reportId,
      'resolved',
      actionTaken,
      actionTaken,
      'admin-super-id'
    );
    if (res.success) {
      setSafetyReports((prev) =>
        prev.map((r) => (r.id === reportId ? { ...r, status: 'resolved' } : r))
      );
      setActionSuccessMessage('Safety grievance marked resolved.');
    } else {
      throw new Error(res.error || 'Failed to resolve safety report');
    }
  };

  const handleModerateJob = async (
    jobId: string,
    status: 'open' | 'paused' | 'cancelled',
    reason: string
  ) => {
    const res = await moderateJobSafe(
      jobId,
      status,
      reason,
      'admin-super-id'
    );
    if (res.success) {
      setJobs((prev) =>
        prev.map((j) => (j.id === jobId ? { ...j, status } : j))
      );
      setActionSuccessMessage(`Shift status updated to ${status}.`);
    } else {
      throw new Error(res.error || 'Failed to moderate shift');
    }
  };

  const getPageTitle = (mod: AdminModule) => {
    switch (mod) {
      case 'overview':
        return { title: 'Platform Operations Overview', subtitle: 'Live marketplace KPIs, workforce metrics, and liquidity volume' };
      case 'pilot':
        return { title: 'Mumbai Live Pilot', subtitle: 'Regional execution tracking across BKC, NESCO and South Mumbai' };
      case 'verifications':
        return { title: 'Identity & Business Verification Queue', subtitle: 'KYC review for worker Aadhaar and organizer GSTIN credentials' };
      case 'disputes':
        return { title: 'Attendance & Wage Disputes', subtitle: 'Arbitration and supervisor sign-off investigation desk' };
      case 'safety':
        return { title: 'Safety Reports & Grievances', subtitle: 'Critical workplace complaints and SOS incident management' };
      case 'jobs':
        return { title: 'Shift Moderation & Minimum Wage Floor', subtitle: 'Quality assurance, living wage floor enforcement, and cancellation desk' };
      case 'audit':
        return { title: 'Immutable Administrative Audit Trail', subtitle: 'Cryptographically sealed audit logs of administrative actions' };
      case 'settings':
        return { title: 'Platform System Configuration', subtitle: 'Operational killswitch and database-backed configuration' };
      default:
        return { title: 'Platform Operations', subtitle: 'Opskl Administration' };
    }
  };

  const { title, subtitle } = getPageTitle(activeModule);

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#F5F7FB' }}>
      {/* Fixed Navigation Sidebar */}
      <AdminSidebar
        activeModule={activeModule}
        onSelectModule={setActiveModule}
        systemStatus={systemStatus}
        pendingVerificationsCount={verifications.filter((v) => v.status === 'pending').length}
        activeDisputesCount={disputes.filter((d) => d.status !== 'resolved').length}
        urgentSafetyCount={safetyReports.filter((s) => s.status !== 'resolved').length}
      />

      {/* Main Workspace */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <AdminHeader
          title={title}
          subtitle={subtitle}
          systemStatus={systemStatus}
          onToggleBookingPause={() => handleToggleBookingPause()}
          actionSuccessMessage={actionSuccessMessage}
          onDismissMessage={() => setActionSuccessMessage('')}
        />

        <main style={{ padding: '24px 28px', flex: 1, maxWidth: 1400 }}>
          {loading ? (
            <div style={{ padding: '60px', textAlign: 'center', color: '#64748B' }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>⚡</div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>Loading operations console...</div>
            </div>
          ) : (
            <>
              {activeModule === 'overview' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                  <MetricCards metrics={metrics} />
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(480px, 1fr))', gap: 20 }}>
                    <VerificationQueue
                      verifications={verifications.slice(0, 5)}
                      onResolveCase={handleResolveCase}
                    />
                    <DisputesQueue
                      disputes={disputes.slice(0, 5)}
                      onResolveDispute={handleResolveDispute}
                    />
                  </div>
                </div>
              )}

              {activeModule === 'pilot' && (
                <MumbaiPilotDashboard pilotMetrics={pilotMetrics} />
              )}

              {activeModule === 'verifications' && (
                <VerificationQueue
                  verifications={verifications}
                  onResolveCase={handleResolveCase}
                />
              )}

              {activeModule === 'disputes' && (
                <DisputesQueue
                  disputes={disputes}
                  onResolveDispute={handleResolveDispute}
                />
              )}

              {activeModule === 'safety' && (
                <SafetyQueue
                  safetyReports={safetyReports}
                  onResolveSafetyReport={handleResolveSafetyReport}
                />
              )}

              {activeModule === 'jobs' && (
                <JobModerationTable
                  jobs={jobs}
                  onModerateJob={handleModerateJob}
                />
              )}

              {activeModule === 'audit' && (
                <AuditLogsTable auditLogs={auditLogs} />
              )}

              {activeModule === 'settings' && (
                <PlatformSettingsPanel
                  settings={settings}
                  systemStatus={systemStatus}
                  onToggleBookingPause={handleToggleBookingPause}
                />
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
