import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  StyleSheet,
  Alert,
  TouchableOpacity,
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
import { Bell, MapPin } from 'lucide-react-native';

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
              {organizerProfile?.businessName || (organizerId ? 'My Organization' : 'Organizer details unavailable')}
            </Text>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
            <TouchableOpacity
              onPress={() => router.push('/notifications')}
              style={{
                backgroundColor: colors.surfaceMuted,
                borderRadius: radii.full,
                padding: spacing.xs + 2,
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

        {/* Real Metrics Grid */}
        <View style={styles.metricsGrid}>
          {/* Row 1 */}
          <View style={styles.metricsRow}>
            <View style={[styles.metricCard, { backgroundColor: colors.surfaceMuted, borderRadius: radii.md }]}>
              <Text style={styles.metricLabel}>Active Jobs</Text>
              <Text style={[styles.metricValue, { color: colors.textPrimary }]}>
                {metrics.activeJobs}
              </Text>
            </View>

            <View style={[styles.metricCard, { backgroundColor: colors.surfaceMuted, borderRadius: radii.md }]}>
              <Text style={styles.metricLabel}>Open Positions</Text>
              <Text style={[styles.metricValue, { color: colors.primary }]}>
                {metrics.openPositions}
              </Text>
            </View>

            <View style={[styles.metricCard, { backgroundColor: colors.surfaceMuted, borderRadius: radii.md }]}>
              <Text style={styles.metricLabel}>New Applicants</Text>
              <Text style={[styles.metricValue, { color: colors.warning }]}>
                {metrics.newApplications}
              </Text>
            </View>
          </View>

          {/* Row 2 */}
          <View style={[styles.metricsRow, { marginTop: 6 }]}>
            <View style={[styles.metricCard, { backgroundColor: colors.surfaceMuted, borderRadius: radii.md }]}>
              <Text style={styles.metricLabel}>Shortlisted</Text>
              <Text style={[styles.metricValue, { color: colors.info }]}>
                {metrics.shortlistedApplicants}
              </Text>
            </View>

            <View style={[styles.metricCard, { backgroundColor: colors.surfaceMuted, borderRadius: radii.md }]}>
              <Text style={styles.metricLabel}>Confirmed Crew</Text>
              <Text style={[styles.metricValue, { color: colors.success }]}>
                {metrics.confirmedWorkers}
              </Text>
            </View>

            <View style={[styles.metricCard, { backgroundColor: colors.surfaceMuted, borderRadius: radii.md }]}>
              <Text style={styles.metricLabel}>Staffing Spend</Text>
              <Text style={[styles.metricValue, { color: colors.textPrimary, fontSize: 15 }]}>
                {formatINR(metrics.totalStaffingSpend)}
              </Text>
            </View>
          </View>
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
            {shifts.length} total shifts
          </Text>
        </View>

        {loading ? (
          <View style={{ gap: spacing.md, marginTop: spacing.xs }}>
            <ShiftCardSkeleton />
            <ShiftCardSkeleton />
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
                onPress={() => router.push(`/shift/${shift.id}` as any)}
                style={{ borderRadius: radii.xl, padding: spacing.lg }}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <View style={{ flex: 1, marginRight: spacing.sm }}>
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
                  </View>

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
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  brandTitle: {
    fontSize: 13,
    fontWeight: '800',
    marginRight: 6,
    letterSpacing: 0.5,
  },
  metricsGrid: {
    marginTop: 12,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  metricCard: {
    flex: 1,
    padding: 10,
    alignItems: 'center',
  },
  metricLabel: {
    fontSize: 10,
    color: '#64748B',
    textTransform: 'uppercase',
    fontWeight: '600',
    textAlign: 'center',
  },
  metricValue: {
    fontSize: 18,
    fontWeight: '800',
    marginTop: 2,
  },
});
