import {
  View,
  Text,
  Modal,
  ScrollView,
  Pressable,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  useOpsklTheme,
  Badge,
  Button,
  WageText,
} from '@opskil/design-system';
import {
  Job,
  formatINR,
  formatISTDate,
  formatTimeRange,
  formatDistance,
  formatDeadline,
} from '@opskil/shared';
import { Calendar, MapPin, Utensils, Car, Coffee, Zap, X, Check, Info, Clock } from 'lucide-react-native';
import { GeoLocation, estimateDistance } from '../utils/location';

export interface JobDetailSheetProps {
  job: Job | null;
  visible: boolean;
  workerLocation: GeoLocation | null;
  onClose: () => void;
  onApply: (job: Job) => void;
  onPass: (job: Job) => void;
}

export function JobDetailSheet({
  job,
  visible,
  workerLocation,
  onClose,
  onApply,
  onPass,
}: JobDetailSheetProps) {
  const { colors, spacing, radii, typography } = useOpsklTheme();

  if (!job) return null;

  const distanceKm = estimateDistance(workerLocation, job.latitude, job.longitude);
  const slotsRemaining = Math.max(0, job.slotsTotal - job.slotsFilled);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
      accessibilityViewIsModal
    >
      <SafeAreaView
        style={[styles.sheetContainer, { backgroundColor: colors.background }]}
        edges={['top', 'bottom']}
      >
        {/* Top Header Bar */}
        <View style={[styles.headerBar, { borderBottomColor: colors.border }]}>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Badge label={job.category.charAt(0).toUpperCase() + job.category.slice(1)} variant="primary" size="sm" />
              {job.organizer?.verificationStatus === 'verified' && (
                <Badge label="Verified Host" variant="success" size="sm" />
              )}
            </View>
            <Text style={[typography.h3, { color: colors.textPrimary, marginTop: 4 }]} numberOfLines={2}>
              {job.title}
            </Text>
            <Text style={{ fontSize: 13, color: colors.textSecondary }}>
              {job.organizer?.businessName || 'Organizer details unavailable'}
              {job.organizer?.rating ? ` • ★ ${job.organizer.rating.toFixed(1)}` : ''}
            </Text>
          </View>

          <Pressable
            onPress={onClose}
            style={({ pressed }) => [
              styles.closeButton,
              {
                backgroundColor: colors.surfaceMuted,
                borderRadius: radii.full,
                opacity: pressed ? 0.7 : 1,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Close sheet"
          >
            <X size={18} color={colors.textPrimary} strokeWidth={2.2} />
          </Pressable>
        </View>

        {/* Scrollable Details */}
        <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}>


          {/* Shift Earnings Banner */}
          <View
            style={[
              styles.payoutCard,
              {
                backgroundColor: colors.surface,
                borderColor: colors.borderFocus,
                borderRadius: radii.xl,
              },
            ]}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <View>
                <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase' }}>
                  Estimated Shift Earnings
                </Text>
                <WageText style={{ marginTop: 2 }}>{formatINR(job.totalPay)}</WageText>
                <Text style={{ fontSize: 13, color: colors.textMuted, marginTop: 2 }}>
                  {formatINR(job.hourlyRate)}/hr × {job.durationHours} hours
                </Text>
              </View>
              <Badge label="UPI on verified checkout" variant="success" />
            </View>

            <View style={[styles.escrowNotice, { backgroundColor: colors.surfaceMuted, borderRadius: radii.md, flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10 }]}>
              <Zap size={15} color={colors.primary} strokeWidth={2.2} />
              <Text style={{ fontSize: 12, color: colors.textSecondary, lineHeight: 18, flex: 1 }}>
                Shift wages are calculated from verified attendance hours. Once supervisor reviews attendance and approves hours, payout processing begins through bank rails to your verified UPI handle.
              </Text>
            </View>
          </View>

          {/* Location & Timings */}
          <View style={[styles.sectionCard, { backgroundColor: colors.surface, borderRadius: radii.lg }]}>
            <Text style={[typography.subtitle, { color: colors.textPrimary, marginBottom: spacing.sm }]}>
              Venue & Schedule
            </Text>

            <View style={styles.detailRow}>
              <Calendar size={18} color={colors.primary} strokeWidth={2.2} style={{ marginRight: 10, marginTop: 2 }} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.rowTitle, { color: colors.textPrimary }]}>
                  {formatISTDate(job.date)}
                </Text>
                <Text style={[styles.rowSubtitle, { color: colors.textSecondary }]}>
                  {formatTimeRange(job.startTime, job.endTime)} ({job.durationHours} hours)
                </Text>
                <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 2 }}>
                  Reporting time: 30 minutes prior to start for briefing
                </Text>
              </View>
            </View>

            <View style={[styles.detailRow, { marginTop: spacing.sm }]}>
              <MapPin size={18} color={colors.primary} strokeWidth={2.2} style={{ marginRight: 10, marginTop: 2 }} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.rowTitle, { color: colors.textPrimary }]}>
                  {job.venueName}
                </Text>
                <Text style={[styles.rowSubtitle, { color: colors.textSecondary }]}>
                  {job.venueAddress}
                </Text>
                {job.landmark && (
                  <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>
                    Landmark: {job.landmark}
                  </Text>
                )}
                <Text style={{ fontSize: 12, color: colors.primary, fontWeight: '600', marginTop: 4 }}>
                  Estimated distance: {formatDistance(distanceKm)}
                </Text>
              </View>
            </View>
          </View>

          {/* Responsibilities */}
          <View style={[styles.sectionCard, { backgroundColor: colors.surface, borderRadius: radii.lg }]}>
            <Text style={[typography.subtitle, { color: colors.textPrimary, marginBottom: spacing.sm }]}>
              Shift Responsibilities
            </Text>
            {(job.duties || []).map((duty, idx) => (
              <View key={idx} style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 }}>
                <Text style={{ color: colors.primary, fontWeight: '700', marginRight: 8 }}>•</Text>
                <Text style={{ flex: 1, fontSize: 13, color: colors.textPrimary, lineHeight: 19 }}>
                  {duty}
                </Text>
              </View>
            ))}
          </View>

          {/* Perks & Working Conditions */}
          <View style={[styles.sectionCard, { backgroundColor: colors.surface, borderRadius: radii.lg }]}>
            <Text style={[typography.subtitle, { color: colors.textPrimary, marginBottom: spacing.sm }]}>
              Working Conditions & Perks
            </Text>
            <View style={{ gap: 8 }}>
              <View style={styles.conditionRow}>
                <Utensils size={15} color={colors.primary} strokeWidth={2} style={{ marginRight: 8 }} />
                <Text style={[styles.conditionText, { color: colors.textPrimary }]}>
                  Meals: {job.mealProvided ? 'Provided on-site by organizer' : 'Not provided'}
                </Text>
              </View>
              <View style={styles.conditionRow}>
                <Car size={15} color={colors.primary} strokeWidth={2} style={{ marginRight: 8 }} />
                <Text style={[styles.conditionText, { color: colors.textPrimary }]}>
                  Transport: {job.transportProvided ? 'Travel allowance / transport provided' : 'Self-arranged transport'}
                </Text>
              </View>
              <View style={styles.conditionRow}>
                <Coffee size={15} color={colors.primary} strokeWidth={2} style={{ marginRight: 8 }} />
                <Text style={[styles.conditionText, { color: colors.textPrimary }]}>
                  Breaks: {job.breaksMinutes || 30} minutes total shift break
                </Text>
              </View>
              {job.overtimePolicy && (
                <View style={styles.conditionRow}>
                  <Clock size={15} color={colors.primary} strokeWidth={2} style={{ marginRight: 8 }} />
                  <Text style={[styles.conditionText, { color: colors.textPrimary }]}>
                    Overtime Terms: {job.overtimePolicy}
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* Dress Code & Eligibility */}
          <View style={[styles.sectionCard, { backgroundColor: colors.surface, borderRadius: radii.lg }]}>
            <Text style={[typography.subtitle, { color: colors.textPrimary, marginBottom: spacing.xs }]}>
              Dress Code & Grooming
            </Text>
            <Text style={{ fontSize: 13, color: colors.textSecondary, lineHeight: 19 }}>
              {job.dressCode || 'Smart formals or comfortable dark attire.'}
            </Text>

            {job.eligibilityCriteria && (
              <>
                <Text style={[typography.subtitle, { color: colors.textPrimary, marginTop: spacing.md, marginBottom: spacing.xs }]}>
                  Eligibility Requirements
                </Text>
                <Text style={{ fontSize: 13, color: colors.textSecondary, lineHeight: 19 }}>
                  {job.eligibilityCriteria}
                </Text>
              </>
            )}

            {job.requiredSkills && job.requiredSkills.length > 0 && (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: spacing.sm }}>
                {job.requiredSkills.map((skill, idx) => (
                  <Badge key={idx} label={skill} variant="neutral" size="sm" />
                ))}
              </View>
            )}
          </View>

          {/* Openings & Deadline */}
          <View style={[styles.sectionCard, { backgroundColor: colors.surface, borderRadius: radii.lg }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View>
                <Text style={{ fontSize: 12, color: colors.textMuted }}>Openings</Text>
                <Text style={{ fontSize: 16, fontWeight: '700', color: colors.textPrimary }}>
                  {slotsRemaining} of {job.slotsTotal} spots open
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={{ fontSize: 12, color: colors.textMuted }}>Application Cutoff</Text>
                <Text style={{ fontSize: 14, fontWeight: '700', color: colors.primary }}>
                  {formatDeadline(job.applicationDeadline)}
                </Text>
              </View>
            </View>
          </View>

          {/* Marketplace Policy Disclaimer */}
          <View
            style={[
              styles.policyBox,
              {
                backgroundColor: colors.surfaceMuted,
                borderRadius: radii.md,
                borderLeftColor: colors.primary,
                flexDirection: 'row',
                alignItems: 'flex-start',
                gap: 8,
              },
            ]}
          >
            <Info size={16} color={colors.primary} style={{ marginTop: 2 }} />
            <Text style={{ flex: 1, fontSize: 12, color: colors.textSecondary, lineHeight: 18 }}>
              <Text style={{ fontWeight: '700' }}>Marketplace Notice:</Text> Expressing interest informs the organizer of your availability. You are officially confirmed once the organizer selects your profile.
            </Text>
          </View>
        </ScrollView>

        {/* Bottom Fixed Action Bar */}
        <View style={[styles.bottomActionBar, { borderTopColor: colors.border, backgroundColor: colors.surface }]}>
          <View style={{ flex: 1 }}>
            <Button
              title="Pass"
              icon={<X size={16} color={colors.textSecondary} strokeWidth={2.2} />}
              variant="secondary"
              size="lg"
              onPress={() => {
                onClose();
                onPass(job);
              }}
            />
          </View>
          <View style={{ flex: 2 }}>
            <Button
              title="Apply for Shift"
              icon={<Check size={18} color={colors.textInverse} strokeWidth={2.4} />}
              variant="primary"
              size="lg"
              onPress={() => {
                onClose();
                onApply(job);
              }}
            />
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheetContainer: {
    flex: 1,
  },
  headerBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  closeButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  closeIcon: {
    fontSize: 16,
    fontWeight: '700',
  },
  payoutCard: {
    padding: 16,
    borderWidth: 1.5,
  },
  escrowNotice: {
    marginTop: 12,
    padding: 10,
  },
  sectionCard: {
    padding: 16,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  rowIcon: {
    fontSize: 18,
    width: 28,
    marginTop: 1,
  },
  rowTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  rowSubtitle: {
    fontSize: 13,
    marginTop: 1,
  },
  conditionRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  conditionIcon: {
    fontSize: 15,
    width: 24,
  },
  conditionText: {
    fontSize: 13,
  },
  policyBox: {
    padding: 12,
    borderLeftWidth: 3,
  },
  bottomActionBar: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
