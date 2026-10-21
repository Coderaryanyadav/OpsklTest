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

  const [showForgotModal, setShowForgotModal] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetLoading, setResetLoading] = useState(false);

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
      await supabase.auth.signOut().catch(() => {});
      OpsklAlert.alert(
        'Account Setup Required',
        'Unable to verify an active Organizer account for this identity. Please register your organization below.'
      );
      return;
    }

    router.replace((redirect || '/(tabs)') as any);
  };

  const handleSendOtp = async () => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !trimmed.includes('@') || !trimmed.includes('.')) {
      OpsklAlert.alert('Invalid Email', 'Please enter a valid business email address.');
      return;
    }
    setLoading(true);
    try {
      await sendEmailOtp(trimmed, 'organizer');
      setOtpSent(true);
      OpsklAlert.alert('OTP Sent', `A 6-digit verification code has been dispatched to ${trimmed}. Check your inbox.`);
    } catch (err: any) {
      OpsklAlert.alert('Authentication Status', classifyAuthError(err).message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (loading) return;
    const cleanOtp = otp.replace(/\D/g, '').trim();
    if (cleanOtp.length !== 6) {
      OpsklAlert.alert('Invalid Code', 'Please enter the complete 6-digit code.');
      return;
    }
    setLoading(true);
    try {
      const res = await verifyEmailOtp(email.trim().toLowerCase(), cleanOtp, 'organizer');
      if (res?.session) {
        await handlePostAuthRoute(res.session.user.id);
      } else {
        OpsklAlert.alert('Verification Pending', 'No session was returned by the auth service.');
      }
    } catch (err: any) {
      OpsklAlert.alert('Verification Failed', classifyAuthError(err).message);
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordSignIn = async () => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !password) {
      OpsklAlert.alert('Missing Fields', 'Please enter both your business email and password.');
      return;
    }
    setLoading(true);
    try {
      const res = await signInWithPassword(trimmed, password, 'organizer');
      if (res?.session) {
        await handlePostAuthRoute(res.session.user.id);
      }
    } catch (err: any) {
      OpsklAlert.alert('Sign-In Failed', classifyAuthError(err).message);
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async () => {
    const trimmedEmail = email.trim().toLowerCase();
    const trimmedOrg = businessName.trim();
    const cleanPhone = phone.replace(/\D/g, '');

    if (!trimmedOrg || trimmedOrg.length < 2) {
      OpsklAlert.alert('Organization Name Required', 'Please enter your organization or agency name.');
      return;
    }
    if (cleanPhone.length < 10) {
      OpsklAlert.alert('Valid Phone Required', 'Please enter a 10-digit business contact number.');
      return;
    }
    if (!trimmedEmail || !trimmedEmail.includes('@')) {
      OpsklAlert.alert('Valid Email Required', 'Please enter a valid business email address.');
      return;
    }
    if (password.length < 6) {
      OpsklAlert.alert('Weak Password', 'Password must be at least 6 characters.');
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
      OpsklAlert.alert('Registration Failed', err?.message || 'Unable to register organizer account.');
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
        onBack={() => router.back()}
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
          }}
          style={{ marginBottom: spacing.lg }}
        />

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
              width: 22,
              height: 22,
              borderRadius: 11,
              backgroundColor: colors.primary,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ color: colors.textInverse, fontWeight: '900', fontSize: 13 }}>G</Text>
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
              onChange={setSignInMethod}
              style={{ marginBottom: spacing.md }}
            />

            <Input
              label="Business Email Address"
              value={email}
              onChangeText={setEmail}
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
                    <OtpInput value={otp} onChange={setOtp} autoFocus />
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
                      title="Resend Code"
                      variant="ghost"
                      size="sm"
                      disabled={loading}
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
                  onChangeText={setPassword}
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
              onChangeText={setBusinessName}
              placeholder="e.g. Apex Events & Media"
            />

            <Input
              label="Business Contact Number"
              value={phone}
              onChangeText={setPhone}
              placeholder="9820098200"
              keyboardType="phone-pad"
              autoComplete="tel"
              textContentType="telephoneNumber"
            />

            <Input
              label="Business Email Address"
              value={email}
              onChangeText={setEmail}
              placeholder="contact@apexevents.in"
              keyboardType="email-address"
              autoComplete="email"
              textContentType="emailAddress"
              autoCapitalize="none"
            />

            <PasswordInput
              label="Create Master Password"
              value={password}
              onChangeText={setPassword}
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
