import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  RefreshControl,
  StyleSheet,
  Modal,
  Linking,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import * as Location from 'expo-location';
import {
  useOpsklTheme,
  Card,
  Badge,
  Button,
  WageText,
  Input,
  ShiftCardSkeleton,
  useAuth,
  OpsklAlert as Alert,
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
  createSafetyReportSafe,
  reportWorkerDelaySafe,
  fetchShiftMessages,
  sendShiftMessage,
  reportShiftMessage,
  ShiftMessage,
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
  AlertTriangle,
  Navigation,
  QrCode,
  PhoneCall,
  AlertOctagon,
  MessageSquare,
  Timer,
  Flag,
} from 'lucide-react-native';

type TabState = 'upcoming' | 'active' | 'completed' | 'cancelled';

export default function WorkerMyShiftsScreen() {
  const router = useRouter();
  const { session, user } = useAuth();
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

  // 60-Second Dynamic Attendance QR Modal state
  const [qrBooking, setQrBooking] = useState<Booking | null>(null);
  const [qrToken, setQrToken] = useState<string>('');
  const [qrSecondsLeft, setQrSecondsLeft] = useState<number>(60);

  // SOS Emergency Modal state
  const [sosBooking, setSosBooking] = useState<Booking | null>(null);
  const [sosTriggering, setSosTriggering] = useState<boolean>(false);

  // Arrival / Delay Alert Modal state
  const [delayBooking, setDelayBooking] = useState<Booking | null>(null);
  const [delayMinutes, setDelayMinutes] = useState<number>(15);
  const [delayReason, setDelayReason] = useState<string>('');
  const [submittingDelay, setSubmittingDelay] = useState<boolean>(false);

  // Shift-Specific Messaging Modal state
  const [chatBooking, setChatBooking] = useState<Booking | null>(null);
  const [chatMessages, setChatMessages] = useState<ShiftMessage[]>([]);
  const [chatInput, setChatInput] = useState<string>('');
  const [loadingChat, setLoadingChat] = useState<boolean>(false);
  const [sendingChat, setSendingChat] = useState<boolean>(false);

  const [hasInitializedTab, setHasInitializedTab] = useState(false);

  // 60-Second countdown timer effect for QR token
  useEffect(() => {
    if (!qrBooking) return;
    const interval = setInterval(() => {
      setQrSecondsLeft((prev) => {
        if (prev <= 1) return 0;
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [qrBooking, qrToken]);

  const generateAttendanceToken = (booking: Booking) => {
    const expiry = Math.floor(Date.now() / 1000) + 60;
    const token = `OP-ATT:${booking.id}:${booking.checkInCode || 'CHECKIN'}:${expiry}`;
    setQrToken(token);
    setQrSecondsLeft(60);
  };

  const handleOpenQrModal = (booking: Booking) => {
    setQrBooking(booking);
    generateAttendanceToken(booking);
  };

  const handleNavigateToVenue = (job?: any) => {
    if (!job) return;
    const destination = job.latitude && job.longitude
      ? `${job.latitude},${job.longitude}`
      : encodeURIComponent(`${job.venueName || ''}, ${job.venueAddress || ''}, Mumbai`);
    const url = `https://www.google.com/maps/dir/?api=1&destination=${destination}`;
    Linking.openURL(url).catch(() => {
      Alert.alert('Venue Address', `${job.venueName}\n${job.venueAddress}`);
    });
  };

  const handleTriggerSos = async () => {
    if (!sosBooking || !workerId) return;
    setSosTriggering(true);
    try {
      let lat: number | undefined;
      let lng: number | undefined;
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          lat = loc.coords.latitude;
          lng = loc.coords.longitude;
        }
      } catch {
        // Location optional for emergency trigger
      }

      const res = await createSafetyReportSafe({
        reporterId: workerId,
        jobId: sosBooking.jobId,
        category: 'safety',
        severity: 'critical',
        description: `[SOS EMERGENCY TRIGGERED] Worker requested emergency assistance at venue "${sosBooking.job?.venueName || 'shift'}". GPS Fix: ${lat ? `${lat}, ${lng}` : 'Unavailable'}. Supervisor: ${sosBooking.job?.supervisorName} (${sosBooking.job?.supervisorPhone}).`,
      });

      if (res.success) {
        Alert.alert(
          '🚨 Emergency SOS Dispatched',
          'A high-priority safety alert with your location has been logged with the Opskl Safety Queue.\n\nIf you are in immediate personal danger, call National Emergency helpline 112 immediately.',
          [
            {
              text: 'Call Police / Medical (112)',
              style: 'destructive',
              onPress: () => Linking.openURL('tel:112'),
            },
            {
              text: 'Call On-Site Supervisor',
              onPress: () => {
                if (sosBooking.job?.supervisorPhone) {
                  Linking.openURL(`tel:${sosBooking.job.supervisorPhone}`);
                }
              },
            },
            { text: 'Close', style: 'cancel' },
          ]
        );
        setSosBooking(null);
      } else {
        Alert.alert('SOS Trigger Failed', res.error || 'Failed to dispatch alert. Call 112 directly for emergency help.');
      }
    } catch (err: any) {
      Alert.alert('Emergency Contact', 'Call 112 immediately for emergency services.');
    } finally {
      setSosTriggering(false);
    }
  };

  const handleOpenChat = async (booking: Booking) => {
    setChatBooking(booking);
    setLoadingChat(true);
    const msgs = await fetchShiftMessages(booking.jobId);
    setChatMessages(msgs);
    setLoadingChat(false);
  };

  const handleSendChatMessage = async () => {
    if (!chatBooking || !chatInput.trim()) return;
    setSendingChat(true);
    const res = await sendShiftMessage(chatBooking.jobId, chatInput.trim());
    setSendingChat(false);
    if (res.success) {
      setChatInput('');
      const msgs = await fetchShiftMessages(chatBooking.jobId);
      setChatMessages(msgs);
    } else {
      Alert.alert('Message Failed', res.error || 'Could not send message.');
    }
  };

  const handleReportMessage = async (msgId: string) => {
    Alert.alert(
      'Report Inappropriate Message',
      'Would you like to report this message to Opskl Trust & Safety? We uphold strict safety and harassment standards.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Report Message',
          style: 'destructive',
          onPress: async () => {
            const res = await reportShiftMessage(msgId, 'Reported by worker in shift messaging');
            if (res.success) {
              Alert.alert('Report Received', 'Thank you. The reported content has been flagged for administrative review.');
            } else {
              Alert.alert('Error', res.error || 'Failed to submit report.');
            }
          },
        },
      ]
    );
  };

  const handleSubmitDelay = async () => {
    if (!delayBooking) return;
    setSubmittingDelay(true);
    const res = await reportWorkerDelaySafe(
      delayBooking.id,
      delayMinutes,
      delayReason.trim() || undefined
    );
    setSubmittingDelay(false);
    if (res.success) {
      Alert.alert(
        'Arrival Alert Sent',
        res.message || `The event organizer has been informed that you will arrive approximately ${delayMinutes} minutes late.`
      );
      setDelayBooking(null);
      setDelayReason('');
      loadBookings();
    } else {
      Alert.alert('Error', res.error || 'Failed to record delay.');
    }
  };

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

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Location Required for Self Check-In',
          `GPS coordinates are required to verify you are on-site at the shift venue.\n\nAlternatively, show your pass code to your on-site supervisor for manual check-in:\n\nPass Code: ${booking.checkInCode}`,
          [
            { text: 'Close', style: 'cancel' },
            { text: 'Copy Pass Code', onPress: () => handleCopyCode(booking.id, booking.checkInCode) },
          ]
        );
        return;
      }

      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const { latitude, longitude } = loc.coords;

      const res = await checkInWorkerSafe(booking.id, booking.checkInCode, latitude, longitude);
      if (res.success) {
        setBookings((prev) =>
          prev.map((b) =>
            b.id === booking.id
              ? { ...b, status: 'checked_in', checkInTime: new Date().toISOString() }
              : b
          )
        );
        Alert.alert('✓ Check-In Recorded', 'Your on-site arrival has been verified. Shift timer is now active.');
      } else {
        if (res.errorCode === 'VENUE_COORDINATES_MISSING') {
          Alert.alert(
            'Supervisor Verification Required',
            `Venue GPS coordinates are not configured for automated geofencing.\n\nPlease show your pass code to the on-site supervisor (${booking.job?.supervisorName || 'supervisor'}) to confirm arrival:\n\nPass Code: ${booking.checkInCode}`,
            [
              { text: 'Done', style: 'default' },
              { text: 'Copy Pass Code', onPress: () => handleCopyCode(booking.id, booking.checkInCode) },
            ]
          );
        } else if (res.errorCode === 'OUTSIDE_CHECKIN_WINDOW') {
          Alert.alert(
            'Outside Check-In Window',
            res.error || 'Self check-in is permitted between 60 minutes before and 120 minutes after shift call time.'
          );
        } else if (res.errorCode === 'OUT_OF_GEOFENCE_RANGE') {
          Alert.alert(
            'Outside Venue Geofence',
            res.error || 'You are outside the venue check-in area. Please approach the venue entrance before checking in.'
          );
        } else {
          Alert.alert('Check-In Failed', res.error || 'Failed to record check-in.');
        }
      }
    } catch (err: any) {
      Alert.alert(
        'Check-In Error',
        `Could not retrieve GPS coordinates. Please show your pass code to your supervisor on-site:\n\nPass Code: ${booking.checkInCode}`,
        [
          { text: 'Close', style: 'cancel' },
          { text: 'Copy Pass Code', onPress: () => handleCopyCode(booking.id, booking.checkInCode) },
        ]
      );
    }
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
    const res = await cancelBookingSafe(cancelBookingId, cancelReason.trim(), user?.id);
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
      (b.status === 'confirmed' && (b.job?.date || '') === todayStr)
  );
  const completedBookings = bookings.filter((b) => ['completed', 'disputed'].includes(b.status));
  const cancelledBookings = bookings.filter(
    (b) =>
      ['cancelled', 'no_show'].includes(b.status) ||
      (b.status === 'confirmed' && (b.job?.date || '') < todayStr)
  );

  useEffect(() => {
    if (!hasInitializedTab && !loading && bookings.length > 0) {
      if (activeBookings.length === 0 && upcomingBookings.length > 0) {
        setActiveTab('upcoming');
      }
      setHasInitializedTab(true);
    }
  }, [loading, bookings, activeBookings.length, upcomingBookings.length, hasInitializedTab]);

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
        <Text
          style={[
            typography.h2,
            {
              color: colors.textPrimary,
              fontWeight: '700',
              letterSpacing: -0.5,
            },
          ]}
        >
          My Shifts & Attendance
        </Text>
        <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 4, lineHeight: 18 }}>
          Digital check-in passes, active shift timer & payment settlement
        </Text>

        {/* 4 Lifecycle Tabs */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, marginTop: 14, paddingRight: 20 }}
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
        {!workerId ? (
          <View style={{ padding: spacing.xl, alignItems: 'center' }}>
            <View
              style={{
                width: 64,
                height: 64,
                borderRadius: 32,
                backgroundColor: colors.surfaceMuted,
                justifyContent: 'center',
                alignItems: 'center',
                marginBottom: 16,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <Ticket size={28} color={colors.textPrimary} strokeWidth={2} />
            </View>
            <Text style={[typography.h3, { color: colors.textPrimary, textAlign: 'center' }]}>
              Sign In to Access Your Shifts
            </Text>
            <Text style={{ fontSize: 13, color: colors.textSecondary, textAlign: 'center', marginTop: 6, lineHeight: 19, maxWidth: 300 }}>
              Sign in with your verified worker account to access confirmed shifts, digital check-in passes, supervisor sign-off timers, and live attendance tracking.
            </Text>
            <View style={{ marginTop: spacing.lg, width: '100%', maxWidth: 280, gap: spacing.sm }}>
              <Button
                title="Sign In as Worker"
                variant="primary"
                size="md"
                onPress={() => router.push('/auth/login?redirect=/(tabs)/my-shifts' as any)}
              />
              <Button
                title="Browse Open Shifts"
                variant="outline"
                size="md"
                onPress={() => router.push('/(tabs)' as any)}
              />
            </View>
          </View>
        ) : loading ? (
          <View style={{ gap: spacing.md }}>
            <ShiftCardSkeleton />
            <ShiftCardSkeleton />
          </View>
        ) : error ? (
          <View style={{ padding: 40, alignItems: 'center' }}>
            <AlertTriangle size={32} color={colors.danger} strokeWidth={2} />
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
            <View style={{ marginTop: spacing.md, width: '100%', maxWidth: 220 }}>
              <Button
                title="Explore Available Shifts"
                variant="primary"
                size="sm"
                onPress={() => router.push('/(tabs)' as any)}
              />
            </View>
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

            let badgeLabel = 'CONFIRMED';

            if (isCheckedIn) {
              badgeLabel = 'ON-SITE CHECKED IN';
            } else if (isAwaitingReview) {
              badgeLabel = 'AWAITING SIGN-OFF';
            } else if (isCompleted) {
              badgeLabel = 'PAYOUT SETTLED';
            } else if (isDisputed) {
              badgeLabel = 'DISPUTED';
            } else if (isCancelled) {
              badgeLabel = 'CANCELLED';
            } else if (isNoShow) {
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
                  <Badge label={badgeLabel} variant="neutral" />
                  <View style={{ alignItems: 'flex-end' }}>
                    <WageText>{formatINR(booking.agreedTotalPay)}</WageText>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                      <ShieldCheck size={12} color={colors.textPrimary} strokeWidth={2.2} style={{ marginRight: 3 }} />
                      <Text style={{ fontSize: 11, color: colors.textSecondary, fontWeight: '600' }}>
                        Direct Settlement
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
                        backgroundColor: colors.surfaceMuted,
                        borderColor: colors.border,
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

                  {/* Phase H: Google Maps Directions Navigation Button */}
                  <Pressable
                    onPress={() => handleNavigateToVenue(job)}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: colors.surface,
                      borderWidth: 1,
                      borderColor: colors.border,
                      borderRadius: radii.sm,
                      paddingVertical: 7,
                      marginTop: 4,
                      gap: 6,
                    }}
                    accessibilityRole="button"
                    accessibilityLabel="Navigate to venue in Google Maps"
                  >
                    <Navigation size={13} color={colors.primary} strokeWidth={2.2} />
                    <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textPrimary }}>
                      Navigate to Venue (Google Maps) ↗
                    </Text>
                  </Pressable>
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
                    gap: 10,
                    marginTop: spacing.md,
                    paddingTop: spacing.sm,
                    borderTopWidth: 1,
                    borderTopColor: colors.border,
                  }}
                >
                  {/* Active / Checked-in actions */}
                  {!isCheckedIn && !isAwaitingReview && !isCompleted && !isCancelled && !isNoShow && (
                    <>
                      {booking.job?.date && booking.job.date < todayStr ? (
                        <View style={{ flex: 1, paddingVertical: 4 }}>
                          <Text style={{ fontSize: 12, color: colors.textMuted, fontStyle: 'italic' }}>
                            Shift date has concluded. Check-in window closed.
                          </Text>
                        </View>
                      ) : (
                        <View style={{ gap: 8 }}>
                          {/* Row 1: Primary Action & Quick Attendance QR */}
                          <View style={{ flexDirection: 'row', gap: 8 }}>
                            <View style={{ flex: 1 }}>
                              <Button
                                title="Self Check-In (GPS)"
                                variant="primary"
                                size="sm"
                                onPress={() => handleCheckIn(booking)}
                              />
                            </View>
                            <View style={{ flex: 1 }}>
                              <Button
                                title="Attendance QR"
                                variant="outline"
                                size="sm"
                                onPress={() => handleOpenQrModal(booking)}
                              />
                            </View>
                          </View>

                          {/* Row 2: Secondary Support & Status Actions */}
                          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                            <View style={{ flex: 1 }}>
                              <Button
                                title="Report Delay"
                                variant="outline"
                                size="sm"
                                onPress={() => setDelayBooking(booking)}
                              />
                            </View>
                            <View style={{ flex: 1 }}>
                              <Button
                                title="Chat"
                                variant="outline"
                                size="sm"
                                onPress={() => handleOpenChat(booking)}
                              />
                            </View>
                            <Button
                              title="Cancel"
                              variant="ghost"
                              size="sm"
                              fullWidth={false}
                              onPress={() => setCancelBookingId(booking.id)}
                            />
                          </View>
                        </View>
                      )}
                    </>
                  )}

                  {isCheckedIn && (
                    <View style={{ flex: 1, flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                      <View style={{ flex: 1 }}>
                        <Button
                          title="Check Out of Shift"
                          variant="primary"
                          size="sm"
                          onPress={() => handleCheckOut(booking)}
                        />
                      </View>
                      <Button
                        title="Chat"
                        variant="outline"
                        size="sm"
                        fullWidth={false}
                        onPress={() => handleOpenChat(booking)}
                      />
                      <Pressable
                        onPress={() => setSosBooking(booking)}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          paddingVertical: 7,
                          paddingHorizontal: 10,
                          borderRadius: radii.sm,
                          borderWidth: 1,
                          borderColor: colors.border,
                          backgroundColor: colors.surfaceMuted,
                          gap: 4,
                        }}
                        accessibilityRole="button"
                        accessibilityLabel="Trigger Emergency SOS"
                      >
                        <AlertOctagon size={13} color={colors.primary} strokeWidth={2.2} />
                        <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textPrimary }}>
                          SOS
                        </Text>
                      </Pressable>
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

      {/* Phase G: 60-Second Dynamic Attendance QR Modal */}
      <Modal visible={Boolean(qrBooking)} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface, borderRadius: radii.xl, maxWidth: 360, width: '100%', alignItems: 'center' }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', width: '100%', alignItems: 'center', marginBottom: spacing.sm }}>
              <Badge label="SINGLE-USE 60S PASS" variant="primary" size="sm" />
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Clock size={13} color={qrSecondsLeft <= 10 ? colors.danger : colors.textPrimary} />
                <Text style={{ fontSize: 13, fontWeight: '800', fontFamily: 'monospace', color: qrSecondsLeft <= 10 ? colors.danger : colors.textPrimary }}>
                  00:{String(qrSecondsLeft).padStart(2, '0')}
                </Text>
              </View>
            </View>

            <Text style={[typography.h3, { color: colors.textPrimary, textAlign: 'center' }]}>
              Check-In Attendance QR
            </Text>
            <Text style={{ fontSize: 12, color: colors.textSecondary, textAlign: 'center', marginTop: 2, marginBottom: spacing.md }}>
              Present this code to the on-site organizer check-in desk.
            </Text>

            {/* High-Contrast Monochrome QR Simulation / Payload Block */}
            <View
              style={{
                width: 220,
                height: 220,
                backgroundColor: '#000000',
                borderRadius: radii.md,
                padding: 12,
                justifyContent: 'center',
                alignItems: 'center',
                borderWidth: 2,
                borderColor: colors.border,
              }}
            >
              <View style={{ backgroundColor: '#FFFFFF', padding: 12, borderRadius: 8, width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' }}>
                <QrCode size={110} color="#000000" strokeWidth={2.5} />
                <Text style={{ fontSize: 9, fontFamily: 'monospace', color: '#000000', marginTop: 8, textAlign: 'center', fontWeight: '700' }} numberOfLines={1}>
                  {qrToken.substring(0, 24)}…
                </Text>
              </View>
            </View>

            {qrSecondsLeft === 0 ? (
              <View style={{ marginTop: spacing.md, width: '100%', alignItems: 'center' }}>
                <Text style={{ fontSize: 12, color: colors.danger, fontWeight: '700', marginBottom: 8 }}>
                  ⚠️ QR Token Expired (60s limit reached)
                </Text>
                <Button
                  title="Generate Fresh Token"
                  variant="primary"
                  size="md"
                  onPress={() => qrBooking && generateAttendanceToken(qrBooking)}
                />
              </View>
            ) : (
              <View style={{ marginTop: spacing.md, width: '100%', gap: 8 }}>
                <Button
                  title="Copy Token String"
                  variant="outline"
                  size="sm"
                  onPress={() => qrBooking && handleCopyCode(qrBooking.id, qrToken)}
                />
                <Button
                  title="Close Pass"
                  variant="ghost"
                  size="sm"
                  onPress={() => setQrBooking(null)}
                />
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* Phase J: Worker Emergency SOS Confirmation Modal */}
      <Modal visible={Boolean(sosBooking)} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface, borderRadius: radii.xl, maxWidth: 360, width: '100%' }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <AlertOctagon size={20} color={colors.primary} strokeWidth={2.5} />
              <Text style={[typography.h3, { color: colors.textPrimary }]}>
                Worker Emergency SOS
              </Text>
            </View>
            <Text style={{ fontSize: 13, color: colors.textSecondary, lineHeight: 18, marginBottom: spacing.md }}>
              Triggering this alert sends an urgent safety incident report with your current GPS location to the Opskl Trust & Safety Operations team and logs an emergency notification.
            </Text>

            <View style={{ backgroundColor: colors.surfaceMuted, padding: spacing.sm, borderRadius: radii.md, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.border }}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textPrimary }}>
                CRITICAL LIFE SAFETY EMERGENCIES:
              </Text>
              <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>
                For immediate police, medical, or fire danger in India, dial 112 directly.
              </Text>
              <Pressable
                onPress={() => Linking.openURL('tel:112')}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 }}
              >
                <PhoneCall size={14} color={colors.primary} />
                <Text style={{ fontSize: 13, fontWeight: '700', color: colors.primary }}>
                  Call Emergency Services (112) ↗
                </Text>
              </Pressable>
            </View>

            <View style={{ gap: spacing.sm }}>
              <Button
                title="Trigger Safety Alert to Opskl"
                variant="primary"
                size="md"
                loading={sosTriggering}
                onPress={handleTriggerSos}
              />
              <Button
                title="Cancel / False Alarm"
                variant="outline"
                size="md"
                onPress={() => setSosBooking(null)}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* Arrival & Late-Alert System Modal */}
      <Modal visible={Boolean(delayBooking)} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface, borderRadius: radii.xl, maxWidth: 380, width: '100%' }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <Timer size={18} color={colors.primary} strokeWidth={2.2} />
              <Text style={[typography.h3, { color: colors.textPrimary }]}>
                Report Late Arrival
              </Text>
            </View>
            <Text style={{ fontSize: 12, color: colors.textSecondary, marginBottom: spacing.md, lineHeight: 17 }}>
              Notify the event host of your expected delay. Your live continuous location is never tracked or shared.
            </Text>

            <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textPrimary, marginBottom: 8 }}>
              Estimated Transit Delay:
            </Text>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: spacing.md }}>
              {[15, 30, 45, 60].map((mins) => (
                <Pressable
                  key={mins}
                  onPress={() => setDelayMinutes(mins)}
                  style={{
                    flex: 1,
                    paddingVertical: 8,
                    borderRadius: radii.sm,
                    borderWidth: 1,
                    borderColor: delayMinutes === mins ? colors.primary : colors.border,
                    backgroundColor: delayMinutes === mins ? colors.primary : colors.surfaceMuted,
                    alignItems: 'center',
                  }}
                >
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: '700',
                      color: delayMinutes === mins ? '#FFFFFF' : colors.textPrimary,
                    }}
                  >
                    +{mins}m
                  </Text>
                </Pressable>
              ))}
            </View>

            <Input
              label="Reason (Optional)"
              value={delayReason}
              onChangeText={setDelayReason}
              placeholder="e.g. Western line train delay, traffic jam..."
            />

            <View style={{ gap: spacing.sm, marginTop: spacing.md }}>
              <Button
                title={`Send +${delayMinutes}m Late Alert`}
                variant="primary"
                size="md"
                loading={submittingDelay}
                onPress={handleSubmitDelay}
              />
              <Button
                title="Cancel"
                variant="outline"
                size="md"
                onPress={() => setDelayBooking(null)}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* Shift-Specific Messaging Modal */}
      <Modal visible={Boolean(chatBooking)} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View
            style={[
              styles.modalContent,
              {
                backgroundColor: colors.surface,
                borderRadius: radii.xl,
                maxWidth: 420,
                width: '100%',
                maxHeight: '85%',
                display: 'flex',
              },
            ]}
          >
            {/* Chat Header */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.sm }}>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <MessageSquare size={16} color={colors.primary} />
                  <Text style={[typography.h3, { color: colors.textPrimary }]}>
                    Shift Team Chat
                  </Text>
                </View>
                <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 2 }} numberOfLines={1}>
                  {chatBooking?.job?.title || 'Shift Coordination'}
                </Text>
              </View>
              <Badge label="PRIVATE & ENCRYPTED" variant="neutral" size="sm" />
            </View>

            <Text style={{ fontSize: 11, color: colors.textMuted, marginBottom: spacing.sm, lineHeight: 15 }}>
              Host reporting guidelines & uniform updates. Phone numbers remain confidential.
            </Text>

            {/* Messages Scroll Area */}
            <ScrollView
              style={{
                flexGrow: 1,
                minHeight: 180,
                maxHeight: 300,
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
                  <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 6 }}>
                    Loading shift channel…
                  </Text>
                </View>
              ) : chatMessages.length === 0 ? (
                <View style={{ padding: 20, alignItems: 'center' }}>
                  <Text style={{ fontSize: 12, color: colors.textSecondary, textAlign: 'center' }}>
                    No messages yet in this shift channel. Use this channel to coordinate arrival gate, dress code, or shift updates.
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
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textPrimary }}>
                          {msg.senderName}
                        </Text>
                        <Badge
                          label={msg.senderRole === 'organizer' ? 'HOST' : 'CREW'}
                          variant="neutral"
                          size="sm"
                        />
                        {msg.isBroadcast && (
                          <Badge label="BROADCAST" variant="primary" size="sm" />
                        )}
                      </View>
                      <Pressable
                        onPress={() => handleReportMessage(msg.id)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Flag size={11} color={colors.textMuted} />
                      </Pressable>
                    </View>
                    <Text style={{ fontSize: 13, color: colors.textPrimary, lineHeight: 18 }}>
                      {msg.content}
                    </Text>
                    <Text style={{ fontSize: 10, color: colors.textMuted, marginTop: 4, alignSelf: 'flex-end' }}>
                      {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </View>
                ))
              )}
            </ScrollView>

            {/* Input Bar */}
            <View style={{ flexDirection: 'row', gap: 8, marginTop: spacing.sm, alignItems: 'center' }}>
              <View style={{ flex: 1 }}>
                <Input
                  value={chatInput}
                  onChangeText={setChatInput}
                  placeholder="Type reporting question or update..."
                />
              </View>
              <Button
                title="Send"
                variant="primary"
                size="md"
                fullWidth={false}
                loading={sendingChat}
                onPress={handleSendChatMessage}
              />
            </View>

            <View style={{ marginTop: spacing.sm }}>
              <Button
                title="Close Chat"
                variant="outline"
                size="sm"
                onPress={() => setChatBooking(null)}
              />
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  tabChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
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
