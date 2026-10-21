import { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Pressable,
  RefreshControl,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  useOpsklTheme,
  Badge,
  Button,
  Card,
  WageText,
  ShiftCardSkeleton,
  ErrorRetry,
  InlineBanner,
} from '@opskil/design-system';
import { Job, formatINR, formatISTDate, formatTimeRange, formatDistance, fetchUnreadNotificationsCount } from '@opskil/shared';
import { useAuth } from '@opskil/design-system';
import { useDiscoveryFeed } from '../../src/hooks/useDiscoveryFeed';
import { SwipeCard } from '../../src/components/SwipeCard';
import { CardActionControls } from '../../src/components/CardActionControls';
import { JobDetailSheet } from '../../src/components/JobDetailSheet';
import { FilterSheet } from '../../src/components/FilterSheet';
import {
  Bell,
  List,
  Layers,
  MapPin,
  SlidersHorizontal,
  Search,
  RefreshCw,
  X,
  ShieldCheck,
  Clock,
  Zap,
  CheckCircle2,
  Shirt,
  Utensils,
} from 'lucide-react-native';
import { LocalityZone, MUMBAI_ZONES, estimateDistance } from '../../src/utils/location';

export default function WorkerDiscoverScreen() {
  const router = useRouter();
  const { session, workerProfile } = useAuth();
  const { colors, spacing, radii, typography } = useOpsklTheme();

  const [activeZone, setActiveZone] = useState<LocalityZone>(MUMBAI_ZONES[0]);
  const [filterSheetVisible, setFilterSheetVisible] = useState(false);
  const [detailJob, setDetailJob] = useState<Job | null>(null);
  const [viewMode, setViewMode] = useState<'swipe' | 'list'>('swipe');
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date>(new Date());
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [searchQuery, setSearchQuery] = useState<string>('');

  useEffect(() => {
    if (!session?.user?.id) {
      setUnreadCount(0);
      return;
    }
    fetchUnreadNotificationsCount(session.user.id)
      .then((c) => setUnreadCount(c))
      .catch(() => {});
  }, [session?.user?.id]);

  const {
    cards,
    currentCard,
    nextCard,
    passedHistory,
    appliedJobIds,
    loading,
    refreshing,
    error,
    filters,
    workerLocation,
    failedApplication,
    inFlightApplication,
    setFilters,
    setWorkerLocation,
    onApply,
    onPass,
    onUndo,
    onRestoreFailedCard,
    onRetryFailedApplication,
    onRefresh,
  } = useDiscoveryFeed(session?.user?.id ?? null, workerProfile?.verificationStatus);

  const displayedCards = useMemo(() => {
    if (!searchQuery.trim()) return cards;
    const q = searchQuery.toLowerCase().trim();
    return cards.filter((shift) => {
      return (
        shift.title?.toLowerCase().includes(q) ||
        shift.venueName?.toLowerCase().includes(q) ||
        shift.venueAddress?.toLowerCase().includes(q) ||
        shift.organizer?.businessName?.toLowerCase().includes(q) ||
        shift.category?.toLowerCase().includes(q) ||
        shift.zone?.toLowerCase().includes(q)
      );
    });
  }, [cards, searchQuery]);

  const handleRefresh = async () => {
    setLastRefreshedAt(new Date());
    await onRefresh();
  };

  const hasActiveFilters = Boolean(
    (filters.category && filters.category !== 'all') ||
    filters.minWage ||
    filters.requiredSkill ||
    activeZone.id !== MUMBAI_ZONES[0].id ||
    searchQuery.trim().length > 0
  );

  const handleApplyZone = (newFilters: any, zone: LocalityZone) => {
    setActiveZone(zone);
    setWorkerLocation(zone.coords);
    setFilters(newFilters);
  };

  const handleResetFilters = () => {
    setSearchQuery('');
    setActiveZone(MUMBAI_ZONES[0]);
    setWorkerLocation(MUMBAI_ZONES[0].coords);
    setFilters({ category: 'all', zone: undefined, minWage: undefined, requiredSkill: undefined });
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      {/* Top Navigation & Status Bar */}
      <View
        style={[
          styles.headerBar,
          {
            backgroundColor: colors.surface,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <View style={styles.headerLeft}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={[styles.brandTitle, { color: colors.primary }]}>OPSKL WORKER</Text>
            <Badge label="MUMBAI" variant="neutral" size="sm" />
          </View>
          <Text style={[typography.h2, { color: colors.textPrimary, marginTop: 2 }]}>
            Shift Discovery
          </Text>
        </View>

        <View style={styles.headerRight}>
          {/* Notifications Button */}
          <Pressable
            onPress={() => router.push('/notifications')}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={[
              styles.iconBtn,
              { backgroundColor: colors.surfaceMuted, borderRadius: radii.full, position: 'relative' },
            ]}
            accessibilityRole="button"
            accessibilityLabel={unreadCount > 0 ? `Open notifications, ${unreadCount} unread` : 'Open notifications'}
          >
            <Bell size={18} color={colors.textPrimary} strokeWidth={2} />
            {unreadCount > 0 && (
              <View
                style={{
                  position: 'absolute',
                  top: 2,
                  right: 2,
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: colors.primary,
                }}
              />
            )}
          </Pressable>

          {/* View Mode Toggle (Swipe vs List for Accessibility) */}
          <Pressable
            onPress={() => setViewMode((prev) => (prev === 'swipe' ? 'list' : 'swipe'))}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={[
              styles.iconBtn,
              { backgroundColor: colors.surfaceMuted, borderRadius: radii.full },
            ]}
            accessibilityRole="button"
            accessibilityLabel={`Switch to ${viewMode === 'swipe' ? 'List' : 'Swipe'} view`}
          >
            {viewMode === 'swipe' ? (
              <List size={18} color={colors.textPrimary} strokeWidth={2} />
            ) : (
              <Layers size={18} color={colors.textPrimary} strokeWidth={2} />
            )}
          </Pressable>

          {/* Filter Trigger Button */}
          <Pressable
            onPress={() => setFilterSheetVisible(true)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={[
              styles.filterBtn,
              {
                backgroundColor: colors.surfaceMuted,
                borderRadius: radii.full,
                borderColor: colors.border,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 5,
                paddingHorizontal: 12,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Open filters"
          >
            <MapPin size={13} color={colors.primary} strokeWidth={2.2} />
            <Text style={{ fontSize: 13, color: colors.textPrimary, fontWeight: '600' }}>
              {activeZone.id === 'all' ? 'All Mumbai' : (activeZone.coords.name || activeZone.label)}
            </Text>
            <SlidersHorizontal size={13} color={colors.textSecondary} strokeWidth={2} />
          </Pressable>
        </View>
      </View>

      {/* KYC Verification Status Banner */}
      {session?.user?.id && workerProfile && workerProfile.verificationStatus !== 'verified' && (
        <View style={{ paddingHorizontal: spacing.md, paddingTop: 8 }}>
          <View
            style={[
              styles.kycBannerCard,
              { backgroundColor: colors.surfaceMuted, borderColor: colors.border, borderRadius: radii.xl },
            ]}
          >
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
              <View style={[styles.kycIconCircle, { backgroundColor: colors.surface, borderRadius: radii.full }]}>
                <ShieldCheck size={18} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <Badge
                    label={workerProfile.verificationStatus === 'pending' ? 'KYC UNDER REVIEW' : 'KYC REQUIRED'}
                    variant={workerProfile.verificationStatus === 'pending' ? 'neutral' : 'warning'}
                    size="sm"
                  />
                  {workerProfile.verificationStatus === 'pending' && workerProfile.id ? (
                    <Text style={{ fontSize: 11, fontFamily: 'monospace', color: colors.textSecondary }}>
                      Case ···{String(workerProfile.id).slice(-4)}
                    </Text>
                  ) : null}
                </View>
                <Text style={{ fontSize: 13, fontWeight: '700', color: colors.textPrimary, marginTop: 4 }}>
                  {workerProfile.verificationStatus === 'pending'
                    ? 'KYC Under Review • Browsing is active'
                    : 'Identity Verification Required'}
                </Text>
                <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2, lineHeight: 17 }}>
                  {workerProfile.verificationStatus === 'pending'
                    ? 'Applications unlock after an admin approves your documents. No OCR or bank penny-drop is connected.'
                    : 'Submit government identity documents under Profile to apply for shifts.'}
                </Text>
              </View>
              <Pressable
                onPress={() => router.push('/(tabs)/profile' as any)}
                hitSlop={8}
                accessibilityRole="link"
                accessibilityLabel="Open profile to submit KYC"
                style={{ minHeight: 44, justifyContent: 'center' }}
              >
                <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textPrimary, textDecorationLine: 'underline' }}>
                  Profile
                </Text>
              </Pressable>
            </View>

            {workerProfile.verificationStatus === 'pending' && (
              <View style={{ marginTop: 10, paddingTop: 4 }}>
                <Text style={{ fontSize: 11, color: colors.textSecondary }}>
                  Verification status: pending admin review (no OCR engine connected)
                </Text>
              </View>
            )}
          </View>
        </View>
      )}

      {/* Search Bar & Tune Filter Trigger */}
      <View style={{ paddingHorizontal: spacing.md, paddingTop: 10, paddingBottom: 4 }}>
        <View style={[styles.searchInputWrapper, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radii.lg }]}>
          <Search size={18} color={colors.textSecondary} style={{ marginLeft: 12, marginRight: 8 }} />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search by venue, role or organizer..."
            placeholderTextColor={colors.textMuted}
            style={[styles.searchInput, { color: colors.textPrimary }]}
            returnKeyType="search"
            accessibilityLabel="Search shifts input"
          />
          {searchQuery.length > 0 && (
            <Pressable
              onPress={() => setSearchQuery('')}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Clear search text"
              style={{ padding: 6, marginRight: 2 }}
            >
              <X size={16} color={colors.textSecondary} />
            </Pressable>
          )}
          <Pressable
            onPress={() => setFilterSheetVisible(true)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Open filter sheet"
            style={{ padding: 8, marginRight: 4 }}
          >
            <SlidersHorizontal size={18} color={hasActiveFilters ? colors.primary : colors.textSecondary} />
          </Pressable>
        </View>
      </View>

      {/* Stitch Quick Filter Chips Strip */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: spacing.md, gap: 8, paddingVertical: 8 }}
        style={{ flexGrow: 0 }}
      >
        <Pressable
          onPress={handleResetFilters}
          style={[
            styles.quickFilterChip,
            {
              backgroundColor: !hasActiveFilters ? colors.primary : colors.surface,
              borderColor: colors.border,
            },
          ]}
        >
          <Text
            style={{
              fontSize: 12,
              fontWeight: '700',
              color: !hasActiveFilters ? colors.textInverse : colors.textPrimary,
            }}
          >
            All Venues
          </Text>
        </Pressable>

        <Pressable
          onPress={() => setFilters({ ...filters, minWage: 2000 })}
          style={[
            styles.quickFilterChip,
            {
              backgroundColor: filters.minWage === 2000 ? colors.primary : colors.surface,
              borderColor: colors.border,
            },
          ]}
        >
          <Text
            style={{
              fontSize: 12,
              fontWeight: '700',
              color: filters.minWage === 2000 ? colors.textInverse : colors.textPrimary,
            }}
          >
            <Text style={{ color: colors.accent, fontWeight: '800' }}>₹ </Text>
            ₹2,000+ / shift
          </Text>
        </Pressable>

        <Pressable
          onPress={() => {
            const bkcZone = MUMBAI_ZONES.find((z) => z.id === 'bkc') || MUMBAI_ZONES[1];
            handleApplyZone({ ...filters, zone: 'bkc' }, bkcZone);
          }}
          style={[
            styles.quickFilterChip,
            {
              backgroundColor: activeZone.id === 'bkc' ? colors.primary : colors.surface,
              borderColor: colors.border,
            },
          ]}
        >
          <Text
            style={{
              fontSize: 12,
              fontWeight: '700',
              color: activeZone.id === 'bkc' ? colors.textInverse : colors.textPrimary,
            }}
          >
            BKC (Jio World)
          </Text>
        </Pressable>

        <Pressable
          onPress={() => {
            const nescoZone = MUMBAI_ZONES.find((z) => z.id === 'goregaon') || MUMBAI_ZONES[2];
            handleApplyZone({ ...filters, zone: 'goregaon' }, nescoZone);
          }}
          style={[
            styles.quickFilterChip,
            {
              backgroundColor: activeZone.id === 'goregaon' ? colors.primary : colors.surface,
              borderColor: colors.border,
            },
          ]}
        >
          <Text
            style={{
              fontSize: 12,
              fontWeight: '700',
              color: activeZone.id === 'goregaon' ? colors.textInverse : colors.textPrimary,
            }}
          >
            NESCO Goregaon
          </Text>
        </Pressable>

        <Pressable
          onPress={() => setFilters({ ...filters, category: 'hospitality' })}
          style={[
            styles.quickFilterChip,
            {
              backgroundColor: filters.category === 'hospitality' ? colors.primary : colors.surface,
              borderColor: colors.border,
            },
          ]}
        >
          <Text
            style={{
              fontSize: 12,
              fontWeight: '700',
              color: filters.category === 'hospitality' ? colors.textInverse : colors.textPrimary,
            }}
          >
            Hospitality
          </Text>
        </Pressable>
      </ScrollView>

      {/* Operational Feed Header & Locality Summary */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: 4 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={{ fontSize: 11, fontWeight: '800', color: colors.textPrimary, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Available Shifts
          </Text>
          <View style={{ backgroundColor: colors.surfaceMuted, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 9999, borderWidth: 1, borderColor: colors.border }}>
            <Text style={{ fontSize: 10, fontWeight: '700', color: colors.accent }}>{displayedCards.length} LIVE</Text>
          </View>
        </View>
        <Text style={{ fontSize: 11, color: colors.textSecondary, fontWeight: '500' }}>
          Refreshed just now
        </Text>
      </View>

      {/* Failure Recovery Alert Banner (Protects against false-positive swipe success) */}
      {failedApplication && (
        <InlineBanner
          variant="error"
          title={
            failedApplication.errorCode === 'AUTH_REQUIRED'
              ? 'Sign In Required'
              : failedApplication.errorCode === 'KYC_REQUIRED'
              ? 'KYC Approval Required'
              : 'Application Incomplete'
          }
          message={failedApplication.errorMessage}
          actionLabel={
            failedApplication.errorCode === 'AUTH_REQUIRED'
              ? 'Sign In'
              : failedApplication.errorCode === 'KYC_REQUIRED'
              ? 'View KYC'
              : 'Retry'
          }
          onAction={() => {
            if (failedApplication.errorCode === 'AUTH_REQUIRED') {
              const targetJobId = failedApplication.job.id;
              onRestoreFailedCard();
              router.push(`/auth/login?redirect=${encodeURIComponent(`/shift/${targetJobId}`)}` as any);
            } else if (failedApplication.errorCode === 'KYC_REQUIRED') {
              onRestoreFailedCard();
              router.push('/(tabs)/profile' as any);
            } else {
              onRetryFailedApplication();
            }
          }}
          onDismiss={onRestoreFailedCard}
        />
      )}

      {/* In-flight Submission Indicator */}
      {inFlightApplication && (
        <View style={[styles.inFlightBar, { backgroundColor: colors.primary }]}>
          <ActivityIndicator size="small" color={colors.textInverse} style={{ marginRight: 8 }} />
          <Text style={[styles.inFlightText, { color: colors.textInverse }]}>
            Submitting application for {inFlightApplication.title}...
          </Text>
        </View>
      )}

      {/* Main Content Area */}
      {loading ? (
        <View style={{ flex: 1, padding: spacing.xl, justifyContent: 'center' }}>
          <ShiftCardSkeleton />
          <Text style={[typography.caption, { color: colors.textMuted, textAlign: 'center', marginTop: spacing.sm }]}>
            Scanning verified shifts in {activeZone.label}…
          </Text>
        </View>
      ) : error ? (
        <View style={[styles.centerContainer, { padding: spacing.xl }]}>
          <ErrorRetry
            variant="block"
            title="Connection Error"
            message={error}
            onRetry={onRefresh}
            retryLabel="Retry Connection"
          />
        </View>
      ) : displayedCards.length === 0 ? (
        /* Redesigned Compact Reassurance Empty State */
        <ScrollView
          contentContainerStyle={[styles.emptyContainer, { padding: spacing.lg }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        >
          <View style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radii.xl }]}>
            <View style={[styles.emptyIconCircle, { backgroundColor: colors.surfaceMuted, borderRadius: radii.full }]}>
              {searchQuery.trim().length > 0 ? (
                <Search size={26} color={colors.textPrimary} strokeWidth={2} />
              ) : hasActiveFilters ? (
                <SlidersHorizontal size={26} color={colors.textPrimary} strokeWidth={2} />
              ) : (
                <MapPin size={26} color={colors.textPrimary} strokeWidth={2} />
              )}
            </View>

            <Text style={[typography.h3, { color: colors.textPrimary, textAlign: 'center', marginTop: spacing.md }]}>
              {searchQuery.trim().length > 0
                ? `No Shifts Match "${searchQuery}"`
                : hasActiveFilters
                ? 'No Shifts Match Current Filters'
                : `No Shifts Currently in ${activeZone.coords.name || 'this Locality'}`}
            </Text>

            <Text style={{ fontSize: 13, color: colors.textSecondary, textAlign: 'center', marginTop: 6, lineHeight: 19, maxWidth: 300 }}>
              {searchQuery.trim().length > 0
                ? 'Try broadening your search term or clearing active filters to see available shifts.'
                : hasActiveFilters
                ? `No published shifts match your selected criteria in ${activeZone.label}. Try adjusting filters or expanding your search.`
                : `There are currently no verified shifts posted in ${activeZone.label}. Organizers publish new shifts daily.`}
            </Text>

            {/* Active Filters Summary Chips */}
            {hasActiveFilters && (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center', marginTop: spacing.md }}>
                {searchQuery.trim().length > 0 && (
                  <Badge label={`Search: "${searchQuery}"`} variant="primary" size="sm" />
                )}
                {filters.category && filters.category !== 'all' && (
                  <Badge label={`Category: ${filters.category.toUpperCase()}`} variant="neutral" size="sm" />
                )}
                {filters.minWage && (
                  <Badge label={`Min ₹${filters.minWage}/hr`} variant="neutral" size="sm" />
                )}
                {filters.requiredSkill && (
                  <Badge label={`Skill: ${filters.requiredSkill}`} variant="neutral" size="sm" />
                )}
                {activeZone.id !== MUMBAI_ZONES[0].id && (
                  <Badge label={`Zone: ${activeZone.coords.name || activeZone.id}`} variant="neutral" size="sm" />
                )}
              </View>
            )}

            {/* Nearby Locality Suggestions */}
            <View style={{ width: '100%', marginTop: spacing.lg, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border }}>
              <Text style={{ fontSize: 11, fontWeight: '700', textTransform: 'uppercase', color: colors.textMuted, textAlign: 'center', letterSpacing: 0.5 }}>
                Try Nearby Localities
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center', marginTop: spacing.xs }}>
                {MUMBAI_ZONES.filter((z) => z.id !== activeZone.id).slice(0, 3).map((zone) => (
                  <Pressable
                    key={zone.id}
                    onPress={() => handleApplyZone({ ...filters, zone: zone.id }, zone)}
                    style={({ pressed }) => [
                      styles.zonePill,
                      {
                        backgroundColor: colors.surfaceMuted,
                        borderColor: colors.border,
                        borderRadius: radii.full,
                        opacity: pressed ? 0.7 : 1,
                      },
                    ]}
                  >
                    <MapPin size={11} color={colors.textSecondary} strokeWidth={2} style={{ marginRight: 4 }} />
                    <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textPrimary }}>
                      {zone.coords.name || zone.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Primary & Secondary Actions */}
            <View style={{ gap: spacing.sm, marginTop: spacing.lg, width: '100%' }}>
              <Button
                title={hasActiveFilters ? "Clear Restrictive Filters" : "Change Filters / Locality"}
                variant="primary"
                size="md"
                onPress={hasActiveFilters ? handleResetFilters : () => setFilterSheetVisible(true)}
              />

              {hasActiveFilters && (
                <Button
                  title="Modify Filter Settings"
                  variant="outline"
                  size="md"
                  onPress={() => setFilterSheetVisible(true)}
                />
              )}

              {passedHistory.length > 0 && (
                <Button
                  title={`Undo Passed Shifts (${passedHistory.length} skipped)`}
                  variant="secondary"
                  size="md"
                  onPress={onUndo}
                />
              )}

              <Pressable
                onPress={handleRefresh}
                style={({ pressed }) => [
                  styles.refreshRow,
                  { opacity: pressed ? 0.6 : 1 },
                ]}
                accessibilityRole="button"
                accessibilityLabel="Refresh shift feed"
              >
                <RefreshCw size={13} color={colors.textSecondary} strokeWidth={2} style={{ marginRight: 6 }} />
                <Text style={{ fontSize: 12, color: colors.textSecondary, fontWeight: '600' }}>
                  {refreshing ? 'Updating feed…' : `Refresh • Updated ${lastRefreshedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                </Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      ) : viewMode === 'swipe' ? (
        /* SWIPE DECK VIEW */
        <View style={styles.deckWrapper}>
          {/* Feed Count Indicator */}
          <View style={styles.deckStatsRow}>
            <Text style={{ fontSize: 12, color: colors.textMuted }}>
              Showing {displayedCards.length} verified shifts • Swipe right to apply, left to pass
            </Text>
            {passedHistory.length > 0 && (
              <Pressable
                onPress={onUndo}
                accessibilityRole="button"
                accessibilityLabel={`Undo last pass, ${passedHistory.length} available`}
                style={{ minHeight: 44, justifyContent: 'center' }}
              >
                <Text style={{ fontSize: 12, color: colors.primary, fontWeight: '700' }}>
                  Undo ({passedHistory.length})
                </Text>
              </Pressable>
            )}
          </View>

          {/* Card Stack Container */}
          <View style={styles.deckArea}>
            {/* Next Card in Stack (Visual Depth) */}
            {nextCard && (
              <View style={[StyleSheet.absoluteFill, styles.underCard]}>
                <SwipeCard
                  key={nextCard.id}
                  job={nextCard}
                  workerLocation={workerLocation}
                  onSwipeRight={() => {}}
                  onSwipeLeft={() => {}}
                  onPressDetails={setDetailJob}
                  isTopCard={false}
                />
              </View>
            )}

            {/* Current Top Card (Interactive Gesture Handler) */}
            {currentCard && (
              <SwipeCard
                key={currentCard.id}
                job={currentCard}
                workerLocation={workerLocation}
                onSwipeRight={onApply}
                onSwipeLeft={onPass}
                onPressDetails={setDetailJob}
                isTopCard={true}
                disabled={Boolean(inFlightApplication)}
              />
            )}
          </View>

          {/* Visible Bottom Action Controls */}
          {currentCard && (
            <CardActionControls
              canUndo={passedHistory.length > 0}
              disabled={Boolean(inFlightApplication)}
              onPass={() => onPass(currentCard)}
              onApply={() => onApply(currentCard)}
              onUndo={onUndo}
              onDetails={() => setDetailJob(currentCard)}
            />
          )}
        </View>
      ) : (
        /* ACCESSIBLE LIST VIEW FALLBACK */
        <ScrollView
          contentContainerStyle={{ padding: spacing.md, gap: spacing.md }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={[typography.caption, { color: colors.textMuted }]}>
              {displayedCards.length} shifts open in {activeZone.label}
            </Text>
            <Text style={{ fontSize: 11, color: colors.textSecondary, fontWeight: '600' }}>
              Pay after attendance approval
            </Text>
          </View>

          {displayedCards.map((shift) => {
            const isApplied = appliedJobIds.has(shift.id);
            const dist = estimateDistance(workerLocation, shift.latitude, shift.longitude);
            const slotsRemaining = Math.max(0, (shift.slotsTotal || 1) - (shift.slotsFilled || 0));

            return (
              <Card
                key={shift.id}
                variant="elevated"
                style={{ borderRadius: radii.xl, padding: spacing.md, borderWidth: 1, borderColor: colors.border }}
              >
                {/* Status Badges Row */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  {isApplied ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.surfaceMuted, paddingHorizontal: 8, paddingVertical: 3, borderRadius: radii.full }}>
                      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.textSecondary }} />
                      <Text style={{ fontSize: 10, fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase' }}>
                        APPLICATION SUBMITTED • UNDER REVIEW
                      </Text>
                    </View>
                  ) : (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.surfaceMuted, paddingHorizontal: 8, paddingVertical: 3, borderRadius: radii.full }}>
                      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.primary }} />
                      <Text style={{ fontSize: 10, fontWeight: '700', color: colors.primary, textTransform: 'uppercase' }}>
                        OPEN • {slotsRemaining} SLOTS LEFT
                      </Text>
                    </View>
                  )}

                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.surfaceMuted, paddingHorizontal: 8, paddingVertical: 3, borderRadius: radii.full }}>
                    <Zap size={11} color={colors.primary} />
                    <Text style={{ fontSize: 10, fontWeight: '700', color: colors.textPrimary }}>Wage shown</Text>
                  </View>
                </View>

                {/* Compensation & Rate */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 2 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
                    <WageText style={{ fontSize: 22, fontWeight: '800' }}>{formatINR(shift.totalPay)}</WageText>
                    <Text style={{ fontSize: 12, color: colors.textSecondary, marginLeft: 4 }}>/ shift</Text>
                  </View>
                  <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textSecondary }}>
                    {formatINR(shift.hourlyRate)}/hr ({shift.durationHours}h)
                  </Text>
                </View>

                {/* Title & Organizer */}
                <Text style={[typography.h3, { color: colors.textPrimary, marginTop: 6 }]} numberOfLines={2}>
                  {shift.title}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 }}>
                  <Text style={{ fontSize: 13, color: colors.textSecondary, fontWeight: '500' }}>
                    {shift.organizer?.businessName || 'Verified Corporate Enterprise'}
                  </Text>
                  <CheckCircle2 size={13} color={colors.primary} strokeWidth={2.5} />
                  <Text style={{ fontSize: 11, color: colors.textMuted }}>• Verified</Text>
                </View>

                {/* Venue & Schedule Box */}
                <View style={{ backgroundColor: colors.surfaceMuted, borderRadius: radii.md, padding: 10, marginTop: 10, gap: 4 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6 }}>
                    <MapPin size={14} color={colors.primary} style={{ marginTop: 2 }} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textPrimary }}>
                        {shift.venueName}
                      </Text>
                      <Text style={{ fontSize: 11, color: colors.textSecondary }}>
                        {shift.zone} {workerLocation ? `• ${formatDistance(dist)}` : ''}
                      </Text>
                    </View>
                  </View>

                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                    <Clock size={14} color={colors.textSecondary} />
                    <Text style={{ fontSize: 11, color: colors.textSecondary }}>
                      {formatISTDate(shift.date)} • {formatTimeRange(shift.startTime, shift.endTime)} IST
                    </Text>
                  </View>
                </View>

                {/* Perks & Criteria Chips */}
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                  {shift.dressCode && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.surfaceMuted, paddingHorizontal: 7, paddingVertical: 3, borderRadius: radii.full }}>
                      <Shirt size={10} color={colors.textSecondary} />
                      <Text style={{ fontSize: 10, color: colors.textSecondary, fontWeight: '600' }} numberOfLines={1}>
                        {shift.dressCode}
                      </Text>
                    </View>
                  )}
                  {shift.mealProvided && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.surfaceMuted, paddingHorizontal: 7, paddingVertical: 3, borderRadius: radii.full }}>
                      <Utensils size={10} color={colors.textSecondary} />
                      <Text style={{ fontSize: 10, color: colors.textSecondary, fontWeight: '600' }}>
                        Meals Provided
                      </Text>
                    </View>
                  )}
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.surfaceMuted, paddingHorizontal: 7, paddingVertical: 3, borderRadius: radii.full }}>
                    <ShieldCheck size={10} color={colors.textSecondary} />
                    <Text style={{ fontSize: 10, color: colors.textSecondary, fontWeight: '600' }}>
                      Air-Conditioned Hall
                    </Text>
                  </View>
                </View>

                {/* Card Actions */}
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
                  <View style={{ flex: 1 }}>
                    <Button
                      title="Details"
                      variant="outline"
                      size="sm"
                      onPress={() => router.push(`/shift/${shift.id}` as any)}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Button
                      title="✕ Pass"
                      variant="secondary"
                      size="sm"
                      onPress={() => onPass(shift)}
                    />
                  </View>
                  <View style={{ flex: 1.5 }}>
                    <Button
                      title={isApplied ? '✓ Applied' : '✓ Apply'}
                      variant="primary"
                      size="sm"
                      disabled={isApplied}
                      onPress={() => onApply(shift)}
                    />
                  </View>
                </View>
              </Card>
            );
          })}
        </ScrollView>
      )}

      {/* Full Shift Detail Bottom Sheet */}
      <JobDetailSheet
        job={detailJob}
        visible={Boolean(detailJob)}
        workerLocation={workerLocation}
        onClose={() => setDetailJob(null)}
        onApply={(job) => {
          onApply(job);
          setDetailJob(null);
        }}
        onPass={(job) => {
          onPass(job);
          setDetailJob(null);
        }}
      />

      {/* Filter & Locality Sheet */}
      <FilterSheet
        visible={filterSheetVisible}
        currentFilters={filters}
        currentZone={activeZone}
        onClose={() => setFilterSheetVisible(false)}
        onApplyFilters={handleApplyZone}
        onResetFilters={handleResetFilters}
        availableShiftCount={displayedCards.length}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  headerBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  headerLeft: {
    flex: 1,
  },
  brandTitle: {
    fontSize: 13,
    fontWeight: '800',
    marginRight: 6,
    letterSpacing: 0.5,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterBtn: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 1,
  },
  quickFilterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    minHeight: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kycBannerCard: {
    padding: 12,
    borderWidth: 1,
  },
  kycIconCircle: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  searchInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    minHeight: 44,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 8,
  },
  inFlightBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  inFlightText: {
    fontSize: 12,
    fontWeight: '600',
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyContainer: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  emptyCard: {
    width: '100%',
    maxWidth: 380,
    padding: 24,
    borderWidth: 1,
    alignItems: 'center',
  },
  emptyIconCircle: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  zonePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
  },
  refreshRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  deckWrapper: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 8,
    justifyContent: 'space-between',
  },
  deckStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  deckArea: {
    flex: 1,
    position: 'relative',
    justifyContent: 'center',
  },
  underCard: {
    zIndex: 0,
  },
});

