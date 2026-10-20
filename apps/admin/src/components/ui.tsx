'use client';

import React, { useEffect, useMemo, useState } from 'react';

export type StatusTone = 'success' | 'warning' | 'danger' | 'neutral' | 'info';

/** Status never by color alone — always includes text label. */
export function StatusPill({
  label,
  tone = 'neutral',
  showDot = true,
}: {
  label: string;
  tone?: StatusTone;
  showDot?: boolean;
}) {
  return (
    <span className={`admin-status admin-status--${tone}`}>
      {showDot && <span className="admin-status-dot" aria-hidden="true" />}
      {label}
    </span>
  );
}

export function Pagination({
  page,
  pageCount,
  onChange,
  summary,
}: {
  page: number;
  pageCount: number;
  onChange: (page: number) => void;
  summary?: string;
}) {
  if (pageCount <= 1 && !summary) return null;

  return (
    <div className="admin-pagination">
      <div className="admin-pagination-summary">{summary || `Page ${page} of ${pageCount}`}</div>
      <div className="admin-pagination-controls">
        <button
          type="button"
          className="admin-btn admin-btn-secondary admin-btn-sm"
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
          aria-label="Previous page"
        >
          Previous
        </button>
        <button
          type="button"
          className="admin-btn admin-btn-secondary admin-btn-sm"
          disabled={page >= pageCount}
          onClick={() => onChange(page + 1)}
          aria-label="Next page"
        >
          Next
        </button>
      </div>
    </div>
  );
}

export function EmptyRow({ colSpan, title, message }: { colSpan: number; title?: string; message: string }) {
  return (
    <tr>
      <td colSpan={colSpan}>
        <div className="admin-empty">
          {title && <div className="admin-empty-title">{title}</div>}
          <div>{message}</div>
        </div>
      </td>
    </tr>
  );
}

export function TableShell({
  children,
  footer,
}: {
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="admin-table-wrap">
      <div className="admin-table-scroll">{children}</div>
      {footer}
    </div>
  );
}

export function useClientPagination<T>(rows: T[], pageSize = 10) {
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [rows, pageSize]);

  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const safePage = Math.min(page, pageCount);

  const pageRows = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return rows.slice(start, start + pageSize);
  }, [rows, safePage, pageSize]);

  const summary =
    rows.length === 0
      ? '0 results'
      : `Showing ${(safePage - 1) * pageSize + 1}–${Math.min(safePage * pageSize, rows.length)} of ${rows.length}`;

  return {
    page: safePage,
    pageCount,
    pageRows,
    setPage,
    summary,
  };
}

/** Mask IDs for display — show last 4 chars only when long enough. */
export function maskId(value: string | null | undefined, visible = 4): string {
  if (!value) return '—';
  const s = String(value);
  if (s.length <= visible) return `••••${s}`;
  return `••••${s.slice(-visible)}`;
}

/** Partially mask UPI (keep handle domain hint if present). */
export function maskUpi(upi: string | null | undefined): string {
  if (!upi) return '—';
  const at = upi.indexOf('@');
  if (at <= 0) return maskId(upi, 3);
  const local = upi.slice(0, at);
  const domain = upi.slice(at);
  if (local.length <= 2) return `••${domain}`;
  return `${local.slice(0, 2)}••••${domain}`;
}

export function Modal({
  title,
  onClose,
  children,
  wide,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div
      className="admin-modal-backdrop"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="admin-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-modal-title"
        style={wide ? { maxWidth: 640 } : undefined}
      >
        <div className="admin-modal-header">
          <h2 id="admin-modal-title" className="admin-modal-title">
            {title}
          </h2>
          <button type="button" className="admin-btn admin-btn-ghost" onClick={onClose} aria-label="Close dialog">
            Close
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string; count?: number }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="admin-segment" role="group">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          aria-pressed={value === opt.value}
          className={value === opt.value ? 'is-active' : undefined}
          onClick={() => onChange(opt.value)}
        >
          <span>{opt.label}</span>
          {opt.count !== undefined && <span className="admin-segment-count">{opt.count}</span>}
        </button>
      ))}
    </div>
  );
}
