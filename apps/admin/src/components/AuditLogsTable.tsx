'use client';

import React, { useState } from 'react';
import { AuditLog } from '@opskil/shared';
import { EmptyRow, Pagination, TableShell, maskId, useClientPagination } from './ui';

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
      log.entityType.toLowerCase().includes(q) ||
      log.entityId.toLowerCase().includes(q)
    );
  });

  const { page, pageCount, pageRows, setPage, summary } = useClientPagination(filteredLogs, 15);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="admin-toolbar">
        <div>
          <h2 className="admin-section-title">Administrative audit trail</h2>
          <p className="admin-section-desc">
            Record of administrative operations, adjudications, and access events from the database.
          </p>
        </div>

        <input
          type="search"
          className="admin-input admin-input-sm"
          placeholder="Filter by action, actor, entity…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ width: 260 }}
          aria-label="Filter audit logs"
        />
      </div>

      <TableShell
        footer={<Pagination page={page} pageCount={pageCount} onChange={setPage} summary={summary} />}
      >
        <table className="admin-table">
          <thead>
            <tr>
              <th>Timestamp (IST)</th>
              <th>Action</th>
              <th>Target</th>
              <th>Admin</th>
              <th>Changes</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.length === 0 ? (
              <EmptyRow colSpan={5} title="No logs" message="No audit logs match the search criteria." />
            ) : (
              pageRows.map((log) => (
                <tr key={log.id}>
                  <td style={{ color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
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
                  <td>
                    <span className="admin-status admin-status--neutral" style={{ fontFamily: 'monospace' }}>
                      {log.action}
                    </span>
                  </td>
                  <td>
                    {log.entityType} ({maskId(log.entityId)})
                  </td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{log.actorEmail || 'admin-system'}</div>
                    {log.ipAddress && <div className="cell-muted">IP: {log.ipAddress}</div>}
                  </td>
                  <td style={{ maxWidth: 300 }}>
                    <pre
                      style={{
                        margin: 0,
                        fontSize: 11,
                        color: 'var(--text-main)',
                        backgroundColor: 'var(--surface-muted)',
                        border: '1px solid var(--border-color)',
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
      </TableShell>
    </div>
  );
};
