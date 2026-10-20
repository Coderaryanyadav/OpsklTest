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
import { ShieldCheck, ArrowRight, Clock } from 'lucide-react-native';
import { universalStorage } from '@opskil/shared';

export default function WorkerWelcomeScreen() {
  const router = useRouter();
  const { colors, spacing, typography, touchTarget } = useOpsklTheme();

  const handleNavigate = async (target: string, replace = false) => {
    try {
      await universalStorage.setItem('@opskil_worker_welcome_seen', 'true');
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
    <Screen edges={['top', 'bottom', 'left', 'right']} contentStyle={{ padding: spacing.xl, justifyContent: 'space-between' }}>
      <View>
        <View style={styles.badgeRow}>
          <Badge label="OPSKL MARKETPLACE" variant="neutral" size="sm" withDot={false} />
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
            <Text
              style={{
                fontSize: 32,
                fontWeight: '900',
                color: colors.textInverse,
                letterSpacing: -1,
              }}
            >
              O
            </Text>
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
            Single-day event staffing marketplace
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
              <Clock size={16} color={colors.primary} strokeWidth={2.2} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[typography.bodyBold, { color: colors.textPrimary }]}>
                Single-Day Shifts
              </Text>
              <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 2, lineHeight: 18 }]}>
                Discover verified exhibition, hospitality, and corporate event positions.
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
                Direct UPI Payouts
              </Text>
              <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 2, lineHeight: 18 }]}>
                Agreed daily wages are paid to your UPI ID after supervisor attendance approval.
              </Text>
            </View>
          </View>
        </View>
      </View>

      <View style={{ gap: spacing.sm }}>
        <Button
          title="Sign In to Opskl Account"
          variant="primary"
          size="lg"
          onPress={() => handleNavigate('/auth/login')}
        />
        <Button
          title="Register as New Worker"
          variant="secondary"
          size="md"
          onPress={() => handleNavigate('/auth/login?mode=signup')}
        />

        <Pressable
          onPress={() => handleNavigate('/(tabs)', true)}
          style={({ pressed }) => [
            styles.onboardingLink,
            { minHeight: touchTarget.min, opacity: pressed ? 0.7 : 1 },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Explore open shifts as guest"
        >
          <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textSecondary }}>
            Explore available shifts as guest
          </Text>
          <ArrowRight size={14} color={colors.textSecondary} strokeWidth={2} style={{ marginLeft: 4 }} />
        </Pressable>

        <View style={[styles.footerRow, { borderTopColor: colors.border, paddingTop: spacing.sm }]}>
          <Text style={{ fontSize: 11, color: colors.textMuted, textAlign: 'center' }}>
            Looking to hire event crew? Use the{' '}
            <Text
              style={{ color: colors.textPrimary, fontWeight: '700', textDecorationLine: 'underline' }}
              onPress={() => {
                OpsklAlert.alert(
                  'Organizer Console',
                  'Opskl Organizer is available for event hosts, production agencies, and brands. Open the Opskl Organizer app or contact support@opskil.com.'
                );
              }}
            >
              Opskl Organizer Portal
            </Text>
          </Text>
          <Text style={{ fontSize: 10, color: colors.textMuted, textAlign: 'center', marginTop: 4 }}>
            By continuing, you agree to Opskl's Terms of Service & Privacy Policy.
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
  onboardingLink: {
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
