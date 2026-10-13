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

export default function OrganizerLoginScreen() {
  const router = useRouter();
  const { colors, spacing, radii, typography } = useOpsklTheme();
  const { sendEmailOtp, verifyEmailOtp } = useAuth();

  const [email, setEmail] = useState(
    process.env.EXPO_PUBLIC_USE_DEMO_FIXTURES === 'true' ? 'organizer.demo@opskil.com' : ''
  );
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSendOtp = async () => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !trimmed.includes('@') || !trimmed.includes('.')) {
      Alert.alert('Invalid Email', 'Please enter a valid business email address (e.g. host@gmail.com).');
      return;
    }
    setLoading(true);
    try {
      await sendEmailOtp(trimmed, 'organizer');
      setOtpSent(true);
      Alert.alert(
        'OTP Sent to Email',
        `A 6-digit verification code has been dispatched to ${trimmed}. Check your inbox to access your workspace.`
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
      const res = await verifyEmailOtp(email.trim().toLowerCase(), otp, 'organizer');
      if (res?.session) {
        Alert.alert('Verified', 'Organizer session authenticated successfully.', [
          { text: 'Open Dashboard', onPress: () => router.replace('/(tabs)' as any) },
        ]);
      } else {
        Alert.alert('Verification Pending', 'No session was returned by Supabase.');
      }
    } catch (err: any) {
      Alert.alert('Verification Failed', err?.message || 'Invalid or expired OTP.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title="Organizer Sign In" onBack={() => router.back()} />

      <KeyboardAwareContainer contentContainerStyle={{ padding: spacing.xl }}>
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
          <Badge label="GMAIL / EMAIL OTP AUTHENTICATION" variant="primary" size="sm" style={{ marginBottom: 4 }} />
          <Text style={{ fontSize: 12, color: colors.textSecondary, lineHeight: 18 }}>
            Authenticate organizer workspace via Gmail / Email OTP. Ensures event listings, shift rosters, and escrow deposits are securely managed.
          </Text>
        </View>

        <Card variant="outlined">
          <Text style={[typography.h2, { color: colors.textPrimary, marginBottom: 4 }]}>
            Organizer Access
          </Text>
          <Text style={{ fontSize: 13, color: colors.textSecondary, marginBottom: spacing.lg }}>
            Enter your authorized business email address
          </Text>

          <Input
            label="Gmail / Business Email Address"
            value={email}
            onChangeText={setEmail}
            placeholder="host@gmail.com"
            keyboardType="email-address"
            autoCapitalize="none"
            editable={!otpSent}
          />

          {!otpSent ? (
            <Button
              title="Request Verification OTP"
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
                title="Verify OTP & Open Dashboard"
                variant="primary"
                size="lg"
                loading={loading}
                onPress={handleVerify}
                style={{ marginTop: spacing.sm }}
              />
              <Button
                title="Edit Email Address"
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
