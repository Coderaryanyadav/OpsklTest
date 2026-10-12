import React, { createContext, useContext, useState, useEffect, useMemo, ReactNode } from 'react';
import {
  supabase,
  getCurrentSession,
  signOut as authSignOut,
  signInWithPhoneOtp,
  verifyPhoneOtp,
  fetchUserProfile,
  fetchWorkerProfile,
  fetchOrganizerProfile,
  Profile,
  WorkerProfile,
  OrganizerProfile,
  logger,
} from '@opskil/shared';
import type { User, Session } from '@supabase/supabase-js';

export interface AuthContextValue {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  workerProfile: WorkerProfile | null;
  organizerProfile: OrganizerProfile | null;
  loading: boolean;
  isAuthenticated: boolean;
  sendPhoneOtp: (phone: string) => Promise<any>;
  verifyOtp: (phone: string, token: string) => Promise<any>;
  logout: () => Promise<void>;
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

  const loadUserData = async (currentSession: Session | null) => {
    if (!currentSession?.user) {
      setUser(null);
      setProfile(null);
      setWorkerProfile(null);
      setOrganizerProfile(null);
      setLoading(false);
      return;
    }

    try {
      const u = currentSession.user;
      setUser(u);

      const p = await fetchUserProfile(u.id);
      setProfile(p);

      if (p?.role === 'worker') {
        const wp = await fetchWorkerProfile(u.id);
        setWorkerProfile(wp);
      } else if (p?.role === 'organizer') {
        const op = await fetchOrganizerProfile(u.id);
        setOrganizerProfile(op);
      }
    } catch (err) {
      logger.error('Error loading user profile data in AuthProvider', err);
    } finally {
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

  const sendPhoneOtp = async (phone: string) => {
    return signInWithPhoneOtp({ phone });
  };

  const verifyOtp = async (phone: string, token: string) => {
    const res = await verifyPhoneOtp({ phone, token });
    if (res.session) {
      setSession(res.session);
      await loadUserData(res.session);
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
      workerProfile,
      organizerProfile,
      loading,
      isAuthenticated: !!user,
      sendPhoneOtp,
      verifyOtp,
      logout,
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
