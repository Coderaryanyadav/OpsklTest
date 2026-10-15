'use client';

import React, { useState } from 'react';

export interface DirectoryUser {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  role: 'worker' | 'organizer';
  isActive: boolean;
  createdAt: string;
  // Worker-specific
  verificationStatus?: string;
  isAadhaarVerified?: boolean;
  isPanVerified?: boolean;
  skills?: string[];
  preferredLocality?: string;
  shiftsCompleted?: number;
  upiId?: string | null;
  // Organizer-specific
  businessName?: string;
  businessType?: string;
  isGstinVerified?: boolean;
  gstin?: string | null;
  totalEventsHosted?: number;
}

interface DirectoryTableProps {
  type: 'worker' | 'organizer';
  users: DirectoryUser[];
  onToggleActiveStatus: (userId: string, currentActive: boolean) => Promise<void>;
  onRefresh: () => void;
}

export const DirectoryTable: React.FC<DirectoryTableProps> = ({
  type,
  users,
  onToggleActiveStatus,
  onRefresh,
}) => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'verified' | 'unverified' | 'suspended'>('all');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const filtered = users.filter((u) => {
    if (statusFilter === 'suspended' && u.isActive) return false;
    if (statusFilter === 'verified') {
      const isVerified = type === 'worker' ? (u.verificationStatus === 'verified' || u.isAadhaarVerified) : (u.verificationStatus === 'verified' || u.isGstinVerified);
      if (!isVerified) return false;
    }
    if (statusFilter === 'unverified') {
      const isVerified = type === 'worker' ? (u.verificationStatus === 'verified' || u.isAadhaarVerified) : (u.verificationStatus === 'verified' || u.isGstinVerified);
      if (isVerified) return false;
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      const name = (u.fullName || '').toLowerCase();
      const email = (u.email || '').toLowerCase();
      const phone = (u.phone || '').toLowerCase();
      const biz = (u.businessName || '').toLowerCase();
      const id = u.id.toLowerCase();
      return name.includes(q) || email.includes(q) || phone.includes(q) || biz.includes(q) || id.includes(q);
    }
    return true;
  });

  const handleToggle = async (user: DirectoryUser) => {
    const action = user.isActive ? 'Suspend' : 'Reactivate';
    if (!window.confirm(`${action} user account for ${user.fullName || user.email}?`)) {
      return;
    }
    setUpdatingId(user.id);
    try {
      await onToggleActiveStatus(user.id, user.isActive);
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Search and Filters Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 800, color: '#101D36' }}>
            {type === 'worker' ? 'Verified Worker Talent Pool' : 'Event Agencies & Organizers Directory'}
          </h2>
          <p style={{ fontSize: 13, color: '#64748B', marginTop: 2 }}>
            {type === 'worker'
              ? 'Real-time database records of registered on-demand event workforce across Mumbai'
              : 'Registered event planning agencies, venue hosts, and corporate organizers'}
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            type="text"
            placeholder={`Search ${type}s by name, email, phone...`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              padding: '7px 12px',
              borderRadius: 8,
              border: '1px solid #CBD5E1',
              fontSize: 13,
              width: 240,
              outline: 'none',
            }}
          />

          <div style={{ display: 'flex', backgroundColor: '#F1F5F9', borderRadius: 8, padding: 2, border: '1px solid #E2E8F0' }}>
            {(['all', 'verified', 'unverified', 'suspended'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setStatusFilter(tab)}
                style={{
                  padding: '6px 12px',
                  borderRadius: 6,
                  border: 'none',
                  backgroundColor: statusFilter === tab ? '#FFFFFF' : 'transparent',
                  color: statusFilter === tab ? '#101D36' : '#64748B',
                  fontWeight: statusFilter === tab ? 700 : 500,
                  fontSize: 12,
                  cursor: 'pointer',
                  textTransform: 'capitalize',
                  boxShadow: statusFilter === tab ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
                }}
              >
                {tab}
              </button>
            ))}
          </div>

          <button
            onClick={onRefresh}
            style={{
              padding: '7px 14px',
              borderRadius: 8,
              border: '1px solid #E2E8F0',
              backgroundColor: '#FFFFFF',
              color: '#101D36',
              fontWeight: 600,
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            ↻ Refresh
          </button>
        </div>
      </div>

      {/* Directory Table */}
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
              <th style={{ padding: '12px 16px' }}>{type === 'worker' ? 'Worker Profile' : 'Agency / Company'}</th>
              <th style={{ padding: '12px 16px' }}>Contact Details</th>
              <th style={{ padding: '12px 16px' }}>{type === 'worker' ? 'Locality & Skills' : 'Business Type & GSTIN'}</th>
              <th style={{ padding: '12px 16px' }}>KYC Status</th>
              <th style={{ padding: '12px 16px' }}>Account</th>
              <th style={{ padding: '12px 16px', textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: '36px', textAlign: 'center', color: '#94A3B8' }}>
                  No {type} accounts found matching current query.
                </td>
              </tr>
            ) : (
              filtered.map((u) => {
                const isVerified = type === 'worker'
                  ? (u.verificationStatus === 'verified' || u.isAadhaarVerified)
                  : (u.verificationStatus === 'verified' || u.isGstinVerified);

                return (
                  <tr key={u.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ fontWeight: 700, color: '#101D36' }}>
                        {type === 'organizer' && u.businessName ? u.businessName : u.fullName || 'Registered User'}
                      </div>
                      <div style={{ fontSize: 11, color: '#64748B', fontFamily: 'monospace' }}>
                        ID #{u.id.substring(0, 8)}
                      </div>
                    </td>

                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ color: '#1E293B' }}>{u.email}</div>
                      <div style={{ fontSize: 11, color: '#64748B' }}>
                        {u.phone || 'No phone registered'}
                      </div>
                    </td>

                    <td style={{ padding: '12px 16px' }}>
                      {type === 'worker' ? (
                        <div>
                          <div style={{ color: '#1E293B', fontWeight: 500 }}>
                            {u.preferredLocality || 'Mumbai'}
                          </div>
                          <div style={{ fontSize: 11, color: '#64748B' }}>
                            {u.skills && u.skills.length > 0 ? u.skills.join(', ') : 'General Event Support'}
                          </div>
                        </div>
                      ) : (
                        <div>
                          <div style={{ color: '#1E293B', fontWeight: 500, textTransform: 'capitalize' }}>
                            {(u.businessType || 'Event Agency').replace('_', ' ')}
                          </div>
                          <div style={{ fontSize: 11, color: '#64748B', fontFamily: 'monospace' }}>
                            {u.gstin || 'No GSTIN on file'}
                          </div>
                        </div>
                      )}
                    </td>

                    <td style={{ padding: '12px 16px' }}>
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '3px 10px',
                          borderRadius: 12,
                          fontSize: 11,
                          fontWeight: 700,
                          backgroundColor: isVerified ? '#DCFCE7' : '#FEF3C7',
                          color: isVerified ? '#16A34A' : '#D97706',
                          textTransform: 'uppercase',
                        }}
                      >
                        {isVerified ? 'VERIFIED' : 'PENDING KYC'}
                      </span>
                    </td>

                    <td style={{ padding: '12px 16px' }}>
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '3px 10px',
                          borderRadius: 12,
                          fontSize: 11,
                          fontWeight: 700,
                          backgroundColor: u.isActive ? '#F1F5F9' : '#FEE2E2',
                          color: u.isActive ? '#475569' : '#DC2626',
                          textTransform: 'uppercase',
                        }}
                      >
                        {u.isActive ? 'ACTIVE' : 'SUSPENDED'}
                      </span>
                    </td>

                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      <button
                        onClick={() => handleToggle(u)}
                        disabled={updatingId === u.id}
                        style={{
                          padding: '5px 12px',
                          borderRadius: 6,
                          border: '1px solid',
                          borderColor: u.isActive ? '#FCA5A5' : '#86EFAC',
                          backgroundColor: u.isActive ? '#FEF2F2' : '#F0FDF4',
                          color: u.isActive ? '#DC2626' : '#16A34A',
                          fontWeight: 600,
                          fontSize: 11,
                          cursor: 'pointer',
                        }}
                      >
                        {u.isActive ? 'Suspend' : 'Reactivate'}
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
