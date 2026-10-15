import { useEffect } from 'react';
import { useAuth, AuthState, RoleMismatchInfo } from '../context/AuthContext';
import { UserRole, Profile, WorkerProfile, OrganizerProfile } from '@opskil/shared';
import type { User, Session } from '@supabase/supabase-js';

export interface UseRequireAuthOptions {
  requiredRole?: UserRole;
  requireCompleteProfile?: boolean;
  onUnauthenticated?: () => void;
  onRoleMismatch?: (mismatch: RoleMismatchInfo) => void;
  onDeactivated?: () => void;
}

export interface UseRequireAuthResult {
  isAuthenticated: boolean;
  isReady: boolean;
  isLoading: boolean;
  authState: AuthState;
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  workerProfile: WorkerProfile | null;
  organizerProfile: OrganizerProfile | null;
  isDeactivated: boolean;
  roleMismatch: RoleMismatchInfo | null;
  networkError: boolean;
}

/**
 * Reusable hook to enforce authentication and authorization at the component/screen level.
 * Handles role validation, profile completeness checks, and deactivation states.
 */
export function useRequireAuth(options: UseRequireAuthOptions = {}): UseRequireAuthResult {
  const {
    requiredRole,
    requireCompleteProfile = false,
    onUnauthenticated,
    onRoleMismatch,
    onDeactivated,
  } = options;

  const auth = useAuth();
  const {
    authState,
    user,
    session,
    profile,
    workerProfile,
    organizerProfile,
    loading,
    isAuthenticated,
    isDeactivated = false,
    networkError = false,
    roleMismatch = null,
  } = auth;

  const isRoleValid = !requiredRole || (profile?.role === requiredRole || profile?.role === 'admin');
  const isProfileComplete = !requireCompleteProfile || authState === 'READY' || authState === 'VERIFICATION_PENDING';
  const isReady = isAuthenticated && !loading && isRoleValid && isProfileComplete && !isDeactivated;

  useEffect(() => {
    if (loading) return;

    if (!isAuthenticated) {
      onUnauthenticated?.();
      return;
    }

    if (isDeactivated) {
      onDeactivated?.();
      return;
    }

    if (requiredRole && profile && profile.role !== requiredRole && profile.role !== 'admin') {
      onRoleMismatch?.({
        currentRole: profile.role,
        expectedRole: requiredRole,
      });
    }
  }, [loading, isAuthenticated, isDeactivated, profile?.role, requiredRole]);

  return {
    isAuthenticated,
    isReady,
    isLoading: loading,
    authState,
    user,
    session,
    profile,
    workerProfile,
    organizerProfile,
    isDeactivated,
    roleMismatch,
    networkError,
  };
}
