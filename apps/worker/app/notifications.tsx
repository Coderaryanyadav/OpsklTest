import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Switch,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  useOpsklTheme,
  Card,
  EmptyState,
  useAuth,
  usePushNotifications,
  Screen,
  ScreenHeader,
  ErrorRetry,
  SegmentedControl,
  InlineBanner,
  LoadingView,
  FilterPills,
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

type ActiveTab = 'inbox' | 'preferences';
type NotificationCategory = 'all' | 'escrow' | 'lifecycle' | 'safety';

function getNotificationCategory(item: Notification): 'escrow' | 'lifecycle' | 'safety' {
  const text = `${item.type} ${item.title} ${item.body}`.toLowerCase();
  if (text.includes('escrow') || text.includes('payout') || text.includes('wage') || text.includes('settle') || text.includes('upi')) {
    return 'escrow';
  }
  if (text.includes('safety') || text.includes('emergency') || text.includes('geofence') || text.includes('weather') || text.includes('curfew') || text.includes('alert')) {
    return 'safety';
  }
  return 'lifecycle';
}

function getCategoryBadgeLabel(cat: 'escrow' | 'lifecycle' | 'safety'): string {
  switch (cat) {
    case 'escrow':
      return 'ESCROW LEDGER';
    case 'safety':
      return 'SAFETY ADVISORY';
    case 'lifecycle':
    default:
      return 'ROSTER UPDATE';
  }
}

export default function WorkerNotificationsScreen() {
  const { colors, spacing, radii, typography } = useOpsklTheme();
  const router = useRouter();
  const { session } = useAuth();
  const { permissionGranted, requestPermission } = usePushNotifications();

  const [activeTab, setActiveTab] = useState<ActiveTab>('inbox');
  const [categoryFilter, setCategoryFilter] = useState<NotificationCategory>('all');
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [preferences, setPreferences] = useState<UserNotificationPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [primingDismissed, setPrimingDismissed] = useState(false);

  const userId = session?.user?.id;

  const loadData = useCallback(async () => {
    if (!userId) {
      setNotifications([]);
      setPreferences(null);
      setLoading(false);
      setRefreshing(false);
      setLoadError(null);
      return;
    }
    try {
      setLoadError(null);
      const [notifs, prefs] = await Promise.all([
        fetchUserNotifications(userId),
        fetchUserNotificationPreferences(userId),
      ]);
      setNotifications(notifs);
      setPreferences(prefs);
    } catch (err: any) {
      setLoadError(err?.message || 'Could not load notifications. Pull to refresh or retry.');
      setNotifications([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userId]);

  useEffect(() => {
    loadData();

    if (!userId) return;

    // Subscribe to Realtime notifications with automatic channel cleanup
    const unsubscribe = subscribeToUserNotifications(userId, (newNotif) => {
      setNotifications((prev) => [newNotif, ...prev]);
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
    if (!userId) return;
    await markAllNotificationsAsRead(userId);
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const handleNotificationPress = async (notif: Notification) => {
    if (!notif.read) {
      await markNotificationAsRead(notif.id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === notif.id ? { ...n, read: true } : n))
      );
    }

    if (notif.actionUrl) {
      router.push(notif.actionUrl as any);
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

  const unreadCount = notifications.filter((n) => !n.read).length;
  const escrowCount = notifications.filter((n) => getNotificationCategory(n) === 'escrow').length;
  const lifecycleCount = notifications.filter((n) => getNotificationCategory(n) === 'lifecycle').length;
  const safetyCount = notifications.filter((n) => getNotificationCategory(n) === 'safety').length;

  const filteredNotifications = notifications.filter((n) => {
    if (categoryFilter === 'all') return true;
    return getNotificationCategory(n) === categoryFilter;
  });

  return (
    <Screen edges={['top']}>
      <ScreenHeader
        title="Notifications"
        subtitle={unreadCount > 0 ? `${unreadCount} unread • IST stream` : 'Live shift and payout alerts'}
        onBack={() => router.back()}
        rightAction={
          activeTab === 'inbox' && unreadCount > 0 ? (
            <TouchableOpacity
              onPress={handleMarkAllRead}
              accessibilityRole="button"
              accessibilityLabel="Mark all notifications as read"
              style={{ minHeight: 44, justifyContent: 'center' }}
            >
              <Text style={{ fontSize: 13, fontWeight: '700', color: colors.primary }}>
                Mark all read
              </Text>
            </TouchableOpacity>
          ) : undefined
        }
      />

      <View style={{ marginHorizontal: spacing.lg, marginTop: spacing.md, gap: spacing.sm }}>
        <SegmentedControl
          options={[
            { value: 'inbox', label: `Inbox (${notifications.length})` },
            { value: 'preferences', label: 'Preferences' },
          ]}
          value={activeTab}
          onChange={setActiveTab}
        />

        {activeTab === 'inbox' && notifications.length > 0 && (
          <FilterPills
            items={[
              { id: 'all', label: 'All', count: notifications.length },
              { id: 'escrow', label: 'Escrow & Pay', count: escrowCount },
              { id: 'lifecycle', label: 'Shift Roster', count: lifecycleCount },
              { id: 'safety', label: 'Safety & System', count: safetyCount },
            ]}
            selectedId={categoryFilter}
            onSelect={(id) => setCategoryFilter(id as NotificationCategory)}
            style={{ marginHorizontal: -spacing.lg }}
          />
        )}
      </View>

      {!userId ? (
        <View style={{ flex: 1, justifyContent: 'center', padding: spacing.xl }}>
          <EmptyState
            title="Sign In Required"
            description="Please sign in to view your shift notifications and updates."
            actionLabel="Sign In"
            onAction={() => router.push('/auth/login?redirect=/notifications' as any)}
          />
        </View>
      ) : loading ? (
        <LoadingView message="Loading notifications…" />
      ) : loadError ? (
        <View style={{ flex: 1, padding: spacing.xl }}>
          <ErrorRetry
            variant="block"
            title="Could Not Load Notifications"
            message={loadError}
            onRetry={loadData}
          />
        </View>
      ) : activeTab === 'inbox' ? (
        <ScrollView
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: 60 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {!permissionGranted && !primingDismissed && (
            <InlineBanner
              variant="info"
              title="Turn on shift alerts"
              message="Receive shift confirmations, reporting reminders, and UPI credit alerts."
              actionLabel="Enable Push Alerts"
              onAction={() => requestPermission(userId)}
              onDismiss={() => setPrimingDismissed(true)}
            />
          )}

          {filteredNotifications.length === 0 ? (
            <EmptyState
              title={categoryFilter === 'all' ? 'No notifications yet' : `No ${categoryFilter} alerts`}
              description={
                categoryFilter === 'all'
                  ? 'You will receive updates when you apply or get selected for shifts.'
                  : `There are currently no alerts in the "${categoryFilter}" category.`
              }
              actionLabel={categoryFilter !== 'all' ? 'View All Alerts' : undefined}
              onAction={categoryFilter !== 'all' ? () => setCategoryFilter('all') : undefined}
            />
          ) : (
            filteredNotifications.map((item) => {
              const cat = getNotificationCategory(item);
              const badgeLabel = getCategoryBadgeLabel(cat);
              const istTime = new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

              return (
                <TouchableOpacity
                  key={item.id}
                  activeOpacity={0.8}
                  onPress={() => handleNotificationPress(item)}
                >
                  <View
                    style={{
                      padding: spacing.md,
                      backgroundColor: item.read ? colors.surface : colors.surfaceMuted,
                      borderRadius: radii.lg,
                      borderWidth: 1,
                      borderColor: item.read ? colors.border : colors.accent,
                      gap: spacing.xs,
                      shadowColor: '#000',
                      shadowOffset: { width: 0, height: 1 },
                      shadowOpacity: 0.04,
                      shadowRadius: 3,
                      elevation: 1,
                    }}
                  >
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={{ fontSize: 10, fontWeight: '700', color: colors.textSecondary, letterSpacing: 0.5 }}>
                          {badgeLabel}
                        </Text>
                        {!item.read && (
                          <View
                            style={{
                              width: 6,
                              height: 6,
                              borderRadius: radii.full,
                              backgroundColor: colors.accent,
                            }}
                          />
                        )}
                      </View>
                      <Text style={{ fontSize: 11, color: colors.textSecondary }}>
                        {istTime} IST
                      </Text>
                    </View>

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
                        fontSize: 13,
                        color: colors.textSecondary,
                        lineHeight: 18,
                      }}
                    >
                      {item.body}
                    </Text>

                    {item.actionUrl ? (
                      <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 4 }}>
                        <View
                          style={{
                            paddingHorizontal: spacing.sm + 2,
                            paddingVertical: 4,
                            borderRadius: radii.md,
                            backgroundColor: colors.surface,
                            borderWidth: 1,
                            borderColor: colors.border,
                          }}
                        >
                          <Text style={{ fontSize: 11, fontWeight: '700', color: colors.accent }}>
                            View Update ➔
                          </Text>
                        </View>
                      </View>
                    ) : null}
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>
      ) : (
        /* PREFERENCES TAB */
        <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: 60 }}>
          <Text style={[typography.h3, { color: colors.textPrimary }]}>
            Notification Channels
          </Text>
          <Card variant="outlined" style={{ padding: spacing.md, gap: spacing.md }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View style={{ flex: 1, marginRight: spacing.md }}>
                <Text style={{ fontSize: 14, fontWeight: '700', color: colors.textPrimary }}>
                  Push Notifications
                </Text>
                <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>
                  Device lockscreen and banner alerts
                </Text>
              </View>
              <Switch
                value={preferences?.pushEnabled}
                onValueChange={(val) => handleTogglePreference('pushEnabled', val)}
                trackColor={{ true: colors.primary, false: colors.border }}
              />
            </View>

            <View style={{ height: 1, backgroundColor: colors.border }} />

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View style={{ flex: 1, marginRight: spacing.md }}>
                <Text style={{ fontSize: 14, fontWeight: '700', color: colors.textPrimary }}>
                  WhatsApp Shift Updates
                </Text>
                <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>
                  Booking confirmations and venue passes sent to your WhatsApp
                </Text>
              </View>
              <Switch
                value={preferences?.whatsappEnabled}
                onValueChange={(val) => handleTogglePreference('whatsappEnabled', val)}
                trackColor={{ true: colors.primary, false: colors.border }}
              />
            </View>

            <View style={{ height: 1, backgroundColor: colors.border }} />

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View style={{ flex: 1, marginRight: spacing.md }}>
                <Text style={{ fontSize: 14, fontWeight: '700', color: colors.textPrimary }}>
                  SMS Alerts (DLT Verified)
                </Text>
                <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>
                  Critical bank UTR credits and shift reminders
                </Text>
              </View>
              <Switch
                value={preferences?.smsEnabled}
                onValueChange={(val) => handleTogglePreference('smsEnabled', val)}
                trackColor={{ true: colors.primary, false: colors.border }}
              />
            </View>
          </Card>

          <Text style={[typography.h3, { color: colors.textPrimary, marginTop: spacing.sm }]}>
            Alert Categories
          </Text>
          <Card variant="outlined" style={{ padding: spacing.md, gap: spacing.md }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View style={{ flex: 1, marginRight: spacing.md }}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textPrimary }}>
                  New Shift Opportunities
                </Text>
                <Text style={{ fontSize: 12, color: colors.textMuted }}>
                  Matches in your preferred Mumbai localities
                </Text>
              </View>
              <Switch
                value={preferences?.notifyShiftOpportunities}
                onValueChange={(val) => handleTogglePreference('notifyShiftOpportunities', val)}
                trackColor={{ true: colors.primary, false: colors.border }}
              />
            </View>

            <View style={{ height: 1, backgroundColor: colors.border }} />

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View style={{ flex: 1, marginRight: spacing.md }}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textPrimary }}>
                  Shift Confirmations & Selection
                </Text>
                <Text style={{ fontSize: 12, color: colors.textMuted }}>
                  When organizers select you or confirm roster
                </Text>
              </View>
              <Switch
                value={preferences?.notifySelectionAndConfirmations}
                onValueChange={(val) => handleTogglePreference('notifySelectionAndConfirmations', val)}
                trackColor={{ true: colors.primary, false: colors.border }}
              />
            </View>

            <View style={{ height: 1, backgroundColor: colors.border }} />

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View style={{ flex: 1, marginRight: spacing.md }}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textPrimary }}>
                  Shift Reminders (T-2 hours)
                </Text>
                <Text style={{ fontSize: 12, color: colors.textMuted }}>
                  Reporting time and digital pass alerts
                </Text>
              </View>
              <Switch
                value={preferences?.notifyShiftReminders}
                onValueChange={(val) => handleTogglePreference('notifyShiftReminders', val)}
                trackColor={{ true: colors.primary, false: colors.border }}
              />
            </View>

            <View style={{ height: 1, backgroundColor: colors.border }} />

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View style={{ flex: 1, marginRight: spacing.md }}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textPrimary }}>
                  Payouts & Bank Credits
                </Text>
                <Text style={{ fontSize: 12, color: colors.textMuted }}>
                  Immediate notification with bank UTR number
                </Text>
              </View>
              <Switch
                value={preferences?.notifyPayouts}
                onValueChange={(val) => handleTogglePreference('notifyPayouts', val)}
                trackColor={{ true: colors.primary, false: colors.border }}
              />
            </View>
          </Card>
        </ScrollView>
      )}
    </Screen>
  );
}
