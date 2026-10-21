import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import {
  useOpsklTheme,
  Button,
  Screen,
  OpsklAlert,
} from '@opskil/design-system';
import {
  Users,
  ArrowRight,
  Building2,
  CheckCircle2,
  QrCode,
  FileText,
} from 'lucide-react-native';
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
    <Screen edges={['top', 'bottom', 'left', 'right']} contentStyle={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl }} showsVerticalScrollIndicator={false}>
        {/* Top Header Pill & Region */}
        <View style={styles.topHeader}>
          <View style={[styles.statusPill, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
            <View style={[styles.pulseDot, { backgroundColor: colors.accent }]} />
            <Text style={[styles.statusText, { color: colors.textPrimary }]}>
              Opskl Host Portal
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
          <View style={[styles.categoryChip, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
            <Text style={[styles.categoryText, { color: colors.accent }]}>
              Enterprise Event Staffing Console
            </Text>
          </View>
          <Text style={[typography.h1, { color: colors.textPrimary, marginTop: spacing.xs, letterSpacing: -0.5 }]}>
            Command your event crew across premier Mumbai venues.
          </Text>
          <Text style={[typography.body, { color: colors.textSecondary, marginTop: spacing.xs, lineHeight: 22 }]}>
            Real-time candidate screening, attendance verification, and transparent wage + fee ledgers.
          </Text>
        </View>

        {/* Active Venues Banner */}
        <View style={[styles.activeHubsCard, { backgroundColor: colors.primary, borderColor: colors.border }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1, minWidth: 0 }}>
              <Building2 size={16} color={colors.accent} />
              <Text
                style={{ fontSize: 12, fontWeight: '700', color: colors.textInverse, letterSpacing: -0.2, flex: 1 }}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                Supported Venues: BKC • NESCO • South Mumbai
              </Text>
            </View>
            <View style={[styles.liveOpsBadge, { backgroundColor: 'rgba(255, 255, 255, 0.15)', flexShrink: 0 }]}>
              <Text style={{ fontSize: 10, fontWeight: '800', color: colors.textInverse, letterSpacing: 0.5 }}>
                ENTERPRISE
              </Text>
            </View>
          </View>
        </View>

        {/* 3 Core Value Cards */}
        <View style={{ marginTop: spacing.lg, gap: spacing.sm }}>
          {/* Card 1 */}
          <View style={[styles.valueCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.iconWrap, { backgroundColor: colors.surfaceMuted }]}>
              <Users size={20} color={colors.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={[typography.bodyBold, { color: colors.textPrimary }]}>
                  Verified Candidate Review
                </Text>
                <View style={[styles.tagPill, { backgroundColor: colors.surfaceMuted }]}>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: colors.accent }}>KYC Verified</Text>
                </View>
              </View>
              <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 4, lineHeight: 18 }]}>
                Screen applicants by ratings, Mumbai event history, and role-readiness before roster confirmation.
              </Text>
            </View>
          </View>

          {/* Card 2 */}
          <View style={[styles.valueCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.iconWrap, { backgroundColor: colors.surfaceMuted }]}>
              <QrCode size={20} color={colors.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={[typography.bodyBold, { color: colors.textPrimary }]}>
                  Live Attendance Console
                </Text>
                <View style={[styles.tagPill, { backgroundColor: colors.surfaceMuted }]}>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textSecondary }}>GPS + PIN</Text>
                </View>
              </View>
              <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 4, lineHeight: 18 }]}>
                Geofenced worker check-in with venue pass codes and manual PIN fallback for on-site call-time timestamps.
              </Text>
            </View>
          </View>

          {/* Card 3 */}
          <View style={[styles.valueCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.iconWrap, { backgroundColor: colors.surfaceMuted }]}>
              <FileText size={20} color={colors.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={[typography.bodyBold, { color: colors.textPrimary }]}>
                  Funding &amp; Invoice Ledger
                </Text>
                <View style={[styles.tagPill, { backgroundColor: colors.surfaceMuted }]}>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: colors.accent }}>Fee estimate</Text>
                </View>
              </View>
              <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 4, lineHeight: 18 }]}>
                Itemized wage + platform fee + GST estimates with invoice status tracking. Live bank escrow rails are not linked in this build.
              </Text>
            </View>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={{ marginTop: spacing.xl, gap: spacing.sm }}>
          <Button
            title="Sign In to Organizer Account"
            variant="primary"
            size="lg"
            onPress={() => handleNavigate('/auth/login')}
          />
          <Button
            title="Register Corporate Entity"
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
            accessibilityLabel="Explore organizer dashboard as guest"
          >
            <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textSecondary }}>
              Explore management console as guest
            </Text>
            <ArrowRight size={14} color={colors.textSecondary} strokeWidth={2} style={{ marginLeft: 4 }} />
          </Pressable>

          <View style={[styles.footerRow, { borderTopColor: colors.border, paddingTop: spacing.md }]}>
            <Text style={{ fontSize: 11, color: colors.textMuted, textAlign: 'center' }}>
              Looking for event work? Use the{' '}
              <Text
                style={{ color: colors.textPrimary, fontWeight: '700', textDecorationLine: 'underline' }}
                onPress={() => {
                  OpsklAlert.alert(
                    'Worker Portal',
                    'Opskl Worker is available for event crew and hospitality professionals. Open the Opskl Worker app or contact support@opskil.com.'
                  );
                }}
              >
                Opskl Worker App
              </Text>
            </Text>
            <Text style={{ fontSize: 10, color: colors.textMuted, textAlign: 'center', marginTop: 4 }}>
              By continuing, you agree to Opskl's Corporate Terms of Service & Privacy Policy.
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
    paddingRight: 48,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 9999,
    borderWidth: 1,
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
    borderWidth: 1,
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
    borderWidth: 1,
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
    borderWidth: 1,
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
  onboardingLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  footerRow: {
    borderTopWidth: 1,
  },
});
