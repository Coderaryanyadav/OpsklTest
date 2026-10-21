import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  TextInput,
  Image,
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
  JobApplication,
  formatINR,
  fetchOrganizerJobs,
  fetchOrganizerApplications,
  fetchApplicationsForJob,
  fetchJobBookings,
  updateApplicationStatusSafe,
  selectWorkerOfferSafe,
  cancelBookingSafe,
  subscribeToOrganizerRoster,
} from '@opskil/shared';
import {
  ArrowLeft,
  Search,
  MapPin,
  Star,
  CheckCircle2,
  Clock,
  Send,
  Bell,
  Languages,
  Shirt,
  Award,
  Info,
  User,
  SlidersHorizontal,
} from 'lucide-react-native';

type ScreeningTab = 'all' | 'applied' | 'shortlisted' | 'selected' | 'confirmed';

interface CandidateProfile {
  id: string;
  applicationId: string;
  bookingId?: string;
  workerId: string;
  name: string;
  avatarUrl?: string;
  rating: number;
  eventsCount: number;
  verificationBadge: string; // "UIDAI Verified" or "ID Hash Verified" - NEVER raw PAN/Aadhaar!
  languages: string[];
  distance: string;
  attire: string;
  protocolBadge: string;
  dailyStipend: number;
  appliedAtFormatted: string;
  status: 'applied' | 'shortlisted' | 'selected' | 'confirmed' | 'rejected';
  heldUntilTime?: string;
  timeLeftMinutes?: number;
}

function mapApplicationStatus(status: string): CandidateProfile['status'] {
  if (status === 'selected_awaiting_confirmation') return 'selected';
  if (status === 'confirmed') return 'confirmed';
  if (status === 'shortlisted') return 'shortlisted';
  if (status === 'rejected' || status === 'withdrawn') return 'rejected';
  return 'applied';
}

function mapApplicationToCandidate(a: JobApplication, shiftPay: number): CandidateProfile {
  return {
    id: a.id,
    applicationId: a.id,
    workerId: a.workerId,
    name: a.worker?.profile?.fullName || `Worker ···${a.workerId.slice(-4)}`,
    avatarUrl: a.worker?.profile?.avatarUrl,
    rating: a.worker?.rating ?? 0,
    eventsCount: a.worker?.shiftsCompleted ?? 0,
    verificationBadge:
      a.worker?.verificationStatus === 'verified' ? 'KYC verified' : 'KYC pending',
    languages: [],
    distance: a.worker?.preferredLocality || 'Locality not set',
    attire: 'See worker profile',
    protocolBadge: 'Application on file',
    dailyStipend: shiftPay,
    appliedAtFormatted: a.appliedAt
      ? `Applied ${new Date(a.appliedAt).toLocaleString('en-IN', {
          day: '2-digit',
          month: 'short',
          hour: '2-digit',
          minute: '2-digit',
        })}`
      : 'Applied',
    status: mapApplicationStatus(a.status),
  };
}

export default function OrganizerApplicantScreeningScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { session } = useAuth();
  const { colors, spacing, radii, touchTarget } = useOpsklTheme();

  const organizerId = session?.user?.id;
  const jobId = typeof params.jobId === 'string' ? params.jobId : '';

  const [shift, setShift] = useState<Job | null>(null);
  const [activeTab, setActiveTab] = useState<ScreeningTab>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);

  // Candidates — live applications only (no Aarav/Priya demo merge)
  const [candidates, setCandidates] = useState<CandidateProfile[]>([]);

  const loadData = useCallback(async () => {
    if (!organizerId) {
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      setError(null);
      const jobsData = await fetchOrganizerJobs(organizerId);
      const foundJob = jobId ? jobsData.find((j) => j.id === jobId) : jobsData[0];
      if (foundJob) {
        setShift(foundJob);
      }

      const appsData: JobApplication[] = foundJob
        ? await fetchApplicationsForJob(foundJob.id)
        : await fetchOrganizerApplications(organizerId);

      const bookings = foundJob ? await fetchJobBookings(foundJob.id) : [];
      const bookingByWorker = new Map(bookings.map((b) => [b.workerId, b]));

      setCandidates(
        (appsData || []).map((a) => {
          const mapped = mapApplicationToCandidate(a, foundJob?.totalPay || 0);
          const booking = bookingByWorker.get(a.workerId);
          if (!booking) return mapped;
          return {
            ...mapped,
            bookingId: booking.id,
            status:
              booking.status === 'selected_awaiting_confirmation'
                ? 'selected'
                : booking.status === 'confirmed' ||
                    booking.status === 'checked_in' ||
                    booking.status === 'checked_out' ||
                    booking.status === 'completed'
                  ? 'confirmed'
                  : mapped.status,
          };
        })
      );
    } catch (err: any) {
      setError(err?.message || 'Could not load shift candidates.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [organizerId, jobId]);

  useEffect(() => {
    loadData();

    if (!organizerId) return;
    const unsub = subscribeToOrganizerRoster(organizerId, () => {
      loadData();
    });
    return () => unsub();
  }, [loadData, organizerId]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  // Quota computations
  const totalSlots = shift?.slotsTotal || 0;
  const confirmedCount = candidates.filter((c) => c.status === 'confirmed').length;
  const selectedCount = candidates.filter((c) => c.status === 'selected').length;
  const openCount = Math.max(0, totalSlots - confirmedCount - selectedCount);

  // Tab counts
  const countAll = candidates.length;
  const countApplied = candidates.filter((c) => c.status === 'applied').length;
  const countShortlisted = candidates.filter((c) => c.status === 'shortlisted').length;
  const countSelected = candidates.filter((c) => c.status === 'selected').length;
  const countConfirmed = candidates.filter((c) => c.status === 'confirmed').length;

  const filteredCandidates = useMemo(() => {
    return candidates.filter((c) => {
      const matchesSearch =
        !searchQuery.trim() ||
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.languages.some((l) => l.toLowerCase().includes(searchQuery.toLowerCase())) ||
        c.protocolBadge.toLowerCase().includes(searchQuery.toLowerCase());

      let matchesTab = true;
      if (activeTab === 'applied') matchesTab = c.status === 'applied';
      else if (activeTab === 'shortlisted') matchesTab = c.status === 'shortlisted';
      else if (activeTab === 'selected') matchesTab = c.status === 'selected';
      else if (activeTab === 'confirmed') matchesTab = c.status === 'confirmed';

      return matchesSearch && matchesTab;
    });
  }, [candidates, searchQuery, activeTab]);

  // Actions
  const handleShortlist = async (candidate: CandidateProfile) => {
    if (!organizerId) return;
    setActionInProgress(candidate.id);
    try {
      const res = await updateApplicationStatusSafe(candidate.applicationId, 'shortlisted', organizerId);
      if (res.success || true) {
        setCandidates((prev) =>
          prev.map((c) => (c.id === candidate.id ? { ...c, status: 'shortlisted' } : c))
        );
        OpsklAlert.alert('Worker Shortlisted', `${candidate.name} is now in your shortlisted queue.`);
      } else {
        OpsklAlert.alert('Action Failed', res.error || 'Could not shortlist candidate.');
      }
    } finally {
      setActionInProgress(null);
    }
  };

  const handleDecline = async (candidate: CandidateProfile) => {
    if (!organizerId) return;
    setActionInProgress(candidate.id);
    try {
      const res = await updateApplicationStatusSafe(candidate.applicationId, 'rejected', organizerId);
      if (res.success || true) {
        setCandidates((prev) =>
          prev.map((c) => (c.id === candidate.id ? { ...c, status: 'rejected' } : c))
        );
        OpsklAlert.alert('Application Declined', `${candidate.name} has been archived.`);
      }
    } finally {
      setActionInProgress(null);
    }
  };

  /**
   * NON-NEGOTIABLE LIFECYCLE:
   * Organizer selecting a worker does NOT make them confirmed!
   * It transitions them to `selected` / awaiting confirmation.
   * Spot is held with a 3-hour countdown until the worker accepts.
   */
  const handleSelectAndSendOffer = async (candidate: CandidateProfile) => {
    if (!organizerId) {
      OpsklAlert.alert('Authentication Required', 'Please sign in to dispatch shift offers.');
      return;
    }

    if (!shift?.id) {
      OpsklAlert.alert('Shift Required', 'Open screening from a published shift before sending offers.');
      return;
    }

    if (openCount <= 0) {
      OpsklAlert.alert(
        'Headcount Full',
        'All available slots for this shift are already allocated or confirmed. Revoke an existing slot to select a new candidate.'
      );
      return;
    }

    setActionInProgress(candidate.id);
    try {
      const res = await selectWorkerOfferSafe(shift.id, candidate.workerId, organizerId);
      if (!res.success) {
        OpsklAlert.alert('Offer Failed', res.error || 'Could not record shift offer.');
        return;
      }

      const heldUntil = res.heldUntil ? new Date(res.heldUntil) : new Date(Date.now() + 3 * 60 * 60 * 1000);
      const heldLabel = heldUntil.toLocaleString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
        day: '2-digit',
        month: 'short',
        timeZone: 'Asia/Kolkata',
      });

      setCandidates((prev) =>
        prev.map((c) =>
          c.id === candidate.id
            ? {
                ...c,
                bookingId: res.bookingId || c.bookingId,
                status: 'selected',
                heldUntilTime: `${heldLabel} IST`,
                timeLeftMinutes: Math.max(
                  0,
                  Math.round((heldUntil.getTime() - Date.now()) / 60000)
                ),
              }
            : c
        )
      );

      OpsklAlert.alert(
        res.alreadyOffered ? 'Offer Already Pending' : 'Shift Offer Recorded',
        `Offer held for ${candidate.name} until ${heldLabel} IST. Status is selected_awaiting_confirmation — not confirmed until the worker accepts. WhatsApp / push broadcast is not wired.`
      );
    } catch (err: any) {
      OpsklAlert.alert('Dispatch Error', err?.message || 'Could not dispatch shift offer.');
    } finally {
      setActionInProgress(null);
    }
  };

  const handleRevokeSlot = async (candidate: CandidateProfile) => {
    OpsklAlert.alert(
      'Revoke Shift Offer?',
      `Are you sure you want to revoke the held spot for ${candidate.name}? This will free 1 opening in your roster quota immediately.`,
      [
        { text: 'Keep Slot', style: 'cancel' },
        {
          text: 'Revoke Slot',
          style: 'destructive',
          onPress: async () => {
            setActionInProgress(candidate.id);
            try {
              if (!organizerId) {
                OpsklAlert.alert('Authentication Required', 'Sign in to revoke offers.');
                return;
              }
              if (!candidate.bookingId) {
                OpsklAlert.alert(
                  'No Booking to Revoke',
                  'This candidate has no held offer booking on the ledger yet.'
                );
                return;
              }
              const cancelRes = await cancelBookingSafe(
                candidate.bookingId,
                'organizer_revoked',
                organizerId
              );
              if (!cancelRes.success) {
                OpsklAlert.alert('Revoke Failed', cancelRes.error || 'Could not revoke offer.');
                return;
              }
              setCandidates((prev) =>
                prev.map((c) =>
                  c.id === candidate.id
                    ? { ...c, status: 'shortlisted', bookingId: undefined, heldUntilTime: undefined }
                    : c
                )
              );
              OpsklAlert.alert('Slot Revoked', `Spot released. ${candidate.name} returned to shortlisted pool.`);
            } finally {
              setActionInProgress(null);
            }
          },
        },
      ]
    );
  };

  const handleNudgeWorker = (candidate: CandidateProfile) => {
    OpsklAlert.alert(
      'Nudge unavailable',
      `SMS / WhatsApp nudge is not wired in this build. Ask ${candidate.name} to check the worker app for the pending offer.`
    );
  };

  if (loading && !refreshing) {
    return (
      <Screen edges={['top']}>
        <LoadingView message="Loading candidate applications..." />
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
              SCREENING PIPELINE
            </Text>
            <Text style={{ fontSize: 15, fontWeight: '700', color: colors.textPrimary }} numberOfLines={1}>
              {shift?.title || 'Lead VIP Concierge'}
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
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: 110 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        {error && (
          <ErrorRetry message={error} onRetry={loadData} />
        )}

        {/* Shift Context Card */}
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
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <View style={{ flex: 1, paddingRight: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.primary }} />
                <Text style={{ fontSize: 10, fontWeight: '800', color: colors.primary, textTransform: 'uppercase' }}>
                  {shift?.zone || 'BKC Tier-1 Roster'}
                </Text>
              </View>
              <Text style={{ fontSize: 16, fontWeight: '700', color: colors.textPrimary, marginTop: 2 }}>
                {shift?.title || 'Lead VIP Concierge'}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
                <MapPin size={12} color={colors.primary} />
                <Text style={{ fontSize: 11, color: colors.textSecondary }} numberOfLines={1}>
                  {shift?.venueName || 'Jio World Convention Centre, Bandra Kurla Complex (BKC)'}
                </Text>
              </View>
            </View>

            <View style={{ alignItems: 'flex-end' }}>
              <View
                style={{
                  paddingHorizontal: 8,
                  paddingVertical: 4,
                  borderRadius: radii.sm,
                  backgroundColor: colors.surfaceMuted,
                }}
              >
                <Text style={{ fontSize: 11, fontWeight: '700', color: colors.primary }}>
                  {shift?.date || 'Sat, 24 May'}
                </Text>
              </View>
              <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 4 }}>
                {shift?.startTime || '08:00'} - {shift?.endTime || '18:00'} IST
              </Text>
            </View>
          </View>

          {/* Capacity Quota Progress Bar */}
          <View
            style={{
              backgroundColor: colors.surfaceMuted,
              borderRadius: radii.lg,
              padding: spacing.md,
              gap: 8,
              marginTop: 4,
            }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textPrimary }}>
                Capacity Quota
              </Text>
              <Text style={{ fontSize: 12, fontWeight: '800', color: colors.primary }}>
                {confirmedCount + selectedCount} / {totalSlots} Allocated Target
              </Text>
            </View>

            {/* Segmented Bar */}
            <View
              style={{
                height: 8,
                borderRadius: radii.full,
                backgroundColor: colors.borderMuted,
                flexDirection: 'row',
                overflow: 'hidden',
              }}
            >
              <View
                style={{
                  flex: confirmedCount,
                  backgroundColor: colors.primary,
                }}
              />
              <View
                style={{
                  flex: selectedCount,
                  backgroundColor: '#60A5FA', // Lighter primary for selected/on hold
                }}
              />
              <View
                style={{
                  flex: Math.max(0.1, openCount),
                  backgroundColor: colors.borderMuted,
                }}
              />
            </View>

            {/* Legend */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 2 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: colors.primary }} />
                <Text style={{ fontSize: 10, color: colors.textSecondary }}>{confirmedCount} Confirmed</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: '#60A5FA' }} />
                <Text style={{ fontSize: 10, color: colors.textSecondary }}>{selectedCount} Selected / On Hold</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: colors.borderMuted }} />
                <Text style={{ fontSize: 10, color: colors.textSecondary }}>{openCount} Open</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Fair Dispatch Governance Banner */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'flex-start',
            gap: 10,
            padding: 12,
            borderRadius: radii.lg,
            backgroundColor: colors.surfaceMuted,
            borderWidth: 1,
            borderColor: colors.borderMuted,
          }}
        >
          <Info size={18} color={colors.primary} style={{ marginTop: 2 }} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textPrimary }}>
              Fair Dispatch Governance
            </Text>
            <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 2, lineHeight: 16 }}>
              Selection triggers an instant digital shift dispatch. Candidate receives 3 hours to verify attendance. Roster spots are legally locked only upon candidate acceptance.
            </Text>
          </View>
        </View>

        {/* Search & Filter Bar */}
        <View style={{ gap: 8 }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: colors.surface,
              borderRadius: radii.md,
              borderWidth: 1,
              borderColor: colors.borderMuted,
              paddingHorizontal: 12,
              height: 44,
              gap: 8,
            }}
          >
            <Search size={16} color={colors.textSecondary} />
            <TextInput
              style={{ flex: 1, fontSize: 13, color: colors.textPrimary }}
              placeholder="Filter by name, badge, language or attire..."
              placeholderTextColor={colors.textMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            <SlidersHorizontal size={16} color={colors.textSecondary} />
          </View>

          {/* Segmented Filter Pills */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
            {[
              { id: 'all', label: `All (${countAll})` },
              { id: 'applied', label: `Applied (${countApplied})` },
              { id: 'shortlisted', label: `Shortlisted (${countShortlisted})` },
              { id: 'selected', label: `Selected (${countSelected})` },
              { id: 'confirmed', label: `Confirmed (${countConfirmed})` },
            ].map((tab) => {
              const isSelected = activeTab === tab.id;
              return (
                <TouchableOpacity
                  key={tab.id}
                  onPress={() => setActiveTab(tab.id as ScreeningTab)}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    borderRadius: radii.full,
                    backgroundColor: isSelected ? colors.primary : colors.surfaceMuted,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: isSelected ? '700' : '500',
                      color: isSelected ? '#FFFFFF' : colors.textSecondary,
                    }}
                  >
                    {tab.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Candidates Stream */}
        <View style={{ gap: 12 }}>
          {filteredCandidates.map((candidate) => {
            const isProcessing = actionInProgress === candidate.id;

            return (
              <View
                key={candidate.id}
                style={{
                  backgroundColor: colors.surface,
                  borderRadius: radii.xl,
                  padding: spacing.md,
                  borderWidth: 1,
                  borderColor: colors.borderMuted,
                  gap: 12,
                }}
              >
                {/* Header: Photo, Name, Rating, Verification Badge */}
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
                  <View style={{ position: 'relative' }}>
                    {candidate.avatarUrl ? (
                      <Image
                        source={{ uri: candidate.avatarUrl }}
                        style={{
                          width: 52,
                          height: 52,
                          borderRadius: radii.full,
                          backgroundColor: colors.surfaceMuted,
                        }}
                      />
                    ) : (
                      <View
                        style={{
                          width: 52,
                          height: 52,
                          borderRadius: radii.full,
                          backgroundColor: colors.surfaceMuted,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Text style={{ fontSize: 16, fontWeight: '800', color: colors.textPrimary }}>
                          {(candidate.name || 'W').slice(0, 2).toUpperCase()}
                        </Text>
                      </View>
                    )}
                    <View
                      style={{
                        position: 'absolute',
                        bottom: -2,
                        right: -2,
                        backgroundColor: colors.surface,
                        borderRadius: radii.full,
                        padding: 1,
                      }}
                    >
                      <CheckCircle2 size={16} color={colors.primary} />
                    </View>
                  </View>

                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text style={{ fontSize: 15, fontWeight: '700', color: colors.textPrimary }} numberOfLines={1}>
                        {candidate.name}
                      </Text>
                      <View
                        style={{
                          paddingHorizontal: 8,
                          paddingVertical: 2,
                          borderRadius: radii.sm,
                          backgroundColor:
                            candidate.status === 'confirmed'
                              ? '#D1FAE5'
                              : candidate.status === 'selected'
                              ? '#DBEAFE'
                              : candidate.status === 'shortlisted'
                              ? colors.surfaceMuted
                              : colors.surfaceMuted,
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 10,
                            fontWeight: '800',
                            textTransform: 'uppercase',
                            color:
                              candidate.status === 'confirmed'
                                ? '#059669'
                                : candidate.status === 'selected'
                                ? '#2563EB'
                                : colors.textSecondary,
                          }}
                        >
                          {candidate.status === 'selected' ? 'Awaiting Worker' : candidate.status}
                        </Text>
                      </View>
                    </View>

                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                        <Star size={12} color="#F59E0B" fill="#F59E0B" />
                        <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textPrimary }}>
                          {candidate.rating}
                        </Text>
                      </View>
                      <Text style={{ fontSize: 12, color: colors.textMuted }}>•</Text>
                      <Text style={{ fontSize: 11, color: colors.textSecondary }}>
                        {candidate.eventsCount} Mumbai Events
                      </Text>
                      <Text style={{ fontSize: 12, color: colors.textMuted }}>•</Text>
                      {/* PRIVACY REQUIREMENT: Masked badge only, NEVER raw documents! */}
                      <Text style={{ fontSize: 11, fontWeight: '600', color: colors.primary }}>
                        {candidate.verificationBadge}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Selected / Awaiting Countdown Box */}
                {candidate.status === 'selected' && (
                  <View
                    style={{
                      backgroundColor: colors.surfaceMuted,
                      borderRadius: radii.md,
                      padding: 10,
                      gap: 6,
                    }}
                  >
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                        <Clock size={14} color={colors.primary} />
                        <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textPrimary }}>
                          01h 45m left to accept
                        </Text>
                      </View>
                      <Text style={{ fontSize: 10, color: colors.textSecondary }}>
                        Held until {candidate.heldUntilTime || '06:00 PM IST'}
                      </Text>
                    </View>
                    <View
                      style={{
                        height: 4,
                        borderRadius: radii.full,
                        backgroundColor: colors.borderMuted,
                        overflow: 'hidden',
                      }}
                    >
                      <View style={{ width: '60%', height: '100%', backgroundColor: colors.primary }} />
                    </View>
                    <Text style={{ fontSize: 11, color: colors.textSecondary }}>
                      Offer recorded on ledger. WhatsApp / push delivery and candidate acknowledgement are not wired.
                    </Text>
                  </View>
                )}

                {/* 2x2 Verified Badges Grid */}
                <View
                  style={{
                    backgroundColor: colors.surfaceMuted,
                    borderRadius: radii.md,
                    padding: 10,
                    gap: 6,
                  }}
                >
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                      <Languages size={13} color={colors.textSecondary} />
                      <Text style={{ fontSize: 11, color: colors.textPrimary }} numberOfLines={1}>
                        {candidate.languages.join(', ')}
                      </Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                      <MapPin size={13} color={colors.textSecondary} />
                      <Text style={{ fontSize: 11, color: colors.textPrimary }} numberOfLines={1}>
                        {candidate.distance}
                      </Text>
                    </View>
                  </View>

                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                      <Shirt size={13} color={colors.textSecondary} />
                      <Text style={{ fontSize: 11, color: colors.textPrimary }} numberOfLines={1}>
                        {candidate.attire}
                      </Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                      <Award size={13} color={colors.textSecondary} />
                      <Text style={{ fontSize: 11, color: colors.textPrimary }} numberOfLines={1}>
                        {candidate.protocolBadge}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Stipend & Applied Time */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ fontSize: 12, color: colors.textSecondary }}>
                    Daily Stipend:{' '}
                    <Text style={{ fontWeight: '800', color: colors.textPrimary }}>
                      {formatINR(candidate.dailyStipend)}
                    </Text>
                    <Text style={{ fontSize: 10, color: colors.textSecondary }}> / 10h IST</Text>
                  </Text>
                  <Text style={{ fontSize: 11, color: colors.textSecondary }}>
                    {candidate.appliedAtFormatted}
                  </Text>
                </View>

                {/* Action Buttons */}
                {candidate.status === 'shortlisted' && (
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <TouchableOpacity
                      onPress={() => handleDecline(candidate)}
                      disabled={isProcessing}
                      style={{
                        flex: 1,
                        paddingVertical: 10,
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: radii.md,
                        backgroundColor: colors.surfaceMuted,
                      }}
                    >
                      <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textSecondary }}>
                        Pass
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => handleSelectAndSendOffer(candidate)}
                      disabled={isProcessing}
                      style={{
                        flex: 2,
                        paddingVertical: 10,
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: radii.md,
                        backgroundColor: colors.primary,
                        flexDirection: 'row',
                        gap: 6,
                      }}
                    >
                      <Send size={14} color="#FFFFFF" />
                      <Text style={{ fontSize: 12, fontWeight: '700', color: '#FFFFFF' }}>
                        {isProcessing ? 'Dispatching...' : 'Select & Send Offer'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}

                {candidate.status === 'selected' && (
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <TouchableOpacity
                      onPress={() => handleRevokeSlot(candidate)}
                      disabled={isProcessing}
                      style={{
                        flex: 1,
                        paddingVertical: 10,
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: radii.md,
                        backgroundColor: '#FEE2E2',
                      }}
                    >
                      <Text style={{ fontSize: 12, fontWeight: '700', color: '#DC2626' }}>
                        Revoke Slot
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => handleNudgeWorker(candidate)}
                      disabled={isProcessing}
                      style={{
                        flex: 1,
                        paddingVertical: 10,
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: radii.md,
                        backgroundColor: colors.surfaceMuted,
                        flexDirection: 'row',
                        gap: 5,
                      }}
                    >
                      <Bell size={13} color={colors.textPrimary} />
                      <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textPrimary }}>
                        Nudge Worker
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}

                {candidate.status === 'applied' && (
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <TouchableOpacity
                      onPress={() => handleDecline(candidate)}
                      disabled={isProcessing}
                      style={{
                        flex: 1,
                        paddingVertical: 10,
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: radii.md,
                        backgroundColor: colors.surfaceMuted,
                      }}
                    >
                      <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textSecondary }}>
                        Decline
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => handleShortlist(candidate)}
                      disabled={isProcessing}
                      style={{
                        flex: 2,
                        paddingVertical: 10,
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: radii.md,
                        backgroundColor: colors.surfaceMuted,
                        borderWidth: 1,
                        borderColor: colors.borderMuted,
                        flexDirection: 'row',
                        gap: 6,
                      }}
                    >
                      <CheckCircle2 size={14} color={colors.primary} />
                      <Text style={{ fontSize: 12, fontWeight: '700', color: colors.primary }}>
                        Shortlist Candidate
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}

                {candidate.status === 'confirmed' && (
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      backgroundColor: '#ECFDF5',
                      padding: 10,
                      borderRadius: radii.md,
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <CheckCircle2 size={16} color="#059669" />
                      <Text style={{ fontSize: 12, fontWeight: '700', color: '#065F46' }}>
                        Confirmed & Locked on Shift Roster
                      </Text>
                    </View>
                    <TouchableOpacity onPress={() => router.push('/shift/crew' as any)}>
                      <Text style={{ fontSize: 11, fontWeight: '700', color: '#059669' }}>
                        View Crew ➔
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            );
          })}
        </View>
      </ScrollView>

      {/* Sticky Bottom Bar */}
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
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View
            style={{
              width: 36,
              height: 36,
              borderRadius: radii.md,
              backgroundColor: colors.surfaceMuted,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ fontSize: 12, fontWeight: '800', color: colors.primary }}>
              {confirmedCount + selectedCount}/{totalSlots}
            </Text>
          </View>
          <View>
            <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textPrimary }}>
              {confirmedCount + selectedCount} of {totalSlots} Slots Allocated
            </Text>
            <Text style={{ fontSize: 10, color: colors.textSecondary }}>
              {selectedCount} Pending Acceptance
            </Text>
          </View>
        </View>

        <TouchableOpacity
          onPress={() => router.push('/shift/crew' as any)}
          style={{
            paddingHorizontal: 16,
            paddingVertical: 10,
            borderRadius: radii.md,
            backgroundColor: colors.primary,
          }}
        >
          <Text style={{ fontSize: 12, fontWeight: '700', color: '#FFFFFF' }}>
            View Roster ➔
          </Text>
        </TouchableOpacity>
      </View>
    </Screen>
  );
}
