'use client';

import React from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

export interface BreadcrumbItem {
  label: string;
  href?: string;
  onClick?: () => void;
}

export interface AdminBreadcrumbsProps {
  items: BreadcrumbItem[];
  className?: string;
}

export const AdminBreadcrumbs: React.FC<AdminBreadcrumbsProps> = ({ items, className = '' }) => {
  if (!items || items.length === 0) return null;

  return (
    <nav aria-label="Breadcrumb" className={`admin-breadcrumbs ${className}`} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
      <ol style={{ display: 'flex', alignItems: 'center', listStyle: 'none', margin: 0, padding: 0, flexWrap: 'wrap', gap: 6 }}>
        {items.map((item, index) => {
          const isLast = index === items.length - 1;

          return (
            <li key={`crumb-${index}`} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, lineHeight: '18px' }}>
              {index > 0 && (
                <ChevronRight size={13} style={{ color: '#94A3B8', flexShrink: 0 }} aria-hidden="true" />
              )}
              {isLast || (!item.href && !item.onClick) ? (
                <span
                  style={{
                    fontWeight: isLast ? 600 : 500,
                    color: isLast ? '#0F1115' : '#64748B',
                    letterSpacing: '-0.01em',
                  }}
                  aria-current={isLast ? 'page' : undefined}
                >
                  {item.label}
                </span>
              ) : item.href ? (
                <Link
                  href={item.href}
                  style={{
                    color: '#64748B',
                    textDecoration: 'none',
                    fontWeight: 500,
                    transition: 'color 0.15s ease',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = '#0F52BA')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = '#64748B')}
                >
                  {item.label}
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={item.onClick}
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    color: '#64748B',
                    cursor: 'pointer',
                    fontWeight: 500,
                    fontSize: 13,
                    transition: 'color 0.15s ease',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = '#0F52BA')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = '#64748B')}
                >
                  {item.label}
                </button>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
};
