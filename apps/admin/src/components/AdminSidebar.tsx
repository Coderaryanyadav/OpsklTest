'use client';

import React from 'react';
import { SystemOperationalStatus } from '@opskil/shared';

export type AdminModule =
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

interface AdminSidebarProps {
  activeModule: AdminModule;
  onSelectModule: (module: AdminModule) => void;
  systemStatus: SystemOperationalStatus;
  pendingVerificationsCount: number;
  activeDisputesCount: number;
  urgentSafetyCount: number;
}

export const AdminSidebar: React.FC<AdminSidebarProps> = ({
  activeModule,
  onSelectModule,
  systemStatus,
  pendingVerificationsCount,
  activeDisputesCount,
  urgentSafetyCount,
}) => {
  const navItems = [
    {
      group: 'OPERATIONS',
      items: [
        { id: 'overview' as AdminModule, label: 'Platform Overview', icon: '📊' },
        { id: 'pilot' as AdminModule, label: 'Mumbai Live Pilot', icon: '📍' },
        {
          id: 'verifications' as AdminModule,
          label: 'Verification Queue',
          icon: '🛡️',
          badge: pendingVerificationsCount > 0 ? pendingVerificationsCount : undefined,
          badgeColor: '#2563EB',
        },
        {
          id: 'disputes' as AdminModule,
          label: 'Attendance Disputes',
          icon: '⚖️',
          badge: activeDisputesCount > 0 ? activeDisputesCount : undefined,
          badgeColor: '#D97706',
        },
        {
          id: 'safety' as AdminModule,
          label: 'Safety Reports',
          icon: '🚨',
          badge: urgentSafetyCount > 0 ? urgentSafetyCount : undefined,
          badgeColor: '#DC2626',
        },
      ],
    },
    {
      group: 'MARKETPLACE MODERATION',
      items: [
        { id: 'jobs' as AdminModule, label: 'Shift Moderation', icon: '💼' },
        { id: 'audit' as AdminModule, label: 'Audit Logs', icon: '📜' },
        { id: 'settings' as AdminModule, label: 'System Configuration', icon: '⚙️' },
      ],
    },
  ];

  return (
    <aside
      style={{
        width: 260,
        backgroundColor: '#0C1527',
        color: '#F8FAFC',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        borderRight: '1px solid #1E293B',
        height: '100vh',
        position: 'sticky',
        top: 0,
        flexShrink: 0,
      }}
    >
      <div>
        {/* Brand Console Header */}
        <div
          style={{
            padding: '20px 20px 16px 20px',
            borderBottom: '1px solid #1E293B',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span
              style={{
                backgroundColor: '#2563EB',
                color: '#FFFFFF',
                fontWeight: 900,
                fontSize: 14,
                padding: '4px 8px',
                borderRadius: 6,
                letterSpacing: 0.5,
              }}
            >
              OPSKL
            </span>
            <span
              style={{
                fontSize: 11,
                fontWeight: 800,
                color: '#94A3B8',
                letterSpacing: 1,
              }}
            >
              TRUST & OPS CONSOLE
            </span>
          </div>

          {/* Operational Status Pill */}
          <div
            style={{
              marginTop: 12,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '6px 10px',
              backgroundColor: systemStatus.isBookingPaused ? 'rgba(220, 38, 38, 0.2)' : 'rgba(22, 163, 74, 0.15)',
              borderRadius: 6,
              border: `1px solid ${systemStatus.isBookingPaused ? '#DC2626' : '#16A34A'}`,
            }}
          >
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                backgroundColor: systemStatus.isBookingPaused ? '#DC2626' : '#16A34A',
              }}
            />
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: systemStatus.isBookingPaused ? '#FCA5A5' : '#86EFAC',
              }}
            >
              {systemStatus.isBookingPaused ? 'BOOKINGS PAUSED' : 'ALL SYSTEMS LIVE'}
            </span>
          </div>
        </div>

        {/* Navigation Modules */}
        <nav style={{ padding: '16px 12px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {navItems.map((group) => (
            <div key={group.group}>
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 800,
                  color: '#64748B',
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
                      onClick={() => onSelectModule(item.id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        width: '100%',
                        padding: '9px 12px',
                        borderRadius: 8,
                        border: 'none',
                        backgroundColor: isActive ? '#2563EB' : 'transparent',
                        color: isActive ? '#FFFFFF' : '#CBD5E1',
                        cursor: 'pointer',
                        fontSize: 13,
                        fontWeight: isActive ? 700 : 500,
                        textAlign: 'left',
                        transition: 'background-color 0.15s ease',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: 14 }}>{item.icon}</span>
                        <span>{item.label}</span>
                      </div>
                      {item.badge !== undefined && (
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 800,
                            padding: '1px 6px',
                            borderRadius: 10,
                            backgroundColor: isActive ? '#FFFFFF' : item.badgeColor,
                            color: isActive ? '#101D36' : '#FFFFFF',
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

      {/* Admin Operator Profile Footer */}
      <div
        style={{
          padding: '16px',
          borderTop: '1px solid #1E293B',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <div
          style={{
            width: 34,
            height: 34,
            borderRadius: '50%',
            backgroundColor: '#1E293B',
            border: '1px solid #334155',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 800,
            fontSize: 13,
            color: '#60A5FA',
          }}
        >
          AY
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#F8FAFC' }}>Aryan Yadav</div>
          <div style={{ fontSize: 11, color: '#64748B' }}>Super Administrator</div>
        </div>
      </div>
    </aside>
  );
};
