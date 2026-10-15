import { useState } from 'react';
import { View, Text, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import {
  useOpsklTheme,
  useAuth,
  ScreenHeader,
  Input,
  Button,
  Card,
  Badge,
  KeyboardAwareContainer,
} from '@opskil/design-system';
import { fetchUserProfile, fetchWorkerProfile, supabase } from '@opskil/shared';

export default function WorkerLoginScreen() {
  const router = useRouter();
  const { redirect } = useLocalSearchParams<{ redirect?: string }>();
  const { colors, spacing, radii, typography } = useOpsklTheme();
  const { sendEmailOtp, verifyEmailOtp } = useAuth();

  const [email, setEmail] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSendOtp = async () => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !trimmed.includes('@') || !trimmed.includes('.')) {
      Alert.alert('Invalid Email', 'Please enter a valid email address (e.g. yourname@gmail.com).');
      return;
    }
    setLoading(true);
    try {
      await sendEmailOtp(trimmed, 'worker');
      setOtpSent(true);
      Alert.alert(
        'OTP Sent to Email',
        `A 6-digit verification code has been dispatched to ${trimmed}. Check your inbox or spam folder.`
      );
    } catch (err: any) {
      Alert.alert(
        'Authentication Status',
        err?.message || 'Unable to dispatch Email OTP. Please check your network connection.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    if (loading) return;
    const cleanOtp = otp.replace(/\D/g, '').trim();
    if (cleanOtp.length !== 6) {
      Alert.alert('Invalid Code', 'Please enter the complete 6-digit verification code.');
      return;
    }
    setLoading(true);
    try {
      const res = await verifyEmailOtp(email.trim().toLowerCase(), cleanOtp, 'worker');
      if (res?.session) {
        // Authoritative role check: verify worker account is active
        const profile = await fetchUserProfile(res.session.user.id);
        if (!profile || profile.isActive === false || (profile.role !== 'worker' && profile.role !== 'admin')) {
          await supabase.auth.signOut().catch(() => {});
          Alert.alert(
            'Unauthorized Account',
            profile && profile.role === 'organizer'
              ? 'This email is registered with an Organizer account. Please use the Opskl Organizer app.'
              : 'Unable to verify an active Worker account for this email.'
          );
          setLoading(false);
          return;
        }

        // Check if worker profile has completed profile onboarding
        let wp = null;
        try {
          wp = await fetchWorkerProfile(res.session.user.id);
        } catch {
          // Non-critical check failure
        }

        if (!wp || wp.profileCompletionStatus !== 'completed' || !wp.skills || wp.skills.length === 0) {
          const onboardingTarget = redirect
            ? `/onboarding?redirect=${encodeURIComponent(redirect)}`
            : '/onboarding';
          router.replace(onboardingTarget as any);
        } else {
          router.replace((redirect || '/(tabs)') as any);
        }
      } else {
        Alert.alert('Verification Pending', 'No active session was returned by the auth provider.');
      }
    } catch (err: any) {
      Alert.alert('Verification Failed', err?.message || 'The OTP code is invalid or has expired. Please request a new code.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title="Worker Login" onBack={() => router.back()} />

      <KeyboardAwareContainer contentContainerStyle={{ padding: spacing.xl }}>
        {/* Auth Notice */}
        <View
          style={{
            backgroundColor: colors.surfaceMuted,
            padding: spacing.md,
            borderRadius: radii.md,
            borderLeftWidth: 3,
            borderLeftColor: colors.primary,
            marginBottom: spacing.xl,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
            <Badge label="INSTANT ACCESS" variant="primary" size="sm" />
          </View>
          <Text style={{ fontSize: 12, color: colors.textSecondary, lineHeight: 18 }}>
            Enter your email to receive a 6-digit verification code. No password required.
          </Text>
        </View>

        <Card variant="outlined">
          <Text style={[typography.h2, { color: colors.textPrimary, marginBottom: 4 }]}>
            Sign In or Register
          </Text>
          <Text style={{ fontSize: 13, color: colors.textSecondary, marginBottom: spacing.lg }}>
            We'll send a 6-digit one-time password to your email inbox
          </Text>

          <Input
            label="Email Address"
            value={email}
            onChangeText={setEmail}
            placeholder="you@gmail.com"
            keyboardType="email-address"
            autoComplete="email"
            textContentType="emailAddress"
            autoCapitalize="none"
            editable={!otpSent}
          />

          {!otpSent ? (
            <Button
              title="Send Verification OTP"
              variant="primary"
              size="lg"
              loading={loading}
              onPress={handleSendOtp}
              style={{ marginTop: spacing.sm }}
            />
          ) : (
            <>
              <Input
                label="Enter 6-Digit Verification Code"
                value={otp}
                onChangeText={setOtp}
                placeholder="123456"
                keyboardType="number-pad"
                autoComplete="one-time-code"
                textContentType="oneTimeCode"
                maxLength={6}
              />
              <Button
                title="Verify OTP & Sign In"
                variant="primary"
                size="lg"
                loading={loading}
                disabled={loading}
                onPress={handleVerify}
                style={{ marginTop: spacing.sm }}
              />
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.xs }}>
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
          )}
        </Card>
      </KeyboardAwareContainer>
    </SafeAreaView>
  );
}
