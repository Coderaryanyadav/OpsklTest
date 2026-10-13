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
  const { sendPhoneOtp, verifyOtp } = useAuth();

  const [phone, setPhone] = useState(
    process.env.EXPO_PUBLIC_USE_DEMO_FIXTURES === 'true' ? '9819998199' : ''
  );
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSendOtp = async () => {
    if (phone.length < 10) {
      Alert.alert('Invalid Number', 'Please enter a valid 10-digit mobile number.');
      return;
    }
    setLoading(true);
    try {
      await sendPhoneOtp(phone);
      setOtpSent(true);
      Alert.alert(
        'OTP Sent',
        'Enter the 6-digit one-time password to access your organizer workspace.'
      );
    } catch (err: any) {
      Alert.alert(
        'Authentication Status',
        err?.message || 'Unable to dispatch SMS OTP. Verify SMS provider status in Supabase.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    if (otp.trim().length !== 6) {
      Alert.alert('Invalid Code', 'Please enter the complete 6-digit OTP code.');
      return;
    }
    setLoading(true);
    try {
      const res = await verifyOtp(phone, otp);
      if (res?.session) {
        Alert.alert('Verified', 'Organizer session authenticated.', [
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
          <Badge label="ORGANIZER AUTHENTICATION" variant="primary" size="sm" style={{ marginBottom: 4 }} />
          <Text style={{ fontSize: 12, color: colors.textSecondary, lineHeight: 18 }}>
            Authenticate organizer profile via verified mobile OTP. Ensures event roster modifications and escrow deposits are securely authorized.
          </Text>
        </View>

        <Card variant="outlined">
          <Text style={[typography.h2, { color: colors.textPrimary, marginBottom: 4 }]}>
            Organizer Access
          </Text>
          <Text style={{ fontSize: 13, color: colors.textSecondary, marginBottom: spacing.lg }}>
            Enter your authorized business phone number
          </Text>

          <Input
            label="Authorized Mobile Number"
            value={phone}
            onChangeText={setPhone}
            placeholder="98765 43210"
            prefix="+91"
            keyboardType="phone-pad"
            maxLength={10}
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
                label="Enter 6-Digit OTP"
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
                title="Edit Phone Number"
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
