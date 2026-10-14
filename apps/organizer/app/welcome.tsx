import { View, Text, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useOpsklTheme, Button, Badge } from '@opskil/design-system';
import { Users, ShieldCheck, Building2, ArrowRight } from 'lucide-react-native';

export default function OrganizerWelcomeScreen() {
  const router = useRouter();
  const { colors, spacing, radii, typography } = useOpsklTheme();

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <View style={[styles.container, { padding: spacing.xl }]}>
        {/* Top Header */}
        <View>
          <View style={styles.badgeRow}>
            <Badge label="ORGANIZER OPERATIONS" variant="neutral" size="sm" withDot={false} />
            <Badge label="MUMBAI REGION" variant="neutral" size="sm" />
          </View>

          <View style={[styles.heroBlock, { marginTop: spacing.xxl }]}>
            {/* Minimalist Monogram */}
            <View
              style={[
                styles.monogramBadge,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                },
              ]}
            >
              <Building2 size={32} color={colors.textPrimary} strokeWidth={2} />
            </View>

            <Text style={[typography.display, { color: colors.textPrimary, textAlign: 'center' }]}>
              OPSKL
            </Text>
            <Text
              style={[
                typography.subtitle,
                {
                  color: colors.textSecondary,
                  textAlign: 'center',
                  marginTop: 6,
                  fontWeight: '500',
                },
              ]}
            >
              Event crew management and staffing console
            </Text>
          </View>
        </View>

        {/* Value Proposition Cards — Strict Monochrome */}
        <View style={{ gap: spacing.sm }}>
          <View
            style={[
              styles.featureCard,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                borderRadius: radii.md,
                padding: spacing.md,
              },
            ]}
          >
            <View style={styles.cardHeaderRow}>
              <View
                style={[
                  styles.iconWrap,
                  { backgroundColor: colors.surfaceMuted, borderColor: colors.border },
                ]}
              >
                <Users size={16} color={colors.textPrimary} strokeWidth={2.2} />
              </View>
              <View style={{ flex: 1, marginLeft: spacing.sm }}>
                <Text style={{ fontSize: 14, fontWeight: '700', color: colors.textPrimary }}>
                  Verified Candidate Review
                </Text>
                <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 2, lineHeight: 18 }}>
                  Review verified worker credentials, experience, and reliability ratings before confirming bookings.
                </Text>
              </View>
            </View>
          </View>

          <View
            style={[
              styles.featureCard,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                borderRadius: radii.md,
                padding: spacing.md,
              },
            ]}
          >
            <View style={styles.cardHeaderRow}>
              <View
                style={[
                  styles.iconWrap,
                  { backgroundColor: colors.surfaceMuted, borderColor: colors.border },
                ]}
              >
                <ShieldCheck size={16} color={colors.textPrimary} strokeWidth={2.2} />
              </View>
              <View style={{ flex: 1, marginLeft: spacing.sm }}>
                <Text style={{ fontSize: 14, fontWeight: '700', color: colors.textPrimary }}>
                  Transparent Escrow & Settlement
                </Text>
                <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 2, lineHeight: 18 }}>
                  Staffing funds remain protected in escrow until event completion and supervisor attendance approval.
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Clear Actions */}
        <View style={{ gap: spacing.sm }}>
          <View style={styles.dualActionContainer}>
            <Button
              title="Open Operations Dashboard"
              variant="primary"
              size="lg"
              onPress={() => router.push('/(tabs)' as any)}
            />

            <Button
              title="Organizer Sign In"
              variant="outline"
              size="md"
              onPress={() => router.push('/auth/login' as any)}
            />
          </View>

          <Pressable
            onPress={() => router.push('/(tabs)/create' as any)}
            style={({ pressed }) => [
              styles.createLink,
              { opacity: pressed ? 0.7 : 1 },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Create a new shift"
          >
            <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textSecondary }}>
              Have an upcoming event? Create and publish a shift
            </Text>
            <ArrowRight size={14} color={colors.textSecondary} strokeWidth={2} style={{ marginLeft: 4 }} />
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
    justifyContent: 'space-between',
  },
  badgeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  heroBlock: {
    alignItems: 'center',
  },
  monogramBadge: {
    width: 68,
    height: 68,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 1,
  },
  featureCard: {
    borderWidth: 1,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  dualActionContainer: {
    gap: 8,
  },
  createLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
});
