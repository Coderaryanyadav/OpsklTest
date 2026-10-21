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

export const OTP_COOLDOWN_SECONDS = 30;
export const MAX_OTP_FAILED_ATTEMPTS = 5;

const otpDispatchTimestamps = new Map<string, number>();
const otpFailedAttempts = new Map<string, number>();

export type AuthErrorKind =
  | 'network'
  | 'invalid_credentials'
  | 'unverified_account'
  | 'expired_session'
  | 'rate_limited'
  | 'account_deactivated'
  | 'unknown';

export interface ClassifiedAuthError {
  kind: AuthErrorKind;
  message: string;
  originalError?: any;
}

export function classifyAuthError(error: any): ClassifiedAuthError {
  if (!error) {
    return { kind: 'unknown', message: 'An unknown error occurred.' };
  }

  const rawMsg = (typeof error === 'string' ? error : error?.message || error?.error_description || String(error)).toLowerCase();

  // 1. Network / connectivity errors
  if (
    rawMsg.includes('network') ||
    rawMsg.includes('failed to fetch') ||
    rawMsg.includes('fetch failed') ||
    rawMsg.includes('timeout') ||
    rawMsg.includes('econnrefused') ||
    rawMsg.includes('internet connection') ||
    error?.status === 0
  ) {
    return {
      kind: 'network',
      message: 'Network connection issue. Please check your internet connection and try again.',
      originalError: error,
    };
  }

  // 2. Rate limit / abuse protection
  if (
    rawMsg.includes('rate limit') ||
    rawMsg.includes('too many requests') ||
    rawMsg.includes('over_email_send_rate_limit') ||
    rawMsg.includes('over_sms_send_rate_limit') ||
    error?.status === 429
  ) {
    return {
      kind: 'rate_limited',
      message: 'Too many requests. Please wait a moment before trying again.',
      originalError: error,
    };
  }

  // 3. Unverified account
  if (
    rawMsg.includes('email not confirmed') ||
    rawMsg.includes('phone not confirmed') ||
    rawMsg.includes('unconfirmed') ||
    rawMsg.includes('confirmation required')
  ) {
    return {
      kind: 'unverified_account',
      message: 'Your account is not verified yet. Please check your email/SMS for verification instructions.',
      originalError: error,
    };
  }

  // 4. Expired session
  if (
    rawMsg.includes('jwt expired') ||
    rawMsg.includes('session expired') ||
    rawMsg.includes('token is expired') ||
    rawMsg.includes('invalid claim')
  ) {
    return {
      kind: 'expired_session',
      message: 'Your session has expired. Please sign in again.',
      originalError: error,
    };
  }

  // 5. Account deactivated
  if (
    rawMsg.includes('deactivated') ||
    rawMsg.includes('banned') ||
    rawMsg.includes('suspended') ||
    rawMsg.includes('scheduled for deletion')
  ) {
    return {
      kind: 'account_deactivated',
      message: 'This account has been deactivated or suspended.',
      originalError: error,
    };
  }

  // 6. Invalid credentials / OTP
  if (
    rawMsg.includes('invalid login credentials') ||
    rawMsg.includes('invalid grant') ||
    rawMsg.includes('invalid otp') ||
    rawMsg.includes('token has expired or is invalid') ||
    rawMsg.includes('wrong password') ||
    rawMsg.includes('user not found')
  ) {
    return {
      kind: 'invalid_credentials',
      message: 'Invalid credentials or verification code. Please check and try again.',
      originalError: error,
    };
  }

  // 7. Unsupported phone provider (SMS gateway not configured in Supabase)
  if (rawMsg.includes('unsupported phone provider') || rawMsg.includes('sms provider')) {
    return {
      kind: 'unknown',
      message: 'SMS provider is not enabled in this Supabase project. Please use the "Email / Password" or "Email OTP" tab to sign in.',
      originalError: error,
    };
  }

  return {
    kind: 'unknown',
    message: typeof error?.message === 'string' ? error.message : 'Authentication operation failed.',
    originalError: error,
  };
}

export function checkOtpResendAllowed(identifier: string): { allowed: boolean; waitSeconds?: number } {
  const key = identifier.trim().toLowerCase();
  const last = otpDispatchTimestamps.get(key);
  if (!last) return { allowed: true };
  const elapsed = (Date.now() - last) / 1000;
  if (elapsed < OTP_COOLDOWN_SECONDS) {
    return { allowed: false, waitSeconds: Math.ceil(OTP_COOLDOWN_SECONDS - elapsed) };
  }
  return { allowed: true };
}

export function recordOtpDispatched(identifier: string): void {
  const key = identifier.trim().toLowerCase();
  otpDispatchTimestamps.set(key, Date.now());
  otpFailedAttempts.delete(key);
}

export function checkOtpAttemptsAllowed(identifier: string): { allowed: boolean; remainingAttempts: number } {
  const key = identifier.trim().toLowerCase();
  const attempts = otpFailedAttempts.get(key) || 0;
  if (attempts >= MAX_OTP_FAILED_ATTEMPTS) {
    return { allowed: false, remainingAttempts: 0 };
  }
  return { allowed: true, remainingAttempts: MAX_OTP_FAILED_ATTEMPTS - attempts };
}

export function recordFailedOtpAttempt(identifier: string): number {
  const key = identifier.trim().toLowerCase();
  const current = (otpFailedAttempts.get(key) || 0) + 1;
  otpFailedAttempts.set(key, current);
  return current;
}

export function resetOtpAttempts(identifier: string): void {
  const key = identifier.trim().toLowerCase();
  otpFailedAttempts.delete(key);
}

/**
 * Sign in / send 6-digit OTP to Email (Gmail) address with role-aware onboarding metadata.
 */
export async function signInWithEmailOtp({ email, role, fullName }: EmailOtpSignInParams) {
  const normalizedEmail = email.trim().toLowerCase();
  logger.info('Initiating Email/Gmail OTP sign-in', { email: normalizedEmail, role });

  const throttleCheck = checkOtpResendAllowed(normalizedEmail);
  if (!throttleCheck.allowed) {
    const waitMsg = `Please wait ${throttleCheck.waitSeconds} seconds before requesting a new OTP code.`;
    const err: any = new Error(waitMsg);
    err.status = 429;
    throw err;
  }

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

  recordOtpDispatched(normalizedEmail);
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

  const attemptsCheck = checkOtpAttemptsAllowed(normalizedEmail);
  if (!attemptsCheck.allowed) {
    const err: any = new Error('Too many failed verification attempts. Please request a new OTP code.');
    err.status = 429;
    throw err;
  }

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
    recordFailedOtpAttempt(normalizedEmail);
    logger.error('Email OTP verification failed', error, { email: normalizedEmail });
    throw error;
  }

  resetOtpAttempts(normalizedEmail);
  return data;
}

/**
 * Sign in / send 6-digit OTP to Indian mobile number.
 */
export async function signInWithPhoneOtp({ phone }: PhoneSignInParams) {
  const formattedPhone = normalizeIndianPhone(phone);
  logger.info('Initiating Phone OTP sign-in', { phone: formattedPhone });

  const throttleCheck = checkOtpResendAllowed(formattedPhone);
  if (!throttleCheck.allowed) {
    const waitMsg = `Please wait ${throttleCheck.waitSeconds} seconds before requesting a new OTP code.`;
    const err: any = new Error(waitMsg);
    err.status = 429;
    throw err;
  }

  const { data, error } = await supabase.auth.signInWithOtp({
    phone: formattedPhone,
  });

  if (error) {
    logger.error('Failed to send phone OTP', error, { phone: formattedPhone });
    throw error;
  }

  recordOtpDispatched(formattedPhone);
  return data;
}

/**
 * Verify 6-digit OTP token for phone number.
 */
export async function verifyPhoneOtp({ phone, token }: VerifyOtpParams) {
  const formattedPhone = normalizeIndianPhone(phone);
  logger.info('Verifying Phone OTP token');

  const attemptsCheck = checkOtpAttemptsAllowed(formattedPhone);
  if (!attemptsCheck.allowed) {
    const err: any = new Error('Too many failed verification attempts. Please request a new OTP code.');
    err.status = 429;
    throw err;
  }

  const { data, error } = await supabase.auth.verifyOtp({
    phone: formattedPhone,
    token: token.trim(),
    type: 'sms',
  });

  if (error) {
    recordFailedOtpAttempt(formattedPhone);
    logger.error('Phone OTP verification failed', error);
    throw error;
  }

  resetOtpAttempts(formattedPhone);
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
  const normalizedEmail = email.trim().toLowerCase();

  // Try universal registration endpoint if available to bypass SMTP confirmation email failure
  const apiBase =
    (typeof process !== 'undefined' && (process.env.EXPO_PUBLIC_ADMIN_URL || process.env.NEXT_PUBLIC_ADMIN_URL)) ||
    (typeof window !== 'undefined' && window.location?.origin ? window.location.origin : 'http://localhost:3000');

  if (apiBase) {
    try {
      const resp = await fetch(`${apiBase}/api/auth/register-user`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: normalizedEmail,
          password,
          role,
          fullName,
          phone,
        }),
      });

      if (resp.ok) {
        const body = await resp.json();
        if (body.success) {
          // Immediately sign in so user gets active session
          const signInRes = await supabase.auth.signInWithPassword({
            email: normalizedEmail,
            password,
          });
          if (signInRes.data?.session) {
            return signInRes.data;
          }
        } else if (body.error && body.error.includes('already exists')) {
          throw new Error(body.error);
        }
      }
    } catch (e: any) {
      if (e?.message && e.message.includes('already exists')) {
        throw e;
      }
      logger.warn('Direct registration endpoint unavailable, falling back to standard auth', { error: String(e) });
    }
  }

  const { data, error } = await supabase.auth.signUp({
    email: normalizedEmail,
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
    // If Supabase errors due to mail sending failure on unconfigured SMTP, clarify message
    if (error.message?.toLowerCase().includes('sending confirmation email')) {
      logger.warn('Supabase mail server unconfigured or rate limited', error);
      throw new Error('Email server is temporarily unconfigured for confirmation emails. Please use Google Sign-In or Mobile OTP to enter.');
    }
    logger.error('Sign-up failed', error, { email: normalizedEmail });
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
