'use client';

import React from 'react';
import {
  BarChart3,
  MapPin,
  ShieldCheck,
  Scale,
  AlertTriangle,
  Briefcase,
  FileText,
  Settings,
} from 'lucide-react';
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
        { id: 'overview' as AdminModule, label: 'Platform Overview', icon: <BarChart3 size={16} /> },
        { id: 'pilot' as AdminModule, label: 'Mumbai Live Pilot', icon: <MapPin size={16} /> },
        {
          id: 'verifications' as AdminModule,
          label: 'Verification Queue',
          icon: <ShieldCheck size={16} />,
          badge: pendingVerificationsCount > 0 ? pendingVerificationsCount : undefined,
          badgeColor: '#262626',
        },
        {
          id: 'disputes' as AdminModule,
          label: 'Attendance Disputes',
          icon: <Scale size={16} />,
          badge: activeDisputesCount > 0 ? activeDisputesCount : undefined,
          badgeColor: '#D97706',
        },
        {
          id: 'safety' as AdminModule,
          label: 'Safety Reports',
          icon: <AlertTriangle size={16} />,
          badge: urgentSafetyCount > 0 ? urgentSafetyCount : undefined,
          badgeColor: '#DC2626',
        },
      ],
    },
    {
      group: 'MARKETPLACE MODERATION',
      items: [
        { id: 'jobs' as AdminModule, label: 'Shift Moderation', icon: <Briefcase size={16} /> },
        { id: 'audit' as AdminModule, label: 'Audit Logs', icon: <FileText size={16} /> },
        { id: 'settings' as AdminModule, label: 'System Configuration', icon: <Settings size={16} /> },
      ],
    },
  ];

  return (
    <aside
      style={{
        width: 260,
        backgroundColor: '#000000',
        color: '#FFFFFF',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        borderRight: '1px solid #262626',
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
            borderBottom: '1px solid #262626',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span
              style={{
                backgroundColor: '#FFFFFF',
                color: '#000000',
                fontWeight: 900,
                fontSize: 13,
                padding: '4px 8px',
                borderRadius: 4,
                letterSpacing: 0.5,
              }}
            >
              OPSKL
            </span>
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: '#737373',
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
              backgroundColor: systemStatus.isBookingPaused ? 'rgba(220, 38, 38, 0.15)' : '#121212',
              borderRadius: 6,
              border: `1px solid ${systemStatus.isBookingPaused ? '#DC2626' : '#262626'}`,
            }}
          >
            <div
              style={{
                width: 7,
                height: 7,
                borderRadius: '50%',
                backgroundColor: systemStatus.isBookingPaused ? '#DC2626' : '#16A34A',
              }}
            />
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: systemStatus.isBookingPaused ? '#FCA5A5' : '#E5E5E5',
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
                  fontWeight: 700,
                  color: '#737373',
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
                        borderRadius: 6,
                        border: 'none',
                        backgroundColor: isActive ? '#262626' : 'transparent',
                        color: isActive ? '#FFFFFF' : '#A3A3A3',
                        cursor: 'pointer',
                        fontSize: 13,
                        fontWeight: isActive ? 600 : 500,
                        textAlign: 'left',
                        transition: 'background-color 0.15s ease',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ display: 'flex', alignItems: 'center' }}>{item.icon}</span>
                        <span>{item.label}</span>
                      </div>
                      {item.badge !== undefined && (
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            padding: '1px 6px',
                            borderRadius: 10,
                            backgroundColor: isActive ? '#FFFFFF' : item.badgeColor,
                            color: isActive ? '#000000' : '#FFFFFF',
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
          borderTop: '1px solid #262626',
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
            backgroundColor: '#262626',
            border: '1px solid #404040',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 700,
            fontSize: 12,
            color: '#FFFFFF',
          }}
        >
          AY
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#FFFFFF' }}>Platform Administrator</div>
          <div style={{ fontSize: 11, color: '#737373' }}>Ops & Compliance</div>
        </div>
      </div>
    </aside>
  );
};
