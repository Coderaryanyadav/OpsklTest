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
      status: metrics ? 'Escrow & platform fees' : 'Data unavailable',
      statusColor: '#737373',
    },
    {
      title: 'Active Event Shifts',
      value: metrics ? metrics.activeShifts.toString() : '0',
      subtitle: 'Shifts currently published in marketplace',
      status: metrics?.activeShifts ? `${metrics.activeShifts} open for staffing` : 'No active shifts',
      statusColor: '#737373',
    },
    {
      title: 'Verified Worker Roster',
      value: metrics ? metrics.verifiedWorkersCount.toLocaleString() : '0',
      subtitle: 'Verified event professionals ready for shifts',
      status: metrics?.verifiedWorkersCount ? 'KYC verified workforce' : 'Roster awaiting signups',
      statusColor: '#737373',
    },
    {
      title: 'Active Event Organizers',
      value: metrics ? metrics.activeOrganizersCount.toLocaleString() : '0',
      subtitle: 'Verified corporate & exhibition agencies',
      status: 'Mumbai service region',
      statusColor: '#737373',
    },
    {
      title: 'Active Disputes',
      value: metrics ? metrics.openDisputesCount.toString() : '0',
      subtitle: 'Pending attendance or wage arbitration',
      status: metrics && metrics.openDisputesCount > 0 ? 'Requires operational review' : '0 unresolved disputes',
      statusColor: metrics && metrics.openDisputesCount > 0 ? '#DC2626' : '#16A34A',
    },
    {
      title: 'Verification Backlog',
      value: metrics ? metrics.pendingVerificationsCount.toString() : '0',
      subtitle: 'Worker & organizer documents awaiting review',
      status: metrics && metrics.pendingVerificationsCount > 0 ? 'Awaiting KYC compliance' : 'Queue clear',
      statusColor: metrics && metrics.pendingVerificationsCount > 0 ? '#D97706' : '#16A34A',
    },
  ];

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
        gap: 16,
      }}
    >
      {cards.map((card) => (
        <div
          key={card.title}
          style={{
            backgroundColor: '#FFFFFF',
            border: '1px solid #E2E8F0',
            borderRadius: 8,
            padding: '20px',
            boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#64748B', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              {card.title}
            </div>
            <div
              style={{
                fontSize: 26,
                fontWeight: 700,
                color: '#0F172A',
                marginTop: 8,
                letterSpacing: '-0.5px',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {card.value}
            </div>
          </div>
          <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid #F1F5F9' }}>
            <div style={{ fontSize: 12, color: '#64748B' }}>{card.subtitle}</div>
            <div style={{ fontSize: 11, fontWeight: 600, color: card.statusColor, marginTop: 4 }}>
              {card.status}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};
