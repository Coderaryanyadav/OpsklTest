'use client';

import React from 'react';
import { AdminOverviewMetrics, formatINR } from '@opskil/shared';
import { StatusPill, StatusTone } from './ui';

interface MetricCardsProps {
  metrics: AdminOverviewMetrics | null;
}

export const MetricCards: React.FC<MetricCardsProps> = ({ metrics }) => {
  const cards: {
    title: string;
    value: string;
    meta: string;
    status?: { label: string; tone: StatusTone };
  }[] = [
    {
      title: 'Marketplace volume',
      value: metrics ? formatINR(metrics.totalEscrowHeld + metrics.platformFeesCollected) : '—',
      meta: 'Escrow held + platform fees',
    },
    {
      title: 'Active shifts',
      value: metrics ? metrics.activeShifts.toString() : '—',
      meta: 'Published in marketplace',
    },
    {
      title: 'Verified workers',
      value: metrics ? metrics.verifiedWorkersCount.toLocaleString() : '—',
      meta: 'KYC-verified roster',
    },
    {
      title: 'Active organizers',
      value: metrics ? metrics.activeOrganizersCount.toLocaleString() : '—',
      meta: 'Verified agencies',
    },
    {
      title: 'Open disputes',
      value: metrics ? metrics.openDisputesCount.toString() : '—',
      meta: 'Attendance / wage arbitration',
      status:
        metrics && metrics.openDisputesCount > 0
          ? { label: 'Needs review', tone: 'warning' }
          : { label: 'Clear', tone: 'success' },
    },
    {
      title: 'Verification backlog',
      value: metrics ? metrics.pendingVerificationsCount.toString() : '—',
      meta: 'Documents awaiting review',
      status:
        metrics && metrics.pendingVerificationsCount > 0
          ? { label: 'Backlog', tone: 'warning' }
          : { label: 'Clear', tone: 'success' },
    },
  ];

  return (
    <div className="admin-metrics" role="list">
      {cards.map((card) => (
        <div key={card.title} className="admin-metric" role="listitem">
          <div className="admin-metric-label">{card.title}</div>
          <div className="admin-metric-value">{card.value}</div>
          <div className="admin-metric-meta">{card.meta}</div>
          {card.status && (
            <div style={{ marginTop: 8 }}>
              <StatusPill label={card.status.label} tone={card.status.tone} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
};
