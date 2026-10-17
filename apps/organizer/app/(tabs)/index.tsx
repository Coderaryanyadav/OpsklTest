import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  StyleSheet,
  Alert,
  TouchableOpacity,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  useOpsklTheme,
  Card,
  Badge,
  Button,
  ShiftCardSkeleton,
  useAuth,
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

export default function OrganizerDashboardScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const { colors, spacing, radii, typography } = useOpsklTheme();

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
      // Never silently mask a production database/RLS failure into demo fixtures
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
      Alert.alert('Authentication Required', 'Please sign in to manage shift status.');
      return;
    }
    const res = await updateJobStatus(shift.id, effectiveOrgId, newStatus);
    if (res.success) {
      setShifts((prev) =>
        prev.map((s) => (s.id === shift.id ? { ...s, status: newStatus } : s))
      );
      Alert.alert(
        isPaused ? 'Shift Resumed' : 'Shift Paused',
        isPaused
          ? 'Workers can now see and apply for this shift again.'
          : 'Shift has been paused from public marketplace discovery.'
      );
    } else {
      Alert.alert('Error', res.error || 'Failed to update shift status');
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      {/* Top Header */}
      <View
        style={[
          styles.headerBar,
          {
            backgroundColor: colors.surface,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View style={{ flex: 1, marginRight: spacing.sm }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={[styles.brandTitle, { color: colors.primary }]}>
                OPSKL ORGANIZER
              </Text>
              {organizerProfile?.verificationStatus === 'verified' ? (
                <Badge label="VERIFIED ORG" variant="success" size="sm" />
              ) : organizerProfile?.verificationStatus === 'pending' ? (
                <Badge label="VERIFICATION PENDING" variant="warning" size="sm" />
              ) : organizerProfile?.verificationStatus === 'unverified' ? (
                <Badge label="UNVERIFIED" variant="neutral" size="sm" />
              ) : null}
            </View>
            <Text style={[typography.h2, { color: colors.textPrimary, marginTop: 2 }]} numberOfLines={1}>
              {organizerProfile?.businessName || (organizerId ? 'My Organization' : 'Guest Organizer')}
            </Text>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
            <TouchableOpacity
              onPress={() => router.push('/notifications')}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={{
                width: 44,
                height: 44,
                minWidth: 44,
                minHeight: 44,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: colors.surfaceMuted,
                borderRadius: radii.full,
                borderWidth: 1,
                borderColor: colors.border,
              }}
              accessibilityLabel="Open crew alerts"
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

        {/* Guest Organizer Mode Banner */}
        {!organizerId && (
          <Card
            variant="elevated"
            style={{
              marginTop: spacing.md,
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderWidth: 1,
              borderRadius: radii.md,
              padding: spacing.md,
            }}
          >
            <Text style={[typography.subtitle, { color: colors.textPrimary, fontWeight: '700' }]}>
              Sign In to Manage Shifts & Crew
            </Text>
            <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 4, lineHeight: 18 }}>
              Sign in with your organization account to review candidate applications, confirm shift rosters, and manage supervisor attendance sign-offs.
            </Text>
            <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md }}>
              <Button
                title="Sign In as Organizer"
                variant="primary"
                size="sm"
                fullWidth={false}
                onPress={() => router.push('/auth/login?redirect=/(tabs)' as any)}
              />
              <Button
                title="Create a Shift"
                variant="outline"
                size="sm"
                fullWidth={false}
                onPress={() => router.push('/(tabs)/create' as any)}
              />
            </View>
          </Card>
        )}

        {/* Organizer Verification Status Banner */}
        {organizerId && organizerProfile && organizerProfile.verificationStatus !== 'verified' && (
          <View
            style={{
              marginTop: spacing.md,
              backgroundColor: colors.surfaceMuted,
              paddingHorizontal: spacing.md,
              paddingVertical: 10,
              borderRadius: radii.md,
              borderWidth: 1,
              borderColor: colors.border,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 10,
            }}
          >
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                <Badge
                  label={organizerProfile.verificationStatus === 'pending' ? 'KYC PENDING APPROVAL' : 'VERIFICATION REQUIRED'}
                  variant={organizerProfile.verificationStatus === 'pending' ? 'neutral' : 'warning'}
                  size="sm"
                />
              </View>
              <Text style={{ fontSize: 12, color: colors.textSecondary, lineHeight: 17 }}>
                {organizerProfile.verificationStatus === 'pending'
                  ? 'Your business verification is currently under review by Admin. Shift publishing will unlock once approved.'
                  : 'Submit your business GSTIN and registration documents under Profile to unlock live shift publishing.'}
              </Text>
            </View>
            <Button
              title="Profile"
              variant="outline"
              size="sm"
              fullWidth={false}
              onPress={() => router.push('/(tabs)/profile' as any)}
            />
          </View>
        )}

        {error && (
          <View
            style={{
              marginTop: spacing.md,
              padding: spacing.sm,
              backgroundColor: colors.surfaceMuted,
              borderRadius: radii.md,
              borderWidth: 1,
              borderColor: colors.danger,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <Text style={{ fontSize: 13, color: colors.danger, flex: 1, marginRight: spacing.sm }}>
              ⚠️ {error}
            </Text>
            <Button title="Retry" variant="outline" size="sm" onPress={loadData} fullWidth={false} />
          </View>
        )}

        {/* Actionable Operational Task Banner */}
        {metrics.newApplications > 0 && (
          <TouchableOpacity
            onPress={() => router.push('/(tabs)/roster' as any)}
            style={[
              styles.actionBanner,
              {
                backgroundColor: colors.surfaceMuted,
                borderColor: colors.border,
                borderRadius: radii.md,
                padding: spacing.sm + 4,
                marginTop: spacing.md,
                borderWidth: 1,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Review pending candidate applications"
          >
            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Users size={18} color={colors.textPrimary} strokeWidth={2} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: colors.textPrimary }}>
                  {metrics.newApplications} Candidate Application{metrics.newApplications === 1 ? '' : 's'} Waiting
                </Text>
                <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 1 }}>
                  Review qualifications, verified experience, and confirm bookings.
                </Text>
              </View>
            </View>
            <ArrowRight size={16} color={colors.textPrimary} strokeWidth={2} />
          </TouchableOpacity>
        )}

        {/* Operational Overview 2-Column Responsive KPI Grid */}
        <View style={styles.metricsGrid}>
          <TouchableOpacity
            onPress={() => router.push('/(tabs)/roster' as any)}
            style={[
              styles.metricCard,
              {
                backgroundColor: colors.surfaceTertiary,
                borderColor: colors.border,
                borderWidth: 1,
                borderRadius: radii.md,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel="View applicant roster"
          >
            <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>New Applicants</Text>
            <Text style={[styles.metricValue, { color: colors.textPrimary }]}>
              {metrics.newApplications}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => router.push('/(tabs)/roster' as any)}
            style={[
              styles.metricCard,
              {
                backgroundColor: colors.surfaceTertiary,
                borderColor: colors.border,
                borderWidth: 1,
                borderRadius: radii.md,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel="View confirmed crew"
          >
            <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>Confirmed Crew</Text>
            <Text style={[styles.metricValue, { color: colors.textPrimary }]}>
              {metrics.confirmedWorkers}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => {}}
            style={[
              styles.metricCard,
              {
                backgroundColor: colors.surfaceTertiary,
                borderColor: colors.border,
                borderWidth: 1,
                borderRadius: radii.md,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel="View open positions"
          >
            <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>Open Positions</Text>
            <Text style={[styles.metricValue, { color: colors.textPrimary }]}>
              {metrics.openPositions}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => router.push('/(tabs)/finances' as any)}
            style={[
              styles.metricCard,
              {
                backgroundColor: colors.surfaceTertiary,
                borderColor: colors.border,
                borderWidth: 1,
                borderRadius: radii.md,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel="View staffing spend and finances"
          >
            <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>Staffing Spend</Text>
            <Text style={[styles.metricValue, { color: colors.textPrimary }]}>
              {formatINR(metrics.totalStaffingSpend)}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Main Shift Listings Feed */}
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={[typography.h3, { color: colors.textPrimary }]}>Live Event Shifts</Text>
          <Text style={{ fontSize: 12, color: colors.textMuted }}>
            {shifts.length} active shift{shifts.length === 1 ? '' : 's'}
          </Text>
        </View>

        {loading ? (
          <View style={{ gap: spacing.md, marginTop: spacing.xs }}>
            <ShiftCardSkeleton />
            <ShiftCardSkeleton />
          </View>
        ) : shifts.length === 0 ? (
          /* First-Shift Onboarding State */
          <View
            style={[
              styles.onboardingCard,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                borderRadius: radii.xl,
                padding: spacing.xl,
              },
            ]}
          >
            <View
              style={[
                styles.onboardingIconWrap,
                {
                  backgroundColor: colors.surfaceMuted,
                  borderRadius: radii.full,
                },
              ]}
            >
              <Calendar size={32} color={colors.textPrimary} strokeWidth={1.8} />
            </View>

            <Text
              style={[
                typography.h3,
                {
                  color: colors.textPrimary,
                  marginTop: spacing.md,
                  textAlign: 'center',
                  fontWeight: '700',
                },
              ]}
            >
              Publish Your First Event Shift
            </Text>

            <Text
              style={{
                fontSize: 13,
                color: colors.textSecondary,
                textAlign: 'center',
                marginTop: 6,
                lineHeight: 20,
                maxWidth: 300,
              }}
            >
              Define your venue, call time, and crew headcount in 5 simple steps. Pre-screened event crew in Mumbai will receive instant shift notifications.
            </Text>

            <View style={{ width: '100%', marginTop: spacing.xl, gap: 10 }}>
              <Button
                title="+ Create and Publish Shift"
                variant="primary"
                size="lg"
                onPress={() => router.push('/(tabs)/create' as any)}
              />
              <Button
                title="View Organization Profile"
                variant="outline"
                size="md"
                onPress={() => router.push('/(tabs)/profile' as any)}
              />
            </View>
          </View>
        ) : (
          shifts.map((shift) => {
            const fillPercent = Math.min(
              100,
              Math.round((shift.slotsFilled / shift.slotsTotal) * 100)
            );
            const isFull = shift.slotsFilled >= shift.slotsTotal;
            const isPaused = shift.status === 'paused';

            let statusVariant: 'success' | 'warning' | 'primary' | 'neutral' | 'danger' = 'primary';
            if (isFull) statusVariant = 'success';
            else if (isPaused) statusVariant = 'neutral';
            else if (shift.slotsFilled > 0) statusVariant = 'warning';

            return (
              <Card
                key={shift.id}
                variant="elevated"
                style={{ borderRadius: radii.xl, padding: spacing.lg }}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <Pressable
                    style={{ flex: 1, marginRight: spacing.sm }}
                    onPress={() => router.push(`/shift/${shift.id}` as any)}
                    accessibilityRole="link"
                  >
                    <Text style={[typography.h3, { color: colors.textPrimary }]} numberOfLines={1}>
                      {shift.title}
                    </Text>
                    <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 2 }}>
                      {shift.category.toUpperCase()} • {formatINR(shift.hourlyRate)}/hr ({shift.durationHours}h)
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
                      <MapPin size={12} color={colors.primary} strokeWidth={2} />
                      <Text style={{ fontSize: 12, color: colors.textMuted }}>
                        {shift.venueName} • {formatISTDate(shift.date)}
                      </Text>
                    </View>
                  </Pressable>

                  <Badge
                    label={isPaused ? 'PAUSED' : `${shift.slotsFilled}/${shift.slotsTotal} FILLED`}
                    variant={statusVariant}
                    size="sm"
                  />
                </View>

                {/* Fulfillment Progress Bar */}
                <View style={{ marginTop: spacing.md }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                    <Text style={{ fontSize: 11, color: colors.textMuted }}>Fulfillment</Text>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: isFull ? colors.success : colors.textPrimary }}>
                      {fillPercent}% ({shift.slotsTotal - shift.slotsFilled} open)
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
                        backgroundColor: isFull ? colors.success : isPaused ? colors.textMuted : colors.primary,
                        borderRadius: radii.full,
                      }}
                    />
                  </View>
                </View>

                {/* Bottom Actions Row */}
                <View
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginTop: spacing.md,
                    paddingTop: spacing.sm,
                    borderTopWidth: 1,
                    borderTopColor: colors.border,
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
              </Card>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  headerBar: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  brandTitle: {
    fontSize: 13,
    fontWeight: '800',
    marginRight: 6,
    letterSpacing: 0.5,
  },
  actionBanner: {
    marginVertical: 4,
  },
  metricsGrid: {
    marginTop: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  metricCard: {
    width: '48%',
    flexGrow: 1,
    padding: 10,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  metricLabel: {
    fontSize: 10,
    textTransform: 'uppercase',
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  metricValue: {
    fontSize: 18,
    fontWeight: '800',
    marginTop: 3,
  },
  onboardingCard: {
    borderWidth: 1,
    alignItems: 'center',
    marginVertical: 12,
  },
  onboardingIconWrap: {
    width: 60,
    height: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
