import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import {
  useOpsklTheme,
  Button,
  Screen,
  OpsklAlert,
} from '@opskil/design-system';
import {
  ArrowRight,
  Clock,
  MapPin,
  CircleDollarSign,
  Building2,
  CheckCircle2,
  TrendingUp,
  ShieldAlert,
} from 'lucide-react-native';
import { universalStorage } from '@opskil/shared';

export default function WorkerWelcomeScreen() {
  const router = useRouter();
  const { colors, spacing, typography, touchTarget, borders } = useOpsklTheme();

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
    <Screen edges={['top', 'bottom', 'left', 'right']} contentStyle={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl }} showsVerticalScrollIndicator={false}>
        {/* Top Header Pill & Region */}
        <View style={styles.topHeader}>
          <View style={[styles.statusPill, { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: borders.hairline }]}>
            <View style={[styles.pulseDot, { backgroundColor: colors.accent }]} />
            <Text style={[styles.statusText, { color: colors.textPrimary }]}>
              Opskl Staff Portal
            </Text>
          </View>
          <View style={styles.regionBadge}>
            <CheckCircle2 size={14} color={colors.accent} />
            <Text style={[styles.regionText, { color: colors.textSecondary }]}>
              Mumbai Region
            </Text>
          </View>
        </View>

        {/* Editorial Hero Framing */}
        <View style={{ marginTop: spacing.lg }}>
          <View style={[styles.categoryChip, { backgroundColor: colors.surfaceMuted, borderColor: colors.border, borderWidth: borders.hairline }]}>
            <Text style={[styles.categoryText, { color: colors.accent }]}>
              Single-Day & Event Staffing in Mumbai
            </Text>
          </View>
          <Text style={[typography.h1, { color: colors.textPrimary, marginTop: spacing.xs, letterSpacing: -0.5 }]}>
            Premium on-demand shifts across premier Mumbai venues.
          </Text>
          <Text style={[typography.body, { color: colors.textSecondary, marginTop: spacing.xs, lineHeight: 22 }]}>
            High-trust hospitality, concierge, and live production roles with transparent payout schedules and verified shifts.
          </Text>
        </View>

        {/* Active Hubs Banner */}
        <View style={[styles.activeHubsCard, { backgroundColor: colors.primary, borderColor: colors.border, borderWidth: borders.hairline }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Building2 size={16} color={colors.accent} />
              <Text style={{ fontSize: 13, fontWeight: '700', color: colors.textInverse, letterSpacing: -0.2 }}>
                Active Hubs: BKC • NESCO • South Mumbai
              </Text>
            </View>
            <View style={[styles.liveOpsBadge, { backgroundColor: 'rgba(255, 255, 255, 0.15)' }]}>
              <Text style={{ fontSize: 10, fontWeight: '800', color: colors.textInverse, letterSpacing: 0.5 }}>
                MUMBAI HUBS
              </Text>
            </View>
          </View>
        </View>

        {/* 3 Core Value Proposition Cards */}
        <View style={{ marginTop: spacing.lg, gap: spacing.sm }}>
          {/* Card 1 */}
          <View style={[styles.valueCard, { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: borders.hairline }]}>
            <View style={[styles.iconWrap, { backgroundColor: colors.surfaceMuted }]}>
              <CircleDollarSign size={20} color={colors.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={[typography.bodyBold, { color: colors.textPrimary }]}>
                  Transparent Shift Pay
                </Text>
                <View style={[styles.tagPill, { backgroundColor: colors.surfaceMuted }]}>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: colors.accent }}>₹ shown</Text>
                </View>
              </View>
              <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 4, lineHeight: 18 }]}>
                Clear ₹/hour and ₹/shift wage shown before you apply. Attendance approved does not mean paid until ledger settlement.
              </Text>
            </View>
          </View>

          {/* Card 2 */}
          <View style={[styles.valueCard, { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: borders.hairline }]}>
            <View style={[styles.iconWrap, { backgroundColor: colors.surfaceMuted }]}>
              <MapPin size={20} color={colors.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={[typography.bodyBold, { color: colors.textPrimary }]}>
                  Verified Event Venues
                </Text>
                <View style={[styles.tagPill, { backgroundColor: colors.surfaceMuted }]}>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textSecondary }}>Tier-1</Text>
                </View>
              </View>
              <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 4, lineHeight: 18 }]}>
                Direct assignments at Jio World Convention Centre (BKC), NESCO Goregaon, and premier South Mumbai properties.
              </Text>
            </View>
          </View>

          {/* Card 3 */}
          <View style={[styles.valueCard, { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: borders.hairline }]}>
            <View style={[styles.iconWrap, { backgroundColor: colors.surfaceMuted }]}>
              <Clock size={20} color={colors.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={[typography.bodyBold, { color: colors.textPrimary }]}>
                  Structured Check-In
                </Text>
                <View style={[styles.tagPill, { backgroundColor: colors.surfaceMuted }]}>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: colors.accent }}>IST Stamped</Text>
                </View>
              </View>
              <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 4, lineHeight: 18 }]}>
                Automated 300m geofence verification ensures zero timesheet disputes and fast supervisor sign-offs.
              </Text>
            </View>
          </View>
        </View>

        {/* Live Operational Proof Metric */}
        <View style={[styles.proofCard, { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: borders.hairline, marginTop: spacing.md }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1 }}>
            <View style={styles.avatarStack}>
              <View style={[styles.avatarBubble, { backgroundColor: '#1E293B' }]}>
                <Text style={styles.avatarText}>AK</Text>
              </View>
              <View style={[styles.avatarBubble, { backgroundColor: colors.accent, marginLeft: -8 }]}>
                <Text style={styles.avatarText}>SM</Text>
              </View>
              <View style={[styles.avatarBubble, { backgroundColor: colors.surfaceMuted, marginLeft: -8 }]}>
                <Text style={[styles.avatarText, { color: colors.textPrimary }]}>+92</Text>
              </View>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: colors.textPrimary }}>
                1,400+ Shifts Disbursed
              </Text>
              <Text style={{ fontSize: 11, color: colors.textSecondary }}>
                Across Mumbai this calendar month
              </Text>
            </View>
          </View>
          <TrendingUp size={18} color={colors.accent} />
        </View>

        {/* Action Buttons */}
        <View style={{ marginTop: spacing.xl, gap: spacing.sm }}>
          <Button
            title="Get Started with Phone Number"
            variant="accent"
            size="lg"
            icon={<ArrowRight size={18} color={colors.textInverse} />}
            iconPosition="right"
            onPress={() => handleNavigate('/auth/login?method=phone')}
          />

          <Pressable
            onPress={() => handleNavigate('/auth/login')}
            style={({ pressed }) => [
              styles.signInButton,
              { minHeight: touchTarget.min, opacity: pressed ? 0.7 : 1 },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Existing Worker Sign In"
          >
            <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textPrimary, textDecorationLine: 'underline' }}>
              Existing Worker? Sign In
            </Text>
          </Pressable>

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

          {/* Regulatory Compliance & Integrity Notice */}
          <View style={[styles.regulatoryNotice, { backgroundColor: colors.surfaceMuted, borderColor: colors.border, borderWidth: borders.hairline }]}>
            <ShieldAlert size={16} color={colors.textMuted} style={{ marginTop: 2, flexShrink: 0 }} />
            <Text style={{ fontSize: 11, color: colors.textSecondary, lineHeight: 16, flex: 1 }}>
              Opskl is an enterprise-grade hospitality marketplace. Identity and Aadhaar/PAN KYC verification are mandatory prior to active shift allocation. Prototype illustrative data.
            </Text>
          </View>

          <View style={[styles.footerRow, { borderTopColor: colors.border, paddingTop: spacing.md, marginTop: spacing.xs }]}>
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
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  topHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 9999,
  },
  pulseDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  regionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  regionText: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  categoryChip: {
    alignSelf: 'flex-start',
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 6,
  },
  categoryText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  activeHubsCard: {
    marginTop: 16,
    borderRadius: 12,
    padding: 12,
  },
  liveOpsBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  valueCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 14,
    borderRadius: 12,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  tagPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  proofCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 12,
  },
  avatarStack: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarBubble: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  signInButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  onboardingLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  regulatoryNotice: {
    flexDirection: 'row',
    gap: 8,
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  footerRow: {
    borderTopWidth: 1,
  },
});
