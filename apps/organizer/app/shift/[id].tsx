import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Alert,
  StyleSheet,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  useOpsklTheme,
  ScreenHeader,
  Card,
  Badge,
  Button,
  WageText,
  Input,
  EmptyState,
  useAuth,
} from '@opskil/design-system';
import {
  Booking,
  Job,
  formatINR,
  formatISTDate,
  formatTimeRange,
  fetchJobById,
  fetchJobBookings,
  checkInWorkerSafe,
  checkOutWorkerSafe,
  completeShiftAndApproveAttendance,
  recordNoShowSafe,
  cancelBookingSafe,
} from '@opskil/shared';
import { Star, CheckCircle2, Users } from 'lucide-react-native';

export default function OrganizerShiftDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const { colors, spacing, radii, typography } = useOpsklTheme();

  const [job, setJob] = useState<Job | null>(null);
  const [crew, setCrew] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal actions
  const [checkInBooking, setCheckInBooking] = useState<Booking | null>(null);
  const [manualCode, setManualCode] = useState('');
  const [checkInError, setCheckInError] = useState<string | null>(null);
  const [noShowBooking, setNoShowBooking] = useState<Booking | null>(null);
  const [noShowReason, setNoShowReason] = useState('');
  const [cancelBooking, setCancelBooking] = useState<Booking | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [actionBusy, setActionBusy] = useState(false);

  const loadShiftData = useCallback(async () => {
    if (!id) {
      setError('Invalid shift identifier.');
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const [jobData, crewData] = await Promise.all([
        fetchJobById(id),
        fetchJobBookings(id),
      ]);

      if (jobData) {
        setJob(jobData);
      } else {
        setError('Shift not found or access denied.');
      }
      setCrew(crewData || []);
    } catch (err: any) {
      console.error('Failed to load shift details', err);
      setError(err?.message || 'Failed to load shift details.');
      setCrew([]);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadShiftData();
  }, [loadShiftData]);

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[typography.body, { marginTop: 12, color: colors.textSecondary }]}>
          Loading live shift console…
        </Text>
      </SafeAreaView>
    );
  }

  if (error || !job) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <ScreenHeader title="Shift Console" onBack={() => router.back()} />
        <View style={{ flex: 1, justifyContent: 'center', padding: spacing.xl }}>
          <EmptyState
            title="Shift Not Found"
            description={error || 'This shift is unavailable or you do not have permission to view it.'}
            actionLabel="Return to Dashboard"
            onAction={() => router.back()}
          />
        </View>
      </SafeAreaView>
    );
  }

  const activeJob: Job = job;

  /**
   * Supervisor Check-In Verification
   */
  const handleVerifyCheckIn = (booking: Booking) => {
    if (!session?.user?.id) {
      Alert.alert('Sign In Required', 'Please sign in with your organizer account to manage crew attendance.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign In', onPress: () => router.push(`/auth/login?redirect=${encodeURIComponent(`/shift/${id}`)}` as any) },
      ]);
      return;
    }
    setCheckInBooking(booking);
    setManualCode(booking.checkInCode || '');
    setCheckInError(null);
  };

  const submitManualCheckIn = async () => {
    if (!checkInBooking) return;
    const codeToVerify = manualCode.trim().toUpperCase();
    if (!codeToVerify) {
      setCheckInError('Please enter the verification pass code presented by the worker.');
      return;
    }
    setActionBusy(true);
    setCheckInError(null);
    const res = await checkInWorkerSafe(checkInBooking.id, codeToVerify);
    setActionBusy(false);
    if (res.success) {
      setCrew((prev) =>
        prev.map((c) =>
          c.id === checkInBooking.id
            ? { ...c, status: 'checked_in', checkInTime: new Date().toISOString() }
            : c
        )
      );
      const workerName = checkInBooking.worker?.profile?.fullName || 'Worker';
      setCheckInBooking(null);
      setManualCode('');
      Alert.alert('Check-In Verified', `${workerName} marked present on-site.`);
    } else {
      setCheckInError(res.error || 'Failed to verify check-in code. Please check the code and retry.');
    }
  };

  /**
   * Supervisor Record Check-Out
   */
  const handleRecordCheckOut = async (booking: Booking) => {
    if (!session?.user?.id) {
      Alert.alert('Sign In Required', 'Please sign in with your organizer account to manage crew attendance.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign In', onPress: () => router.push(`/auth/login?redirect=${encodeURIComponent(`/shift/${id}`)}` as any) },
      ]);
      return;
    }
    const workerName = booking.worker?.profile?.fullName || 'Worker';
    Alert.alert(
      'Record Shift Check-Out',
      `Record shift conclusion for ${workerName}? Hours will be submitted for final attendance sign-off.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Record Departure',
          onPress: async () => {
            const res = await checkOutWorkerSafe(booking.id, 'Shift concluded on-site');
            if (res.success) {
              setCrew((prev) =>
                prev.map((c) =>
                  c.id === booking.id
                    ? { ...c, status: 'completed_awaiting_review', checkOutTime: new Date().toISOString() }
                    : c
                )
              );
              Alert.alert('Check-Out Recorded', `${workerName} check-out recorded.`);
            } else {
              Alert.alert('Error', res.error || 'Failed to check out.');
            }
          },
        },
      ]
    );
  };

  /**
   * Supervisor Approve Attendance & Payout Sign-Off
   */
  const handleApproveAttendance = async (booking: Booking) => {
    if (!session?.user?.id) {
      Alert.alert('Sign In Required', 'Please sign in with your organizer account to authorize wage payouts.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign In', onPress: () => router.push(`/auth/login?redirect=${encodeURIComponent(`/shift/${id}`)}` as any) },
      ]);
      return;
    }
    const workerName = booking.worker?.profile?.fullName || 'Worker';
    Alert.alert(
      'Approve Attendance & Authorize Payout',
      `Confirm full attendance sign-off for ${workerName}?\n\nThis will record ${activeJob.durationHours} verified hours and authorize wage payout of ${formatINR(booking.agreedTotalPay)} to their verified UPI handle.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Approve & Authorize',
          onPress: async () => {
            const res = await completeShiftAndApproveAttendance(booking.id, activeJob.durationHours);
            if (res.success) {
              setCrew((prev) =>
                prev.map((c) =>
                  c.id === booking.id ? { ...c, status: 'completed', completedAt: new Date().toISOString() } : c
                )
              );
              Alert.alert('Attendance Approved', `Shift attendance verified for ${workerName}. Wage payout processing initiated.`);
            } else {
              Alert.alert('Error', res.error || 'Failed to approve attendance.');
            }
          },
        },
      ]
    );
  };

  /**
   * Record No-Show
   */
  const submitNoShow = async () => {
    if (!noShowBooking) return;
    if (noShowReason.trim().length < 5) {
      Alert.alert('Reason Required', 'Please provide a documented reason for marking no-show.');
      return;
    }

    setActionBusy(true);
    const res = await recordNoShowSafe(noShowBooking.id, noShowReason.trim());
    setActionBusy(false);

    if (res.success) {
      setCrew((prev) =>
        prev.map((c) => (c.id === noShowBooking.id ? { ...c, status: 'no_show', noShowReason } : c))
      );
      setNoShowBooking(null);
      setNoShowReason('');
      Alert.alert('No-Show Recorded', 'Record documented. Slot has been reopened for standby candidates.');
    } else {
      Alert.alert('Error', res.error || 'Failed to record no-show.');
    }
  };

  /**
   * Cancel Booking (Organizer)
   */
  const submitCancellation = async () => {
    if (!cancelBooking) return;
    if (cancelReason.trim().length < 5) {
      Alert.alert('Reason Required', 'Please specify cancellation reason.');
      return;
    }

    setActionBusy(true);
    const res = await cancelBookingSafe(cancelBooking.id, cancelReason.trim());
    setActionBusy(false);

    if (res.success) {
      setCrew((prev) =>
        prev.map((c) => (c.id === cancelBooking.id ? { ...c, status: 'cancelled', cancellationReason: cancelReason } : c))
      );
      setCancelBooking(null);
      setCancelReason('');
      Alert.alert('Booking Cancelled', 'Booking cancelled and slot reopened.');
    } else {
      Alert.alert('Error', res.error || 'Failed to cancel booking.');
    }
  };

  const checkedInCount = crew.filter((c) => ['checked_in', 'completed_awaiting_review', 'completed'].includes(c.status)).length;
  const totalEscrow = crew.reduce((acc, c) => acc + c.agreedTotalPay, 0);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'bottom']}>
      <ScreenHeader
        title="Live Shift Console"
        subtitle={activeJob.title}
        onBack={() => router.back()}
        rightAction={<Badge label={`${activeJob.durationHours}h SHIFT`} variant="neutral" size="sm" />}
      />

      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}>
        {!session?.user?.id && (
          <Card
            variant="outlined"
            style={{
              padding: spacing.md,
              borderColor: colors.borderFocus,
              backgroundColor: colors.surfaceMuted,
            }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View style={{ flex: 1, marginRight: spacing.md }}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: colors.textPrimary }}>
                  Guest Console Preview
                </Text>
                <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>
                  Sign in with your organizer account to verify crew arrivals, record departures, and approve attendance payouts.
                </Text>
              </View>
              <Button
                title="Sign In"
                variant="primary"
                size="sm"
                fullWidth={false}
                onPress={() => router.push(`/auth/login?redirect=${encodeURIComponent(`/shift/${id}`)}` as any)}
              />
            </View>
          </Card>
        )}

        {/* Attendance Summary Banner */}
        <Card variant="elevated">
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View>
              <Text style={{ fontSize: 12, color: colors.textSecondary, textTransform: 'uppercase', fontWeight: '700' }}>
                On-Site Headcount Arrival
              </Text>
              <Text style={[typography.h1, { color: colors.textPrimary, marginTop: 2 }]}>
                {checkedInCount} / {crew.length} Checked In
              </Text>
            </View>
            <Badge
              label={checkedInCount === crew.length ? 'ALL PRESENT' : `${crew.length - checkedInCount} PENDING`}
              variant="neutral"
            />
          </View>

          <View style={{ height: 1, backgroundColor: colors.border, marginVertical: spacing.md }} />

          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <View>
              <Text style={{ fontSize: 11, color: colors.textMuted }}>Timing & Date</Text>
              <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textPrimary, marginTop: 1 }}>
                {formatISTDate(activeJob.date)} • {formatTimeRange(activeJob.startTime, activeJob.endTime)}
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={{ fontSize: 11, color: colors.textMuted }}>Locked Escrow</Text>
              <WageText style={{ fontSize: 15 }}>{formatINR(totalEscrow)}</WageText>
            </View>
          </View>
        </Card>

        {/* Live Crew Roster */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
          <Text style={[typography.h3, { color: colors.textPrimary }]}>Crew Attendance Roster</Text>
          <Text style={{ fontSize: 12, color: colors.textMuted }}>
            {crew.length} workers booked
          </Text>
        </View>

        {crew.length === 0 ? (
          <Card
            variant="outlined"
            style={{
              padding: spacing.xl,
              alignItems: 'center',
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderRadius: radii.lg,
            }}
          >
            <Users size={36} color={colors.textMuted} strokeWidth={1.8} />
            <Text style={[typography.h3, { color: colors.textPrimary, marginTop: spacing.sm, textAlign: 'center' }]}>
              No Confirmed Crew Yet
            </Text>
            <Text style={{ fontSize: 13, color: colors.textSecondary, textAlign: 'center', marginTop: 4, lineHeight: 18 }}>
              Workers shortlisted and confirmed from your applicant queue will appear here with on-site arrival codes and live attendance tracking.
            </Text>
            <View style={{ marginTop: spacing.md }}>
              <Button
                title="View Hiring Queue"
                variant="outline"
                size="sm"
                onPress={() => router.push('/(tabs)/roster' as any)}
              />
            </View>
          </Card>
        ) : (
          crew.map((member) => {
            const worker = member.worker;
            const profile = worker?.profile;
            const isCheckedIn = member.status === 'checked_in';
            const isAwaitingReview = member.status === 'completed_awaiting_review';
            const isCompleted = member.status === 'completed';
            const isNoShow = member.status === 'no_show';
            const isCancelled = member.status === 'cancelled';

            let badgeVariant: 'success' | 'warning' | 'primary' | 'danger' | 'info' = 'primary';
            let badgeLabel = 'CONFIRMED (PENDING ARRIVAL)';

            if (isCheckedIn) {
              badgeVariant = 'success';
              badgeLabel = 'ON-SITE PRESENT';
            } else if (isAwaitingReview) {
              badgeVariant = 'warning';
              badgeLabel = 'AWAITING SIGN-OFF';
            } else if (isCompleted) {
              badgeVariant = 'success';
              badgeLabel = 'COMPLETED (PAYOUT SETTLED)';
            } else if (isNoShow) {
              badgeVariant = 'danger';
              badgeLabel = 'NO-SHOW';
            } else if (isCancelled) {
              badgeVariant = 'danger';
              badgeLabel = 'CANCELLED';
            }

            return (
              <Card
                key={member.id}
                variant="outlined"
                style={{
                  borderRadius: radii.lg,
                  borderColor: isCheckedIn ? colors.primary : colors.border,
                }}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={{ fontSize: 15, fontWeight: '700', color: colors.textPrimary }}>
                        {profile?.fullName || 'Worker'}
                      </Text>
                      {worker?.verificationStatus === 'verified' && (
                        <Badge label="VERIFIED" variant="success" size="sm" />
                      )}
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 1 }}>
                      <Text style={{ fontSize: 12, color: colors.textSecondary }}>
                        {profile?.phone || 'Contact verified'} •
                      </Text>
                      <Star size={11} color={colors.warning} fill={colors.warning} />
                      <Text style={{ fontSize: 12, color: colors.textSecondary, fontWeight: '600' }}>
                        {worker?.rating && worker.rating > 0 ? worker.rating.toFixed(1) : 'New'}
                      </Text>
                    </View>
                    <Text style={{ fontSize: 11, color: colors.primary, fontWeight: '600', marginTop: 2 }}>
                      Token: {member.checkInCode || 'Not Provisioned'}
                    </Text>
                  </View>

                  <Badge label={badgeLabel} variant={badgeVariant} size="sm" />
                </View>

                {/* Status-specific action buttons */}
                <View
                  style={{
                    flexDirection: 'row',
                    gap: 8,
                    marginTop: spacing.md,
                    paddingTop: spacing.xs,
                    borderTopWidth: 1,
                    borderTopColor: colors.border,
                  }}
                >
                  {member.status === 'confirmed' && (
                    <>
                      <View style={{ flex: 1.5 }}>
                        <Button
                          title="Confirm Check-In"
                          variant="primary"
                          size="sm"
                          onPress={() => handleVerifyCheckIn(member)}
                        />
                      </View>
                      <Button
                        title="Mark No-Show"
                        variant="ghost"
                        size="sm"
                        fullWidth={false}
                        onPress={() => setNoShowBooking(member)}
                      />
                      <Button
                        title="Cancel"
                        variant="ghost"
                        size="sm"
                        fullWidth={false}
                        onPress={() => setCancelBooking(member)}
                      />
                    </>
                  )}

                  {isCheckedIn && (
                    <View style={{ flex: 1 }}>
                      <Button
                        title="Record Check-Out"
                        variant="primary"
                        size="sm"
                        onPress={() => handleRecordCheckOut(member)}
                      />
                    </View>
                  )}

                  {isAwaitingReview && (
                    <View style={{ flex: 1 }}>
                      <Button
                        title="Approve Attendance & Payout"
                        variant="primary"
                        size="sm"
                        onPress={() => handleApproveAttendance(member)}
                      />
                    </View>
                  )}

                  {isCompleted && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <CheckCircle2 size={13} color={colors.success} strokeWidth={2.4} />
                      <Text style={{ fontSize: 12, color: colors.success, fontWeight: '700' }}>
                        Payout of {formatINR(member.agreedTotalPay)} Released to Worker
                      </Text>
                    </View>
                  )}

                  {isNoShow && (
                    <Text style={{ fontSize: 12, color: colors.danger }}>
                      Documented No-Show: {member.noShowReason}
                    </Text>
                  )}
                </View>
              </Card>
            );
          })
        )}
      </ScrollView>

      {/* Manual Check-In Verification Modal */}
      <Modal visible={Boolean(checkInBooking)} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface, borderRadius: radii.lg }]}>
            <Text style={[typography.h3, { color: colors.textPrimary }]}>Verify Worker Arrival</Text>
            <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 4 }}>
              Confirm check-in for {checkInBooking?.worker?.profile?.fullName || 'Worker'}. Enter the pass code shown on their Opskl app pass:
            </Text>

            <View style={{ marginVertical: spacing.md }}>
              <Input
                label="Worker Pass Code"
                value={manualCode}
                onChangeText={(val) => {
                  setManualCode(val);
                  if (checkInError) setCheckInError(null);
                }}
                placeholder="e.g. OP-4829"
                autoCapitalize="characters"
                error={checkInError || undefined}
              />
              {checkInBooking?.checkInCode ? (
                <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 4 }}>
                  Expected System Token: {checkInBooking.checkInCode}
                </Text>
              ) : null}
            </View>

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Button
                  title="Cancel"
                  variant="outline"
                  size="md"
                  onPress={() => {
                    setCheckInBooking(null);
                    setManualCode('');
                    setCheckInError(null);
                  }}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Button
                  title="Verify Arrival"
                  variant="primary"
                  size="md"
                  loading={actionBusy}
                  onPress={submitManualCheckIn}
                />
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* No-Show Documentation Modal */}
      <Modal visible={Boolean(noShowBooking)} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface, borderRadius: radii.lg }]}>
            <Text style={[typography.h3, { color: colors.textPrimary }]}>Record No-Show</Text>
            <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 4 }}>
              Document failure to arrive on-site for {noShowBooking?.worker?.profile?.fullName || 'Worker'}. This reopens the opening for standby workers and notifies the worker with dispute rights.
            </Text>

            <View style={{ marginVertical: spacing.md }}>
              <Input
                label="Documented Reason"
                value={noShowReason}
                onChangeText={setNoShowReason}
                placeholder="e.g. Unreachable 45 mins after shift reporting time"
                multiline
                numberOfLines={3}
              />
            </View>

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Button
                  title="Cancel"
                  variant="outline"
                  size="md"
                  onPress={() => {
                    setNoShowBooking(null);
                    setNoShowReason('');
                  }}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Button
                  title="Confirm No-Show"
                  variant="primary"
                  size="md"
                  loading={actionBusy}
                  onPress={submitNoShow}
                />
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* Cancellation Modal */}
      <Modal visible={Boolean(cancelBooking)} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface, borderRadius: radii.lg }]}>
            <Text style={[typography.h3, { color: colors.textPrimary }]}>Cancel Worker Booking</Text>
            <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 4 }}>
              Cancel confirmed booking for {cancelBooking?.worker?.profile?.fullName || 'Worker'}? Please provide a reason:
            </Text>

            <View style={{ marginVertical: spacing.md }}>
              <Input
                label="Reason"
                value={cancelReason}
                onChangeText={setCancelReason}
                placeholder="e.g. Client headcount reduction"
                multiline
                numberOfLines={3}
              />
            </View>

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Button
                  title="Keep Booking"
                  variant="outline"
                  size="md"
                  onPress={() => {
                    setCancelBooking(null);
                    setCancelReason('');
                  }}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Button
                  title="Cancel Booking"
                  variant="primary"
                  size="md"
                  loading={actionBusy}
                  onPress={submitCancellation}
                />
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    padding: 20,
    elevation: 8,
  },
});
