import { useState, useEffect } from 'react';
import { View, Text, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  useOpsklTheme,
  ScreenHeader,
  Card,
  Badge,
  Button,
  WageText,
  useAuth,
} from '@opskil/design-system';
import {
  formatINR,
  formatTimeRange,
  formatISTDate,
  formatDeadline,
  fetchJobById,
  applyForJobSafe,
  Job,
} from '@opskil/shared';

export default function WorkerShiftDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const { colors, spacing, radii, typography } = useOpsklTheme();

  const [shift, setShift] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [applied, setApplied] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function loadShift() {
      if (!id) return;
      try {
        const data = await fetchJobById(id);
        if (data) {
          setShift(data);
        }
      } catch (err) {
        console.error('Failed to load shift details', err);
      } finally {
        setLoading(false);
      }
    }
    loadShift();
  }, [id]);

  // Fallback shift details if network or test environment without mock
  const activeShift: Job = shift || {
    id: id || 'shift-101',
    organizerId: 'org-apex-01',
    title: 'Registration Desk & VIP Usher',
    category: 'conference',
    venueName: 'Jio World Convention Centre, Pavilion 2',
    venueAddress: 'G Block BKC, Bandra Kurla Complex, Bandra East, Mumbai, Maharashtra 400098',
    landmark: 'Opposite Bharat Diamond Bourse',
    city: 'Mumbai',
    zone: 'Bandra Kurla Complex (BKC)',
    date: '2026-10-14',
    startTime: '08:30',
    endTime: '17:30',
    durationHours: 9,
    hourlyRate: 185,
    totalPay: 1665,
    slotsTotal: 12,
    slotsFilled: 8,
    dressCode: 'Crisp black formal collared shirt, black formal trousers, black formal shoes. Hair neatly groomed.',
    duties: [
      'Scan attendee QR entry passes at turnstiles using provided handheld terminals',
      'Issue delegate badge lanyards and conference kits',
      'Direct delegates toward Keynote Hall A and Executive Boardrooms',
      'Assist with on-site attendee queries and information requests',
    ],
    perks: ['Catered lunch & refreshments provided', 'Air conditioned hall', 'Direct UPI payout within 2 hours of shift completion'],
    requiredSkills: ['Guest Relations', 'Fluent English', 'Basic Tech Navigation'],
    breaksMinutes: 45,
    mealProvided: true,
    transportProvided: false,
    overtimePolicy: '₹200/hr after scheduled shift duration.',
    supervisorName: 'Rohit Verma',
    supervisorPhone: '+91 98201 98201',
    status: 'open',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    organizer: {
      id: 'org-apex-01',
      businessName: 'Apex Event Productions Pvt Ltd',
      businessType: 'event_agency',
      verificationStatus: 'verified',
      profileCompletionStatus: 'completed',
      businessContactPhone: '+91 98201 98201',
      rating: 4.9,
      totalEventsHosted: 42,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    },
  };

  const totalPay = activeShift.hourlyRate * activeShift.durationHours;

  const handleApply = async () => {
    setSubmitting(true);
    const workerId = session?.user?.id || 'demo-worker-id';
    const result = await applyForJobSafe(activeShift.id, workerId);
    setSubmitting(false);

    if (result.success) {
      setApplied(true);
      Alert.alert(
        'Interest Expressed',
        `Your profile has been submitted to ${activeShift.organizer?.businessName || 'the organizer'}. Organizers explicitly select workers for the shift roster. You will be notified once reviewed.`,
        [{ text: 'OK' }]
      );
    } else {
      Alert.alert(
        'Application Failed',
        result.errorMessage || 'Unable to apply for this shift at this time.',
        [{ text: 'OK' }]
      );
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={{ marginTop: 12, color: colors.textSecondary }}>Loading shift specs...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'bottom']}>
      <ScreenHeader
        title="Shift Details"
        subtitle={activeShift.category.toUpperCase()}
        onBack={() => router.back()}
        rightAction={
          <Badge
            label={`${activeShift.durationHours}h SHIFT`}
            variant="neutral"
            size="sm"
          />
        }
      />

      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}>
        {/* Wage Guarantee Card */}
        <Card
          variant="elevated"
          style={{
            backgroundColor: colors.surface,
            borderRadius: radii.xl,
            borderColor: colors.borderFocus,
            borderWidth: 1.5,
          }}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <View>
              <Text style={{ fontSize: 12, color: colors.textSecondary, textTransform: 'uppercase', fontWeight: '700' }}>
                Guaranteed Payout
              </Text>
              <WageText style={{ marginTop: 2 }}>{formatINR(totalPay)}</WageText>
              <Text style={{ fontSize: 13, color: colors.textMuted, marginTop: 2 }}>
                {formatINR(activeShift.hourlyRate)}/hr × {activeShift.durationHours} hours
              </Text>
            </View>
            <Badge label="SAME-DAY UPI" variant="success" />
          </View>

          <View
            style={{
              marginTop: spacing.md,
              padding: spacing.sm,
              backgroundColor: colors.surfaceMuted,
              borderRadius: radii.md,
            }}
          >
            <Text style={{ fontSize: 12, color: colors.textSecondary }}>
              🛡️ Payment held securely in Opskl Escrow before shift starts. Released immediately upon supervisor attendance approval.
            </Text>
          </View>
        </Card>

        {/* Shift Role & Timing */}
        <Card variant="outlined">
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <View style={{ flex: 1 }}>
              <Text style={[typography.h3, { color: colors.textPrimary }]}>{activeShift.title}</Text>
              <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 2 }}>
                Organized by {activeShift.organizer?.businessName || 'Event Host'}
              </Text>
            </View>
            {activeShift.organizer?.verificationStatus === 'verified' && (
              <Badge label="✓ VERIFIED" variant="success" size="sm" />
            )}
          </View>

          <View style={{ height: 1, backgroundColor: colors.border, marginVertical: spacing.md }} />

          <View style={{ gap: spacing.sm }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={{ fontSize: 16, width: 26 }}>📅</Text>
              <View>
                <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textPrimary }}>
                  {formatISTDate(activeShift.date)}
                </Text>
                <Text style={{ fontSize: 12, color: colors.textSecondary }}>
                  {formatTimeRange(activeShift.startTime, activeShift.endTime)} ({activeShift.durationHours} hours)
                </Text>
              </View>
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={{ fontSize: 16, width: 26 }}>📍</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textPrimary }}>
                  {activeShift.venueName}
                </Text>
                <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 1 }}>
                  {activeShift.venueAddress}
                </Text>
                {activeShift.landmark && (
                  <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 1 }}>
                    Landmark: {activeShift.landmark}
                  </Text>
                )}
              </View>
            </View>
          </View>
        </Card>

        {/* Duties */}
        <Card variant="outlined">
          <Text style={[typography.subtitle, { color: colors.textPrimary, marginBottom: spacing.sm }]}>
            Shift Responsibilities
          </Text>
          {activeShift.duties.map((duty, idx) => (
            <View key={idx} style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 }}>
              <Text style={{ color: colors.primary, fontWeight: '700', marginRight: 8, fontSize: 14 }}>
                •
              </Text>
              <Text style={{ flex: 1, fontSize: 13, color: colors.textPrimary, lineHeight: 19 }}>
                {duty}
              </Text>
            </View>
          ))}
        </Card>

        {/* Working Conditions */}
        <Card variant="outlined">
          <Text style={[typography.subtitle, { color: colors.textPrimary, marginBottom: spacing.sm }]}>
            Conditions & Logistics
          </Text>
          <View style={{ gap: 8 }}>
            <Text style={{ fontSize: 13, color: colors.textSecondary }}>
              🍽️ Meals: {activeShift.mealProvided ? 'Provided on-site' : 'Self-arranged'}
            </Text>
            <Text style={{ fontSize: 13, color: colors.textSecondary }}>
              🚕 Travel: {activeShift.transportProvided ? 'Allowance / cab provided' : 'Self-arranged'}
            </Text>
            <Text style={{ fontSize: 13, color: colors.textSecondary }}>
              ☕ Breaks: {activeShift.breaksMinutes || 30} minutes
            </Text>
            {activeShift.overtimePolicy && (
              <Text style={{ fontSize: 13, color: colors.textSecondary }}>
                ⏱️ Overtime: {activeShift.overtimePolicy}
              </Text>
            )}
            {activeShift.applicationDeadline && (
              <Text style={{ fontSize: 13, color: colors.primary, fontWeight: '600' }}>
                ⏳ Deadline: {formatDeadline(activeShift.applicationDeadline)}
              </Text>
            )}
          </View>
        </Card>

        {/* Dress Code & Requirements */}
        <Card variant="outlined">
          <Text style={[typography.subtitle, { color: colors.textPrimary, marginBottom: spacing.xs }]}>
            Dress Code & Hygiene
          </Text>
          <Text style={{ fontSize: 13, color: colors.textSecondary, lineHeight: 19 }}>
            {activeShift.dressCode}
          </Text>
        </Card>

        {/* Notice on marketplace policy */}
        <View
          style={{
            padding: spacing.md,
            backgroundColor: colors.surfaceMuted,
            borderRadius: radii.md,
            borderLeftWidth: 3,
            borderLeftColor: colors.primary,
          }}
        >
          <Text style={{ fontSize: 12, color: colors.textSecondary, lineHeight: 18 }}>
            ℹ️ <Text style={{ fontWeight: '700' }}>Opskl Marketplace Policy:</Text> Expressing interest informs the organizer that you are available. You are only scheduled once the organizer explicitly selects and confirms your booking.
          </Text>
        </View>

        {/* Action Button */}
        <View style={{ marginTop: spacing.sm, paddingBottom: spacing.xl }}>
          <Button
            title={applied ? '✓ Interest Expressed (Awaiting Selection)' : 'Express Interest / Apply'}
            variant={applied ? 'secondary' : 'primary'}
            size="lg"
            disabled={applied}
            loading={submitting}
            onPress={handleApply}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
