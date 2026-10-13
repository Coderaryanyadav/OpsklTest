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
import { Star, CheckCircle2 } from 'lucide-react-native';

const SEED_ROSTER: Booking[] = [
  {
    id: 'roster-seed-1',
    jobId: 'org-shift-1',
    workerId: 'worker-101',
    organizerId: 'org-apex-01',
    status: 'checked_in',
    agreedHourlyRate: 185,
    agreedTotalPay: 1665,
    checkInCode: 'OP-4829',
    checkInTime: '2026-10-14T08:24:00Z',
    confirmedAt: '2026-10-12T10:00:00Z',
    worker: {
      id: 'worker-101',
      preferredLocality: 'Bandra West',
      skills: ['Registration Scanning', 'VIP Ushering'],
      experienceYears: 3,
      rating: 4.92,
      totalReviews: 18,
      shiftsCompleted: 14,
      verificationStatus: 'verified',
      profile: {
        id: 'worker-101',
        fullName: 'Aryan Yadav',
        phone: '+91 98200 98200',
        city: 'Mumbai',
        role: 'worker',
        isActive: true,
        createdAt: '',
        updatedAt: '',
      },
      availabilityStatus: 'available',
      profileCompletionStatus: 'completed',
      serviceAreas: [],
      createdAt: '',
      updatedAt: '',
    },
  },
  {
    id: 'roster-seed-2',
    jobId: 'org-shift-1',
    workerId: 'worker-102',
    organizerId: 'org-apex-01',
    status: 'confirmed',
    agreedHourlyRate: 185,
    agreedTotalPay: 1665,
    checkInCode: 'OP-5192',
    confirmedAt: '2026-10-12T11:00:00Z',
    worker: {
      id: 'worker-102',
      preferredLocality: 'Andheri East',
      skills: ['Ticketing Desk', 'Customer Service'],
      experienceYears: 2,
      rating: 4.88,
      totalReviews: 12,
      shiftsCompleted: 9,
      verificationStatus: 'verified',
      profile: {
        id: 'worker-102',
        fullName: 'Neha Kulkarni',
        phone: '+91 98199 98199',
        city: 'Mumbai',
        role: 'worker',
        isActive: true,
        createdAt: '',
        updatedAt: '',
      },
      availabilityStatus: 'available',
      profileCompletionStatus: 'completed',
      serviceAreas: [],
      createdAt: '',
      updatedAt: '',
    },
  },
  {
    id: 'roster-seed-3',
    jobId: 'org-shift-1',
    workerId: 'worker-103',
    organizerId: 'org-apex-01',
    status: 'completed_awaiting_review',
    agreedHourlyRate: 185,
    agreedTotalPay: 1665,
    checkInCode: 'OP-8831',
    checkInTime: '2026-10-14T08:15:00Z',
    checkOutTime: '2026-10-14T17:35:00Z',
    confirmedAt: '2026-10-12T12:00:00Z',
    worker: {
      id: 'worker-103',
      preferredLocality: 'Goregaon East',
      skills: ['Queue Marshall'],
      experienceYears: 1,
      rating: 4.75,
      totalReviews: 7,
      shiftsCompleted: 6,
      verificationStatus: 'verified',
      profile: {
        id: 'worker-103',
        fullName: 'Vikram Joshi',
        phone: '+91 98330 98330',
        city: 'Mumbai',
        role: 'worker',
        isActive: true,
        createdAt: '',
        updatedAt: '',
      },
      availabilityStatus: 'available',
      profileCompletionStatus: 'completed',
      serviceAreas: [],
      createdAt: '',
      updatedAt: '',
    },
  },
];

export default function OrganizerShiftDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors, spacing, radii, typography } = useOpsklTheme();

  const [job, setJob] = useState<Job | null>(null);
  const [crew, setCrew] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal actions
  const [noShowBooking, setNoShowBooking] = useState<Booking | null>(null);
  const [noShowReason, setNoShowReason] = useState('');
  const [cancelBooking, setCancelBooking] = useState<Booking | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [actionBusy, setActionBusy] = useState(false);

  const loadShiftData = useCallback(async () => {
    if (!id) return;
    try {
      const [jobData, crewData] = await Promise.all([
        fetchJobById(id),
        fetchJobBookings(id),
      ]);

      if (jobData) setJob(jobData);
      if (crewData.length > 0) {
        setCrew(crewData);
      } else {
        setCrew(SEED_ROSTER);
      }
    } catch (err) {
      console.error('Failed to load shift details', err);
      setCrew(SEED_ROSTER);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadShiftData();
  }, [loadShiftData]);

  // Fallback job info if fresh
  const activeJob: Job = job || {
    id: id || 'org-shift-1',
    organizerId: 'org-apex-01',
    title: 'Registration Desk & VIP Usher',
    category: 'conference',
    venueName: 'Jio World Convention Centre, Pavilion 2',
    venueAddress: 'G Block BKC, Bandra East, Mumbai 400098',
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
    duties: ['Scan attendee passes', 'Issue VIP badges'],
    supervisorName: 'Rohit Verma',
    supervisorPhone: '+91 98201 98201',
    status: 'open',
    createdAt: '',
    updatedAt: '',
  };

  /**
   * Supervisor Check-In Verification
   */
  const handleVerifyCheckIn = async (booking: Booking) => {
    const workerName = booking.worker?.profile?.fullName || 'Worker';
    Alert.alert(
      'Confirm Check-In',
      `Confirm on-site arrival of ${workerName}?\nVerification Token: ${booking.checkInCode || 'OP-4829'}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm Arrival',
          onPress: async () => {
            const res = await checkInWorkerSafe(booking.id, booking.checkInCode || 'OP-4829');
            if (res.success) {
              setCrew((prev) =>
                prev.map((c) =>
                  c.id === booking.id
                    ? { ...c, status: 'checked_in', checkInTime: new Date().toISOString() }
                    : c
                )
              );
              Alert.alert('✓ Check-In Verified', `${workerName} marked present on-site.`);
            } else {
              Alert.alert('Error', res.error || 'Failed to verify check-in.');
            }
          },
        },
      ]
    );
  };

  /**
   * Supervisor Record Check-Out
   */
  const handleRecordCheckOut = async (booking: Booking) => {
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
              Alert.alert('✓ Check-Out Recorded', `${workerName} check-out recorded.`);
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
    const workerName = booking.worker?.profile?.fullName || 'Worker';
    Alert.alert(
      'Approve Attendance & Release Payout',
      `Confirm full attendance sign-off for ${workerName}?\n\nThis will trigger direct UPI payout of ${formatINR(booking.agreedTotalPay)} from your escrow deposit.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Approve & Release Payout',
          onPress: async () => {
            const res = await completeShiftAndApproveAttendance(booking.id, activeJob.durationHours);
            if (res.success) {
              setCrew((prev) =>
                prev.map((c) =>
                  c.id === booking.id ? { ...c, status: 'completed', completedAt: new Date().toISOString() } : c
                )
              );
              Alert.alert('Payout Initiated', `Attendance confirmed. ${formatINR(booking.agreedTotalPay)} initiated to ${workerName}.`);
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
        rightAction={<Badge label={`${activeJob.durationHours}h SHIFT`} variant="info" size="sm" />}
      />

      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}>
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
              variant={checkedInCount === crew.length ? 'success' : 'warning'}
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

        {loading ? (
          <ActivityIndicator size="large" color={colors.primary} />
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
                        {profile?.phone || '+91 98200 98200'} •
                      </Text>
                      <Star size={11} color={colors.warning} fill={colors.warning} />
                      <Text style={{ fontSize: 12, color: colors.textSecondary, fontWeight: '600' }}>
                        {worker?.rating?.toFixed(1) || '5.0'}
                      </Text>
                    </View>
                    <Text style={{ fontSize: 11, color: colors.primary, fontWeight: '600', marginTop: 2 }}>
                      Token: {member.checkInCode || 'OP-4829'}
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
