import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  useOpsklTheme,
  Button,
  ShiftCardSkeleton,
  useAuth,
  OpsklAlert,
  Screen,
  ErrorRetry,
} from '@opskil/design-system';
import {
  Job,
  JobApplication,
  fetchOrganizerJobs,
  fetchOrganizerApplications,
  subscribeToOrganizerRoster,
  universalStorage,
  getTodayDateIST,
} from '@opskil/shared';
import {
  Calendar,
  MapPin,
  Search,
  RotateCw,
  Plus,
  X,
  Users,
  Radio,
  UserPlus,
} from 'lucide-react-native';

const DRAFT_KEY = '@opskil_organizer_shift_draft';

type StatusFilter = 'all' | 'active' | 'locked' | 'drafts' | 'completed';

export default function OrganizerShiftsRosterScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const { colors, spacing, radii } = useOpsklTheme();

  const organizerId = session?.user?.id;

  const [shifts, setShifts] = useState<Job[]>([]);
  const [applications, setApplications] = useState<JobApplication[]>([]);
  const [hasSavedDraft, setHasSavedDraft] = useState(false);
  const [draftTitle, setDraftTitle] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters & Search
  const [activeTab, setActiveTab] = useState<StatusFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedZone, setSelectedZone] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!organizerId) {
      setShifts([]);
      setApplications([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      setError(null);
      const [jobsData, appsData, draftData] = await Promise.all([
        fetchOrganizerJobs(organizerId),
        fetchOrganizerApplications(organizerId),
        universalStorage.getItem(DRAFT_KEY).catch(() => null),
      ]);

      setShifts(jobsData || []);
      setApplications(appsData || []);
      if (draftData) {
        try {
          const parsed = JSON.parse(draftData);
          setHasSavedDraft(true);
          if (parsed.title) setDraftTitle(parsed.title);
        } catch {
          setHasSavedDraft(true);
        }
      } else {
        setHasSavedDraft(false);
      }
    } catch (err: any) {
      console.error('Failed to load roster data', err);
      setError(err?.message || 'Could not load shift roster.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [organizerId]);

  useEffect(() => {
    loadData();

    if (!organizerId) return;
    const unsubscribe = subscribeToOrganizerRoster(organizerId, () => {
      loadData();
    });

    return () => {
      unsubscribe();
    };
  }, [loadData, organizerId]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleDiscardDraft = async () => {
    try {
      await universalStorage.removeItem(DRAFT_KEY);
      setHasSavedDraft(false);
      OpsklAlert.alert('Draft Discarded', 'Unpublished shift draft has been cleared.');
    } catch {
      setHasSavedDraft(false);
    }
  };

  // Filter counts — real ledger only (never pad with demo numbers)
  const totalEventsCount = shifts.length;
  const confirmedCrewCount = applications.filter((a) => a.status === 'confirmed').length;
  const pendingApplicantsCount = applications.filter(
    (a) => a.status === 'applied' || a.status === 'shortlisted' || a.status === 'selected_awaiting_confirmation'
  ).length;
  const totalSlotsCount = shifts.reduce((acc, s) => acc + (s.slotsTotal || 0), 0);
  const openSlotsCount = Math.max(0, totalSlotsCount - confirmedCrewCount);
  const confirmedPct = totalSlotsCount > 0 ? Math.round((confirmedCrewCount / totalSlotsCount) * 100) : 0;

  const filteredShifts = useMemo(() => {
    return shifts.filter((s) => {
      const matchesSearch =
        !searchQuery.trim() ||
        s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.venueName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.id.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesZone = !selectedZone || s.zone?.toLowerCase().includes(selectedZone.toLowerCase());

      let matchesTab = true;
      if (activeTab === 'active') {
        matchesTab = s.status === 'open' || s.status === 'filling';
      } else if (activeTab === 'locked') {
        matchesTab = s.slotsFilled >= s.slotsTotal;
      } else if (activeTab === 'drafts') {
        matchesTab = s.status === 'draft';
      } else if (activeTab === 'completed') {
        matchesTab = s.status === 'completed';
      }

      return matchesSearch && matchesZone && matchesTab;
    });
  }, [shifts, searchQuery, selectedZone, activeTab]);

  return (
    <Screen edges={['top']}>
      {/* Header Bar */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.md,
          backgroundColor: colors.surface,
          borderBottomWidth: 1,
          borderBottomColor: colors.borderMuted,
        }}
      >
        <View style={{ flex: 1, paddingRight: 8, minWidth: 0 }}>
          <Text style={{ fontSize: 10, fontWeight: '800', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.8 }} numberOfLines={1}>
            OPSKL MUMBAI
          </Text>
          <Text style={{ fontSize: 16, fontWeight: '700', color: colors.textPrimary, letterSpacing: -0.3 }} numberOfLines={1}>
            Organizer Shifts Roster
          </Text>
        </View>

        <TouchableOpacity
          onPress={onRefresh}
          style={{
            width: 34,
            height: 34,
            borderRadius: radii.full,
            backgroundColor: colors.surfaceMuted,
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
          accessibilityLabel="Refresh roster"
        >
          <RotateCw size={16} color={colors.textPrimary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: spacing.md, paddingVertical: spacing.md, gap: spacing.md, paddingBottom: 120 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Live Attendance & Roster Telemetry Radar */}
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
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, minWidth: 0, paddingRight: 8 }}>
              <View
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: radii.md,
                  backgroundColor: colors.surfaceMuted,
                  borderWidth: 1,
                  borderColor: colors.borderMuted,
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <Radio size={18} color={colors.primary} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: colors.textPrimary }} numberOfLines={1}>
                    Live Attendance & Roster Radar
                  </Text>
                  <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#16A34A', flexShrink: 0 }} />
                </View>
                <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 1 }} numberOfLines={1}>
                  Mumbai Hub • Real-time crew dispatch & attendance telemetry
                </Text>
              </View>
            </View>
            <View
              style={{
                paddingHorizontal: 8,
                paddingVertical: 3,
                borderRadius: radii.full,
                backgroundColor: colors.surfaceMuted,
                flexShrink: 0,
              }}
            >
              <Text style={{ fontSize: 10, fontWeight: '800', color: colors.primary }}>
                LIVE SYNC
              </Text>
            </View>
          </View>

          {/* 3-Way Roster Fill Progress Bar */}
          <View style={{ gap: 6 }}>
            <View
              style={{
                height: 7,
                width: '100%',
                borderRadius: radii.full,
                backgroundColor: colors.surfaceMuted,
                overflow: 'hidden',
                flexDirection: 'row',
              }}
            >
              {confirmedPct > 0 && (
                <View
                  style={{
                    height: '100%',
                    backgroundColor: '#16A34A',
                    width: `${Math.min(100, confirmedPct)}%`,
                  }}
                />
              )}
              {pendingApplicantsCount > 0 && totalSlotsCount > 0 && (
                <View
                  style={{
                    height: '100%',
                    backgroundColor: colors.warning,
                    width: `${Math.min(100 - confirmedPct, Math.round((pendingApplicantsCount / totalSlotsCount) * 100))}%`,
                  }}
                />
              )}
            </View>

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#16A34A' }} />
                <Text style={{ fontSize: 11, color: colors.textSecondary, fontWeight: '600' }}>
                  {confirmedCrewCount} Confirmed
                </Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.warning }} />
                <Text style={{ fontSize: 11, color: colors.textSecondary, fontWeight: '600' }}>
                  {pendingApplicantsCount} In Review
                </Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.textMuted }} />
                <Text style={{ fontSize: 11, color: colors.textSecondary, fontWeight: '600' }}>
                  {openSlotsCount} Open Slots
                </Text>
              </View>
            </View>
          </View>
        </View>

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

        {/* Segmented Status Navigation Tabs */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8 }}
        >
          {[
            { id: 'all', label: `All (${totalEventsCount})` },
            { id: 'active', label: 'Active & Open (2)' },
            { id: 'locked', label: 'Roster Locked (1)' },
            { id: 'drafts', label: 'Drafts (1)' },
            { id: 'completed', label: 'Completed (1)' },
          ].map((tab) => {
            const isSelected = activeTab === tab.id;
            return (
              <TouchableOpacity
                key={tab.id}
                onPress={() => setActiveTab(tab.id as StatusFilter)}
                style={{
                  paddingHorizontal: 14,
                  paddingVertical: 8,
                  borderRadius: radii.md,
                  backgroundColor: isSelected ? colors.primary : colors.surfaceMuted,
                }}
              >
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: isSelected ? '700' : '500',
                    color: isSelected ? colors.textInverse : colors.textSecondary,
                  }}
                >
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Search & Locality Filter Chips Bar */}
        <View style={{ gap: 8 }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: colors.surface,
              borderRadius: radii.lg,
              borderWidth: 1,
              borderColor: colors.borderMuted,
              paddingHorizontal: 12,
              height: 44,
            }}
          >
            <Search size={16} color={colors.textSecondary} style={{ marginRight: 8 }} />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search shift title, venue or booking ID..."
              placeholderTextColor={colors.textMuted}
              style={{ flex: 1, fontSize: 13, color: colors.textPrimary }}
            />
            {searchQuery.trim().length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <X size={16} color={colors.textSecondary} />
              </TouchableOpacity>
            )}
          </View>

          {/* Locality Chips */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
            {['BKC Complex', 'NESCO Goregaon', 'May 2025'].map((chip) => {
              const active = selectedZone === chip;
              return (
                <TouchableOpacity
                  key={chip}
                  onPress={() => setSelectedZone(active ? null : chip)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 5,
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    borderRadius: radii.full,
                    backgroundColor: active ? colors.primary : colors.surfaceMuted,
                  }}
                >
                  <MapPin size={12} color={active ? colors.textInverse : colors.textSecondary} />
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: '600',
                      color: active ? colors.textInverse : colors.textSecondary,
                    }}
                  >
                    {chip}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Shifts Roster List Cards */}
        <View style={{ gap: 12 }}>
          {/* Saved Draft Card (if exists) */}
          {hasSavedDraft && (activeTab === 'all' || activeTab === 'drafts') && (
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
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 6,
                    paddingHorizontal: 8,
                    paddingVertical: 3,
                    borderRadius: radii.full,
                    backgroundColor: colors.surfaceMuted,
                  }}
                >
                  <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.accent }} />
                  <Text style={{ fontSize: 10, fontWeight: '800', color: colors.accent, textTransform: 'uppercase' }}>
                    UNPUBLISHED DRAFT
                  </Text>
                </View>
                <TouchableOpacity onPress={handleDiscardDraft}>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textMuted }}>
                    Discard
                  </Text>
                </TouchableOpacity>
              </View>

              <View>
                <Text style={{ fontSize: 15, fontWeight: '700', color: colors.textPrimary }}>
                  {draftTitle || 'Untitled Shift Draft'}
                </Text>
                <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>
                  Configuration saved locally. Resume wizard to finalize crew allocation.
                </Text>
              </View>

              <TouchableOpacity
                onPress={() => router.push('/(tabs)/create')}
                style={{
                  backgroundColor: colors.primary,
                  borderRadius: radii.md,
                  paddingVertical: 10,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textInverse }}>
                  Resume Shift Configuration
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Real Dynamic Shifts from Database */}
          {filteredShifts.map((shift) => {
            const shiftApps = applications.filter((a) => a.jobId === shift.id);
            const appliedCount = shiftApps.length;
            const confirmedCount = shiftApps.filter((a) => a.status === 'confirmed').length;
            const isFull = (shift.slotsFilled || confirmedCount) >= (shift.slotsTotal || 1);
            const isToday = shift.date === getTodayDateIST();

            const statusLabel =
              shift.status === 'completed'
                ? 'COMPLETED'
                : shift.status === 'in_progress'
                  ? 'LIVE IN PROGRESS'
                  : isFull
                    ? 'ROSTER LOCKED'
                    : `OPEN FOR APPLICATIONS • ${appliedCount} APPLIED`;

            const statusBadgeColor =
              shift.status === 'completed'
                ? colors.textSecondary
                : shift.status === 'in_progress'
                  ? '#16A34A'
                  : isFull
                    ? colors.textPrimary
                    : colors.primary;

            return (
              <View
                key={shift.id}
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
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 6,
                      paddingHorizontal: 8,
                      paddingVertical: 3,
                      borderRadius: radii.full,
                      backgroundColor: colors.surfaceMuted,
                    }}
                  >
                    <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: statusBadgeColor }} />
                    <Text style={{ fontSize: 10, fontWeight: '800', color: statusBadgeColor, textTransform: 'uppercase' }}>
                      {statusLabel}
                    </Text>
                  </View>
                  <Text style={{ fontSize: 11, fontFamily: 'monospace', color: colors.textSecondary }}>
                    #{shift.id.slice(0, 8).toUpperCase()}
                  </Text>
                </View>

                <View>
                  <Text style={{ fontSize: 15, fontWeight: '700', color: colors.textPrimary }}>
                    {shift.title}
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 3 }}>
                    <MapPin size={13} color={colors.textSecondary} />
                    <Text style={{ fontSize: 12, color: colors.textSecondary }}>
                      {shift.venueName || 'Venue TBD'}{shift.city ? `, ${shift.city}` : ''}
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
                  }}
                >
                  <View>
                    <Text style={{ fontSize: 10, color: colors.textSecondary, textTransform: 'uppercase' }}>
                      Shift Timing (IST)
                    </Text>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textPrimary, marginTop: 1 }}>
                      {shift.date} • {shift.startTime || 'TBD'} – {shift.endTime || 'TBD'}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={{ fontSize: 10, color: colors.textSecondary, textTransform: 'uppercase' }}>
                      Rate & Quota
                    </Text>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: colors.primary, marginTop: 1 }}>
                      ₹{Number(shift.totalPay || 0).toLocaleString('en-IN')} • {shift.slotsFilled || confirmedCount}/{shift.slotsTotal} filled
                    </Text>
                  </View>
                </View>

                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 4 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Users size={14} color={colors.textSecondary} />
                    <Text style={{ fontSize: 11, color: colors.textSecondary }}>
                      {appliedCount} Total Applicant{appliedCount === 1 ? '' : 's'}
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    {!isFull && appliedCount > 0 && (
                      <TouchableOpacity
                        onPress={() => router.push(`/shift/${shift.id}` as any)}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 4,
                          paddingHorizontal: 10,
                          paddingVertical: 6,
                          borderRadius: radii.md,
                          backgroundColor: colors.surfaceMuted,
                          borderWidth: 1,
                          borderColor: colors.borderMuted,
                        }}
                      >
                        <UserPlus size={13} color={colors.primary} />
                        <Text style={{ fontSize: 11, fontWeight: '700', color: colors.primary }}>
                          Fill Slot ({appliedCount})
                        </Text>
                      </TouchableOpacity>
                    )}
                    {isToday && (
                      <TouchableOpacity
                        onPress={() => router.push(`/shift/${shift.id}` as any)}
                        style={{
                          paddingHorizontal: 12,
                          paddingVertical: 6,
                          borderRadius: radii.md,
                          backgroundColor: '#16A34A',
                        }}
                      >
                        <Text style={{ fontSize: 11, fontWeight: '700', color: '#FFFFFF' }}>
                          Live Console
                        </Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity
                      onPress={() => router.push(`/shift/${shift.id}` as any)}
                      style={{
                        paddingHorizontal: 12,
                        paddingVertical: 6,
                        borderRadius: radii.md,
                        backgroundColor: colors.primary,
                      }}
                    >
                      <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textInverse }}>
                        Manage Shift
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            );
          })}

          {/* Empty Filter State */}
          {filteredShifts.length === 0 && !hasSavedDraft && !loading && (
            <View
              style={{
                backgroundColor: colors.surface,
                borderRadius: radii.xl,
                padding: spacing.xl,
                borderWidth: 1,
                borderColor: colors.borderMuted,
                alignItems: 'center',
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
                  No Shifts in Roster
                </Text>
                <Text style={{ fontSize: 12, color: colors.textSecondary, textAlign: 'center', lineHeight: 18, maxWidth: 280 }}>
                  {searchQuery || selectedZone || activeTab !== 'all'
                    ? 'No shifts match your search or filter criteria. Try resetting filters.'
                    : 'Create and dispatch event shifts to source, screen, and confirm verified Mumbai crew.'}
                </Text>
              </View>
              {searchQuery || selectedZone || activeTab !== 'all' ? (
                <Button
                  title="Reset Filters"
                  variant="outline"
                  size="sm"
                  onPress={() => {
                    setSearchQuery('');
                    setSelectedZone(null);
                    setActiveTab('all');
                  }}
                />
              ) : (
                <Button
                  title="Post New Shift"
                  variant="primary"
                  size="md"
                  onPress={() => router.push('/(tabs)/create')}
                />
              )}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Floating Action Button: Create New Shift */}
      <View
        style={{
          position: 'absolute',
          bottom: 24,
          right: 20,
        }}
      >
        <TouchableOpacity
          onPress={() => router.push('/(tabs)/create')}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            paddingHorizontal: 18,
            height: 48,
            borderRadius: radii.full,
            backgroundColor: colors.primary,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.25,
            shadowRadius: 8,
            elevation: 6,
          }}
          accessibilityLabel="Create new shift"
          accessibilityRole="button"
        >
          <Plus size={20} color={colors.textInverse} strokeWidth={2.5} />
          <Text style={{ fontSize: 13, fontWeight: '700', color: colors.textInverse }}>
            Create New Shift
          </Text>
        </TouchableOpacity>
      </View>
    </Screen>
  );
}
