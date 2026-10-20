import { useState, useEffect } from 'react';
import { View, Text, ScrollView, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  useOpsklTheme,
  Screen,
  ScreenHeader,
  Button,
  WageText,
  EmptyState,
  useAuth,
  ErrorRetry,
  StatusIndicator,
  Divider,
  LoadingView,
  InlineBanner,
} from '@opskil/design-system';
import {
  formatINR,
  formatTimeRange,
  formatISTDate,
  formatDeadline,
  fetchJobById,
  applyForJobSafe,
  fetchWorkerJobStatus,
  fetchWorkerBookings,
  fetchWorkerProfile,
  checkShiftConflicts,
  ShiftConflictCheck,
  Job,
  WorkerProfile,
  supabase,
} from '@opskil/shared';
import { Calendar, MapPin, FileText, Utensils, Car, Coffee, Clock } from 'lucide-react-native';

export default function WorkerShiftDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const { colors, spacing, typography } = useOpsklTheme();

  const [shift, setShift] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [applied, setApplied] = useState(false);
  const [isBooked, setIsBooked] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [conflictCheck, setConflictCheck] = useState<ShiftConflictCheck | null>(null);
  const [workerProfile, setWorkerProfile] = useState<WorkerProfile | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

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
        let resolvedJobId = id;
        let data = await fetchJobById(resolvedJobId);
        if (!data) {
          const { data: bookingRow } = await supabase
            .from('bookings')
            .select('job_id')
            .eq('id', id)
            .maybeSingle();
          if (bookingRow?.job_id) {
            resolvedJobId = bookingRow.job_id;
            data = await fetchJobById(resolvedJobId);
          }
        }

        const [statusData, userBookings, profile] = await Promise.all([
          session?.user?.id ? fetchWorkerJobStatus(resolvedJobId, session.user.id) : null,
          session?.user?.id ? fetchWorkerBookings(session.user.id) : Promise.resolve([]),
          session?.user?.id ? fetchWorkerProfile(session.user.id) : Promise.resolve(null),
        ]);

        if (profile) {
          setWorkerProfile(profile);
        }

        if (data) {
          setShift(data);
          if (userBookings && userBookings.length > 0) {
            const conflict = checkShiftConflicts(data, userBookings);
            setConflictCheck(conflict);
          }
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
  }, [id, session?.user?.id, reloadKey]);

  const handleApply = async () => {
    if (!shift) return;
    if (!session?.user?.id) {
      Alert.alert('Sign In Required', 'Please sign in to apply for this shift.', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign In',
          onPress: () =>
            router.push(`/auth/login?redirect=${encodeURIComponent(`/shift/${id}`)}` as any),
        },
      ]);
      return;
    }

    if (workerProfile && workerProfile.verificationStatus !== 'verified') {
      Alert.alert(
        'Identity Verification Required',
        workerProfile.verificationStatus === 'pending'
          ? 'Your identity documents are under review by Opskl admin. You can apply once approved.'
          : 'Your profile must be verified before you can apply for shifts. Please complete your identity verification in onboarding.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Verify Identity Now', onPress: () => router.push('/onboarding' as any) },
        ]
      );
      return;
    }

    const executeApplication = async () => {
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

    if (conflictCheck?.hasConflict) {
      Alert.alert(
        'Schedule Overlap Conflict',
        conflictCheck.message ||
          'You already have another confirmed shift scheduled during this time window. Opskl prevents double-booking to protect your reliability score.',
        [{ text: 'Understood', style: 'cancel' }]
      );
      return;
    }

    if (conflictCheck?.hasTravelWarning) {
      Alert.alert(
        'Transit Commute Warning',
        `${conflictCheck.message}\n\nDo you want to submit your application anyway?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Yes, Apply Anyway', onPress: () => executeApplication() },
        ]
      );
      return;
    }

    await executeApplication();
  };

  if (loading) {
    return (
      <Screen edges={['top', 'bottom']}>
        <LoadingView message="Loading verified shift details…" />
      </Screen>
    );
  }

  if (error || !shift) {
    return (
      <Screen edges={['top', 'bottom']}>
        <ScreenHeader title="Shift Details" onBack={() => router.back()} />
        <View style={{ flex: 1, justifyContent: 'center', padding: spacing.xl }}>
          {error && error !== 'Shift not found or has been concluded.' ? (
            <ErrorRetry
              variant="block"
              title="Could Not Load Shift"
              message={error}
              onRetry={() => setReloadKey((k) => k + 1)}
            />
          ) : (
            <EmptyState
              title="Shift Unavailable"
              description={error || 'This shift is no longer open for new applications or does not exist.'}
              actionLabel="Return to Discovery"
              onAction={() => router.back()}
            />
          )}
        </View>
      </Screen>
    );
  }

  const totalPay = shift.hourlyRate * shift.durationHours;
  const slotsRemaining = Math.max(0, shift.slotsTotal - shift.slotsFilled);

  return (
    <Screen edges={['top', 'bottom']}>
      <ScreenHeader
        title={shift.title}
        subtitle={`${shift.category.toUpperCase()} • ${shift.zone}`}
        onBack={() => router.back()}
        rightAction={
          isBooked ? (
            <StatusIndicator label="Confirmed on roster" tone="success" />
          ) : applied ? (
            <StatusIndicator label="Application submitted" tone="warning" />
          ) : (
            <StatusIndicator label={`${shift.durationHours}h shift`} tone="neutral" />
          )
        }
      />

      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}
        showsVerticalScrollIndicator={false}
      >
        <View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <View style={{ flex: 1 }}>
              <Text style={[typography.caption, { color: colors.textSecondary, textTransform: 'uppercase', fontWeight: '700' }]}>
                Estimated Shift Earnings
              </Text>
              <WageText style={{ marginTop: 2 }}>{formatINR(totalPay)}</WageText>
              <Text style={{ fontSize: 13, color: colors.textMuted, marginTop: 2 }}>
                {formatINR(shift.hourlyRate)}/hr • {shift.durationHours} scheduled hours
              </Text>
            </View>
            <StatusIndicator label="UPI disbursement" tone="neutral" />
          </View>

          <Text style={{ fontSize: 12, color: colors.textSecondary, lineHeight: 18, marginTop: spacing.md }}>
            Wages are calculated from verified attendance hours. After supervisor approval, payout processing begins to your verified UPI handle.
          </Text>
        </View>

        <Divider />

        <View>
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
              <StatusIndicator label="Verified host" tone="success" />
            )}
          </View>
        </View>

        <Divider />

        <View style={{ gap: spacing.md }}>
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
          ) : null}
        </View>

        <Divider />

        {shift.duties && shift.duties.length > 0 && (
          <View>
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
          </View>
        )}

        <View>
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
                Application Deadline: {formatDeadline(shift.applicationDeadline)}
              </Text>
            ) : null}
          </View>
        </View>

        {shift.dressCode ? (
          <View>
            <Text style={[typography.subtitle, { color: colors.textPrimary, marginBottom: spacing.xs }]}>
              Dress Code & Presentation
            </Text>
            <Text style={{ fontSize: 13, color: colors.textSecondary, lineHeight: 19 }}>
              {shift.dressCode}
            </Text>
          </View>
        ) : null}

        <InlineBanner
          variant="info"
          title="Shift status"
          message={
            isBooked
              ? 'You are confirmed on the crew roster for this shift.'
              : applied
              ? 'Your application has been received and is under organizer review.'
              : `${slotsRemaining} of ${shift.slotsTotal} spots remaining. Expressing interest submits your profile for organizer review.`
          }
        />

        {conflictCheck?.hasConflict && (
          <InlineBanner
            variant="error"
            title="Schedule overlap conflict"
            message={conflictCheck.message || 'You have another confirmed shift in this time window.'}
          />
        )}

        {conflictCheck?.hasTravelWarning && (
          <InlineBanner
            variant="warning"
            title="Transit commute alert"
            message={conflictCheck.message || 'Tight commute between nearby shifts.'}
          />
        )}

        {session?.user?.id && workerProfile && workerProfile.verificationStatus !== 'verified' && !isBooked && !applied && (
          <InlineBanner
            variant="warning"
            title="Identity verification required"
            message={
              workerProfile.verificationStatus === 'pending'
                ? 'Your government identity documents are currently under review by Opskl admin. You can apply as soon as verification is approved.'
                : 'You must complete government identity verification (Aadhaar / PAN) before you can express interest in event shifts.'
            }
          />
        )}

        <View style={{ marginTop: spacing.sm, paddingBottom: spacing.xl, gap: spacing.xs }}>
          {isBooked ? (
            <Button
              title="Confirmed on Roster • View in My Shifts"
              variant="primary"
              size="lg"
              onPress={() => router.push('/(tabs)/my-shifts')}
            />
          ) : applied ? (
            <Button
              title="Already Applied • View My Shifts"
              variant="secondary"
              size="lg"
              onPress={() => router.push('/(tabs)/my-shifts')}
            />
          ) : conflictCheck?.hasConflict ? (
            <Button
              title="Cannot Apply • Schedule Overlap Conflict"
              variant="outline"
              size="lg"
              disabled={true}
              onPress={handleApply}
            />
          ) : session?.user?.id && workerProfile && workerProfile.verificationStatus !== 'verified' ? (
            <Button
              title={
                workerProfile.verificationStatus === 'pending'
                  ? 'Verification Pending Approval • View Status'
                  : 'Complete Identity Verification to Apply'
              }
              variant="primary"
              size="lg"
              onPress={() => router.push('/onboarding' as any)}
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
    </Screen>
  );
}
