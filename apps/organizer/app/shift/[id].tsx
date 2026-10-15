import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
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
  OpsklAlert as Alert,
} from '@opskil/design-system';
import {
  Booking,
  Job,
  JobApplication,
  formatINR,
  formatISTDate,
  formatTimeRange,
  fetchJobById,
  fetchJobBookings,
  fetchOrganizerApplications,
  confirmWorkerBookingSafe,
  checkInWorkerSafe,
  checkOutWorkerSafe,
  completeShiftAndApproveAttendance,
  recordNoShowSafe,
  cancelBookingSafe,
  generateJobInvoiceSafe,
  fetchShiftMessages,
  sendShiftMessage,
  ShiftMessage,
  subscribeToShiftApplications,
  subscribeToShiftRoster,
} from '@opskil/shared';
import { Star, CheckCircle2, Users, Clock, UserCheck, Radio } from 'lucide-react-native';

export default function OrganizerShiftDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session, user } = useAuth();
  const { colors, spacing, radii, typography } = useOpsklTheme();

  const [job, setJob] = useState<Job | null>(null);
  const [crew, setCrew] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Standby & Chat states
  const [standbyApplications, setStandbyApplications] = useState<JobApplication[]>([]);
  const [showChatModal, setShowChatModal] = useState(false);
  const [chatMessages, setChatMessages] = useState<ShiftMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [loadingChat, setLoadingChat] = useState(false);
  const [sendingChat, setSendingChat] = useState(false);
  const [confirmingReplacementId, setConfirmingReplacementId] = useState<string | null>(null);

  // Modal actions
  const [checkInBooking, setCheckInBooking] = useState<Booking | null>(null);
  const [manualCode, setManualCode] = useState('');
  const [checkInError, setCheckInError] = useState<string | null>(null);
  const [noShowBooking, setNoShowBooking] = useState<Booking | null>(null);
  const [noShowReason, setNoShowReason] = useState('');
  const [cancelBooking, setCancelBooking] = useState<Booking | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [actionBusy, setActionBusy] = useState(false);
  const [generatingInvoice, setGeneratingInvoice] = useState(false);

  const handleGenerateInvoice = async () => {
    if (!session?.user?.id || !id) {
      Alert.alert('Sign In Required', 'Please sign in with your organizer account to generate shift invoices.');
      return;
    }
    setGeneratingInvoice(true);
    try {
      const res = await generateJobInvoiceSafe(id, session.user.id);
      if (res.success) {
        Alert.alert(
          'Invoice Generated',
          `Invoice #${res.invoiceNumber || ''} generated.\nTotal Payable: ${formatINR(res.totalPayable || 0)}\n\nYou can review this statement under Finances.`,
          [
            { text: 'View in Finances', onPress: () => router.push('/(tabs)/finances' as any) },
            { text: 'OK', style: 'cancel' }
          ]
        );
      } else {
        Alert.alert('Invoice Generation Failed', res.error || 'Could not generate invoice.');
      }
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Unexpected invoice generation error.');
    } finally {
      setGeneratingInvoice(false);
    }
  };

  const loadShiftData = useCallback(async () => {
    if (!id) {
      setError('Invalid shift identifier.');
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const [jobData, crewData, appsData] = await Promise.all([
        fetchJobById(id),
        fetchJobBookings(id),
        session?.user?.id ? fetchOrganizerApplications(session.user.id, id) : Promise.resolve([]),
      ]);

      if (jobData) {
        setJob(jobData);
      } else {
        setError('Shift not found or access denied.');
      }
      setCrew(crewData || []);

      const shiftStandby = (appsData || []).filter(
        (a: any) => a.jobId === id && ['applied', 'shortlisted'].includes(a.status)
      );
      setStandbyApplications(shiftStandby);
    } catch (err: any) {
      console.error('Failed to load shift details', err);
      setError(err?.message || 'Failed to load shift details.');
      setCrew([]);
      setStandbyApplications([]);
    } finally {
      setLoading(false);
    }
  }, [id, session?.user?.id]);

  const handleConfirmReplacement = async (workerId: string, workerName: string) => {
    if (!session?.user?.id || !id) {
      Alert.alert('Sign In Required', 'Please sign in with your organizer account to confirm candidate bookings.');
      return;
    }
    Alert.alert(
      'Confirm Standby Replacement',
      `Confirm ${workerName} for this shift? This will reserve their spot and provision an on-site attendance pass.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm Worker',
          onPress: async () => {
            setConfirmingReplacementId(workerId);
            const res = await confirmWorkerBookingSafe(id, workerId, session.user.id);
            setConfirmingReplacementId(null);
            if (res.success) {
              Alert.alert('Worker Confirmed', `${workerName} has been booked and notified.`);
              loadShiftData();
            } else {
              Alert.alert('Booking Error', res.error || 'Failed to confirm standby replacement. Please ensure the candidate has an active application and you are authorized for this shift.');
            }
          },
        },
      ]
    );
  };

  const handleOpenTeamChat = async () => {
    if (!id) return;
    setShowChatModal(true);
    setLoadingChat(true);
    const msgs = await fetchShiftMessages(id);
    setChatMessages(msgs);
    setLoadingChat(false);
  };

  const handleSendTeamBroadcast = async () => {
    if (!id || !chatInput.trim()) return;
    setSendingChat(true);
    const res = await sendShiftMessage(id, chatInput.trim(), undefined, true);
    setSendingChat(false);
    if (res.success) {
      setChatInput('');
      const msgs = await fetchShiftMessages(id);
      setChatMessages(msgs);
    } else {
      Alert.alert('Broadcast Error', res.error || 'Could not send broadcast message.');
    }
  };

  useEffect(() => {
    loadShiftData();

    if (!id) return;

    const unsubApps = subscribeToShiftApplications(id, () => {
      loadShiftData();
    });

    const unsubRoster = subscribeToShiftRoster(id, () => {
      loadShiftData();
    });

    return () => {
      unsubApps();
      unsubRoster();
    };
  }, [loadShiftData, id]);

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
    let finalCode = codeToVerify;
    if (codeToVerify.startsWith('OP-ATT:')) {
      const parts = codeToVerify.split(':');
      if (parts.length >= 4) {
        const tokenBookingId = parts[1];
        const tokenCode = parts[2];
        const expirySec = parseInt(parts[3], 10);
        if (tokenBookingId !== checkInBooking.id) {
          setCheckInError('This attendance QR pass belongs to a different worker or booking.');
          return;
        }
        if (Date.now() / 1000 > expirySec) {
          setCheckInError('This attendance QR pass has expired (>60s). Please ask worker to refresh their token.');
          return;
        }
        finalCode = tokenCode;
      }
    }

    setActionBusy(true);
    setCheckInError(null);
    const res = await checkInWorkerSafe(checkInBooking.id, finalCode);
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
    const res = await cancelBookingSafe(cancelBooking.id, cancelReason.trim(), session?.user?.id || user?.id);
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

  const activeCrew = crew.filter((c) => !['cancelled', 'no_show'].includes(c.status));
  const checkedInCount = activeCrew.filter((c) => ['checked_in', 'completed_awaiting_review', 'completed'].includes(c.status)).length;
  const totalEscrow = activeCrew.reduce((acc, c) => acc + c.agreedTotalPay, 0);

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
                {checkedInCount} / {activeCrew.length} Checked In
              </Text>
            </View>
            <Badge
              label={activeCrew.length > 0 && checkedInCount === activeCrew.length ? 'ALL PRESENT' : `${activeCrew.length - checkedInCount} PENDING`}
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

          {session?.user?.id && (
            <View style={{ marginTop: spacing.md, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border }}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <View style={{ flex: 1.2 }}>
                  <Button
                    title="Shift Team Broadcast"
                    variant="primary"
                    size="sm"
                    onPress={handleOpenTeamChat}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Button
                    title={generatingInvoice ? 'Generating...' : 'GST Invoice'}
                    variant="outline"
                    size="sm"
                    disabled={generatingInvoice}
                    onPress={handleGenerateInvoice}
                  />
                </View>
              </View>
            </View>
          )}
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
                    {member.notes && member.notes.includes('[DELAY ALERT]') ? (
                      <View
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 4,
                          backgroundColor: colors.surfaceMuted,
                          padding: 6,
                          borderRadius: radii.sm,
                          marginTop: 6,
                          borderWidth: 1,
                          borderColor: colors.warning,
                        }}
                      >
                        <Clock size={12} color={colors.warning} />
                        <Text style={{ fontSize: 11, fontWeight: '700', color: colors.warning, flex: 1 }}>
                          {member.notes}
                        </Text>
                      </View>
                    ) : null}
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

        {/* Standby & Replacement Pool */}
        <View style={{ marginTop: spacing.md }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <UserCheck size={16} color={colors.primary} />
              <Text style={[typography.h3, { color: colors.textPrimary }]}>
                Standby & Replacement List
              </Text>
            </View>
            <Badge
              label={`${standbyApplications.length} STANDBY`}
              variant="neutral"
              size="sm"
            />
          </View>

          {standbyApplications.length === 0 ? (
            <Card variant="outlined" style={{ padding: spacing.md, backgroundColor: colors.surfaceMuted }}>
              <Text style={{ fontSize: 12, color: colors.textSecondary }}>
                No waitlisted or standby applicants currently in queue for this shift. If a confirmed worker cancels or fails to arrive, eligible workers from the Mumbai talent pool will appear here for 1-tap vacancy fill.
              </Text>
            </Card>
          ) : (
            standbyApplications.map((app) => (
              <Card
                key={app.id}
                variant="outlined"
                style={{
                  marginBottom: 8,
                  borderColor: colors.border,
                  width: '100%',
                }}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                  <View style={{ flex: 1, minWidth: 200 }}>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: colors.textPrimary }}>
                      {app.worker?.profile?.fullName || 'Standby Candidate'}
                    </Text>
                    <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 2, lineHeight: 16 }}>
                      Locality: {app.worker?.preferredLocality || 'Mumbai'} • Skills: {app.worker?.skills?.slice(0, 2).join(', ') || 'General'}
                    </Text>
                  </View>
                  <View style={{ flexShrink: 0 }}>
                    <Button
                      title="Confirm Replacement"
                      variant="primary"
                      size="sm"
                      fullWidth={false}
                      loading={confirmingReplacementId === app.workerId}
                      onPress={() => handleConfirmReplacement(app.workerId, app.worker?.profile?.fullName || 'Worker')}
                    />
                  </View>
                </View>
              </Card>
            ))
          )}
        </View>
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

      {/* Shift Broadcast & Team Chat Modal */}
      <Modal visible={showChatModal} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View
            style={[
              styles.modalContent,
              {
                backgroundColor: colors.surface,
                borderRadius: radii.xl,
                maxWidth: 440,
                width: '100%',
                maxHeight: '85%',
              },
            ]}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xs }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Radio size={16} color={colors.primary} />
                <Text style={[typography.h3, { color: colors.textPrimary }]}>
                  Shift Team Broadcast
                </Text>
              </View>
              <Badge label="ORGANIZER DESK" variant="neutral" size="sm" />
            </View>

            <Text style={{ fontSize: 11, color: colors.textMuted, marginBottom: spacing.sm }}>
              Broadcast venue entry instructions, gate number, or dress code updates to all confirmed crew.
            </Text>

            <ScrollView
              style={{
                minHeight: 180,
                maxHeight: 280,
                backgroundColor: colors.surfaceMuted,
                borderRadius: radii.md,
                padding: spacing.sm,
                borderWidth: 1,
                borderColor: colors.border,
              }}
              contentContainerStyle={{ gap: 8 }}
            >
              {loadingChat ? (
                <View style={{ padding: 20, alignItems: 'center' }}>
                  <ActivityIndicator size="small" color={colors.primary} />
                </View>
              ) : chatMessages.length === 0 ? (
                <View style={{ padding: 20, alignItems: 'center' }}>
                  <Text style={{ fontSize: 12, color: colors.textSecondary, textAlign: 'center' }}>
                    No announcements posted yet. Broadcast messages are highlighted directly for all checked-in and confirmed workers.
                  </Text>
                </View>
              ) : (
                chatMessages.map((msg) => (
                  <View
                    key={msg.id}
                    style={{
                      padding: spacing.sm,
                      borderRadius: radii.sm,
                      backgroundColor: colors.surface,
                      borderWidth: 1,
                      borderColor: msg.isBroadcast ? colors.primary : colors.border,
                    }}
                  >
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                      <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textPrimary }}>
                        {msg.senderName} {msg.senderRole === 'organizer' ? '(Host)' : ''}
                      </Text>
                      {msg.isBroadcast && (
                        <Badge label="BROADCAST" variant="primary" size="sm" />
                      )}
                    </View>
                    <Text style={{ fontSize: 13, color: colors.textPrimary }}>
                      {msg.content}
                    </Text>
                  </View>
                ))
              )}
            </ScrollView>

            <View style={{ flexDirection: 'row', gap: 8, marginTop: spacing.sm, alignItems: 'center' }}>
              <View style={{ flex: 1 }}>
                <Input
                  value={chatInput}
                  onChangeText={setChatInput}
                  placeholder="Post broadcast announcement to crew..."
                />
              </View>
              <Button
                title="Broadcast"
                variant="primary"
                size="md"
                fullWidth={false}
                loading={sendingChat}
                onPress={handleSendTeamBroadcast}
              />
            </View>

            <View style={{ marginTop: spacing.sm }}>
              <Button
                title="Close Channel"
                variant="outline"
                size="sm"
                onPress={() => setShowChatModal(false)}
              />
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
