import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Modal, Platform } from 'react-native';
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
  InlineBanner,
  OpsklAlert,
} from '@opskil/design-system';
import { fetchUserProfile, supabase, classifyAuthError } from '@opskil/shared';

type AuthMode = 'signin' | 'signup';
type SignInMethod = 'otp' | 'password';

export default function OrganizerLoginScreen() {
  const router = useRouter();
  const { redirect, mode: initialMode } = useLocalSearchParams<{ redirect?: string; mode?: AuthMode }>();
  const { colors, spacing, radii, typography, touchTarget } = useOpsklTheme();
  const {
    sendEmailOtp,
    verifyEmailOtp,
    signInWithPassword,
    signUpWithPassword,
    signInWithGoogle,
    sendPasswordReset,
    resendVerification,
    handleAuthUrl,
  } = useAuth();

  const [mode, setMode] = useState<AuthMode>(initialMode === 'signup' ? 'signup' : 'signin');
  const [signInMethod, setSignInMethod] = useState<SignInMethod>('otp');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [phone, setPhone] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [timerSeconds, setTimerSeconds] = useState(0);

  const [showForgotModal, setShowForgotModal] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetLoading, setResetLoading] = useState(false);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (timerSeconds > 0) {
      interval = setInterval(() => {
        setTimerSeconds((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [timerSeconds]);

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
    let profile = await fetchUserProfile(userId);

    // If profile was just created by trigger, retry once after 400ms
    if (!profile) {
      await new Promise((resolve) => setTimeout(resolve, 400));
      profile = await fetchUserProfile(userId);
    }

    if (profile && profile.role === 'worker') {
      try {
        const { data: switchRes } = await supabase.rpc('switch_user_role_safe', {
          p_target_role: 'organizer',
          p_business_name: profile.fullName || 'Independent Organizer',
          p_business_phone: profile.phone || '',
        });
        if (switchRes && switchRes.success) {
          profile = await fetchUserProfile(userId);
        }
      } catch {
        // Continue to check
      }
    }

    if (!profile || profile.isActive === false || (profile.role !== 'organizer' && profile.role !== 'admin')) {
      await supabase.auth.signOut().catch(() => { });
      setErrorMessage(
        'Unable to verify an active Organizer account for this identity. Please register your organization below.'
      );
      setMode('signup');
      return;
    }

    router.replace((redirect || '/(tabs)') as any);
  };

  const handleSendOtp = async () => {
    setErrorMessage(null);
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !trimmed.includes('@') || !trimmed.includes('.')) {
      setErrorMessage('Please enter a valid business email address.');
      return;
    }
    setLoading(true);
    try {
      await sendEmailOtp(trimmed, 'organizer');
      setOtpSent(true);
      setTimerSeconds(60);
    } catch (err: any) {
      setErrorMessage(classifyAuthError(err).message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (loading) return;
    setErrorMessage(null);
    const cleanOtp = otp.replace(/\D/g, '').trim();
    if (cleanOtp.length !== 6) {
      setErrorMessage('Please enter the complete 6-digit verification code.');
      return;
    }
    setLoading(true);
    try {
      const res = await verifyEmailOtp(email.trim().toLowerCase(), cleanOtp, 'organizer');
      if (res?.session) {
        await handlePostAuthRoute(res.session.user.id);
      } else {
        setErrorMessage('No session was returned by the auth service. Please try again.');
      }
    } catch (err: any) {
      setErrorMessage(classifyAuthError(err).message);
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordSignIn = async () => {
    setErrorMessage(null);
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !trimmed.includes('@') || !trimmed.includes('.')) {
      setErrorMessage('Please enter a valid business email address.');
      return;
    }
    if (!password) {
      setErrorMessage('Please enter your password.');
      return;
    }
    setLoading(true);
    try {
      const res = await signInWithPassword(trimmed, password, 'organizer');
      if (res?.session) {
        await handlePostAuthRoute(res.session.user.id);
      }
    } catch (err: any) {
      setErrorMessage(classifyAuthError(err).message);
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async () => {
    setErrorMessage(null);
    const trimmedEmail = email.trim().toLowerCase();
    const trimmedOrg = businessName.trim();
    let cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length === 12 && cleanPhone.startsWith('91')) {
      cleanPhone = cleanPhone.slice(2);
    }

    if (!trimmedOrg || trimmedOrg.length < 2) {
      setErrorMessage('Please enter your organization or agency name.');
      return;
    }
    if (cleanPhone.length !== 10 || !/^[6-9]/.test(cleanPhone)) {
      setErrorMessage('Please enter a valid 10-digit Indian mobile number starting with 6, 7, 8, or 9.');
      return;
    }
    if (!trimmedEmail || !trimmedEmail.includes('@') || !trimmedEmail.includes('.')) {
      setErrorMessage('Please enter a valid business email address.');
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
        role: 'organizer',
        fullName: trimmedOrg,
        phone: cleanPhone,
      });

      if (res?.session) {
        await handlePostAuthRoute(res.session.user.id);
      } else {
        try {
          const loginRes = await signInWithPassword(trimmedEmail, password, 'organizer');
          if (loginRes?.session) {
            await handlePostAuthRoute(loginRes.session.user.id);
            return;
          }
        } catch {
          // If unconfirmed, show info
        }

        OpsklAlert.alert(
          'Registration Received',
          `Your organization profile for "${trimmedOrg}" has been created. Please sign in with your credentials.`,
          [{ text: 'Sign In Now', onPress: () => setMode('signin') }]
        );
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Unable to register organizer account.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    try {
      const redirectUrl = Linking.createURL('/auth/login');
      const res = await signInWithGoogle('organizer', redirectUrl);
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
  };

  const handleSendResetEmail = async () => {
    const trimmed = resetEmail.trim().toLowerCase();
    if (!trimmed || !trimmed.includes('@')) {
      OpsklAlert.alert('Invalid Email', 'Please enter a valid email address.');
      return;
    }
    setResetLoading(true);
    try {
      const redirectUrl = Linking.createURL('/auth/login');
      await sendPasswordReset(trimmed, redirectUrl);
      OpsklAlert.alert('Reset Instructions Sent', `Password reset link has been dispatched to ${trimmed}.`);
      setShowForgotModal(false);
      setResetEmail('');
    } catch (err: any) {
      OpsklAlert.alert('Reset Failed', err?.message || 'Unable to dispatch password reset link.');
    } finally {
      setResetLoading(false);
    }
  };

  const handleResendVerification = async () => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !trimmed.includes('@')) {
      OpsklAlert.alert('Email Required', 'Please enter your email above to resend verification.');
      return;
    }
    setLoading(true);
    try {
      await resendVerification(trimmed);
      OpsklAlert.alert('Verification Sent', `A new verification email has been dispatched to ${trimmed}.`);
    } catch (err: any) {
      OpsklAlert.alert('Error', err?.message || 'Unable to resend verification email.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen edges={['top', 'bottom']}>
      <ScreenHeader
        title={mode === 'signin' ? 'Organizer Sign In' : 'Register Organization'}
        onBack={() => {
          if (otpSent) {
            setOtpSent(false);
            setOtp('');
          } else if (router.canGoBack()) {
            router.back();
          } else {
            router.replace('/welcome' as any);
          }
        }}
      />

      <KeyboardAwareContainer contentContainerStyle={{ padding: spacing.xl, paddingBottom: 60 }}>
        <SegmentedControl
          options={[
            { value: 'signin', label: 'Sign In' },
            { value: 'signup', label: 'Register' },
          ]}
          value={mode}
          onChange={(v) => {
            setMode(v);
            setOtpSent(false);
            setOtp('');
            setErrorMessage(null);
          }}
          style={{ marginBottom: spacing.lg }}
        />

        {errorMessage && (
          <InlineBanner
            variant="error"
            title="Authentication Error"
            message={errorMessage}
            style={{ marginBottom: spacing.md }}
          />
        )}

        <TouchableOpacity
          onPress={handleGoogleSignIn}
          disabled={loading}
          activeOpacity={0.8}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: radii.md,
            minHeight: touchTarget.comfortable,
            marginBottom: spacing.md,
            gap: 10,
          }}
          accessibilityRole="button"
          accessibilityLabel="Continue with Google"
        >
          <View
            style={{
              width: 24,
              height: 24,
              borderRadius: 12,
              backgroundColor: '#4285F4',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ color: '#FFFFFF', fontWeight: '900', fontSize: 13 }}>G</Text>
          </View>
          <Text style={{ fontSize: 14, fontWeight: '700', color: colors.textPrimary }}>
            Continue with Google
          </Text>
        </TouchableOpacity>

        <Divider label="OR WITH BUSINESS EMAIL" />

        {mode === 'signin' ? (
          <View style={{ gap: spacing.sm, marginTop: spacing.md }}>
            <SegmentedControl
              options={[
                { value: 'otp', label: 'Email OTP' },
                { value: 'password', label: 'Password' },
              ]}
              value={signInMethod}
              onChange={(m) => {
                setSignInMethod(m);
                setErrorMessage(null);
              }}
              style={{ marginBottom: spacing.md }}
            />

            <Input
              label="Business Email Address"
              value={email}
              onChangeText={(text) => {
                setEmail(text);
                if (errorMessage) setErrorMessage(null);
              }}
              placeholder="organizer@agency.com"
              keyboardType="email-address"
              autoComplete="email"
              textContentType="emailAddress"
              autoCapitalize="none"
              editable={!otpSent}
            />

            {signInMethod === 'otp' ? (
              !otpSent ? (
                <Button
                  title="Send Organizer OTP"
                  variant="primary"
                  size="lg"
                  loading={loading}
                  disabled={loading}
                  onPress={handleSendOtp}
                />
              ) : (
                <>
                  <FormField label="Enter 6-Digit OTP" helperText={`Code sent to ${email.trim().toLowerCase()}`}>
                    <OtpInput
                      value={otp}
                      onChange={(code) => {
                        setOtp(code);
                        if (errorMessage) setErrorMessage(null);
                      }}
                      autoFocus
                    />
                  </FormField>
                  <Button
                    title="Verify OTP & Open Workspace"
                    variant="primary"
                    size="lg"
                    loading={loading}
                    disabled={loading}
                    onPress={handleVerifyOtp}
                  />
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Button
                      title={timerSeconds > 0 ? `Resend in ${timerSeconds}s` : 'Resend Code'}
                      variant="ghost"
                      size="sm"
                      disabled={loading || timerSeconds > 0}
                      onPress={handleSendOtp}
                    />
                    <Button
                      title="Change Email"
                      variant="ghost"
                      size="sm"
                      disabled={loading}
                      onPress={() => {
                        setOtpSent(false);
                        setOtp('');
                        setErrorMessage(null);
                      }}
                    />
                  </View>
                </>
              )
            ) : (
              <>
                <PasswordInput
                  label="Password"
                  value={password}
                  onChangeText={(text) => {
                    setPassword(text);
                    if (errorMessage) setErrorMessage(null);
                  }}
                  placeholder="Enter secure password"
                  autoComplete="password"
                  textContentType="password"
                />
                <Button
                  title="Sign In to Organizer Portal"
                  variant="primary"
                  size="lg"
                  loading={loading}
                  disabled={loading}
                  onPress={handlePasswordSignIn}
                />
                <View
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginTop: spacing.sm,
                    minHeight: touchTarget.min,
                  }}
                >
                  <TouchableOpacity
                    onPress={() => {
                      setResetEmail(email);
                      setErrorMessage(null);
                      setShowForgotModal(true);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel="Forgot password"
                  >
                    <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textSecondary }}>
                      Forgot Password?
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity onPress={handleResendVerification} accessibilityRole="button">
                    <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textMuted }}>
                      Resend Verification Email
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        ) : (
          <View style={{ gap: spacing.xs, marginTop: spacing.md }}>
            <Text style={[typography.h3, { color: colors.textPrimary, marginBottom: 2 }]}>
              Register New Organization
            </Text>
            <Text style={{ fontSize: 12, color: colors.textMuted, marginBottom: spacing.md }}>
              Set up your agency or event production profile to post single-day shifts
            </Text>

            <Input
              label="Organization / Agency Name"
              value={businessName}
              onChangeText={(text) => {
                setBusinessName(text);
                if (errorMessage) setErrorMessage(null);
              }}
              placeholder="e.g. Apex Events & Media"
            />

            <Input
              label="Business Contact Number"
              value={phone}
              onChangeText={(text) => {
                setPhone(text);
                if (errorMessage) setErrorMessage(null);
              }}
              placeholder="9820098200"
              keyboardType="phone-pad"
              autoComplete="tel"
              textContentType="telephoneNumber"
            />

            <Input
              label="Business Email Address"
              value={email}
              onChangeText={(text) => {
                setEmail(text);
                if (errorMessage) setErrorMessage(null);
              }}
              placeholder="contact@apexevents.in"
              keyboardType="email-address"
              autoComplete="email"
              textContentType="emailAddress"
              autoCapitalize="none"
            />

            <PasswordInput
              label="Create Master Password"
              value={password}
              onChangeText={(text) => {
                setPassword(text);
                if (errorMessage) setErrorMessage(null);
              }}
              placeholder="Min. 6 characters"
              autoComplete="new-password"
              textContentType="newPassword"
            />

            <Button
              title="Register Organization & Continue"
              variant="primary"
              size="lg"
              loading={loading}
              disabled={loading}
              onPress={handleSignUp}
              style={{ marginTop: spacing.sm }}
            />
          </View>
        )}
      </KeyboardAwareContainer>

      <Modal
        visible={showForgotModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowForgotModal(false)}
        accessibilityViewIsModal
      >
        <KeyboardAwareContainer
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: 'center',
            padding: spacing.xl,
            backgroundColor: 'rgba(0,0,0,0.6)',
          }}
        >
          <View
            style={{
              backgroundColor: colors.surface,
              borderRadius: radii.xl,
              padding: spacing.xl,
              gap: spacing.md,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <Text style={[typography.h3, { color: colors.textPrimary }]}>Reset Password</Text>
            <Text style={{ fontSize: 13, color: colors.textSecondary, lineHeight: 18 }}>
              Enter your registered business email address to receive password reset instructions.
            </Text>
            <Input
              label="Business Email Address"
              value={resetEmail}
              onChangeText={setResetEmail}
              placeholder="organizer@agency.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoFocus
            />
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
              <Button
                title="Cancel"
                variant="outline"
                size="md"
                onPress={() => {
                  setShowForgotModal(false);
                  setResetEmail('');
                }}
                style={{ flex: 1 }}
              />
              <Button
                title={resetLoading ? 'Sending…' : 'Send Reset Link'}
                variant="primary"
                size="md"
                disabled={resetLoading}
                loading={resetLoading}
                onPress={handleSendResetEmail}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        </KeyboardAwareContainer>
      </Modal>
    </Screen>
  );
}
