'use client';

import React, { useState } from 'react';
import { SafetyReport } from '@opskil/shared';

interface SafetyQueueProps {
  safetyReports: SafetyReport[];
  onResolveSafetyReport: (reportId: string, actionTaken: string) => Promise<void>;
}

export const SafetyQueue: React.FC<SafetyQueueProps> = ({
  safetyReports,
  onResolveSafetyReport,
}) => {
  const [selectedReport, setSelectedReport] = useState<SafetyReport | null>(null);
  const [actionNotes, setActionNotes] = useState('');
  const [modalError, setModalError] = useState('');
  const [resolving, setResolving] = useState(false);

  const handleResolve = async () => {
    if (!selectedReport) return;
    if (!actionNotes.trim()) {
      setModalError('Action summary and mitigation notes are required.');
      return;
    }
    setResolving(true);
    setModalError('');
    try {
      await onResolveSafetyReport(selectedReport.id, actionNotes);
      setSelectedReport(null);
      setActionNotes('');
    } catch (err: any) {
      setModalError(err?.message || 'Failed to resolve safety report');
    } finally {
      setResolving(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <h1 style={{ fontSize: 18, fontWeight: 800, color: '#101D36' }}>
          Safety Reports & Urgent Incidents
        </h1>
        <p style={{ fontSize: 13, color: '#64748B', marginTop: 2 }}>
          On-site worker safety reports, venue hazards, emergency SOS triggers, and harassment grievances.
        </p>
      </div>

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
              <th style={{ padding: '12px 16px' }}>Incident / Shift</th>
              <th style={{ padding: '12px 16px' }}>Urgency</th>
              <th style={{ padding: '12px 16px' }}>Category</th>
              <th style={{ padding: '12px 16px' }}>Description</th>
              <th style={{ padding: '12px 16px' }}>Status</th>
              <th style={{ padding: '12px 16px', textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {safetyReports.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: '36px', textAlign: 'center', color: '#94A3B8' }}>
                  No active safety complaints reported.
                </td>
              </tr>
            ) : (
              safetyReports.map((r) => (
                <tr key={r.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ fontWeight: 700, color: '#101D36' }}>
                      {r.jobTitle || `Incident #${r.id.substring(0, 8)}`}
                    </div>
                    <div style={{ fontSize: 11, color: '#64748B' }}>
                      Reported {new Date(r.createdAt).toLocaleDateString()}
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span
                      style={{
                        padding: '2px 8px',
                        borderRadius: 12,
                        fontSize: 11,
                        fontWeight: 700,
                        backgroundColor:
                          r.severity === 'critical'
                            ? '#FEE2E2'
                            : r.severity === 'high'
                            ? '#FEF3C7'
                            : '#EFF6FF',
                        color:
                          r.severity === 'critical'
                            ? '#DC2626'
                            : r.severity === 'high'
                            ? '#D97706'
                            : '#2563EB',
                        textTransform: 'uppercase',
                      }}
                    >
                      {r.severity}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', textTransform: 'capitalize' }}>
                    {r.category.replace('_', ' ')}
                  </td>
                  <td style={{ padding: '12px 16px', color: '#475569', maxWidth: 280 }}>
                    <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {r.description}
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span
                      style={{
                        padding: '2px 8px',
                        borderRadius: 12,
                        fontSize: 11,
                        fontWeight: 700,
                        backgroundColor: r.status === 'resolved' ? '#DCFCE7' : '#FEF3C7',
                        color: r.status === 'resolved' ? '#16A34A' : '#D97706',
                        textTransform: 'uppercase',
                      }}
                    >
                      {r.status}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                    <button
                      onClick={() => {
                        setSelectedReport(r);
                        setActionNotes('');
                        setModalError('');
                      }}
                      style={{
                        padding: '6px 12px',
                        borderRadius: 6,
                        border: '1px solid #CBD5E1',
                        backgroundColor: '#FFFFFF',
                        color: '#2563EB',
                        fontWeight: 700,
                        fontSize: 12,
                        cursor: 'pointer',
                      }}
                    >
                      Investigate
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Safety Resolution Modal */}
      {selectedReport && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: 16,
          }}
        >
          <div
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: 14,
              width: '100%',
              maxWidth: 540,
              padding: 24,
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: 18, fontWeight: 800, color: '#101D36' }}>
                Safety Grievance Investigation
              </h2>
              <button
                onClick={() => setSelectedReport(null)}
                style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#64748B' }}
              >
                ✕
              </button>
            </div>

            <div style={{ backgroundColor: '#F8FAFC', padding: 14, borderRadius: 8, fontSize: 13, gap: 6, display: 'flex', flexDirection: 'column' }}>
              <div><strong>Category:</strong> {selectedReport.category}</div>
              <div><strong>Severity:</strong> {selectedReport.severity.toUpperCase()}</div>
              <div><strong>Incident Details:</strong> {selectedReport.description}</div>
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 6 }}>
                Resolution Actions Taken:
              </label>
              <textarea
                value={actionNotes}
                onChange={(e) => setActionNotes(e.target.value)}
                placeholder="Detail emergency contact, venue medical support, or supervisor warnings issued..."
                rows={3}
                style={{
                  width: '100%',
                  padding: 10,
                  borderRadius: 8,
                  border: '1px solid #CBD5E1',
                  fontSize: 13,
                  outline: 'none',
                }}
              />
            </div>

            {modalError && (
              <div style={{ color: '#DC2626', fontSize: 12, fontWeight: 600 }}>
                ⚠️ {modalError}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                onClick={() => setSelectedReport(null)}
                style={{
                  padding: '9px 16px',
                  borderRadius: 8,
                  border: '1px solid #CBD5E1',
                  backgroundColor: '#FFFFFF',
                  color: '#475569',
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>

              <button
                onClick={handleResolve}
                disabled={resolving}
                style={{
                  padding: '9px 18px',
                  borderRadius: 8,
                  border: 'none',
                  backgroundColor: '#16A34A',
                  color: '#FFFFFF',
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: 'pointer',
                  opacity: resolving ? 0.7 : 1,
                }}
              >
                Mark Resolved & Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
