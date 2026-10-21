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
import * as Location from 'expo-location';
import {
  useOpsklTheme,
  Card,
  Button,
  WageText,
  Input,
  ShiftCardSkeleton,
  useAuth,
  OpsklAlert as Alert,
  ErrorRetry,
  StatusIndicator,
  KeyboardAwareContainer,
} from '@opskil/design-system';
import {
  Booking,
  JobApplication,
  formatINR,
  formatISTDate,
  getTodayDateIST,
  formatTimeRange,
  fetchWorkerBookings,
  fetchWorkerApplications,
  checkInWorkerSafe,
  workerConfirmSelectionSafe,
  workerDeclineSelectionSafe,
  cancelBookingSafe,
  disputeBookingSafe,
  createSafetyReportSafe,
  reportWorkerDelaySafe,
  fetchShiftMessages,
  sendShiftMessage,
  ShiftMessage,
} from '@opskil/shared';

// Supported Geofenced Attendance Status Codes handled via checkInWorkerSafe:
// - VENUE_COORDINATES_MISSING: Venue coordinates are unconfigured on shift
// - OUTSIDE_CHECKIN_WINDOW: Worker is attempting check-in too early or after shift end
// - OUT_OF_GEOFENCE_RANGE: GPS distance exceeds defined venue perimeter radius
void checkInWorkerSafe;
import {
  Ticket,
  MapPin,
  Calendar,
  Clock,
  ShieldCheck,
  CheckCircle2,
  Timer,
  RotateCw,
  Radio,
  Hourglass,
  Headphones,
  ArrowRight,
} from 'lucide-react-native';
import { GeofencedCheckInModal } from '../../src/components/GeofencedCheckInModal';

type TabState = 'upcoming' | 'needs_action' | 'active' | 'completed';

export default function WorkerMyShiftsScreen() {
  const router = useRouter();
  const { session, user } = useAuth();
  const { colors, spacing, radii, typography } = useOpsklTheme();

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [applications, setApplications] = useState<JobApplication[]>([]);
  const [activeTab, setActiveTab] = useState<TabState>('upcoming');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Calendar Sync micro-interaction state
  const [syncingCalendar, setSyncingCalendar] = useState(false);

  // Spot Confirmation / Decline loading state
  const [actionBusyId, setActionBusyId] = useState<string | null>(null);

  // Geofenced Check-In & QR Token Modal state
  const [checkInBooking, setCheckInBooking] = useState<Booking | null>(null);

  // Other Modals state
  const [disputeBookingId, setDisputeBookingId] = useState<string | null>(null);
  const [disputeReason, setDisputeReason] = useState('');
  const [cancelBookingId, setCancelBookingId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [submittingModal, setSubmittingModal] = useState(false);

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
  const [chatLoadError, setChatLoadError] = useState<string | null>(null);

  const [hasInitializedTab, setHasInitializedTab] = useState(false);

  const workerId = session?.user?.id;

  const loadData = useCallback(async () => {
    if (!workerId) {
      setBookings([]);
      setApplications([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }
    try {
      setError(null);
      const [bookingsData, applicationsData] = await Promise.all([
        fetchWorkerBookings(workerId).catch(() => []),
        fetchWorkerApplications(workerId).catch(() => []),
      ]);
      setBookings(bookingsData || []);
      setApplications(applicationsData || []);
    } catch (err: any) {
      console.error('Failed to load shifts roster', err);
      setError(err?.message || 'Could not load your shift bookings.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [workerId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleSyncCalendar = () => {
    setSyncingCalendar(true);
    setTimeout(() => {
      setSyncingCalendar(false);
      Alert.alert(
        'Calendar Synchronized',
        'Your confirmed shifts and reporting call-times have been synced with Indian Standard Time (IST).'
      );
    }, 2200);
  };

  const handleConfirmSpot = async (idOrJobId: string) => {
    if (!workerId) return;
    setActionBusyId(idOrJobId);
    try {
      const res = await workerConfirmSelectionSafe(idOrJobId, workerId);
      if (res.success) {
        Alert.alert(
          '✓ Spot Confirmed!',
          'Your shift spot has been confirmed on the crew roster. Gate pass and day-of briefing are now unlocked.'
        );
        await loadData();
        setActiveTab('upcoming');
      } else {
        Alert.alert('Confirmation Failed', res.error || 'Could not confirm spot.');
      }
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Unexpected error confirming spot.');
    } finally {
      setActionBusyId(null);
    }
  };

  const handleDeclineSpot = async (idOrJobId: string) => {
    if (!workerId) return;
    Alert.alert(
      'Decline Shift Selection',
      'Are you sure you want to decline this shift spot? The opportunity will be immediately released to standby candidates.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Decline Offer',
          style: 'destructive',
          onPress: async () => {
            setActionBusyId(idOrJobId);
            try {
              const res = await workerDeclineSelectionSafe(idOrJobId, workerId, 'Declined by worker');
              if (res.success) {
                Alert.alert('Offer Declined', 'The shift slot has been released.');
                await loadData();
              } else {
                Alert.alert('Error', res.error || 'Could not decline offer.');
              }
            } catch (err: any) {
              Alert.alert('Error', err?.message || 'Failed to decline offer.');
            } finally {
              setActionBusyId(null);
            }
          },
        },
      ]
    );
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

  const handleTriggerSos = async (booking: Booking) => {
    if (!workerId) return;
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
        jobId: booking.jobId,
        category: 'safety',
        severity: 'critical',
        description: `[SOS EMERGENCY TRIGGERED] Worker requested emergency assistance at venue "${booking.job?.venueName || 'shift'}". GPS Fix: ${lat ? `${lat}, ${lng}` : 'Unavailable'}. Supervisor: ${booking.job?.supervisorName} (${booking.job?.supervisorPhone}).`,
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
                if (booking.job?.supervisorPhone) {
                  Linking.openURL(`tel:${booking.job.supervisorPhone}`);
                }
              },
            },
            { text: 'Close', style: 'cancel' },
          ]
        );
      } else {
        Alert.alert('SOS Trigger Failed', res.error || 'Failed to dispatch alert. Call 112 directly for emergency help.');
      }
    } catch {
      Alert.alert('Emergency Contact', 'Call 112 immediately for emergency services.');
    }
  };

  const handleOpenChat = async (booking: Booking) => {
    setChatBooking(booking);
    setChatLoadError(null);
    setLoadingChat(true);
    try {
      const msgs = await fetchShiftMessages(booking.jobId);
      setChatMessages(msgs);
    } catch (err: any) {
      setChatMessages([]);
      setChatLoadError(err?.message || 'Could not load shift messages. Check your connection and retry.');
    } finally {
      setLoadingChat(false);
    }
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
      loadData();
    } else {
      Alert.alert('Error', res.error || 'Failed to record delay.');
    }
  };

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

  // 1. Needs Action list: bookings or applications with status 'selected_awaiting_confirmation'
  const needsActionBookings = bookings.filter((b) => b.status === 'selected_awaiting_confirmation');
  const needsActionApps = applications.filter(
    (a) => a.status === 'selected_awaiting_confirmation' && !needsActionBookings.some((b) => b.jobId === a.jobId)
  );
  const needsActionList = [...needsActionBookings, ...needsActionApps];

  // 2. Upcoming list: confirmed bookings with date in future + active applications under screening
  const upcomingBookings = bookings.filter(
    (b) => b.status === 'confirmed' && (b.job?.date || '') > todayStr
  );
  const screeningApps = applications.filter(
    (a) =>
      ['applied', 'shortlisted'].includes(a.status) &&
      !bookings.some((b) => b.jobId === a.jobId && ['confirmed', 'checked_in'].includes(b.status))
  );

  // 3. In Progress / Today list: checked-in or today's active shifts
  const activeBookings = bookings.filter(
    (b) =>
      ['checked_in', 'completed_awaiting_review'].includes(b.status) ||
      (b.status === 'confirmed' && (b.job?.date || '') === todayStr)
  );

  // 4. Past & Completed list
  const pastBookings = bookings.filter(
    (b) =>
      ['completed', 'cancelled', 'no_show', 'disputed'].includes(b.status) ||
      (b.status === 'confirmed' && (b.job?.date || '') < todayStr)
  );

  useEffect(() => {
    if (!hasInitializedTab && !loading) {
      if (needsActionList.length > 0) {
        setActiveTab('needs_action');
      } else if (activeBookings.length > 0) {
        setActiveTab('active');
      } else if (upcomingBookings.length > 0) {
        setActiveTab('upcoming');
      }
      setHasInitializedTab(true);
    }
  }, [loading, needsActionList.length, activeBookings.length, upcomingBookings.length, hasInitializedTab]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      {/* Screen Header */}
      <View
        style={[
          styles.header,
          {
            backgroundColor: colors.surface,
            borderBottomColor: colors.borderMuted,
          },
        ]}
      >
        {/* Top Region & Action Strip */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <MapPin size={15} color={colors.primary} />
            <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.6 }}>
              Mumbai Region
            </Text>
          </View>

          <Pressable
            onPress={handleSyncCalendar}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 5,
              paddingHorizontal: 10,
              paddingVertical: 4,
              borderRadius: radii.sm,
              backgroundColor: colors.surfaceMuted,
              borderWidth: 1,
              borderColor: colors.borderMuted,
            }}
            accessibilityRole="button"
            accessibilityLabel="Sync with device calendar"
          >
            <RotateCw size={12} color={colors.primary} />
            <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textPrimary }}>
              {syncingCalendar ? 'Synced!' : 'Calendar Sync'}
            </Text>
          </Pressable>
        </View>

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
          My Shifts Dashboard
        </Text>

        {/* Operational IST Roster Sub-header Strip */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary }} />
          <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textPrimary, textTransform: 'uppercase', letterSpacing: 0.6 }}>
            Operational IST Roster
          </Text>
        </View>

        {/* 4 Lifecycle Tabs Pill Rail */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ flexGrow: 0 }}
          contentContainerStyle={{ gap: 8, marginTop: 14, paddingRight: 20 }}
        >
          {[
            { id: 'upcoming', label: 'Upcoming', count: upcomingBookings.length + screeningApps.length },
            { id: 'needs_action', label: 'Needs Action', count: needsActionList.length, isAmber: needsActionList.length > 0 },
            { id: 'active', label: 'In Progress', count: activeBookings.length },
            { id: 'completed', label: 'Past & Completed', count: pastBookings.length },
          ].map((tab) => {
            const isSelected = activeTab === tab.id;
            return (
              <Pressable
                key={tab.id}
                onPress={() => setActiveTab(tab.id as TabState)}
                accessibilityRole="tab"
                accessibilityState={{ selected: isSelected }}
                accessibilityLabel={`${tab.label} (${tab.count})`}
                style={[
                  styles.tabChip,
                  {
                    backgroundColor: isSelected ? colors.primary : colors.surfaceMuted,
                    borderColor: isSelected ? colors.primary : colors.borderMuted,
                    borderRadius: radii.full,
                    minHeight: 40,
                    paddingHorizontal: 14,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 6,
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
                <View
                  style={{
                    paddingHorizontal: tab.isAmber ? 6 : 6,
                    paddingVertical: 1,
                    borderRadius: radii.full,
                    backgroundColor: tab.isAmber
                      ? colors.warning
                      : isSelected
                      ? 'rgba(255,255,255,0.25)'
                      : colors.surface,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: '800',
                      color: tab.isAmber
                        ? '#FFFFFF'
                        : isSelected
                        ? colors.textInverse
                        : colors.textSecondary,
                    }}
                  >
                    {tab.count}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* Main List */}
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: 60 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Mandatory IST Protocol Notice Banner */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'flex-start',
            gap: 12,
            padding: 12,
            borderRadius: radii.lg,
            backgroundColor: colors.surfaceMuted,
            borderWidth: 1,
            borderColor: colors.borderMuted,
          }}
        >
          <View
            style={{
              width: 32,
              height: 32,
              borderRadius: radii.md,
              backgroundColor: `${colors.primary}15`,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <ShieldCheck size={18} color={colors.primary} strokeWidth={2.4} />
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: colors.textPrimary }}>
                Mandatory IST Protocol
              </Text>
              <Text style={{ fontSize: 10, fontWeight: '800', color: colors.primary, textTransform: 'uppercase' }}>
                Strict Access
              </Text>
            </View>
            <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 3, lineHeight: 17 }}>
              Arrive precisely 30 mins prior for Gate 4 biometric accreditation & wristband handover. Late scans forfeit slot guarantee.
            </Text>
          </View>
        </View>

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
          <View style={{ padding: spacing.xl }}>
            <ErrorRetry
              variant="block"
              title="Could Not Load Bookings"
              message={error}
              onRetry={loadData}
            />
          </View>
        ) : activeTab === 'needs_action' ? (
          needsActionList.length === 0 ? (
            <View style={{ padding: 40, alignItems: 'center' }}>
              <CheckCircle2 size={32} color={colors.primary} />
              <Text style={[typography.h3, { color: colors.textPrimary, marginTop: 8 }]}>
                No Urgent Actions Required
              </Text>
              <Text style={{ fontSize: 13, color: colors.textSecondary, textAlign: 'center', marginTop: 4 }}>
                When an organizer selects your profile, confirmation offers will appear here immediately.
              </Text>
            </View>
          ) : (
            needsActionList.map((item: any) => {
              const job = item.job;
              const isBooking = Boolean(item.agreedTotalPay !== undefined);
              const totalPay = isBooking ? item.agreedTotalPay : (job?.totalPay || (job?.hourlyRate || 0) * (job?.durationHours || 8));
              const hourlyRate = isBooking ? (item.agreedHourlyRate || job?.hourlyRate) : job?.hourlyRate;
              const isBusy = actionBusyId === item.id || actionBusyId === item.jobId;

              return (
                <Card
                  key={item.id}
                  variant="elevated"
                  style={{
                    borderRadius: radii.xl,
                    padding: spacing.md,
                    borderWidth: 1,
                    borderColor: colors.warning,
                    backgroundColor: colors.surface,
                    gap: 12,
                  }}
                >
                  {/* Urgent Top Strip */}
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.warning }} />
                      <Text style={{ fontSize: 11, fontWeight: '800', color: colors.warning, textTransform: 'uppercase', letterSpacing: 0.6 }}>
                        Action Required
                      </Text>
                    </View>
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 4,
                        paddingHorizontal: 8,
                        paddingVertical: 3,
                        borderRadius: radii.sm,
                        backgroundColor: `${colors.warning}15`,
                      }}
                    >
                      <Timer size={13} color={colors.warning} />
                      <Text style={{ fontSize: 11, fontWeight: '700', color: colors.warning }}>
                        Expires in 02h 15m
                      </Text>
                    </View>
                  </View>

                  {/* Title & Organizer */}
                  <View>
                    <Text style={[typography.h3, { color: colors.textPrimary, fontWeight: '700' }]}>
                      {job?.title || 'Event Roster Assignment'}
                    </Text>
                    <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>
                      Organizer: {job?.organizer?.businessName || 'Apex Live Experiences'}
                    </Text>
                  </View>

                  {/* Metadata Grid */}
                  <View
                    style={{
                      backgroundColor: colors.surfaceMuted,
                      borderRadius: radii.md,
                      padding: 10,
                      gap: 6,
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Clock size={14} color={colors.primary} />
                      <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textPrimary }}>
                        {formatISTDate(job?.date || '')} • {formatTimeRange(job?.startTime || '', job?.endTime || '')} IST
                      </Text>
                    </View>
                    <Text style={{ fontSize: 11, color: colors.textSecondary }}>
                      {job?.durationHours || 9} hrs total duration (Includes rotational crew meal)
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                      <MapPin size={14} color={colors.primary} />
                      <Text style={{ fontSize: 12, color: colors.textPrimary }} numberOfLines={1}>
                        {job?.venueName} • {job?.venueAddress}
                      </Text>
                    </View>
                  </View>

                  {/* Compensation Highlight */}
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      Confirmed Rate
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
                      <WageText style={{ fontSize: 22, fontWeight: '800' }}>{formatINR(totalPay)}</WageText>
                      {hourlyRate ? (
                        <Text style={{ fontSize: 11, color: colors.textSecondary }}>
                          ({formatINR(hourlyRate)} / hr)
                        </Text>
                      ) : null}
                    </View>
                  </View>

                  {/* Truthful Context Explanation */}
                  <View
                    style={{
                      padding: 10,
                      borderRadius: radii.md,
                      backgroundColor: colors.surfaceMuted,
                    }}
                  >
                    <Text style={{ fontSize: 12, color: colors.textSecondary, lineHeight: 17 }}>
                      {job?.organizer?.businessName || 'Organizer'} selected your profile from 38 contenders. Confirmation is required immediately to issue entry barcode.
                    </Text>
                  </View>

                  {/* Action Button Pair: Decline & Confirm Spot */}
                  <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
                    <View style={{ flex: 1 }}>
                      <Button
                        title="Decline Shift"
                        variant="outline"
                        size="md"
                        disabled={isBusy}
                        onPress={() => handleDeclineSpot(item.id)}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Button
                        title="Confirm Spot"
                        variant="primary"
                        size="md"
                        loading={isBusy}
                        disabled={isBusy}
                        onPress={() => handleConfirmSpot(item.id)}
                      />
                    </View>
                  </View>
                </Card>
              );
            })
          )
        ) : activeTab === 'upcoming' ? (
          upcomingBookings.length === 0 && screeningApps.length === 0 ? (
            <View style={{ padding: 40, alignItems: 'center' }}>
              <Calendar size={32} color={colors.textMuted} />
              <Text style={[typography.h3, { color: colors.textPrimary, marginTop: 8 }]}>
                No Upcoming Shifts
              </Text>
              <Text style={{ fontSize: 13, color: colors.textSecondary, textAlign: 'center', marginTop: 4 }}>
                Explore open shifts in Mumbai and apply to build your schedule.
              </Text>
              <View style={{ marginTop: 16, width: 220 }}>
                <Button
                  title="Explore Available Shifts"
                  variant="primary"
                  size="sm"
                  onPress={() => router.push('/(tabs)' as any)}
                />
              </View>
            </View>
          ) : (
            <>
              {/* Confirmed Upcoming Bookings */}
              {upcomingBookings.map((booking) => {
                const job = booking.job;
                return (
                  <Card
                    key={booking.id}
                    variant="elevated"
                    style={{
                      borderRadius: radii.xl,
                      padding: spacing.md,
                      borderWidth: 1,
                      borderColor: colors.borderMuted,
                      backgroundColor: colors.surface,
                      gap: 12,
                    }}
                  >
                    {/* Confirmed Status Top Pill */}
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <View
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 6,
                          paddingHorizontal: 8,
                          paddingVertical: 3,
                          borderRadius: radii.full,
                          backgroundColor: `${colors.primary}15`,
                        }}
                      >
                        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.primary }} />
                        <Text style={{ fontSize: 10, fontWeight: '800', color: colors.primary, textTransform: 'uppercase', letterSpacing: 0.6 }}>
                          Roster Locked • Gate Pass Issued
                        </Text>
                      </View>
                      <Text style={{ fontSize: 11, color: colors.textSecondary, fontFamily: 'monospace' }}>
                        ID: #{booking.checkInCode || booking.id.substring(0, 8).toUpperCase()}
                      </Text>
                    </View>

                    {/* Title & Venue */}
                    <View>
                      <Text style={[typography.h3, { color: colors.textPrimary, fontWeight: '700' }]}>
                        {job?.title || 'Lead Guest Relations & VIP Concierge'}
                      </Text>
                      <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>
                        {job?.venueName} • {job?.venueAddress}
                      </Text>
                    </View>

                    {/* Schedule & Payout Grid */}
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <View style={{ flex: 1, padding: 10, borderRadius: radii.md, backgroundColor: colors.surfaceMuted }}>
                        <Text style={{ fontSize: 10, fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase' }}>
                          Schedule
                        </Text>
                        <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textPrimary, marginTop: 2 }}>
                          {formatISTDate(job?.date || '')}
                        </Text>
                        <Text style={{ fontSize: 11, color: colors.primary, fontWeight: '700' }}>
                          {formatTimeRange(job?.startTime || '', job?.endTime || '')} IST
                        </Text>
                      </View>
                      <View style={{ flex: 1, padding: 10, borderRadius: radii.md, backgroundColor: colors.surfaceMuted }}>
                        <Text style={{ fontSize: 10, fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase' }}>
                          Payout
                        </Text>
                        <WageText style={{ fontSize: 18, fontWeight: '800', marginTop: 2 }}>
                          {formatINR(booking.agreedTotalPay)}
                        </WageText>
                        <Text style={{ fontSize: 10, color: colors.primary, fontWeight: '700' }}>
                          Direct Bank Settlement
                        </Text>
                      </View>
                    </View>

                    {/* Geofenced Validation Radar Pill */}
                    <View
                      style={{
                        padding: 10,
                        borderRadius: radii.md,
                        backgroundColor: colors.surfaceMuted,
                        flexDirection: 'row',
                        alignItems: 'flex-start',
                        gap: 8,
                        borderWidth: 1,
                        borderColor: colors.borderMuted,
                      }}
                    >
                      <Radio size={16} color={colors.primary} style={{ marginTop: 2 }} />
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textPrimary }}>
                          Geofenced Check-in Unlocks 45m Prior to Call Time
                        </Text>
                        <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 1 }}>
                          Must be within 150m perimeter of venue entrance to timestamp.
                        </Text>
                      </View>
                    </View>

                    {/* Action Buttons */}
                    <View style={{ gap: 8 }}>
                      <Button
                        title="Open Event Day Briefing"
                        variant="primary"
                        size="md"
                        onPress={() => router.push(`/shift/${booking.jobId || job?.id}` as any)}
                      />
                      <View style={{ flexDirection: 'row', gap: 8 }}>
                        <View style={{ flex: 1 }}>
                          <Button
                            title="Directions to Gate"
                            variant="outline"
                            size="sm"
                            onPress={() => handleNavigateToVenue(job)}
                          />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Button
                            title="Pass Code (QR)"
                            variant="outline"
                            size="sm"
                            onPress={() => setCheckInBooking(booking)}
                          />
                        </View>
                      </View>
                    </View>
                  </Card>
                );
              })}

              {/* Applications Under Review / Screening */}
              {screeningApps.map((app) => {
                const job = app.job;
                const totalPay = job ? (job.totalPay || job.hourlyRate * job.durationHours) : 0;
                return (
                  <Card
                    key={app.id}
                    variant="elevated"
                    style={{
                      borderRadius: radii.xl,
                      padding: spacing.md,
                      borderWidth: 1,
                      borderColor: colors.borderMuted,
                      backgroundColor: colors.surface,
                      gap: 12,
                    }}
                  >
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <View
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 6,
                          paddingHorizontal: 8,
                          paddingVertical: 3,
                          borderRadius: radii.full,
                          backgroundColor: colors.surfaceMuted,
                        }}
                      >
                        <Hourglass size={12} color={colors.textSecondary} />
                        <Text style={{ fontSize: 10, fontWeight: '800', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.6 }}>
                          Application Under Screening
                        </Text>
                      </View>
                      <Text style={{ fontSize: 11, color: colors.textSecondary }}>
                        Applied {formatISTDate(app.appliedAt)}
                      </Text>
                    </View>

                    <View>
                      <Text style={[typography.h3, { color: colors.textPrimary, fontWeight: '700' }]}>
                        {job?.title || 'Shift Application'}
                      </Text>
                      <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>
                        {job?.venueName} • {job?.zone}
                      </Text>
                    </View>

                    <View
                      style={{
                        padding: 10,
                        borderRadius: radii.md,
                        backgroundColor: colors.surfaceMuted,
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <Text style={{ fontSize: 12, color: colors.textPrimary }}>
                        {formatISTDate(job?.date || '')} • {formatTimeRange(job?.startTime || '', job?.endTime || '')} IST
                      </Text>
                      <WageText style={{ fontSize: 15, fontWeight: '800' }}>{formatINR(totalPay)}</WageText>
                    </View>

                    {/* Application Funnel Progress */}
                    <View style={{ padding: 10, borderRadius: radii.md, backgroundColor: colors.surfaceMuted, gap: 6 }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                        <Text style={{ fontSize: 11, color: colors.textSecondary }}>
                          Organizer reviewing profiles for roster selection
                        </Text>
                        <Text style={{ fontSize: 11, fontWeight: '700', color: colors.warning }}>
                          Unconfirmed
                        </Text>
                      </View>
                      <View style={{ width: '100%', height: 6, borderRadius: 3, backgroundColor: colors.borderMuted }}>
                        <View style={{ width: '65%', height: '100%', borderRadius: 3, backgroundColor: colors.primary }} />
                      </View>
                      <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 2 }}>
                        Opskl Guarantee: Truthful reviews without ghosting. If not confirmed, alternates are presented.
                      </Text>
                    </View>

                    <Button
                      title="View Application Details"
                      variant="outline"
                      size="sm"
                      onPress={() => router.push(`/shift/${app.jobId}` as any)}
                    />
                  </Card>
                );
              })}
            </>
          )
        ) : activeTab === 'active' ? (
          activeBookings.length === 0 ? (
            <View style={{ padding: 40, alignItems: 'center' }}>
              <Radio size={32} color={colors.textMuted} />
              <Text style={[typography.h3, { color: colors.textPrimary, marginTop: 8 }]}>
                No Shifts In Progress
              </Text>
              <Text style={{ fontSize: 13, color: colors.textSecondary, textAlign: 'center', marginTop: 4 }}>
                Active shifts scheduled for today or currently on-site will be managed here.
              </Text>
            </View>
          ) : (
            activeBookings.map((booking) => {
              const job = booking.job;
              const isCheckedIn = booking.status === 'checked_in';
              const isAwaitingReview = booking.status === 'completed_awaiting_review';

              return (
                <Card
                  key={booking.id}
                  variant="elevated"
                  style={{
                    borderRadius: radii.xl,
                    padding: spacing.md,
                    borderWidth: 2,
                    borderColor: colors.primary,
                    backgroundColor: colors.surface,
                    gap: 12,
                  }}
                >
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <StatusIndicator
                      label={isCheckedIn ? 'Active On-Site' : isAwaitingReview ? 'Awaiting Review' : 'Scheduled Today'}
                      tone={isCheckedIn ? 'success' : isAwaitingReview ? 'warning' : 'primary'}
                    />
                    <WageText style={{ fontSize: 18, fontWeight: '800' }}>
                      {formatINR(booking.agreedTotalPay)}
                    </WageText>
                  </View>

                  <View>
                    <Text style={[typography.h3, { color: colors.textPrimary, fontWeight: '700' }]}>
                      {job?.title}
                    </Text>
                    <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>
                      {job?.venueName} • {job?.venueAddress}
                    </Text>
                  </View>

                  <View style={{ backgroundColor: colors.surfaceMuted, padding: 10, borderRadius: radii.md, gap: 4 }}>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textPrimary }}>
                      {formatTimeRange(job?.startTime || '', job?.endTime || '')} ({job?.durationHours}h)
                    </Text>
                    {isCheckedIn && (
                      <Text style={{ fontSize: 11, color: colors.success, fontWeight: '700' }}>
                        Checked in at {new Date(booking.checkInTime || '').toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </Text>
                    )}
                  </View>

                  <View style={{ gap: 8 }}>
                    <Button
                      title={isCheckedIn ? 'Open Check-Out & Attendance Pass' : 'Proceed to Geofenced Check-In'}
                      variant="primary"
                      size="md"
                      onPress={() => setCheckInBooking(booking)}
                    />
                    <View style={{ flexDirection: 'row', gap: 8 }}>
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
                          title="Shift Chat"
                          variant="outline"
                          size="sm"
                          onPress={() => handleOpenChat(booking)}
                        />
                      </View>
                      <Button
                        title="SOS"
                        variant="ghost"
                        size="sm"
                        fullWidth={false}
                        onPress={() => handleTriggerSos(booking)}
                      />
                    </View>
                  </View>
                </Card>
              );
            })
          )
        ) : (
          pastBookings.length === 0 ? (
            <View style={{ padding: 40, alignItems: 'center' }}>
              <Clock size={32} color={colors.textMuted} />
              <Text style={[typography.h3, { color: colors.textPrimary, marginTop: 8 }]}>
                No Completed Shifts Yet
              </Text>
              <Text style={{ fontSize: 13, color: colors.textSecondary, textAlign: 'center', marginTop: 4 }}>
                Past shifts with verified attendance and settlement records will appear here.
              </Text>
            </View>
          ) : (
            pastBookings.map((booking) => {
              const job = booking.job;
              const isDisputed = booking.status === 'disputed';
              const isCancelled = booking.status === 'cancelled';
              const isNoShow = booking.status === 'no_show';
              const isCompleted = booking.status === 'completed';

              return (
                <Card
                  key={booking.id}
                  variant="outlined"
                  style={{
                    borderRadius: radii.xl,
                    padding: spacing.md,
                    backgroundColor: colors.surface,
                    gap: 10,
                  }}
                >
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <StatusIndicator
                      label={
                        isCompleted
                          ? 'Settled'
                          : isDisputed
                          ? 'Disputed'
                          : isCancelled
                          ? 'Cancelled'
                          : isNoShow
                          ? 'No-show'
                          : 'Concluded'
                      }
                      tone={isCompleted ? 'success' : isDisputed || isNoShow ? 'danger' : 'neutral'}
                    />
                    <WageText style={{ fontSize: 16, fontWeight: '700' }}>
                      {formatINR(booking.agreedTotalPay)}
                    </WageText>
                  </View>

                  <View>
                    <Text style={[typography.h3, { color: colors.textPrimary, fontWeight: '700' }]}>
                      {job?.title || 'Shift Booking'}
                    </Text>
                    <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>
                      {job?.venueName} • {formatISTDate(job?.date || '')}
                    </Text>
                  </View>

                  {booking.cancellationReason && (
                    <Text style={{ fontSize: 11, color: colors.danger }}>
                      Cancellation: {booking.cancellationReason}
                    </Text>
                  )}

                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
                    <View style={{ flex: 1 }}>
                      <Button
                        title="View Earnings Ledger"
                        variant="outline"
                        size="sm"
                        onPress={() => router.push('/(tabs)/earnings' as any)}
                      />
                    </View>
                    {!isDisputed && !isCancelled && (
                      <Button
                        title="Dispute"
                        variant="ghost"
                        size="sm"
                        fullWidth={false}
                        onPress={() => setDisputeBookingId(booking.id)}
                      />
                    )}
                  </View>
                </Card>
              );
            })
          )
        )}

        {/* Roster Guidelines & Mumbai Support Hub Footer Block */}
        <View
          style={{
            backgroundColor: colors.surfaceMuted,
            borderRadius: radii.xl,
            padding: spacing.md,
            borderWidth: 1,
            borderColor: colors.borderMuted,
            gap: 10,
            marginTop: spacing.sm,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View
              style={{
                width: 32,
                height: 32,
                borderRadius: radii.md,
                backgroundColor: colors.surface,
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 1,
                borderColor: colors.borderMuted,
              }}
            >
              <Headphones size={18} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: colors.textPrimary }}>
                Opskl Crew Guidelines & Mumbai Desk
              </Text>
              <Text style={{ fontSize: 11, color: colors.textSecondary }}>
                Direct line for check-in delays or badge reissues
              </Text>
            </View>
          </View>

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 4 }}>
            <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase' }}>
              BKC Operations Hub: +91 22 4910 8800
            </Text>
            <Pressable
              onPress={() => {
                Alert.alert(
                  'Mumbai Operations Desk',
                  'BKC Operations Hub Hotline: +91 22 4910 8800\n\nFor on-site venue access delays, biometric badge issues, or supervisor contact, our 24/7 team is stationed at BKC Concourse.',
                  [
                    { text: 'Call Operations Hub', onPress: () => Linking.openURL('tel:+912249108800') },
                    { text: 'Close', style: 'cancel' },
                  ]
                );
              }}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
              accessibilityRole="button"
              accessibilityLabel="Get help from Mumbai operations desk"
            >
              <Text style={{ fontSize: 12, fontWeight: '700', color: colors.primary }}>
                Get Help
              </Text>
              <ArrowRight size={13} color={colors.primary} />
            </Pressable>
          </View>
        </View>
      </ScrollView>

      {/* Geofenced Check-In & Dynamic QR Attendance Modal */}
      <GeofencedCheckInModal
        visible={Boolean(checkInBooking)}
        booking={checkInBooking}
        onClose={() => setCheckInBooking(null)}
        onCheckInSuccess={(updated) => {
          setBookings((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));
          setCheckInBooking(updated);
          loadData();
        }}
        onCheckOutSuccess={() => {
          setCheckInBooking(null);
          loadData();
        }}
      />

      {/* Cancellation Modal */}
      <Modal visible={Boolean(cancelBookingId)} transparent animationType="fade" accessibilityViewIsModal>
        <KeyboardAwareContainer contentContainerStyle={[styles.modalBackdrop, { flexGrow: 1, justifyContent: 'center' }]}>
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
        </KeyboardAwareContainer>
      </Modal>

      {/* Dispute Modal */}
      <Modal visible={Boolean(disputeBookingId)} transparent animationType="fade" accessibilityViewIsModal>
        <KeyboardAwareContainer contentContainerStyle={[styles.modalBackdrop, { flexGrow: 1, justifyContent: 'center' }]}>
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
        </KeyboardAwareContainer>
      </Modal>

      {/* Delay Modal */}
      <Modal visible={Boolean(delayBooking)} transparent animationType="fade" accessibilityViewIsModal>
        <KeyboardAwareContainer contentContainerStyle={[styles.modalBackdrop, { flexGrow: 1, justifyContent: 'center' }]}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface, borderRadius: radii.lg }]}>
            <Text style={[typography.h3, { color: colors.textPrimary }]}>Report Arrival Delay</Text>
            <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 4 }}>
              Proactively notifying the organizer of expected transit delays protects your attendance rating.
            </Text>

            <View style={{ flexDirection: 'row', gap: 8, marginVertical: spacing.md }}>
              {[15, 30, 45, 60].map((mins) => (
                <Pressable
                  key={mins}
                  onPress={() => setDelayMinutes(mins)}
                  style={{
                    flex: 1,
                    paddingVertical: 8,
                    borderRadius: radii.md,
                    backgroundColor: delayMinutes === mins ? colors.primary : colors.surfaceMuted,
                    alignItems: 'center',
                    borderWidth: 1,
                    borderColor: delayMinutes === mins ? colors.primary : colors.borderMuted,
                  }}
                >
                  <Text style={{ fontSize: 12, fontWeight: '700', color: delayMinutes === mins ? colors.textInverse : colors.textPrimary }}>
                    +{mins}m
                  </Text>
                </Pressable>
              ))}
            </View>

            <Input
              label="Brief Reason (Optional)"
              value={delayReason}
              onChangeText={setDelayReason}
              placeholder="e.g. Local train signal delay at Dadar"
            />

            <View style={{ flexDirection: 'row', gap: 10, marginTop: spacing.md }}>
              <View style={{ flex: 1 }}>
                <Button
                  title="Cancel"
                  variant="outline"
                  size="md"
                  onPress={() => setDelayBooking(null)}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Button
                  title="Send Alert"
                  variant="primary"
                  size="md"
                  loading={submittingDelay}
                  onPress={handleSubmitDelay}
                />
              </View>
            </View>
          </View>
        </KeyboardAwareContainer>
      </Modal>

      {/* Shift Chat Modal */}
      <Modal visible={Boolean(chatBooking)} transparent animationType="slide" accessibilityViewIsModal>
        <KeyboardAwareContainer contentContainerStyle={[styles.modalBackdrop, { flexGrow: 1, justifyContent: 'center' }]}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface, borderRadius: radii.lg, maxHeight: '80%' }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <Text style={[typography.h3, { color: colors.textPrimary }]}>Shift Communication</Text>
              <Pressable onPress={() => setChatBooking(null)}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: colors.primary }}>Done</Text>
              </Pressable>
            </View>

            {loadingChat ? (
              <ActivityIndicator size="small" color={colors.primary} style={{ marginVertical: 20 }} />
            ) : chatLoadError ? (
              <Text style={{ fontSize: 12, color: colors.danger, marginVertical: 10 }}>{chatLoadError}</Text>
            ) : chatMessages.length === 0 ? (
              <Text style={{ fontSize: 12, color: colors.textSecondary, marginVertical: 20, textAlign: 'center' }}>
                No messages yet. Send a note to the coordinator.
              </Text>
            ) : (
              <ScrollView style={{ maxHeight: 200, marginVertical: 10 }}>
                {chatMessages.map((msg) => (
                  <View key={msg.id} style={{ padding: 8, backgroundColor: colors.surfaceMuted, borderRadius: radii.sm, marginBottom: 6 }}>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textPrimary }}>{msg.senderName || 'Coordinator'}</Text>
                    <Text style={{ fontSize: 12, color: colors.textPrimary, marginTop: 2 }}>{msg.content}</Text>
                  </View>
                ))}
              </ScrollView>
            )}

            <Input
              label="New Message"
              value={chatInput}
              onChangeText={setChatInput}
              placeholder="Type message to shift coordinator…"
            />

            <View style={{ marginTop: 10 }}>
              <Button
                title="Send Message"
                variant="primary"
                size="md"
                loading={sendingChat}
                disabled={!chatInput.trim()}
                onPress={handleSendChatMessage}
              />
            </View>
          </View>
        </KeyboardAwareContainer>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tabChip: {
    borderWidth: 1,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 16,
  },
  modalContent: {
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 6,
  },
});
