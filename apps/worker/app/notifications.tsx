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
  Badge,
  EmptyState,
  useAuth,
  usePushNotifications,
  Screen,
  ScreenHeader,
  ErrorRetry,
  SegmentedControl,
  InlineBanner,
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

type ActiveTab = 'inbox' | 'preferences';

export default function WorkerNotificationsScreen() {
  const { colors, spacing, typography } = useOpsklTheme();
  const router = useRouter();
  const { session } = useAuth();
  const { permissionGranted, requestPermission } = usePushNotifications();

  const [activeTab, setActiveTab] = useState<ActiveTab>('inbox');
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

  return (
    <Screen edges={['top']}>
      <ScreenHeader
        title="Notifications"
        subtitle={unreadCount > 0 ? `${unreadCount} unread` : 'Live shift and payout alerts'}
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

      <View style={{ marginHorizontal: spacing.lg, marginTop: spacing.md }}>
        <SegmentedControl
          options={[
            { value: 'inbox', label: `Inbox (${notifications.length})` },
            { value: 'preferences', label: 'Preferences' },
          ]}
          value={activeTab}
          onChange={setActiveTab}
        />
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

          {notifications.length === 0 ? (
            <EmptyState
              title="No notifications yet"
              description="You will receive updates when you apply or get selected for shifts."
            />
          ) : (
            notifications.map((item) => (
              <TouchableOpacity
                key={item.id}
                activeOpacity={0.8}
                onPress={() => handleNotificationPress(item)}
              >
                <Card
                  variant={item.read ? 'outlined' : 'elevated'}
                  style={{
                    padding: spacing.md,
                    backgroundColor: item.read ? colors.surface : colors.surfaceElevated,
                    borderLeftWidth: item.read ? 1 : 4,
                    borderLeftColor: item.read ? colors.border : colors.primary,
                  }}
                >
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <View style={{ flex: 1, marginRight: spacing.sm }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                        <Text
                          style={{
                            fontSize: 14,
                            fontWeight: item.read ? '600' : '800',
                            color: colors.textPrimary,
                          }}
                        >
                          {item.title}
                        </Text>
                        {!item.read && (
                          <View
                            style={{
                              width: 8,
                              height: 8,
                              borderRadius: 4,
                              backgroundColor: colors.primary,
                            }}
                          />
                        )}
                      </View>

                      <Text
                        style={{
                          fontSize: 13,
                          color: colors.textSecondary,
                          marginTop: 4,
                          lineHeight: 18,
                        }}
                      >
                        {item.body}
                      </Text>

                      <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 6 }}>
                        {new Date(item.createdAt).toLocaleTimeString('en-IN', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })} • {new Date(item.createdAt).toLocaleDateString('en-IN', {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </Text>
                    </View>

                    {item.priority === 'urgent' && (
                      <Badge label="URGENT" variant="danger" size="sm" />
                    )}
                  </View>
                </Card>
              </TouchableOpacity>
            ))
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
