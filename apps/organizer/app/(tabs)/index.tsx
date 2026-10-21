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
  const { colors, spacing, radii, touchTarget } = useOpsklTheme();

  const organizerId = session?.user?.id;

  const [organizerProfile, setOrganizerProfile] = useState<OrganizerProfile | null>(null);
  const [shifts, setShifts] = useState<Job[]>([]);
  const [metrics, setMetrics] = useState<OrganizerMetrics>({
    activeJobs: 4,
    openPositions: 8,
    newApplications: 38,
    shortlistedApplicants: 12,
    confirmedWorkers: 18,
    upcomingEvents: 5,
    completedShifts: 140,
    totalStaffingSpend: 184500,
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
    return shifts.length > 0 ? shifts.filter((s) => s.status !== 'paused').length : metrics.activeJobs || 4;
  }, [shifts, metrics.activeJobs]);

  const isVerified = organizerProfile?.verificationStatus === 'verified';

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
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
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
              <Building2 size={18} color="#FFFFFF" />
            </View>
            <View>
              <Text style={{ fontSize: 10, fontWeight: '800', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.8 }}>
                OPSKL MUMBAI
              </Text>
              <Text style={{ fontSize: 15, fontWeight: '700', color: colors.textPrimary, letterSpacing: -0.3 }}>
                Organizer Event Command & Dashboard
              </Text>
            </View>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <TouchableOpacity
              onPress={() => router.push('/notifications')}
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
              onPress={() => router.push('/(tabs)/profile')}
              style={{
                width: 32,
                height: 32,
                borderRadius: radii.full,
                backgroundColor: colors.primary,
                alignItems: 'center',
                justifyContent: 'center',
              }}
              accessibilityLabel="View profile"
              accessibilityRole="button"
            >
              <User size={16} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        {!isVerified && (
          <InlineBanner
            variant="warning"
            title="Verification Required"
            message="Your enterprise credentials must be verified before shifts can be published to the public marketplace."
            actionLabel="Complete Verification"
            onAction={() => router.push('/verification' as any)}
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
                    {organizerProfile?.businessName || 'Apex Live Experiences'}
                  </Text>
                  {isVerified && <CheckCircle2 size={16} color={colors.primary} strokeWidth={2.4} />}
                </View>
                <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 1 }}>
                  {isVerified
                    ? `GST Verified Enterprise • ${organizerProfile?.gstin || 'Registered'}`
                    : organizerProfile?.verificationStatus === 'pending'
                    ? 'Verification Under Review (4–6 hrs)'
                    : 'Unverified Enterprise • Verification Required'}
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
                LIVE OPS
              </Text>
            </View>
          </View>

          {/* Active Venue Switcher Pill */}
          <TouchableOpacity
            onPress={() => router.push('/(tabs)/roster')}
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
          {/* Urgent Action Pill Card */}
          <View
            style={{
              backgroundColor: '#FFF1F2',
              borderRadius: radii.xl,
              padding: 14,
              borderWidth: 1,
              borderColor: '#FFE4E6',
              gap: 8,
            }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Timer size={18} color="#E11D48" />
                <Text style={{ fontSize: 13, fontWeight: '700', color: colors.textPrimary }}>
                  3 Confirmations Expiring
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
                  45m Left
                </Text>
              </View>
            </View>
            <Text style={{ fontSize: 12, color: colors.textSecondary, lineHeight: 17 }}>
              Lead VIP Concierge at JWCC BKC • Unaccepted slots will automatically roll back to next waitlisted crew.
            </Text>
            <View style={{ alignItems: 'flex-end', marginTop: 2 }}>
              <TouchableOpacity
                onPress={() => router.push('/(tabs)/roster')}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 4,
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: radii.md,
                  backgroundColor: colors.primary,
                }}
              >
                <Text style={{ fontSize: 11, fontWeight: '700', color: '#FFFFFF' }}>
                  Review Roster
                </Text>
                <ArrowRight size={13} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </View>

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
                  Tomorrow's Movement Protocol
                </Text>
                <Text style={{ fontSize: 11, fontWeight: '700', color: colors.primary }}>
                  IST 09:30 AM
                </Text>
              </View>
              <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 4, lineHeight: 18 }}>
                {nextUpcomingShift
                  ? `${nextUpcomingShift.slotsTotal} Crew reporting to ${nextUpcomingShift.venueName || 'BKC Venue'} sharp. Uniform & shift briefing on schedule.`
                  : '14 Crew reporting to Jio World Convention Centre (Gate 3 North) sharp. Uniform & radio distribution at 09:40 AM.'}
              </Text>
            </View>
          </View>
        </View>

        {/* High Velocity Operational Metrics Bento (3-Column Grid) */}
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {/* Active Shifts */}
          <View
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
                1 live today
              </Text>
            </View>
          </View>

          {/* Applicants */}
          <View
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
                {metrics.newApplications || 38}
              </Text>
              <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 1 }}>
                12 screening
              </Text>
            </View>
          </View>

          {/* On-Time Rate */}
          <View
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
                On-Time Rate
              </Text>
              <Clock size={14} color={colors.primary} />
            </View>
            <View style={{ marginTop: 8 }}>
              <Text style={{ fontSize: 24, fontWeight: '800', color: colors.textPrimary }}>
                98.4%
              </Text>
              <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 1 }}>
                Last 140 shifts
              </Text>
            </View>
          </View>
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
                100% On-Site
              </Text>
            </View>
          </View>

          {/* Event Tile */}
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
                {todayShift?.title || 'India FinTech Conclave 2025'}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 }}>
                <MapPin size={13} color={colors.primary} />
                <Text style={{ fontSize: 12, color: colors.textSecondary }}>
                  {todayShift?.venueName || 'Jio World Convention Centre • Hall 2, Gate 4'}
                </Text>
              </View>
            </View>

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
                  10:00 AM – 07:00 PM IST
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={{ fontSize: 10, color: colors.textSecondary, textTransform: 'uppercase' }}>
                  Roster Geofence
                </Text>
                <Text style={{ fontSize: 12, fontWeight: '700', color: colors.primary, marginTop: 1 }}>
                  6 / 6 Checked In
                </Text>
              </View>
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Users size={14} color={colors.textSecondary} />
              <Text style={{ fontSize: 11, color: colors.textSecondary }}>
                On-site Lead: Rohit Mehta (+91 98204 88201)
              </Text>
            </View>

            <TouchableOpacity
              onPress={() => {
                if (todayShift?.id) {
                  router.push(`/shift/${todayShift.id}`);
                } else {
                  router.push('/(tabs)/roster');
                }
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
              <Shield size={15} color="#FFFFFF" />
              <Text style={{ fontSize: 12, fontWeight: '700', color: '#FFFFFF' }}>
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
              onPress={() => router.push('/(tabs)/create')}
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
                  backgroundColor: 'rgba(255,255,255,0.2)',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <PlusCircle size={18} color="#FFFFFF" />
              </View>
              <View>
                <Text style={{ fontSize: 14, fontWeight: '700', color: '#FFFFFF' }}>
                  Post New Shift
                </Text>
                <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.8)', marginTop: 2 }}>
                  Instant Mumbai Escrow
                </Text>
              </View>
            </TouchableOpacity>

            {/* Review Crew Card */}
            <TouchableOpacity
              onPress={() => router.push('/(tabs)/roster')}
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
                <View
                  style={{
                    paddingHorizontal: 6,
                    paddingVertical: 2,
                    borderRadius: radii.full,
                    backgroundColor: '#FFE4E6',
                  }}
                >
                  <Text style={{ fontSize: 10, fontWeight: '800', color: '#E11D48' }}>
                    12 New
                  </Text>
                </View>
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
                OpsklAlert.alert(
                  'Sign-off Sheets',
                  'Attendance and biometric accreditation records are compiled in real-time. Download official sign-off PDFs from the Roster desk.'
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
                  PDF audit logs ready
                </Text>
              </View>
            </TouchableOpacity>

            {/* Escrow Ledger */}
            <TouchableOpacity
              onPress={() => router.push('/(tabs)/finances')}
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
                  ₹1,84,500 active pool
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
            <TouchableOpacity onPress={() => router.push('/(tabs)/roster')}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: colors.primary }}>
                VIEW ALL (4)
              </Text>
            </TouchableOpacity>
          </View>

          {/* Shift Card 1: Tomorrow Sat 24 May */}
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
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.primary }} />
                  <Text style={{ fontSize: 10, fontWeight: '800', color: colors.primary, textTransform: 'uppercase' }}>
                    Sat 24 May • Tomorrow
                  </Text>
                </View>
                <Text style={{ fontSize: 14, fontWeight: '700', color: colors.textPrimary, marginTop: 2 }}>
                  Lead Guest Relations & VIP Concierge
                </Text>
                <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 1 }}>
                  Jio World Convention Centre, BKC
                </Text>
              </View>
              <View
                style={{
                  paddingHorizontal: 8,
                  paddingVertical: 3,
                  borderRadius: radii.sm,
                  backgroundColor: colors.surfaceMuted,
                }}
              >
                <Text style={{ fontSize: 10, fontWeight: '700', color: colors.textPrimary }}>
                  6/6 Full
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
                  10:00 AM – 07:00 PM IST
                </Text>
              </View>
              <View
                style={{
                  paddingHorizontal: 6,
                  paddingVertical: 2,
                  borderRadius: radii.sm,
                  backgroundColor: colors.surface,
                }}
              >
                <Text style={{ fontSize: 10, fontWeight: '700', color: colors.primary }}>
                  Briefing Dispatched
                </Text>
              </View>
            </View>

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                <Lock size={13} color={colors.textSecondary} />
                <Text style={{ fontSize: 11, color: colors.textSecondary }}>
                  Roster Locked
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => router.push('/(tabs)/roster')}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: radii.md,
                  backgroundColor: colors.surfaceMuted,
                }}
              >
                <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textPrimary }}>
                  View Confirmed Crew
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Shift Card 2: Mon 26 May */}
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
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#E11D48' }} />
                  <Text style={{ fontSize: 10, fontWeight: '800', color: '#E11D48', textTransform: 'uppercase' }}>
                    Mon 26 May
                  </Text>
                </View>
                <Text style={{ fontSize: 14, fontWeight: '700', color: colors.textPrimary, marginTop: 2 }}>
                  Production & Backstage Logistics
                </Text>
                <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 1 }}>
                  Dome SVP Stadium, Worli
                </Text>
              </View>
              <View
                style={{
                  paddingHorizontal: 8,
                  paddingVertical: 3,
                  borderRadius: radii.sm,
                  backgroundColor: '#FFE4E6',
                }}
              >
                <Text style={{ fontSize: 10, fontWeight: '800', color: '#E11D48' }}>
                  2/4 Confirmed
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
                  02:00 PM – 11:00 PM IST
                </Text>
              </View>
              <Text style={{ fontSize: 10, fontWeight: '800', color: '#E11D48' }}>
                02h 15m remaining
              </Text>
            </View>

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ fontSize: 11, color: colors.textSecondary }}>
                2 Selected workers pending confirmation
              </Text>
              <TouchableOpacity
                onPress={() => router.push('/(tabs)/roster')}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: radii.md,
                  backgroundColor: colors.primary,
                }}
              >
                <Text style={{ fontSize: 11, fontWeight: '700', color: '#FFFFFF' }}>
                  Nudge Workers
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Shift Card 3: Sun 25 May */}
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
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.textSecondary }} />
                  <Text style={{ fontSize: 10, fontWeight: '800', color: colors.textSecondary, textTransform: 'uppercase' }}>
                    Sun 25 May
                  </Text>
                </View>
                <Text style={{ fontSize: 14, fontWeight: '700', color: colors.textPrimary, marginTop: 2 }}>
                  Delegate Registration & Badge Desk
                </Text>
                <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 1 }}>
                  NESCO Grand Hall, Goregaon East
                </Text>
              </View>
              <View
                style={{
                  paddingHorizontal: 8,
                  paddingVertical: 3,
                  borderRadius: radii.sm,
                  backgroundColor: colors.surfaceMuted,
                }}
              >
                <Text style={{ fontSize: 10, fontWeight: '700', color: colors.textPrimary }}>
                  24 Applied / 8
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
                  08:30 AM – 05:30 PM IST
                </Text>
              </View>
              <View
                style={{
                  paddingHorizontal: 6,
                  paddingVertical: 2,
                  borderRadius: radii.sm,
                  backgroundColor: colors.surface,
                }}
              >
                <Text style={{ fontSize: 10, fontWeight: '700', color: colors.textSecondary }}>
                  16 New Profiles
                </Text>
              </View>
            </View>

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ fontSize: 11, color: colors.textSecondary }}>
                Daily payout: ₹2,400 / shift
              </Text>
              <TouchableOpacity
                onPress={() => router.push('/(tabs)/roster')}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: radii.md,
                  backgroundColor: colors.primary,
                }}
              >
                <Text style={{ fontSize: 11, fontWeight: '700', color: '#FFFFFF' }}>
                  Screen Applicants (24)
                </Text>
              </TouchableOpacity>
            </View>
          </View>
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
