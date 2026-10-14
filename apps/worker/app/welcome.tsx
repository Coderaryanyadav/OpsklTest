import { View, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useOpsklTheme, Button, Badge } from '@opskil/design-system';

export default function WorkerWelcomeScreen() {
  const router = useRouter();
  const { colors, spacing, radii, typography } = useOpsklTheme();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <View
        style={{
          flex: 1,
          padding: spacing.xl,
          justifyContent: 'space-between',
        }}
      >
        {/* Top Branding & Dev Badge */}
        <View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Badge label="WORKER PORTAL" variant="neutral" size="sm" />
            <Badge label="MUMBAI REGION" variant="info" size="sm" />
          </View>

          <View style={{ alignItems: 'center', marginTop: spacing.xxl }}>
            <View
              style={{
                width: 96,
                height: 96,
                borderRadius: 48,
                backgroundColor: colors.primary,
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: spacing.lg,
              }}
            >
              <Text style={{ fontSize: 44, color: '#FFFFFF' }}>⚡</Text>
            </View>

            <Text style={[typography.display, { color: colors.textPrimary, textAlign: 'center' }]}>
              OPSKL
            </Text>
            <Text
              style={[
                typography.subtitle,
                { color: colors.primary, textAlign: 'center', marginTop: 4 },
              ]}
            >
              Work Shifts. Guaranteed Daily Pay.
            </Text>
          </View>
        </View>

        {/* Feature Highlights */}
        <View style={{ gap: spacing.md }}>
          <View
            style={{
              backgroundColor: colors.surface,
              padding: spacing.md,
              borderRadius: radii.lg,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <Text style={{ fontSize: 15, fontWeight: '700', color: colors.textPrimary }}>
              💵 100% Transparent Daily Wages
            </Text>
            <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 2 }}>
              Fixed hourly rates (₹150 – ₹250/hr). Wages held in escrow and settled to your UPI.
            </Text>
          </View>

          <View
            style={{
              backgroundColor: colors.surface,
              padding: spacing.md,
              borderRadius: radii.lg,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <Text style={{ fontSize: 15, fontWeight: '700', color: colors.textPrimary }}>
              📍 Top Mumbai Exhibition Hubs
            </Text>
            <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 2 }}>
              Shifts at Jio World Convention Centre (BKC), NESCO (Goregaon), and CIDCO (Vashi).
            </Text>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={{ gap: spacing.sm }}>
          <Button
            title="Explore Available Shifts"
            variant="primary"
            size="lg"
            onPress={() => router.push('/(tabs)' as any)}
          />
          <Button
            title="Worker Sign In"
            variant="outline"
            size="md"
            onPress={() => router.push('/auth/login' as any)}
          />
          <Button
            title="New Worker Onboarding"
            variant="ghost"
            size="sm"
            onPress={() => router.push('/onboarding' as any)}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}
