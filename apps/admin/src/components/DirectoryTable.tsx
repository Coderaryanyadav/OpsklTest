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
  onCreateUser?: (userData: any) => Promise<void>;
  onUpdateUser?: (userId: string, updates: any) => Promise<void>;
  onDeleteUser?: (userId: string) => Promise<void>;
  onRefresh: () => void;
  actionError?: string | null;
}

const COMMON_WORKER_SKILLS = [
  'Guest Relations & Hospitality',
  'Registration & Badge Desk',
  'VIP Usher & Protocol',
  'Crowd Management & Flow',
  'Stage & Production Support',
  'Food & Beverage Service',
  'Brand Ambassador',
  'Logistics & Setup',
];

const LOCALITY_OPTIONS = [
  'BKC (Bandra Kurla Complex)',
  'South Mumbai / Colaba',
  'Andheri & Juhu',
  'Lower Parel / Worli',
  'Powai',
  'Navi Mumbai',
  'Thane',
  'Goregaon / NESCO',
];

const BIZ_TYPES = [
  { value: 'event_agency', label: 'Event Agency / Production House' },
  { value: 'corporate', label: 'Corporate Event Organizer' },
  { value: 'venue_manager', label: 'Venue / Convention Manager' },
  { value: 'independent', label: 'Independent Event Planner' },
];

export const DirectoryTable: React.FC<DirectoryTableProps> = ({
  type,
  users,
  onToggleActiveStatus,
  onCreateUser,
  onUpdateUser,
  onDeleteUser,
  onRefresh,
  actionError,
}) => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'verified' | 'unverified' | 'suspended'>('all');

  // Modals state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [inspectUser, setInspectUser] = useState<DirectoryUser | null>(null);
  const [editUser, setEditUser] = useState<DirectoryUser | null>(null);
  const [deleteUser, setDeleteUser] = useState<DirectoryUser | null>(null);
  const [confirmToggleUser, setConfirmToggleUser] = useState<DirectoryUser | null>(null);

  // Form states for Create
  const [createForm, setCreateForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    password: '',
    // Worker fields
    skills: ['Guest Relations & Hospitality'],
    preferredLocality: 'BKC (Bandra Kurla Complex)',
    upiId: '',
    // Organizer fields
    businessName: '',
    businessType: 'event_agency',
    gstin: '',
    // Shared
    verificationStatus: 'unverified' as 'unverified' | 'verified',
  });

  // Form states for Edit
  const [editForm, setEditForm] = useState({
    fullName: '',
    phone: '',
    isActive: true,
    skills: [] as string[],
    preferredLocality: '',
    upiId: '',
    businessName: '',
    businessType: 'event_agency',
    gstin: '',
    verificationStatus: 'unverified',
  });

  const [customSkillInput, setCustomSkillInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

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

  // Copy helper
  const handleCopyId = (id: string) => {
    navigator.clipboard?.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Open Edit modal with initial values
  const handleStartEdit = (user: DirectoryUser) => {
    setEditUser(user);
    setEditForm({
      fullName: user.fullName || '',
      phone: user.phone || '',
      isActive: user.isActive,
      skills: user.skills || [],
      preferredLocality: user.preferredLocality || 'BKC (Bandra Kurla Complex)',
      upiId: user.upiId || '',
      businessName: user.businessName || '',
      businessType: user.businessType || 'event_agency',
      gstin: user.gstin || '',
      verificationStatus: user.verificationStatus || 'unverified',
    });
    setLocalError(null);
  };

  // Submit Create
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onCreateUser) return;
    setIsSubmitting(true);
    setLocalError(null);

    try {
      await onCreateUser({
        ...createForm,
        role: type,
      });
      setIsCreateOpen(false);
      // Reset form
      setCreateForm({
        fullName: '',
        email: '',
        phone: '',
        password: '',
        skills: ['Guest Relations & Hospitality'],
        preferredLocality: 'BKC (Bandra Kurla Complex)',
        upiId: '',
        businessName: '',
        businessType: 'event_agency',
        gstin: '',
        verificationStatus: 'unverified',
      });
    } catch (err: any) {
      setLocalError(err?.message || 'Failed to create user account');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit Edit
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editUser || !onUpdateUser) return;
    setIsSubmitting(true);
    setLocalError(null);

    try {
      await onUpdateUser(editUser.id, {
        ...editForm,
        role: type,
      });
      setEditUser(null);
      if (inspectUser && inspectUser.id === editUser.id) {
        setInspectUser({
          ...inspectUser,
          ...editForm,
        });
      }
    } catch (err: any) {
      setLocalError(err?.message || 'Failed to update user account');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit Delete
  const handleDeleteSubmit = async () => {
    if (!deleteUser || !onDeleteUser) return;
    setIsSubmitting(true);
    setLocalError(null);

    try {
      await onDeleteUser(deleteUser.id);
      setDeleteUser(null);
      if (inspectUser?.id === deleteUser.id) {
        setInspectUser(null);
      }
    } catch (err: any) {
      setLocalError(err?.message || 'Failed to delete user account');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit Suspend / Reactivate Toggle
  const handleConfirmToggle = async () => {
    if (!confirmToggleUser) return;
    setIsSubmitting(true);
    setLocalError(null);

    try {
      await onToggleActiveStatus(confirmToggleUser.id, confirmToggleUser.isActive);
      if (inspectUser && inspectUser.id === confirmToggleUser.id) {
        setInspectUser({
          ...inspectUser,
          isActive: !confirmToggleUser.isActive,
        });
      }
      setConfirmToggleUser(null);
    } catch (err: any) {
      setLocalError(err?.message || 'Failed to update account status');
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleSkill = (skill: string, isCreate: boolean) => {
    if (isCreate) {
      setCreateForm((prev) => ({
        ...prev,
        skills: prev.skills.includes(skill)
          ? prev.skills.filter((s) => s !== skill)
          : [...prev.skills, skill],
      }));
    } else {
      setEditForm((prev) => ({
        ...prev,
        skills: prev.skills.includes(skill)
          ? prev.skills.filter((s) => s !== skill)
          : [...prev.skills, skill],
      }));
    }
  };

  const handleAddCustomSkill = (isCreate: boolean) => {
    const trimmed = customSkillInput.trim();
    if (!trimmed) return;
    if (isCreate) {
      if (!createForm.skills.includes(trimmed)) {
        setCreateForm((prev) => ({ ...prev, skills: [...prev.skills, trimmed] }));
      }
    } else {
      if (!editForm.skills.includes(trimmed)) {
        setEditForm((prev) => ({ ...prev, skills: [...prev.skills, trimmed] }));
      }
    }
    setCustomSkillInput('');
  };

  const displayError = localError || actionError;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Toolbar */}
      <div className="admin-toolbar">
        <div>
          <h2 className="admin-section-title">
            {type === 'worker' ? 'Worker directory' : 'Organizer directory'}
          </h2>
          <p className="admin-section-desc">
            {type === 'worker'
              ? 'Workforce management, KYC statuses, skills, and account controls'
              : 'Registered event agencies, corporate planners, and partner accounts'}
          </p>
        </div>

        <div className="admin-toolbar-actions">
          <input
            type="search"
            className="admin-input admin-input-sm"
            placeholder={`Search ${type}s…`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: 200 }}
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

          <button
            type="button"
            className="admin-btn admin-btn-primary admin-btn-sm"
            onClick={() => {
              setLocalError(null);
              setIsCreateOpen(true);
            }}
          >
            + Add {type === 'worker' ? 'Worker' : 'Organizer'}
          </button>

          <button type="button" className="admin-btn admin-btn-secondary admin-btn-sm" onClick={onRefresh}>
            Refresh
          </button>
        </div>
      </div>

      {displayError && (
        <div className="admin-banner admin-banner--danger" role="alert">
          <span>{displayError}</span>
          <button
            type="button"
            className="admin-btn admin-btn-ghost admin-btn-sm"
            onClick={() => setLocalError(null)}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main Table */}
      <TableShell
        footer={<Pagination page={page} pageCount={pageCount} onChange={setPage} summary={summary} />}
      >
        <table className="admin-table">
          <thead>
            <tr>
              <th>{type === 'worker' ? 'Worker' : 'Agency / Organizer'}</th>
              <th>Contact</th>
              <th>{type === 'worker' ? 'Skills / Locality' : 'Business / GSTIN'}</th>
              <th>KYC Status</th>
              <th>Account</th>
              <th style={{ textAlign: 'right', minWidth: 220 }}>CRUD Actions</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.length === 0 ? (
              <EmptyRow
                colSpan={6}
                title="No accounts found"
                message={`No ${type} accounts match your current query or filter.`}
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
                      <div
                        className="cell-primary"
                        style={{ cursor: 'pointer', textDecoration: 'underline' }}
                        onClick={() => {
                          setLocalError(null);
                          setInspectUser(u);
                        }}
                        title="Click to view full profile details"
                      >
                        {type === 'organizer' && u.businessName
                          ? u.businessName
                          : u.fullName || 'Registered user'}
                      </div>
                      <div className="cell-muted cell-mono">
                        ID {maskId(u.id)}
                        <button
                          type="button"
                          onClick={() => handleCopyId(u.id)}
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            fontSize: 10,
                            marginLeft: 6,
                            color: copiedId === u.id ? 'var(--success-color)' : 'var(--text-secondary)',
                          }}
                        >
                          {copiedId === u.id ? 'Copied' : 'Copy'}
                        </button>
                      </div>
                    </td>

                    <td>
                      <div>{u.email}</div>
                      <div className="cell-muted">{u.phone || 'No phone'}</div>
                    </td>

                    <td>
                      {type === 'worker' ? (
                        <div>
                          <div style={{ fontWeight: 500, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
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

                    {/* CRUD Actions column */}
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                        {/* READ / Inspect */}
                        <button
                          type="button"
                          className="admin-btn admin-btn-secondary admin-btn-sm"
                          onClick={() => {
                            setLocalError(null);
                            setInspectUser(u);
                          }}
                          title="View user details"
                        >
                          View
                        </button>

                        {/* UPDATE / Edit */}
                        <button
                          type="button"
                          className="admin-btn admin-btn-secondary admin-btn-sm"
                          onClick={() => handleStartEdit(u)}
                          title="Edit user details"
                        >
                          Edit
                        </button>

                        {/* SUSPEND / Reactivate */}
                        <button
                          type="button"
                          className={`admin-btn admin-btn-sm ${u.isActive ? 'admin-btn-warning' : 'admin-btn-success'}`}
                          onClick={() => {
                            setLocalError(null);
                            setConfirmToggleUser(u);
                          }}
                          title={u.isActive ? 'Suspend account' : 'Reactivate account'}
                        >
                          {u.isActive ? 'Suspend' : 'Activate'}
                        </button>

                        {/* DELETE */}
                        <button
                          type="button"
                          className="admin-btn admin-btn-danger admin-btn-sm"
                          onClick={() => {
                            setLocalError(null);
                            setDeleteUser(u);
                          }}
                          title="Delete account"
                          style={{ padding: '0 8px' }}
                        >
                          ✕
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </TableShell>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 1. CREATE MODAL (C)                                           */}
      {/* ───────────────────────────────────────────────────────────── */}
      {isCreateOpen && (
        <Modal
          title={`Add New ${type === 'worker' ? 'Worker Profile' : 'Organizer Agency'}`}
          onClose={() => setIsCreateOpen(false)}
          wide
        >
          <form onSubmit={handleCreateSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label className="admin-label">Full Name *</label>
                <input
                  type="text"
                  required
                  className="admin-input"
                  placeholder={type === 'worker' ? 'e.g. Rahul Sharma' : 'e.g. Vikram Singhania'}
                  value={createForm.fullName}
                  onChange={(e) => setCreateForm({ ...createForm, fullName: e.target.value })}
                />
              </div>

              <div>
                <label className="admin-label">Email Address *</label>
                <input
                  type="email"
                  required
                  className="admin-input"
                  placeholder="user@example.com"
                  value={createForm.email}
                  onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                />
              </div>

              <div>
                <label className="admin-label">Phone Number (10 digits) *</label>
                <input
                  type="tel"
                  required
                  className="admin-input"
                  placeholder="9876543210"
                  value={createForm.phone}
                  onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })}
                />
              </div>

              <div>
                <label className="admin-label">Initial Password (Optional)</label>
                <input
                  type="text"
                  className="admin-input"
                  placeholder="Leave empty for auto-generated password"
                  value={createForm.password}
                  onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                />
              </div>
            </div>

            {/* Role-Specific Fields */}
            {type === 'worker' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, borderTop: '1px solid var(--border-color)', paddingTop: 12 }}>
                <div>
                  <label className="admin-label">Preferred Locality</label>
                  <select
                    className="admin-input"
                    value={createForm.preferredLocality}
                    onChange={(e) => setCreateForm({ ...createForm, preferredLocality: e.target.value })}
                  >
                    {LOCALITY_OPTIONS.map((loc) => (
                      <option key={loc} value={loc}>
                        {loc}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="admin-label">UPI ID for Direct Payouts (Optional)</label>
                  <input
                    type="text"
                    className="admin-input"
                    placeholder="worker@okhdfcbank"
                    value={createForm.upiId}
                    onChange={(e) => setCreateForm({ ...createForm, upiId: e.target.value })}
                  />
                </div>

                <div>
                  <label className="admin-label">Select Skills</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                    {COMMON_WORKER_SKILLS.map((skill) => {
                      const selected = createForm.skills.includes(skill);
                      return (
                        <button
                          key={skill}
                          type="button"
                          onClick={() => toggleSkill(skill, true)}
                          style={{
                            padding: '4px 10px',
                            borderRadius: 14,
                            fontSize: 12,
                            cursor: 'pointer',
                            border: '1px solid var(--border-color)',
                            backgroundColor: selected ? 'var(--primary-color)' : 'var(--surface-color)',
                            color: selected ? 'var(--text-inverse)' : 'var(--text-main)',
                          }}
                        >
                          {selected ? '✓ ' : '+ '}
                          {skill}
                        </button>
                      );
                    })}
                  </div>

                  <div style={{ display: 'flex', gap: 8 }}>
                    <input
                      type="text"
                      className="admin-input admin-input-sm"
                      placeholder="Add custom skill…"
                      value={customSkillInput}
                      onChange={(e) => setCustomSkillInput(e.target.value)}
                    />
                    <button
                      type="button"
                      className="admin-btn admin-btn-secondary admin-btn-sm"
                      onClick={() => handleAddCustomSkill(true)}
                    >
                      Add
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, borderTop: '1px solid var(--border-color)', paddingTop: 12 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label className="admin-label">Agency / Business Name *</label>
                    <input
                      type="text"
                      required
                      className="admin-input"
                      placeholder="e.g. Apex Events & Media"
                      value={createForm.businessName}
                      onChange={(e) => setCreateForm({ ...createForm, businessName: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="admin-label">Business Type</label>
                    <select
                      className="admin-input"
                      value={createForm.businessType}
                      onChange={(e) => setCreateForm({ ...createForm, businessType: e.target.value })}
                    >
                      {BIZ_TYPES.map((bt) => (
                        <option key={bt.value} value={bt.value}>
                          {bt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="admin-label">GSTIN (Optional, 15 chars)</label>
                  <input
                    type="text"
                    maxLength={15}
                    className="admin-input cell-mono"
                    placeholder="27ABCDE1234F1Z5"
                    value={createForm.gstin}
                    onChange={(e) => setCreateForm({ ...createForm, gstin: e.target.value.toUpperCase() })}
                  />
                </div>
              </div>
            )}

            {/* KYC Status Pre-approval toggle */}
            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: 12 }}>
              <label className="admin-label">Initial KYC & Verification State</label>
              <select
                className="admin-input"
                value={createForm.verificationStatus}
                onChange={(e) =>
                  setCreateForm({
                    ...createForm,
                    verificationStatus: e.target.value as 'unverified' | 'verified',
                  })
                }
              >
                <option value="unverified">Pending KYC / Unverified (User must submit docs)</option>
                <option value="verified">Verified (Pre-approve immediately for platform access)</option>
              </select>
            </div>

            {localError && (
              <div className="admin-banner admin-banner--danger" role="alert">
                {localError}
              </div>
            )}

            <div className="admin-modal-actions">
              <button
                type="button"
                className="admin-btn admin-btn-secondary"
                disabled={isSubmitting}
                onClick={() => setIsCreateOpen(false)}
              >
                Cancel
              </button>
              <button type="submit" className="admin-btn admin-btn-primary" disabled={isSubmitting}>
                {isSubmitting ? 'Creating account…' : `Create ${type === 'worker' ? 'Worker' : 'Organizer'}`}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 2. READ / INSPECT MODAL (R)                                   */}
      {/* ───────────────────────────────────────────────────────────── */}
      {inspectUser && (
        <Modal
          title={`${type === 'worker' ? 'Worker' : 'Organizer'} Profile Details`}
          onClose={() => setInspectUser(null)}
          wide
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Header info */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>
                  {type === 'organizer' && inspectUser.businessName
                    ? inspectUser.businessName
                    : inspectUser.fullName}
                </h3>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>
                  Role: <strong style={{ textTransform: 'capitalize' }}>{inspectUser.role}</strong> · Joined{' '}
                  {new Date(inspectUser.createdAt).toLocaleDateString()}
                </div>
              </div>

              <div style={{ display: 'flex', gap: 6 }}>
                <StatusPill
                  label={inspectUser.isActive ? 'Active' : 'Suspended'}
                  tone={inspectUser.isActive ? 'neutral' : 'danger'}
                />
                <StatusPill
                  label={
                    inspectUser.verificationStatus === 'verified' || inspectUser.isAadhaarVerified || inspectUser.isGstinVerified
                      ? 'Verified'
                      : 'Pending KYC'
                  }
                  tone={
                    inspectUser.verificationStatus === 'verified' || inspectUser.isAadhaarVerified || inspectUser.isGstinVerified
                      ? 'success'
                      : 'warning'
                  }
                />
              </div>
            </div>

            {/* Profile Data Card */}
            <div className="admin-modal-body-card">
              <div className="admin-modal-row">
                <span>Account ID:</span>
                <span className="cell-mono">
                  {inspectUser.id}
                  <button
                    type="button"
                    onClick={() => handleCopyId(inspectUser.id)}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: 11,
                      marginLeft: 8,
                      color: copiedId === inspectUser.id ? 'var(--success-color)' : 'var(--text-secondary)',
                    }}
                  >
                    {copiedId === inspectUser.id ? 'Copied' : 'Copy ID'}
                  </button>
                </span>
              </div>

              <div className="admin-modal-row">
                <span>Full Name:</span>
                <span style={{ fontWeight: 600 }}>{inspectUser.fullName || '—'}</span>
              </div>

              <div className="admin-modal-row">
                <span>Email Address:</span>
                <span>{inspectUser.email}</span>
              </div>

              <div className="admin-modal-row">
                <span>Contact Phone:</span>
                <span>{inspectUser.phone || 'None provided'}</span>
              </div>

              {type === 'worker' ? (
                <>
                  <div className="admin-modal-row">
                    <span>Preferred Locality:</span>
                    <span>{inspectUser.preferredLocality || 'Not configured'}</span>
                  </div>
                  <div className="admin-modal-row">
                    <span>UPI ID:</span>
                    <span className="cell-mono">{inspectUser.upiId || 'None registered'}</span>
                  </div>
                  <div className="admin-modal-row">
                    <span>Shifts Completed:</span>
                    <span>{inspectUser.shiftsCompleted ?? 0}</span>
                  </div>
                  <div className="admin-modal-row">
                    <span>Aadhaar Verified:</span>
                    <span>{inspectUser.isAadhaarVerified ? 'Yes' : 'No'}</span>
                  </div>
                  <div className="admin-modal-row">
                    <span>PAN Verified:</span>
                    <span>{inspectUser.isPanVerified ? 'Yes' : 'No'}</span>
                  </div>
                  <div style={{ marginTop: 8 }}>
                    <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>Skills Inventory:</span>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                      {inspectUser.skills && inspectUser.skills.length > 0 ? (
                        inspectUser.skills.map((s) => (
                          <span
                            key={s}
                            style={{
                              padding: '2px 8px',
                              borderRadius: 4,
                              background: 'var(--surface-color)',
                              border: '1px solid var(--border-color)',
                              fontSize: 12,
                            }}
                          >
                            {s}
                          </span>
                        ))
                      ) : (
                        <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>No skills listed</span>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="admin-modal-row">
                    <span>Agency / Business Name:</span>
                    <span style={{ fontWeight: 600 }}>{inspectUser.businessName || '—'}</span>
                  </div>
                  <div className="admin-modal-row">
                    <span>Business Type:</span>
                    <span style={{ textTransform: 'capitalize' }}>
                      {(inspectUser.businessType || 'event agency').replace(/_/g, ' ')}
                    </span>
                  </div>
                  <div className="admin-modal-row">
                    <span>GSTIN:</span>
                    <span className="cell-mono">{inspectUser.gstin || 'None on file'}</span>
                  </div>
                  <div className="admin-modal-row">
                    <span>GSTIN Verified:</span>
                    <span>{inspectUser.isGstinVerified ? 'Yes' : 'No'}</span>
                  </div>
                  <div className="admin-modal-row">
                    <span>Total Events Hosted:</span>
                    <span>{inspectUser.totalEventsHosted ?? 0}</span>
                  </div>
                </>
              )}
            </div>

            {/* Quick Actions Footer inside View Modal */}
            <div className="admin-modal-actions" style={{ justifyContent: 'space-between', marginTop: 8 }}>
              <button
                type="button"
                className="admin-btn admin-btn-danger admin-btn-sm"
                onClick={() => {
                  setDeleteUser(inspectUser);
                }}
              >
                Delete Account
              </button>

              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  className={`admin-btn admin-btn-sm ${inspectUser.isActive ? 'admin-btn-warning' : 'admin-btn-success'}`}
                  onClick={() => {
                    setConfirmToggleUser(inspectUser);
                  }}
                >
                  {inspectUser.isActive ? 'Suspend' : 'Activate'}
                </button>
                <button
                  type="button"
                  className="admin-btn admin-btn-primary admin-btn-sm"
                  onClick={() => {
                    handleStartEdit(inspectUser);
                  }}
                >
                  Edit Profile
                </button>
                <button
                  type="button"
                  className="admin-btn admin-btn-secondary admin-btn-sm"
                  onClick={() => setInspectUser(null)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 3. UPDATE / EDIT MODAL (U)                                    */}
      {/* ───────────────────────────────────────────────────────────── */}
      {editUser && (
        <Modal
          title={`Edit ${type === 'worker' ? 'Worker' : 'Organizer'}: ${editUser.fullName || editUser.email}`}
          onClose={() => setEditUser(null)}
          wide
        >
          <form onSubmit={handleEditSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label className="admin-label">Full Name *</label>
                <input
                  type="text"
                  required
                  className="admin-input"
                  value={editForm.fullName}
                  onChange={(e) => setEditForm({ ...editForm, fullName: e.target.value })}
                />
              </div>

              <div>
                <label className="admin-label">Contact Phone</label>
                <input
                  type="tel"
                  className="admin-input"
                  value={editForm.phone}
                  onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                />
              </div>
            </div>

            {type === 'worker' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, borderTop: '1px solid var(--border-color)', paddingTop: 12 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label className="admin-label">Preferred Locality</label>
                    <select
                      className="admin-input"
                      value={editForm.preferredLocality}
                      onChange={(e) => setEditForm({ ...editForm, preferredLocality: e.target.value })}
                    >
                      {LOCALITY_OPTIONS.map((loc) => (
                        <option key={loc} value={loc}>
                          {loc}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="admin-label">UPI ID</label>
                    <input
                      type="text"
                      className="admin-input"
                      value={editForm.upiId}
                      onChange={(e) => setEditForm({ ...editForm, upiId: e.target.value })}
                    />
                  </div>
                </div>

                <div>
                  <label className="admin-label">Skills</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                    {COMMON_WORKER_SKILLS.map((skill) => {
                      const selected = editForm.skills.includes(skill);
                      return (
                        <button
                          key={skill}
                          type="button"
                          onClick={() => toggleSkill(skill, false)}
                          style={{
                            padding: '4px 10px',
                            borderRadius: 14,
                            fontSize: 12,
                            cursor: 'pointer',
                            border: '1px solid var(--border-color)',
                            backgroundColor: selected ? 'var(--primary-color)' : 'var(--surface-color)',
                            color: selected ? 'var(--text-inverse)' : 'var(--text-main)',
                          }}
                        >
                          {selected ? '✓ ' : '+ '}
                          {skill}
                        </button>
                      );
                    })}
                  </div>

                  <div style={{ display: 'flex', gap: 8 }}>
                    <input
                      type="text"
                      className="admin-input admin-input-sm"
                      placeholder="Add custom skill…"
                      value={customSkillInput}
                      onChange={(e) => setCustomSkillInput(e.target.value)}
                    />
                    <button
                      type="button"
                      className="admin-btn admin-btn-secondary admin-btn-sm"
                      onClick={() => handleAddCustomSkill(false)}
                    >
                      Add
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, borderTop: '1px solid var(--border-color)', paddingTop: 12 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label className="admin-label">Agency / Business Name *</label>
                    <input
                      type="text"
                      required
                      className="admin-input"
                      value={editForm.businessName}
                      onChange={(e) => setEditForm({ ...editForm, businessName: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="admin-label">Business Type</label>
                    <select
                      className="admin-input"
                      value={editForm.businessType}
                      onChange={(e) => setEditForm({ ...editForm, businessType: e.target.value })}
                    >
                      {BIZ_TYPES.map((bt) => (
                        <option key={bt.value} value={bt.value}>
                          {bt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="admin-label">GSTIN (15 characters)</label>
                  <input
                    type="text"
                    maxLength={15}
                    className="admin-input cell-mono"
                    value={editForm.gstin}
                    onChange={(e) => setEditForm({ ...editForm, gstin: e.target.value.toUpperCase() })}
                  />
                </div>
              </div>
            )}

            {/* Moderation Controls: KYC & Account Status */}
            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: 12, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label className="admin-label">KYC Verification Status</label>
                <select
                  className="admin-input"
                  value={editForm.verificationStatus}
                  onChange={(e) => setEditForm({ ...editForm, verificationStatus: e.target.value })}
                >
                  <option value="unverified">Unverified</option>
                  <option value="pending">Pending Review</option>
                  <option value="verified">Verified (Approved)</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>

              <div>
                <label className="admin-label">Account Active Status</label>
                <select
                  className="admin-input"
                  value={editForm.isActive ? 'active' : 'suspended'}
                  onChange={(e) => setEditForm({ ...editForm, isActive: e.target.value === 'active' })}
                >
                  <option value="active">Active (Access Allowed)</option>
                  <option value="suspended">Suspended (Access Blocked)</option>
                </select>
              </div>
            </div>

            {localError && (
              <div className="admin-banner admin-banner--danger" role="alert">
                {localError}
              </div>
            )}

            <div className="admin-modal-actions">
              <button
                type="button"
                className="admin-btn admin-btn-secondary"
                disabled={isSubmitting}
                onClick={() => setEditUser(null)}
              >
                Cancel
              </button>
              <button type="submit" className="admin-btn admin-btn-primary" disabled={isSubmitting}>
                {isSubmitting ? 'Saving changes…' : 'Save Changes'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 4. DELETE CONFIRMATION MODAL (D)                             */}
      {/* ───────────────────────────────────────────────────────────── */}
      {deleteUser && (
        <Modal
          title={`Permanently delete ${type === 'worker' ? 'Worker' : 'Organizer'}?`}
          onClose={() => setDeleteUser(null)}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="admin-banner admin-banner--danger" style={{ fontSize: 13 }}>
              ⚠️ <strong>Warning:</strong> You are about to delete account{' '}
              <strong>{deleteUser.fullName || deleteUser.businessName || deleteUser.email}</strong> (
              {maskId(deleteUser.id)}).
            </div>

            <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              If this account has past shifts, bookings, or financial escrow records, it will be safely
              archived and deactivated to prevent breaking payroll and dispute audit records. If it has no
              dependent records, it will be permanently deleted from the database.
            </p>

            {localError && (
              <div className="admin-banner admin-banner--danger" role="alert">
                {localError}
              </div>
            )}

            <div className="admin-modal-actions">
              <button
                type="button"
                className="admin-btn admin-btn-secondary"
                disabled={isSubmitting}
                onClick={() => setDeleteUser(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="admin-btn admin-btn-danger"
                disabled={isSubmitting}
                onClick={handleDeleteSubmit}
              >
                {isSubmitting ? 'Deleting…' : 'Confirm Delete Account'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 5. SUSPEND / REACTIVATE CONFIRMATION MODAL                   */}
      {/* ───────────────────────────────────────────────────────────── */}
      {confirmToggleUser && (
        <Modal
          title={confirmToggleUser.isActive ? 'Suspend account?' : 'Reactivate account?'}
          onClose={() => setConfirmToggleUser(null)}
        >
          <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            {confirmToggleUser.isActive
              ? `Suspend ${confirmToggleUser.fullName || confirmToggleUser.email}? They will be unable to log in or book shifts until reactivated.`
              : `Reactivate ${confirmToggleUser.fullName || confirmToggleUser.email}? Platform access will be restored immediately.`}
          </p>

          {localError && (
            <div className="admin-banner admin-banner--danger" role="alert">
              {localError}
            </div>
          )}

          <div className="admin-modal-actions">
            <button
              type="button"
              className="admin-btn admin-btn-secondary"
              disabled={isSubmitting}
              onClick={() => setConfirmToggleUser(null)}
            >
              Cancel
            </button>
            <button
              type="button"
              className={`admin-btn ${confirmToggleUser.isActive ? 'admin-btn-danger' : 'admin-btn-primary'}`}
              disabled={isSubmitting}
              onClick={handleConfirmToggle}
            >
              {isSubmitting
                ? 'Updating…'
                : confirmToggleUser.isActive
                ? 'Confirm suspend'
                : 'Confirm reactivate'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
};
