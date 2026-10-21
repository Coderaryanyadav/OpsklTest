import { useState, useEffect } from 'react';
import { View, Text, ScrollView, Alert, Pressable, Linking, StyleSheet } from 'react-native';
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
  LoadingView,
  InlineBanner,
} from '@opskil/design-system';
import {
  formatINR,
  formatISTDate,
  formatTimeRange,
  fetchJobById,
  applyForJobSafe,
  fetchWorkerJobStatus,
  fetchWorkerBookings,
  fetchWorkerProfile,
  checkShiftConflicts,
  ShiftConflictCheck,
  Job,
  Booking,
  WorkerProfile,
  supabase,
} from '@opskil/shared';
import {
  Calendar,
  MapPin,
  Utensils,
  Coffee,
  Clock,
  ShieldCheck,
  CheckCircle2,
  Navigation,
  Zap,
  Building2,
  Lock,
  CheckSquare,
  Square,
  Info,
} from 'lucide-react-native';
import { ApplicationReviewModal } from '../../src/components/ApplicationReviewModal';
import { GeofencedCheckInModal } from '../../src/components/GeofencedCheckInModal';

export default function WorkerShiftDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const { colors, spacing, radii, typography } = useOpsklTheme();

  const [shift, setShift] = useState<Job | null>(null);
  const [confirmedBooking, setConfirmedBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [applied, setApplied] = useState(false);
  const [isBooked, setIsBooked] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [conflictCheck, setConflictCheck] = useState<ShiftConflictCheck | null>(null);
  const [workerProfile, setWorkerProfile] = useState<WorkerProfile | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [reviewModalVisible, setReviewModalVisible] = useState(false);
  const [checkInModalVisible, setCheckInModalVisible] = useState(false);

  // Interactive Day-of Checklist state for confirmed shift briefing
  const [checklist, setChecklist] = useState({
    attire: true,
    aadhaar: true,
    geofence: false,
  });

  const handleNavigateToVenue = () => {
    if (!shift) return;
    const destination = shift.latitude && shift.longitude
      ? `${shift.latitude},${shift.longitude}`
      : encodeURIComponent(`${shift.venueName || ''}, ${shift.venueAddress || ''}, Mumbai`);
    const url = `https://www.google.com/maps/dir/?api=1&destination=${destination}`;
    Linking.openURL(url).catch(() => {
      Alert.alert('Venue Address', `${shift.venueName}\n${shift.venueAddress}`);
    });
  };

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

            const booking = userBookings.find(
              (b) =>
                (b.jobId === resolvedJobId || b.id === id) &&
                ['confirmed', 'checked_in', 'completed_awaiting_review', 'completed'].includes(b.status)
            );
            if (booking) {
              setConfirmedBooking(booking);
              setIsBooked(true);
            }
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

    if (conflictCheck?.hasConflict) {
      Alert.alert(
        'Schedule Overlap Conflict',
        conflictCheck.message ||
          'You already have another confirmed shift scheduled during this time window. Opskl prevents double-booking to protect your reliability score.',
        [{ text: 'Understood', style: 'cancel' }]
      );
      return;
    }

    setReviewModalVisible(true);
  };

  const executeSafeApplication = async () => {
    if (!shift || !session?.user?.id) return;
    setSubmitting(true);
    const result = await applyForJobSafe(shift.id, session.user.id);
    setSubmitting(false);

    if (result.success) {
      setApplied(true);
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

  const completedChecklistCount = Object.values(checklist).filter(Boolean).length;

  // Calculate starts in string e.g. "Starts in 14h 25m"
  const calculateStartsIn = () => {
    try {
      const shiftDate = new Date(`${shift.date}T${shift.startTime || '09:00:00'}`);
      const now = new Date();
      const diffMs = shiftDate.getTime() - now.getTime();
      if (diffMs <= 0) return 'Shift In Progress';
      const hours = Math.floor(diffMs / (1000 * 60 * 60));
      const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
      return `Starts in ${hours}h ${mins}m`;
    } catch {
      return 'Starts Tomorrow';
    }
  };

  // ============================================================================
  // VIEW A: CONFIRMED SHIFT DETAIL & DAY OF BRIEFING (Stitch Screen 9)
  // ============================================================================
  if (isBooked) {
    const bookingRef = confirmedBooking?.checkInCode
      ? `Ref: #${confirmedBooking.checkInCode}`
      : `Ref: #SHF-BOM-${shift.id.substring(0, 4).toUpperCase()}`;

    const upiDestination = workerProfile?.upiId || 'UPI handle not set';

    return (
      <Screen edges={['top', 'bottom']}>
        <ScreenHeader
          title="Confirmed Shift Detail & Day Of Briefing"
          onBack={() => router.back()}
          rightAction={
            <StatusIndicator label="Confirmed on Roster" tone="success" />
          }
        />

        <ScrollView
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Top Operational Status Banner */}
          <View
            style={{
              backgroundColor: colors.surface,
              borderRadius: radii.xl,
              padding: 12,
              borderWidth: 1,
              borderColor: colors.borderMuted,
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  backgroundColor: `${colors.primary}15`,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <ShieldCheck size={18} color={colors.primary} strokeWidth={2.4} />
              </View>
              <View>
                <Text style={{ fontSize: 11, fontWeight: '800', color: colors.primary, textTransform: 'uppercase', letterSpacing: 0.6 }}>
                  Confirmed Booking • Roster #04 Locked
                </Text>
                <Text style={{ fontSize: 11, color: colors.textSecondary, fontFamily: 'monospace', marginTop: 1 }}>
                  {bookingRef}
                </Text>
              </View>
            </View>

            <View
              style={{
                paddingHorizontal: 8,
                paddingVertical: 4,
                borderRadius: radii.sm,
                backgroundColor: colors.surfaceMuted,
                borderWidth: 1,
                borderColor: colors.borderMuted,
              }}
            >
              <Text style={{ fontSize: 10, fontWeight: '800', color: colors.textSecondary, textTransform: 'uppercase' }}>
                IST GEOFENCE ON
              </Text>
            </View>
          </View>

          {/* Role & Event Title Hero Bento Section */}
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
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <View style={{ flex: 1, paddingRight: 8 }}>
                <View
                  style={{
                    paddingHorizontal: 8,
                    paddingVertical: 2,
                    borderRadius: radii.full,
                    backgroundColor: colors.surfaceMuted,
                    alignSelf: 'flex-start',
                    marginBottom: 6,
                  }}
                >
                  <Text style={{ fontSize: 10, fontWeight: '800', color: colors.primary, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    {shift.category.toUpperCase()} DEPLOYMENT
                  </Text>
                </View>
                <Text style={[typography.h2, { color: colors.textPrimary, fontWeight: '700' }]}>
                  {shift.title}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                  <MapPin size={15} color={colors.primary} />
                  <Text style={{ fontSize: 13, color: colors.textSecondary }}>
                    {shift.venueName}
                  </Text>
                </View>
              </View>

              <View
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: radii.lg,
                  backgroundColor: colors.surfaceMuted,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: 1,
                  borderColor: colors.borderMuted,
                }}
              >
                <Building2 size={24} color={colors.primary} />
              </View>
            </View>

            {/* Time & Shift Cardlet inside Hero */}
            <View
              style={{
                backgroundColor: colors.surfaceMuted,
                borderRadius: radii.md,
                padding: 12,
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                <Clock size={18} color={colors.primary} />
                <View>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textPrimary }}>
                    Reporting Time: 09:30 AM IST Sharp
                  </Text>
                  <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 1 }}>
                    Shift: {formatTimeRange(shift.startTime, shift.endTime)} IST ({shift.durationHours} hrs)
                  </Text>
                </View>
              </View>

              <View
                style={{
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                  borderRadius: radii.full,
                  backgroundColor: colors.primary,
                }}
              >
                <Text style={{ fontSize: 10, fontWeight: '800', color: colors.textInverse }}>
                  {calculateStartsIn()}
                </Text>
              </View>
            </View>
          </View>

          {/* Compensation Summary & Auto-Disbursement Block */}
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
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: radii.md,
                    backgroundColor: colors.surfaceMuted,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Zap size={18} color={colors.primary} />
                </View>
                <View>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: colors.textPrimary }}>
                    Compensation Summary
                  </Text>
                  <Text style={{ fontSize: 10, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    After attendance approval
                  </Text>
                </View>
              </View>

              <View
                style={{
                  paddingHorizontal: 8,
                  paddingVertical: 3,
                  borderRadius: radii.sm,
                  backgroundColor: `${colors.primary}15`,
                }}
              >
                <Text style={{ fontSize: 10, fontWeight: '800', color: colors.primary }}>
                  Ledger tracked
                </Text>
              </View>
            </View>

            <View
              style={{
                backgroundColor: colors.surfaceMuted,
                borderRadius: radii.md,
                padding: 12,
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <View>
                <WageText style={{ fontSize: 26, fontWeight: '800' }}>
                  {formatINR(confirmedBooking?.agreedTotalPay || totalPay)}
                </WageText>
                <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 2 }}>
                  Net Payout ({formatINR(shift.hourlyRate)} / hr standard rate)
                </Text>
              </View>

              <View style={{ alignItems: 'flex-end' }}>
                <View
                  style={{
                    paddingHorizontal: 8,
                    paddingVertical: 2,
                    borderRadius: radii.sm,
                    backgroundColor: colors.surface,
                    borderWidth: 1,
                    borderColor: colors.borderMuted,
                  }}
                >
                  <Text style={{ fontSize: 10, fontWeight: '800', color: colors.textPrimary }}>
                    Zero Deductions
                  </Text>
                </View>
                <Text style={{ fontSize: 10, color: colors.textSecondary, marginTop: 3 }}>
                  Single-shift cycle
                </Text>
              </View>
            </View>

            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
                padding: 10,
                borderRadius: radii.md,
                backgroundColor: colors.surfaceMuted,
              }}
            >
              <Zap size={15} color={colors.primary} />
              <Text style={{ fontSize: 12, color: colors.textSecondary, flex: 1 }}>
                Disbursing to:{' '}
                <Text style={{ fontWeight: '700', color: colors.textPrimary, fontFamily: 'monospace' }}>
                  {upiDestination}
                </Text>
              </Text>
            </View>
          </View>

          {/* Venue Access & Transit Instructions */}
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
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Navigation size={18} color={colors.primary} />
                <Text style={{ fontSize: 13, fontWeight: '700', color: colors.textPrimary }}>
                  Venue & Entry Protocol
                </Text>
              </View>
              <View
                style={{
                  paddingHorizontal: 8,
                  paddingVertical: 3,
                  borderRadius: radii.sm,
                  backgroundColor: colors.surfaceMuted,
                  borderWidth: 1,
                  borderColor: colors.borderMuted,
                }}
              >
                <Text style={{ fontSize: 10, fontWeight: '800', color: colors.textPrimary }}>
                  GATE 4 STAFF ENTRY
                </Text>
              </View>
            </View>

            <View style={{ backgroundColor: colors.surfaceMuted, borderRadius: radii.md, padding: 12 }}>
              <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textPrimary }}>
                {shift.venueName}
              </Text>
              <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 2 }}>
                {shift.venueAddress || 'Bandra Kurla Complex, Mumbai, Maharashtra 400051'}
              </Text>
            </View>

            {/* Transit Advisory */}
            <View
              style={{
                backgroundColor: colors.surfaceMuted,
                borderRadius: radii.md,
                padding: 12,
                flexDirection: 'row',
                alignItems: 'flex-start',
                gap: 8,
              }}
            >
              <Navigation size={15} color={colors.primary} style={{ marginTop: 2 }} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textPrimary }}>
                  Transit & Commute Advisory
                </Text>
                <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 2, lineHeight: 16 }}>
                  Nearest Metro: Bandra Kurla (Line 3 Aqua Line) or Kurla West Station (Auto ~12 mins). Expect morning security check delays at Gate 4.
                </Text>
              </View>
            </View>

            <Button
              title="Open in Google Maps / Citymapper ↗"
              variant="outline"
              size="md"
              onPress={handleNavigateToVenue}
            />
          </View>

          {/* Interactive Day-of Readiness Checklist */}
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
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <CheckCircle2 size={18} color={colors.primary} />
                <Text style={{ fontSize: 13, fontWeight: '700', color: colors.textPrimary }}>
                  Shift Readiness Protocol
                </Text>
              </View>
              <View
                style={{
                  paddingHorizontal: 8,
                  paddingVertical: 3,
                  borderRadius: radii.sm,
                  backgroundColor: completedChecklistCount === 3 ? colors.surfaceMuted : `${colors.primary}15`,
                }}
              >
                <Text style={{ fontSize: 10, fontWeight: '800', color: colors.primary }}>
                  {completedChecklistCount}/3 COMPLETED
                </Text>
              </View>
            </View>

            <View style={{ gap: 8 }}>
              {/* Checklist Item 1 */}
              <Pressable
                onPress={() => setChecklist((prev) => ({ ...prev, attire: !prev.attire }))}
                style={{
                  flexDirection: 'row',
                  alignItems: 'flex-start',
                  gap: 10,
                  padding: 10,
                  borderRadius: radii.md,
                  backgroundColor: colors.surfaceMuted,
                }}
              >
                {checklist.attire ? (
                  <CheckSquare size={18} color={colors.primary} />
                ) : (
                  <Square size={18} color={colors.textSecondary} />
                )}
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textPrimary }}>
                    Western Formal Black Suit / Formal Sari
                  </Text>
                  <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 1 }}>
                    Ironed and compliant with event VIP dress code standards
                  </Text>
                </View>
              </Pressable>

              {/* Checklist Item 2 */}
              <Pressable
                onPress={() => setChecklist((prev) => ({ ...prev, aadhaar: !prev.aadhaar }))}
                style={{
                  flexDirection: 'row',
                  alignItems: 'flex-start',
                  gap: 10,
                  padding: 10,
                  borderRadius: radii.md,
                  backgroundColor: colors.surfaceMuted,
                }}
              >
                {checklist.aadhaar ? (
                  <CheckSquare size={18} color={colors.primary} />
                ) : (
                  <Square size={18} color={colors.textSecondary} />
                )}
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textPrimary }}>
                    Physical or Masked Aadhaar Card
                  </Text>
                  <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 1 }}>
                    Mandatory at security checkpoint for crew badge issuance
                  </Text>
                </View>
              </Pressable>

              {/* Checklist Item 3 */}
              <Pressable
                onPress={() => setChecklist((prev) => ({ ...prev, geofence: !prev.geofence }))}
                style={{
                  flexDirection: 'row',
                  alignItems: 'flex-start',
                  gap: 10,
                  padding: 10,
                  borderRadius: radii.md,
                  backgroundColor: colors.surfaceMuted,
                }}
              >
                {checklist.geofence ? (
                  <CheckSquare size={18} color={colors.primary} />
                ) : (
                  <Square size={18} color={colors.textSecondary} />
                )}
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textPrimary }}>
                    Opskl Geofence Check-in Token Ready
                  </Text>
                  <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 1 }}>
                    Ensure phone GPS is set to High Accuracy upon arriving at Gate 4
                  </Text>
                </View>
              </Pressable>
            </View>
          </View>

          {/* On-Site Command Section */}
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
            <View>
              <Text style={{ fontSize: 13, fontWeight: '700', color: colors.textPrimary }}>
                On-Site Command
              </Text>
              <Text style={{ fontSize: 11, color: colors.textSecondary }}>
                {shift.organizer?.businessName || 'Apex Live'} Operational Team
              </Text>
            </View>

            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                backgroundColor: colors.surfaceMuted,
                padding: 12,
                borderRadius: radii.md,
              }}
            >
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  backgroundColor: colors.primary,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ fontSize: 16, fontWeight: '800', color: colors.textInverse }}>
                  {(shift.supervisorName || 'SV').substring(0, 2).toUpperCase()}
                </Text>
              </View>

              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: colors.textPrimary }}>
                  {shift.supervisorName || 'Supervisor not listed'}
                </Text>
                <Text style={{ fontSize: 11, color: colors.textSecondary }}>
                  {shift.organizer?.businessName || 'Organizer'}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                  <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.primary }} />
                  <Text style={{ fontSize: 10, fontWeight: '800', color: colors.primary, textTransform: 'uppercase' }}>
                    {shift.supervisorPhone ? 'Phone on file' : 'No phone on file'}
                  </Text>
                </View>
              </View>
            </View>

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Button
                  title="Call Supervisor"
                  variant="outline"
                  size="sm"
                  onPress={() => {
                    if (!shift.supervisorPhone) {
                      Alert.alert('No phone on file', 'This shift has no supervisor phone number.');
                      return;
                    }
                    Alert.alert(
                      'Call Supervisor',
                      `This dials ${shift.supervisorName || 'the supervisor'} directly. Masked number bridging is not wired in this build.`,
                      [
                        {
                          text: 'Call Now',
                          onPress: () => Linking.openURL(`tel:${shift.supervisorPhone}`),
                        },
                        { text: 'Cancel', style: 'cancel' },
                      ]
                    );
                  }}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Button
                  title="Emergency Desk"
                  variant="outline"
                  size="sm"
                  onPress={() => {
                    Alert.alert(
                      'Contact Supervisor',
                      'Use your on-site supervisor contact from the shift briefing. No 24/7 dispatch desk is wired in this build.'
                    );
                  }}
                />
              </View>
            </View>
          </View>

          {/* Cancellation Terms & Reliability Policy */}
          <View
            style={{
              backgroundColor: colors.surfaceMuted,
              borderRadius: radii.xl,
              padding: 12,
              borderWidth: 1,
              borderColor: colors.borderMuted,
              flexDirection: 'row',
              alignItems: 'flex-start',
              gap: 8,
            }}
          >
            <Info size={16} color={colors.textSecondary} style={{ marginTop: 2 }} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textPrimary }}>
                Cancellation Terms & Reliability Policy
              </Text>
              <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 2, lineHeight: 16 }}>
                Free cancellation permitted up to 18 hours prior. Late cancellation or no-show may affect future shift eligibility.
              </Text>
            </View>
          </View>
        </ScrollView>

        {/* Fixed Bottom Action Bar */}
        <View
          style={[
            styles.fixedFooter,
            {
              backgroundColor: colors.surface,
              borderTopColor: colors.borderMuted,
            },
          ]}
        >
          <Button
            title="Proceed to Geofenced Check-In"
            variant="primary"
            size="lg"
            onPress={() => setCheckInModalVisible(true)}
          />

          <Pressable
            onPress={() => {
              Alert.alert(
                'Coordinator Support',
                shift.supervisorPhone
                  ? `Call ${shift.supervisorName || 'your supervisor'} for check-in questions. No masked bridge desk is wired.`
                  : 'No supervisor phone is on file for this shift.',
                shift.supervisorPhone
                  ? [
                      {
                        text: 'Call',
                        onPress: () => Linking.openURL(`tel:${shift.supervisorPhone}`),
                      },
                      { text: 'Close', style: 'cancel' },
                    ]
                  : [{ text: 'Close', style: 'cancel' }]
              );
            }}
            style={{ alignItems: 'center', marginTop: 8 }}
          >
            <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textSecondary }}>
              Request Coordinator Support
            </Text>
          </Pressable>
        </View>

        {/* Geofenced Check-in & Dynamic Token Modal */}
        {confirmedBooking && (
          <GeofencedCheckInModal
            visible={checkInModalVisible}
            booking={confirmedBooking}
            onClose={() => setCheckInModalVisible(false)}
            onCheckInSuccess={(up) => {
              setConfirmedBooking(up);
            }}
          />
        )}
      </Screen>
    );
  }

  // ============================================================================
  // VIEW B: OPEN SHIFT DISCOVERY DETAILS (Stitch Screen 6)
  // ============================================================================
  return (
    <Screen edges={['top', 'bottom']}>
      <ScreenHeader
        title={shift.title}
        subtitle={`${shift.category.toUpperCase()} • ${shift.zone}`}
        onBack={() => router.back()}
        rightAction={
          applied ? (
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
        {/* Top Slot Status Strip */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            paddingHorizontal: 12,
            paddingVertical: 6,
            borderRadius: radii.full,
            backgroundColor: colors.surfaceMuted,
            alignSelf: 'flex-start',
            borderWidth: 1,
            borderColor: colors.borderMuted,
          }}
        >
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary }} />
          <Text style={{ fontSize: 11, fontWeight: '700', color: colors.primary, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            {slotsRemaining} Slots Open • Verified Roster
          </Text>
        </View>

        {/* Net Shift Compensation Bento Card */}
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
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <View>
              <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Net Shift Compensation
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4, marginTop: 2 }}>
                <WageText style={{ fontSize: 28, fontWeight: '800' }}>{formatINR(totalPay)}</WageText>
                <Text style={{ fontSize: 13, color: colors.textSecondary }}>/ shift</Text>
              </View>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <View
                style={{
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                  borderRadius: radii.sm,
                  backgroundColor: colors.surfaceMuted,
                  borderWidth: 1,
                  borderColor: colors.borderMuted,
                }}
              >
                <Text style={{ fontSize: 12, fontWeight: '700', color: colors.primary }}>
                  {formatINR(shift.hourlyRate)} / hr
                </Text>
              </View>
              <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 4 }}>
                {shift.durationHours}h scheduled duration
              </Text>
            </View>
          </View>

          {/* Trust Badges Grid */}
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <View
              style={{
                flex: 1,
                padding: 10,
                borderRadius: radii.md,
                backgroundColor: colors.surfaceMuted,
                flexDirection: 'row',
                alignItems: 'flex-start',
                gap: 8,
              }}
            >
              <Zap size={16} color={colors.primary} style={{ marginTop: 2 }} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textPrimary }}>
                  Ledger settlement
                </Text>
                <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 1 }}>
                  After attendance approval · rails not auto-wired
                </Text>
              </View>
            </View>
            <View
              style={{
                flex: 1,
                padding: 10,
                borderRadius: radii.md,
                backgroundColor: colors.surfaceMuted,
                flexDirection: 'row',
                alignItems: 'flex-start',
                gap: 8,
              }}
            >
              <ShieldCheck size={16} color={colors.primary} style={{ marginTop: 2 }} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textPrimary }}>
                  Zero Deductions
                </Text>
                <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 1 }}>
                  100% verified payout
                </Text>
              </View>
            </View>
          </View>

          <View
            style={{
              padding: 8,
              borderRadius: radii.sm,
              backgroundColor: colors.surfaceMuted,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <Clock size={14} color={colors.textSecondary} />
            <Text style={{ fontSize: 11, color: colors.textSecondary }}>
              {shift.breaksMinutes ? `${shift.breaksMinutes} min scheduled rotational meal break included.` : 'Standard meal and rest break included.'}
            </Text>
          </View>
        </View>

        {/* Schedule & Timing Card */}
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
            <Calendar size={18} color={colors.primary} />
            <Text style={{ fontSize: 14, fontWeight: '700', color: colors.textPrimary }}>
              Schedule & Reporting (IST Timings)
            </Text>
          </View>

          <View style={{ flexDirection: 'row', gap: 8 }}>
            <View style={{ flex: 1, padding: 10, borderRadius: radii.md, backgroundColor: colors.surfaceMuted }}>
              <Text style={{ fontSize: 10, fontWeight: '700', textTransform: 'uppercase', color: colors.textSecondary }}>
                Shift Date
              </Text>
              <Text style={{ fontSize: 13, fontWeight: '700', color: colors.textPrimary, marginTop: 2 }}>
                {formatISTDate(shift.date)}
              </Text>
            </View>

            <View style={{ flex: 1, padding: 10, borderRadius: radii.md, backgroundColor: colors.surfaceMuted }}>
              <Text style={{ fontSize: 10, fontWeight: '700', textTransform: 'uppercase', color: colors.textSecondary }}>
                Call-Time Window
              </Text>
              <Text style={{ fontSize: 13, fontWeight: '700', color: colors.textPrimary, marginTop: 2 }}>
                {formatTimeRange(shift.startTime, shift.endTime)} IST
              </Text>
            </View>
          </View>
        </View>

        {/* Venue Information Card */}
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
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <MapPin size={18} color={colors.primary} />
              <Text style={{ fontSize: 14, fontWeight: '700', color: colors.textPrimary }}>
                Venue Location
              </Text>
            </View>
            <View
              style={{
                paddingHorizontal: 8,
                paddingVertical: 2,
                borderRadius: radii.sm,
                backgroundColor: colors.surfaceMuted,
              }}
            >
              <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textSecondary }}>
                {shift.zone} Zone
              </Text>
            </View>
          </View>

          <Text style={{ fontSize: 13, fontWeight: '700', color: colors.textPrimary }}>
            {shift.venueName}
          </Text>
          <Text style={{ fontSize: 12, color: colors.textSecondary, lineHeight: 18 }}>
            {shift.venueAddress}
          </Text>

          <Pressable
            onPress={handleNavigateToVenue}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: colors.surfaceMuted,
              borderRadius: radii.md,
              paddingVertical: 10,
              gap: 6,
              marginTop: 4,
            }}
          >
            <Navigation size={15} color={colors.primary} />
            <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textPrimary }}>
              Open in Google Maps / Citymapper ↗
            </Text>
          </Pressable>
        </View>

        {/* Duties & Core Responsibilities */}
        {shift.duties && shift.duties.length > 0 && (
          <View
            style={{
              backgroundColor: colors.surface,
              borderRadius: radii.xl,
              padding: spacing.md,
              borderWidth: 1,
              borderColor: colors.borderMuted,
              gap: 8,
            }}
          >
            <Text style={{ fontSize: 14, fontWeight: '700', color: colors.textPrimary }}>
              Duties & Core Responsibilities
            </Text>
            {shift.duties.map((duty, idx) => (
              <View key={idx} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
                <View style={{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: colors.primary, marginTop: 6 }} />
                <Text style={{ fontSize: 12, color: colors.textSecondary, flex: 1, lineHeight: 18 }}>
                  {duty}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Mandatory Criteria & Attire */}
        <View
          style={{
            backgroundColor: colors.surface,
            borderRadius: radii.xl,
            padding: spacing.md,
            borderWidth: 1,
            borderColor: colors.borderMuted,
            gap: 8,
          }}
        >
          <Text style={{ fontSize: 14, fontWeight: '700', color: colors.textPrimary }}>
            Mandatory Criteria & Attire
          </Text>
          <View style={{ gap: 6 }}>
            <Text style={{ fontSize: 12, color: colors.textSecondary }}>
              Dress Code: {shift.dressCode || 'Standard professional black trousers and plain collared shirt.'}
            </Text>
            <Text style={{ fontSize: 12, color: colors.textSecondary }}>
              ID Verification: Government photo ID (Aadhaar / PAN) required at security gate.
            </Text>
          </View>
        </View>

        {/* Amenities & Conditions */}
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
          <Text style={{ fontSize: 14, fontWeight: '700', color: colors.textPrimary }}>
            Organizer-Provided Conditions
          </Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <View style={{ flex: 1, padding: 10, borderRadius: radii.md, backgroundColor: colors.surfaceMuted, alignItems: 'center' }}>
              <Utensils size={18} color={colors.primary} style={{ marginBottom: 4 }} />
              <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textPrimary, textAlign: 'center' }}>
                {shift.mealProvided ? 'Meal Provided' : 'No Meal'}
              </Text>
              <Text style={{ fontSize: 10, color: colors.textSecondary, textAlign: 'center', marginTop: 1 }}>
                {shift.mealProvided ? 'Provided on-site' : 'Self-arranged'}
              </Text>
            </View>
            <View style={{ flex: 1, padding: 10, borderRadius: radii.md, backgroundColor: colors.surfaceMuted, alignItems: 'center' }}>
              <Lock size={18} color={colors.primary} style={{ marginBottom: 4 }} />
              <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textPrimary, textAlign: 'center' }}>
                {shift.transportProvided ? 'Transport' : 'Transit'}
              </Text>
              <Text style={{ fontSize: 10, color: colors.textSecondary, textAlign: 'center', marginTop: 1 }}>
                {shift.transportProvided ? 'Allowance / cab' : 'Self-commute'}
              </Text>
            </View>
            <View style={{ flex: 1, padding: 10, borderRadius: radii.md, backgroundColor: colors.surfaceMuted, alignItems: 'center' }}>
              <Coffee size={18} color={colors.primary} style={{ marginBottom: 4 }} />
              <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textPrimary, textAlign: 'center' }}>
                Rest Breaks
              </Text>
              <Text style={{ fontSize: 10, color: colors.textSecondary, textAlign: 'center', marginTop: 1 }}>
                {shift.breaksMinutes ? `${shift.breaksMinutes}m scheduled` : 'Standard rest'}
              </Text>
            </View>
          </View>
        </View>

        {/* Attendance & Reliability Policy Guarantee */}
        <View
          style={{
            backgroundColor: colors.surfaceMuted,
            borderRadius: radii.lg,
            padding: 12,
            borderWidth: 1,
            borderColor: colors.borderMuted,
            gap: 4,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <ShieldCheck size={16} color={colors.primary} />
            <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textPrimary }}>
              Attendance & Reliability Policy
            </Text>
          </View>
          <Text style={{ fontSize: 11, color: colors.textSecondary, lineHeight: 16 }}>
            {shift.cancellationPolicy || 'Cancellations made well in advance preserve your reliability rating. Unannounced no-shows impact eligibility for premium shifts.'}
          </Text>
        </View>

        <InlineBanner
          variant="info"
          title="Shift status"
          message={
            applied
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

        <View style={{ height: 90 }} />
      </ScrollView>

      {/* Bottom Fixed Action Bar */}
      <View
        style={[
          styles.fixedFooter,
          {
            backgroundColor: colors.surface,
            borderTopColor: colors.border,
          },
        ]}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md }}>
          <View>
            <Text style={{ fontSize: 10, fontWeight: '700', textTransform: 'uppercase', color: colors.textSecondary, letterSpacing: 0.5 }}>
              Shift Payout
            </Text>
            <WageText style={{ fontSize: 20, fontWeight: '800' }}>{formatINR(totalPay)}</WageText>
          </View>

          <View style={{ flex: 1, maxWidth: 220 }}>
            {applied ? (
              <Button
                title="Application Submitted"
                variant="secondary"
                size="md"
                onPress={() => setReviewModalVisible(true)}
              />
            ) : conflictCheck?.hasConflict ? (
              <Button
                title="Schedule Overlap"
                variant="outline"
                size="md"
                disabled={true}
                onPress={handleApply}
              />
            ) : session?.user?.id && workerProfile && workerProfile.verificationStatus !== 'verified' ? (
              <Button
                title={
                  workerProfile.verificationStatus === 'pending'
                    ? 'Verification Pending'
                    : 'Verify KYC to Apply'
                }
                variant="primary"
                size="md"
                onPress={() => router.push('/onboarding' as any)}
              />
            ) : (
              <Button
                title="Apply for Shift"
                variant="primary"
                size="md"
                loading={submitting}
                onPress={handleApply}
              />
            )}
          </View>
        </View>

        <Text style={{ fontSize: 11, color: colors.textSecondary, textAlign: 'center', marginTop: 6 }}>
          Review takes ~2-4 hours • Does not guarantee hiring
        </Text>
      </View>

      {/* Application Review Modal */}
      <ApplicationReviewModal
        visible={reviewModalVisible}
        shift={shift}
        workerProfile={workerProfile}
        submitting={submitting}
        isApplied={applied}
        onClose={() => setReviewModalVisible(false)}
        onSubmit={executeSafeApplication}
        onNavigateDiscover={() => {
          setReviewModalVisible(false);
          router.push('/(tabs)');
        }}
        onNavigateMyShifts={() => {
          setReviewModalVisible(false);
          router.push('/(tabs)/my-shifts');
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  fixedFooter: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 4,
  },
});
