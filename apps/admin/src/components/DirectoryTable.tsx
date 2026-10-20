'use client';

import React, { useState } from 'react';
import {
  EmptyRow,
  Modal,
  Pagination,
  SegmentedControl,
  StatusPill,
  TableShell,
  maskId,
  maskUpi,
  useClientPagination,
} from './ui';

export interface DirectoryUser {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  role: 'worker' | 'organizer';
  isActive: boolean;
  createdAt: string;
  verificationStatus?: string;
  isAadhaarVerified?: boolean;
  isPanVerified?: boolean;
  skills?: string[];
  preferredLocality?: string | null;
  shiftsCompleted?: number;
  upiId?: string | null;
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
  actionError?: string | null;
}

export const DirectoryTable: React.FC<DirectoryTableProps> = ({
  type,
  users,
  onToggleActiveStatus,
  onRefresh,
  actionError,
}) => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'verified' | 'unverified' | 'suspended'>('all');
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [confirmUser, setConfirmUser] = useState<DirectoryUser | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  const filtered = users.filter((u) => {
    if (statusFilter === 'suspended' && u.isActive) return false;
    if (statusFilter === 'verified') {
      const isVerified =
        type === 'worker'
          ? u.verificationStatus === 'verified' || u.isAadhaarVerified
          : u.verificationStatus === 'verified' || u.isGstinVerified;
      if (!isVerified) return false;
    }
    if (statusFilter === 'unverified') {
      const isVerified =
        type === 'worker'
          ? u.verificationStatus === 'verified' || u.isAadhaarVerified
          : u.verificationStatus === 'verified' || u.isGstinVerified;
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

  const { page, pageCount, pageRows, setPage, summary } = useClientPagination(filtered, 10);

  const handleConfirmToggle = async () => {
    if (!confirmUser) return;
    setUpdatingId(confirmUser.id);
    setLocalError(null);
    try {
      await onToggleActiveStatus(confirmUser.id, confirmUser.isActive);
      setConfirmUser(null);
    } catch (err: any) {
      setLocalError(err?.message || 'Failed to update account status');
    } finally {
      setUpdatingId(null);
    }
  };

  const displayError = localError || actionError;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="admin-toolbar">
        <div>
          <h2 className="admin-section-title">
            {type === 'worker' ? 'Worker directory' : 'Organizer directory'}
          </h2>
          <p className="admin-section-desc">
            {type === 'worker'
              ? 'Registered workforce profiles and KYC status'
              : 'Registered agencies and organizer accounts'}
          </p>
        </div>

        <div className="admin-toolbar-actions">
          <input
            type="search"
            className="admin-input admin-input-sm"
            placeholder={`Search ${type}s…`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: 220 }}
            aria-label={`Search ${type}s`}
          />

          <SegmentedControl
            value={statusFilter}
            onChange={setStatusFilter}
            options={[
              { value: 'all', label: 'All' },
              { value: 'verified', label: 'Verified' },
              { value: 'unverified', label: 'Unverified' },
              { value: 'suspended', label: 'Suspended' },
            ]}
          />

          <button type="button" className="admin-btn admin-btn-secondary admin-btn-sm" onClick={onRefresh}>
            Refresh
          </button>
        </div>
      </div>

      {displayError && (
        <div className="admin-banner admin-banner--danger" role="alert">
          {displayError}
        </div>
      )}

      <TableShell
        footer={<Pagination page={page} pageCount={pageCount} onChange={setPage} summary={summary} />}
      >
        <table className="admin-table">
          <thead>
            <tr>
              <th>{type === 'worker' ? 'Worker' : 'Agency'}</th>
              <th>Contact</th>
              <th>{type === 'worker' ? 'Skills / UPI' : 'Business / GSTIN'}</th>
              <th>KYC</th>
              <th>Account</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.length === 0 ? (
              <EmptyRow
                colSpan={6}
                title="No accounts"
                message={`No ${type} accounts match the current query.`}
              />
            ) : (
              pageRows.map((u) => {
                const isVerified =
                  type === 'worker'
                    ? u.verificationStatus === 'verified' || u.isAadhaarVerified
                    : u.verificationStatus === 'verified' || u.isGstinVerified;

                return (
                  <tr key={u.id}>
                    <td>
                      <div className="cell-primary">
                        {type === 'organizer' && u.businessName
                          ? u.businessName
                          : u.fullName || 'Registered user'}
                      </div>
                      <div className="cell-muted cell-mono">ID {maskId(u.id)}</div>
                    </td>

                    <td>
                      <div>{u.email}</div>
                      <div className="cell-muted">{u.phone || 'No phone'}</div>
                    </td>

                    <td>
                      {type === 'worker' ? (
                        <div>
                          <div style={{ fontWeight: 500 }}>
                            {u.skills && u.skills.length > 0 ? u.skills.join(', ') : 'No skills listed'}
                          </div>
                          <div className="cell-muted">
                            {u.preferredLocality ? u.preferredLocality : 'Locality not set'}
                            {u.upiId ? ` · UPI ${maskUpi(u.upiId)}` : ''}
                          </div>
                        </div>
                      ) : (
                        <div>
                          <div style={{ fontWeight: 500, textTransform: 'capitalize' }}>
                            {(u.businessType || 'event agency').replace(/_/g, ' ')}
                          </div>
                          <div className="cell-muted cell-mono">
                            {u.gstin ? maskId(u.gstin, 4) : 'No GSTIN on file'}
                          </div>
                        </div>
                      )}
                    </td>

                    <td>
                      <StatusPill
                        label={isVerified ? 'Verified' : 'Pending KYC'}
                        tone={isVerified ? 'success' : 'warning'}
                      />
                    </td>

                    <td>
                      <StatusPill
                        label={u.isActive ? 'Active' : 'Suspended'}
                        tone={u.isActive ? 'neutral' : 'danger'}
                      />
                    </td>

                    <td style={{ textAlign: 'right' }}>
                      <button
                        type="button"
                        className={`admin-btn admin-btn-sm ${u.isActive ? 'admin-btn-danger' : 'admin-btn-success'}`}
                        disabled={updatingId === u.id}
                        onClick={() => {
                          setLocalError(null);
                          setConfirmUser(u);
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
      </TableShell>

      {confirmUser && (
        <Modal
          title={confirmUser.isActive ? 'Suspend account?' : 'Reactivate account?'}
          onClose={() => setConfirmUser(null)}
        >
          <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            {confirmUser.isActive
              ? `Suspend ${confirmUser.fullName || confirmUser.email}? They will be unable to use the platform until reactivated.`
              : `Reactivate ${confirmUser.fullName || confirmUser.email}?`}
          </p>

          {localError && (
            <div className="admin-banner admin-banner--danger" role="alert">
              {localError}
            </div>
          )}

          <div className="admin-modal-actions">
            <button type="button" className="admin-btn admin-btn-secondary" onClick={() => setConfirmUser(null)}>
              Cancel
            </button>
            <button
              type="button"
              className={`admin-btn ${confirmUser.isActive ? 'admin-btn-danger' : 'admin-btn-primary'}`}
              disabled={updatingId === confirmUser.id}
              onClick={handleConfirmToggle}
            >
              {updatingId === confirmUser.id
                ? 'Updating…'
                : confirmUser.isActive
                ? 'Confirm suspend'
                : 'Confirm reactivate'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
};
