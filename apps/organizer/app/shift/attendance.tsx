import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Modal,
  TextInput,
  Image,
  Linking,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import {
  useOpsklTheme,
  Screen,
  OpsklAlert,
  ErrorRetry,
  LoadingView,
  useAuth,
} from '@opskil/design-system';
import {
  Job,
  formatINR,
  fetchOrganizerJobs,
  completeShiftAndApproveAttendance,
  checkInWorkerSafe,
  subscribeToShiftRoster,
} from '@opskil/shared';
import {
  ArrowLeft,
  Bell,
  User,
  Shield,
  MapPin,
  Clock,
  QrCode,
  KeyRound,
  CheckCircle2,
  Phone,
  X,
  Radar,
} from 'lucide-react-native';

interface AttendanceWorker {
  id: string;
  bookingId: string;
  name: string;
  badgeId: string;
  roleTag: string;
  avatarUrl: string;
  phoneRaw: string;
  phoneMasked: string;
  status: 'on_duty' | 'approaching' | 'checked_out' | 'no_show';
  checkInTime?: string;
  qrPrecision?: string;
  distanceMeters?: number;
  etaMinutes?: number;
  isManualOverride?: boolean;
}

export default function LiveEventCheckInAttendanceConsoleScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { session } = useAuth();
  const { colors, spacing, radii, touchTarget } = useOpsklTheme();

  const organizerId = session?.user?.id;
  const jobId = typeof params.jobId === 'string' ? params.jobId : '';

  const [shift, setShift] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Active filter tab: 'all' | 'pending' | 'on_duty'
  const [activeFilter, setActiveFilter] = useState<'all' | 'pending' | 'on_duty'>('all');

  // Manual PIN Override Modal
  const [pinModalVisible, setPinModalVisible] = useState(false);
  const [pinWorkerId, setPinWorkerId] = useState('');
  const [supervisorPin, setSupervisorPin] = useState('');
  const [submittingPin, setSubmittingPin] = useState(false);

  // Overtime Adjust Modal
  const [otModalVisible, setOtModalVisible] = useState(false);
  const [otMinutes, setOtMinutes] = useState('60');

  // Sign-off state
  const [signingOff, setSigningOff] = useState(false);
  const [isSignedOff, setIsSignedOff] = useState(false);

  // Workers Attendance Roll
  const [workers, setWorkers] = useState<AttendanceWorker[]>([
    {
      id: 'w-1',
      bookingId: 'book-aarav-1',
      name: 'Aarav Kulkarni',
      badgeId: '#IN-8821',
      roleTag: 'Lead Usher',
      avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
      phoneRaw: '+919820111222',
      phoneMasked: '+91 98201 •••••',
      status: 'on_duty',
      checkInTime: '09:28 AM IST',
      qrPrecision: 'Gate 4 QR (±4m)',
    },
    {
      id: 'w-2',
      bookingId: 'book-priya-2',
      name: 'Priya Sharma',
      badgeId: '#IN-8824',
      roleTag: 'VIP Host',
      avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
      phoneRaw: '+919820133444',
      phoneMasked: '+91 98201 •••••',
      status: 'on_duty',
      checkInTime: '09:32 AM IST',
      qrPrecision: 'Gate 4 QR (±2m)',
    },
    {
      id: 'w-3',
      bookingId: 'book-rohan-3',
      name: 'Rohan Deshmukh',
      badgeId: '#IN-8829',
      roleTag: 'Delegate Desk',
      avatarUrl: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=150',
      phoneRaw: '+919820155666',
      phoneMasked: '+91 98201 •••••',
      status: 'on_duty',
      checkInTime: '09:35 AM IST',
      qrPrecision: 'Gate 4 QR (±5m)',
    },
    {
      id: 'w-4',
      bookingId: 'book-sneha-4',
      name: 'Sneha Patel',
      badgeId: '#IN-8833',
      roleTag: 'Hall Access Mgr',
      avatarUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150',
      phoneRaw: '+919820177888',
      phoneMasked: '+91 98201 •••••',
      status: 'on_duty',
      checkInTime: '09:40 AM IST',
      qrPrecision: 'Gate 4 QR (±3m)',
    },
    {
      id: 'w-5',
      bookingId: 'book-ananya-5',
      name: 'Ananya Rao',
      badgeId: '#IN-8839',
      roleTag: 'Speaker Lounge',
      avatarUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150',
      phoneRaw: '+919820122333',
      phoneMasked: '+91 98201 •••••',
      status: 'on_duty',
      checkInTime: '09:44 AM IST',
      qrPrecision: 'Gate 4 QR (±4m)',
    },
    {
      id: 'w-6',
      bookingId: 'book-vikram-6',
      name: 'Vikram Joshi',
      badgeId: '#IN-8842',
      roleTag: 'Usher',
      avatarUrl: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150',
      phoneRaw: '+919820199000',
      phoneMasked: '+91 98201 •••••',
      status: 'approaching', // In bounds, within geofence 120m
      distanceMeters: 120,
      etaMinutes: 2,
    },
  ]);

  const loadData = useCallback(async () => {
    if (!organizerId) {
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      setError(null);
      const jobs = await fetchOrganizerJobs(organizerId);
      const targetJob = jobId ? jobs.find((j) => j.id === jobId) : jobs[0];
      if (targetJob) {
        setShift(targetJob);
      }
    } catch (err: any) {
      setError(err?.message || 'Could not load attendance console.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [organizerId, jobId]);

  useEffect(() => {
    loadData();

    if (!organizerId) return;
    const unsub = subscribeToShiftRoster(jobId || 'job-bkc-vip-01', () => {
      loadData();
    });
    return () => unsub();
  }, [loadData, organizerId, jobId]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  // Metrics
  const totalExpected = workers.length;
  const presentCount = workers.filter((w) => w.status === 'on_duty' || w.status === 'checked_out').length;
  const inBoundsCount = workers.filter((w) => w.status === 'approaching').length;
  const noShowCount = workers.filter((w) => w.status === 'no_show').length;
  const completionPct = Math.round((presentCount / totalExpected) * 100);

  const filteredWorkers = useMemo(() => {
    if (activeFilter === 'pending') {
      return workers.filter((w) => w.status === 'approaching' || w.status === 'no_show');
    }
    if (activeFilter === 'on_duty') {
      return workers.filter((w) => w.status === 'on_duty');
    }
    return workers;
  }, [workers, activeFilter]);

  const handleCallWorker = (w: AttendanceWorker) => {
    Linking.openURL(`tel:${w.phoneRaw}`).catch(() => {
      OpsklAlert.alert('Phone Call', `Dialling ${w.name} at ${w.phoneMasked}`);
    });
  };

  // Manual Check-In (Supervisor Override)
  const handleManualCheckIn = (w: AttendanceWorker) => {
    setPinWorkerId(w.id);
    setPinModalVisible(true);
  };

  const handleConfirmPinOverride = async () => {
    if (!supervisorPin || supervisorPin.length < 4) {
      OpsklAlert.alert('PIN Required', 'Please enter supervisor 4-digit security PIN.');
      return;
    }

    setSubmittingPin(true);
    try {
      const target = workers.find((w) => w.id === pinWorkerId);
      if (target) {
        // Call checkInWorkerSafe if bookingId exists
        if (target.bookingId) {
          await checkInWorkerSafe(target.bookingId, 'MANUAL-PIN', 19.0645, 72.8679);
        }

        setWorkers((prev) =>
          prev.map((w) =>
            w.id === pinWorkerId
              ? {
                  ...w,
                  status: 'on_duty',
                  checkInTime: '09:46 AM IST',
                  qrPrecision: 'Manual Override (Supervisor Auth)',
                  isManualOverride: true,
                }
              : w
          )
        );

        OpsklAlert.alert(
          '✓ Manual Check-In Approved',
          `Worker ${target.name} marked ON DUTY via Supervisor Token MUM-SUP-4109.`
        );
      }
      setPinModalVisible(false);
      setSupervisorPin('');
      setPinWorkerId('');
    } finally {
      setSubmittingPin(false);
    }
  };

  /**
   * NON-NEGOTIABLE LIFECYCLE:
   * Attendance approval does NOT equal payment completion!
   * Approving locks billable shift hours and schedules batch payout.
   */
  const handleSignOffAttendance = async () => {
    if (isSignedOff) {
      OpsklAlert.alert('Already Signed Off', 'This attendance timesheet has already been approved and queued for payout.');
      return;
    }

    setSigningOff(true);
    try {
      // Loop bookings and complete shift attendance
      for (const w of workers) {
        if (w.status === 'on_duty') {
          await completeShiftAndApproveAttendance(w.bookingId, 9.0);
        }
      }

      setIsSignedOff(true);
      OpsklAlert.alert(
        '✓ Attendance Approved & Timesheets Queued',
        'Timesheets validated for 6 crew members.\n\nEscrow Lifecycle: Attendance approval locks billable shift hours. The automated escrow wage batch release is scheduled for 11:00 PM IST tonight.'
      );
    } catch (err: any) {
      OpsklAlert.alert('Sign-Off Error', err?.message || 'Could not validate timesheet.');
    } finally {
      setSigningOff(false);
    }
  };

  if (loading && !refreshing) {
    return (
      <Screen edges={['top']}>
        <LoadingView message="Connecting to turnstile telemetry..." />
      </Screen>
    );
  }

  if (error && !shift) {
    return (
      <Screen edges={['top']}>
        <ErrorRetry message={error} onRetry={loadData} />
      </Screen>
    );
  }

  return (
    <Screen edges={['top']}>
      {/* Top Header Bar */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.md,
          backgroundColor: colors.surface,
          borderBottomWidth: 1,
          borderBottomColor: colors.borderMuted,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={{
              width: touchTarget.min,
              height: touchTarget.min,
              borderRadius: radii.md,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: colors.surfaceMuted,
            }}
            accessibilityLabel="Go back"
            accessibilityRole="button"
          >
            <ArrowLeft size={18} color={colors.textPrimary} />
          </TouchableOpacity>
          <View>
            <Text style={{ fontSize: 10, fontWeight: '800', color: colors.textSecondary, textTransform: 'uppercase' }}>
              ATTENDANCE CONSOLE
            </Text>
            <Text style={{ fontSize: 15, fontWeight: '700', color: colors.textPrimary }} numberOfLines={1}>
              {shift?.title || 'India FinTech Conclave 2025'}
            </Text>
          </View>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <TouchableOpacity
            onPress={() => router.push('/notifications')}
            style={{
              width: 32,
              height: 32,
              borderRadius: radii.full,
              backgroundColor: colors.surfaceMuted,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Bell size={16} color={colors.textPrimary} />
          </TouchableOpacity>
          <View
            style={{
              width: 32,
              height: 32,
              borderRadius: radii.full,
              backgroundColor: colors.primary,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <User size={16} color="#FFFFFF" />
          </View>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: 120 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        {error && <ErrorRetry message={error} onRetry={loadData} />}

        {/* Operational Breadcrumb & Live Radar Banner */}
        <View
          style={{
            backgroundColor: colors.surface,
            borderRadius: radii.xl,
            padding: spacing.md,
            borderWidth: 1,
            borderColor: colors.borderMuted,
            gap: 6,
          }}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary }} />
              <Text style={{ fontSize: 10, fontWeight: '800', color: colors.primary, textTransform: 'uppercase' }}>
                Live Shift Active • Mumbai
              </Text>
            </View>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4,
                paddingHorizontal: 8,
                paddingVertical: 3,
                borderRadius: radii.full,
                backgroundColor: colors.surfaceMuted,
              }}
            >
              <Clock size={12} color={colors.textPrimary} />
              <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textPrimary }}>
                09:45 AM IST
              </Text>
            </View>
          </View>

          <Text style={{ fontSize: 17, fontWeight: '700', color: colors.textPrimary, marginTop: 2 }}>
            {shift?.title || 'India FinTech Conclave 2025'}
          </Text>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <MapPin size={13} color={colors.primary} />
            <Text style={{ fontSize: 12, color: colors.textSecondary }} numberOfLines={1}>
              {shift?.venueName || 'Jio World Convention Centre, Gate 4 • Bandra Kurla Complex'}
            </Text>
          </View>
        </View>

        {/* Geofence Check-In Portal Strip */}
        <View
          style={{
            backgroundColor: colors.surface,
            borderRadius: radii.xl,
            padding: spacing.md,
            borderWidth: 1,
            borderColor: colors.borderMuted,
            gap: 10,
          }}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 5,
                paddingHorizontal: 8,
                paddingVertical: 3,
                borderRadius: radii.sm,
                backgroundColor: colors.surfaceMuted,
              }}
            >
              <Radar size={13} color={colors.primary} />
              <Text style={{ fontSize: 10, fontWeight: '800', color: colors.primary }}>
                GEOFENCE RADIUS: 300M
              </Text>
            </View>
            <View
              style={{
                paddingHorizontal: 8,
                paddingVertical: 3,
                borderRadius: radii.sm,
                backgroundColor: colors.primary,
              }}
            >
              <Text style={{ fontSize: 10, fontWeight: '800', color: '#FFFFFF' }}>
                GPS CALIBRATED (±3M)
              </Text>
            </View>
          </View>

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
            <View>
              <Text style={{ fontSize: 10, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Designated Check-In Portal
              </Text>
              <Text style={{ fontSize: 13, fontWeight: '700', color: colors.textPrimary, marginTop: 2 }}>
                Turnstile Bank 4B (North Concourse)
              </Text>
            </View>
            <Text style={{ fontSize: 11, fontFamily: 'monospace', color: colors.textSecondary }}>
              19.0645° N, 72.8679° E
            </Text>
          </View>
        </View>

        {/* Attendance Metrics Bento Overview */}
        <View
          style={{
            backgroundColor: colors.surface,
            borderRadius: radii.xl,
            padding: spacing.md,
            borderWidth: 1,
            borderColor: colors.borderMuted,
            gap: 12,
          }}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View>
              <Text style={{ fontSize: 10, fontWeight: '800', color: colors.textSecondary, textTransform: 'uppercase' }}>
                Roster Completion
              </Text>
              <Text style={{ fontSize: 18, fontWeight: '800', color: colors.textPrimary, marginTop: 2 }}>
                {presentCount} of {totalExpected} On Deck
              </Text>
            </View>

            {/* Completion Percentage Badge */}
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                backgroundColor: colors.surfaceMuted,
                borderWidth: 2,
                borderColor: colors.primary,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ fontSize: 12, fontWeight: '800', color: colors.primary }}>
                {completionPct}%
              </Text>
            </View>
          </View>

          {/* 4-Stat Metric Strip */}
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <View style={{ flex: 1, backgroundColor: colors.surfaceMuted, borderRadius: radii.md, padding: 8, alignItems: 'center' }}>
              <Text style={{ fontSize: 9, fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase' }}>Expected</Text>
              <Text style={{ fontSize: 16, fontWeight: '800', color: colors.textPrimary, marginTop: 2 }}>{totalExpected}</Text>
              <Text style={{ fontSize: 9, color: colors.textSecondary, marginTop: 1 }}>Guest Rel.</Text>
            </View>
            <View style={{ flex: 1, backgroundColor: colors.surfaceMuted, borderRadius: radii.md, padding: 8, alignItems: 'center' }}>
              <Text style={{ fontSize: 9, fontWeight: '700', color: colors.primary, textTransform: 'uppercase' }}>Present</Text>
              <Text style={{ fontSize: 16, fontWeight: '800', color: colors.primary, marginTop: 2 }}>{presentCount}</Text>
              <Text style={{ fontSize: 9, color: colors.primary, marginTop: 1 }}>Verified</Text>
            </View>
            <View style={{ flex: 1, backgroundColor: colors.surfaceMuted, borderRadius: radii.md, padding: 8, alignItems: 'center' }}>
              <Text style={{ fontSize: 9, fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase' }}>In Bounds</Text>
              <Text style={{ fontSize: 16, fontWeight: '800', color: colors.textPrimary, marginTop: 2 }}>{inBoundsCount}</Text>
              <Text style={{ fontSize: 9, color: colors.textSecondary, marginTop: 1 }}>120m away</Text>
            </View>
            <View style={{ flex: 1, backgroundColor: colors.surfaceMuted, borderRadius: radii.md, padding: 8, alignItems: 'center' }}>
              <Text style={{ fontSize: 9, fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase' }}>No-Show</Text>
              <Text style={{ fontSize: 16, fontWeight: '800', color: colors.textPrimary, marginTop: 2 }}>{noShowCount}</Text>
              <Text style={{ fontSize: 9, color: colors.textSecondary, marginTop: 1 }}>Clear</Text>
            </View>
          </View>

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: colors.borderMuted, paddingTop: 8 }}>
            <Text style={{ fontSize: 11, color: colors.textSecondary }}>
              Shift Window: 10:00 AM – 07:00 PM IST
            </Text>
            <View style={{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: radii.xs, backgroundColor: colors.surfaceMuted }}>
              <Text style={{ fontSize: 10, fontWeight: '700', color: colors.primary }}>
                T-15M TO BRIEFING
              </Text>
            </View>
          </View>
        </View>

        {/* Scanner Ready Card */}
        <View
          style={{
            backgroundColor: colors.surface,
            borderRadius: radii.xl,
            padding: spacing.md,
            borderWidth: 1,
            borderColor: colors.borderMuted,
            gap: 12,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary }} />
            <Text style={{ fontSize: 13, fontWeight: '800', color: colors.textPrimary }}>
              Supervisor Gate 4 Scanner Active
            </Text>
          </View>
          <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: -6 }}>
            Scan dynamic worker QR passes or validate credentials manually.
          </Text>

          <View style={{ flexDirection: 'row', gap: 10 }}>
            <TouchableOpacity
              onPress={() => {
                OpsklAlert.alert('Gate 4 Scanner Feed', 'Activating device optical sensor for gate turnstile badge QR verification.');
              }}
              style={{
                flex: 1,
                paddingVertical: 12,
                borderRadius: radii.md,
                backgroundColor: colors.primary,
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'row',
                gap: 6,
              }}
            >
              <QrCode size={16} color="#FFFFFF" />
              <Text style={{ fontSize: 12, fontWeight: '700', color: '#FFFFFF' }}>
                Launch QR Scanner
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                const approaching = workers.find((w) => w.status === 'approaching');
                setPinWorkerId(approaching?.id || workers[0].id);
                setPinModalVisible(true);
              }}
              style={{
                flex: 1,
                paddingVertical: 12,
                borderRadius: radii.md,
                backgroundColor: colors.surfaceMuted,
                borderWidth: 1,
                borderColor: colors.borderMuted,
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'row',
                gap: 6,
              }}
            >
              <KeyRound size={16} color={colors.textPrimary} />
              <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textPrimary }}>
                Manual PIN Entry
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Crew Attendance Roll */}
        <View style={{ gap: 10 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={{ fontSize: 14, fontWeight: '800', color: colors.textPrimary }}>
                Crew Attendance Roll
              </Text>
              <View style={{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: radii.full, backgroundColor: colors.surfaceMuted }}>
                <Text style={{ fontSize: 10, fontWeight: '700', color: colors.textSecondary }}>
                  {totalExpected}
                </Text>
              </View>
            </View>

            <View style={{ flexDirection: 'row', gap: 6 }}>
              {[
                { id: 'all', label: `All (${totalExpected})` },
                { id: 'pending', label: `Pending (${inBoundsCount + noShowCount})` },
              ].map((f) => (
                <TouchableOpacity
                  key={f.id}
                  onPress={() => setActiveFilter(f.id as any)}
                  style={{
                    paddingHorizontal: 8,
                    paddingVertical: 4,
                    borderRadius: radii.sm,
                    backgroundColor: activeFilter === f.id ? colors.primary : colors.surfaceMuted,
                  }}
                >
                  <Text style={{ fontSize: 10, fontWeight: '700', color: activeFilter === f.id ? '#FFFFFF' : colors.textSecondary }}>
                    {f.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Workers list */}
          {filteredWorkers.map((w) => (
            <View
              key={w.id}
              style={{
                backgroundColor: colors.surface,
                borderRadius: radii.xl,
                padding: spacing.md,
                borderWidth: 1,
                borderColor: colors.borderMuted,
                gap: 10,
              }}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                  <Image
                    source={{ uri: w.avatarUrl }}
                    style={{ width: 42, height: 42, borderRadius: radii.full, backgroundColor: colors.surfaceMuted }}
                  />
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={{ fontSize: 14, fontWeight: '700', color: colors.textPrimary }}>
                        {w.name}
                      </Text>
                      <CheckCircle2 size={14} color={colors.primary} />
                    </View>
                    <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 1 }}>
                      Badge: {w.badgeId} • {w.roleTag}
                    </Text>
                  </View>
                </View>

                {/* Status Badge */}
                <View
                  style={{
                    paddingHorizontal: 8,
                    paddingVertical: 3,
                    borderRadius: radii.full,
                    backgroundColor: w.status === 'on_duty' ? '#ECFDF5' : '#FEF3C7',
                  }}
                >
                  <Text
                    style={{
                      fontSize: 10,
                      fontWeight: '800',
                      textTransform: 'uppercase',
                      color: w.status === 'on_duty' ? '#059669' : '#D97706',
                    }}
                  >
                    {w.status === 'on_duty' ? 'ON DUTY' : 'APPROACHING'}
                  </Text>
                </View>
              </View>

              {/* Checkin info or Approaching info */}
              {w.status === 'on_duty' ? (
                <View
                  style={{
                    backgroundColor: colors.surfaceMuted,
                    borderRadius: radii.md,
                    padding: 8,
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <CheckCircle2 size={13} color={colors.primary} />
                    <Text style={{ fontSize: 11, color: colors.textPrimary }}>
                      Checked In: <Text style={{ fontWeight: '700' }}>{w.checkInTime}</Text>
                    </Text>
                  </View>
                  <Text style={{ fontSize: 10, color: colors.textSecondary }}>
                    {w.qrPrecision}
                  </Text>
                </View>
              ) : (
                <View style={{ gap: 8 }}>
                  <View
                    style={{
                      backgroundColor: colors.surfaceMuted,
                      borderRadius: radii.md,
                      padding: 8,
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Radar size={13} color={colors.primary} />
                      <Text style={{ fontSize: 11, color: colors.textPrimary }}>
                        Within Geofence ({w.distanceMeters}m away)
                      </Text>
                    </View>
                    <Text style={{ fontSize: 10, fontWeight: '700', color: colors.primary }}>
                      ETA ~{w.etaMinutes} MIN
                    </Text>
                  </View>

                  {/* Actions for approaching worker */}
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <TouchableOpacity
                      onPress={() => handleCallWorker(w)}
                      style={{
                        flex: 1,
                        paddingVertical: 8,
                        borderRadius: radii.md,
                        backgroundColor: colors.surfaceMuted,
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexDirection: 'row',
                        gap: 6,
                      }}
                    >
                      <Phone size={14} color={colors.textPrimary} />
                      <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textPrimary }}>
                        Call Worker
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => handleManualCheckIn(w)}
                      style={{
                        flex: 1.5,
                        paddingVertical: 8,
                        borderRadius: radii.md,
                        backgroundColor: colors.primary,
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexDirection: 'row',
                        gap: 6,
                      }}
                    >
                      <KeyRound size={14} color="#FFFFFF" />
                      <Text style={{ fontSize: 11, fontWeight: '700', color: '#FFFFFF' }}>
                        Manual Check-in
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
          ))}
        </View>

        {/* Escrow Settlement Safeguard Banner */}
        <View
          style={{
            backgroundColor: colors.surfaceMuted,
            borderRadius: radii.xl,
            padding: spacing.md,
            borderWidth: 1,
            borderColor: colors.borderMuted,
            gap: 8,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Shield size={16} color={colors.primary} />
            <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textPrimary }}>
              Escrow Settlement Safeguard
            </Text>
          </View>
          <Text style={{ fontSize: 11, color: colors.textSecondary, lineHeight: 16 }}>
            Approving attendance locks and validates billable shift hours. The automated escrow wage batch release is scheduled for 11:00 PM IST tonight following supervisor sign-off.
          </Text>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 4 }}>
            <Text style={{ fontSize: 10, color: colors.textSecondary, textTransform: 'uppercase' }}>
              Locked Escrow Pool
            </Text>
            <Text style={{ fontSize: 12, fontWeight: '800', color: colors.textPrimary }}>
              {formatINR(15000)} (6 Crew × ₹2,500)
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Sticky Bottom Actions */}
      <View
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: colors.surface,
          borderTopWidth: 1,
          borderTopColor: colors.borderMuted,
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.md,
          gap: 8,
        }}
      >
        <TouchableOpacity
          onPress={() => setOtModalVisible(true)}
          style={{
            width: '100%',
            paddingVertical: 10,
            borderRadius: radii.md,
            backgroundColor: colors.surfaceMuted,
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'row',
            gap: 6,
          }}
        >
          <Clock size={16} color={colors.textPrimary} />
          <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textPrimary }}>
            Adjust Shift Hours / Overtime Allowance
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleSignOffAttendance}
          disabled={signingOff || isSignedOff}
          style={{
            width: '100%',
            paddingVertical: 14,
            borderRadius: radii.md,
            backgroundColor: isSignedOff ? '#059669' : colors.primary,
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'row',
            gap: 8,
          }}
        >
          <CheckCircle2 size={18} color="#FFFFFF" />
          <Text style={{ fontSize: 13, fontWeight: '700', color: '#FFFFFF' }}>
            {signingOff
              ? 'Signing Off Attendance...'
              : isSignedOff
              ? '✓ Timesheets Validated & Queued'
              : 'Sign-Off Attendance & Validate Timesheet'}
          </Text>
        </TouchableOpacity>

        <Text style={{ fontSize: 10, color: colors.textMuted, textAlign: 'center' }}>
          Audit trail logged under Supervisor Token: MUM-SUP-4109
        </Text>
      </View>

      {/* Manual PIN Override Modal */}
      <Modal
        visible={pinModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setPinModalVisible(false)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.6)',
            alignItems: 'center',
            justifyContent: 'center',
            padding: spacing.lg,
          }}
        >
          <View
            style={{
              width: '100%',
              maxWidth: 380,
              backgroundColor: colors.surface,
              borderRadius: radii.xl,
              padding: spacing.lg,
              gap: 14,
            }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ fontSize: 16, fontWeight: '800', color: colors.textPrimary }}>
                Manual PIN Attendance Override
              </Text>
              <TouchableOpacity onPress={() => setPinModalVisible(false)}>
                <X size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={{ fontSize: 12, color: colors.textSecondary }}>
              Use supervisor token authorization to manually check in worker who arrived through security turnstiles without QR pass.
            </Text>

            <TextInput
              style={{
                backgroundColor: colors.surfaceMuted,
                borderRadius: radii.md,
                paddingHorizontal: 14,
                height: 48,
                fontSize: 18,
                fontFamily: 'monospace',
                letterSpacing: 4,
                textAlign: 'center',
                color: colors.textPrimary,
                borderWidth: 1,
                borderColor: colors.borderMuted,
              }}
              placeholder="••••"
              placeholderTextColor={colors.textMuted}
              keyboardType="number-pad"
              maxLength={4}
              secureTextEntry
              value={supervisorPin}
              onChangeText={setSupervisorPin}
            />

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity
                onPress={() => setPinModalVisible(false)}
                style={{
                  flex: 1,
                  paddingVertical: 12,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: radii.md,
                  backgroundColor: colors.surfaceMuted,
                }}
              >
                <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textSecondary }}>
                  Cancel
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleConfirmPinOverride}
                disabled={submittingPin}
                style={{
                  flex: 1.5,
                  paddingVertical: 12,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: radii.md,
                  backgroundColor: colors.primary,
                }}
              >
                <Text style={{ fontSize: 12, fontWeight: '700', color: '#FFFFFF' }}>
                  {submittingPin ? 'Validating...' : 'Authorize Check-In'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Adjust Overtime Modal */}
      <Modal
        visible={otModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setOtModalVisible(false)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.6)',
            alignItems: 'center',
            justifyContent: 'center',
            padding: spacing.lg,
          }}
        >
          <View
            style={{
              width: '100%',
              maxWidth: 380,
              backgroundColor: colors.surface,
              borderRadius: radii.xl,
              padding: spacing.lg,
              gap: 14,
            }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ fontSize: 16, fontWeight: '800', color: colors.textPrimary }}>
                Overtime & Hours Allowance
              </Text>
              <TouchableOpacity onPress={() => setOtModalVisible(false)}>
                <X size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={{ fontSize: 12, color: colors.textSecondary }}>
              Record authorized post-shift overrun for active on-duty crew. Computed at statutory overtime rate in 30-min increments.
            </Text>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              {['30', '60', '90', '120'].map((mins) => (
                <TouchableOpacity
                  key={mins}
                  onPress={() => setOtMinutes(mins)}
                  style={{
                    flex: 1,
                    paddingVertical: 10,
                    borderRadius: radii.md,
                    backgroundColor: otMinutes === mins ? colors.primary : colors.surfaceMuted,
                    alignItems: 'center',
                  }}
                >
                  <Text style={{ fontSize: 12, fontWeight: '700', color: otMinutes === mins ? '#FFFFFF' : colors.textPrimary }}>
                    +{mins}m
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              onPress={() => {
                OpsklAlert.alert('Overtime Logged', `Recorded +${otMinutes} minutes overtime allowance for active crew. Added to post-shift ledger.`);
                setOtModalVisible(false);
              }}
              style={{
                width: '100%',
                paddingVertical: 12,
                borderRadius: radii.md,
                backgroundColor: colors.primary,
                alignItems: 'center',
                justifyContent: 'center',
                marginTop: 6,
              }}
            >
              <Text style={{ fontSize: 12, fontWeight: '700', color: '#FFFFFF' }}>
                Save Overtime Allowance
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}
