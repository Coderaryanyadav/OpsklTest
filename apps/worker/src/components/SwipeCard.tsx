import { useRef } from 'react';
import {
  View,
  Text,
  Dimensions,
  StyleSheet,
  Pressable,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
  interpolate,
  useReducedMotion,
  Extrapolation,
} from 'react-native-reanimated';
import {
  useOpsklTheme,
  Card,
  Badge,
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
import {
  MapPin,
  Calendar,
  Utensils,
  Car,
  Coffee,
  Clock,
  Check,
  X,
  Zap,
  Star,
  ChevronRight,
} from 'lucide-react-native';
import { GeoLocation, estimateDistance } from '../utils/location';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.32;

export interface SwipeCardProps {
  job: Job;
  workerLocation: GeoLocation | null;
  onSwipeRight: (job: Job) => void;
  onSwipeLeft: (job: Job) => void;
  onPressDetails: (job: Job) => void;
  isTopCard: boolean;
  disabled?: boolean;
}

export function SwipeCard({
  job,
  workerLocation,
  onSwipeRight,
  onSwipeLeft,
  onPressDetails,
  isTopCard,
  disabled = false,
}: SwipeCardProps) {
  const { colors, radii, typography, isDark } = useOpsklTheme();
  const reducedMotion = useReducedMotion();

  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const actionDispatched = useRef(false);

  const handleApplyAction = () => {
    if (actionDispatched.current) return;
    actionDispatched.current = true;
    onSwipeRight(job);
  };

  const handlePassAction = () => {
    if (actionDispatched.current) return;
    actionDispatched.current = true;
    onSwipeLeft(job);
  };

  const panGesture = Gesture.Pan()
    .enabled(isTopCard && !disabled)
    .onUpdate((event) => {
      'worklet';
      translateX.value = event.translationX;
      // Soft dampening of vertical translation so it tracks naturally with horizontal swipe
      translateY.value = event.translationY * 0.25;
    })
    .onEnd((event) => {
      'worklet';
      const shouldApply = translateX.value > SWIPE_THRESHOLD || event.velocityX > 750;
      const shouldPass = translateX.value < -SWIPE_THRESHOLD || event.velocityX < -750;

      if (shouldApply) {
        if (reducedMotion) {
          translateX.value = SCREEN_WIDTH * 1.5;
          runOnJS(handleApplyAction)();
        } else {
          translateX.value = withTiming(SCREEN_WIDTH * 1.4, { duration: 220 }, (finished) => {
            if (finished) {
              runOnJS(handleApplyAction)();
            }
          });
        }
      } else if (shouldPass) {
        if (reducedMotion) {
          translateX.value = -SCREEN_WIDTH * 1.5;
          runOnJS(handlePassAction)();
        } else {
          translateX.value = withTiming(-SCREEN_WIDTH * 1.4, { duration: 220 }, (finished) => {
            if (finished) {
              runOnJS(handlePassAction)();
            }
          });
        }
      } else {
        // Canceled or under threshold: spring back cleanly
        if (reducedMotion) {
          translateX.value = 0;
          translateY.value = 0;
        } else {
          translateX.value = withSpring(0, { damping: 18, stiffness: 140 });
          translateY.value = withSpring(0, { damping: 18, stiffness: 140 });
        }
      }
    });

  const cardAnimatedStyle = useAnimatedStyle(() => {
    if (!isTopCard) {
      return {
        transform: [{ scale: 0.96 }, { translateY: 10 }],
      };
    }

    const rotate = reducedMotion
      ? '0deg'
      : `${interpolate(
          translateX.value,
          [-SCREEN_WIDTH * 0.8, 0, SCREEN_WIDTH * 0.8],
          [-12, 0, 12],
          Extrapolation.CLAMP
        )}deg`;

    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { rotate },
      ],
    };
  });

  const applyOverlayStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      translateX.value,
      [20, SWIPE_THRESHOLD * 0.75],
      [0, 1],
      Extrapolation.CLAMP
    );
    return { opacity };
  });

  const passOverlayStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      translateX.value,
      [-20, -SWIPE_THRESHOLD * 0.75],
      [0, 1],
      Extrapolation.CLAMP
    );
    return { opacity };
  });

  const slotsRemaining = Math.max(0, job.slotsTotal - job.slotsFilled);
  const distanceKm = estimateDistance(workerLocation, job.latitude, job.longitude);
  const isOrganizerVerified = job.organizer?.verificationStatus === 'verified';

  return (
    <GestureDetector gesture={panGesture}>
      <Animated.View
        style={[styles.container, cardAnimatedStyle]}
        accessible={true}
        accessibilityRole="summary"
        accessibilityLabel={`Shift listing: ${job.title} by ${job.organizer?.businessName || 'Organizer'}. Daily payout ${formatINR(job.totalPay)}. ${slotsRemaining} slots remaining.`}
        accessibilityHint="Swipe right or press Apply to express interest. Swipe left or press Pass to skip. Double tap to view full job details."
      >
        <Card
          variant="elevated"
          style={[
            styles.cardBody,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
            },
          ]}
        >
          {/* Subtle Apply Drag Indicator Overlay */}
          <Animated.View
            pointerEvents="none"
            style={[
              styles.overlayBadge,
              styles.applyOverlay,
              applyOverlayStyle,
            ]}
          >
            <View style={styles.badgePillSuccess}>
              <Check size={18} color="#FFFFFF" strokeWidth={3} />
              <Text style={styles.badgePillTextSuccess}>APPLY</Text>
            </View>
          </Animated.View>

          {/* Subtle Pass Drag Indicator Overlay */}
          <Animated.View
            pointerEvents="none"
            style={[
              styles.overlayBadge,
              styles.passOverlay,
              passOverlayStyle,
            ]}
          >
            <View style={styles.badgePillPass}>
              <X size={18} color="#FFFFFF" strokeWidth={3} />
              <Text style={styles.badgePillTextPass}>PASS</Text>
            </View>
          </Animated.View>

          {/* Header Row: Category Badge, Verified Organizer & Slots */}
          <View style={styles.topRow}>
            <View style={styles.categoryPill}>
              <Text style={[styles.categoryText, { color: colors.primary }]}>
                {job.category.toUpperCase()}
              </Text>
            </View>

            <View style={styles.topRightBadges}>
              {(job.id.startsWith('job-mum-') || (job as any).isSampleListing) && (
                <Badge label="Sample Preview" variant="warning" size="sm" />
              )}
              {isOrganizerVerified && (
                <Badge label="Verified Host" variant="success" size="sm" />
              )}
              <Badge
                label={slotsRemaining <= 3 ? `${slotsRemaining} slots left` : `${slotsRemaining} openings`}
                variant={slotsRemaining <= 3 ? 'warning' : 'neutral'}
                size="sm"
              />
            </View>
          </View>

          {/* Hero Wage Section */}
          <View style={styles.wageSection}>
            <View>
              <Text style={[typography.caption, { color: colors.textSecondary, textTransform: 'uppercase' }]}>
                Estimated Shift Earnings
              </Text>
              <View style={styles.wageRow}>
                <WageText style={styles.wageAmount}>{formatINR(job.totalPay)}</WageText>
                <Text style={[styles.hourlyBreakdown, { color: colors.textMuted }]}>
                  {formatINR(job.hourlyRate)}/hr • {job.durationHours}h
                </Text>
              </View>
            </View>
            <View style={[styles.upiGuaranteePill, { backgroundColor: isDark ? '#064E3B' : '#ECFDF5' }]}>
              <Zap size={12} color={colors.success} strokeWidth={2.5} style={{ marginRight: 4 }} />
              <Text style={[styles.upiGuaranteeText, { color: colors.success }]}>
                UPI on verified checkout
              </Text>
            </View>
          </View>

          {/* Job Title & Organizer Identity */}
          <View style={styles.titleSection}>
            <Text style={[typography.h3, { color: colors.textPrimary }]} numberOfLines={2}>
              {job.title}
            </Text>
            <View style={styles.organizerRow}>
              <Text style={[styles.organizerName, { color: colors.textSecondary }]}>
                {job.organizer?.businessName || 'Organizer details unavailable'}
              </Text>
              {job.organizer?.rating ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                  <Star size={12} color={colors.warning} fill={colors.warning} />
                  <Text style={[styles.ratingText, { color: colors.warning }]}>
                    {job.organizer.rating.toFixed(1)}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>

          {/* Location & Time Block */}
          <View style={[styles.metaBlock, { backgroundColor: colors.surfaceMuted, borderRadius: radii.md }]}>
            <View style={styles.metaRow}>
              <MapPin size={15} color={colors.primary} strokeWidth={2.2} style={{ marginRight: 8, marginTop: 2 }} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.venueTitle, { color: colors.textPrimary }]} numberOfLines={1}>
                  {job.venueName}
                </Text>
                <View style={styles.zoneDistanceRow}>
                  <Text style={[styles.zoneText, { color: colors.textSecondary }]}>
                    {job.zone}
                  </Text>
                  <Text style={[styles.distanceDot, { color: colors.textMuted }]}>•</Text>
                  <Text style={[styles.distanceText, { color: colors.primary }]}>
                    {formatDistance(distanceKm)}
                  </Text>
                </View>
              </View>
            </View>

            <View style={[styles.metaRow, { marginTop: 8 }]}>
              <Calendar size={15} color={colors.primary} strokeWidth={2.2} style={{ marginRight: 8, marginTop: 2 }} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.timeText, { color: colors.textPrimary }]}>
                  {formatISTDate(job.date)} • {formatTimeRange(job.startTime, job.endTime)}
                </Text>
              </View>
            </View>
          </View>

          {/* Responsibilities Preview */}
          <View style={styles.dutiesPreview}>
            <Text style={[typography.caption, { color: colors.textMuted, marginBottom: 4 }]}>
              KEY RESPONSIBILITIES:
            </Text>
            {(job.duties || []).slice(0, 2).map((duty, idx) => (
              <View key={idx} style={styles.dutyItem}>
                <Text style={[styles.bullet, { color: colors.primary }]}>•</Text>
                <Text style={[styles.dutyText, { color: colors.textSecondary }]} numberOfLines={1}>
                  {duty}
                </Text>
              </View>
            ))}
          </View>

          {/* Amenities & Conditions Pills */}
          <View style={styles.amenitiesRow}>
            {job.mealProvided && (
              <View style={[styles.amenityPill, { backgroundColor: isDark ? '#1E293B' : '#F1F5F9', flexDirection: 'row', alignItems: 'center', gap: 4 }]}>
                <Utensils size={12} color={colors.textSecondary} strokeWidth={2} />
                <Text style={[styles.amenityText, { color: colors.textSecondary }]}>Meals</Text>
              </View>
            )}
            {job.transportProvided && (
              <View style={[styles.amenityPill, { backgroundColor: isDark ? '#1E293B' : '#F1F5F9', flexDirection: 'row', alignItems: 'center', gap: 4 }]}>
                <Car size={12} color={colors.textSecondary} strokeWidth={2} />
                <Text style={[styles.amenityText, { color: colors.textSecondary }]}>Travel Allowance</Text>
              </View>
            )}
            {job.breaksMinutes ? (
              <View style={[styles.amenityPill, { backgroundColor: isDark ? '#1E293B' : '#F1F5F9', flexDirection: 'row', alignItems: 'center', gap: 4 }]}>
                <Coffee size={12} color={colors.textSecondary} strokeWidth={2} />
                <Text style={[styles.amenityText, { color: colors.textSecondary }]}>{job.breaksMinutes}m Break</Text>
              </View>
            ) : null}
            {job.applicationDeadline && (
              <View style={[styles.amenityPill, { backgroundColor: isDark ? '#312E81' : '#EEF2FF', flexDirection: 'row', alignItems: 'center', gap: 4 }]}>
                <Clock size={12} color={colors.primary} strokeWidth={2} />
                <Text style={[styles.amenityText, { color: colors.primary }]}>
                  {formatDeadline(job.applicationDeadline)}
                </Text>
              </View>
            )}
          </View>

          {/* Required Skills Chips */}
          {job.requiredSkills && job.requiredSkills.length > 0 && (
            <View style={styles.skillsRow}>
              {job.requiredSkills.slice(0, 3).map((skill, idx) => (
                <View key={idx} style={[styles.skillChip, { borderColor: colors.border }]}>
                  <Text style={[styles.skillText, { color: colors.textMuted }]}>{skill}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Bottom Tap Trigger for Full Description Sheet */}
          <Pressable
            onPress={() => onPressDetails(job)}
            style={({ pressed }) => [
              styles.detailLink,
              { opacity: pressed ? 0.7 : 1 },
            ]}
            accessibilityRole="button"
            accessibilityLabel="View full shift details and policies"
          >
            <Text style={[styles.detailLinkText, { color: colors.primary }]}>
              View Full Shift Details & Policies
            </Text>
            <ChevronRight size={14} color={colors.primary} strokeWidth={2.4} style={{ marginLeft: 4 }} />
          </Pressable>
        </Card>
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    alignSelf: 'center',
  },
  cardBody: {
    borderRadius: 20,
    padding: 16,
    borderWidth: 1.5,
    minHeight: 460,
    justifyContent: 'space-between',
    position: 'relative',
    overflow: 'hidden',
  },
  overlayBadge: {
    position: 'absolute',
    top: 24,
    zIndex: 99,
  },
  applyOverlay: {
    left: 20,
    transform: [{ rotate: '-14deg' }],
  },
  passOverlay: {
    right: 20,
    transform: [{ rotate: '14deg' }],
  },
  badgePillSuccess: {
    backgroundColor: '#10B981',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
  badgePillTextSuccess: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 16,
    letterSpacing: 1.2,
  },
  badgePillPass: {
    backgroundColor: '#EF4444',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
  badgePillTextPass: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 16,
    letterSpacing: 1.2,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  categoryPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: 'rgba(15, 118, 110, 0.1)',
  },
  categoryText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  topRightBadges: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
  },
  wageSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginTop: 10,
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(148, 163, 184, 0.2)',
  },
  wageRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: 2,
  },
  wageAmount: {
    fontSize: 26,
    fontWeight: '900',
  },
  hourlyBreakdown: {
    fontSize: 12,
    marginLeft: 6,
    fontWeight: '500',
  },
  upiGuaranteePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  upiGuaranteeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  titleSection: {
    marginTop: 10,
  },
  organizerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 3,
  },
  organizerName: {
    fontSize: 13,
    fontWeight: '600',
  },
  ratingText: {
    fontSize: 12,
    fontWeight: '700',
  },
  metaBlock: {
    padding: 10,
    marginTop: 10,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  metaIcon: {
    fontSize: 14,
    width: 22,
    marginTop: 1,
  },
  venueTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  zoneDistanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  zoneText: {
    fontSize: 11,
  },
  distanceDot: {
    marginHorizontal: 4,
    fontSize: 10,
  },
  distanceText: {
    fontSize: 11,
    fontWeight: '700',
  },
  timeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  dutiesPreview: {
    marginTop: 8,
  },
  dutyItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 2,
  },
  bullet: {
    fontSize: 13,
    marginRight: 6,
    fontWeight: '700',
  },
  dutyText: {
    fontSize: 12,
    flex: 1,
    lineHeight: 16,
  },
  amenitiesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  amenityPill: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  amenityText: {
    fontSize: 11,
    fontWeight: '600',
  },
  skillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
  },
  skillChip: {
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  skillText: {
    fontSize: 10,
    fontWeight: '500',
  },
  detailLink: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 8,
    marginTop: 6,
  },
  detailLinkText: {
    fontSize: 12,
    fontWeight: '700',
  },
});
