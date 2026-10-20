import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  StyleSheet,
  TouchableOpacity,
  Pressable,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  useOpsklTheme,
  Button,
  ShiftCardSkeleton,
  useAuth,
  Screen,
  EmptyState,
  ErrorRetry,
  InlineBanner,
  MetricCard,
  StatusIndicator,
  OpsklAlert,
  Divider,
} from '@opskil/design-system';
import {
  Job,
  OrganizerMetrics,
  OrganizerProfile,
  formatINR,
  formatISTDate,
  fetchOrganizerJobs,
  fetchOrganizerMetrics,
  fetchOrganizerProfile,
  updateJobStatus,
} from '@opskil/shared';
import { Bell, MapPin, Calendar, Users, ArrowRight } from 'lucide-react-native';

type ShiftFilter = 'all' | 'open';

export default function OrganizerDashboardScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const { colors, spacing, radii, typography, touchTarget } = useOpsklTheme();

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
  const [shiftFilter, setShiftFilter] = useState<ShiftFilter>('all');

  const loadData = useCallback(async () => {
    if (!organizerId) {
      setOrganizerProfile(null);
      setShifts([]);
      setMetrics({
        activeJobs: 0,
        openPositions: 0,
        newApplications: 0,
        shortlistedApplicants: 0,
        confirmedWorkers: 0,
        upcomingEvents: 0,
        completedShifts: 0,
        totalStaffingSpend: 0,
      });
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
      setMetrics(metricsData);
    } catch (err: any) {
      console.error('Failed to load organizer data', err);
      setError(err?.message || 'Could not load organizer dashboard data.');
      setShifts([]);
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

  const handleTogglePause = async (shift: Job) => {
    const isPaused = shift.status === 'paused';
    const newStatus = isPaused ? 'open' : 'paused';

    const effectiveOrgId = organizerId || session?.user?.id;
    if (!effectiveOrgId) {
      OpsklAlert.alert('Authentication Required', 'Please sign in to manage shift status.');
      return;
    }
    const res = await updateJobStatus(shift.id, effectiveOrgId, newStatus);
    if (res.success) {
      setShifts((prev) =>
        prev.map((s) => (s.id === shift.id ? { ...s, status: newStatus } : s))
      );
      OpsklAlert.alert(
        isPaused ? 'Shift Resumed' : 'Shift Paused',
        isPaused
          ? 'Workers can now see and apply for this shift again.'
          : 'Shift has been paused from public marketplace discovery.'
      );
    } else {
      OpsklAlert.alert('Error', res.error || 'Failed to update shift status');
    }
  };

  const visibleShifts = useMemo(() => {
    if (shiftFilter === 'open') {
      return shifts.filter((s) => s.status !== 'paused' && s.slotsFilled < s.slotsTotal);
    }
    return shifts;
  }, [shifts, shiftFilter]);

  const statusTone = (status?: string): 'success' | 'warning' | 'neutral' | 'danger' => {
    if (status === 'verified') return 'success';
    if (status === 'pending') return 'warning';
    if (status === 'rejected') return 'danger';
    return 'neutral';
  };

  return (
    <Screen edges={['top']}>
      <View
        style={[
          styles.headerBar,
          {
            backgroundColor: colors.surface,
            borderBottomColor: colors.border,
            paddingHorizontal: spacing.lg,
            paddingTop: spacing.md,
            paddingBottom: spacing.md,
          },
        ]}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View style={{ flex: 1, marginRight: spacing.sm }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <Text style={[styles.brandTitle, { color: colors.primary }]}>OPSKL ORGANIZER</Text>
              {organizerProfile?.verificationStatus ? (
                <StatusIndicator
                  label={
                    organizerProfile.verificationStatus === 'verified'
                      ? 'Verified'
                      : organizerProfile.verificationStatus === 'pending'
                        ? 'Pending'
                        : organizerProfile.verificationStatus === 'rejected'
                          ? 'Rejected'
                          : 'Unverified'
                  }
                  tone={statusTone(organizerProfile.verificationStatus)}
                  size="sm"
                />
              ) : null}
            </View>
            <Text
              style={[typography.h2, { color: colors.textPrimary, marginTop: 4 }]}
              numberOfLines={2}
            >
              {organizerProfile?.businessName || (organizerId ? 'My Organization' : 'Guest Organizer')}
            </Text>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
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
                borderWidth: 1,
                borderColor: colors.border,
              }}
              accessibilityLabel="Open crew alerts"
              accessibilityRole="button"
            >
              <Bell size={18} color={colors.textPrimary} strokeWidth={2} />
            </TouchableOpacity>

            <Button
              title="+ Post Shift"
              variant="primary"
              size="sm"
              fullWidth={false}
              onPress={() => router.push('/(tabs)/create' as any)}
            />
          </View>
        </View>

        {!organizerId && (
          <InlineBanner
            variant="info"
            title="Sign in to manage shifts & crew"
            message="Use your organization account to review applications, confirm rosters, and approve attendance."
            style={{ marginTop: spacing.md }}
            actionLabel="Sign In"
            onAction={() => router.push('/auth/login?redirect=/(tabs)' as any)}
          />
        )}

        {organizerId && organizerProfile && organizerProfile.verificationStatus !== 'verified' && (
          <InlineBanner
            variant={organizerProfile.verificationStatus === 'pending' ? 'warning' : 'info'}
            title={
              organizerProfile.verificationStatus === 'pending'
                ? 'Verification under review'
                : 'Verification required to publish'
            }
            message={
              organizerProfile.verificationStatus === 'pending'
                ? 'Admin is reviewing your business verification. Live publishing unlocks once approved.'
                : 'Submit GSTIN under Profile to unlock live shift publishing. Drafts can still be saved.'
            }
            style={{ marginTop: spacing.md }}
            actionLabel="Profile"
            onAction={() => router.push('/(tabs)/profile' as any)}
          />
        )}

        {error ? (
          <View style={{ marginTop: spacing.md }}>
            <ErrorRetry
              title="Dashboard unavailable"
              message={error}
              onRetry={loadData}
            />
          </View>
        ) : null}

        {metrics.newApplications > 0 && !error && (
          <TouchableOpacity
            onPress={() => router.push('/(tabs)/roster' as any)}
            style={[
              styles.actionBanner,
              {
                backgroundColor: colors.surfaceMuted,
                borderColor: colors.border,
                borderRadius: radii.md,
                padding: spacing.md,
                marginTop: spacing.md,
                borderWidth: 1,
                minHeight: touchTarget.min,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Review pending candidate applications"
          >
            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Users size={18} color={colors.textPrimary} strokeWidth={2} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: colors.textPrimary }}>
                  {metrics.newApplications} Candidate Application
                  {metrics.newApplications === 1 ? '' : 's'} Waiting
                </Text>
                <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 1 }}>
                  Review qualifications and confirm bookings.
                </Text>
              </View>
            </View>
            <ArrowRight size={16} color={colors.textPrimary} strokeWidth={2} />
          </TouchableOpacity>
        )}

        {!error && (
          <View style={styles.metricsGrid}>
            <MetricCard
              label="New Applicants"
              value={metrics.newApplications}
              onPress={() => router.push('/(tabs)/roster' as any)}
              style={styles.metricHalf}
            />
            <MetricCard
              label="Confirmed Crew"
              value={metrics.confirmedWorkers}
              onPress={() => router.push('/(tabs)/roster' as any)}
              style={styles.metricHalf}
            />
            <MetricCard
              label="Open Positions"
              value={metrics.openPositions}
              subtitle={shiftFilter === 'open' ? 'Filtering open shifts' : 'Tap to filter list'}
              onPress={() => setShiftFilter((prev) => (prev === 'open' ? 'all' : 'open'))}
              style={styles.metricHalf}
            />
            <MetricCard
              label="Staffing Spend"
              value={formatINR(metrics.totalStaffingSpend)}
              onPress={() => router.push('/(tabs)/finances' as any)}
              style={styles.metricHalf}
            />
          </View>
        )}
      </View>

      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, flexGrow: 1 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={[typography.h3, { color: colors.textPrimary }]}>
            {shiftFilter === 'open' ? 'Open Positions' : 'Live Event Shifts'}
          </Text>
          <Text style={{ fontSize: 12, color: colors.textMuted }}>
            {visibleShifts.length} shift{visibleShifts.length === 1 ? '' : 's'}
            {shiftFilter === 'open' ? ' with openings' : ''}
          </Text>
        </View>

        {shiftFilter === 'open' && (
          <Button
            title="Show all shifts"
            variant="ghost"
            size="sm"
            fullWidth={false}
            onPress={() => setShiftFilter('all')}
          />
        )}

        {loading ? (
          <View style={{ gap: spacing.md, marginTop: spacing.xs }}>
            <ShiftCardSkeleton />
            <ShiftCardSkeleton />
          </View>
        ) : error ? null : visibleShifts.length === 0 ? (
          <EmptyState
            icon={<Calendar size={32} color={colors.textMuted} strokeWidth={1.8} />}
            title={
              shiftFilter === 'open'
                ? 'No open positions right now'
                : organizerId
                  ? 'Publish your first event shift'
                  : 'No shifts to preview'
            }
            description={
              shiftFilter === 'open'
                ? 'All listed shifts are full or paused. Clear the filter to see every shift.'
                : organizerId
                  ? 'Define venue, call time, and headcount. Verified Mumbai crew will see your posting when you publish.'
                  : 'Sign in to create and manage organization shifts.'
            }
            actionLabel={
              shiftFilter === 'open'
                ? 'Clear filter'
                : organizerId
                  ? '+ Create and Publish Shift'
                  : 'Sign In as Organizer'
            }
            onAction={() => {
              if (shiftFilter === 'open') {
                setShiftFilter('all');
              } else if (organizerId) {
                router.push('/(tabs)/create' as any);
              } else {
                router.push('/auth/login?redirect=/(tabs)/create' as any);
              }
            }}
          />
        ) : (
          visibleShifts.map((shift) => {
            const fillPercent = Math.min(
              100,
              Math.round((shift.slotsFilled / shift.slotsTotal) * 100)
            );
            const isFull = shift.slotsFilled >= shift.slotsTotal;
            const isPaused = shift.status === 'paused';

            let statusToneValue: 'success' | 'warning' | 'primary' | 'neutral' | 'danger' = 'primary';
            if (isFull) statusToneValue = 'success';
            else if (isPaused) statusToneValue = 'neutral';
            else if (shift.slotsFilled > 0) statusToneValue = 'warning';

            return (
              <View
                key={shift.id}
                style={{
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: radii.lg,
                  backgroundColor: colors.surface,
                  padding: spacing.lg,
                  gap: spacing.sm,
                }}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <Pressable
                    style={{ flex: 1, marginRight: spacing.sm }}
                    onPress={() => router.push(`/shift/${shift.id}` as any)}
                    accessibilityRole="link"
                  >
                    <Text
                      style={[typography.h3, { color: colors.textPrimary }]}
                      numberOfLines={2}
                    >
                      {shift.title}
                    </Text>
                    <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 4 }}>
                      {shift.category.toUpperCase()} • {formatINR(shift.hourlyRate)}/hr ({shift.durationHours}h)
                    </Text>
                    <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>
                      Est. pay / worker: {formatINR(shift.hourlyRate * shift.durationHours)}
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 }}>
                      <MapPin size={12} color={colors.primary} strokeWidth={2} />
                      <Text style={{ fontSize: 12, color: colors.textMuted, flex: 1 }} numberOfLines={2}>
                        {shift.venueName} • {formatISTDate(shift.date)}
                      </Text>
                    </View>
                  </Pressable>

                  <StatusIndicator
                    label={isPaused ? 'Paused' : `${shift.slotsFilled}/${shift.slotsTotal} filled`}
                    tone={statusToneValue}
                    size="sm"
                  />
                </View>

                <View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                    <Text style={{ fontSize: 11, color: colors.textMuted }}>Fulfillment</Text>
                    <Text
                      style={{
                        fontSize: 11,
                        fontWeight: '700',
                        color: isFull ? colors.success : colors.textPrimary,
                      }}
                    >
                      {fillPercent}% ({Math.max(0, shift.slotsTotal - shift.slotsFilled)} open)
                    </Text>
                  </View>
                  <View
                    style={{
                      height: 8,
                      backgroundColor: colors.surfaceMuted,
                      borderRadius: radii.full,
                      overflow: 'hidden',
                    }}
                  >
                    <View
                      style={{
                        height: '100%',
                        width: `${fillPercent}%`,
                        backgroundColor: isFull
                          ? colors.success
                          : isPaused
                            ? colors.textMuted
                            : colors.primary,
                        borderRadius: radii.full,
                      }}
                    />
                  </View>
                </View>

                <Divider />

                <View
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <Button
                    title={isPaused ? 'Resume Shift' : 'Pause Shift'}
                    variant="ghost"
                    size="sm"
                    fullWidth={false}
                    onPress={() => handleTogglePause(shift)}
                  />
                  <Button
                    title="Review Applicants"
                    variant="outline"
                    size="sm"
                    fullWidth={false}
                    onPress={() => router.push('/(tabs)/roster' as any)}
                  />
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerBar: {
    borderBottomWidth: 1,
  },
  brandTitle: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  actionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  metricsGrid: {
    marginTop: 14,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  metricHalf: {
    width: '47%',
    flexGrow: 1,
    minWidth: 140,
  },
});
