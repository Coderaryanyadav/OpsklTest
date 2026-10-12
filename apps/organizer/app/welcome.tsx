import { View, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useOpsklTheme, Button, Badge } from '@opskil/design-system';

export default function OrganizerWelcomeScreen() {
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
        {/* Top Header & Dev Badge */}
        <View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Badge label="ORGANIZER CONSOLE" variant="primary" size="sm" />
            <Badge label="PHASE 1 BUILD" variant="neutral" size="sm" />
          </View>

          <View style={{ alignItems: 'center', marginTop: spacing.xxl }}>
            <View
              style={{
                width: 96,
                height: 96,
                borderRadius: radii.xl,
                backgroundColor: colors.surface,
                borderWidth: 2,
                borderColor: colors.primary,
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: spacing.lg,
              }}
            >
              <Text style={{ fontSize: 44 }}>🏢</Text>
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
              Reliable Single-Day Event Crews
            </Text>
          </View>
        </View>

        {/* Feature Callouts */}
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
              👥 Explicit Crew Vetting
            </Text>
            <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 2 }}>
              Never auto-assigned. Review verified Aadhaar-badged workers and select your roster.
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
              🛡️ Secure Escrow Wage Holding
            </Text>
            <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 2 }}>
              Deposit wages securely before shifts start. Payouts release upon attendance sign-off.
            </Text>
          </View>
        </View>

        {/* Navigation CTAs */}
        <View style={{ gap: spacing.sm }}>
          <Button
            title="Open Organizer Console"
            variant="primary"
            size="lg"
            onPress={() => router.push('/(tabs)' as any)}
          />
          <Button
            title="Organizer Sign In (Placeholder)"
            variant="outline"
            size="md"
            onPress={() => router.push('/auth/login' as any)}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}
