'use client';

import React from 'react';
import { SystemOperationalStatus } from '@opskil/shared';
import { Play, Pause, Check, X } from 'lucide-react';

interface AdminHeaderProps {
  title: string;
  subtitle?: string;
  systemStatus: SystemOperationalStatus;
  onToggleBookingPause: () => void;
  actionSuccessMessage?: string;
  onDismissMessage?: () => void;
}

export const AdminHeader: React.FC<AdminHeaderProps> = ({
  title,
  subtitle,
  systemStatus,
  onToggleBookingPause,
  actionSuccessMessage,
  onDismissMessage,
}) => {
  return (
    <header
      style={{
        backgroundColor: '#FFFFFF',
        borderBottom: '1px solid #E2E8F0',
        padding: '16px 28px',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        position: 'sticky',
        top: 0,
        zIndex: 50,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#64748B' }}>
            <span>Console</span>
            <span>/</span>
            <span style={{ fontWeight: 600, color: '#0F172A' }}>{title}</span>
          </div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#0F172A', marginTop: 2, letterSpacing: '-0.3px' }}>
            {title}
          </h1>
          {subtitle && <p style={{ fontSize: 13, color: '#64748B', marginTop: 1 }}>{subtitle}</p>}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* Platform Killswitch Toggle */}
          <button
            onClick={onToggleBookingPause}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 14px',
              borderRadius: 6,
              border: `1px solid ${systemStatus.isBookingPaused ? '#16A34A' : '#DC2626'}`,
              backgroundColor: systemStatus.isBookingPaused ? '#F0FDF4' : '#FEF2F2',
              color: systemStatus.isBookingPaused ? '#16A34A' : '#DC2626',
              fontWeight: 600,
              fontSize: 12,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            {systemStatus.isBookingPaused ? (
              <>
                <Play size={13} strokeWidth={2.5} />
                <span>Resume Shift Bookings</span>
              </>
            ) : (
              <>
                <Pause size={13} strokeWidth={2.5} />
                <span>Emergency Pause Bookings</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Action Toast Feedback Banner */}
      {actionSuccessMessage && (
        <div
          style={{
            backgroundColor: '#F0FDF4',
            border: '1px solid #16A34A',
            color: '#15803D',
            padding: '10px 14px',
            borderRadius: 6,
            fontSize: 13,
            fontWeight: 500,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Check size={14} strokeWidth={2.5} />
            <span>{actionSuccessMessage}</span>
          </div>
          {onDismissMessage && (
            <button
              onClick={onDismissMessage}
              style={{
                background: 'none',
                border: 'none',
                color: '#15803D',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
              }}
              aria-label="Dismiss message"
            >
              <X size={14} strokeWidth={2} />
            </button>
          )}
        </div>
      )}
    </header>
  );
};
