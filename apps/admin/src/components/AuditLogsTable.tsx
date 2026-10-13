'use client';

import React, { useState } from 'react';
import { AuditLog } from '@opskil/shared';

interface AuditLogsTableProps {
  auditLogs: AuditLog[];
}

export const AuditLogsTable: React.FC<AuditLogsTableProps> = ({ auditLogs }) => {
  const [search, setSearch] = useState('');

  const filteredLogs = auditLogs.filter((log) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      log.action.toLowerCase().includes(q) ||
      (log.actorEmail || '').toLowerCase().includes(q) ||
      log.entityType.toLowerCase().includes(q)
    );
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 800, color: '#101D36' }}>
            Immutable Administrative Audit Trail
          </h1>
          <p style={{ fontSize: 13, color: '#64748B', marginTop: 2 }}>
            Cryptographically sealed and tamper-evident record of all administrative operations, adjudications, and access logs.
          </p>
        </div>

        <input
          type="text"
          placeholder="Filter audit logs..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            padding: '8px 14px',
            borderRadius: 8,
            border: '1px solid #CBD5E1',
            fontSize: 13,
            width: 260,
            outline: 'none',
          }}
        />
      </div>

      {/* Audit Log Table */}
      <div
        style={{
          backgroundColor: '#FFFFFF',
          border: '1px solid #E2E8F0',
          borderRadius: 12,
          overflow: 'hidden',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        }}
      >
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
          <thead>
            <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#475569', fontWeight: 700 }}>
              <th style={{ padding: '12px 16px' }}>Timestamp (IST)</th>
              <th style={{ padding: '12px 16px' }}>Action</th>
              <th style={{ padding: '12px 16px' }}>Target Entity</th>
              <th style={{ padding: '12px 16px' }}>Admin User</th>
              <th style={{ padding: '12px 16px' }}>Audit Payload & Changes</th>
            </tr>
          </thead>
          <tbody>
            {filteredLogs.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ padding: '36px', textAlign: 'center', color: '#94A3B8' }}>
                  No audit logs recorded matching search criteria.
                </td>
              </tr>
            ) : (
              filteredLogs.map((log) => (
                <tr key={log.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                  <td style={{ padding: '12px 16px', color: '#64748B', whiteSpace: 'nowrap' }}>
                    {new Date(log.createdAt).toLocaleString('en-IN', {
                      timeZone: 'Asia/Kolkata',
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    })}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span
                      style={{
                        padding: '2px 8px',
                        borderRadius: 6,
                        backgroundColor: '#F1F5F9',
                        color: '#101D36',
                        fontWeight: 700,
                        fontSize: 12,
                        fontFamily: 'monospace',
                      }}
                    >
                      {log.action}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', color: '#334155' }}>
                    {log.entityType} ({log.entityId.substring(0, 8)})
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ fontWeight: 600, color: '#101D36' }}>
                      {log.actorEmail || 'admin-system'}
                    </div>
                    <div style={{ fontSize: 11, color: '#64748B' }}>IP: {log.ipAddress || '127.0.0.1'}</div>
                  </td>
                  <td style={{ padding: '12px 16px', maxWidth: 300 }}>
                    <pre
                      style={{
                        margin: 0,
                        fontSize: 11,
                        color: '#475569',
                        backgroundColor: '#F8FAFC',
                        padding: '4px 8px',
                        borderRadius: 6,
                        overflowX: 'auto',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-all',
                      }}
                    >
                      {JSON.stringify(log.changes || {}, null, 2)}
                    </pre>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
