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

export default function WorkerLoginScreen() {
  const router = useRouter();
  const { colors, spacing, radii, typography } = useOpsklTheme();
  const { sendPhoneOtp, verifyOtp } = useAuth();

  const [phone, setPhone] = useState('9820098200');
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSendOtp = async () => {
    if (phone.length < 10) {
      Alert.alert('Invalid Number', 'Please enter a valid 10-digit Indian mobile number.');
      return;
    }
    setLoading(true);
    try {
      await sendPhoneOtp(phone);
      setOtpSent(true);
      Alert.alert(
        'OTP Dispatched',
        'If your SMS provider is connected in Supabase, enter the 6-digit OTP received on your mobile device.'
      );
    } catch (err: any) {
      Alert.alert(
        'Authentication Status',
        err?.message || 'Unable to dispatch SMS OTP. Please ensure Supabase Auth SMS provider is configured.'
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
      const res = await verifyOtp(phone, otp);
      if (res?.session) {
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
            <Badge label="SUPABASE AUTH ENABLED" variant="primary" size="sm" />
          </View>
          <Text style={{ fontSize: 12, color: colors.textSecondary, lineHeight: 18 }}>
            Real native phone OTP authentication via Supabase Auth. Enter your registered 10-digit mobile number to verify session.
          </Text>
        </View>

        <Card variant="outlined">
          <Text style={[typography.h2, { color: colors.textPrimary, marginBottom: 4 }]}>
            Enter Mobile Number
          </Text>
          <Text style={{ fontSize: 13, color: colors.textSecondary, marginBottom: spacing.lg }}>
            We'll send a 6-digit one-time password to verify your account
          </Text>

          <Input
            label="Mobile Number"
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
                label="Enter 6-Digit OTP"
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
                title="Change Phone Number"
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
