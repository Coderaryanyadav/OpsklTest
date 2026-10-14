import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  Pressable,
  Alert,
  StyleSheet,
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
  JobApplication,
  formatINR,
  fetchOrganizerApplications,
  confirmWorkerBookingSafe,
  updateApplicationStatusSafe,
} from '@opskil/shared';
import { ClipboardList, Phone, MapPin, AlertTriangle } from 'lucide-react-native';

type FilterTab = 'all' | 'applied' | 'shortlisted' | 'confirmed' | 'rejected';

export default function OrganizerRosterScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const { colors, spacing, radii, typography, isDark } = useOpsklTheme();

  const [applications, setApplications] = useState<JobApplication[]>([]);
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);

  const organizerId = session?.user?.id;

  const loadApplications = useCallback(async () => {
    if (!organizerId) {
      setApplications([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      setError(null);
      const data = await fetchOrganizerApplications(organizerId);
      setApplications(data || []);
    } catch (err: any) {
      console.error('Failed to load applications', err);
      setError(err?.message || 'Could not load applicant roster.');
      setApplications([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [organizerId]);

  useEffect(() => {
    loadApplications();
  }, [loadApplications]);

  const onRefresh = () => {
    setRefreshing(true);
    loadApplications();
  };

  const effectiveOrgId = organizerId || session?.user?.id;

  /**
   * Shortlist Applicant
   */
  const handleShortlist = async (app: JobApplication) => {
    if (!effectiveOrgId) {
      Alert.alert('Authentication Required', 'Please sign in with an organizer account.');
      return;
    }
    setActionInProgress(app.id);
    const res = await updateApplicationStatusSafe(app.id, 'shortlisted', effectiveOrgId);
    setActionInProgress(null);

    if (res.success) {
      setApplications((prev) =>
        prev.map((a) => (a.id === app.id ? { ...a, status: 'shortlisted' } : a))
      );
      Alert.alert(
        'Candidate Shortlisted',
        `${app.worker?.profile?.fullName || 'Worker'} has been shortlisted. A notification was sent to their Opskl app.`
      );
    } else {
      Alert.alert('Error', res.error || 'Failed to shortlist candidate');
    }
  };

  /**
   * Reject Applicant
   */
  const handleReject = async (app: JobApplication) => {
    if (!effectiveOrgId) {
      Alert.alert('Authentication Required', 'Please sign in with an organizer account.');
      return;
    }
    Alert.alert(
      'Decline Application',
      `Are you sure you want to pass on ${app.worker?.profile?.fullName || 'this applicant'}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Decline',
          style: 'destructive',
          onPress: async () => {
            setActionInProgress(app.id);
            const res = await updateApplicationStatusSafe(app.id, 'rejected', effectiveOrgId);
            setActionInProgress(null);

            if (res.success) {
              setApplications((prev) =>
                prev.map((a) => (a.id === app.id ? { ...a, status: 'rejected' } : a))
              );
            } else {
              Alert.alert('Error', res.error || 'Failed to update application');
            }
          },
        },
      ]
    );
  };

  /**
   * Select Candidate / Confirm Booking (Enforces Headcount & Audit Trail)
   */
  const handleConfirmBooking = async (app: JobApplication) => {
    if (!effectiveOrgId) {
      Alert.alert('Authentication Required', 'Please sign in with an organizer account.');
      return;
    }
    const workerName = app.worker?.profile?.fullName || 'the candidate';
    const shiftTitle = app.job?.title || 'the shift';

    Alert.alert(
      'Confirm Booking',
      `Confirm ${workerName} for ${shiftTitle}?\n\nThis locks in the booking, reserves a spot against your headcount limit, and sends an official confirmation to the worker.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm & Hire',
          onPress: async () => {
            setActionInProgress(app.id);
            const res = await confirmWorkerBookingSafe(
              app.jobId,
              app.workerId,
              effectiveOrgId
            );
            setActionInProgress(null);

            if (res.success) {
              setApplications((prev) =>
                prev.map((a) =>
                  a.id === app.id
                    ? {
                        ...a,
                        status: 'confirmed',
                        job: a.job
                          ? { ...a.job, slotsFilled: (a.job.slotsFilled || 0) + 1 }
                          : a.job,
                      }
                    : a
                )
              );
              Alert.alert(
                'Booking Confirmed',
                `${workerName} has been officially booked for ${shiftTitle}. Check-in QR pass has been issued to the worker.`
              );
            } else {
              Alert.alert('Booking Unsuccessful', res.error || 'Could not complete booking.');
            }
          },
        },
      ]
    );
  };

  /**
   * Send Reporting Brief
   */
  const handleSendBrief = (app: JobApplication) => {
    const brief = app.job?.reportingInstructions || 'Report to main venue registration desk 30 mins prior to shift.';
    Alert.alert(
      'Reporting Briefing',
      `Reporting instructions for ${app.worker?.profile?.fullName}:\n\n"${brief}"\n\nInstructions are visible on the worker's shift ticket.`
    );
  };

  const filtered = applications.filter((app) => {
    if (activeTab === 'all') return true;
    return app.status === activeTab;
  });

  const appliedCount = applications.filter((a) => a.status === 'applied').length;
  const shortlistedCount = applications.filter((a) => a.status === 'shortlisted').length;
  const confirmedCount = applications.filter((a) => a.status === 'confirmed').length;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      {/* Top Header */}
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
          Applicant Review & Roster
        </Text>
        <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 4, lineHeight: 18 }}>
          Review verified candidate profiles and explicitly confirm hires
        </Text>

        {/* Filter Tabs */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, marginTop: 14, paddingRight: 20 }}
        >
          {(
            [
              { key: 'all', label: `All (${applications.length})` },
              { key: 'applied', label: `New Applied (${appliedCount})` },
              { key: 'shortlisted', label: `Shortlisted (${shortlistedCount})` },
              { key: 'confirmed', label: `Confirmed (${confirmedCount})` },
              { key: 'rejected', label: 'Declined' },
            ] as const
          ).map((tab) => {
            const isSelected = activeTab === tab.key;
            return (
              <Pressable
                key={tab.key}
                onPress={() => setActiveTab(tab.key)}
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

      {/* Applications Feed */}
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {loading ? (
          <View style={{ gap: spacing.md }}>
            <ShiftCardSkeleton />
            <ShiftCardSkeleton />
          </View>
        ) : error ? (
          <View style={{ padding: 40, alignItems: 'center' }}>
            <AlertTriangle size={32} color={colors.danger} strokeWidth={2} />
            <Text style={[typography.h3, { color: colors.textPrimary, marginTop: 12 }]}>
              Unable to Load Roster
            </Text>
            <Text style={{ fontSize: 13, color: colors.textSecondary, textAlign: 'center', marginTop: 4 }}>
              {error}
            </Text>
            <View style={{ marginTop: spacing.md }}>
              <Button title="Retry Connection" variant="primary" size="md" onPress={onRefresh} />
            </View>
          </View>
        ) : !organizerId ? (
          <View
            style={[
              styles.emptyCard,
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
                styles.emptyIconCircle,
                {
                  backgroundColor: colors.surfaceMuted,
                  borderRadius: radii.full,
                },
              ]}
            >
              <ClipboardList size={28} color={colors.textPrimary} strokeWidth={1.8} />
            </View>

            <Text
              style={[
                typography.h3,
                {
                  color: colors.textPrimary,
                  marginTop: spacing.md,
                  textAlign: 'center',
                  fontWeight: '700',
                  letterSpacing: -0.3,
                },
              ]}
            >
              Sign In to View Applicant Roster
            </Text>

            <Text
              style={{
                fontSize: 13,
                color: colors.textSecondary,
                textAlign: 'center',
                marginTop: 6,
                lineHeight: 20,
                maxWidth: 290,
              }}
            >
              Sign in with your verified organizer account to review candidate applications, verify worker qualifications, and confirm crew rosters.
            </Text>

            <View style={{ marginTop: spacing.xl, width: '100%', gap: 10 }}>
              <Button
                title="Sign In as Organizer"
                variant="primary"
                size="md"
                onPress={() => router.push('/auth/login?redirect=/(tabs)/roster' as any)}
              />
            </View>
          </View>
        ) : filtered.length === 0 ? (
          <View
            style={[
              styles.emptyCard,
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
                styles.emptyIconCircle,
                {
                  backgroundColor: colors.surfaceMuted,
                  borderRadius: radii.full,
                },
              ]}
            >
              <ClipboardList size={28} color={colors.textPrimary} strokeWidth={1.8} />
            </View>

            <Text
              style={[
                typography.h3,
                {
                  color: colors.textPrimary,
                  marginTop: spacing.md,
                  textAlign: 'center',
                  fontWeight: '700',
                  letterSpacing: -0.3,
                },
              ]}
            >
              {activeTab === 'all'
                ? 'No Candidate Applications Yet'
                : `No ${activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} Applicants`}
            </Text>

            <Text
              style={{
                fontSize: 13,
                color: colors.textSecondary,
                textAlign: 'center',
                marginTop: 6,
                lineHeight: 20,
                maxWidth: 290,
              }}
            >
              {activeTab === 'all'
                ? 'When verified workers discover and apply for your published shifts, their profiles, qualifications, and attendance records will appear here for review and confirmation.'
                : `There are currently no worker applications under the "${activeTab}" status category.`}
            </Text>

            <View style={{ marginTop: spacing.xl, width: '100%', gap: 10 }}>
              {activeTab === 'all' ? (
                <>
                  <Button
                    title="+ Post a New Shift"
                    variant="primary"
                    size="md"
                    onPress={() => router.push('/(tabs)/create' as any)}
                  />
                  <Button
                    title="View Published Shifts"
                    variant="outline"
                    size="md"
                    onPress={() => router.push('/(tabs)' as any)}
                  />
                </>
              ) : (
                <Button
                  title="View All Applications"
                  variant="outline"
                  size="md"
                  onPress={() => setActiveTab('all')}
                />
              )}
            </View>
          </View>
        ) : (
          filtered.map((app) => {
            const worker = app.worker;
            const profile = worker?.profile;
            const job = app.job;

            const isVerified = worker?.verificationStatus === 'verified';
            const isConfirmed = app.status === 'confirmed';
            const isShortlisted = app.status === 'shortlisted';
            const isRejected = app.status === 'rejected';
            const isActionBusy = actionInProgress === app.id;

            const slotsRemaining = job ? Math.max(0, job.slotsTotal - (job.slotsFilled || 0)) : 0;

            return (
              <Card
                key={app.id}
                variant="elevated"
                style={{ borderRadius: radii.xl, padding: spacing.lg }}
              >
                {/* Top Profile Bar */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <View style={{ flexDirection: 'row', gap: 12, flex: 1 }}>
                    <View
                      style={[
                        styles.avatarCircle,
                        { backgroundColor: isDark ? '#262626' : '#F5F5F5', borderRadius: radii.full },
                      ]}
                    >
                      <Text style={[styles.avatarText, { color: colors.textPrimary }]}>
                        {profile?.fullName ? profile.fullName.slice(0, 2).toUpperCase() : 'WK'}
                      </Text>
                    </View>

                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <Text style={[typography.h3, { color: colors.textPrimary }]}>
                          {profile?.fullName || 'Opskl Candidate'}
                        </Text>
                        {isVerified && (
                          <Badge label="ID VERIFIED" variant="neutral" size="sm" />
                        )}
                      </View>

                      <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>
                        ★ {worker?.rating?.toFixed(1) || '5.0'} • {worker?.shiftsCompleted || 0} Shifts Completed • {worker?.preferredLocality || 'Mumbai'}
                      </Text>

                      {isConfirmed && profile?.phone && (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
                          <Phone size={12} color={colors.primary} strokeWidth={2} />
                          <Text style={{ fontSize: 12, color: colors.primary, fontWeight: '600' }}>
                            {profile.phone}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>

                  <Badge
                    label={app.status.toUpperCase()}
                    variant="neutral"
                    size="sm"
                  />
                </View>

                {/* Applied Shift Details */}
                {job && (
                  <View
                    style={[
                      styles.shiftBanner,
                      { backgroundColor: colors.surfaceMuted, borderRadius: radii.md, marginTop: spacing.md },
                    ]}
                  >
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text style={{ fontSize: 13, fontWeight: '700', color: colors.textPrimary }}>
                        {job.title}
                      </Text>
                      <Text style={{ fontSize: 12, fontWeight: '700', color: colors.primary }}>
                        {formatINR(job.totalPay)}
                      </Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
                      <MapPin size={11} color={colors.textMuted} strokeWidth={2} />
                      <Text style={{ fontSize: 11, color: colors.textMuted }}>
                        {job.venueName} • Openings: {slotsRemaining} of {job.slotsTotal} left
                      </Text>
                    </View>
                  </View>
                )}

                {/* Notes if provided */}
                {app.notes && (
                  <Text style={{ fontSize: 12, color: colors.textSecondary, fontStyle: 'italic', marginTop: spacing.sm }}>
                    "{app.notes}"
                  </Text>
                )}

                {/* Skills Chips */}
                {worker?.skills && worker.skills.length > 0 && (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: spacing.md }}>
                    {worker.skills.map((skill, idx) => (
                      <View
                        key={idx}
                        style={[
                          styles.skillPill,
                          {
                            backgroundColor: isDark ? '#262626' : '#F5F5F5',
                            borderColor: colors.border,
                            borderRadius: radii.full,
                          },
                        ]}
                      >
                        <Text style={{ fontSize: 11, color: colors.textSecondary }}>{skill}</Text>
                      </View>
                    ))}
                  </View>
                )}

                {/* Action Buttons */}
                <View
                  style={{
                    flexDirection: 'row',
                    gap: 8,
                    marginTop: spacing.md,
                    paddingTop: spacing.sm,
                    borderTopWidth: 1,
                    borderTopColor: colors.border,
                  }}
                >
                  {isConfirmed ? (
                    <View style={{ flex: 1, flexDirection: 'row', gap: 8 }}>
                      <View style={{ flex: 1 }}>
                        <Button
                          title="Booked & Confirmed"
                          variant="secondary"
                          size="sm"
                          disabled={true}
                          onPress={() => {}}
                        />
                      </View>
                      <Button
                        title="Send Briefing"
                        variant="outline"
                        size="sm"
                        fullWidth={false}
                        onPress={() => handleSendBrief(app)}
                      />
                    </View>
                  ) : isRejected ? (
                    <Text style={{ fontSize: 12, color: colors.danger, fontWeight: '600' }}>
                      Application Declined
                    </Text>
                  ) : (
                    <>
                      <Button
                        title="Decline"
                        variant="ghost"
                        size="sm"
                        fullWidth={false}
                        loading={isActionBusy}
                        onPress={() => handleReject(app)}
                      />

                      {!isShortlisted && (
                        <Button
                          title="Shortlist"
                          variant="outline"
                          size="sm"
                          fullWidth={false}
                          loading={isActionBusy}
                          onPress={() => handleShortlist(app)}
                        />
                      )}

                      <View style={{ flex: 1 }}>
                        <Button
                          title={slotsRemaining === 0 ? 'Full' : 'Confirm & Book'}
                          variant="primary"
                          size="sm"
                          disabled={slotsRemaining === 0}
                          loading={isActionBusy}
                          onPress={() => handleConfirmBooking(app)}
                        />
                      </View>
                    </>
                  )}
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
  emptyCard: {
    borderWidth: 1,
    alignItems: 'center',
    marginVertical: 12,
  },
  emptyIconCircle: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarCircle: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 15,
    fontWeight: '800',
  },
  shiftBanner: {
    padding: 10,
  },
  skillPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
  },
});

