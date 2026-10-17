'use client';

import React, { useState } from 'react';
import { PlatformSetting, SystemOperationalStatus } from '@opskil/shared';

interface PlatformSettingsPanelProps {
  settings: PlatformSetting[];
  systemStatus: SystemOperationalStatus;
  onToggleBookingPause: (reason?: string) => void;
}

export const PlatformSettingsPanel: React.FC<PlatformSettingsPanelProps> = ({
  settings,
  systemStatus,
  onToggleBookingPause,
}) => {
  const [pauseReasonInput, setPauseReasonInput] = useState('Monsoon weather safety precaution');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h1 style={{ fontSize: 18, fontWeight: 800, color: '#111111' }}>
          Platform System Configuration
        </h1>
        <p style={{ fontSize: 13, color: '#737373', marginTop: 2 }}>
          Operational controls, safety killswitches, fee structures, and runtime configuration stored in Supabase platform_settings.
        </p>
      </div>

      {/* Emergency Killswitch Card */}
      <div
        style={{
          backgroundColor: '#FFFFFF',
          border: `1.5px solid ${systemStatus.isBookingPaused ? '#DC2626' : '#E5E5E5'}`,
          borderRadius: 12,
          padding: 24,
          boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 18 }}>🚨</span>
              <h2 style={{ fontSize: 16, fontWeight: 800, color: '#111111' }}>
                Platform-Wide Shift Booking Emergency Pause
              </h2>
            </div>
            <p style={{ fontSize: 13, color: '#737373', marginTop: 4, maxWidth: 560 }}>
              Instantly pauses all new shift applications across the Worker app and Organizer publishing pipelines. Active shifts in progress remain functional.
            </p>
          </div>

          <button
            onClick={() => onToggleBookingPause(pauseReasonInput)}
            style={{
              padding: '10px 18px',
              borderRadius: 8,
              border: 'none',
              backgroundColor: systemStatus.isBookingPaused ? '#15803D' : '#DC2626',
              color: '#FFFFFF',
              fontWeight: 700,
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            {systemStatus.isBookingPaused ? '▶️ Resume Marketplace Bookings' : '⏸️ Trigger Emergency Pause'}
          </button>
        </div>

        <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid #F5F5F5', display: 'flex', gap: 12, alignItems: 'center' }}>
          <label style={{ fontSize: 12, fontWeight: 700, color: '#111111', minWidth: 120 }}>
            Operational Reason:
          </label>
          <input
            type="text"
            value={pauseReasonInput}
            onChange={(e) => setPauseReasonInput(e.target.value)}
            placeholder="e.g. Extreme weather advisory, Mumbai police venue guidelines..."
            style={{
              flex: 1,
              padding: '8px 12px',
              borderRadius: 6,
              border: '1px solid #E5E5E5',
              backgroundColor: '#FFFFFF',
              color: '#111111',
              fontSize: 13,
              outline: 'none',
            }}
          />
        </div>
      </div>

      {/* Live System Settings Table */}
      <div
        style={{
          backgroundColor: '#FFFFFF',
          border: '1px solid #E5E5E5',
          borderRadius: 12,
          overflow: 'hidden',
          boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
        }}
      >
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #E5E5E5', fontWeight: 700, color: '#111111' }}>
          Active Database Configuration Keys
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
          <thead>
            <tr style={{ backgroundColor: '#FAFAFA', borderBottom: '1px solid #E5E5E5', color: '#737373', fontWeight: 600 }}>
              <th style={{ padding: '12px 16px' }}>Setting Key</th>
              <th style={{ padding: '12px 16px' }}>Current Value</th>
              <th style={{ padding: '12px 16px' }}>Description</th>
              <th style={{ padding: '12px 16px' }}>Last Updated</th>
            </tr>
          </thead>
          <tbody>
            {settings.map((s) => (
              <tr key={s.key} style={{ borderBottom: '1px solid #F5F5F5' }}>
                <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontWeight: 600, color: '#111111' }}>
                  {s.key}
                </td>
                <td style={{ padding: '12px 16px', fontWeight: 700, color: '#111111' }}>
                  {typeof s.value === 'object' ? JSON.stringify(s.value) : String(s.value)}
                </td>
                <td style={{ padding: '12px 16px', color: '#737373' }}>
                  {s.description || 'System setting'}
                </td>
                <td style={{ padding: '12px 16px', color: '#737373' }}>
                  {new Date(s.updatedAt).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
