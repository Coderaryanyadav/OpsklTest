import React, { createContext, useContext, useState, useEffect, useMemo, ReactNode } from 'react';
import {
  supabase,
  getCurrentSession,
  signOut as authSignOut,
  signInWithEmailOtp,
  verifyEmailOtp,
  signInWithPhoneOtp,
  verifyPhoneOtp,
  signInWithEmailPassword,
  signUpWithEmailPassword,
  signInWithGoogleOAuth,
  sendPasswordResetEmail,
  resendVerificationEmail,
  exchangeCodeForSession,
  fetchUserProfile,
  fetchWorkerProfile,
  fetchOrganizerProfile,
  cancelAccountDeletionSafe,
  Profile,
  WorkerProfile,
  OrganizerProfile,
  UserRole,
  SignUpParams,
  logger,
  isSupabaseConfigured,
} from '@opskil/shared';
import type { User, Session } from '@supabase/supabase-js';

export type AuthState =
  | 'INITIALIZING'
  | 'CONFIGURATION_ERROR'
  | 'SIGNED_OUT'
  | 'AUTHENTICATED_PROFILE_INCOMPLETE'
  | 'AUTHENTICATED_PROFILE_COMPLETE'
  | 'VERIFICATION_PENDING'
  | 'VERIFICATION_ACTION_REQUIRED'
  | 'DEACTIVATED'
  | 'ROLE_MISMATCH'
  | 'READY';

export interface RoleMismatchInfo {
  currentRole: UserRole;
  expectedRole: UserRole;
}

export interface AuthContextValue {
  authState: AuthState;
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  userProfile: Profile | null;
  workerProfile: WorkerProfile | null;
  organizerProfile: OrganizerProfile | null;
  loading: boolean;
  isAuthenticated: boolean;
  isDeactivated?: boolean;
  networkError?: boolean;
  roleMismatch?: RoleMismatchInfo | null;
  sendEmailOtp: (email: string, role?: UserRole, fullName?: string) => Promise<any>;
  verifyEmailOtp: (email: string, token: string, expectedRole?: UserRole) => Promise<any>;
  sendPhoneOtp: (phone: string) => Promise<any>;
  verifyOtp: (identifier: string, token: string, expectedRole?: UserRole) => Promise<any>;
  signInWithPassword: (email: string, password: string, expectedRole?: UserRole) => Promise<any>;
  signUpWithPassword: (params: { email: string; password: string; role: UserRole; fullName: string; phone: string }) => Promise<any>;
  signInWithGoogle: (role?: UserRole, redirectTo?: string) => Promise<any>;
  sendPasswordReset: (email: string, redirectTo?: string) => Promise<any>;
  resendVerification: (email: string) => Promise<any>;
  handleAuthUrl: (url: string) => Promise<any>;
  logout: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  cancelAccountDeletion: () => Promise<{ success: boolean; error?: string }>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export interface AuthProviderProps {
  children: ReactNode;
  expectedRole?: UserRole;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children, expectedRole: defaultExpectedRole }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [workerProfile, setWorkerProfile] = useState<WorkerProfile | null>(null);
  const [organizerProfile, setOrganizerProfile] = useState<OrganizerProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [networkError, setNetworkError] = useState<boolean>(false);
  const [isDeactivated, setIsDeactivated] = useState<boolean>(false);
  const [roleMismatch, setRoleMismatch] = useState<RoleMismatchInfo | null>(null);

  const loadingLockRef = React.useRef(false);
  const requestIdRef = React.useRef(0);
  const pendingRequestRef = React.useRef<{ session: Session | null; expectedRole?: UserRole } | null>(null);

  const loadUserData = async (currentSession: Session | null, expectedRoleOverride?: UserRole) => {
    const activeExpectedRole = expectedRoleOverride || defaultExpectedRole;

    if (!currentSession?.user) {
      requestIdRef.current += 1;
      setUser(null);
      setProfile(null);
      setWorkerProfile(null);
      setOrganizerProfile(null);
      setIsDeactivated(false);
      setRoleMismatch(null);
      setNetworkError(false);
      setLoading(false);
      return;
    }

    if (loadingLockRef.current) {
      pendingRequestRef.current = { session: currentSession, expectedRole: activeExpectedRole };
      return;
    }

    loadingLockRef.current = true;
    const thisRequestId = ++requestIdRef.current;

    try {
      const u = currentSession.user;
      setUser(u);

      let p: Profile | null = null;
      let networkErrOccurred = false;

      try {
        p = await fetchUserProfile(u.id);
      } catch (err: any) {
        logger.warn('Network error loading profile, retaining session without logout', err, { userId: u.id });
        networkErrOccurred = true;
      }

      if (networkErrOccurred) {
        if (thisRequestId === requestIdRef.current) {
          setNetworkError(true);
          setLoading(false);
        }
        return;
      }
      setNetworkError(false);

      if (!p && u.id) {
        const email = u.email || '';
        const targetRole = (activeExpectedRole || (u.user_metadata?.role as any)) || 'worker';
        const defaultName = u.user_metadata?.full_name || (email ? email.split('@')[0] : 'Member');
        const phone = u.phone || u.user_metadata?.phone || '';

        try {
          const { data: rpcRes, error: rpcErr } = await supabase.rpc('ensure_user_profile_provisioned_safe', {
            p_role: targetRole,
            p_full_name: defaultName,
            p_phone: phone,
            p_email: email,
          });

          if (rpcErr || (rpcRes && rpcRes.success === false)) {
            logger.error('Authoritative profile provisioning RPC rejected', rpcErr || rpcRes, { userId: u.id });
          } else {
            p = await fetchUserProfile(u.id).catch(() => null);
          }
        } catch (rpcErr) {
          logger.error('Authoritative profile provisioning RPC network exception', rpcErr, { userId: u.id });
        }
      }

      if (thisRequestId !== requestIdRef.current) {
        return;
      }

      if (!p) {
        // Authenticated user exists in auth.users but has no profiles row yet
        setProfile(null);
        setWorkerProfile(null);
        setOrganizerProfile(null);
        setIsDeactivated(false);
        setRoleMismatch(null);
        return;
      }

      if (p.isActive === false) {
        logger.warn('Deactivated account detected', { userId: u.id });
        setProfile(p);
        setIsDeactivated(true);
        setRoleMismatch(null);
        return;
      }
      setIsDeactivated(false);

      // Check role mismatch against app container expectations
      if (activeExpectedRole && p.role !== activeExpectedRole && p.role !== 'admin') {
        setRoleMismatch({ currentRole: p.role, expectedRole: activeExpectedRole });
      } else {
        setRoleMismatch(null);
      }

      setProfile(p);

      if (p.role === 'worker') {
        const wp = await fetchWorkerProfile(u.id);
        if (thisRequestId === requestIdRef.current) {
          setWorkerProfile(wp);
          setOrganizerProfile(null);
        }
      } else if (p.role === 'organizer') {
        const op = await fetchOrganizerProfile(u.id);
        if (thisRequestId === requestIdRef.current) {
          setOrganizerProfile(op);
          setWorkerProfile(null);
        }
      }
    } catch (err) {
      logger.error('Unexpected error loading user profile in AuthProvider', err);
    } finally {
      loadingLockRef.current = false;
      setLoading(false);

      if (pendingRequestRef.current) {
        const next = pendingRequestRef.current;
        pendingRequestRef.current = null;
        loadUserData(next.session, next.expectedRole);
      }
    }
  };

  useEffect(() => {
    getCurrentSession().then((sess) => {
      setSession(sess);
      loadUserData(sess);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, currentSession) => {
        setSession(currentSession);
        loadUserData(currentSession);
      }
    );

    return () => {
      listener.subscription.unsubscribe();
    };
  }, [defaultExpectedRole]);

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

  const signInWithPassword = async (email: string, password: string, expectedRole?: UserRole) => {
    const res = await signInWithEmailPassword({ email: email.trim().toLowerCase(), password });
    if (res?.session) {
      setSession(res.session);
      await loadUserData(res.session, expectedRole);
    }
    return res;
  };

  const signUpWithPassword = async (params: SignUpParams) => {
    const res = await signUpWithEmailPassword({
      ...params,
      email: params.email.trim().toLowerCase(),
    });
    if (res?.session) {
      setSession(res.session);
      await loadUserData(res.session, params.role);
    }
    return res;
  };

  const signInWithGoogle = async (role?: UserRole, redirectTo?: string) => {
    return signInWithGoogleOAuth(role, redirectTo);
  };

  const sendPasswordReset = async (email: string, redirectTo?: string) => {
    return sendPasswordResetEmail(email, redirectTo);
  };

  const resendVerification = async (email: string) => {
    return resendVerificationEmail(email);
  };

  const handleAuthUrl = async (url: string) => {
    const res = await exchangeCodeForSession(url);
    if (res?.session) {
      setSession(res.session);
      await loadUserData(res.session);
    }
    return res;
  };

  const logout = async () => {
    try {
      await authSignOut();
    } catch (e: any) {
      logger.warn('signOut threw error during logout', { error: e?.message || String(e) });
    }
    setSession(null);
    setUser(null);
    setProfile(null);
    setWorkerProfile(null);
    setOrganizerProfile(null);
    setIsDeactivated(false);
    setRoleMismatch(null);
    setNetworkError(false);
  };

  const refreshProfile = async () => {
    if (session) {
      await loadUserData(session);
    }
  };

  const cancelAccountDeletion = async () => {
    const res = await cancelAccountDeletionSafe();
    if (res.success) {
      setIsDeactivated(false);
      await refreshProfile();
    }
    return res;
  };

  const authState = useMemo<AuthState>(() => {
    if (loading) return 'INITIALIZING';
    if (!isSupabaseConfigured) return 'CONFIGURATION_ERROR';
    if (!session || !user) return 'SIGNED_OUT';
    if (isDeactivated) return 'DEACTIVATED';
    if (roleMismatch) return 'ROLE_MISMATCH';
    if (!profile) return 'AUTHENTICATED_PROFILE_INCOMPLETE';

    if (profile.role === 'worker') {
      if (!workerProfile || workerProfile.profileCompletionStatus !== 'completed') {
        return 'AUTHENTICATED_PROFILE_INCOMPLETE';
      }
      if (workerProfile.verificationStatus === 'pending') {
        return 'VERIFICATION_PENDING';
      }
      if (workerProfile.verificationStatus === 'rejected') {
        return 'VERIFICATION_ACTION_REQUIRED';
      }
      return 'READY';
    }

    if (profile.role === 'organizer') {
      if (!organizerProfile || organizerProfile.profileCompletionStatus !== 'completed') {
        return 'AUTHENTICATED_PROFILE_INCOMPLETE';
      }
      if (organizerProfile.verificationStatus === 'pending') {
        return 'VERIFICATION_PENDING';
      }
      if (organizerProfile.verificationStatus === 'rejected') {
        return 'VERIFICATION_ACTION_REQUIRED';
      }
      return 'READY';
    }

    return 'READY';
  }, [loading, session, user, profile, workerProfile, organizerProfile, isDeactivated, roleMismatch]);

  const value = useMemo(
    () => ({
      authState,
      user,
      session,
      profile,
      userProfile: profile,
      workerProfile,
      organizerProfile,
      loading,
      isAuthenticated: !!user,
      isDeactivated,
      networkError,
      roleMismatch,
      sendEmailOtp,
      verifyEmailOtp: verifyEmailOtpMethod,
      sendPhoneOtp,
      verifyOtp,
      signInWithPassword,
      signUpWithPassword,
      signInWithGoogle,
      sendPasswordReset,
      resendVerification,
      handleAuthUrl,
      logout,
      signOut: logout,
      refreshProfile,
      cancelAccountDeletion,
    }),
    [authState, user, session, profile, workerProfile, organizerProfile, loading, isDeactivated, networkError, roleMismatch]
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
