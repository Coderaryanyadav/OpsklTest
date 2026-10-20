import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import {
  useOpsklTheme,
  Button,
  Badge,
  Screen,
  Divider,
  OpsklAlert,
} from '@opskil/design-system';
import { Users, ShieldCheck, ArrowRight, Building2 } from 'lucide-react-native';
import { universalStorage } from '@opskil/shared';

export default function OrganizerWelcomeScreen() {
  const router = useRouter();
  const { colors, spacing, typography, touchTarget } = useOpsklTheme();

  const handleNavigate = async (target: string, replace = false) => {
    try {
      await universalStorage.setItem('@opskil_organizer_welcome_seen', 'true');
    } catch {
      // Non-critical
    }
    if (replace) {
      router.replace(target as any);
    } else {
      router.push(target as any);
    }
  };

  return (
    <Screen
      edges={['top', 'bottom', 'left', 'right']}
      contentStyle={{ padding: spacing.xl, justifyContent: 'space-between' }}
    >
      <View>
        <View style={styles.badgeRow}>
          <Badge label="ORGANIZER OPERATIONS" variant="neutral" size="sm" withDot={false} />
          <Badge label="MUMBAI REGION" variant="neutral" size="sm" />
        </View>

        <View style={[styles.heroBlock, { marginTop: spacing.xxl }]}>
          <View
            style={[
              styles.monogramBadge,
              {
                backgroundColor: colors.primary,
                borderColor: colors.border,
              },
            ]}
          >
            <Building2 size={28} color={colors.textInverse} strokeWidth={2} />
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
              },
            ]}
          >
            Event crew management and staffing console
          </Text>
        </View>

        <View style={{ marginTop: spacing.xxl, gap: spacing.md }}>
          <View style={styles.featureRow}>
            <View
              style={[
                styles.iconWrap,
                { backgroundColor: colors.surfaceSecondary, borderColor: colors.border },
              ]}
            >
              <Users size={16} color={colors.primary} strokeWidth={2.2} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[typography.bodyBold, { color: colors.textPrimary }]}>
                Verified Candidate Review
              </Text>
              <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 2, lineHeight: 18 }]}>
                Review credentials, experience, and reliability before confirming bookings.
              </Text>
            </View>
          </View>

          <Divider />

          <View style={styles.featureRow}>
            <View
              style={[
                styles.iconWrap,
                { backgroundColor: colors.surfaceSecondary, borderColor: colors.border },
              ]}
            >
              <ShieldCheck size={16} color={colors.primary} strokeWidth={2.2} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[typography.bodyBold, { color: colors.textPrimary }]}>
                Escrow Settlement
              </Text>
              <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 2, lineHeight: 18 }]}>
                Staffing funds stay protected until event completion and supervisor attendance approval.
              </Text>
            </View>
          </View>
        </View>
      </View>

      <View style={{ gap: spacing.sm }}>
        <Button
          title="Sign In to Organizer Account"
          variant="primary"
          size="lg"
          onPress={() => handleNavigate('/auth/login')}
        />
        <Button
          title="Register New Organization"
          variant="secondary"
          size="md"
          onPress={() => handleNavigate('/auth/login?mode=signup')}
        />

        <Pressable
          onPress={() => handleNavigate('/(tabs)', true)}
          style={({ pressed }) => [
            styles.guestLink,
            { minHeight: touchTarget.min, opacity: pressed ? 0.7 : 1 },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Explore operations dashboard as guest"
        >
          <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textSecondary }}>
            Explore operations dashboard as guest
          </Text>
          <ArrowRight size={14} color={colors.textSecondary} strokeWidth={2} style={{ marginLeft: 4 }} />
        </Pressable>

        <View style={[styles.footerRow, { borderTopColor: colors.border, paddingTop: spacing.sm }]}>
          <Text style={{ fontSize: 11, color: colors.textMuted, textAlign: 'center' }}>
            Looking for single-day event work? Use the{' '}
            <Text
              style={{ color: colors.textPrimary, fontWeight: '700', textDecorationLine: 'underline' }}
              onPress={() => {
                OpsklAlert.alert(
                  'Worker Portal',
                  'Opskl Worker is available for event crew, ushers, and hospitality staff. Open the Opskl Worker app or contact support@opskil.com.'
                );
              }}
            >
              Opskl Worker App
            </Text>
          </Text>
          <Text style={{ fontSize: 10, color: colors.textMuted, textAlign: 'center', marginTop: 4 }}>
            By continuing, you agree to Opskl's Organizer Terms of Service & Privacy Policy.
          </Text>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
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
  featureRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  guestLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  footerRow: {
    borderTopWidth: 1,
    marginTop: 4,
  },
});
