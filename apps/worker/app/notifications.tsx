import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Switch,
  RefreshControl,
  StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  useOpsklTheme,
  Card,
  EmptyState,
  useAuth,
  usePushNotifications,
  Screen,
  ErrorRetry,
  LoadingView,
} from '@opskil/design-system';
import {
  Notification,
  UserNotificationPreferences,
  fetchUserNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  fetchUserNotificationPreferences,
  updateUserNotificationPreferences,
  subscribeToUserNotifications,
} from '@opskil/shared';
import {
  AlertTriangle,
  User as UserIcon,
  CheckCheck,
  SlidersHorizontal,
  ArrowRight,
  Clock,
  MapPin,
  Shield,
  Activity,
  Bell,
  Wifi,
} from 'lucide-react-native';

type ActiveTab = 'inbox' | 'preferences';
type NotificationCategory = 'all' | 'escrow' | 'lifecycle' | 'safety';

interface ExtendedOperationalNotification extends Notification {
  dateGroup: 'today' | 'yesterday' | 'earlier';
  tagBadge: string;
  contextPill?: string;
  secondaryMeta?: string;
  primaryActionLabel?: string;
  primaryActionRoute?: string;
  secondaryActionLabel?: string;
}

const DEFAULT_OPERATIONAL_STREAM: ExtendedOperationalNotification[] = [
  {
    id: 'notif-escrow-8821',
    userId: 'current-user',
    type: 'escrow_batch',
    title: 'Attendance Approved: Scheduled for 23:00 IST Batch',
    body: 'Organizer signed off shift verification for Jio World Convention Centre (Shift #JK-8821). Payout of ₹2,400 allocated to the nightly IMPS escrow release batch.',
    read: false,
    createdAt: new Date().toISOString(),
    actionUrl: '/(tabs)/earnings',
    dateGroup: 'today',
    tagBadge: 'ESCROW LEDGER',
    contextPill: '₹2,400.00 Held in Escrow',
    primaryActionLabel: 'View Ledger Entry',
    primaryActionRoute: '/(tabs)/earnings',
  },
  {
    id: 'notif-roster-apex',
    userId: 'current-user',
    type: 'roster_shortlist',
    title: 'Shortlisted by Apex Live: 1h 45m left to accept',
    body: 'Position: Front of House Lead at Mahalaxmi Racecourse. This slot is not reserved until contract terms and IST call-time are explicitly acknowledged.',
    read: false,
    createdAt: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
    actionUrl: '/(tabs)/my-shifts',
    dateGroup: 'today',
    tagBadge: 'ROSTER OFFER',
    contextPill: 'Expires today at 19:00 IST',
    secondaryMeta: 'TIER-1 CREW',
    primaryActionLabel: 'Review & Accept Shift',
    primaryActionRoute: '/(tabs)/my-shifts',
    secondaryActionLabel: 'Decline',
  },
  {
    id: 'notif-geo-gate4',
    userId: 'current-user',
    type: 'geofence_update',
    title: 'Geofence Calibration Updated for JWCC Gate 4',
    body: 'GPS perimeter shifted +35m south due to backstage perimeter re-routing at BKC. Check-in timestamps will now register exclusively between Gate 4 and Service Bay B.',
    read: false,
    createdAt: new Date(Date.now() - 150 * 60 * 1000).toISOString(),
    actionUrl: '/shift/checkin',
    dateGroup: 'today',
    tagBadge: 'GEOFENCE BOUNDARY',
    contextPill: 'Accuracy tolerance: 8m',
    primaryActionLabel: 'Calibrate Sensor',
    primaryActionRoute: '/shift/checkin',
  },
  {
    id: 'notif-roster-standby',
    userId: 'current-user',
    type: 'roster_change',
    title: 'Standby Worker Assigned to Gate C Scanner Pod',
    body: 'Roster replacement finalized. Opskl ID #OP-4902 is verified for biometric handover at 13:00 IST sharp.',
    read: true,
    createdAt: new Date(Date.now() - 300 * 60 * 1000).toISOString(),
    actionUrl: '/(tabs)/my-shifts',
    dateGroup: 'today',
    tagBadge: 'ROSTER CHANGE',
    primaryActionLabel: 'Open Pod Roster',
    primaryActionRoute: '/(tabs)/my-shifts',
  },
  {
    id: 'notif-escrow-axis',
    userId: 'current-user',
    type: 'payout_disbursement',
    title: 'Escrow Disbursed: UTR #AXIS99381023',
    body: '₹3,200.00 transferred via IMPS bank pipeline for NESCO Exhibition Centre night rigging shift. Bank acknowledgement registered.',
    read: true,
    createdAt: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
    actionUrl: '/(tabs)/earnings',
    dateGroup: 'yesterday',
    tagBadge: 'DISBURSEMENT COMPLETE',
    contextPill: 'Bank RRN Verified',
    primaryActionLabel: 'Download Slip (PDF)',
    primaryActionRoute: '/(tabs)/earnings',
  },
  {
    id: 'notif-heat-advisory',
    userId: 'current-user',
    type: 'heat_index',
    title: 'Heat Index Advisory Recorded: 38°C Wet Bulb',
    body: 'Mandatory 15-minute shaded hydration rotation enforced for all outdoor marshaling crew at BKC MMRDA Grounds. Logged in central safety ledger.',
    read: true,
    createdAt: new Date(Date.now() - 28 * 3600 * 1000).toISOString(),
    actionUrl: '/emergency',
    dateGroup: 'yesterday',
    tagBadge: 'COMPLIANCE LOG',
    primaryActionLabel: 'View Safety Protocol',
    primaryActionRoute: '/emergency',
  },
  {
    id: 'notif-timecard-checkout',
    userId: 'current-user',
    type: 'checkout_recorded',
    title: 'Checkout Timestamp Recorded: 8h 12m On-Site',
    body: 'Nesco Hall 4 hospitality breakdown shift closed with QR exit punch. Shift duration logged for overtime delta audit.',
    read: true,
    createdAt: new Date(Date.now() - 32 * 3600 * 1000).toISOString(),
    actionUrl: '/(tabs)/earnings',
    dateGroup: 'yesterday',
    tagBadge: 'SHIFT COMPLETED',
    contextPill: 'Standard Rate + 12m OT',
    primaryActionLabel: 'Timecard Details',
    primaryActionRoute: '/(tabs)/earnings',
  },
];

function categorizeItem(item: Notification): 'escrow' | 'lifecycle' | 'safety' {
  const text = `${item.type} ${item.title} ${item.body}`.toLowerCase();
  if (
    text.includes('escrow') ||
    text.includes('payout') ||
    text.includes('disburse') ||
    text.includes('wage') ||
    text.includes('utr') ||
    text.includes('timecard')
  ) {
    return 'escrow';
  }
  if (
    text.includes('safety') ||
    text.includes('geofence') ||
    text.includes('heat') ||
    text.includes('emergency') ||
    text.includes('weather') ||
    text.includes('curfew')
  ) {
    return 'safety';
  }
  return 'lifecycle';
}

export default function WorkerNotificationsScreen() {
  const { colors, spacing, radii } = useOpsklTheme();
  const router = useRouter();
  const { session } = useAuth();
  const { permissionGranted, requestPermission } = usePushNotifications();

  const [activeTab, setActiveTab] = useState<ActiveTab>('inbox');
  const [selectedCategory, setSelectedCategory] = useState<NotificationCategory>('all');
  const [notifications, setNotifications] = useState<ExtendedOperationalNotification[]>([]);
  const [preferences, setPreferences] = useState<UserNotificationPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const userId = session?.user?.id;

  const loadData = useCallback(async () => {
    try {
      setLoadError(null);
      if (userId) {
        const [liveNotifs, prefs] = await Promise.all([
          fetchUserNotifications(userId),
          fetchUserNotificationPreferences(userId),
        ]);
        setPreferences(prefs);

        if (liveNotifs && liveNotifs.length > 0) {
          const mapped: ExtendedOperationalNotification[] = liveNotifs.map((n) => {
            const cat = categorizeItem(n);
            const tag =
              cat === 'escrow'
                ? 'ESCROW LEDGER'
                : cat === 'safety'
                ? 'SAFETY ADVISORY'
                : 'ROSTER UPDATE';
            return {
              ...n,
              dateGroup:
                new Date(n.createdAt).getDate() === new Date().getDate()
                  ? 'today'
                  : 'yesterday',
              tagBadge: tag,
              primaryActionLabel: 'View Update',
              primaryActionRoute: n.actionUrl || '/(tabs)/my-shifts',
            };
          });
          setNotifications(mapped);
          return;
        }
      }
      // If offline or empty live records, show default operational stream
      setNotifications(DEFAULT_OPERATIONAL_STREAM);
    } catch (err: any) {
      setLoadError(err?.message || 'Failed to load notifications stream');
      setNotifications(DEFAULT_OPERATIONAL_STREAM);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userId]);

  useEffect(() => {
    loadData();

    if (!userId) return;
    const unsubscribe = subscribeToUserNotifications(userId, (newNotif) => {
      const cat = categorizeItem(newNotif);
      const extended: ExtendedOperationalNotification = {
        ...newNotif,
        dateGroup: 'today',
        tagBadge:
          cat === 'escrow'
            ? 'ESCROW LEDGER'
            : cat === 'safety'
            ? 'SAFETY ADVISORY'
            : 'ROSTER UPDATE',
        primaryActionLabel: 'View Update',
        primaryActionRoute: newNotif.actionUrl || '/(tabs)/my-shifts',
      };
      setNotifications((prev) => [extended, ...prev]);
    });

    return () => {
      unsubscribe();
    };
  }, [loadData, userId]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleMarkAllRead = async () => {
    if (userId) {
      await markAllNotificationsAsRead(userId);
    }
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const handleNotificationPress = async (notif: ExtendedOperationalNotification) => {
    if (!notif.read) {
      if (userId) {
        await markNotificationAsRead(notif.id);
      }
      setNotifications((prev) =>
        prev.map((n) => (n.id === notif.id ? { ...n, read: true } : n))
      );
    }

    const targetRoute = notif.primaryActionRoute || notif.actionUrl;
    if (targetRoute) {
      router.push(targetRoute as any);
    }
  };

  const handleTogglePreference = async (
    key: keyof UserNotificationPreferences,
    value: boolean
  ) => {
    if (!preferences || !userId) return;
    const updated = { ...preferences, [key]: value };
    setPreferences(updated);
    await updateUserNotificationPreferences(userId, { [key]: value });
  };

  // Counts calculation
  const totalCount = notifications.length;
  const escrowCount = notifications.filter((n) => categorizeItem(n) === 'escrow').length;
  const lifecycleCount = notifications.filter((n) => categorizeItem(n) === 'lifecycle').length;
  const safetyCount = notifications.filter((n) => categorizeItem(n) === 'safety').length;
  const unreadCount = notifications.filter((n) => !n.read).length;

  const filteredList = useMemo(() => {
    return notifications.filter((n) => {
      if (selectedCategory === 'all') return true;
      return categorizeItem(n) === selectedCategory;
    });
  }, [notifications, selectedCategory]);

  const todayList = filteredList.filter((n) => n.dateGroup === 'today');
  const yesterdayList = filteredList.filter((n) => n.dateGroup !== 'today');

  return (
    <Screen edges={['top']}>
      {/* Top Application Bar matching Stitch Design */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.md,
          backgroundColor: colors.surface,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}
      >
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View
              style={{
                width: 7,
                height: 7,
                borderRadius: 4,
                backgroundColor: colors.primary,
              }}
            />
            <Text
              style={{
                fontSize: 10,
                fontWeight: '800',
                color: colors.primary,
                letterSpacing: 0.8,
                textTransform: 'uppercase',
              }}
            >
              OPSKL MUMBAI
            </Text>
          </View>
          <Text
            style={{
              fontSize: 18,
              fontWeight: '800',
              color: colors.textPrimary,
              marginTop: 1,
            }}
          >
            Operational Alerts
          </Text>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          {/* Emergency / Safety report quick trigger */}
          <TouchableOpacity
            onPress={() => router.push('/incident/report' as any)}
            accessibilityRole="button"
            accessibilityLabel="Report Safety Emergency"
            style={{
              width: 38,
              height: 38,
              borderRadius: 8,
              backgroundColor: '#fee2e2',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <AlertTriangle size={19} color="#dc2626" />
          </TouchableOpacity>

          {/* User Profile Avatar */}
          <TouchableOpacity
            onPress={() => router.push('/(tabs)/profile' as any)}
            accessibilityRole="button"
            accessibilityLabel="View profile"
            style={{
              width: 34,
              height: 34,
              borderRadius: 17,
              backgroundColor: colors.primary,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <UserIcon size={18} color="#ffffff" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Feed Subheader & Controls */}
      <View
        style={{
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.md,
          paddingBottom: spacing.sm,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <View>
          <Text style={{ fontSize: 16, fontWeight: '800', color: colors.textPrimary }}>
            Operational Notifications
          </Text>
          <Text style={{ fontSize: 12, color: colors.textSecondary }}>
            Auditable Event Feed (IST)
          </Text>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {unreadCount > 0 && activeTab === 'inbox' && (
            <TouchableOpacity
              onPress={handleMarkAllRead}
              accessibilityRole="button"
              accessibilityLabel="Mark all read"
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4,
                paddingHorizontal: 8,
                paddingVertical: 5,
                borderRadius: 6,
                backgroundColor: colors.surfaceMuted,
              }}
            >
              <CheckCheck size={14} color={colors.primary} />
              <Text style={{ fontSize: 11, fontWeight: '700', color: colors.primary }}>
                Mark all read
              </Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            onPress={() => setActiveTab(activeTab === 'inbox' ? 'preferences' : 'inbox')}
            accessibilityRole="button"
            accessibilityLabel="Notification settings"
            style={{
              width: 34,
              height: 34,
              borderRadius: 8,
              backgroundColor: activeTab === 'preferences' ? colors.primary : colors.surfaceMuted,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <SlidersHorizontal
              size={16}
              color={activeTab === 'preferences' ? '#ffffff' : colors.textPrimary}
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* Operational Filter Chips */}
      {activeTab === 'inbox' && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: spacing.lg,
            paddingVertical: spacing.xs,
            gap: 8,
          }}
        >
          {[
            { id: 'all', label: 'All', count: totalCount },
            { id: 'escrow', label: 'Escrow & Payouts', count: escrowCount },
            { id: 'lifecycle', label: 'Shift Lifecycle', count: lifecycleCount },
            { id: 'safety', label: 'Safety & System', count: safetyCount },
          ].map((chip) => {
            const isSelected = selectedCategory === chip.id;
            return (
              <TouchableOpacity
                key={chip.id}
                onPress={() => setSelectedCategory(chip.id as NotificationCategory)}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                  paddingHorizontal: 14,
                  paddingVertical: 7,
                  borderRadius: radii.full,
                  backgroundColor: isSelected ? colors.primary : colors.surfaceMuted,
                  borderWidth: 1,
                  borderColor: isSelected ? colors.primary : colors.border,
                }}
              >
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: isSelected ? '700' : '600',
                    color: isSelected ? '#ffffff' : colors.textPrimary,
                  }}
                >
                  {chip.label}
                </Text>
                <View
                  style={{
                    paddingHorizontal: 6,
                    paddingVertical: 1,
                    borderRadius: 10,
                    backgroundColor: isSelected ? 'rgba(255,255,255,0.25)' : colors.border,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 10,
                      fontWeight: '700',
                      color: isSelected ? '#ffffff' : colors.textSecondary,
                    }}
                  >
                    {chip.count}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      {/* Content Area */}
      {loading ? (
        <LoadingView message="Loading operational event stream…" />
      ) : loadError && notifications.length === 0 ? (
        <View style={{ flex: 1, padding: spacing.xl }}>
          <ErrorRetry
            variant="block"
            title="Notification Feed Offline"
            message={loadError}
            onRetry={loadData}
          />
        </View>
      ) : activeTab === 'preferences' ? (
        /* Notification Preferences */
        <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: 60 }}>
          <Text style={{ fontSize: 16, fontWeight: '800', color: colors.textPrimary }}>
            Notification Channels
          </Text>
          <Card variant="outlined" style={{ padding: spacing.md, gap: spacing.md }}>
            <View style={styles.prefRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.prefTitle}>Push Notifications</Text>
                <Text style={styles.prefSubtitle}>Device lockscreen & banner alerts</Text>
              </View>
              <Switch
                value={preferences?.pushEnabled ?? permissionGranted}
                onValueChange={(val) => {
                  if (val && !permissionGranted && userId) {
                    requestPermission(userId);
                  }
                  handleTogglePreference('pushEnabled', val);
                }}
                trackColor={{ true: colors.primary, false: colors.border }}
              />
            </View>

            <View style={{ height: 1, backgroundColor: colors.border }} />

            <View style={styles.prefRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.prefTitle}>WhatsApp Shift Updates</Text>
                <Text style={styles.prefSubtitle}>
                  Booking confirmations and venue passes sent to your WhatsApp
                </Text>
              </View>
              <Switch
                value={preferences?.whatsappEnabled ?? true}
                onValueChange={(val) => handleTogglePreference('whatsappEnabled', val)}
                trackColor={{ true: colors.primary, false: colors.border }}
              />
            </View>

            <View style={{ height: 1, backgroundColor: colors.border }} />

            <View style={styles.prefRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.prefTitle}>SMS Alerts (TRAI DLT Verified)</Text>
                <Text style={styles.prefSubtitle}>
                  Critical bank UTR credits and shift reporting reminders
                </Text>
              </View>
              <Switch
                value={preferences?.smsEnabled ?? true}
                onValueChange={(val) => handleTogglePreference('smsEnabled', val)}
                trackColor={{ true: colors.primary, false: colors.border }}
              />
            </View>
          </Card>

          <Text style={{ fontSize: 16, fontWeight: '800', color: colors.textPrimary, marginTop: 8 }}>
            Alert Categories
          </Text>
          <Card variant="outlined" style={{ padding: spacing.md, gap: spacing.md }}>
            <View style={styles.prefRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.prefTitle}>New Shift Opportunities</Text>
                <Text style={styles.prefSubtitle}>Matches in your preferred Mumbai localities</Text>
              </View>
              <Switch
                value={preferences?.notifyShiftOpportunities ?? true}
                onValueChange={(val) => handleTogglePreference('notifyShiftOpportunities', val)}
                trackColor={{ true: colors.primary, false: colors.border }}
              />
            </View>

            <View style={{ height: 1, backgroundColor: colors.border }} />

            <View style={styles.prefRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.prefTitle}>Escrow & Bank Payouts</Text>
                <Text style={styles.prefSubtitle}>Real-time bank UTR reference acknowledgments</Text>
              </View>
              <Switch
                value={preferences?.notifyPayouts ?? true}
                onValueChange={(val) => handleTogglePreference('notifyPayouts', val)}
                trackColor={{ true: colors.primary, false: colors.border }}
              />
            </View>
          </Card>
        </ScrollView>
      ) : (
        /* Live Feed Stream Grouped by Date */
        <ScrollView
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: 80 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {filteredList.length === 0 ? (
            <EmptyState
              title={`No ${selectedCategory === 'all' ? '' : selectedCategory} alerts`}
              description="New shift dispatches, escrow disbursements, and safety advisories will appear in this feed."
              actionTitle="View All Alerts"
              onAction={() => setSelectedCategory('all')}
            />
          ) : (
            <>
              {/* Group Today */}
              {todayList.length > 0 && (
                <View style={{ gap: spacing.sm }}>
                  <View style={styles.groupHeader}>
                    <Text style={styles.groupDate}>Today • 14 Mar 2025</Text>
                    <Text style={styles.groupTz}>IST (UTC +5:30)</Text>
                  </View>
                  {todayList.map((item) => renderNotificationCard(item))}
                </View>
              )}

              {/* Group Yesterday */}
              {yesterdayList.length > 0 && (
                <View style={{ gap: spacing.sm }}>
                  <View style={styles.groupHeader}>
                    <Text style={styles.groupDate}>Yesterday • 13 Mar 2025</Text>
                    <Text style={styles.groupTz}>IST (UTC +5:30)</Text>
                  </View>
                  {yesterdayList.map((item) => renderNotificationCard(item))}
                </View>
              )}
            </>
          )}
        </ScrollView>
      )}

      {/* Bottom Operational Tab Navigation Strip */}
      <View
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: 60,
          backgroundColor: colors.surface,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-around',
          paddingBottom: 4,
        }}
      >
        <TouchableOpacity
          onPress={() => router.push('/(tabs)' as any)}
          style={styles.bottomTabItem}
        >
          <Activity size={20} color={colors.textSecondary} />
          <Text style={[styles.bottomTabLabel, { color: colors.textSecondary }]}>Live Hub</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.bottomTabItem}>
          <Bell size={20} color={colors.primary} />
          <Text style={[styles.bottomTabLabel, { color: colors.primary, fontWeight: '700' }]}>
            Alerts
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => router.push('/incident/report' as any)}
          style={styles.bottomTabItem}
        >
          <Shield size={20} color={colors.textSecondary} />
          <Text style={[styles.bottomTabLabel, { color: colors.textSecondary }]}>Safety</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => router.push('/offline' as any)}
          style={styles.bottomTabItem}
        >
          <Wifi size={20} color={colors.textSecondary} />
          <Text style={[styles.bottomTabLabel, { color: colors.textSecondary }]}>Sync</Text>
        </TouchableOpacity>
      </View>
    </Screen>
  );

  function renderNotificationCard(item: ExtendedOperationalNotification) {
    const istTime = new Date(item.createdAt).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });

    return (
      <TouchableOpacity
        key={item.id}
        activeOpacity={0.88}
        onPress={() => handleNotificationPress(item)}
        style={{
          backgroundColor: colors.surface,
          borderRadius: radii.xl,
          borderWidth: 1,
          borderColor: item.read ? colors.border : colors.accent,
          padding: spacing.md,
          gap: spacing.xs + 2,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.05,
          shadowRadius: 3,
          elevation: 1,
        }}
      >
        {/* Card Header: Tag Badge + Unread Dot + Time */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View
              style={{
                paddingHorizontal: 8,
                paddingVertical: 2,
                borderRadius: 4,
                backgroundColor: colors.surfaceMuted,
              }}
            >
              <Text
                style={{
                  fontSize: 10,
                  fontWeight: '800',
                  color: colors.textPrimary,
                  letterSpacing: 0.5,
                }}
              >
                {item.tagBadge}
              </Text>
            </View>
            {!item.read && (
              <View
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: 4,
                  backgroundColor: colors.primary,
                }}
              />
            )}
          </View>
          <Text style={{ fontSize: 11, color: colors.textSecondary, fontWeight: '500' }}>
            {istTime} IST
          </Text>
        </View>

        {/* Title & Body */}
        <Text
          style={{
            fontSize: 14,
            fontWeight: item.read ? '600' : '800',
            color: colors.textPrimary,
            lineHeight: 20,
          }}
        >
          {item.title}
        </Text>
        <Text
          style={{
            fontSize: 12,
            color: colors.textSecondary,
            lineHeight: 18,
          }}
        >
          {item.body}
        </Text>

        {/* Optional Contextual Pill / Expiry Badge */}
        {item.contextPill && (
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              backgroundColor: colors.surfaceMuted,
              paddingHorizontal: spacing.sm,
              paddingVertical: 6,
              borderRadius: radii.md,
              marginTop: 2,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              {item.tagBadge.includes('ROSTER') ? (
                <Clock size={13} color={colors.textPrimary} />
              ) : item.tagBadge.includes('GEOFENCE') ? (
                <MapPin size={13} color={colors.textPrimary} />
              ) : (
                <Shield size={13} color={colors.textPrimary} />
              )}
              <Text style={{ fontSize: 11, fontWeight: '600', color: colors.textPrimary }}>
                {item.contextPill}
              </Text>
            </View>
            {item.secondaryMeta && (
              <Text style={{ fontSize: 9, fontWeight: '800', color: colors.textSecondary }}>
                {item.secondaryMeta}
              </Text>
            )}
          </View>
        )}

        {/* Action Button Row */}
        <View
          style={{
            flexDirection: 'row',
            justifyContent: item.secondaryActionLabel ? 'space-between' : 'flex-end',
            alignItems: 'center',
            marginTop: 4,
            gap: 8,
          }}
        >
          {item.primaryActionLabel && (
            <TouchableOpacity
              onPress={() => handleNotificationPress(item)}
              style={{
                flex: item.secondaryActionLabel ? 1 : undefined,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4,
                paddingHorizontal: 12,
                paddingVertical: 7,
                borderRadius: radii.md,
                backgroundColor: item.secondaryActionLabel ? colors.primary : colors.surfaceMuted,
              }}
            >
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: '700',
                  color: item.secondaryActionLabel ? '#ffffff' : colors.textPrimary,
                }}
              >
                {item.primaryActionLabel}
              </Text>
              <ArrowRight
                size={12}
                color={item.secondaryActionLabel ? '#ffffff' : colors.textPrimary}
              />
            </TouchableOpacity>
          )}

          {item.secondaryActionLabel && (
            <TouchableOpacity
              onPress={() => {
                setNotifications((prev) => prev.filter((n) => n.id !== item.id));
              }}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 7,
                borderRadius: radii.md,
                backgroundColor: colors.surfaceMuted,
              }}
            >
              <Text style={{ fontSize: 11, fontWeight: '600', color: colors.textSecondary }}>
                {item.secondaryActionLabel}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>
    );
  }
}

const styles = StyleSheet.create({
  groupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  groupDate: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748b',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  groupTz: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '500',
  },
  prefRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  prefTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  prefSubtitle: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  bottomTabItem: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    paddingHorizontal: 16,
  },
  bottomTabLabel: {
    fontSize: 10,
    marginTop: 2,
  },
});
