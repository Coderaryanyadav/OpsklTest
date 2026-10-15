import { useState, useEffect } from 'react';
import { View, Text, Alert, TouchableOpacity, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as Linking from 'expo-linking';
import {
  useOpsklTheme,
  useAuth,
  ScreenHeader,
  Input,
  Button,
  Card,
  KeyboardAwareContainer,
} from '@opskil/design-system';
import { fetchUserProfile, supabase } from '@opskil/shared';

type AuthMode = 'signin' | 'signup';
type SignInMethod = 'otp' | 'password';

export default function OrganizerLoginScreen() {
  const router = useRouter();
  const { redirect } = useLocalSearchParams<{ redirect?: string }>();
  const { colors, spacing, radii, typography } = useOpsklTheme();
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

  const [mode, setMode] = useState<AuthMode>('signin');
  const [signInMethod, setSignInMethod] = useState<SignInMethod>('otp');

  // Form State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [phone, setPhone] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);

  // Forgot Password Modal
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetLoading, setResetLoading] = useState(false);

  // Deep Link / OAuth Callback
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
          Alert.alert('Authentication Error', err?.message || 'Failed to complete OAuth callback.');
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
    if (!profile || profile.isActive === false || (profile.role !== 'organizer' && profile.role !== 'admin')) {
      await supabase.auth.signOut().catch(() => {});
      Alert.alert(
        'Unauthorized Account',
        profile && profile.role === 'worker'
          ? 'This account is registered with a Worker profile. Please sign in via the Opskl Worker app.'
          : 'Unable to verify an active Organizer account for this identity.'
      );
      return;
    }

    router.replace((redirect || '/(tabs)') as any);
  };

  const handleSendOtp = async () => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !trimmed.includes('@') || !trimmed.includes('.')) {
      Alert.alert('Invalid Email', 'Please enter a valid business email address.');
      return;
    }
    setLoading(true);
    try {
      await sendEmailOtp(trimmed, 'organizer');
      setOtpSent(true);
      Alert.alert('OTP Sent', `A 6-digit verification code has been dispatched to ${trimmed}. Check your inbox.`);
    } catch (err: any) {
      Alert.alert('Authentication Status', err?.message || 'Unable to dispatch Email OTP.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (loading) return;
    const cleanOtp = otp.replace(/\D/g, '').trim();
    if (cleanOtp.length !== 6) {
      Alert.alert('Invalid Code', 'Please enter the complete 6-digit code.');
      return;
    }
    setLoading(true);
    try {
      const res = await verifyEmailOtp(email.trim().toLowerCase(), cleanOtp, 'organizer');
      if (res?.session) {
        await handlePostAuthRoute(res.session.user.id);
      } else {
        Alert.alert('Verification Pending', 'No session was returned by Supabase.');
      }
    } catch (err: any) {
      Alert.alert('Verification Failed', err?.message || 'Invalid or expired OTP code.');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordSignIn = async () => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !password) {
      Alert.alert('Missing Fields', 'Please enter both your business email and password.');
      return;
    }
    setLoading(true);
    try {
      const res = await signInWithPassword(trimmed, password, 'organizer');
      if (res?.session) {
        await handlePostAuthRoute(res.session.user.id);
      }
    } catch (err: any) {
      Alert.alert('Sign-In Failed', err?.message || 'Invalid email or password.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async () => {
    const trimmedEmail = email.trim().toLowerCase();
    const trimmedOrg = businessName.trim();
    const cleanPhone = phone.replace(/\D/g, '');

    if (!trimmedOrg || trimmedOrg.length < 2) {
      Alert.alert('Organization Name Required', 'Please enter your organization or agency name.');
      return;
    }
    if (cleanPhone.length < 10) {
      Alert.alert('Valid Phone Required', 'Please enter a 10-digit business contact number.');
      return;
    }
    if (!trimmedEmail || !trimmedEmail.includes('@')) {
      Alert.alert('Valid Email Required', 'Please enter a valid business email address.');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Weak Password', 'Password must be at least 6 characters.');
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
      } else if (res?.user && !res.session) {
        Alert.alert(
          'Verification Email Sent',
          `An activation link has been sent to ${trimmedEmail}. Please verify before logging in.`,
          [{ text: 'OK', onPress: () => setMode('signin') }]
        );
      }
    } catch (err: any) {
      Alert.alert('Registration Failed', err?.message || 'Unable to register organizer account.');
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
        if (typeof window !== 'undefined' && window.location) {
          window.location.href = res.url;
        } else {
          await Linking.openURL(res.url);
        }
      }
    } catch (err: any) {
      Alert.alert('Google Sign-In Error', err?.message || 'Could not initiate Google OAuth.');
    } finally {
      setLoading(false);
    }
  };

  const handleSendResetEmail = async () => {
    const trimmed = resetEmail.trim().toLowerCase();
    if (!trimmed || !trimmed.includes('@')) {
      Alert.alert('Invalid Email', 'Please enter a valid email address.');
      return;
    }
    setResetLoading(true);
    try {
      const redirectUrl = Linking.createURL('/auth/login');
      await sendPasswordReset(trimmed, redirectUrl);
      Alert.alert('Reset Instructions Sent', `Password reset link has been dispatched to ${trimmed}.`);
      setShowForgotModal(false);
      setResetEmail('');
    } catch (err: any) {
      Alert.alert('Reset Failed', err?.message || 'Unable to dispatch password reset link.');
    } finally {
      setResetLoading(false);
    }
  };

  const handleResendVerification = async () => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !trimmed.includes('@')) {
      Alert.alert('Email Required', 'Please enter your email above to resend verification.');
      return;
    }
    setLoading(true);
    try {
      await resendVerification(trimmed);
      Alert.alert('Verification Sent', `A new verification email has been dispatched to ${trimmed}.`);
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Unable to resend verification email.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader
        title={mode === 'signin' ? 'Organizer Sign In' : 'Register Organization'}
        onBack={() => router.back()}
      />

      <KeyboardAwareContainer contentContainerStyle={{ padding: spacing.xl, paddingBottom: 60 }}>
        {/* Mode Selector Tabs */}
        <View
          style={{
            flexDirection: 'row',
            backgroundColor: colors.surfaceMuted,
            borderRadius: radii.md,
            padding: 4,
            marginBottom: spacing.lg,
          }}
        >
          <TouchableOpacity
            onPress={() => {
              setMode('signin');
              setOtpSent(false);
            }}
            style={{
              flex: 1,
              paddingVertical: 10,
              alignItems: 'center',
              backgroundColor: mode === 'signin' ? colors.surface : 'transparent',
              borderRadius: radii.sm,
            }}
          >
            <Text
              style={{
                fontSize: 13,
                fontWeight: '700',
                color: mode === 'signin' ? colors.textPrimary : colors.textMuted,
              }}
            >
              Sign In
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => {
              setMode('signup');
              setOtpSent(false);
            }}
            style={{
              flex: 1,
              paddingVertical: 10,
              alignItems: 'center',
              backgroundColor: mode === 'signup' ? colors.surface : 'transparent',
              borderRadius: radii.sm,
            }}
          >
            <Text
              style={{
                fontSize: 13,
                fontWeight: '700',
                color: mode === 'signup' ? colors.textPrimary : colors.textMuted,
              }}
            >
              Register Organization
            </Text>
          </TouchableOpacity>
        </View>

        {/* Google OAuth Button */}
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
            paddingVertical: 12,
            marginBottom: spacing.md,
            gap: 10,
          }}
        >
          <View
            style={{
              width: 22,
              height: 22,
              borderRadius: 11,
              backgroundColor: '#000000',
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

        {/* Divider */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginVertical: spacing.md }}>
          <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
          <Text style={{ marginHorizontal: 12, fontSize: 12, color: colors.textMuted, fontWeight: '600' }}>
            OR WITH BUSINESS EMAIL
          </Text>
          <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
        </View>

        {mode === 'signin' ? (
          <Card variant="outlined">
            {/* Sign-in Method Tabs */}
            <View style={{ flexDirection: 'row', gap: 12, marginBottom: spacing.md }}>
              <TouchableOpacity
                onPress={() => setSignInMethod('otp')}
                style={{
                  borderBottomWidth: 2,
                  borderBottomColor: signInMethod === 'otp' ? colors.primary : 'transparent',
                  paddingBottom: 6,
                }}
              >
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: '700',
                    color: signInMethod === 'otp' ? colors.textPrimary : colors.textMuted,
                  }}
                >
                  Email One-Time OTP
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setSignInMethod('password')}
                style={{
                  borderBottomWidth: 2,
                  borderBottomColor: signInMethod === 'password' ? colors.primary : 'transparent',
                  paddingBottom: 6,
                }}
              >
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: '700',
                    color: signInMethod === 'password' ? colors.textPrimary : colors.textMuted,
                  }}
                >
                  Email & Password
                </Text>
              </TouchableOpacity>
            </View>

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
                  style={{ marginTop: spacing.sm }}
                />
              ) : (
                <>
                  <Input
                    label="Enter 6-Digit Code"
                    value={otp}
                    onChangeText={setOtp}
                    placeholder="123456"
                    keyboardType="number-pad"
                    autoComplete="one-time-code"
                    textContentType="oneTimeCode"
                    maxLength={6}
                  />
                  <Button
                    title="Verify OTP & Open Workspace"
                    variant="primary"
                    size="lg"
                    loading={loading}
                    disabled={loading}
                    onPress={handleVerifyOtp}
                    style={{ marginTop: spacing.sm }}
                  />
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.xs }}>
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
                <Input
                  label="Password"
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Enter secure password"
                  secureTextEntry
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
                  style={{ marginTop: spacing.sm }}
                />
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.sm }}>
                  <TouchableOpacity onPress={() => setShowForgotModal(true)}>
                    <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textSecondary }}>
                      Forgot Password?
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity onPress={handleResendVerification}>
                    <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textMuted }}>
                      Resend Verification Email
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </Card>
        ) : (
          /* Register Organization Form */
          <Card variant="outlined">
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

            <Input
              label="Create Master Password"
              value={password}
              onChangeText={setPassword}
              placeholder="Min. 6 characters"
              secureTextEntry
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
          </Card>
        )}
      </KeyboardAwareContainer>

      {/* Forgot Password Modal */}
      <Modal visible={showForgotModal} transparent animationType="slide">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: spacing.xl }}>
          <View style={{ backgroundColor: colors.surface, borderRadius: radii.xl, padding: spacing.xl, gap: spacing.md }}>
            <Text style={[typography.h3, { color: colors.textPrimary }]}>Reset Password</Text>
            <Text style={{ fontSize: 13, color: colors.textSecondary }}>
              Enter your registered business email address to receive password reset instructions.
            </Text>
            <Input
              label="Business Email Address"
              value={resetEmail}
              onChangeText={setResetEmail}
              placeholder="organizer@agency.com"
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
              <Button
                title="Cancel"
                variant="outline"
                size="md"
                onPress={() => setShowForgotModal(false)}
                style={{ flex: 1 }}
              />
              <Button
                title={resetLoading ? 'Sending...' : 'Send Reset Link'}
                variant="primary"
                size="md"
                disabled={resetLoading}
                onPress={handleSendResetEmail}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
