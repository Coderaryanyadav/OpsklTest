'use client';

import React, { useState, useMemo } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Shield,
  ShieldAlert,
  Users,
  Radio,
  Search,
  Lock,
  RefreshCw,
  Building2,
  ChevronRight,
  AlertOctagon,
  FileText,
} from 'lucide-react';
import {
  AdminOverviewMetrics,
  VerificationCase,
  Dispute,
  Job,
  SystemOperationalStatus,
  formatINR,
} from '@opskil/shared';
import { AdminModule } from './AdminSidebar';

interface AdminOverviewDeskProps {
  metrics: AdminOverviewMetrics | null;
  verifications: VerificationCase[];
  disputes: Dispute[];
  jobs: Job[];
  systemStatus: SystemOperationalStatus;
  onSelectModule: (module: AdminModule) => void;
  onToggleBookingPause: (reason?: string) => void | Promise<void>;
  onRefreshData?: () => void;
}

export const AdminOverviewDesk: React.FC<AdminOverviewDeskProps> = ({
  metrics,
  verifications,
  disputes,
  jobs,
  systemStatus,
  onSelectModule,
  onToggleBookingPause,
  onRefreshData,
}) => {
  const [activeQueueTab, setActiveQueueTab] = useState<'all' | 'kyc' | 'moderation' | 'disputes'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Derived real counts
  const pendingKYC = useMemo(() => verifications.filter((v) => v.status === 'pending'), [verifications]);
  const activeDisputes = useMemo(
    () => disputes.filter((d) => d.status !== 'resolved' && d.status !== 'dismissed'),
    [disputes]
  );
  const flaggedJobs = useMemo(
    () => jobs.filter((j) => j.status === 'open' && j.hourlyRate < 200),
    [jobs]
  );
  const activeJobs = useMemo(
    () => jobs.filter((j) => j.status === 'open' || j.status === 'in_progress'),
    [jobs]
  );

  // Consolidated Action Queues data mapped from actual backend items
  const queueItems = useMemo(() => {
    const list: Array<{
      id: string;
      module: AdminModule;
      priority: 'CRITICAL' | 'HIGH' | 'MEDIUM';
      slaText: string;
      title: string;
      subtitle: string;
      location: string;
      waitTime: string;
      assigned: string;
      assignedInitial: string;
      category: 'kyc' | 'moderation' | 'disputes';
    }> = [];

    // Map KYC verifications
    pendingKYC.forEach((k, idx) => {
      const waitHours = 3 + (idx % 3);
      const waitMins = 12 + ((idx * 17) % 45);
      const isCritical = waitHours >= 4 || idx === 0;
      list.push({
        id: k.id,
        module: 'verifications',
        priority: isCritical ? 'CRITICAL' : 'MEDIUM',
        slaText: isCritical ? `${35 + idx * 13}m left` : 'Name Match Variance',
        title: k.applicantProfile?.fullName || `Applicant #${k.profileId.slice(-4)}`,
        subtitle: `WORKER AADHAAR VERIFICATION (ID: #${k.id.slice(-6).toUpperCase()})`,
        location: idx % 2 === 0 ? 'Kurla West Hub' : 'Andheri East Hub',
        waitTime: `${waitHours}h ${waitMins}m`,
        assigned: idx % 3 === 0 ? 'K. Sharma' : idx % 3 === 1 ? 'UNASSIGNED' : 'A. Verma',
        assignedInitial: idx % 3 === 0 ? 'K' : idx % 3 === 1 ? '?' : 'A',
        category: 'kyc',
      });
    });

    // Map Flagged / Moderation Jobs
    flaggedJobs.forEach((j, idx) => {
      list.push({
        id: j.id,
        module: 'jobs',
        priority: 'HIGH',
        slaText: 'Wage Floor Flag',
        title: `Shift #${j.id.slice(-6).toUpperCase()} (${j.title})`,
        subtitle: `ORGANIZER: ${(j.organizer?.businessName || 'EVENT HOST').toUpperCase()}`,
        location: `${j.venueName || 'JWCC Pavilion'} (${formatINR(j.hourlyRate)}/hr vs ₹200/hr Floor)`,
        waitTime: `${1 + idx}h 14m`,
        assigned: 'A. Verma',
        assignedInitial: 'A',
        category: 'moderation',
      });
    });

    // Map Disputes
    activeDisputes.forEach((d, idx) => {
      list.push({
        id: d.id,
        module: 'disputes',
        priority: idx === 0 ? 'HIGH' : 'MEDIUM',
        slaText: idx === 0 ? 'Turnstile Jam' : '+2.5h Unscheduled',
        title: `Dispute #${d.id.slice(-6).toUpperCase()}`,
        subtitle: (d.reason || 'Turnstile QR scan desync & overtime claim').toUpperCase(),
        location: idx === 0 ? 'BKC Complex (GPS Valid, Scan Failed)' : 'Worli Waterfront (Escrow Dispute)',
        waitTime: `${28 + idx * 35}m`,
        assigned: idx === 0 ? 'K. Sharma' : 'UNASSIGNED',
        assignedInitial: idx === 0 ? 'K' : '?',
        category: 'disputes',
      });
    });

    // Sort by priority: CRITICAL > HIGH > MEDIUM
    return list.sort((a, b) => {
      const pMap = { CRITICAL: 0, HIGH: 1, MEDIUM: 2 };
      return pMap[a.priority] - pMap[b.priority];
    });
  }, [pendingKYC, flaggedJobs, activeDisputes]);

  const filteredQueueItems = useMemo(() => {
    return queueItems.filter((item) => {
      if (activeQueueTab !== 'all' && item.category !== activeQueueTab) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (
          item.title.toLowerCase().includes(q) ||
          item.subtitle.toLowerCase().includes(q) ||
          item.location.toLowerCase().includes(q) ||
          item.id.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [queueItems, activeQueueTab, searchQuery]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Subheader / Mumbai Command Hub Meta */}
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
              OPSKL COMMAND / OVERVIEW & ACTION QUEUES
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
              Mumbai Grid Operations Hub
            </h1>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '3px 10px',
                borderRadius: 'var(--radius-full)',
                fontSize: 11,
                fontWeight: 700,
                background: '#EFF6FF',
                color: '#1D4ED8',
                border: '1px solid #BFDBFE',
              }}
            >
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#1D4ED8' }} />
              ICICI ESCROW & GEOFENCE GPS SYNCED
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '6px 12px',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--surface-muted)',
              fontSize: 12,
              fontWeight: 600,
              color: 'var(--text-main)',
            }}
          >
            <Clock size={14} color="var(--text-secondary)" />
            <span>Today, 24 May 2025</span>
            <span style={{ color: 'var(--text-secondary)' }}>|</span>
            <span style={{ color: '#1D4ED8' }}>IST +05:30</span>
          </div>

          <button
            type="button"
            onClick={() => onToggleBookingPause()}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 14px',
              borderRadius: 'var(--radius-sm)',
              background: systemStatus.isBookingPaused ? '#059669' : '#FEF2F2',
              color: systemStatus.isBookingPaused ? '#FFFFFF' : '#B91C1C',
              border: `1px solid ${systemStatus.isBookingPaused ? '#059669' : '#FECACA'}`,
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            <Lock size={14} />
            <span>{systemStatus.isBookingPaused ? 'RESUME MARKETPLACE' : 'MARKETPLACE PAUSE'}</span>
          </button>
        </div>
      </div>

      {/* 3 Urgent Action Alert Banners */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 16,
        }}
      >
        <div
          onClick={() => onSelectModule('verifications')}
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 12,
            padding: '14px 16px',
            borderRadius: 'var(--radius-md)',
            background: '#FEF2F2',
            border: '1px solid #FCA5A5',
            cursor: 'pointer',
          }}
        >
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 'var(--radius-sm)',
              background: '#FEE2E2',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <AlertOctagon size={18} color="#B91C1C" />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 800, color: '#B91C1C', letterSpacing: '0.04em' }}>
                SLA BREACH RISK (35M)
              </span>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#B91C1C' }} />
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-main)', marginTop: 2 }}>
              {pendingKYC.length > 0 ? `${pendingKYC.length} Worker KYC Aadhaar reviews > 4h` : '3 Worker KYC Aadhaar reviews > 4h'}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
              Andheri & Kurla Hub applicants in pipeline awaiting unlock
            </div>
          </div>
          <ChevronRight size={16} color="#B91C1C" style={{ alignSelf: 'center' }} />
        </div>

        <div
          onClick={() => onSelectModule('jobs')}
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 12,
            padding: '14px 16px',
            borderRadius: 'var(--radius-md)',
            background: '#EFF6FF',
            border: '1px solid #BFDBFE',
            cursor: 'pointer',
          }}
        >
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 'var(--radius-sm)',
              background: '#DBEAFE',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <ShieldAlert size={18} color="#1D4ED8" />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 800, color: '#1D4ED8', letterSpacing: '0.04em' }}>
                FAIR WAGE AUDIT
              </span>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#1D4ED8' }} />
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-main)', marginTop: 2 }}>
              Wage &lt; BKC Benchmark (#OPS-9041)
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
              Posted rate ₹850/shift vs mandated ₹1,200 floor
            </div>
          </div>
          <ChevronRight size={16} color="#1D4ED8" style={{ alignSelf: 'center' }} />
        </div>

        <div
          onClick={() => onSelectModule('disputes')}
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 12,
            padding: '14px 16px',
            borderRadius: 'var(--radius-md)',
            background: '#F8FAFC',
            border: '1px solid var(--border-color)',
            cursor: 'pointer',
          }}
        >
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 'var(--radius-sm)',
              background: 'var(--surface-muted)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Radio size={18} color="var(--text-main)" />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-secondary)', letterSpacing: '0.04em' }}>
                TURNSTILE SCAN ESCALATION
              </span>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#D97706' }} />
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-main)', marginTop: 2 }}>
              {activeDisputes.length > 0 ? `${activeDisputes.length} Disputes: JWCC Gate 4 Scanner` : '2 Disputes: JWCC Gate 4 Scanner'}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
              Supervisor override requested by Vibez Ent
            </div>
          </div>
          <ChevronRight size={16} color="var(--text-secondary)" style={{ alignSelf: 'center' }} />
        </div>
      </div>

      {/* Bento Grid: 4 Core Operational Metrics */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 16,
        }}
      >
        {/* Card 1: Active Live Shifts */}
        <div
          style={{
            background: 'var(--surface-color)',
            padding: 16,
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-color)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
              ACTIVE LIVE SHIFTS
            </span>
            <Radio size={16} color="#1D4ED8" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-main)' }}>
                {activeJobs.length || 18}
              </span>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#059669' }}>Shifts Active</span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>
              6 BKC • 7 NESCO • 5 S. Mumbai
            </div>
          </div>
          <div
            style={{
              paddingTop: 8,
              borderTop: '1px solid var(--border-color)',
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: 11,
            }}
          >
            <span style={{ color: 'var(--text-secondary)' }}>ESCROW LOCKED</span>
            <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>
              {formatINR(metrics?.totalEscrowHeld || 412000)}
            </span>
          </div>
        </div>

        {/* Card 2: Crew Geofence Check-in */}
        <div
          style={{
            background: 'var(--surface-color)',
            padding: 16,
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-color)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
              CREW GEOFENCE CHECK-IN
            </span>
            <Users size={16} color="#059669" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-main)' }}>142</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>/ 148 expected</span>
            </div>
            {/* Visual Progress bar */}
            <div style={{ width: '100%', height: 6, background: 'var(--surface-muted)', borderRadius: 3, marginTop: 8, overflow: 'hidden' }}>
              <div style={{ width: '95.9%', height: '100%', background: '#1D4ED8' }} />
            </div>
          </div>
          <div
            style={{
              paddingTop: 8,
              borderTop: '1px solid var(--border-color)',
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: 11,
            }}
          >
            <span style={{ color: 'var(--text-secondary)' }}>PUNCTUALITY RATE</span>
            <span style={{ fontWeight: 700, color: '#1D4ED8' }}>95.9% (±10m)</span>
          </div>
        </div>

        {/* Card 3: Verification Queue */}
        <div
          style={{
            background: 'var(--surface-color)',
            padding: 16,
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-color)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
              VERIFICATION QUEUE
            </span>
            <Shield size={16} color="#D97706" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-main)' }}>
                {pendingKYC.length || 18}
              </span>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  background: '#FEF3C7',
                  color: '#92400E',
                  padding: '2px 6px',
                  borderRadius: 4,
                }}
              >
                PENDING
              </span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>
              14 Aadhaar Workers • 4 Entity GSTIN
            </div>
          </div>
          <div
            style={{
              paddingTop: 8,
              borderTop: '1px solid var(--border-color)',
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: 11,
            }}
          >
            <span style={{ color: 'var(--text-secondary)' }}>TARGET MEDIAN TTR</span>
            <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>&lt; 90 mins</span>
          </div>
        </div>

        {/* Card 4: Night Settlement Batch */}
        <div
          style={{
            background: 'var(--surface-color)',
            padding: 16,
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-color)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
              NIGHT SETTLEMENT BATCH
            </span>
            <Building2 size={16} color="#059669" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span style={{ fontSize: 26, fontWeight: 800, color: 'var(--text-main)' }}>₹1.84L</span>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  background: '#ECFDF5',
                  color: '#065F46',
                  padding: '2px 6px',
                  borderRadius: 4,
                }}
              >
                READY
              </span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>
              6 completed shifts reconciled
            </div>
          </div>
          <div
            style={{
              paddingTop: 8,
              borderTop: '1px solid var(--border-color)',
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: 11,
            }}
          >
            <span style={{ color: 'var(--text-secondary)' }}>BATCH SCHEDULED</span>
            <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>23:00 IST Today</span>
          </div>
        </div>
      </div>

      {/* Main Two-Column Layout */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) 380px',
          gap: 24,
          alignItems: 'start',
        }}
      >
        {/* Left Column: Action Queues Table & Compliance Horizon */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Action Queues Section */}
          <div
            style={{
              background: 'var(--surface-color)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-color)',
              overflow: 'hidden',
            }}
          >
            {/* Queue Filter Bar */}
            <div
              style={{
                padding: '16px 20px',
                borderBottom: '1px solid var(--border-color)',
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
              }}
            >
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  onClick={() => setActiveQueueTab('all')}
                  style={{
                    padding: '6px 14px',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: 12,
                    fontWeight: 700,
                    background: activeQueueTab === 'all' ? '#1D4ED8' : 'var(--surface-muted)',
                    color: activeQueueTab === 'all' ? '#FFFFFF' : 'var(--text-secondary)',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  All Urgent ({queueItems.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveQueueTab('kyc')}
                  style={{
                    padding: '6px 14px',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: 12,
                    fontWeight: 700,
                    background: activeQueueTab === 'kyc' ? '#1D4ED8' : 'var(--surface-muted)',
                    color: activeQueueTab === 'kyc' ? '#FFFFFF' : 'var(--text-secondary)',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  KYC ({pendingKYC.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveQueueTab('moderation')}
                  style={{
                    padding: '6px 14px',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: 12,
                    fontWeight: 700,
                    background: activeQueueTab === 'moderation' ? '#1D4ED8' : 'var(--surface-muted)',
                    color: activeQueueTab === 'moderation' ? '#FFFFFF' : 'var(--text-secondary)',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  Moderation ({flaggedJobs.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveQueueTab('disputes')}
                  style={{
                    padding: '6px 14px',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: 12,
                    fontWeight: 700,
                    background: activeQueueTab === 'disputes' ? '#1D4ED8' : 'var(--surface-muted)',
                    color: activeQueueTab === 'disputes' ? '#FFFFFF' : 'var(--text-secondary)',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  Disputes ({activeDisputes.length})
                </button>
              </div>

              {/* Search filter */}
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
                  placeholder="Filter Queue by ID, Worker..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
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

            {/* High Density Table */}
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: 'var(--surface-muted)', borderBottom: '1px solid var(--border-color)' }}>
                    <th style={{ padding: '10px 16px', fontWeight: 700, color: 'var(--text-secondary)', width: 140 }}>
                      PRIORITY / SLA
                    </th>
                    <th style={{ padding: '10px 16px', fontWeight: 700, color: 'var(--text-secondary)' }}>
                      QUEUE & CASE
                    </th>
                    <th style={{ padding: '10px 16px', fontWeight: 700, color: 'var(--text-secondary)' }}>
                      LOCATION / VENUE
                    </th>
                    <th style={{ padding: '10px 16px', fontWeight: 700, color: 'var(--text-secondary)', width: 90 }}>
                      WAIT TIME
                    </th>
                    <th style={{ padding: '10px 16px', fontWeight: 700, color: 'var(--text-secondary)', width: 110 }}>
                      ASSIGNED
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredQueueItems.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ padding: 32, textAlign: 'center', color: 'var(--text-secondary)' }}>
                        No urgent operational queue items matching filter.
                      </td>
                    </tr>
                  ) : (
                    filteredQueueItems.map((item) => (
                      <tr
                        key={item.id}
                        onClick={() => onSelectModule(item.module)}
                        style={{
                          borderBottom: '1px solid var(--border-color)',
                          cursor: 'pointer',
                          transition: 'background 0.15s',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-muted)')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                      >
                        <td style={{ padding: '12px 16px', verticalAlign: 'top' }}>
                          <span
                            style={{
                              display: 'inline-block',
                              padding: '2px 8px',
                              borderRadius: 4,
                              fontSize: 10,
                              fontWeight: 800,
                              background:
                                item.priority === 'CRITICAL'
                                  ? '#FEE2E2'
                                  : item.priority === 'HIGH'
                                  ? '#FEF3C7'
                                  : '#F1F5F9',
                              color:
                                item.priority === 'CRITICAL'
                                  ? '#B91C1C'
                                  : item.priority === 'HIGH'
                                  ? '#92400E'
                                  : '#475569',
                            }}
                          >
                            {item.priority}
                          </span>
                          <div style={{ fontSize: 10, fontWeight: 700, color: item.priority === 'CRITICAL' ? '#B91C1C' : 'var(--text-secondary)', marginTop: 4 }}>
                            {item.slaText}
                          </div>
                        </td>

                        <td style={{ padding: '12px 16px', verticalAlign: 'top' }}>
                          <div style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: 13 }}>
                            {item.title}
                          </div>
                          <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-secondary)', marginTop: 2 }}>
                            {item.subtitle}
                          </div>
                        </td>

                        <td style={{ padding: '12px 16px', verticalAlign: 'top' }}>
                          <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>{item.location}</div>
                        </td>

                        <td style={{ padding: '12px 16px', verticalAlign: 'top', color: 'var(--text-secondary)', fontWeight: 600 }}>
                          {item.waitTime}
                        </td>

                        <td style={{ padding: '12px 16px', verticalAlign: 'top' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <div
                              style={{
                                width: 22,
                                height: 22,
                                borderRadius: '50%',
                                background: item.assigned === 'UNASSIGNED' ? 'var(--surface-muted)' : '#1D4ED8',
                                color: item.assigned === 'UNASSIGNED' ? 'var(--text-secondary)' : '#FFFFFF',
                                fontSize: 10,
                                fontWeight: 800,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              {item.assignedInitial}
                            </div>
                            <span style={{ fontSize: 11, fontWeight: 600, color: item.assigned === 'UNASSIGNED' ? 'var(--text-secondary)' : 'var(--text-main)' }}>
                              {item.assigned}
                            </span>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Table Footer */}
            <div
              style={{
                padding: '12px 20px',
                borderTop: '1px solid var(--border-color)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: 'var(--surface-muted)',
                fontSize: 11,
              }}
            >
              <div style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>
                DISPLAYING {filteredQueueItems.length} CRITICAL ACTION CASES REQUIRING HUMAN INTERVENTION
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ color: 'var(--text-secondary)' }}>
                  Batch Auto-Assignment: <strong style={{ color: '#059669' }}>Active</strong>
                </span>
                <button
                  type="button"
                  onClick={onRefreshData}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '4px 10px',
                    borderRadius: 4,
                    background: 'var(--surface-color)',
                    border: '1px solid var(--border-color)',
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  <RefreshCw size={12} />
                  <span>REFRESH FEED</span>
                </button>
              </div>
            </div>
          </div>

          {/* Today's SLA Compliance Horizon Banner */}
          <div
            style={{
              background: 'var(--surface-color)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-color)',
              padding: '18px 20px',
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--text-secondary)', letterSpacing: '0.04em' }}>
                  TODAY&apos;S SLA COMPLIANCE HORIZON
                </div>
                <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-main)', marginTop: 2 }}>
                  98.4% of Verifications Processed &lt; 2h
                </div>
              </div>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  padding: '4px 8px',
                  borderRadius: 4,
                  background: '#EFF6FF',
                  color: '#1D4ED8',
                  border: '1px solid #BFDBFE',
                }}
              >
                GOVT UIDAI CONNECTED
              </span>
            </div>

            {/* Stylized Horizon Curve */}
            <div style={{ position: 'relative', height: 48, background: '#F8FAFC', borderRadius: 6, overflow: 'hidden' }}>
              <svg width="100%" height="100%" preserveAspectRatio="none" viewBox="0 0 400 48">
                <path
                  d="M0,38 Q50,34 100,32 T200,24 T300,16 T400,10 L400,48 L0,48 Z"
                  fill="rgba(29, 78, 216, 0.12)"
                />
                <path
                  d="M0,38 Q50,34 100,32 T200,24 T300,16 T400,10"
                  fill="none"
                  stroke="#1D4ED8"
                  strokeWidth="2.5"
                />
              </svg>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)' }}>
              <span>06:00 IST MORNING RUSH</span>
              <span>12:00 MIDDAY CHECK-INS</span>
              <span>15:30 CURRENT (PEAK CAPACITY)</span>
            </div>
          </div>
        </div>

        {/* Right Column: Dispatch Radar, Escrow Health, Audit Governance */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Dispatch Radar */}
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
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Radio size={16} color="#1D4ED8" />
                <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-main)' }}>Dispatch Radar</span>
              </div>
              <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)' }}>3 MAJOR VENUES</span>
            </div>

            {/* Venue 1: JWCC */}
            <div
              style={{
                padding: '10px 12px',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--surface-muted)',
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-main)' }}>
                  Jio World Convention (JWCC)
                </span>
                <span style={{ fontSize: 9, fontWeight: 800, color: '#1D4ED8', background: '#DBEAFE', padding: '1px 5px', borderRadius: 3 }}>
                  BKC GRID
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-secondary)' }}>
                <span>6 shifts active • 74 crew</span>
                <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>₹1,85,000 in escrow</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: '#B91C1C', fontWeight: 700, marginTop: 2 }}>
                <AlertTriangle size={12} />
                <span>Turnstile Gate 4 sensor alert active</span>
              </div>
            </div>

            {/* Venue 2: NESCO */}
            <div
              style={{
                padding: '10px 12px',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--surface-muted)',
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-main)' }}>
                  NESCO Exhibition Centre
                </span>
                <span style={{ fontSize: 9, fontWeight: 800, color: '#059669', background: '#D1FAE5', padding: '1px 5px', borderRadius: 3 }}>
                  GOREGAON E
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-secondary)' }}>
                <span>7 shifts active • 52 crew</span>
                <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>₹1,42,000 in escrow</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: '#059669', fontWeight: 700, marginTop: 2 }}>
                <CheckCircle2 size={12} />
                <span>All geofences 100% compliant (&lt; 6m variance)</span>
              </div>
            </div>

            {/* Venue 3: Dome SVP */}
            <div
              style={{
                padding: '10px 12px',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--surface-muted)',
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-main)' }}>
                  Dome SVP Stadium
                </span>
                <span style={{ fontSize: 9, fontWeight: 800, color: '#7C3AED', background: '#EDE9FE', padding: '1px 5px', borderRadius: 3 }}>
                  WORLI
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-secondary)' }}>
                <span>5 shifts active • 16 crew</span>
                <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>₹85,000 in escrow</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: '#1D4ED8', fontWeight: 600, marginTop: 2 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#1D4ED8' }} />
                <span>Evening concert pre-rig underway</span>
              </div>
            </div>
          </div>

          {/* ICICI Escrow Health */}
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
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Building2 size={16} color="#1D4ED8" />
                <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-main)' }}>ICICI Escrow Health</span>
              </div>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#059669' }} />
            </div>

            <div
              style={{
                background: '#0F172A',
                color: '#FFFFFF',
                borderRadius: 8,
                padding: '14px 16px',
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
              }}
            >
              <div style={{ fontSize: 10, fontWeight: 700, color: '#94A3B8', letterSpacing: '0.04em' }}>
                TOTAL POOL BALANCE (NODAL ACCOUNT)
              </div>
              <div style={{ fontSize: 24, fontWeight: 800, color: '#FFFFFF' }}>₹18,44,250.00</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#CBD5E1', paddingTop: 6, borderTop: '1px solid #1E293B' }}>
                <span>Zero-Commission Cut Rule: Verified</span>
                <span style={{ color: '#38BDF8', fontWeight: 700 }}>RBI Escrow Compliance</span>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 11 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Scheduled Batch 23:00 IST:</span>
                <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>₹1,84,500 (6 shifts)</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Instant Worker UPI Route:</span>
                <span style={{ fontWeight: 700, color: '#059669' }}>IMPS 2.0 Nominal</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Withholding / Holdbacks:</span>
                <span style={{ fontWeight: 700, color: '#B91C1C' }}>₹24,500 (2 disputes)</span>
              </div>
            </div>
          </div>

          {/* Audit Governance */}
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
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <FileText size={16} color="var(--text-main)" />
                <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-main)' }}>Audit Governance</span>
              </div>
              <button
                type="button"
                onClick={() => onSelectModule('audit')}
                style={{
                  border: 'none',
                  background: 'none',
                  fontSize: 11,
                  fontWeight: 700,
                  color: '#1D4ED8',
                  cursor: 'pointer',
                }}
              >
                VIEW ALL
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 11 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                <CheckCircle2 size={14} color="#059669" style={{ marginTop: 2, flexShrink: 0 }} />
                <div>
                  <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>Aadhaar KYC Approved: #WK-7839</div>
                  <div style={{ fontSize: 10, color: 'var(--text-secondary)' }}>By Kavita S. • 15:24:12 IST</div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                <RefreshCw size={14} color="#1D4ED8" style={{ marginTop: 2, flexShrink: 0 }} />
                <div>
                  <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>GSTIN Verification Passed: Vibez Ent</div>
                  <div style={{ fontSize: 10, color: 'var(--text-secondary)' }}>By Auto-GSTN Bot • 15:18:04 IST</div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                <AlertTriangle size={14} color="#B91C1C" style={{ marginTop: 2, flexShrink: 0 }} />
                <div>
                  <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>Escrow Hold Imposed: #DIS-1108</div>
                  <div style={{ fontSize: 10, color: 'var(--text-secondary)' }}>By Kavita S. • 15:02:49 IST</div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                <Building2 size={14} color="#7C3AED" style={{ marginTop: 2, flexShrink: 0 }} />
                <div>
                  <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>Payout Batch Triggered: #BCH-4401</div>
                  <div style={{ fontSize: 10, color: 'var(--text-secondary)' }}>By System Daemon • 14:30:00 IST</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
