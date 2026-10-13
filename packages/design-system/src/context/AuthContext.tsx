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
  userProfile: Profile | null;
  workerProfile: WorkerProfile | null;
  organizerProfile: OrganizerProfile | null;
  loading: boolean;
  isAuthenticated: boolean;
  sendPhoneOtp: (phone: string) => Promise<any>;
  verifyOtp: (phone: string, token: string) => Promise<any>;
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

      let p = await fetchUserProfile(u.id);
      if (!p && u.id) {
        const defaultRole = (u.user_metadata?.role as any) || 'worker';
        const defaultName = u.user_metadata?.full_name || 'Member';
        const { data: createdProfile } = await supabase
          .from('profiles')
          .insert({
            id: u.id,
            phone: u.phone || '',
            full_name: defaultName,
            role: defaultRole,
            city: 'Mumbai',
            is_active: true,
          })
          .select()
          .maybeSingle();

        if (createdProfile) {
          p = createdProfile as Profile;
        }
      }
      setProfile(p);

      if (p?.role === 'worker') {
        let wp = await fetchWorkerProfile(u.id);
        if (!wp && u.id) {
          const { data: createdWp } = await supabase
            .from('worker_profiles')
            .insert({
              id: u.id,
              preferred_locality: 'Mumbai',
              availability_status: 'available',
              profile_completion_status: 'incomplete',
            })
            .select()
            .maybeSingle();
          if (createdWp) {
            wp = createdWp as WorkerProfile;
          }
        }
        setWorkerProfile(wp);
      } else if (p?.role === 'organizer') {
        let op = await fetchOrganizerProfile(u.id);
        if (!op && u.id) {
          const { data: createdOp } = await supabase
            .from('organizer_profiles')
            .insert({
              id: u.id,
              business_name: 'Independent Events',
              business_contact_phone: u.phone || '',
              business_type: 'independent',
            })
            .select()
            .maybeSingle();
          if (createdOp) {
            op = createdOp as OrganizerProfile;
          }
        }
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
      userProfile: profile,
      workerProfile,
      organizerProfile,
      loading,
      isAuthenticated: !!user,
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
