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
}

export interface VerifyEmailOtpParams {
  email: string;
  token: string;
}

/**
 * Sign in / send 6-digit OTP to Email (Gmail) address.
 */
export async function signInWithEmailOtp({ email }: EmailOtpSignInParams) {
  const normalizedEmail = email.trim().toLowerCase();
  logger.info('Initiating Email/Gmail OTP sign-in', { email: normalizedEmail });

  const { data, error } = await supabase.auth.signInWithOtp({
    email: normalizedEmail,
    options: {
      shouldCreateUser: true,
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
 */
export async function verifyEmailOtp({ email, token }: VerifyEmailOtpParams) {
  const normalizedEmail = email.trim().toLowerCase();
  logger.info('Verifying Email/Gmail OTP token', { email: normalizedEmail });

  const { data, error } = await supabase.auth.verifyOtp({
    email: normalizedEmail,
    token: token.trim(),
    type: 'email',
  });

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
