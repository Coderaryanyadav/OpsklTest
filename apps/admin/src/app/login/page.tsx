'use client';

import React, { useState } from 'react';
import { logger } from '@opskil/shared';
import { adminSupabase } from '../../lib/supabase';

export default function AdminLoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const err = params.get('error');
      if (err === 'missing_configuration') {
        setErrorMsg('Configuration error: Live administrative backend credentials are not configured.');
      } else if (err === 'unauthorized_role') {
        setErrorMsg('Access denied: Active administrator credentials required for this portal.');
      }

      adminSupabase.auth
        .getSession()
        .then(({ error }) => {
          if (error) {
            adminSupabase.auth.signOut({ scope: 'local' }).catch(() => {});
          }
        })
        .catch(() => {
          adminSupabase.auth.signOut({ scope: 'local' }).catch(() => {});
        });
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setErrorMsg('Please enter both administrative email and password.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      logger.info('Admin login attempt', { email });
      const { data: authData, error: authError } = await adminSupabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        throw authError;
      }

      if (authData?.session) {
        const { data: profile, error: profError } = await adminSupabase
          .from('profiles')
          .select('role, is_active')
          .eq('id', authData.session.user.id)
          .maybeSingle();

        if (profError || !profile || profile.role !== 'admin' || !profile.is_active) {
          await adminSupabase.auth.signOut();
          setErrorMsg('Access denied: Active administrator credentials required for this portal.');
          return;
        }

        const params = new URLSearchParams(window.location.search);
        const rawRedirect = params.get('redirect') || '/';
        // Only allow same-origin absolute paths; never protocol-relative or external URLs.
        const redirectUrl =
          rawRedirect.startsWith('/') &&
          !rawRedirect.startsWith('//') &&
          !rawRedirect.includes('\\')
            ? rawRedirect
            : '/';
        window.location.href = redirectUrl;
      } else {
        setErrorMsg('Authentication succeeded but no active session was returned.');
      }
    } catch (err: any) {
      setErrorMsg(
        err?.message ||
          'Authentication failed. Please verify administrative credentials in Supabase Auth.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-login-page">
      <div className="admin-login-card">
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div className="admin-login-brand">O</div>
          <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.3px' }}>Opskl Admin</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 6 }}>
            Restricted access for platform administrators
          </p>
        </div>

        {errorMsg && (
          <div className="admin-banner admin-banner--danger" role="alert" style={{ marginBottom: 20 }}>
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label className="admin-label" htmlFor="admin-email">
              Admin email
            </label>
            <input
              id="admin-email"
              className="admin-input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@opskil.com"
              required
              autoComplete="username"
            />
          </div>

          <div>
            <label className="admin-label" htmlFor="admin-password">
              Password
            </label>
            <input
              id="admin-password"
              className="admin-input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              required
              autoComplete="current-password"
            />
          </div>

          <button type="submit" className="admin-btn admin-btn-primary" disabled={loading} style={{ marginTop: 8 }}>
            {loading ? 'Authenticating…' : 'Sign in'}
          </button>

          <p className="admin-login-note">Admin access only</p>
        </form>
      </div>
    </div>
  );
};
