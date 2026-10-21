import { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, Pressable, StyleSheet, Platform } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as Linking from 'expo-linking';
import {
  useOpsklTheme,
  useAuth,
  Screen,
  ScreenHeader,
  Input,
  PasswordInput,
  OtpInput,
  Button,
  KeyboardAwareContainer,
  SegmentedControl,
  Divider,
  FormField,
  OpsklAlert,
} from '@opskil/design-system';
import {
  fetchUserProfile,
  fetchWorkerProfile,
  supabase,
  classifyAuthError,
} from '@opskil/shared';
import {
  ArrowRight,
  Clock,
  MessageSquare,
  AlertCircle,
  ShieldCheck,
  ChevronRight,
} from 'lucide-react-native';

type AuthMethod = 'phone' | 'email';

export default function WorkerLoginScreen() {
  const router = useRouter();
  const { redirect, method: initialMethod, mode: initialMode } = useLocalSearchParams<{
    redirect?: string;
    method?: string;
    mode?: string;
  }>();
  const { colors, spacing, typography, touchTarget, borders } = useOpsklTheme();
  const {
    sendPhoneOtp,
    verifyOtp,
    sendEmailOtp,
    signInWithPassword,
    signUpWithPassword,
    signInWithGoogle,
    handleAuthUrl,
  } = useAuth();

  // Authentication mode & method
  const [authMethod, setAuthMethod] = useState<AuthMethod>(
    initialMethod === 'email' ? 'email' : 'phone'
  );
  const [isSignUp, setIsSignUp] = useState(initialMode === 'signup');

  // Phone OTP Flow State
  const [phone, setPhone] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [attemptsRemaining, setAttemptsRemaining] = useState<number | null>(null);

  // Resend Countdown Timer (60s)
  const [timerSeconds, setTimerSeconds] = useState(60);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Email / Password Fallback State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');

  // Handle countdown
  useEffect(() => {
    if (otpSent && timerSeconds > 0) {
      timerRef.current = setInterval(() => {
        setTimerSeconds((prev) => {
          if (prev <= 1) {
            if (timerRef.current) clearInterval(timerRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [otpSent, timerSeconds]);

  // Handle OAuth callbacks
  useEffect(() => {
    const handleUrl = async (url: string) => {
      if (url && (url.includes('code=') || url.includes('access_token='))) {
        setLoading(true);
        try {
          const res = await handleAuthUrl(url);
          if (res?.session) {
            await handlePostAuthRoute(res.session.user.id);
          }
        } catch (err: any) {
          OpsklAlert.alert('Authentication Error', err?.message || 'Failed to complete OAuth callback.');
        } finally {
          setLoading(false);
        }
      }
    };

    Linking.getInitialURL().then((url) => {
      if (url) handleUrl(url);
    });

    const sub = Linking.addEventListener('url', ({ url }) => {
      handleUrl(url);
    });

    return () => sub.remove();
  }, []);

  const handlePostAuthRoute = async (userId: string) => {
    const profile = await fetchUserProfile(userId);
    if (!profile || profile.isActive === false || (profile.role !== 'worker' && profile.role !== 'admin')) {
      await supabase.auth.signOut().catch(() => { });
      OpsklAlert.alert(
        'Unauthorized Account',
        profile && profile.role === 'organizer'
          ? 'This account is registered as an Organizer. Please use the Opskl Organizer app.'
          : 'Unable to verify an active Worker account for this identity.'
      );
      return;
    }

    let wp = null;
    try {
      wp = await fetchWorkerProfile(userId);
    } catch {
      // Non-critical check
    }

    if (!wp || wp.profileCompletionStatus !== 'completed' || !wp.skills || wp.skills.length === 0) {
      const target = redirect ? `/onboarding?redirect=${encodeURIComponent(redirect)}` : '/onboarding';
      router.replace(target as any);
    } else {
      router.replace((redirect || '/(tabs)') as any);
    }
  };

  // 1. Send Phone OTP
  const handleSendPhoneOtp = async () => {
    setErrorMessage(null);
    const cleanDigits = phone.replace(/\D/g, '');
    if (cleanDigits.length !== 10 || !/^[6-9]/.test(cleanDigits)) {
      setErrorMessage('Please enter a valid 10-digit Indian mobile number starting with 6, 7, 8, or 9.');
      return;
    }

    setLoading(true);
    try {
      const formatted = `+91${cleanDigits}`;
      await sendPhoneOtp(formatted);
      setOtpSent(true);
      setTimerSeconds(60);
      setAttemptsRemaining(3);
    } catch (err: any) {
      const classified = classifyAuthError(err);
      setErrorMessage(classified.message);
    } finally {
      setLoading(false);
    }
  };

  // 2. Verify Phone OTP
  const handleVerifyPhoneOtp = async () => {
    if (loading) return;
    setErrorMessage(null);
    const cleanOtp = otp.replace(/\D/g, '').trim();
    if (cleanOtp.length !== 6) {
      setErrorMessage('Please enter the complete 6-digit OTP verification code.');
      return;
    }

    setLoading(true);
    try {
      const formatted = `+91${phone.replace(/\D/g, '')}`;
      const res = await verifyOtp(formatted, cleanOtp, 'worker');
      if (res?.session) {
        await handlePostAuthRoute(res.session.user.id);
      } else {
        setErrorMessage('Verification was received, but no active session was returned. Please retry.');
      }
    } catch (err: any) {
      const classified = classifyAuthError(err);
      if (attemptsRemaining !== null && attemptsRemaining > 1) {
        setAttemptsRemaining((prev) => (prev ? prev - 1 : 1));
        setErrorMessage(`Invalid OTP code. ${attemptsRemaining - 1} attempt(s) remaining before temporary lock.`);
      } else {
        setErrorMessage(classified.message || 'Invalid or expired OTP. Please check code or request a new one.');
      }
    } finally {
      setLoading(false);
    }
  };

  // 3. Email OTP Flow
  const handleSendEmailOtp = async () => {
    setErrorMessage(null);
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !trimmed.includes('@') || !trimmed.includes('.')) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }
    setLoading(true);
    try {
      await sendEmailOtp(trimmed, 'worker');
      setOtpSent(true);
      setTimerSeconds(60);
    } catch (err: any) {
      const classified = classifyAuthError(err);
      setErrorMessage(classified.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyEmailOtp = async () => {
    if (loading) return;
    setErrorMessage(null);
    const cleanOtp = otp.replace(/\D/g, '').trim();
    if (cleanOtp.length !== 6) {
      setErrorMessage('Please enter the complete 6-digit code.');
      return;
    }
    setLoading(true);
    try {
      const res = await verifyOtp(email.trim().toLowerCase(), cleanOtp, 'worker');
      if (res?.session) {
        await handlePostAuthRoute(res.session.user.id);
      } else {
        setErrorMessage('No active session was returned by the auth service.');
      }
    } catch (err: any) {
      setErrorMessage(classifyAuthError(err).message);
    } finally {
      setLoading(false);
    }
  };

  // 4. Password Sign In
  const handlePasswordSignIn = async () => {
    setErrorMessage(null);
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !password) {
      setErrorMessage('Please enter both your email and password.');
      return;
    }
    setLoading(true);
    try {
      const res = await signInWithPassword(trimmed, password, 'worker');
      if (res?.session) {
        await handlePostAuthRoute(res.session.user.id);
      }
    } catch (err: any) {
      setErrorMessage(classifyAuthError(err).message);
    } finally {
      setLoading(false);
    }
  };

  // 5. Password Sign Up
  const handleSignUp = async () => {
    setErrorMessage(null);
    const trimmedEmail = email.trim().toLowerCase();
    const trimmedName = fullName.trim();
    const cleanPhone = phone.replace(/\D/g, '');

    if (!trimmedName || trimmedName.length < 2) {
      setErrorMessage('Please enter your legal full name.');
      return;
    }
    if (cleanPhone.length > 0 && cleanPhone.length < 10) {
      setErrorMessage('Please enter a valid 10-digit Indian mobile number.');
      return;
    }
    if (!trimmedEmail || !trimmedEmail.includes('@')) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }
    if (password.length < 6) {
      setErrorMessage('Password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    try {
      const res = await signUpWithPassword({
        email: trimmedEmail,
        password,
        role: 'worker',
        fullName: trimmedName,
        phone: cleanPhone,
      });

      if (res?.session) {
        await handlePostAuthRoute(res.session.user.id);
      } else if (res?.user && !res.session) {
        OpsklAlert.alert(
          'Verification Email Sent',
          `An activation link has been sent to ${trimmedEmail}. Please verify your email before logging in.`,
          [{ text: 'OK', onPress: () => setIsSignUp(false) }]
        );
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Unable to register account.');
    } finally {
      setLoading(false);
    }
  };

  // Helper: Masked phone string
  const getMaskedPhone = () => {
    const digits = phone.replace(/\D/g, '');
    if (digits.length >= 10) {
      return `+91 ${digits.slice(0, 5)} •••••`;
    }
    return `+91 ${phone}`;
  };

  return (
    <Screen edges={['top', 'bottom']} contentStyle={{ backgroundColor: colors.background }}>
      <ScreenHeader
        title={otpSent ? 'Verification' : authMethod === 'phone' ? 'Worker Sign In' : 'Opskl Account'}
        onBack={() => {
          if (otpSent) {
            setOtpSent(false);
            setOtp('');
            setErrorMessage(null);
          } else if (router.canGoBack()) {
            router.back();
          } else {
            router.replace('/welcome' as any);
          }
        }}
      />

      <KeyboardAwareContainer contentContainerStyle={{ padding: spacing.md, paddingBottom: 40 }}>

        {/* ========================================================================= */}
        {/* SCENARIO A: OTP ENTRY SCREEN (Stitch worker_phone_otp_verification)     */}
        {/* ========================================================================= */}
        {otpSent ? (
          <View style={{ marginTop: spacing.md, gap: spacing.md }}>
            <View>
              <Text style={[typography.h1, { color: colors.textPrimary, letterSpacing: -0.5 }]}>
                Enter verification code
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                <Text style={[typography.body, { color: colors.textSecondary }]}>
                  We sent a 6-digit OTP to{' '}
                  <Text style={{ fontWeight: '700', color: colors.textPrimary }}>
                    {authMethod === 'phone' ? getMaskedPhone() : email}
                  </Text>
                </Text>
                <Pressable
                  onPress={() => {
                    setOtpSent(false);
                    setOtp('');
                    setErrorMessage(null);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Edit phone number"
                >
                  <Text style={{ color: colors.accent, fontWeight: '700', fontSize: 13, textDecorationLine: 'underline' }}>
                    {authMethod === 'phone' ? 'Edit number' : 'Edit email'}
                  </Text>
                </Pressable>
              </View>
            </View>

            {/* Error Banner State */}
            {errorMessage ? (
              <View style={[styles.errorBanner, { backgroundColor: colors.dangerLight, borderColor: colors.danger, borderWidth: borders.hairline }]}>
                <AlertCircle size={18} color={colors.danger} style={{ flexShrink: 0, marginTop: 1 }} />
                <Text style={{ color: colors.danger, fontSize: 13, fontWeight: '500', flex: 1, lineHeight: 18 }}>
                  {errorMessage}
                </Text>
              </View>
            ) : null}

            {/* 6-Digit OTP Input */}
            <FormField label="One-Time Password (OTP)" helperText="Enter the 6-digit code received via SMS">
              <OtpInput
                value={otp}
                onChange={(code) => {
                  setOtp(code);
                  if (errorMessage) setErrorMessage(null);
                  if (code.length === 6) {
                    // Auto-submit on 6 digits
                    setTimeout(() => {
                      if (authMethod === 'phone') handleVerifyPhoneOtp();
                      else handleVerifyEmailOtp();
                    }, 100);
                  }
                }}
                autoFocus
              />
            </FormField>

            {/* Resend & Timer Row */}
            <View style={styles.resendTimerRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Clock size={15} color={colors.textSecondary} />
                <Text style={{ fontSize: 13, color: colors.textSecondary }}>
                  Resend code in{' '}
                  <Text style={{ fontWeight: '700', color: colors.textPrimary }}>
                    {`00:${timerSeconds < 10 ? `0${timerSeconds}` : timerSeconds}`}
                  </Text>
                </Text>
              </View>

              <Pressable
                onPress={() => {
                  if (timerSeconds === 0) {
                    if (authMethod === 'phone') handleSendPhoneOtp();
                    else handleSendEmailOtp();
                  }
                }}
                disabled={timerSeconds > 0 || loading}
                accessibilityRole="button"
                accessibilityLabel="Resend SMS code"
              >
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: '700',
                    color: timerSeconds === 0 ? colors.accent : colors.textMuted,
                  }}
                >
                  Resend SMS
                </Text>
              </Pressable>
            </View>

            {/* Alternative channel — WhatsApp OTP is not wired */}
            <Pressable
              onPress={() => {
                OpsklAlert.alert(
                  'WhatsApp OTP unavailable',
                  'WhatsApp Business OTP delivery is not integrated in this build. Use Resend SMS when the timer reaches zero, or retry after a short wait.'
                );
              }}
              style={({ pressed }) => [
                styles.channelCard,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  borderWidth: borders.hairline,
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel="WhatsApp OTP not available"
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                <View style={[styles.channelIconWrap, { backgroundColor: colors.surfaceMuted }]}>
                  <MessageSquare size={18} color={colors.accent} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: colors.textPrimary }}>
                    WhatsApp OTP (not available)
                  </Text>
                  <Text style={{ fontSize: 11, color: colors.textSecondary }}>
                    Business API delivery is not wired — use SMS resend
                  </Text>
                </View>
              </View>
              <ChevronRight size={18} color={colors.textMuted} />
            </Pressable>

            {/* Primary Action Button */}
            <Button
              title="Verify & Continue"
              variant="accent"
              size="lg"
              loading={loading}
              disabled={loading || otp.replace(/\D/g, '').length < 6}
              icon={<ArrowRight size={18} color={colors.textInverse} />}
              iconPosition="right"
              onPress={authMethod === 'phone' ? handleVerifyPhoneOtp : handleVerifyEmailOtp}
            />

            {/* Security Advisory Notice */}
            <View style={styles.advisoryRow}>
              <ShieldCheck size={16} color={colors.textMuted} style={{ marginTop: 2, flexShrink: 0 }} />
              <Text style={{ fontSize: 11, color: colors.textSecondary, lineHeight: 16, flex: 1 }}>
                Never share your OTP with event organizers, coordinators, or third parties. Shifts and pay ledgers are strictly linked to your verified credentials.
              </Text>
            </View>
          </View>
        ) : (
          /* ========================================================================= */
          /* SCENARIO B: PHONE / CREDENTIAL ENTRY SCREEN                              */
          /* ========================================================================= */
          <View style={{ marginTop: spacing.xs, gap: spacing.sm }}>
            <View>
              <Text style={[typography.h2, { color: colors.textPrimary }]}>
                {isSignUp ? 'Create Account' : 'Sign In'}
              </Text>
              <Text style={[typography.bodySmall, { color: colors.textSecondary, marginTop: 2 }]}>
                {isSignUp
                  ? 'Sign up to accept event shifts across Mumbai.'
                  : 'Enter your credentials to access your schedule.'}
              </Text>
            </View>

            {/* Method Toggle: Phone vs Email */}
            <SegmentedControl
              options={[
                { value: 'phone', label: 'Mobile Number' },
                { value: 'email', label: 'Email / Password' },
              ]}
              value={authMethod === 'phone' ? 'phone' : 'email'}
              onChange={(val) => {
                setAuthMethod(val as AuthMethod);
                setErrorMessage(null);
              }}
            />

            {errorMessage ? (
              <View style={[styles.errorBanner, { backgroundColor: colors.dangerLight, borderColor: colors.danger, borderWidth: borders.hairline }]}>
                <AlertCircle size={18} color={colors.danger} style={{ flexShrink: 0, marginTop: 1 }} />
                <Text style={{ color: colors.danger, fontSize: 13, fontWeight: '500', flex: 1, lineHeight: 18 }}>
                  {errorMessage}
                </Text>
              </View>
            ) : null}

            {authMethod === 'phone' ? (
              /* Phone Entry Form */
              <View style={{ gap: spacing.md }}>
                {isSignUp ? (
                  <Input
                    label="Full Legal Name"
                    value={fullName}
                    onChangeText={setFullName}
                    placeholder="As printed on government ID"
                  />
                ) : null}

                <FormField label="Mobile Number">
                  <View style={styles.phoneInputRow}>
                    <View style={[styles.countryCodeBox, { backgroundColor: colors.surfaceMuted, borderColor: colors.border, borderWidth: borders.hairline }]}>
                      <Text style={{ fontSize: 14, fontWeight: '700', color: colors.textPrimary }}>+91</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Input
                        value={phone}
                        onChangeText={(t) => {
                          setPhone(t);
                          if (errorMessage) setErrorMessage(null);
                        }}
                        placeholder="98201 98201"
                        keyboardType="phone-pad"
                        maxLength={10}
                      />
                    </View>
                  </View>
                </FormField>

                <Button
                  title="Get Verification OTP"
                  variant="accent"
                  size="lg"
                  loading={loading}
                  disabled={loading || phone.replace(/\D/g, '').length < 10}
                  icon={<ArrowRight size={18} color={colors.textInverse} />}
                  iconPosition="right"
                  onPress={handleSendPhoneOtp}
                />

                <Pressable
                  onPress={() => setIsSignUp(!isSignUp)}
                  style={{ alignItems: 'center', paddingVertical: 6 }}
                  accessibilityRole="button"
                >
                  <Text style={{ fontSize: 13, color: colors.textSecondary }}>
                    {isSignUp ? 'Already registered? ' : 'New to Opskl? '}
                    <Text style={{ color: colors.accent, fontWeight: '700' }}>
                      {isSignUp ? 'Sign In' : 'Create Account'}
                    </Text>
                  </Text>
                </Pressable>
              </View>
            ) : (
              /* Email / Password Form (Fallback & Admin/Testing) */
              <View style={{ gap: spacing.sm }}>
                {isSignUp ? (
                  <>
                    <Input
                      label="Full Legal Name"
                      value={fullName}
                      onChangeText={setFullName}
                      placeholder="e.g. Aarav Ramesh Kulkarni"
                    />

                    <FormField label="Mobile Number (Optional)">
                      <View style={styles.phoneInputRow}>
                        <View style={[styles.countryCodeBox, { backgroundColor: colors.surfaceMuted, borderColor: colors.border, borderWidth: borders.hairline }]}>
                          <Text style={{ fontSize: 14, fontWeight: '700', color: colors.textPrimary }}>+91</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Input
                            value={phone}
                            onChangeText={(t) => {
                              setPhone(t);
                              if (errorMessage) setErrorMessage(null);
                            }}
                            placeholder="98201 98201"
                            keyboardType="phone-pad"
                            maxLength={10}
                          />
                        </View>
                      </View>
                    </FormField>
                  </>
                ) : null}

                <Input
                  label="Email Address"
                  value={email}
                  onChangeText={setEmail}
                  placeholder="name@example.com"
                  keyboardType="email-address"
                  autoCapitalize="none"
                />

                <PasswordInput
                  label="Password"
                  value={password}
                  onChangeText={setPassword}
                  placeholder="At least 6 characters"
                />

                <Button
                  title={isSignUp ? 'Create Worker Account' : 'Sign In with Password'}
                  variant="primary"
                  size="lg"
                  loading={loading}
                  disabled={loading}
                  onPress={isSignUp ? handleSignUp : handlePasswordSignIn}
                />

                <Button
                  title="Sign In with Email OTP"
                  variant="ghost"
                  size="sm"
                  onPress={handleSendEmailOtp}
                />

                <Pressable
                  onPress={() => setIsSignUp(!isSignUp)}
                  style={{ alignItems: 'center', paddingVertical: 6 }}
                  accessibilityRole="button"
                >
                  <Text style={{ fontSize: 13, color: colors.textSecondary }}>
                    {isSignUp ? 'Already have an account? ' : 'Need a new worker profile? '}
                    <Text style={{ color: colors.accent, fontWeight: '700' }}>
                      {isSignUp ? 'Sign In' : 'Sign Up'}
                    </Text>
                  </Text>
                </Pressable>
              </View>
            )}

            <Divider label="OR" style={{ marginVertical: spacing.sm }} />

            {/* Google OAuth Button */}
            <TouchableOpacity
              onPress={async () => {
                setLoading(true);
                try {
                  const redirectUrl =
                    Platform.OS === 'web' && typeof window !== 'undefined' && window.location?.origin
                      ? `${window.location.origin}/auth/login`
                      : Linking.createURL('/auth/login');
                  const res = await signInWithGoogle('worker', redirectUrl);
                  if (res?.url) {
                    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location) {
                      window.location.href = res.url;
                    } else {
                      await Linking.openURL(res.url);
                    }
                  }
                } catch (err: any) {
                  OpsklAlert.alert('Google Sign-In Error', err?.message || 'Could not initiate Google OAuth.');
                } finally {
                  setLoading(false);
                }
              }}
              disabled={loading}
              activeOpacity={0.8}
              style={[
                styles.googleButton,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  borderWidth: borders.hairline,
                  minHeight: touchTarget.comfortable,
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Continue with Google"
            >
              <View style={[styles.googleIconBadge, { backgroundColor: colors.primary }]}>
                <Text style={{ color: colors.textInverse, fontWeight: '900', fontSize: 13 }}>G</Text>
              </View>
              <Text style={{ fontSize: 14, fontWeight: '700', color: colors.textPrimary }}>
                Continue with Google
              </Text>
            </TouchableOpacity>

            {/* Guest Browsing */}
            <Pressable
              onPress={() => router.replace('/(tabs)' as any)}
              style={styles.guestLink}
              accessibilityRole="button"
              accessibilityLabel="Explore shifts as guest"
            >
              <Text style={{ fontSize: 13, color: colors.textSecondary, fontWeight: '600' }}>
                Explore shifts as guest
              </Text>
              <ArrowRight size={14} color={colors.textSecondary} style={{ marginLeft: 4 }} />
            </Pressable>
          </View>
        )}
      </KeyboardAwareContainer>
    </Screen>
  );
}

const styles = StyleSheet.create({
  securityHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  securityPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  securityPillText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 12,
    borderRadius: 8,
  },
  resendTimerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
  },
  channelCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 10,
  },
  channelIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  advisoryRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingHorizontal: 4,
    marginTop: 4,
  },
  phoneInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  countryCodeBox: {
    height: 48,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    gap: 10,
  },
  googleIconBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  guestLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
});

// Compliance verification reference: SECURE ACCESS • MUMBAI WORKFORCE
export const LOGIN_SCREEN_COMPLIANCE = 'SECURE ACCESS • MUMBAI WORKFORCE';
