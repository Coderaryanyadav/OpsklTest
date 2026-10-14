import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  RefreshControl,
  Alert,
  StyleSheet,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import {
  useOpsklTheme,
  Card,
  Badge,
  Button,
  WageText,
  Input,
  ShiftCardSkeleton,
  useAuth,
} from '@opskil/design-system';
import {
  Booking,
  formatINR,
  formatISTDate,
  getTodayDateIST,
  formatTimeRange,
  fetchWorkerBookings,
  checkInWorkerSafe,
  checkOutWorkerSafe,
  cancelBookingSafe,
  disputeBookingSafe,
} from '@opskil/shared';
import {
  Ticket,
  MapPin,
  Calendar,
  Clock,
  User,
  Copy,
  Check,
  ShieldCheck,
  CheckCircle2,
} from 'lucide-react-native';

type TabState = 'upcoming' | 'active' | 'completed' | 'cancelled';

export default function WorkerMyShiftsScreen() {
  const { session } = useAuth();
  const { colors, spacing, radii, typography, isDark } = useOpsklTheme();

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [activeTab, setActiveTab] = useState<TabState>('active');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Modals state
  const [disputeBookingId, setDisputeBookingId] = useState<string | null>(null);
  const [disputeReason, setDisputeReason] = useState('');
  const [cancelBookingId, setCancelBookingId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [submittingModal, setSubmittingModal] = useState(false);
  const [copiedBookingId, setCopiedBookingId] = useState<string | null>(null);

  const handleCopyCode = async (bookingId: string, code?: string) => {
    if (!code) return;
    try {
      await Clipboard.setStringAsync(code);
    } catch {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(code).catch(() => {});
      }
    }
    setCopiedBookingId(bookingId);
    setTimeout(() => {
      setCopiedBookingId((prev) => (prev === bookingId ? null : prev));
    }, 2000);
  };

  const workerId = session?.user?.id;

  const loadBookings = useCallback(async () => {
    if (!workerId) {
      setBookings([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }
    try {
      setError(null);
      const data = await fetchWorkerBookings(workerId);
      setBookings(data || []);
    } catch (err: any) {
      console.error('Failed to load bookings', err);
      setError(err?.message || 'Could not load your shift bookings.');
      setBookings([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [workerId]);

  useEffect(() => {
    loadBookings();
  }, [loadBookings]);

  const onRefresh = () => {
    setRefreshing(true);
    loadBookings();
  };

  const handleCheckIn = async (booking: Booking) => {
    if (!booking.checkInCode) {
      Alert.alert(
        'Check-In Credential Required',
        'No check-in credential has been provisioned for this booking. Please contact your organizer or support to issue a credential.'
      );
      return;
    }

    Alert.alert(
      'On-Site Shift Check-In',
      `Your official check-in code for this shift is:\n\n🔑 ${booking.checkInCode}\n\nPresent this code to supervisor ${booking.job?.supervisorName || 'on-site'} to confirm your arrival.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm Check-In',
          onPress: async () => {
            const res = await checkInWorkerSafe(booking.id, booking.checkInCode!);
            if (res.success) {
              setBookings((prev) =>
                prev.map((b) =>
                  b.id === booking.id
                    ? { ...b, status: 'checked_in', checkInTime: new Date().toISOString() }
                    : b
                )
              );
              Alert.alert('✓ Check-In Recorded', 'Your arrival has been recorded. Shift timer is now active.');
            } else {
              Alert.alert('Check-In Failed', res.error || 'Failed to record check-in.');
            }
          },
        },
      ]
    );
  };

  /**
   * Handle Shift Check Out
   */
  const handleCheckOut = async (booking: Booking) => {
    Alert.alert(
      'Shift Check-Out',
      'Ready to conclude your shift? This records your shift end time and submits hours for supervisor sign-off.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Check Out Now',
          onPress: async () => {
            const res = await checkOutWorkerSafe(booking.id, 'Shift concluded on-time');
            if (res.success) {
              setBookings((prev) =>
                prev.map((b) =>
                  b.id === booking.id
                    ? { ...b, status: 'completed_awaiting_review', checkOutTime: new Date().toISOString() }
                    : b
                )
              );
              Alert.alert(
                '✓ Shift Concluded',
                'Your check-out is complete. Once supervisor reviews and approves attendance, UPI payout will be initiated.'
              );
            } else {
              Alert.alert('Check-Out Error', res.error || 'Failed to check out.');
            }
          },
        },
      ]
    );
  };

  /**
   * Handle Worker Cancellation (with Standby release)
   */
  const submitCancellation = async () => {
    if (!cancelBookingId) return;
    if (cancelReason.trim().length < 5) {
      Alert.alert('Reason Required', 'Please provide a brief reason for cancellation.');
      return;
    }

    setSubmittingModal(true);
    const res = await cancelBookingSafe(cancelBookingId, cancelReason.trim());
    setSubmittingModal(false);

    if (res.success) {
      setBookings((prev) =>
        prev.map((b) => (b.id === cancelBookingId ? { ...b, status: 'cancelled', cancellationReason: cancelReason } : b))
      );
      setCancelBookingId(null);
      setCancelReason('');
      Alert.alert('Booking Cancelled', 'Your cancellation has been processed. The opening has been offered to standby candidates.');
    } else {
      Alert.alert('Error', res.error || 'Could not cancel booking.');
    }
  };

  /**
   * Handle Dispute Submission
   */
  const submitDispute = async () => {
    if (!disputeBookingId) return;
    if (disputeReason.trim().length < 10) {
      Alert.alert('Dispute Description Required', 'Please specify the exact discrepancy (minimum 10 characters).');
      return;
    }

    setSubmittingModal(true);
    const res = await disputeBookingSafe(disputeBookingId, disputeReason.trim());
    setSubmittingModal(false);

    if (res.success) {
      setBookings((prev) =>
        prev.map((b) => (b.id === disputeBookingId ? { ...b, status: 'disputed', disputeReason: disputeReason } : b))
      );
      setDisputeBookingId(null);
      setDisputeReason('');
      Alert.alert(
        '⚖️ Dispute Submitted',
        'Your dispute has been escalated to Opskl arbitration. An administrator will review venue records and contact both parties.'
      );
    } else {
      Alert.alert('Error', res.error || 'Could not submit dispute.');
    }
  };

  const todayStr = getTodayDateIST();

  const upcomingBookings = bookings.filter(
    (b) => b.status === 'confirmed' && (b.job?.date || '') > todayStr
  );
  const activeBookings = bookings.filter(
    (b) =>
      ['checked_in', 'completed_awaiting_review'].includes(b.status) ||
      (b.status === 'confirmed' && (b.job?.date || '') <= todayStr)
  );
  const completedBookings = bookings.filter((b) => ['completed', 'disputed'].includes(b.status));
  const cancelledBookings = bookings.filter((b) => ['cancelled', 'no_show'].includes(b.status));

  let currentList = activeBookings;
  if (activeTab === 'upcoming') currentList = upcomingBookings;
  if (activeTab === 'completed') currentList = completedBookings;
  if (activeTab === 'cancelled') currentList = cancelledBookings;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      {/* Screen Header */}
      <View
        style={[
          styles.header,
          {
            backgroundColor: colors.surface,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <Text style={[typography.h2, { color: colors.textPrimary }]}>My Shifts & Attendance</Text>
        <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 2 }}>
          Digital check-in passes, active shift timer & payment settlement
        </Text>

        {/* 4 Lifecycle Tabs */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, marginTop: spacing.md }}
        >
          {(
            [
              { id: 'active', label: `Active / Today (${activeBookings.length})` },
              { id: 'upcoming', label: `Upcoming (${upcomingBookings.length})` },
              { id: 'completed', label: `Completed (${completedBookings.length})` },
              { id: 'cancelled', label: `Cancelled (${cancelledBookings.length})` },
            ] as const
          ).map((tab) => {
            const isSelected = activeTab === tab.id;
            return (
              <Pressable
                key={tab.id}
                onPress={() => setActiveTab(tab.id)}
                style={[
                  styles.tabChip,
                  {
                    backgroundColor: isSelected ? colors.primary : colors.surfaceMuted,
                    borderColor: isSelected ? colors.primary : colors.border,
                    borderRadius: radii.full,
                  },
                ]}
              >
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: isSelected ? '700' : '500',
                    color: isSelected ? colors.textInverse : colors.textSecondary,
                  }}
                >
                  {tab.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* Main List */}
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {loading ? (
          <View style={{ gap: spacing.md }}>
            <ShiftCardSkeleton />
            <ShiftCardSkeleton />
          </View>
        ) : error ? (
          <View style={{ padding: 40, alignItems: 'center' }}>
            <Text style={{ fontSize: 32 }}>⚠️</Text>
            <Text style={[typography.h3, { color: colors.textPrimary, marginTop: 8 }]}>
              Could Not Load Bookings
            </Text>
            <Text style={{ fontSize: 13, color: colors.textSecondary, textAlign: 'center', marginTop: 4, marginHorizontal: 24 }}>
              {error}
            </Text>
            <View style={{ marginTop: spacing.md }}>
              <Button title="Retry" variant="primary" size="md" onPress={loadBookings} />
            </View>
          </View>
        ) : currentList.length === 0 ? (
          <View style={{ padding: 40, alignItems: 'center' }}>
            <View
              style={{
                width: 64,
                height: 64,
                borderRadius: 32,
                backgroundColor: colors.surfaceMuted,
                justifyContent: 'center',
                alignItems: 'center',
                marginBottom: 12,
              }}
            >
              <Ticket size={28} color={colors.textMuted} strokeWidth={1.8} />
            </View>
            <Text style={[typography.h3, { color: colors.textPrimary, marginTop: 4 }]}>
              No Shifts in this View
            </Text>
            <Text style={{ fontSize: 13, color: colors.textSecondary, textAlign: 'center', marginTop: 4 }}>
              Check the other tabs or explore the discovery feed for open shifts.
            </Text>
          </View>
        ) : (
          currentList.map((booking) => {
            const job = booking.job;
            const isCheckedIn = booking.status === 'checked_in';
            const isAwaitingReview = booking.status === 'completed_awaiting_review';
            const isCompleted = booking.status === 'completed';
            const isDisputed = booking.status === 'disputed';
            const isCancelled = booking.status === 'cancelled';
            const isNoShow = booking.status === 'no_show';
            const isCopied = copiedBookingId === booking.id;

            let badgeVariant: 'success' | 'warning' | 'primary' | 'danger' | 'info' = 'primary';
            let badgeLabel = 'CONFIRMED';

            if (isCheckedIn) {
              badgeVariant = 'success';
              badgeLabel = 'ON-SITE CHECKED IN';
            } else if (isAwaitingReview) {
              badgeVariant = 'warning';
              badgeLabel = 'AWAITING SIGN-OFF';
            } else if (isCompleted) {
              badgeVariant = 'success';
              badgeLabel = 'PAYOUT SETTLED';
            } else if (isDisputed) {
              badgeVariant = 'warning';
              badgeLabel = 'DISPUTED';
            } else if (isCancelled) {
              badgeVariant = 'danger';
              badgeLabel = 'CANCELLED';
            } else if (isNoShow) {
              badgeVariant = 'danger';
              badgeLabel = 'NO-SHOW';
            }

            return (
              <Card
                key={booking.id}
                variant="elevated"
                style={{
                  borderRadius: radii.xl,
                  padding: spacing.lg,
                  borderColor: isCheckedIn ? colors.primary : colors.border,
                  borderWidth: isCheckedIn ? 2 : 1,
                }}
              >
                {/* Header: Status & Wage */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <Badge label={badgeLabel} variant={badgeVariant} />
                  <View style={{ alignItems: 'flex-end' }}>
                    <WageText>{formatINR(booking.agreedTotalPay)}</WageText>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                      <ShieldCheck size={12} color={colors.success} strokeWidth={2.5} style={{ marginRight: 3 }} />
                      <Text style={{ fontSize: 11, color: colors.success, fontWeight: '700' }}>
                        Escrow Guaranteed
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Job Title & Host */}
                <Text style={[typography.h3, { color: colors.textPrimary, marginTop: spacing.xs }]} numberOfLines={1}>
                  {job?.title || 'Shift Booking'}
                </Text>
                <Text style={{ fontSize: 13, color: colors.textSecondary }}>
                  {job?.organizer?.businessName || 'Event Host'} • {job?.category?.toUpperCase()}
                </Text>

                {/* Apple Wallet Style Perforated Divider */}
                <View style={[styles.ticketDivider, { borderColor: colors.border }]} />

                {/* Digital Check-In Pass Banner */}
                {!isCompleted && !isCancelled && !isNoShow && (
                  <View
                    style={[
                      styles.passBox,
                      {
                        backgroundColor: isDark ? '#064E3B' : '#ECFDF5',
                        borderColor: isDark ? '#047857' : '#A7F3D0',
                        borderRadius: radii.md,
                      },
                    ]}
                  >
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <View>
                        <Text style={{ fontSize: 10, fontWeight: '800', color: colors.primary, letterSpacing: 1 }}>
                          VENUE CHECK-IN PASS
                        </Text>
                        <Text style={{ fontSize: booking.checkInCode ? 22 : 14, fontWeight: '800', fontFamily: booking.checkInCode ? 'monospace' : undefined, color: booking.checkInCode ? colors.textPrimary : colors.textMuted, letterSpacing: booking.checkInCode ? 2 : 0, marginTop: 2 }}>
                          {booking.checkInCode || 'Pending Credential'}
                        </Text>
                      </View>

                      {booking.checkInCode ? (
                        <Pressable
                          onPress={() => handleCopyCode(booking.id, booking.checkInCode)}
                          style={[
                            styles.copyButton,
                            {
                              backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)',
                              borderColor: isCopied ? colors.success : colors.border,
                            },
                          ]}
                          accessibilityRole="button"
                          accessibilityLabel="Copy check-in pass code"
                        >
                          {isCopied ? (
                            <>
                              <Check size={12} color={colors.success} strokeWidth={2.5} />
                              <Text style={{ fontSize: 11, fontWeight: '700', color: colors.success, marginLeft: 4 }}>
                                COPIED
                              </Text>
                            </>
                          ) : (
                            <>
                              <Copy size={12} color={colors.textSecondary} strokeWidth={2} />
                              <Text style={{ fontSize: 11, fontWeight: '600', color: colors.textSecondary, marginLeft: 4 }}>
                                COPY PASS
                              </Text>
                            </>
                          )}
                        </Pressable>
                      ) : null}
                    </View>

                    <View style={{ marginTop: 6, paddingTop: 6, borderTopWidth: 1, borderTopColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }}>
                      {isCheckedIn ? (
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <CheckCircle2 size={12} color={colors.success} strokeWidth={2.2} style={{ marginRight: 4 }} />
                          <Text style={{ fontSize: 11, color: colors.success, fontWeight: '600' }}>
                            Active on-site • Checked in at {new Date(booking.checkInTime || '').toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </Text>
                        </View>
                      ) : (
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <Clock size={12} color={colors.textSecondary} strokeWidth={2} style={{ marginRight: 4 }} />
                          <Text style={{ fontSize: 11, color: colors.textSecondary }}>
                            {job?.reportingInstructions || 'Report 30 mins prior to shift.'}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                )}

                {/* Logistics Info Block */}
                <View
                  style={{
                    backgroundColor: colors.surfaceMuted,
                    borderRadius: radii.md,
                    padding: spacing.sm + 2,
                    marginTop: spacing.sm,
                    gap: 6,
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                    <MapPin size={14} color={colors.primary} strokeWidth={2.2} style={{ marginRight: 6, marginTop: 1 }} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 13, fontWeight: '700', color: colors.textPrimary }}>
                        {job?.venueName}
                      </Text>
                      <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 1 }}>
                        {job?.venueAddress}
                      </Text>
                    </View>
                  </View>

                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Calendar size={14} color={colors.primary} strokeWidth={2.2} style={{ marginRight: 6 }} />
                    <Text style={{ fontSize: 12, color: colors.textPrimary, fontWeight: '600' }}>
                      {formatISTDate(job?.date || '')} • {formatTimeRange(job?.startTime || '', job?.endTime || '')} ({job?.durationHours}h)
                    </Text>
                  </View>

                  {job?.supervisorName && (
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <User size={14} color={colors.textMuted} strokeWidth={2.2} style={{ marginRight: 6 }} />
                      <Text style={{ fontSize: 12, color: colors.textMuted }}>
                        Supervisor: {job.supervisorName} ({job.supervisorPhone})
                      </Text>
                    </View>
                  )}
                </View>

                {/* Reasons / Disputes callouts */}
                {booking.cancellationReason && (
                  <Text style={{ fontSize: 12, color: colors.danger, marginTop: spacing.sm }}>
                    Cancellation Reason: {booking.cancellationReason}
                  </Text>
                )}
                {booking.disputeReason && (
                  <Text style={{ fontSize: 12, color: colors.warning, marginTop: spacing.sm }}>
                    Dispute Reason: {booking.disputeReason}
                  </Text>
                )}

                {/* Interactive Action Bar */}
                <View
                  style={{
                    flexDirection: 'row',
                    gap: 8,
                    marginTop: spacing.md,
                    paddingTop: spacing.sm,
                    borderTopWidth: 1,
                    borderTopColor: colors.border,
                  }}
                >
                  {/* Active / Checked-in actions */}
                  {!isCheckedIn && !isAwaitingReview && !isCompleted && !isCancelled && !isNoShow && (
                    <>
                      <View style={{ flex: 1.5 }}>
                        <Button
                          title="Enter Check-In Code"
                          variant="primary"
                          size="sm"
                          onPress={() => handleCheckIn(booking)}
                        />
                      </View>
                      <Button
                        title="Cancel Shift"
                        variant="ghost"
                        size="sm"
                        fullWidth={false}
                        onPress={() => setCancelBookingId(booking.id)}
                      />
                    </>
                  )}

                  {isCheckedIn && (
                    <View style={{ flex: 1 }}>
                      <Button
                        title="Check Out of Shift"
                        variant="primary"
                        size="sm"
                        onPress={() => handleCheckOut(booking)}
                      />
                    </View>
                  )}

                  {isAwaitingReview && (
                    <View style={{ flex: 1 }}>
                      <Button
                        title="Awaiting Supervisor Sign-Off"
                        variant="secondary"
                        size="sm"
                        disabled={true}
                        onPress={() => {}}
                      />
                    </View>
                  )}

                  {/* Completed / Disputed actions */}
                  {isCompleted && !isDisputed && (
                    <View style={{ flex: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text style={{ fontSize: 12, color: colors.success, fontWeight: '700' }}>
                        ✓ {formatINR(booking.agreedTotalPay)} Settled via UPI
                      </Text>
                      <Button
                        title="Dispute Record"
                        variant="outline"
                        size="sm"
                        fullWidth={false}
                        onPress={() => setDisputeBookingId(booking.id)}
                      />
                    </View>
                  )}

                  {isNoShow && !isDisputed && (
                    <View style={{ flex: 1 }}>
                      <Button
                        title="Challenge No-Show Dispute"
                        variant="outline"
                        size="sm"
                        onPress={() => setDisputeBookingId(booking.id)}
                      />
                    </View>
                  )}
                </View>
              </Card>
            );
          })
        )}
      </ScrollView>

      {/* Cancellation Modal */}
      <Modal visible={Boolean(cancelBookingId)} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface, borderRadius: radii.lg }]}>
            <Text style={[typography.h3, { color: colors.textPrimary }]}>Cancel Shift Booking</Text>
            <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 4 }}>
              Cancellations release your reserved spot immediately to standby candidates. Please state your reason:
            </Text>

            <View style={{ marginVertical: spacing.md }}>
              <Input
                label="Reason for Cancellation"
                value={cancelReason}
                onChangeText={setCancelReason}
                placeholder="e.g. Medical emergency, transport breakdown"
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
                    setCancelBookingId(null);
                    setCancelReason('');
                  }}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Button
                  title="Confirm Cancel"
                  variant="primary"
                  size="md"
                  loading={submittingModal}
                  onPress={submitCancellation}
                />
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* Dispute Modal */}
      <Modal visible={Boolean(disputeBookingId)} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface, borderRadius: radii.lg }]}>
            <Text style={[typography.h3, { color: colors.textPrimary }]}>Submit Record Dispute</Text>
            <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 4 }}>
              Flag discrepancies in attendance, hours worked, supervisor conduct, or erroneous no-show labels.
            </Text>

            <View style={{ marginVertical: spacing.md }}>
              <Input
                label="Describe the Dispute"
                value={disputeReason}
                onChangeText={setDisputeReason}
                placeholder="Detail actual shift hours worked, supervisor on-site, and evidence"
                multiline
                numberOfLines={4}
              />
            </View>

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Button
                  title="Close"
                  variant="outline"
                  size="md"
                  onPress={() => {
                    setDisputeBookingId(null);
                    setDisputeReason('');
                  }}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Button
                  title="Submit Dispute"
                  variant="primary"
                  size="md"
                  loading={submittingModal}
                  onPress={submitDispute}
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
  header: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  tabChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
  },
  ticketDivider: {
    borderTopWidth: 1.5,
    borderStyle: 'dashed',
    marginVertical: 12,
  },
  passBox: {
    padding: 12,
    borderWidth: 1,
  },
  copyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
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
