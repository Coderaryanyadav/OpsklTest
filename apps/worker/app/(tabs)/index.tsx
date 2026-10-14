import { useState } from 'react';
import {
  View,
  Text,
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
} from '@opskil/design-system';
import { Job, formatINR, formatISTDate, formatTimeRange, formatDistance } from '@opskil/shared';
import { useAuth } from '@opskil/design-system';
import { useDiscoveryFeed } from '../../src/hooks/useDiscoveryFeed';
import { SwipeCard } from '../../src/components/SwipeCard';
import { CardActionControls } from '../../src/components/CardActionControls';
import { JobDetailSheet } from '../../src/components/JobDetailSheet';
import { FilterSheet } from '../../src/components/FilterSheet';
import { Bell, List, Layers, MapPin, SlidersHorizontal, AlertTriangle, CheckCircle2 } from 'lucide-react-native';
import { LocalityZone, MUMBAI_ZONES, estimateDistance } from '../../src/utils/location';

export default function WorkerDiscoverScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const { colors, spacing, radii, typography, isDark } = useOpsklTheme();

  const [activeZone, setActiveZone] = useState<LocalityZone>(MUMBAI_ZONES[0]);
  const [filterSheetVisible, setFilterSheetVisible] = useState(false);
  const [detailJob, setDetailJob] = useState<Job | null>(null);
  const [viewMode, setViewMode] = useState<'swipe' | 'list'>('swipe');

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
  } = useDiscoveryFeed(session?.user?.id ?? null);

  const handleApplyZone = (newFilters: any, zone: LocalityZone) => {
    setActiveZone(zone);
    setWorkerLocation(zone.coords);
    setFilters(newFilters);
  };

  const handleResetFilters = () => {
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
            <Badge label="MUMBAI" variant="success" size="sm" />
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
              { backgroundColor: colors.surfaceMuted, borderRadius: radii.full },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Open notifications"
          >
            <Bell size={18} color={colors.textPrimary} strokeWidth={2} />
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
              {activeZone.coords.name || 'BKC'}
            </Text>
            <SlidersHorizontal size={13} color={colors.textSecondary} strokeWidth={2} />
          </Pressable>
        </View>
      </View>

      {/* Failure Recovery Alert Banner (Protects against false-positive swipe success) */}
      {failedApplication && (
        <View style={[styles.failedBanner, { backgroundColor: isDark ? '#451A1A' : '#FEF2F2' }]}>
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
            <AlertTriangle size={18} color="#DC2626" strokeWidth={2.2} style={{ marginTop: 2 }} />
            <View style={{ flex: 1 }}>
              <Text style={styles.failedBannerTitle}>Application Incomplete</Text>
              <Text style={styles.failedBannerText}>
                {failedApplication.errorMessage}
              </Text>
            </View>
          </View>
          <View style={styles.failedBannerActions}>
            <Pressable
              onPress={onRestoreFailedCard}
              style={[styles.bannerBtn, styles.restoreBtn]}
              accessibilityRole="button"
              accessibilityLabel="Restore card to deck"
            >
              <Text style={styles.restoreBtnText}>Restore Card</Text>
            </Pressable>
            <Pressable
              onPress={onRetryFailedApplication}
              style={[styles.bannerBtn, styles.retryBtn]}
              accessibilityRole="button"
              accessibilityLabel="Retry application submission"
            >
              <Text style={styles.retryBtnText}>Retry</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* In-flight Submission Indicator */}
      {inFlightApplication && (
        <View style={[styles.inFlightBar, { backgroundColor: colors.primary }]}>
          <ActivityIndicator size="small" color="#FFFFFF" style={{ marginRight: 8 }} />
          <Text style={styles.inFlightText}>
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
        <View style={styles.centerContainer}>
          <AlertTriangle size={36} color={colors.danger} strokeWidth={2} />
          <Text style={[typography.h3, { color: colors.textPrimary, marginTop: spacing.sm }]}>
            Connection Error
          </Text>
          <Text style={{ fontSize: 13, color: colors.textSecondary, textAlign: 'center', marginHorizontal: 32, marginTop: 4 }}>
            {error}
          </Text>
          <View style={{ marginTop: spacing.md }}>
            <Button title="Retry Connection" variant="primary" size="md" onPress={onRefresh} />
          </View>
        </View>
      ) : cards.length === 0 ? (
        /* Empty State */
        <ScrollView
          contentContainerStyle={[styles.centerContainer, { padding: spacing.xl }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          <CheckCircle2 size={44} color={colors.textPrimary} strokeWidth={1.8} />
          <Text style={[typography.h3, { color: colors.textPrimary, marginTop: spacing.md, textAlign: 'center' }]}>
            All Caught Up
          </Text>
          <Text style={{ fontSize: 14, color: colors.textSecondary, textAlign: 'center', marginTop: 6, lineHeight: 20 }}>
            You have reviewed all available shifts in {activeZone.label}. Expand your filters or check back shortly for newly published events.
          </Text>

          <View style={{ gap: spacing.sm, marginTop: spacing.xl, width: '100%', maxWidth: 280 }}>
            <Button
              title="Change Locality / Filters"
              variant="primary"
              size="lg"
              onPress={() => setFilterSheetVisible(true)}
            />
            {passedHistory.length > 0 && (
              <Button
                title={`Undo Last Pass (${passedHistory.length} skipped)`}
                variant="secondary"
                size="lg"
                onPress={onUndo}
              />
            )}
            <Button
              title="Refresh Shift Deck"
              variant="outline"
              size="md"
              onPress={onRefresh}
            />
          </View>
        </ScrollView>
      ) : viewMode === 'swipe' ? (
        /* SWIPE DECK VIEW */
        <View style={styles.deckWrapper}>
          {/* Feed Count Indicator */}
          <View style={styles.deckStatsRow}>
            <Text style={{ fontSize: 12, color: colors.textMuted }}>
              Showing {cards.length} verified shifts • Swipe right to apply, left to pass
            </Text>
            {passedHistory.length > 0 && (
              <Pressable onPress={onUndo}>
                <Text style={{ fontSize: 12, color: colors.primary, fontWeight: '700' }}>
                  ↺ Undo ({passedHistory.length})
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
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={[typography.caption, { color: colors.textMuted }]}>
              {cards.length} shifts open in {activeZone.label}
            </Text>
            <Text style={{ fontSize: 11, color: colors.textSecondary, fontWeight: '600' }}>
              Escrow-Protected Payouts
            </Text>
          </View>

          {cards.map((shift) => {
            const isApplied = appliedJobIds.has(shift.id);
            const dist = estimateDistance(workerLocation, shift.latitude, shift.longitude);
            return (
              <Card
                key={shift.id}
                variant="elevated"
                style={{ borderRadius: radii.xl, padding: spacing.lg }}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <View>
                    <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
                      <WageText>{formatINR(shift.totalPay)}</WageText>
                      <Text style={{ fontSize: 13, color: colors.textMuted, marginLeft: 6 }}>
                        ({formatINR(shift.hourlyRate)}/hr • {shift.durationHours}h)
                      </Text>
                    </View>
                    <Text style={{ fontSize: 12, color: colors.success, fontWeight: '700', marginTop: 2 }}>
                      ✓ UPI payout on verified attendance sign-off
                    </Text>
                  </View>
                  <Badge label={shift.category.toUpperCase()} variant="primary" size="sm" />
                </View>

                <Text style={[typography.h3, { color: colors.textPrimary, marginTop: spacing.xs }]} numberOfLines={1}>
                  {shift.title}
                </Text>
                <Text style={{ fontSize: 13, color: colors.textSecondary }}>
                  {shift.organizer?.businessName || 'Organizer details unavailable'}
                </Text>

                <View style={{ backgroundColor: colors.surfaceMuted, borderRadius: radii.md, padding: spacing.sm, marginTop: spacing.md, gap: 4 }}>
                  <Text style={{ fontSize: 13, color: colors.textPrimary, fontWeight: '600' }}>
                    📍 {shift.venueName}
                  </Text>
                  <Text style={{ fontSize: 12, color: colors.textMuted }}>
                    {shift.zone} • {formatDistance(dist)}
                  </Text>
                  <Text style={{ fontSize: 12, color: colors.textSecondary }}>
                    ⏰ {formatISTDate(shift.date)} • {formatTimeRange(shift.startTime, shift.endTime)}
                  </Text>
                </View>

                <View style={{ flexDirection: 'row', gap: 10, marginTop: spacing.md }}>
                  <View style={{ flex: 1 }}>
                    <Button
                      title="Details"
                      variant="outline"
                      size="md"
                      onPress={() => router.push(`/shift/${shift.id}` as any)}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Button
                      title="✕ Pass"
                      variant="secondary"
                      size="md"
                      onPress={() => onPass(shift)}
                    />
                  </View>
                  <View style={{ flex: 1.5 }}>
                    <Button
                      title={isApplied ? '✓ Applied' : '✓ Apply'}
                      variant="primary"
                      size="md"
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
  failedBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#EF4444',
  },
  failedBannerTitle: {
    color: '#EF4444',
    fontSize: 13,
    fontWeight: '800',
  },
  failedBannerText: {
    color: '#B91C1C',
    fontSize: 12,
    marginTop: 1,
  },
  failedBannerActions: {
    flexDirection: 'row',
    gap: 8,
    marginLeft: 8,
  },
  bannerBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  restoreBtn: {
    backgroundColor: '#E2E8F0',
  },
  restoreBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
  },
  retryBtn: {
    backgroundColor: '#EF4444',
  },
  retryBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  inFlightBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  inFlightText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
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
