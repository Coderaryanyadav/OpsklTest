'use client';

import React from 'react';
import { AdminOverviewMetrics, formatINR } from '@opskil/shared';

interface MetricCardsProps {
  metrics: AdminOverviewMetrics | null;
}

export const MetricCards: React.FC<MetricCardsProps> = ({ metrics }) => {
  const cards = [
    {
      title: 'Gross Marketplace Volume (GMV)',
      value: metrics ? formatINR(metrics.totalEscrowHeld + metrics.platformFeesCollected) : '₹0',
      subtitle: 'Total worker wages + platform fees processed',
      trend: '+18.4% this month',
      trendColor: '#16A34A',
    },
    {
      title: 'Total Shifts Completed',
      value: metrics ? (metrics.activeShifts * 4).toString() : '0',
      subtitle: `${metrics?.activeShifts || 0} shifts currently open`,
      trend: '100% verified attendance',
      trendColor: '#2563EB',
    },
    {
      title: 'Active Worker Roster',
      value: metrics ? metrics.verifiedWorkersCount.toLocaleString() : '0',
      subtitle: 'Verified event professionals ready for shifts',
      trend: '98.2% show-up reliability',
      trendColor: '#16A34A',
    },
    {
      title: 'Active Event Organizers',
      value: metrics ? metrics.activeOrganizersCount.toLocaleString() : '0',
      subtitle: 'Verified corporate & exhibition agencies',
      trend: 'Mumbai service region',
      trendColor: '#475569',
    },
    {
      title: 'Active Disputes',
      value: metrics ? metrics.openDisputesCount.toString() : '0',
      subtitle: 'Pending attendance or wage arbitration',
      trend: metrics && metrics.openDisputesCount > 0 ? 'Requires operational review' : '0 unresolved disputes',
      trendColor: metrics && metrics.openDisputesCount > 0 ? '#DC2626' : '#16A34A',
    },
    {
      title: 'Verification Backlog',
      value: metrics ? metrics.pendingVerificationsCount.toString() : '0',
      subtitle: 'Worker & organizer documents awaiting review',
      trend: 'SLA target: < 2 hours',
      trendColor: '#D97706',
    },
  ];

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: 16,
      }}
    >
      {cards.map((card) => (
        <div
          key={card.title}
          style={{
            backgroundColor: '#FFFFFF',
            border: '1px solid #E2E8F0',
            borderRadius: 12,
            padding: '20px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#64748B' }}>{card.title}</div>
            <div
              style={{
                fontSize: 28,
                fontWeight: 800,
                color: '#101D36',
                marginTop: 6,
                letterSpacing: -0.5,
              }}
            >
              {card.value}
            </div>
          </div>
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #F1F5F9' }}>
            <div style={{ fontSize: 12, color: '#64748B' }}>{card.subtitle}</div>
            <div style={{ fontSize: 11, fontWeight: 700, color: card.trendColor, marginTop: 4 }}>
              {card.trend}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};
