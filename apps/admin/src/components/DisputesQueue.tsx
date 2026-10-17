'use client';

import React, { useState } from 'react';
import { Dispute } from '@opskil/shared';

interface DisputesQueueProps {
  disputes: Dispute[];
  onResolveDispute: (
    disputeId: string,
    status: 'resolved' | 'dismissed',
    notes: string,
    adjustedPayout?: number
  ) => Promise<void>;
}

export const DisputesQueue: React.FC<DisputesQueueProps> = ({
  disputes,
  onResolveDispute,
}) => {
  const [selectedDispute, setSelectedDispute] = useState<Dispute | null>(null);
  const [resolutionStatus, setResolutionStatus] = useState<'resolved' | 'dismissed'>('resolved');
  const [notes, setNotes] = useState('');
  const [adjustedPayout, setAdjustedPayout] = useState('');
  const [modalError, setModalError] = useState('');
  const [resolving, setResolving] = useState(false);

  const handleResolve = async () => {
    if (!selectedDispute) return;
    if (!notes.trim()) {
      setModalError('Documented case notes and investigation rationale are required.');
      return;
    }
    setResolving(true);
    setModalError('');
    try {
      const payoutNum = adjustedPayout ? parseFloat(adjustedPayout) : undefined;
      await onResolveDispute(selectedDispute.id, resolutionStatus, notes, payoutNum);
      setSelectedDispute(null);
      setNotes('');
      setAdjustedPayout('');
    } catch (err: any) {
      setModalError(err?.message || 'Failed to adjudicate dispute');
    } finally {
      setResolving(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header */}
      <div>
        <h1 style={{ fontSize: 18, fontWeight: 800, color: '#111111' }}>
          Attendance & Wage Disputes
        </h1>
        <p style={{ fontSize: 13, color: '#737373', marginTop: 2 }}>
          Investigate shift attendance disputes, check-in discrepancies, and wage adjustments with platform escrow protection.
        </p>
      </div>

      {/* Disputes Table */}
      <div
        style={{
          backgroundColor: '#FFFFFF',
          border: '1px solid #E5E5E5',
          borderRadius: 12,
          overflow: 'hidden',
          boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
        }}
      >
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
          <thead>
            <tr style={{ backgroundColor: '#FAFAFA', borderBottom: '1px solid #E5E5E5', color: '#737373', fontWeight: 600 }}>
              <th style={{ padding: '12px 16px' }}>Shift & Booking</th>
              <th style={{ padding: '12px 16px' }}>Raised By</th>
              <th style={{ padding: '12px 16px' }}>Claim Reason</th>
              <th style={{ padding: '12px 16px' }}>Details</th>
              <th style={{ padding: '12px 16px' }}>Status</th>
              <th style={{ padding: '12px 16px', textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {disputes.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: '36px', textAlign: 'center', color: '#737373' }}>
                  No active attendance or wage disputes reported.
                </td>
              </tr>
            ) : (
              disputes.map((d) => (
                <tr key={d.id} style={{ borderBottom: '1px solid #F5F5F5' }}>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ fontWeight: 700, color: '#111111' }}>
                      Booking #{d.bookingId.substring(0, 8)}
                    </div>
                    <div style={{ fontSize: 11, color: '#737373' }}>
                      Case #{d.id.substring(0, 8)} • Filed {new Date(d.createdAt).toLocaleDateString()}
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px', color: '#111111' }}>
                    {d.raisedBy.substring(0, 8)}
                  </td>
                  <td style={{ padding: '12px 16px', fontWeight: 600, color: '#111111' }}>
                    {d.reason}
                  </td>
                  <td style={{ padding: '12px 16px', color: '#737373', maxWidth: 260 }}>
                    <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {d.details}
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
                          d.status === 'resolved'
                            ? '#F0FDF4'
                            : d.status === 'under_review'
                            ? '#F5F5F5'
                            : '#FFFBEB',
                        color:
                          d.status === 'resolved'
                            ? '#15803D'
                            : d.status === 'under_review'
                            ? '#111111'
                            : '#B45309',
                        textTransform: 'uppercase',
                      }}
                    >
                      {d.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                    <button
                      onClick={() => {
                        setSelectedDispute(d);
                        setAdjustedPayout('');
                        setNotes('');
                        setModalError('');
                      }}
                      style={{
                        padding: '6px 12px',
                        borderRadius: 6,
                        border: '1px solid #E5E5E5',
                        backgroundColor: '#FFFFFF',
                        color: '#111111',
                        fontWeight: 600,
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

      {/* Adjudicate Dispute Modal */}
      {selectedDispute && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.4)',
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
              maxWidth: 580,
              padding: 24,
              border: '1px solid #E5E5E5',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.08)',
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: 18, fontWeight: 800, color: '#111111' }}>
                Adjudicate Attendance & Wage Dispute
              </h2>
              <button
                onClick={() => setSelectedDispute(null)}
                style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#737373' }}
              >
                ✕
              </button>
            </div>

            <div style={{ backgroundColor: '#FAFAFA', border: '1px solid #E5E5E5', padding: 14, borderRadius: 8, gap: 6, display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#737373' }}>Booking Ref:</span>
                <span style={{ fontWeight: 700, color: '#111111' }}>{selectedDispute.bookingId}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#737373' }}>Claim Reason:</span>
                <span style={{ fontWeight: 600, color: '#111111' }}>{selectedDispute.reason}</span>
              </div>
              <div>
                <span style={{ color: '#737373', display: 'block', marginBottom: 2 }}>Case Details:</span>
                <span style={{ color: '#111111', fontSize: 12 }}>{selectedDispute.details}</span>
              </div>
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#111111', display: 'block', marginBottom: 6 }}>
                Resolution Adjudication:
              </label>
              <select
                value={resolutionStatus}
                onChange={(e) => setResolutionStatus(e.target.value as any)}
                style={{
                  width: '100%',
                  padding: 10,
                  borderRadius: 8,
                  border: '1px solid #E5E5E5',
                  fontSize: 13,
                  outline: 'none',
                  backgroundColor: '#FFFFFF',
                  color: '#111111',
                }}
              >
                <option value="resolved">Mark Resolved (Authorize Adjusted Settlement)</option>
                <option value="dismissed">Dismiss Dispute Claim (No Adjustment)</option>
              </select>
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#111111', display: 'block', marginBottom: 6 }}>
                Adjusted Net Payout (₹):
              </label>
              <input
                type="number"
                value={adjustedPayout}
                onChange={(e) => setAdjustedPayout(e.target.value)}
                placeholder="Optional adjusted wage amount in INR"
                style={{
                  width: '100%',
                  padding: 10,
                  borderRadius: 8,
                  border: '1px solid #E5E5E5',
                  backgroundColor: '#FFFFFF',
                  color: '#111111',
                  fontSize: 13,
                  outline: 'none',
                }}
              />
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#111111', display: 'block', marginBottom: 6 }}>
                Investigation Case Notes:
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Detail GPS logs, supervisor confirmation, or check-in terminal timestamps..."
                rows={3}
                style={{
                  width: '100%',
                  padding: 10,
                  borderRadius: 8,
                  border: '1px solid #E5E5E5',
                  backgroundColor: '#FFFFFF',
                  color: '#111111',
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

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
              <button
                onClick={() => setSelectedDispute(null)}
                style={{
                  padding: '9px 16px',
                  borderRadius: 8,
                  border: '1px solid #E5E5E5',
                  backgroundColor: '#FFFFFF',
                  color: '#111111',
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
                  backgroundColor: '#000000',
                  color: '#FFFFFF',
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: 'pointer',
                  opacity: resolving ? 0.7 : 1,
                }}
              >
                Confirm Adjudication
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
