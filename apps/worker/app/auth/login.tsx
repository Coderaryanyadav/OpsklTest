import { useState } from 'react';
import { View, Text, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
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
import { fetchUserProfile, supabase } from '@opskil/shared';

export default function WorkerLoginScreen() {
  const router = useRouter();
  const { colors, spacing, radii, typography } = useOpsklTheme();
  const { sendEmailOtp, verifyEmailOtp } = useAuth();

  const [email, setEmail] = useState(
    process.env.EXPO_PUBLIC_USE_DEMO_FIXTURES === 'true' ? 'worker.demo@opskil.com' : ''
  );
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
    if (otp.trim().length !== 6) {
      Alert.alert('Invalid Code', 'Please enter the complete 6-digit verification code.');
      return;
    }
    setLoading(true);
    try {
      const res = await verifyEmailOtp(email.trim().toLowerCase(), otp, 'worker');
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

        Alert.alert('Verified', 'Session authenticated successfully.', [
          { text: 'Continue', onPress: () => router.replace('/(tabs)' as any) },
        ]);
      } else {
        Alert.alert('Verification Pending', 'No active session was returned by the auth provider.');
      }
    } catch (err: any) {
      Alert.alert('Verification Failed', err?.message || 'The OTP code is invalid or has expired.');
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
            <Badge label="GMAIL / EMAIL OTP ENABLED" variant="primary" size="sm" />
          </View>
          <Text style={{ fontSize: 12, color: colors.textSecondary, lineHeight: 18 }}>
            Fast, carrier-independent authentication via Gmail / Email OTP. Enter your email to receive a 6-digit verification code.
          </Text>
        </View>

        <Card variant="outlined">
          <Text style={[typography.h2, { color: colors.textPrimary, marginBottom: 4 }]}>
            Enter Email Address
          </Text>
          <Text style={{ fontSize: 13, color: colors.textSecondary, marginBottom: spacing.lg }}>
            We'll send a 6-digit one-time password to your email inbox
          </Text>

          <Input
            label="Gmail / Email Address"
            value={email}
            onChangeText={setEmail}
            placeholder="you@gmail.com"
            keyboardType="email-address"
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
                label="Enter 6-Digit Email OTP"
                value={otp}
                onChangeText={setOtp}
                placeholder="123456"
                keyboardType="number-pad"
                maxLength={6}
              />
              <Button
                title="Verify OTP & Sign In"
                variant="primary"
                size="lg"
                loading={loading}
                onPress={handleVerify}
                style={{ marginTop: spacing.sm }}
              />
              <Button
                title="Change Email Address"
                variant="ghost"
                size="sm"
                onPress={() => {
                  setOtpSent(false);
                  setOtp('');
                }}
                style={{ marginTop: spacing.xs }}
              />
            </>
          )}
        </Card>
      </KeyboardAwareContainer>
    </SafeAreaView>
  );
}
