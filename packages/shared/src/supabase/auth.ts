import { supabase } from './client';
import { logger } from '../utils/logger';
import { UserRole } from '../types';

export interface PhoneSignInParams {
  phone: string; // e.g. "9820098200" or "+919820098200"
}

export interface VerifyOtpParams {
  phone: string;
  token: string; // 6-digit OTP
}

export interface EmailAuthParams {
  email: string;
  password: string;
}

export interface SignUpParams extends EmailAuthParams {
  role: UserRole;
  fullName: string;
  phone: string;
}

function normalizeIndianPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  const last10 = digits.slice(-10);
  return `+91${last10}`;
}

export interface EmailOtpSignInParams {
  email: string;
  role?: UserRole;
  fullName?: string;
}

export interface VerifyEmailOtpParams {
  email: string;
  token: string;
  expectedRole?: UserRole;
}

/**
 * Sign in / send 6-digit OTP to Email (Gmail) address with role-aware onboarding metadata.
 */
export async function signInWithEmailOtp({ email, role, fullName }: EmailOtpSignInParams) {
  const normalizedEmail = email.trim().toLowerCase();
  logger.info('Initiating Email/Gmail OTP sign-in', { email: normalizedEmail, role });

  const metadata: Record<string, any> = {};
  if (role) {
    metadata.role = role;
  }
  if (fullName) {
    metadata.full_name = fullName;
  }

  const { data, error } = await supabase.auth.signInWithOtp({
    email: normalizedEmail,
    options: {
      shouldCreateUser: true,
      data: metadata,
    },
  });

  if (error) {
    logger.error('Failed to send email OTP', error, { email: normalizedEmail });
    throw error;
  }

  return data;
}

/**
 * Verify 6-digit OTP token for Email (Gmail) address.
 * Sanitizes input and gracefully handles both 'email' (login) and 'signup' (first-time registration) GoTrue OTP types.
 */
export async function verifyEmailOtp({ email, token }: VerifyEmailOtpParams) {
  const normalizedEmail = email.trim().toLowerCase();
  const cleanToken = token.replace(/\D/g, '').trim();
  logger.info('Verifying Email/Gmail OTP token', { email: normalizedEmail });

  // 1. Attempt standard email sign-in OTP verification
  let { data, error } = await supabase.auth.verifyOtp({
    email: normalizedEmail,
    token: cleanToken,
    type: 'email',
  });

  // 2. If rejected, fallback to 'signup' OTP type for newly registered unconfirmed accounts
  if (error) {
    try {
      const signupAttempt = await supabase.auth.verifyOtp({
        email: normalizedEmail,
        token: cleanToken,
        type: 'signup',
      });

      if (signupAttempt && !signupAttempt.error && signupAttempt.data) {
        data = signupAttempt.data;
        error = null;
      }
    } catch {
      // Keep original error
    }
  }

  // 3. If still rejected, fallback to 'magiclink' OTP type for email-based magic link/OTP templates
  if (error) {
    try {
      const magicLinkAttempt = await supabase.auth.verifyOtp({
        email: normalizedEmail,
        token: cleanToken,
        type: 'magiclink',
      });

      if (magicLinkAttempt && !magicLinkAttempt.error && magicLinkAttempt.data) {
        data = magicLinkAttempt.data;
        error = null;
      }
    } catch {
      // Keep original error
    }
  }

  if (error) {
    logger.error('Email OTP verification failed', error, { email: normalizedEmail });
    throw error;
  }

  return data;
}

/**
 * Sign in / send 6-digit OTP to Indian mobile number.
 */
export async function signInWithPhoneOtp({ phone }: PhoneSignInParams) {
  const formattedPhone = normalizeIndianPhone(phone);
  logger.info('Initiating Phone OTP sign-in', { phone: formattedPhone });

  const { data, error } = await supabase.auth.signInWithOtp({
    phone: formattedPhone,
  });

  if (error) {
    logger.error('Failed to send phone OTP', error, { phone: formattedPhone });
    throw error;
  }

  return data;
}

/**
 * Verify 6-digit OTP token for phone number.
 */
export async function verifyPhoneOtp({ phone, token }: VerifyOtpParams) {
  const formattedPhone = normalizeIndianPhone(phone);
  logger.info('Verifying Phone OTP token');

  const { data, error } = await supabase.auth.verifyOtp({
    phone: formattedPhone,
    token: token.trim(),
    type: 'sms',
  });

  if (error) {
    logger.error('Phone OTP verification failed', error);
    throw error;
  }

  return data;
}

/**
 * Sign in using email & password (used for Admin Portal & Corporate Organizers).
 */
export async function signInWithEmailPassword({ email, password }: EmailAuthParams) {
  logger.info('Initiating Email Password sign-in', { email });

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    logger.error('Email sign-in failed', error, { email });
    throw error;
  }

  return data;
}

/**
 * Sign up new user with role metadata.
 */
export async function signUpWithEmailPassword({
  email,
  password,
  role,
  fullName,
  phone,
}: SignUpParams) {
  logger.info('Initiating Sign-up', { email, role });

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        role,
        full_name: fullName,
        phone: normalizeIndianPhone(phone),
      },
    },
  });

  if (error) {
    logger.error('Sign-up failed', error, { email });
    throw error;
  }

  return data;
}

/**
 * Sign out current session and clear stored tokens.
 */
export async function signOut() {
  logger.info('Signing out current session');
  const { error } = await supabase.auth.signOut();
  if (error) {
    logger.error('Error during signOut', error);
    throw error;
  }
}

/**
 * Restore current session on app boot.
 */
export async function getCurrentSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    logger.error('Failed to retrieve current session', error);
    return null;
  }
  return data.session;
}

/**
 * Get current authenticated user.
 */
export async function getCurrentUser() {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    return null;
  }
  return data.user;
}

/**
 * Listen to auth state changes across the application.
 */
export function onAuthStateChange(
  callback: (event: string, session: any) => void
) {
  const { data } = supabase.auth.onAuthStateChange((event, session) => {
    logger.info(`Auth state transition: ${event}`, { userId: session?.user?.id });
    callback(event, session);
  });
  return data.subscription;
}

/**
 * Sign in / Register with Google OAuth
 */
export async function signInWithGoogleOAuth(role?: UserRole, redirectTo?: string) {
  logger.info('Initiating Google OAuth sign-in', { role, redirectTo });
  
  const options: Record<string, any> = {};
  if (redirectTo) {
    options.redirectTo = redirectTo;
  }
  if (role) {
    options.queryParams = { role };
  }

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options,
  });

  if (error) {
    logger.error('Google OAuth initialization failed', error);
    throw error;
  }

  return data;
}

/**
 * Send password reset email
 */
export async function sendPasswordResetEmail(email: string, redirectTo?: string) {
  const normalizedEmail = email.trim().toLowerCase();
  logger.info('Sending password reset email', { email: normalizedEmail });

  const { data, error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
    redirectTo,
  });

  if (error) {
    logger.error('Password reset email failed', error, { email: normalizedEmail });
    throw error;
  }

  return data;
}

/**
 * Update user password (used after reset)
 */
export async function updateUserPassword(newPassword: string) {
  logger.info('Updating user password');

  const { data, error } = await supabase.auth.updateUser({
    password: newPassword,
  });

  if (error) {
    logger.error('Password update failed', error);
    throw error;
  }

  return data;
}

/**
 * Resend sign-up verification email
 */
export async function resendVerificationEmail(email: string) {
  const normalizedEmail = email.trim().toLowerCase();
  logger.info('Resending signup verification email', { email: normalizedEmail });

  const { data, error } = await supabase.auth.resend({
    type: 'signup',
    email: normalizedEmail,
  });

  if (error) {
    logger.error('Resending verification email failed', error, { email: normalizedEmail });
    throw error;
  }

  return data;
}

/**
 * Parse and exchange deep-link or redirect code for active session
 */
export async function exchangeCodeForSession(url: string) {
  logger.info('Exchanging OAuth/Auth code for session', { url: url.split('?')[0] });

  // If URL has authorization code parameter
  if (url.includes('code=')) {
    const codeMatch = url.match(/[?&]code=([^&#]+)/);
    if (codeMatch && codeMatch[1]) {
      const code = decodeURIComponent(codeMatch[1]);
      const { data, error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) {
        logger.error('Failed to exchange code for session', error);
        throw error;
      }
      return data;
    }
  }

  // If URL has hash parameters (#access_token=...&refresh_token=...)
  if (url.includes('access_token=')) {
    const accessMatch = url.match(/[#&]access_token=([^&#]+)/);
    const refreshMatch = url.match(/[#&]refresh_token=([^&#]+)/);
    if (accessMatch && refreshMatch) {
      const { data, error } = await supabase.auth.setSession({
        access_token: decodeURIComponent(accessMatch[1]),
        refresh_token: decodeURIComponent(refreshMatch[1]),
      });
      if (error) {
        logger.error('Failed to set session from URL hash tokens', error);
        throw error;
      }
      return data;
    }
  }

  return null;
}
