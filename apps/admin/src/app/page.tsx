'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
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
  EmergencyBroadcastDetails,
  adminSetUserStatusSafe,
} from '@opskil/shared';
import { adminSupabase } from '../lib/supabase';

import { AdminSidebar, AdminModule } from '../components/AdminSidebar';
import { AdminHeader } from '../components/AdminHeader';
import { AdminBreadcrumbs } from '../components/AdminBreadcrumbs';
import { AdminOverviewDesk } from '../components/AdminOverviewDesk';
import { VerificationQueue } from '../components/VerificationQueue';
import { DisputesQueue } from '../components/DisputesQueue';
import { SafetyQueue } from '../components/SafetyQueue';
import { JobModerationTable } from '../components/JobModerationTable';
import { AuditLogsTable } from '../components/AuditLogsTable';
import { PlatformSettingsPanel } from '../components/PlatformSettingsPanel';
import { DirectoryTable, DirectoryUser } from '../components/DirectoryTable';

const VALID_MODULES: AdminModule[] = [
  'overview',
  'verifications',
  'disputes',
  'safety',
  'jobs',
  'workers',
  'organizers',
  'audit',
  'settings',
];

function parseModule(raw: string | null): AdminModule {
  if (raw && (VALID_MODULES as string[]).includes(raw)) {
    return raw as AdminModule;
  }
  return 'overview';
}

/** Active disputes exclude resolved and dismissed. */
function countActiveDisputes(disputes: Dispute[]): number {
  return disputes.filter((d) => d.status !== 'resolved' && d.status !== 'dismissed').length;
}

function AdminDashboardInner() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [activeModule, setActiveModule] = useState<AdminModule>(() =>
    parseModule(searchParams.get('module'))
  );
  const [sidebarOpen, setSidebarOpen] = useState(false);
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

  const [adminUser, setAdminUser] = useState<{ email?: string; fullName?: string } | null>(null);
  const [systemStatus, setSystemStatus] = useState<SystemOperationalStatus>(getSystemOperationalStatus());
  const [actionSuccessMessage, setActionSuccessMessage] = useState('');
  const [dashboardError, setDashboardError] = useState<string | null>(null);
  const [directoryError, setDirectoryError] = useState<string | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    const fromUrl = parseModule(searchParams.get('module'));
    setActiveModule(fromUrl);
  }, [searchParams]);

  const selectModule = useCallback(
    (mod: AdminModule) => {
      setActiveModule(mod);
      const params = new URLSearchParams(searchParams.toString());
      if (mod === 'overview') {
        params.delete('module');
      } else {
        params.set('module', mod);
      }
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  const loadAdminData = async () => {
    setLoadFailed(false);
    setDashboardError(null);
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
        setDashboardError(
          'Telemetry query warning: One or more database queries encountered errors. Displayed figures may be partial.'
        );
      }

      const [workersQuery, orgsQuery] = await Promise.all([
        adminSupabase
          .from('profiles')
          .select(
            'id, full_name, email, phone, is_active, created_at, worker_profiles(verification_status, is_aadhaar_verified, is_pan_verified, skills, preferred_locality, shifts_completed, upi_id)'
          )
          .eq('role', 'worker')
          .order('created_at', { ascending: false })
          .limit(100),
        adminSupabase
          .from('profiles')
          .select(
            'id, full_name, email, phone, is_active, created_at, organizer_profiles(business_name, business_type, verification_status, is_gstin_verified, gstin, total_events_hosted)'
          )
          .eq('role', 'organizer')
          .order('created_at', { ascending: false })
          .limit(100),
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
              role: 'worker' as const,
              isActive: row.is_active ?? true,
              createdAt: row.created_at,
              verificationStatus: wp?.verification_status || 'unverified',
              isAadhaarVerified: wp?.is_aadhaar_verified || false,
              isPanVerified: wp?.is_pan_verified || false,
              skills: wp?.skills || [],
              preferredLocality: wp?.preferred_locality || null,
              shiftsCompleted: wp?.shifts_completed || 0,
              upiId: wp?.upi_id,
            };
          })
        );
      }

      if (orgsQuery.data) {
        setDirectoryOrganizers(
          orgsQuery.data.map((row: any) => {
            const op = Array.isArray(row.organizer_profiles)
              ? row.organizer_profiles[0]
              : row.organizer_profiles;
            return {
              id: row.id,
              fullName: row.full_name || 'Organizer',
              email: row.email || '',
              phone: row.phone,
              role: 'organizer' as const,
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
      setLoadFailed(true);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActiveStatus = async (userId: string, currentActive: boolean) => {
    setDirectoryError(null);
    const reason = !currentActive ? 'Admin reactivation' : 'Admin suspension from dashboard';
    const res = await adminSetUserStatusSafe(userId, !currentActive, reason);
    if (!res.success) {
      const msg = res.error || 'Failed to update user status';
      setDirectoryError(msg);
      throw new Error(msg);
    }

    setDirectoryWorkers((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, isActive: !currentActive } : u))
    );
    setDirectoryOrganizers((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, isActive: !currentActive } : u))
    );
    setActionSuccessMessage(
      !currentActive ? 'Account reactivated successfully.' : 'Account suspended successfully.'
    );
  };

  const handleCreateUser = async (userData: any) => {
    setDirectoryError(null);
    const res = await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userData),
    });
    const result = await res.json();
    if (!res.ok || !result.success) {
      const err = result.error || 'Failed to create user account';
      setDirectoryError(err);
      throw new Error(err);
    }
    setActionSuccessMessage(
      `New ${userData.role === 'worker' ? 'worker' : 'organizer'} account created successfully.`
    );
    await loadAdminData();
  };

  const handleUpdateUser = async (userId: string, updates: any) => {
    setDirectoryError(null);
    const res = await fetch('/api/admin/users', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: userId, ...updates }),
    });
    const result = await res.json();
    if (!res.ok || !result.success) {
      const err = result.error || 'Failed to update user account';
      setDirectoryError(err);
      throw new Error(err);
    }
    setActionSuccessMessage('Account details updated successfully.');
    await loadAdminData();
  };

  const handleDeleteUser = async (userId: string) => {
    setDirectoryError(null);
    const res = await fetch(`/api/admin/users?userId=${encodeURIComponent(userId)}`, {
      method: 'DELETE',
    });
    const result = await res.json();
    if (!res.ok || !result.success) {
      const err = result.error || 'Failed to delete user account';
      setDirectoryError(err);
      throw new Error(err);
    }
    setActionSuccessMessage(result.message || 'Account successfully removed.');
    await loadAdminData();
  };

  useEffect(() => {
    const checkAuthAndLoad = async () => {
      try {
        const {
          data: { session },
        } = await adminSupabase.auth.getSession();
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSignOut = async () => {
    try {
      await adminSupabase.auth.signOut();
    } finally {
      window.location.href = '/login';
    }
  };

  const handleToggleBookingPause = async (
    reason?: string,
    broadcast?: EmergencyBroadcastDetails
  ) => {
    const nextPaused = !systemStatus.isBookingPaused;
    const pauseReason = reason || 'Administrative precaution';
    const res = await setBookingPauseStatusSafe(
      nextPaused,
      nextPaused ? pauseReason : undefined,
      undefined,
      nextPaused
        ? `Notice: New shift bookings are temporarily paused due to: ${pauseReason}`
        : undefined,
      broadcast
    );

    if (res.success) {
      setSystemStatus(res.status);
      setActionSuccessMessage(
        nextPaused
          ? 'Shift bookings have been paused platform-wide.'
          : 'Shift bookings have been resumed.'
      );
    } else {
      throw new Error(res.error || 'Failed to persist booking killswitch');
    }
  };

  const handleResolveCase = async (
    caseId: string,
    status: 'approved' | 'rejected',
    reason: string
  ) => {
    if (status === 'rejected' && (!reason || reason.trim().length < 5)) {
      throw new Error('A specific rejection reason (at least 5 characters) is required.');
    }
    const res = await resolveVerificationCaseSafe(caseId, status, reason, undefined);
    if (res.success) {
      setVerifications((prev) => prev.map((c) => (c.id === caseId ? { ...c, status } : c)));
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
    const res = await resolveDisputeSafe(disputeId, status, notes, adjustedPayout, undefined);
    if (res.success) {
      setDisputes((prev) => prev.map((d) => (d.id === disputeId ? { ...d, status } : d)));
      setActionSuccessMessage('Attendance dispute successfully adjudicated.');
    } else {
      throw new Error(res.error || 'Failed to adjudicate dispute');
    }
  };

  const handleResolveSafetyReport = async (reportId: string, actionTaken: string) => {
    const res = await resolveSafetyReportSafe(reportId, 'resolved', actionTaken, actionTaken, undefined);
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
    const res = await moderateJobSafe(jobId, status, reason, undefined);
    if (res.success) {
      setJobs((prev) => prev.map((j) => (j.id === jobId ? { ...j, status } : j)));
      setActionSuccessMessage(`Shift status updated to ${status}.`);
    } else {
      throw new Error(res.error || 'Failed to moderate shift');
    }
  };

  const getPageTitle = (mod: AdminModule) => {
    switch (mod) {
      case 'overview':
        return { title: 'Overview', subtitle: 'Marketplace KPIs and operational queues' };
      case 'verifications':
        return { title: 'Verifications', subtitle: 'Worker and organizer KYC review' };
      case 'disputes':
        return { title: 'Disputes', subtitle: 'Attendance and wage arbitration' };
      case 'safety':
        return { title: 'Safety', subtitle: 'Workplace complaints and SOS incidents' };
      case 'jobs':
        return { title: 'Shift moderation', subtitle: 'Wage floor and listing quality' };
      case 'workers':
        return { title: 'Workers', subtitle: 'Workforce directory and account status' };
      case 'organizers':
        return { title: 'Organizers', subtitle: 'Agency directory and account status' };
      case 'audit':
        return { title: 'Audit logs', subtitle: 'Administrative action history' };
      case 'settings':
        return { title: 'Settings', subtitle: 'Killswitch and platform configuration' };
      default:
        return { title: 'Admin', subtitle: 'Opskl Administration' };
    }
  };

  const { title, subtitle } = getPageTitle(activeModule);

  return (
    <div className="admin-shell">
      <div
        className={`admin-sidebar-overlay${sidebarOpen ? ' is-visible' : ''}`}
        onClick={() => setSidebarOpen(false)}
        aria-hidden={!sidebarOpen}
      />

      <AdminSidebar
        activeModule={activeModule}
        onSelectModule={selectModule}
        systemStatus={systemStatus}
        pendingVerificationsCount={verifications.filter((v) => v.status === 'pending').length}
        activeDisputesCount={countActiveDisputes(disputes)}
        urgentSafetyCount={safetyReports.filter((s) => s.status !== 'resolved').length}
        adminUser={adminUser}
        onSignOut={handleSignOut}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="admin-main">
        <AdminHeader
          title={title}
          subtitle={subtitle}
          systemStatus={systemStatus}
          onToggleBookingPause={handleToggleBookingPause}
          actionSuccessMessage={actionSuccessMessage}
          onDismissMessage={() => setActionSuccessMessage('')}
          onOpenSidebar={() => setSidebarOpen(true)}
        />

        <main className="admin-content">
          <AdminBreadcrumbs
            items={
              activeModule === 'overview'
                ? [{ label: 'Console' }, { label: 'Operational Overview' }]
                : [
                    { label: 'Console', onClick: () => selectModule('overview') },
                    { label: title },
                  ]
            }
          />

          {dashboardError && !loadFailed && (
            <div className="admin-banner admin-banner--warning" role="status" style={{ marginBottom: 20 }}>
              <span>{dashboardError}</span>
              <button
                type="button"
                className="admin-btn admin-btn-ghost"
                onClick={() => setDashboardError(null)}
                aria-label="Dismiss"
                style={{ minHeight: 32 }}
              >
                Dismiss
              </button>
            </div>
          )}

          {loading ? (
            <div className="admin-loading">
              <div className="admin-loading-text">Loading operations console…</div>
            </div>
          ) : loadFailed ? (
            <div className="admin-error-retry">
              <div className="admin-empty-title">Unable to load dashboard</div>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                {dashboardError || 'An unexpected error occurred.'}
              </p>
              <button
                type="button"
                className="admin-btn admin-btn-primary"
                onClick={() => {
                  setLoading(true);
                  loadAdminData();
                }}
              >
                Retry
              </button>
            </div>
          ) : (
            <>
              {activeModule === 'overview' && (
                <AdminOverviewDesk
                  metrics={metrics}
                  verifications={verifications}
                  disputes={disputes}
                  jobs={jobs}
                  auditLogs={auditLogs}
                  systemStatus={systemStatus}
                  onSelectModule={selectModule}
                  onToggleBookingPause={handleToggleBookingPause}
                  onRefreshData={() => {
                    setLoading(true);
                    loadAdminData();
                  }}
                />
              )}

              {activeModule === 'verifications' && (
                <VerificationQueue verifications={verifications} onResolveCase={handleResolveCase} />
              )}

              {activeModule === 'disputes' && (
                <DisputesQueue disputes={disputes} onResolveDispute={handleResolveDispute} />
              )}

              {activeModule === 'safety' && (
                <SafetyQueue
                  safetyReports={safetyReports}
                  onResolveSafetyReport={handleResolveSafetyReport}
                />
              )}

              {activeModule === 'jobs' && (
                <JobModerationTable jobs={jobs} onModerateJob={handleModerateJob} />
              )}

              {activeModule === 'workers' && (
                <DirectoryTable
                  type="worker"
                  users={directoryWorkers}
                  onToggleActiveStatus={handleToggleActiveStatus}
                  onCreateUser={handleCreateUser}
                  onUpdateUser={handleUpdateUser}
                  onDeleteUser={handleDeleteUser}
                  onRefresh={() => {
                    setLoading(true);
                    loadAdminData();
                  }}
                  actionError={directoryError}
                />
              )}

              {activeModule === 'organizers' && (
                <DirectoryTable
                  type="organizer"
                  users={directoryOrganizers}
                  onToggleActiveStatus={handleToggleActiveStatus}
                  onCreateUser={handleCreateUser}
                  onUpdateUser={handleUpdateUser}
                  onDeleteUser={handleDeleteUser}
                  onRefresh={() => {
                    setLoading(true);
                    loadAdminData();
                  }}
                  actionError={directoryError}
                />
              )}

              {activeModule === 'audit' && <AuditLogsTable auditLogs={auditLogs} />}

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

export default function AdminDashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="admin-loading">
          <div className="admin-loading-text">Loading operations console…</div>
        </div>
      }
    >
      <AdminDashboardInner />
    </Suspense>
  );
}
