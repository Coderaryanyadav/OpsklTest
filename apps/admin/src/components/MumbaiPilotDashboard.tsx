'use client';

import React from 'react';
import { PilotMetricsSummary, formatINR, MUMBAI_PILOT_RECORDS } from '@opskil/shared';

interface MumbaiPilotDashboardProps {
  pilotMetrics: PilotMetricsSummary;
}

export const MumbaiPilotDashboard: React.FC<MumbaiPilotDashboardProps> = ({ pilotMetrics }) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h1 style={{ fontSize: 18, fontWeight: 800, color: '#101D36' }}>
          Mumbai Live Pilot & Operational Performance
        </h1>
        <p style={{ fontSize: 13, color: '#64748B', marginTop: 2 }}>
          Dedicated metrics tracking corporate events and exhibitions in BKC, NESCO, and South Mumbai.
        </p>
      </div>

      {/* Metrics Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
        <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 10, padding: 16 }}>
          <div style={{ fontSize: 12, color: '#64748B', fontWeight: 600 }}>Total Jobs Posted</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#101D36', marginTop: 4 }}>
            {pilotMetrics.totalGenuineJobsPosted}
          </div>
          <div style={{ fontSize: 11, color: '#16A34A', marginTop: 4 }}>100% Genuine Venue Events</div>
        </div>

        <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 10, padding: 16 }}>
          <div style={{ fontSize: 12, color: '#64748B', fontWeight: 600 }}>Positions Filled / Requested</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#101D36', marginTop: 4 }}>
            {pilotMetrics.totalPositionsFilled} / {pilotMetrics.totalPositionsRequested}
          </div>
          <div style={{ fontSize: 11, color: '#2563EB', marginTop: 4 }}>
            {pilotMetrics.fillRatePct.toFixed(1)}% Fill Rate
          </div>
        </div>

        <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 10, padding: 16 }}>
          <div style={{ fontSize: 12, color: '#64748B', fontWeight: 600 }}>Total Wage Payouts</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#16A34A', marginTop: 4 }}>
            {formatINR(pilotMetrics.totalWagesPaidINR)}
          </div>
          <div style={{ fontSize: 11, color: '#64748B', marginTop: 4 }}>
            Avg Rate: {formatINR(pilotMetrics.averageWorkerWageINR)}
          </div>
        </div>

        <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 10, padding: 16 }}>
          <div style={{ fontSize: 12, color: '#64748B', fontWeight: 600 }}>Worker Show-Up Rate</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#101D36', marginTop: 4 }}>
            {pilotMetrics.workerShowUpRatePct.toFixed(1)}%
          </div>
          <div style={{ fontSize: 11, color: '#16A34A', marginTop: 4 }}>0 Critical Safety Incidents</div>
        </div>
      </div>

      {/* Pilot Records Table */}
      <div
        style={{
          backgroundColor: '#FFFFFF',
          border: '1px solid #E2E8F0',
          borderRadius: 12,
          overflow: 'hidden',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        }}
      >
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #E2E8F0', fontWeight: 700, color: '#101D36' }}>
          Active Mumbai Pilot Event Shifts
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
          <thead>
            <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#475569' }}>
              <th style={{ padding: '12px 16px' }}>Event & Venue</th>
              <th style={{ padding: '12px 16px' }}>Locality</th>
              <th style={{ padding: '12px 16px' }}>Date</th>
              <th style={{ padding: '12px 16px' }}>Worker Wage</th>
              <th style={{ padding: '12px 16px' }}>Roster Filled</th>
              <th style={{ padding: '12px 16px' }}>Attendance</th>
            </tr>
          </thead>
          <tbody>
            {MUMBAI_PILOT_RECORDS.map((rec) => (
              <tr key={rec.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                <td style={{ padding: '12px 16px' }}>
                  <div style={{ fontWeight: 700, color: '#101D36' }}>{rec.title}</div>
                  <div style={{ fontSize: 11, color: '#64748B' }}>{rec.venue}</div>
                </td>
                <td style={{ padding: '12px 16px', color: '#475569' }}>{rec.locality}</td>
                <td style={{ padding: '12px 16px', color: '#64748B' }}>{rec.date}</td>
                <td style={{ padding: '12px 16px', fontWeight: 700, color: '#101D36' }}>
                  {formatINR(rec.wagePerWorkerINR)}
                </td>
                <td style={{ padding: '12px 16px' }}>
                  {rec.positionsFilled} / {rec.positionsRequested}
                </td>
                <td style={{ padding: '12px 16px' }}>
                  <span
                    style={{
                      padding: '2px 8px',
                      borderRadius: 12,
                      fontSize: 11,
                      fontWeight: 700,
                      backgroundColor: rec.completedCount > 0 ? '#DCFCE7' : '#EFF6FF',
                      color: rec.completedCount > 0 ? '#16A34A' : '#2563EB',
                      textTransform: 'uppercase',
                    }}
                  >
                    {rec.completedCount} Completed
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
