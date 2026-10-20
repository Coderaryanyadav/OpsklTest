'use client';

import React from 'react';
import {
  BarChart3,
  ShieldCheck,
  Scale,
  AlertTriangle,
  Briefcase,
  Building2,
  FileText,
  Settings,
  LogOut,
  Users,
  X,
} from 'lucide-react';
import { SystemOperationalStatus } from '@opskil/shared';

/** Active admin modules only — stub modules (bookings/payments/reviews) excluded from nav. */
export type AdminModule =
  | 'overview'
  | 'verifications'
  | 'disputes'
  | 'safety'
  | 'jobs'
  | 'workers'
  | 'organizers'
  | 'audit'
  | 'settings';

interface AdminSidebarProps {
  activeModule: AdminModule;
  onSelectModule: (module: AdminModule) => void;
  systemStatus: SystemOperationalStatus;
  pendingVerificationsCount: number;
  activeDisputesCount: number;
  urgentSafetyCount: number;
  adminUser?: { email?: string; fullName?: string } | null;
  onSignOut?: () => void;
  open?: boolean;
  onClose?: () => void;
}

export const AdminSidebar: React.FC<AdminSidebarProps> = ({
  activeModule,
  onSelectModule,
  systemStatus,
  pendingVerificationsCount,
  activeDisputesCount,
  urgentSafetyCount,
  adminUser,
  onSignOut,
  open = false,
  onClose,
}) => {
  const navItems = [
    {
      group: 'OPERATIONS',
      items: [
        { id: 'overview' as AdminModule, label: 'Overview', icon: <BarChart3 size={16} /> },
        {
          id: 'verifications' as AdminModule,
          label: 'Verifications',
          icon: <ShieldCheck size={16} />,
          badge: pendingVerificationsCount > 0 ? pendingVerificationsCount : undefined,
        },
        {
          id: 'disputes' as AdminModule,
          label: 'Disputes',
          icon: <Scale size={16} />,
          badge: activeDisputesCount > 0 ? activeDisputesCount : undefined,
        },
        {
          id: 'safety' as AdminModule,
          label: 'Safety',
          icon: <AlertTriangle size={16} />,
          badge: urgentSafetyCount > 0 ? urgentSafetyCount : undefined,
        },
      ],
    },
    {
      group: 'DIRECTORIES',
      items: [
        { id: 'workers' as AdminModule, label: 'Workers', icon: <Users size={16} /> },
        { id: 'organizers' as AdminModule, label: 'Organizers', icon: <Building2 size={16} /> },
      ],
    },
    {
      group: 'MODERATION',
      items: [
        { id: 'jobs' as AdminModule, label: 'Shifts', icon: <Briefcase size={16} /> },
        { id: 'audit' as AdminModule, label: 'Audit logs', icon: <FileText size={16} /> },
        { id: 'settings' as AdminModule, label: 'Settings', icon: <Settings size={16} /> },
      ],
    },
  ];

  const initials = (() => {
    if (adminUser?.fullName) {
      const parts = adminUser.fullName.trim().split(/\s+/);
      if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
      return parts[0].substring(0, 2).toUpperCase();
    }
    if (adminUser?.email) return adminUser.email.substring(0, 2).toUpperCase();
    return 'AD';
  })();

  const select = (id: AdminModule) => {
    onSelectModule(id);
    onClose?.();
  };

  return (
    <aside className={`admin-sidebar${open ? ' is-open' : ''}`} aria-label="Admin navigation">
      <div>
        <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid var(--sidebar-border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span
                style={{
                  backgroundColor: 'var(--text-inverse)',
                  color: 'var(--primary-color)',
                  fontWeight: 900,
                  fontSize: 13,
                  padding: '4px 8px',
                  borderRadius: 4,
                  letterSpacing: 0.5,
                }}
              >
                OPSKL
              </span>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: 1 }}>
                ADMIN
              </span>
            </div>
            {onClose && (
              <button
                type="button"
                className="admin-btn admin-btn-ghost"
                onClick={onClose}
                aria-label="Close navigation"
                style={{ color: 'var(--sidebar-muted)', minHeight: 36, display: 'none' }}
                data-sidebar-close
              >
                <X size={18} />
              </button>
            )}
          </div>

          <div
            className={`admin-status ${systemStatus.isBookingPaused ? 'admin-status--paused-dark' : 'admin-status--live-dark'}`}
            style={{ marginTop: 12, width: '100%', justifyContent: 'flex-start' }}
            role="status"
            aria-live="polite"
          >
            <span className="admin-status-dot" aria-hidden="true" />
            {systemStatus.isBookingPaused ? 'PAUSED' : 'LIVE'}
          </div>
        </div>

        <nav style={{ padding: '16px 12px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {navItems.map((group) => (
            <div key={group.group}>
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: 'var(--text-muted)',
                  letterSpacing: 1,
                  padding: '4px 8px',
                  marginBottom: 4,
                }}
              >
                {group.group}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {group.items.map((item) => {
                  const isActive = activeModule === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => select(item.id)}
                      aria-current={isActive ? 'page' : undefined}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        width: '100%',
                        minHeight: 44,
                        padding: '9px 12px',
                        borderRadius: 6,
                        border: 'none',
                        backgroundColor: isActive ? 'var(--sidebar-active)' : 'transparent',
                        color: isActive ? 'var(--sidebar-text)' : 'var(--sidebar-muted)',
                        cursor: 'pointer',
                        fontSize: 13,
                        fontWeight: isActive ? 600 : 500,
                        textAlign: 'left',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ display: 'flex', color: isActive ? 'var(--sidebar-text)' : 'var(--text-muted)' }}>
                          {item.icon}
                        </span>
                        <span>{item.label}</span>
                      </div>
                      {item.badge !== undefined && (
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            padding: '1px 6px',
                            borderRadius: 10,
                            backgroundColor: isActive ? 'var(--text-inverse)' : '#262626',
                            color: isActive ? 'var(--primary-color)' : 'var(--text-inverse)',
                          }}
                        >
                          {item.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </div>

      <div
        style={{
          padding: 16,
          borderTop: '1px solid var(--border-strong, #262626)',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: '50%',
            backgroundColor: 'var(--surface-elevated, #262626)',
            border: '1px solid var(--border-color, #404040)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 700,
            fontSize: 12,
            color: 'var(--text-inverse)',
            flexShrink: 0,
          }}
        >
          {initials}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: 'var(--text-inverse)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {adminUser?.fullName || 'Administrator'}
          </div>
          <div
            style={{
              fontSize: 11,
              color: 'var(--text-muted)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {adminUser?.email || 'Ops & Compliance'}
          </div>
        </div>

        {onSignOut && (
          <button
            type="button"
            onClick={onSignOut}
            title="Sign out"
            aria-label="Sign out"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: 10,
              minWidth: 44,
              minHeight: 44,
              borderRadius: 6,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <LogOut size={16} />
          </button>
        )}
      </div>

      <style>{`
        @media (max-width: 768px) {
          [data-sidebar-close] { display: inline-flex !important; }
        }
      `}</style>
    </aside>
  );
};
