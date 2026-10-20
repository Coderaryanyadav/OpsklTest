import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  useOpsklTheme,
  Button,
  ShiftCardSkeleton,
  useAuth,
  OpsklAlert,
  Screen,
  FilterPills,
  StatusIndicator,
  ErrorRetry,
  EmptyState,
  SearchInput,
  Divider,
} from '@opskil/design-system';
import {
  JobApplication,
  formatINR,
  fetchOrganizerApplications,
  confirmWorkerBookingSafe,
  updateApplicationStatusSafe,
  subscribeToOrganizerRoster,
} from '@opskil/shared';
import { ClipboardList, Phone, MapPin } from 'lucide-react-native';

type FilterTab = 'all' | 'applied' | 'shortlisted' | 'confirmed' | 'rejected';

function formatWorkerRating(rating?: number | null): string {
  if (rating == null || Number.isNaN(rating) || rating <= 0) {
    return 'New';
  }
  return rating.toFixed(1);
}

function statusTone(status: string): 'success' | 'warning' | 'danger' | 'neutral' | 'info' | 'primary' {
  switch (status) {
    case 'confirmed':
      return 'success';
    case 'shortlisted':
      return 'info';
    case 'applied':
      return 'warning';
    case 'rejected':
      return 'danger';
    default:
      return 'neutral';
  }
}

export default function OrganizerRosterScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const { colors, spacing, radii, typography } = useOpsklTheme();

  const [applications, setApplications] = useState<JobApplication[]>([]);
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [searchQuery, setSearchQuery] = useState('');
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
      setError(null);
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

    if (!organizerId) return;

    const unsubscribe = subscribeToOrganizerRoster(organizerId, () => {
      loadApplications();
    });

    return () => {
      unsubscribe();
    };
  }, [loadApplications, organizerId]);

  const onRefresh = () => {
    setRefreshing(true);
    loadApplications();
  };

  const effectiveOrgId = organizerId || session?.user?.id;

  const handleShortlist = async (app: JobApplication) => {
    if (!effectiveOrgId) {
      OpsklAlert.alert('Authentication Required', 'Please sign in with an organizer account.');
      return;
    }
    setActionInProgress(app.id);
    const res = await updateApplicationStatusSafe(app.id, 'shortlisted', effectiveOrgId);
    setActionInProgress(null);

    if (res.success) {
      setApplications((prev) =>
        prev.map((a) => (a.id === app.id ? { ...a, status: 'shortlisted' } : a))
      );
      OpsklAlert.alert(
        'Candidate Shortlisted',
        `${app.worker?.profile?.fullName || 'Worker'} has been shortlisted.`
      );
    } else {
      OpsklAlert.alert('Error', res.error || 'Failed to shortlist candidate');
    }
  };

  const handleReject = async (app: JobApplication) => {
    if (!effectiveOrgId) {
      OpsklAlert.alert('Authentication Required', 'Please sign in with an organizer account.');
      return;
    }
    OpsklAlert.alert(
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
              OpsklAlert.alert('Error', res.error || 'Failed to update application');
            }
          },
        },
      ]
    );
  };

  const handleConfirmBooking = async (app: JobApplication) => {
    if (!effectiveOrgId) {
      OpsklAlert.alert('Authentication Required', 'Please sign in with an organizer account.');
      return;
    }
    const workerName = app.worker?.profile?.fullName || 'the candidate';
    const shiftTitle = app.job?.title || 'the shift';

    OpsklAlert.alert(
      'Confirm Booking',
      `Confirm ${workerName} for ${shiftTitle}?\n\nThis locks the booking, reserves a headcount slot, and notifies the worker.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm & Hire',
          onPress: async () => {
            setActionInProgress(app.id);
            const res = await confirmWorkerBookingSafe(app.jobId, app.workerId, effectiveOrgId);
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
              OpsklAlert.alert(
                'Booking Confirmed',
                `${workerName} has been booked for ${shiftTitle}. An attendance pass code was issued to their app.`
              );
            } else {
              OpsklAlert.alert('Booking Unsuccessful', res.error || 'Could not complete booking.');
            }
          },
        },
      ]
    );
  };

  const handleSendBrief = (app: JobApplication) => {
    const brief =
      app.job?.reportingInstructions ||
      'Report to main venue registration desk 30 mins prior to shift.';
    OpsklAlert.alert(
      'Reporting Briefing',
      `Reporting instructions for ${app.worker?.profile?.fullName}:\n\n"${brief}"\n\nInstructions are visible on the worker's shift ticket.`
    );
  };

  const appliedCount = applications.filter((a) => a.status === 'applied').length;
  const shortlistedCount = applications.filter((a) => a.status === 'shortlisted').length;
  const confirmedCount = applications.filter((a) => a.status === 'confirmed').length;

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return applications.filter((app) => {
      if (activeTab !== 'all' && app.status !== activeTab) return false;
      if (!q) return true;
      const name = app.worker?.profile?.fullName?.toLowerCase() || '';
      const title = app.job?.title?.toLowerCase() || '';
      const skills = (app.worker?.skills || []).join(' ').toLowerCase();
      return name.includes(q) || title.includes(q) || skills.includes(q);
    });
  }, [applications, activeTab, searchQuery]);

  return (
    <Screen edges={['top']}>
      <View
        style={[
          styles.header,
          {
            backgroundColor: colors.surface,
            borderBottomColor: colors.border,
            paddingHorizontal: spacing.lg,
            paddingTop: spacing.md,
            paddingBottom: spacing.md,
          },
        ]}
      >
        <Text style={[typography.h2, { color: colors.textPrimary }]}>Applicant Review & Roster</Text>
        <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 4, lineHeight: 18 }}>
          Review verified candidate profiles and confirm hires
        </Text>

        <SearchInput
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search by name, shift, or skill"
          containerStyle={{ marginTop: spacing.md }}
        />

        <FilterPills
          items={[
            { id: 'all', label: 'All', count: applications.length },
            { id: 'applied', label: 'Applied', count: appliedCount },
            { id: 'shortlisted', label: 'Shortlisted', count: shortlistedCount },
            { id: 'confirmed', label: 'Confirmed', count: confirmedCount },
            { id: 'rejected', label: 'Declined' },
          ]}
          selectedId={activeTab}
          onSelect={(id) => setActiveTab(id as FilterTab)}
          style={{ marginTop: spacing.sm, marginHorizontal: -spacing.lg }}
        />
      </View>

      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, flexGrow: 1 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {loading ? (
          <View style={{ gap: spacing.md }}>
            <ShiftCardSkeleton />
            <ShiftCardSkeleton />
          </View>
        ) : error ? (
          <ErrorRetry
            variant="block"
            title="Unable to load roster"
            message={error}
            onRetry={loadApplications}
          />
        ) : !organizerId ? (
          <EmptyState
            icon={<ClipboardList size={28} color={colors.textMuted} strokeWidth={1.8} />}
            title="Sign in to view applicant roster"
            description="Sign in with your organizer account to review applications and confirm crew."
            actionLabel="Sign In as Organizer"
            onAction={() => router.push('/auth/login?redirect=/(tabs)/roster' as any)}
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<ClipboardList size={28} color={colors.textMuted} strokeWidth={1.8} />}
            title={
              activeTab === 'all'
                ? searchQuery
                  ? 'No matches'
                  : 'No candidate applications yet'
                : `No ${activeTab} applicants`
            }
            description={
              searchQuery
                ? 'Try a different search term or clear the filter.'
                : activeTab === 'all'
                  ? 'When workers apply to your published shifts, their profiles appear here.'
                  : `No applications in the "${activeTab}" category.`
            }
            actionLabel={activeTab === 'all' && !searchQuery ? '+ Post a New Shift' : 'View All Applications'}
            onAction={() => {
              if (activeTab === 'all' && !searchQuery) {
                router.push('/(tabs)/create' as any);
              } else {
                setActiveTab('all');
                setSearchQuery('');
              }
            }}
          />
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
            const ratingLabel = formatWorkerRating(worker?.rating);

            return (
              <View
                key={app.id}
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
                  <View style={{ flexDirection: 'row', gap: 12, flex: 1 }}>
                    <View
                      style={[
                        styles.avatarCircle,
                        {
                          backgroundColor: colors.surfaceTertiary,
                          borderRadius: radii.full,
                          borderWidth: 1,
                          borderColor: colors.border,
                        },
                      ]}
                    >
                      <Text style={[styles.avatarText, { color: colors.primary }]}>
                        {profile?.fullName ? profile.fullName.slice(0, 2).toUpperCase() : 'WK'}
                      </Text>
                    </View>

                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <Text style={[typography.h3, { color: colors.textPrimary }]} numberOfLines={2}>
                          {profile?.fullName || 'Opskl Candidate'}
                        </Text>
                        {isVerified ? (
                          <StatusIndicator label="ID Verified" tone="success" size="sm" />
                        ) : null}
                      </View>

                      <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 4 }}>
                        Rating: {ratingLabel}
                        {ratingLabel !== 'New' ? '' : ' (unrated)'} • {worker?.shiftsCompleted || 0}{' '}
                        shifts • {worker?.preferredLocality || 'Mumbai'}
                      </Text>

                      {isConfirmed && profile?.phone ? (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
                          <Phone size={12} color={colors.primary} strokeWidth={2} />
                          <Text style={{ fontSize: 12, color: colors.primary, fontWeight: '600' }}>
                            {profile.phone}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  </View>

                  <StatusIndicator
                    label={app.status.replace('_', ' ')}
                    tone={statusTone(app.status)}
                    size="sm"
                  />
                </View>

                {job ? (
                  <View
                    style={{
                      backgroundColor: colors.surfaceMuted,
                      borderRadius: radii.md,
                      padding: spacing.sm + 2,
                    }}
                  >
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text
                        style={{ fontSize: 13, fontWeight: '700', color: colors.textPrimary, flex: 1 }}
                        numberOfLines={2}
                      >
                        {job.title}
                      </Text>
                      <Text style={{ fontSize: 12, fontWeight: '700', color: colors.primary }}>
                        {formatINR(job.hourlyRate)}/hr
                      </Text>
                    </View>
                    <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 2 }}>
                      Est. total pay: {formatINR(job.totalPay || job.hourlyRate * job.durationHours)}
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
                      <MapPin size={11} color={colors.textMuted} strokeWidth={2} />
                      <Text style={{ fontSize: 11, color: colors.textMuted }}>
                        {job.venueName} • {slotsRemaining} of {job.slotsTotal} openings left
                      </Text>
                    </View>
                  </View>
                ) : null}

                {app.notes ? (
                  <Text style={{ fontSize: 12, color: colors.textSecondary, fontStyle: 'italic' }}>
                    "{app.notes}"
                  </Text>
                ) : null}

                {worker?.skills && worker.skills.length > 0 ? (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                    {worker.skills.map((skill, idx) => (
                      <View
                        key={idx}
                        style={{
                          paddingHorizontal: 8,
                          paddingVertical: 3,
                          borderWidth: 1,
                          borderColor: colors.border,
                          borderRadius: radii.full,
                          backgroundColor: colors.surfaceTertiary,
                        }}
                      >
                        <Text style={{ fontSize: 11, color: colors.textSecondary }}>{skill}</Text>
                      </View>
                    ))}
                  </View>
                ) : null}

                <Divider />

                <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                  {isConfirmed ? (
                    <>
                      <View style={{ flex: 1 }}>
                        <Button title="Booked & Confirmed" variant="secondary" size="sm" disabled onPress={() => {}} />
                      </View>
                      <Button
                        title="Send Briefing"
                        variant="outline"
                        size="sm"
                        fullWidth={false}
                        onPress={() => handleSendBrief(app)}
                      />
                    </>
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
                      {!isShortlisted ? (
                        <Button
                          title="Shortlist"
                          variant="outline"
                          size="sm"
                          fullWidth={false}
                          loading={isActionBusy}
                          onPress={() => handleShortlist(app)}
                        />
                      ) : null}
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
              </View>
            );
          })
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    borderBottomWidth: 1,
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
});
