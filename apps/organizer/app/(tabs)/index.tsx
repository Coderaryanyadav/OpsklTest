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
  formatINR,
  formatISTDate,
  fetchOrganizerJobs,
  fetchOrganizerMetrics,
  updateJobStatus,
} from '@opskil/shared';

// Initial fallback shifts for Mumbai event productions demo
const SEED_ORGANIZER_SHIFTS: Job[] = [
  {
    id: 'org-shift-1',
    organizerId: 'org-apex-01',
    title: 'Registration Desk & VIP Usher',
    category: 'conference',
    venueName: 'Jio World Convention Centre',
    venueAddress: 'G Block BKC, Bandra East, Mumbai 400098',
    city: 'Mumbai',
    zone: 'Bandra Kurla Complex (BKC)',
    date: '2026-10-14',
    startTime: '08:30',
    endTime: '17:30',
    durationHours: 9,
    hourlyRate: 185,
    totalPay: 1665,
    slotsTotal: 12,
    slotsFilled: 8,
    duties: ['Scan delegate badges', 'Issue VIP lanyards'],
    supervisorName: 'Rohit Verma',
    supervisorPhone: '+91 98201 98201',
    status: 'filling',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'org-shift-2',
    organizerId: 'org-apex-01',
    title: 'Exhibition Booth Assistants',
    category: 'exhibition',
    venueName: 'Bombay Exhibition Centre (NESCO)',
    venueAddress: 'Western Express Highway, Goregaon East, Mumbai 400063',
    city: 'Mumbai',
    zone: 'Goregaon & NESCO',
    date: '2026-10-15',
    startTime: '09:00',
    endTime: '18:00',
    durationHours: 9,
    hourlyRate: 175,
    totalPay: 1575,
    slotsTotal: 6,
    slotsFilled: 5,
    duties: ['Distribute brochures', 'Register booth visitors'],
    supervisorName: 'Rohit Verma',
    supervisorPhone: '+91 98201 98201',
    status: 'filling',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'org-shift-3',
    organizerId: 'org-apex-01',
    title: 'Crowd & Queue Marshalls',
    category: 'activation',
    venueName: 'CIDCO Exhibition Centre',
    venueAddress: 'Sector 30A, Vashi, Navi Mumbai',
    city: 'Mumbai',
    zone: 'Navi Mumbai',
    date: '2026-10-16',
    startTime: '10:00',
    endTime: '19:00',
    durationHours: 9,
    hourlyRate: 160,
    totalPay: 1440,
    slotsTotal: 10,
    slotsFilled: 10,
    duties: ['Barricade line management', 'Direct entrance flow'],
    supervisorName: 'Pooja Mehta',
    supervisorPhone: '+91 98330 45678',
    status: 'filled',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

export default function OrganizerDashboardScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const { colors, spacing, radii, typography } = useOpsklTheme();

  const organizerId = session?.user?.id;

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

  const loadData = useCallback(async () => {
    if (!organizerId) {
      if (process.env.EXPO_PUBLIC_USE_DEMO_FIXTURES === 'true') {
        setShifts(SEED_ORGANIZER_SHIFTS);
        setMetrics({
          activeJobs: 3,
          openPositions: 5,
          newApplications: 17,
          shortlistedApplicants: 6,
          confirmedWorkers: 23,
          upcomingEvents: 3,
          completedShifts: 12,
          totalStaffingSpend: 38250,
        });
      } else {
        setShifts([]);
      }
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      const [jobsData, metricsData] = await Promise.all([
        fetchOrganizerJobs(organizerId),
        fetchOrganizerMetrics(organizerId),
      ]);

      if (jobsData.length > 0) {
        setShifts(jobsData);
      } else if (process.env.EXPO_PUBLIC_USE_DEMO_FIXTURES === 'true') {
        setShifts(SEED_ORGANIZER_SHIFTS);
      } else {
        setShifts([]);
      }

      setMetrics(metricsData);
    } catch (err) {
      console.error('Failed to load organizer data', err);
      if (process.env.EXPO_PUBLIC_USE_DEMO_FIXTURES === 'true') {
        setShifts(SEED_ORGANIZER_SHIFTS);
      } else {
        setShifts([]);
      }
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

    const effectiveOrgId = organizerId || session?.user?.id || 'org-apex-01';
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
          <View>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={[styles.brandTitle, { color: colors.primary }]}>
                OPSKL ORGANIZER
              </Text>
              <Badge label="VERIFIED ORG" variant="success" size="sm" />
            </View>
            <Text style={[typography.h2, { color: colors.textPrimary, marginTop: 2 }]}>
              Apex Event Productions
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
              <Text style={{ fontSize: 16 }}>🔔</Text>
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
                    <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>
                      📍 {shift.venueName} • {formatISTDate(shift.date)}
                    </Text>
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
                    title={isPaused ? '▶ Resume' : '⏸ Pause'}
                    variant="ghost"
                    size="sm"
                    fullWidth={false}
                    onPress={() => handleTogglePause(shift)}
                  />

                  <Button
                    title="Review Applicants →"
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
