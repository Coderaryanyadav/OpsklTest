import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  useOpsklTheme,
  ShiftCardSkeleton,
  useAuth,
  Screen,
  ErrorRetry,
  InlineBanner,
  OpsklAlert,
} from '@opskil/design-system';
import {
  Job,
  OrganizerMetrics,
  OrganizerProfile,
  getTodayDateIST,
  fetchOrganizerJobs,
  fetchOrganizerMetrics,
  fetchOrganizerProfile,
} from '@opskil/shared';
import {
  Bell,
  MapPin,
  Calendar,
  Users,
  ArrowRight,
  Building2,
  CheckCircle2,
  ChevronDown,
  Timer,
  Clock,
  Shield,
  PlusCircle,
  Search,
  FileCheck,
  Wallet,
  Lock,
  User,
} from 'lucide-react-native';

export default function OrganizerDashboardScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const { colors, spacing, radii, touchTarget, isDark } = useOpsklTheme();

  const organizerId = session?.user?.id;

  const [organizerProfile, setOrganizerProfile] = useState<OrganizerProfile | null>(null);
  const [shifts, setShifts] = useState<Job[]>([]);
  const [metrics, setMetrics] = useState<OrganizerMetrics>({
    activeJobs: 0,
    openPositions: 0,
    newApplications: 0,
    shortlistedApplicants: 0,
    confirmedWorkers: 0,
    upcomingEvents: 0,
    completedShifts: 0,
    totalStaffingSpend: 0,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!organizerId) {
      setOrganizerProfile(null);
      setShifts([]);
      setLoading(false);
      setRefreshing(false);
      setError(null);
      return;
    }

    try {
      setError(null);
      const [profileData, jobsData, metricsData] = await Promise.all([
        fetchOrganizerProfile(organizerId),
        fetchOrganizerJobs(organizerId),
        fetchOrganizerMetrics(organizerId),
      ]);

      setOrganizerProfile(profileData);
      setShifts(jobsData);
      if (metricsData && metricsData.activeJobs !== undefined) {
        setMetrics(metricsData);
      }
    } catch (err: any) {
      console.error('Failed to load organizer data', err);
      setError(err?.message || 'Could not load organizer dashboard data.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [organizerId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };


  const todayStr = useMemo(() => getTodayDateIST(), []);

  const todayShift = useMemo(() => {
    return shifts.find((s) => s.date === todayStr);
  }, [shifts, todayStr]);

  const nextUpcomingShift = useMemo(() => {
    return shifts.find((s) => s.date >= todayStr);
  }, [shifts, todayStr]);

  const uniqueVenues = useMemo(() => {
    return Array.from(new Set(shifts.map((s) => s.venueName).filter(Boolean)));
  }, [shifts]);

  const activeShiftsCount = useMemo(() => {
    return shifts.length > 0
      ? shifts.filter((s) => s.status !== 'paused' && s.status !== 'completed' && s.status !== 'cancelled').length
      : metrics.activeJobs || 0;
  }, [shifts, metrics.activeJobs]);

  const liveTodayCount = useMemo(() => {
    return shifts.filter((s) => s.date === todayStr && (s.status === 'in_progress' || s.status === 'open' || s.status === 'filling')).length;
  }, [shifts, todayStr]);

  const isVerified = organizerProfile?.verificationStatus === 'verified';

  const requireAuthOrNavigate = (targetPath: string) => {
    if (!session?.user) {
      router.push(`/auth/login?redirect=${encodeURIComponent(targetPath)}` as any);
      return;
    }
    router.push(targetPath as any);
  };

  return (
    <Screen edges={['top']}>
      {/* Top Header Bar */}
      <View
        style={[
          styles.headerBar,
          {
            backgroundColor: colors.surface,
            borderBottomColor: colors.borderMuted,
            paddingHorizontal: spacing.lg,
            paddingVertical: spacing.md,
          },
        ]}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, paddingRight: spacing.sm }}>
            <View
              style={{
                width: 34,
                height: 34,
                borderRadius: radii.md,
                backgroundColor: colors.primary,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Building2 size={18} color={isDark ? '#000000' : '#FFFFFF'} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 10, fontWeight: '800', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.8 }}>
                OPSKL MUMBAI
              </Text>
              <Text
                style={{ fontSize: 14, fontWeight: '700', color: colors.textPrimary, letterSpacing: -0.3 }}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                Organizer Event Command
              </Text>
            </View>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <TouchableOpacity
              onPress={() => requireAuthOrNavigate('/notifications')}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={{
                width: touchTarget.min,
                height: touchTarget.min,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: colors.surfaceMuted,
                borderRadius: radii.full,
              }}
              accessibilityLabel="Open crew notifications"
              accessibilityRole="button"
            >
              <Bell size={18} color={colors.textPrimary} strokeWidth={2} />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => requireAuthOrNavigate('/(tabs)/profile')}
              style={{
                width: 34,
                height: 34,
                borderRadius: radii.full,
                backgroundColor: colors.primary,
                alignItems: 'center',
                justifyContent: 'center',
              }}
              accessibilityLabel="View profile"
              accessibilityRole="button"
            >
              <User size={16} color={isDark ? '#000000' : '#FFFFFF'} />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        {Boolean(session && !isVerified) && (
          <InlineBanner
            variant="warning"
            title="Verification Required"
            message="Your enterprise credentials must be verified before shifts can be published to the public marketplace."
            actionLabel="Complete Verification"
            onAction={() => requireAuthOrNavigate('/verification')}
          />
        )}

        {!session && (
          <InlineBanner
            variant="info"
            title="Guest Exploration Console"
            message="You are previewing the Opskl Organizer Console. Sign in or register to publish shifts, review crew, and manage live attendance."
            actionLabel="Sign In Now"
            onAction={() => router.push('/auth/login')}
          />
        )}

        {error && (
          <ErrorRetry
            message={error}
            onRetry={loadData}
          />
        )}

        {loading && !refreshing && (
          <View style={{ gap: spacing.md, paddingVertical: spacing.sm }}>
            <ShiftCardSkeleton />
            <ShiftCardSkeleton />
          </View>
        )}

        {/* Entity & Venue Context Header Card */}
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
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: radii.md,
                  backgroundColor: colors.surfaceMuted,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Building2 size={22} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={{ fontSize: 16, fontWeight: '700', color: colors.textPrimary }} numberOfLines={1}>
                    {session ? (organizerProfile?.businessName || 'Organizer account') : 'Guest Preview (Mumbai Console)'}
                  </Text>
                  {Boolean(session && isVerified) && <CheckCircle2 size={16} color={colors.primary} strokeWidth={2.4} />}
                </View>
                <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 1 }}>
                  {session
                    ? (isVerified
                        ? `GST Verified Enterprise • ${organizerProfile?.gstin || 'Registered'}`
                        : organizerProfile?.verificationStatus === 'pending'
                          ? 'Verification Under Review (4–6 hrs)'
                          : 'Unverified Enterprise • Verification Required')
                    : 'Sign in to access corporate credentials & shifts'}
                </Text>
              </View>
            </View>

            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 5,
                paddingHorizontal: 10,
                paddingVertical: 5,
                borderRadius: radii.full,
                backgroundColor: colors.surfaceMuted,
                borderWidth: 1,
                borderColor: colors.borderMuted,
              }}
            >
              <View
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: 3.5,
                  backgroundColor: colors.primary,
                }}
              />
              <Text style={{ fontSize: 10, fontWeight: '800', color: colors.primary, letterSpacing: 0.5 }}>
                LIVE DATA
              </Text>
            </View>
          </View>

          {/* Active Venue Switcher Pill */}
          <TouchableOpacity
            onPress={() => requireAuthOrNavigate('/(tabs)/roster')}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingHorizontal: 12,
              paddingVertical: 10,
              borderRadius: radii.lg,
              backgroundColor: colors.surfaceMuted,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
              <MapPin size={16} color={colors.primary} />
              <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textPrimary }} numberOfLines={1}>
                {uniqueVenues.length > 0
                  ? `All Mumbai Venues (${uniqueVenues.slice(0, 3).join(' • ')})`
                  : 'All Mumbai Venues (BKC • NESCO • Worli)'}
              </Text>
            </View>
            <ChevronDown size={16} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Immediate Operational Alert Bar */}
        <View style={{ gap: 10 }}>
          {metrics.newApplications > 0 ? (
            <View
              style={{
                backgroundColor: isDark ? 'rgba(225, 29, 72, 0.15)' : '#FFF1F2',
                borderRadius: radii.xl,
                padding: 14,
                borderWidth: 1,
                borderColor: isDark ? 'rgba(225, 29, 72, 0.35)' : '#FFE4E6',
                gap: 8,
              }}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Timer size={18} color="#E11D48" />
                  <Text style={{ fontSize: 13, fontWeight: '700', color: isDark ? '#FFFFFF' : '#9F1239' }}>
                    {metrics.newApplications} Candidate{metrics.newApplications === 1 ? '' : 's'} Pending Review
                  </Text>
                </View>
                <View
                  style={{
                    paddingHorizontal: 8,
                    paddingVertical: 3,
                    borderRadius: radii.full,
                    backgroundColor: '#E11D48',
                  }}
                >
                  <Text style={{ fontSize: 10, fontWeight: '800', color: '#FFFFFF', textTransform: 'uppercase' }}>
                    Action Required
                  </Text>
                </View>
              </View>
              <Text style={{ fontSize: 12, color: isDark ? '#F1F5F9' : '#475569', lineHeight: 17 }}>
                Verified candidates have applied to your shifts. Review profiles and confirm crew to finalize rosters.
              </Text>
              <View style={{ alignItems: 'flex-end', marginTop: 2 }}>
                <TouchableOpacity
                  onPress={() => requireAuthOrNavigate('/(tabs)/roster')}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 4,
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    borderRadius: radii.md,
                    backgroundColor: '#E11D48',
                  }}
                >
                  <Text style={{ fontSize: 11, fontWeight: '700', color: '#FFFFFF' }}>
                    Review Candidates
                  </Text>
                  <ArrowRight size={13} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            </View>
          ) : null}

          {/* Operational Briefing Note */}
          <View
            style={{
              backgroundColor: colors.surface,
              borderRadius: radii.xl,
              padding: 14,
              borderWidth: 1,
              borderColor: colors.borderMuted,
              flexDirection: 'row',
              alignItems: 'flex-start',
              gap: 10,
            }}
          >
            <Bell size={18} color={colors.primary} style={{ marginTop: 2 }} />
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: colors.textPrimary }}>
                  {todayShift
                    ? "Today's Movement Protocol"
                    : nextUpcomingShift
                      ? 'Upcoming Movement Protocol'
                      : 'Shift Movement Protocol'}
                </Text>
                {(todayShift || nextUpcomingShift)?.startTime && (
                  <Text style={{ fontSize: 11, fontWeight: '700', color: colors.primary }}>
                    IST {(todayShift || nextUpcomingShift)?.startTime}
                  </Text>
                )}
              </View>
              <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 4, lineHeight: 18 }}>
                {todayShift
                  ? `${todayShift.slotsTotal} crew reporting to ${todayShift.venueName || 'venue'} · shift live today.`
                  : nextUpcomingShift
                    ? `${nextUpcomingShift.slotsTotal} crew reporting to ${nextUpcomingShift.venueName || 'venue'} on ${nextUpcomingShift.date} · briefing on schedule.`
                    : 'No upcoming shift briefings queued. Post or open a shift to see reporting instructions here.'}
              </Text>
            </View>
          </View>
        </View>

        {/* High Velocity Operational Metrics Bento (3-Column Grid) */}
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {/* Active Shifts */}
          <TouchableOpacity
            onPress={() => requireAuthOrNavigate('/(tabs)/roster')}
            activeOpacity={0.8}
            style={{
              flex: 1,
              backgroundColor: colors.surface,
              borderRadius: radii.xl,
              padding: 12,
              borderWidth: 1,
              borderColor: colors.borderMuted,
              justifyContent: 'space-between',
            }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ fontSize: 10, fontWeight: '800', color: colors.textSecondary, textTransform: 'uppercase' }}>
                Active Shifts
              </Text>
              <Calendar size={14} color={colors.primary} />
            </View>
            <View style={{ marginTop: 8 }}>
              <Text style={{ fontSize: 24, fontWeight: '800', color: colors.textPrimary }}>
                {activeShiftsCount}
              </Text>
              <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 1 }}>
                {liveTodayCount > 0 ? `${liveTodayCount} live today` : activeShiftsCount > 0 ? `${activeShiftsCount} scheduled` : 'None active'}
              </Text>
            </View>
          </TouchableOpacity>

          {/* Applicants */}
          <TouchableOpacity
            onPress={() => requireAuthOrNavigate('/(tabs)/roster')}
            activeOpacity={0.8}
            style={{
              flex: 1,
              backgroundColor: colors.surface,
              borderRadius: radii.xl,
              padding: 12,
              borderWidth: 1,
              borderColor: colors.borderMuted,
              justifyContent: 'space-between',
            }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ fontSize: 10, fontWeight: '800', color: colors.textSecondary, textTransform: 'uppercase' }}>
                Applicants
              </Text>
              <Users size={14} color={colors.primary} />
            </View>
            <View style={{ marginTop: 8 }}>
              <Text style={{ fontSize: 24, fontWeight: '800', color: colors.textPrimary }}>
                {metrics.newApplications ?? 0}
              </Text>
              <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 1 }}>
                {metrics.shortlistedApplicants ?? 0} shortlisted
              </Text>
            </View>
          </TouchableOpacity>

          {/* Confirmed crew (real metric — no fabricated on-time %) */}
          <TouchableOpacity
            onPress={() => requireAuthOrNavigate('/(tabs)/roster')}
            activeOpacity={0.8}
            style={{
              flex: 1,
              backgroundColor: colors.surface,
              borderRadius: radii.xl,
              padding: 12,
              borderWidth: 1,
              borderColor: colors.borderMuted,
              justifyContent: 'space-between',
            }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ fontSize: 10, fontWeight: '800', color: colors.textSecondary, textTransform: 'uppercase' }}>
                Confirmed
              </Text>
              <Clock size={14} color={colors.primary} />
            </View>
            <View style={{ marginTop: 8 }}>
              <Text style={{ fontSize: 24, fontWeight: '800', color: colors.textPrimary }}>
                {metrics.confirmedWorkers ?? 0}
              </Text>
              <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 1 }}>
                Booked crew
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Today's Live Venue Snapshot */}
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
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary }} />
              <Text style={{ fontSize: 12, fontWeight: '800', color: colors.textPrimary, textTransform: 'uppercase', letterSpacing: 0.6 }}>
                Live Venue Snapshot
              </Text>
            </View>
            <View
              style={{
                paddingHorizontal: 8,
                paddingVertical: 3,
                borderRadius: radii.full,
                backgroundColor: colors.surfaceMuted,
              }}
            >
              <Text style={{ fontSize: 10, fontWeight: '800', color: colors.primary }}>
                {todayShift ? 'TODAY' : 'NO SHIFT TODAY'}
              </Text>
            </View>
          </View>

          {/* Event Tile — live shift only; no FinTech demo fallback */}
          <View
            style={{
              backgroundColor: colors.surfaceMuted,
              borderRadius: radii.lg,
              padding: 12,
              gap: 10,
            }}
          >
            <View>
              <Text style={{ fontSize: 15, fontWeight: '700', color: colors.textPrimary }}>
                {todayShift?.title || nextUpcomingShift?.title || 'No shift scheduled'}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 }}>
                <MapPin size={13} color={colors.primary} />
                <Text style={{ fontSize: 12, color: colors.textSecondary }}>
                  {todayShift?.venueName || nextUpcomingShift?.venueName || 'Post a shift to see venue snapshot'}
                </Text>
              </View>
            </View>

            {(todayShift || nextUpcomingShift) ? (
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  backgroundColor: colors.surface,
                  borderRadius: radii.md,
                  padding: 10,
                  borderWidth: 1,
                  borderColor: colors.borderMuted,
                }}
              >
                <View>
                  <Text style={{ fontSize: 10, color: colors.textSecondary, textTransform: 'uppercase' }}>
                    Shift Timeline
                  </Text>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textPrimary, marginTop: 1 }}>
                    {(todayShift || nextUpcomingShift)?.startTime || '—'} – {(todayShift || nextUpcomingShift)?.endTime || '—'} IST
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={{ fontSize: 10, color: colors.textSecondary, textTransform: 'uppercase' }}>
                    Slots
                  </Text>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: colors.primary, marginTop: 1 }}>
                    {(todayShift || nextUpcomingShift)?.slotsFilled ?? 0} / {(todayShift || nextUpcomingShift)?.slotsTotal ?? 0} filled
                  </Text>
                </View>
              </View>
            ) : null}

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Users size={14} color={colors.textSecondary} />
              <Text style={{ fontSize: 11, color: colors.textSecondary }}>
                {(todayShift || nextUpcomingShift)?.supervisorName
                  ? `On-site lead: ${(todayShift || nextUpcomingShift)?.supervisorName}`
                  : 'Supervisor contact appears when set on the shift'}
              </Text>
            </View>

            <TouchableOpacity
              onPress={() => {
                requireAuthOrNavigate(todayShift?.id ? `/shift/${todayShift.id}` : '/(tabs)/roster');
              }}
              style={{
                backgroundColor: colors.primary,
                borderRadius: radii.md,
                paddingVertical: 10,
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'row',
                gap: 6,
              }}
            >
              <Shield size={15} color={colors.textInverse} />
              <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textInverse }}>
                Open Venue Live Check-in Console
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Quick Command Desk (2x2 Grid) */}
        <View style={{ gap: 8 }}>
          <Text style={{ fontSize: 12, fontWeight: '800', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.6 }}>
            Quick Command Desk
          </Text>

          <View style={{ flexDirection: 'row', gap: 8 }}>
            {/* Post New Shift (High Contrast Card) */}
            <TouchableOpacity
              onPress={() => requireAuthOrNavigate('/(tabs)/create')}
              style={{
                flex: 1,
                backgroundColor: colors.primary,
                borderRadius: radii.xl,
                padding: 14,
                justifyContent: 'space-between',
                minHeight: 112,
              }}
            >
              <View
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: radii.md,
                  backgroundColor: isDark ? 'rgba(0,0,0,0.15)' : 'rgba(255,255,255,0.2)',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <PlusCircle size={18} color={colors.textInverse} />
              </View>
              <View>
                <Text style={{ fontSize: 14, fontWeight: '700', color: colors.textInverse }}>
                  Post New Shift
                </Text>
                <Text style={{ fontSize: 11, color: isDark ? 'rgba(0,0,0,0.7)' : 'rgba(255,255,255,0.8)', marginTop: 2 }}>
                  Funding estimate · ledger only
                </Text>
              </View>
            </TouchableOpacity>

            {/* Review Crew Card */}
            <TouchableOpacity
              onPress={() => requireAuthOrNavigate('/(tabs)/roster')}
              style={{
                flex: 1,
                backgroundColor: colors.surface,
                borderRadius: radii.xl,
                padding: 14,
                borderWidth: 1,
                borderColor: colors.borderMuted,
                justifyContent: 'space-between',
                minHeight: 112,
              }}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
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
                  <Search size={18} color={colors.textPrimary} />
                </View>
                {metrics.newApplications > 0 && (
                  <View
                    style={{
                      paddingHorizontal: 6,
                      paddingVertical: 2,
                      borderRadius: radii.full,
                      backgroundColor: isDark ? 'rgba(225, 29, 72, 0.2)' : '#FFE4E6',
                    }}
                  >
                    <Text style={{ fontSize: 10, fontWeight: '800', color: '#E11D48' }}>
                      {metrics.newApplications} New
                    </Text>
                  </View>
                )}
              </View>
              <View>
                <Text style={{ fontSize: 14, fontWeight: '700', color: colors.textPrimary }}>
                  Review Crew
                </Text>
                <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 2 }}>
                  KYC Verified profiles
                </Text>
              </View>
            </TouchableOpacity>
          </View>

          <View style={{ flexDirection: 'row', gap: 8 }}>
            {/* Sign-off Sheets */}
            <TouchableOpacity
              onPress={() => {
                if (!session?.user) {
                  requireAuthOrNavigate('/(tabs)/roster');
                  return;
                }
                OpsklAlert.alert(
                  'Sign-off Sheets',
                  'Attendance records follow the confirmed booking ledger. Sign-off PDF export is not auto-generated in this build — use Roster for live crew status.'
                );
              }}
              style={{
                flex: 1,
                backgroundColor: colors.surface,
                borderRadius: radii.xl,
                padding: 14,
                borderWidth: 1,
                borderColor: colors.borderMuted,
                justifyContent: 'space-between',
                minHeight: 112,
              }}
            >
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
                <FileCheck size={18} color={colors.textPrimary} />
              </View>
              <View>
                <Text style={{ fontSize: 14, fontWeight: '700', color: colors.textPrimary }}>
                  Sign-off Sheets
                </Text>
                <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 2 }}>
                  Attendance ledger
                </Text>
              </View>
            </TouchableOpacity>

            {/* Escrow Ledger */}
            <TouchableOpacity
              onPress={() => requireAuthOrNavigate('/(tabs)/finances')}
              style={{
                flex: 1,
                backgroundColor: colors.surface,
                borderRadius: radii.xl,
                padding: 14,
                borderWidth: 1,
                borderColor: colors.borderMuted,
                justifyContent: 'space-between',
                minHeight: 112,
              }}
            >
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
                <Wallet size={18} color={colors.textPrimary} />
              </View>
              <View>
                <Text style={{ fontSize: 14, fontWeight: '700', color: colors.textPrimary }}>
                  Escrow Ledger
                </Text>
                <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 2 }}>
                  {metrics.totalStaffingSpend > 0
                    ? `₹${metrics.totalStaffingSpend.toLocaleString('en-IN')} spend pool`
                    : '₹0 active pool'}
                </Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* Active Shifts Overview Section */}
        <View style={{ gap: 10 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ fontSize: 12, fontWeight: '800', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.6 }}>
              Active Shifts Overview
            </Text>
            {shifts.length > 0 && (
              <TouchableOpacity onPress={() => requireAuthOrNavigate('/(tabs)/roster')}>
                <Text style={{ fontSize: 11, fontWeight: '700', color: colors.primary }}>
                  VIEW ALL ({shifts.length})
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {shifts.length > 0 ? (
            shifts.slice(0, 5).map((shift) => {
              const isToday = shift.date === todayStr;
              const isFull = (shift.slotsFilled || 0) >= (shift.slotsTotal || 1);
              const statusColor =
                shift.status === 'in_progress'
                  ? '#16A34A'
                  : shift.status === 'cancelled'
                    ? '#DC2626'
                    : colors.primary;

              return (
                <TouchableOpacity
                  key={shift.id}
                  activeOpacity={0.9}
                  onPress={() => requireAuthOrNavigate(`/shift/${shift.id}`)}
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
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: statusColor }} />
                        <Text style={{ fontSize: 10, fontWeight: '800', color: statusColor, textTransform: 'uppercase' }}>
                          {isToday ? `Today • ${shift.date}` : shift.date}
                        </Text>
                      </View>
                      <Text style={{ fontSize: 14, fontWeight: '700', color: colors.textPrimary, marginTop: 2 }}>
                        {shift.title}
                      </Text>
                      <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 1 }}>
                        {shift.venueName || 'Venue TBD'}{shift.city ? `, ${shift.city}` : ''}
                      </Text>
                    </View>
                    <View
                      style={{
                        paddingHorizontal: 8,
                        paddingVertical: 3,
                        borderRadius: radii.sm,
                        backgroundColor: isFull
                          ? (isDark ? 'rgba(22, 163, 74, 0.2)' : '#DCFCE7')
                          : colors.surfaceMuted,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 10,
                          fontWeight: '700',
                          color: isFull
                            ? (isDark ? '#4ADE80' : '#15803D')
                            : colors.textPrimary,
                        }}
                      >
                        {shift.slotsFilled || 0}/{shift.slotsTotal || 0} {isFull ? 'Full' : 'Confirmed'}
                      </Text>
                    </View>
                  </View>

                  <View
                    style={{
                      backgroundColor: colors.surfaceMuted,
                      borderRadius: radii.md,
                      padding: 10,
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Clock size={14} color={colors.textPrimary} />
                      <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textPrimary }}>
                        {shift.startTime || 'TBD'} – {shift.endTime || 'TBD'} IST
                      </Text>
                    </View>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textSecondary }}>
                      ₹{Number(shift.totalPay || 0).toLocaleString('en-IN')} / shift
                    </Text>
                  </View>

                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                      {isFull ? (
                        <>
                          <Lock size={13} color={colors.textSecondary} />
                          <Text style={{ fontSize: 11, color: colors.textSecondary }}>
                            Roster Locked
                          </Text>
                        </>
                      ) : (
                        <Text style={{ fontSize: 11, color: colors.textSecondary }}>
                          {Math.max(0, (shift.slotsTotal || 0) - (shift.slotsFilled || 0))} open slots
                        </Text>
                      )}
                    </View>
                    <TouchableOpacity
                      onPress={() => requireAuthOrNavigate(`/shift/${shift.id}`)}
                      style={{
                        paddingHorizontal: 12,
                        paddingVertical: 6,
                        borderRadius: radii.md,
                        backgroundColor: colors.primary,
                      }}
                    >
                      <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textInverse }}>
                        {isToday ? 'Live Console' : 'Manage Shift'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>
              );
            })
          ) : (
            <View
              style={{
                backgroundColor: colors.surface,
                borderRadius: radii.xl,
                padding: spacing.xl,
                borderWidth: 1,
                borderColor: colors.borderMuted,
                alignItems: 'center',
                justifyContent: 'center',
                gap: 12,
              }}
            >
              <View
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 26,
                  backgroundColor: colors.surfaceMuted,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Calendar size={24} color={colors.primary} />
              </View>
              <View style={{ alignItems: 'center', gap: 4 }}>
                <Text style={{ fontSize: 16, fontWeight: '700', color: colors.textPrimary, textAlign: 'center' }}>
                  No Active Shifts
                </Text>
                <Text style={{ fontSize: 12, color: colors.textSecondary, textAlign: 'center', lineHeight: 18, maxWidth: 280 }}>
                  Create single-day shifts to source, screen, and schedule verified event crew across Mumbai venues.
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => requireAuthOrNavigate('/(tabs)/create')}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                  paddingHorizontal: 16,
                  paddingVertical: 10,
                  borderRadius: radii.lg,
                  backgroundColor: colors.primary,
                  marginTop: 4,
                }}
              >
                <PlusCircle size={16} color={colors.textInverse} />
                <Text style={{ fontSize: 13, fontWeight: '700', color: colors.textInverse }}>
                  Post Your First Shift
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Institutional Escrow & Trust Assurance Note */}
        <View
          style={{
            backgroundColor: colors.surfaceMuted,
            borderRadius: radii.xl,
            padding: 14,
            borderWidth: 1,
            borderColor: colors.borderMuted,
            flexDirection: 'row',
            alignItems: 'flex-start',
            gap: 10,
          }}
        >
          <View
            style={{
              width: 32,
              height: 32,
              borderRadius: radii.md,
              backgroundColor: colors.surface,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Shield size={18} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: colors.textPrimary }}>
              Funding &amp; payment status
            </Text>
            <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 2, lineHeight: 17 }}>
              Worker wages and platform fees are tracked in the Opskl ledger. Attendance approval is separate from payout completion. Live bank escrow rails are not linked in this build.
            </Text>
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerBar: {
    borderBottomWidth: 1,
  },
});
