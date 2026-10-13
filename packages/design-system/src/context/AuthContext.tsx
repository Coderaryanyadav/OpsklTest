import React, { createContext, useContext, useState, useEffect, useMemo, ReactNode } from 'react';
import {
  supabase,
  getCurrentSession,
  signOut as authSignOut,
  signInWithEmailOtp,
  verifyEmailOtp,
  signInWithPhoneOtp,
  verifyPhoneOtp,
  fetchUserProfile,
  fetchWorkerProfile,
  fetchOrganizerProfile,
  Profile,
  WorkerProfile,
  OrganizerProfile,
  UserRole,
  logger,
} from '@opskil/shared';
import type { User, Session } from '@supabase/supabase-js';

export interface AuthContextValue {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  userProfile: Profile | null;
  workerProfile: WorkerProfile | null;
  organizerProfile: OrganizerProfile | null;
  loading: boolean;
  isAuthenticated: boolean;
  sendEmailOtp: (email: string, role?: UserRole, fullName?: string) => Promise<any>;
  verifyEmailOtp: (email: string, token: string, expectedRole?: UserRole) => Promise<any>;
  sendPhoneOtp: (phone: string) => Promise<any>;
  verifyOtp: (identifier: string, token: string, expectedRole?: UserRole) => Promise<any>;
  logout: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [workerProfile, setWorkerProfile] = useState<WorkerProfile | null>(null);
  const [organizerProfile, setOrganizerProfile] = useState<OrganizerProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const loadingLockRef = React.useRef(false);

  const loadUserData = async (currentSession: Session | null, expectedRole?: UserRole) => {
    if (!currentSession?.user) {
      setUser(null);
      setProfile(null);
      setWorkerProfile(null);
      setOrganizerProfile(null);
      setLoading(false);
      return;
    }

    if (loadingLockRef.current) {
      return;
    }
    loadingLockRef.current = true;

    try {
      const u = currentSession.user;
      setUser(u);

      let p = await fetchUserProfile(u.id);
      if (!p && u.id) {
        const email = u.email || '';
        const defaultRole = (expectedRole || (u.user_metadata?.role as any)) || 'worker';
        const defaultName = u.user_metadata?.full_name || (email ? email.split('@')[0] : 'Member');
        const phone = u.phone || u.user_metadata?.phone || '';

        // Authoritative server-side profile provisioning
        try {
          const { data: rpcRes, error: rpcErr } = await supabase.rpc('ensure_user_profile_provisioned_safe', {
            p_role: defaultRole,
            p_full_name: defaultName,
            p_phone: phone,
            p_email: email,
          });

          if (rpcErr || (rpcRes && rpcRes.success === false)) {
            logger.error('Authoritative profile provisioning RPC rejected — failing closed', rpcErr || rpcRes, { userId: u.id });
            await supabase.auth.signOut();
            setUser(null);
            setProfile(null);
            setWorkerProfile(null);
            setOrganizerProfile(null);
            setLoading(false);
            return;
          }
        } catch (rpcErr) {
          logger.error('Authoritative profile provisioning RPC network/database exception — failing closed', rpcErr, { userId: u.id });
          await supabase.auth.signOut();
          setUser(null);
          setProfile(null);
          setWorkerProfile(null);
          setOrganizerProfile(null);
          setLoading(false);
          return;
        }

        p = await fetchUserProfile(u.id);
      }

      // Fail-closed security rule:
      // An authenticated session MUST have a verified, active database profile record.
      if (!p) {
        logger.error('Authenticated session lacks verified database profile — failing closed', { userId: u.id });
        await supabase.auth.signOut();
        setUser(null);
        setProfile(null);
        setWorkerProfile(null);
        setOrganizerProfile(null);
        setLoading(false);
        return;
      }

      // Deactivated / Purged account enforcement:
      // If user profile is marked inactive (e.g. account deletion requested/completed), reject active session
      if (p.isActive === false) {
        logger.warn('Deactivated account attempted session access — logging out', { userId: u.id });
        await supabase.auth.signOut();
        setUser(null);
        setProfile(null);
        setWorkerProfile(null);
        setOrganizerProfile(null);
        setLoading(false);
        return;
      }

      setProfile(p);

      if (p.role === 'worker') {
        const wp = await fetchWorkerProfile(u.id);
        setWorkerProfile(wp);
      } else if (p.role === 'organizer') {
        const op = await fetchOrganizerProfile(u.id);
        setOrganizerProfile(op);
      }
    } catch (err) {
      logger.error('Error loading user profile data in AuthProvider — failing closed', err);
      await supabase.auth.signOut().catch(() => {});
      setUser(null);
      setProfile(null);
      setWorkerProfile(null);
      setOrganizerProfile(null);
    } finally {
      loadingLockRef.current = false;
      setLoading(false);
    }
  };

  useEffect(() => {
    // 1. Initial Session Restoration
    getCurrentSession().then((sess) => {
      setSession(sess);
      loadUserData(sess);
    });

    // 2. Auth State Transition Listener
    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, currentSession) => {
        setSession(currentSession);
        loadUserData(currentSession);
      }
    );

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  const sendEmailOtp = async (email: string, role?: UserRole, fullName?: string) => {
    return signInWithEmailOtp({ email, role, fullName });
  };

  const verifyEmailOtpMethod = async (email: string, token: string, expectedRole?: UserRole) => {
    const res = await verifyEmailOtp({ email, token, expectedRole });
    if (res.session) {
      setSession(res.session);
      await loadUserData(res.session, expectedRole);
    }
    return res;
  };

  const sendPhoneOtp = async (phone: string) => {
    return signInWithPhoneOtp({ phone });
  };

  const verifyOtp = async (identifier: string, token: string, expectedRole?: UserRole) => {
    let res;
    if (identifier.includes('@')) {
      res = await verifyEmailOtp({ email: identifier, token, expectedRole });
    } else {
      res = await verifyPhoneOtp({ phone: identifier, token });
    }
    if (res.session) {
      setSession(res.session);
      await loadUserData(res.session, expectedRole);
    }
    return res;
  };

  const logout = async () => {
    await authSignOut();
    setSession(null);
    setUser(null);
    setProfile(null);
    setWorkerProfile(null);
    setOrganizerProfile(null);
  };

  const refreshProfile = async () => {
    if (session) {
      await loadUserData(session);
    }
  };

  const value = useMemo(
    () => ({
      user,
      session,
      profile,
      userProfile: profile,
      workerProfile,
      organizerProfile,
      loading,
      isAuthenticated: !!user,
      sendEmailOtp,
      verifyEmailOtp: verifyEmailOtpMethod,
      sendPhoneOtp,
      verifyOtp,
      logout,
      signOut: logout,
      refreshProfile,
    }),
    [user, session, profile, workerProfile, organizerProfile, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
