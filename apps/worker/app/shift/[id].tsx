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
  EmptyState,
  useAuth,
} from '@opskil/design-system';
import {
  formatINR,
  formatTimeRange,
  formatISTDate,
  formatDeadline,
  fetchJobById,
  applyForJobSafe,
  fetchWorkerJobStatus,
  Job,
} from '@opskil/shared';
import { Calendar, MapPin, FileText, Utensils, Car, Coffee, Clock } from 'lucide-react-native';

export default function WorkerShiftDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const { colors, spacing, radii, typography } = useOpsklTheme();

  const [shift, setShift] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [applied, setApplied] = useState(false);
  const [isBooked, setIsBooked] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function loadShift() {
      if (!id) {
        setError('Invalid shift identifier.');
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        setError(null);
        const [data, statusData] = await Promise.all([
          fetchJobById(id),
          session?.user?.id ? fetchWorkerJobStatus(id, session.user.id) : Promise.resolve(null),
        ]);
        if (data) {
          setShift(data);
        } else {
          setError('Shift not found or has been concluded.');
        }

        if (statusData) {
          if (statusData.isBooked) {
            setIsBooked(true);
            setApplied(true);
          } else if (statusData.hasApplied) {
            setApplied(true);
          }
        }
      } catch (err: any) {
        setError(err?.message || 'Unable to load shift details.');
      } finally {
        setLoading(false);
      }
    }
    loadShift();
  }, [id, session?.user?.id]);

  const handleApply = async () => {
    if (!shift) return;
    if (!session?.user?.id) {
      Alert.alert('Sign In Required', 'Please sign in to apply for this shift.', [
        { text: 'OK', onPress: () => router.push('/auth/login') },
      ]);
      return;
    }

    setSubmitting(true);
    const result = await applyForJobSafe(shift.id, session.user.id);
    setSubmitting(false);

    if (result.success) {
      setApplied(true);
      Alert.alert(
        'Interest Expressed',
        `Your profile has been submitted to ${shift.organizer?.businessName || 'the organizer'}. You will receive a notification once the organizer reviews the applicants and confirms the roster.`,
        [{ text: 'View My Applications', onPress: () => router.push('/(tabs)/my-shifts') }, { text: 'Done' }]
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
        <Text style={[typography.body, { marginTop: 12, color: colors.textSecondary }]}>
          Loading verified shift details…
        </Text>
      </SafeAreaView>
    );
  }

  if (error || !shift) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <ScreenHeader title="Shift Details" onBack={() => router.back()} />
        <View style={{ flex: 1, justifyContent: 'center', padding: spacing.xl }}>
          <EmptyState
            title="Shift Unavailable"
            description={error || 'This shift is no longer open for new applications or does not exist.'}
            actionLabel="Return to Discovery"
            onAction={() => router.back()}
          />
        </View>
      </SafeAreaView>
    );
  }

  const totalPay = shift.hourlyRate * shift.durationHours;
  const slotsRemaining = Math.max(0, shift.slotsTotal - shift.slotsFilled);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'bottom']}>
      <ScreenHeader
        title={shift.title}
        subtitle={`${shift.category.toUpperCase()} • ${shift.zone}`}
        onBack={() => router.back()}
        rightAction={
          isBooked ? (
            <Badge label="CONFIRMED ON ROSTER" variant="success" size="sm" />
          ) : applied ? (
            <Badge label="APPLICATION SUBMITTED" variant="warning" size="sm" />
          ) : (
            <Badge
              label={`${shift.durationHours}h Shift`}
              variant="neutral"
              size="sm"
            />
          )
        }
      />

      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}
        showsVerticalScrollIndicator={false}
      >
        {/* Wage Card */}
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
              <Text style={[typography.caption, { color: colors.textSecondary, textTransform: 'uppercase', fontWeight: '700' }]}>
                Estimated Shift Earnings
              </Text>
              <WageText style={{ marginTop: 2 }}>{formatINR(totalPay)}</WageText>
              <Text style={{ fontSize: 13, color: colors.textMuted, marginTop: 2 }}>
                {formatINR(shift.hourlyRate)}/hr • {shift.durationHours} scheduled hours
              </Text>
            </View>
            <Badge label="UPI on verified checkout" variant="success" size="sm" />
          </View>

          <View
            style={{
              marginTop: spacing.md,
              padding: spacing.sm,
              backgroundColor: colors.surfaceMuted,
              borderRadius: radii.md,
            }}
          >
            <Text style={{ fontSize: 12, color: colors.textSecondary, lineHeight: 18 }}>
              Shift wages are calculated from verified attendance hours. Once supervisor reviews attendance and approves hours, payout processing begins through bank rails to your verified UPI handle.
            </Text>
          </View>
        </Card>

        {/* Organizer Card */}
        <Card variant="outlined" style={{ borderRadius: radii.xl }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View style={{ flex: 1 }}>
              <Text style={[typography.caption, { color: colors.textMuted, textTransform: 'uppercase' }]}>
                Event Host
              </Text>
              <Text style={[typography.subtitle, { color: colors.textPrimary, marginTop: 2 }]}>
                {shift.organizer?.businessName || 'Organizer details unavailable'}
              </Text>
              {shift.organizer?.businessType && (
                <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 1, textTransform: 'capitalize' }}>
                  {shift.organizer.businessType.replace('_', ' ')}
                </Text>
              )}
            </View>
            {shift.organizer?.verificationStatus === 'verified' && (
              <Badge label="Verified Host" variant="success" size="sm" />
            )}
          </View>
        </Card>

        {/* Schedule & Venue Card */}
        <Card variant="outlined" style={{ borderRadius: radii.xl, gap: spacing.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
            <Calendar size={18} color={colors.primary} strokeWidth={2.2} style={{ marginRight: 10, marginTop: 2 }} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 14, fontWeight: '700', color: colors.textPrimary }}>
                {formatISTDate(shift.date)}
              </Text>
              <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 2 }}>
                {formatTimeRange(shift.startTime, shift.endTime)} ({shift.durationHours} hours)
              </Text>
            </View>
          </View>

          <View style={{ height: 1, backgroundColor: colors.border }} />

          <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
            <MapPin size={18} color={colors.primary} strokeWidth={2.2} style={{ marginRight: 10, marginTop: 2 }} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 14, fontWeight: '700', color: colors.textPrimary }}>
                {shift.venueName}
              </Text>
              <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 2, lineHeight: 18 }}>
                {shift.venueAddress}
              </Text>
              {shift.landmark ? (
                <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 4 }}>
                  Landmark: {shift.landmark}
                </Text>
              ) : null}
            </View>
          </View>

          {shift.reportingInstructions ? (
            <>
              <View style={{ height: 1, backgroundColor: colors.border }} />
              <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                <FileText size={18} color={colors.primary} strokeWidth={2.2} style={{ marginRight: 10, marginTop: 2 }} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: colors.textPrimary }}>
                    Reporting Instructions
                  </Text>
                  <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2, lineHeight: 18 }}>
                    {shift.reportingInstructions}
                  </Text>
                </View>
              </View>
            </>
          ) : null}
        </Card>

        {/* Duties */}
        {shift.duties && shift.duties.length > 0 && (
          <Card variant="outlined" style={{ borderRadius: radii.xl }}>
            <Text style={[typography.subtitle, { color: colors.textPrimary, marginBottom: spacing.sm }]}>
              Responsibilities
            </Text>
            {shift.duties.map((duty, idx) => (
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
        )}

        {/* Working Conditions & Perks */}
        <Card variant="outlined" style={{ borderRadius: radii.xl }}>
          <Text style={[typography.subtitle, { color: colors.textPrimary, marginBottom: spacing.sm }]}>
            Conditions & Logistics
          </Text>
          <View style={{ gap: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Utensils size={15} color={colors.primary} strokeWidth={2} />
              <Text style={{ fontSize: 13, color: colors.textSecondary }}>
                Meals: {shift.mealProvided ? 'Provided on-site' : 'Self-arranged'}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Car size={15} color={colors.primary} strokeWidth={2} />
              <Text style={{ fontSize: 13, color: colors.textSecondary }}>
                Travel: {shift.transportProvided ? 'Allowance / cab provided' : 'Self-arranged'}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Coffee size={15} color={colors.primary} strokeWidth={2} />
              <Text style={{ fontSize: 13, color: colors.textSecondary }}>
                Breaks: {shift.breaksMinutes ? `${shift.breaksMinutes} minutes` : 'Standard rest breaks'}
              </Text>
            </View>
            {shift.overtimePolicy ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Clock size={15} color={colors.primary} strokeWidth={2} />
                <Text style={{ fontSize: 13, color: colors.textSecondary }}>
                  Overtime: {shift.overtimePolicy}
                </Text>
              </View>
            ) : null}
            {shift.applicationDeadline ? (
              <Text style={{ fontSize: 13, color: colors.primary, fontWeight: '600' }}>
                ⏳ Application Deadline: {formatDeadline(shift.applicationDeadline)}
              </Text>
            ) : null}
          </View>
        </Card>

        {/* Dress Code */}
        {shift.dressCode ? (
          <Card variant="outlined" style={{ borderRadius: radii.xl }}>
            <Text style={[typography.subtitle, { color: colors.textPrimary, marginBottom: spacing.xs }]}>
              Dress Code & Presentation
            </Text>
            <Text style={{ fontSize: 13, color: colors.textSecondary, lineHeight: 19 }}>
              {shift.dressCode}
            </Text>
          </Card>
        ) : null}

        {/* Staffing Status */}
        <View
          style={{
            padding: spacing.md,
            backgroundColor: colors.surfaceMuted,
            borderRadius: radii.lg,
            borderLeftWidth: 3,
            borderLeftColor: colors.primary,
          }}
        >
          <Text style={{ fontSize: 12, color: colors.textSecondary, lineHeight: 18 }}>
            ℹ️ <Text style={{ fontWeight: '700' }}>Shift Status:</Text>{' '}
            {isBooked
              ? 'You are confirmed on the crew roster for this shift!'
              : applied
              ? 'Your application has been received and is under organizer review.'
              : `${slotsRemaining} of ${shift.slotsTotal} spots remaining. Expressing interest submits your profile for organizer review.`}
          </Text>
        </View>

        {/* Primary Action Button */}
        <View style={{ marginTop: spacing.sm, paddingBottom: spacing.xl, gap: spacing.xs }}>
          {isBooked ? (
            <Button
              title="✓ Confirmed on Roster • View in My Shifts"
              variant="primary"
              size="lg"
              onPress={() => router.push('/(tabs)/my-shifts')}
            />
          ) : applied ? (
            <Button
              title="✓ Already Applied • View My Shifts"
              variant="secondary"
              size="lg"
              onPress={() => router.push('/(tabs)/my-shifts')}
            />
          ) : (
            <Button
              title="Express Interest / Apply"
              variant="primary"
              size="lg"
              loading={submitting}
              onPress={handleApply}
            />
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
