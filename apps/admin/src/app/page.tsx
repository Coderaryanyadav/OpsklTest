'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
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
  setBookingPauseStatusSafe,
  getSystemOperationalStatus,
  syncKillswitchFromDatabase,
  SystemOperationalStatus,
} from '@opskil/shared';
import { adminSupabase } from '../lib/supabase';

import { AdminSidebar, AdminModule } from '../components/AdminSidebar';
import { AdminHeader } from '../components/AdminHeader';
import { MetricCards } from '../components/MetricCards';
import { VerificationQueue } from '../components/VerificationQueue';
import { DisputesQueue } from '../components/DisputesQueue';
import { SafetyQueue } from '../components/SafetyQueue';
import { JobModerationTable } from '../components/JobModerationTable';
import { AuditLogsTable } from '../components/AuditLogsTable';
import { PlatformSettingsPanel } from '../components/PlatformSettingsPanel';
import { DirectoryTable, DirectoryUser } from '../components/DirectoryTable';

export default function AdminDashboardPage() {
  const router = useRouter();
  const [activeModule, setActiveModule] = useState<AdminModule>('overview');
  const [metrics, setMetrics] = useState<AdminOverviewMetrics | null>(null);
  const [verifications, setVerifications] = useState<VerificationCase[]>([]);
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [safetyReports, setSafetyReports] = useState<SafetyReport[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [settings, setSettings] = useState<PlatformSetting[]>([]);
  const [directoryWorkers, setDirectoryWorkers] = useState<DirectoryUser[]>([]);
  const [directoryOrganizers, setDirectoryOrganizers] = useState<DirectoryUser[]>([]);
  const [loading, setLoading] = useState(true);

  // Status and feedback
  const [adminUser, setAdminUser] = useState<{ email?: string; fullName?: string } | null>(null);
  const [systemStatus, setSystemStatus] = useState<SystemOperationalStatus>(getSystemOperationalStatus());
  const [actionSuccessMessage, setActionSuccessMessage] = useState('');
  const [dashboardError, setDashboardError] = useState<string | null>(null);

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
      if (m.hasQueryErrors) {
        setDashboardError('Telemetry query warning: One or more database queries encountered errors. Displayed figures may be partial.');
      } else {
        setDashboardError(null);
      }
      // Load worker and organizer directory records
      const [workersQuery, orgsQuery] = await Promise.all([
        adminSupabase
          .from('profiles')
          .select('id, full_name, email, phone, is_active, created_at, worker_profiles(verification_status, is_aadhaar_verified, is_pan_verified, skills, preferred_locality, shifts_completed, upi_id)')
          .eq('role', 'worker'),
        adminSupabase
          .from('profiles')
          .select('id, full_name, email, phone, is_active, created_at, organizer_profiles(business_name, business_type, verification_status, is_gstin_verified, gstin, total_events_hosted)')
          .eq('role', 'organizer'),
      ]);

      if (workersQuery.data) {
        setDirectoryWorkers(
          workersQuery.data.map((row: any) => {
            const wp = Array.isArray(row.worker_profiles) ? row.worker_profiles[0] : row.worker_profiles;
            return {
              id: row.id,
              fullName: row.full_name || 'Worker',
              email: row.email || '',
              phone: row.phone,
              role: 'worker',
              isActive: row.is_active ?? true,
              createdAt: row.created_at,
              verificationStatus: wp?.verification_status || 'unverified',
              isAadhaarVerified: wp?.is_aadhaar_verified || false,
              isPanVerified: wp?.is_pan_verified || false,
              skills: wp?.skills || [],
              preferredLocality: wp?.preferred_locality || 'Mumbai',
              shiftsCompleted: wp?.shifts_completed || 0,
              upiId: wp?.upi_id,
            };
          })
        );
      }

      if (orgsQuery.data) {
        setDirectoryOrganizers(
          orgsQuery.data.map((row: any) => {
            const op = Array.isArray(row.organizer_profiles) ? row.organizer_profiles[0] : row.organizer_profiles;
            return {
              id: row.id,
              fullName: row.full_name || 'Organizer',
              email: row.email || '',
              phone: row.phone,
              role: 'organizer',
              isActive: row.is_active ?? true,
              createdAt: row.created_at,
              businessName: op?.business_name || row.full_name || 'Event Agency',
              businessType: op?.business_type || 'event_agency',
              verificationStatus: op?.verification_status || 'unverified',
              isGstinVerified: op?.is_gstin_verified || false,
              gstin: op?.gstin,
              totalEventsHosted: op?.total_events_hosted || 0,
            };
          })
        );
      }
    } catch (err: any) {
      console.error('Failed to load admin data', err);
      setDashboardError(err.message || 'Failed to connect to database operations services.');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActiveStatus = async (userId: string, currentActive: boolean) => {
    try {
      const { error } = await adminSupabase
        .from('profiles')
        .update({ is_active: !currentActive, updated_at: new Date().toISOString() })
        .eq('id', userId);

      if (error) throw error;

      setDirectoryWorkers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, isActive: !currentActive } : u))
      );
      setDirectoryOrganizers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, isActive: !currentActive } : u))
      );
      setActionSuccessMessage(
        !currentActive ? 'Account reactivated successfully.' : 'Account suspended successfully.'
      );
    } catch (err: any) {
      alert(`Failed to update account status: ${err.message}`);
    }
  };

  useEffect(() => {
    const checkAuthAndLoad = async () => {
      try {
        const { data: { session } } = await adminSupabase.auth.getSession();
        if (!session) {
          router.push('/login');
          return;
        }

        const { data: profile } = await adminSupabase
          .from('profiles')
          .select('role, is_active, full_name, email')
          .eq('id', session.user.id)
          .maybeSingle();

        if (!profile || profile.role !== 'admin' || !profile.is_active) {
          await adminSupabase.auth.signOut();
          router.push('/login');
          return;
        }

        setAdminUser({
          email: profile.email || session.user.email || 'admin@opskil.com',
          fullName: profile.full_name || 'Opskl Administrator',
        });

        await loadAdminData();
      } catch (err) {
        console.error('Failed to verify admin authorization', err);
        router.push('/login');
      }
    };

    checkAuthAndLoad();
  }, []);

  const handleSignOut = async () => {
    try {
      if (typeof document !== 'undefined') {
        document.cookie = 'opskil_test_session=; path=/; max-age=0; SameSite=Lax';
      }
      await adminSupabase.auth.signOut();
    } finally {
      window.location.href = '/login';
    }
  };

  const handleToggleBookingPause = async (reason?: string) => {
    const nextPaused = !systemStatus.isBookingPaused;
    const pauseReason = reason || 'Administrative precaution';
    const res = await setBookingPauseStatusSafe(
      nextPaused,
      nextPaused ? pauseReason : undefined,
      undefined,
      nextPaused ? `Notice: New shift bookings are temporarily paused due to: ${pauseReason}` : undefined
    );

    if (res.success) {
      setSystemStatus(res.status);
      setActionSuccessMessage(
        nextPaused ? 'Shift bookings have been PAUSED platform-wide and verified in database.' : 'Shift bookings have been RESUMED.'
      );
    } else {
      alert(`Failed to persist booking killswitch: ${res.error}`);
    }
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
      undefined
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
      undefined
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
      undefined
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
      undefined
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
      case 'verifications':
        return { title: 'Identity & Business Verification Queue', subtitle: 'KYC review for worker Aadhaar and organizer GSTIN credentials' };
      case 'disputes':
        return { title: 'Attendance & Wage Disputes', subtitle: 'Arbitration and supervisor sign-off investigation desk' };
      case 'safety':
        return { title: 'Safety Reports & Grievances', subtitle: 'Critical workplace complaints and SOS incident management' };
      case 'jobs':
        return { title: 'Shift Moderation & Minimum Wage Floor', subtitle: 'Quality assurance, living wage floor enforcement, and cancellation desk' };
      case 'workers':
        return { title: 'Verified Worker Talent Pool', subtitle: 'Browse, filter, and manage registered event workforce profiles and KYC records' };
      case 'organizers':
        return { title: 'Event Agencies & Organizers Directory', subtitle: 'Verified event agencies, production houses, and company organizers' };
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
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#F5F5F5' }}>
      {/* Fixed Navigation Sidebar */}
      <AdminSidebar
        activeModule={activeModule}
        onSelectModule={setActiveModule}
        systemStatus={systemStatus}
        pendingVerificationsCount={verifications.filter((v) => v.status === 'pending').length}
        activeDisputesCount={disputes.filter((d) => d.status !== 'resolved').length}
        urgentSafetyCount={safetyReports.filter((s) => s.status !== 'resolved').length}
        adminUser={adminUser}
        onSignOut={handleSignOut}
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
          {dashboardError && (
            <div
              style={{
                backgroundColor: '#FEF2F2',
                border: '1px solid #F87171',
                color: '#991B1B',
                padding: '12px 16px',
                borderRadius: 8,
                marginBottom: 20,
                fontSize: 13,
                fontWeight: 500,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <span>Notice: {dashboardError}</span>
              <button
                onClick={() => setDashboardError(null)}
                style={{ background: 'none', border: 'none', color: '#991B1B', cursor: 'pointer', fontWeight: 700 }}
              >
                ✕
              </button>
            </div>
          )}

          {loading ? (
            <div style={{ padding: '60px', textAlign: 'center', color: '#737373' }}>
              <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: 0.5, textTransform: 'uppercase' }}>
                Loading operations console…
              </div>
            </div>
          ) : (
            <>
              {activeModule === 'overview' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
                  <MetricCards metrics={metrics} />
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                    <VerificationQueue
                      verifications={verifications}
                      onResolveCase={handleResolveCase}
                    />
                    <DisputesQueue
                      disputes={disputes}
                      onResolveDispute={handleResolveDispute}
                    />
                  </div>
                </div>
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

              {activeModule === 'workers' && (
                <DirectoryTable
                  type="worker"
                  users={directoryWorkers}
                  onToggleActiveStatus={handleToggleActiveStatus}
                  onRefresh={loadAdminData}
                />
              )}

              {activeModule === 'organizers' && (
                <DirectoryTable
                  type="organizer"
                  users={directoryOrganizers}
                  onToggleActiveStatus={handleToggleActiveStatus}
                  onRefresh={loadAdminData}
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
