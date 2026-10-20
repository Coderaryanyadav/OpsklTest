import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
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
  Toggle,
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

export default function OrganizerNotificationsScreen() {
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

  const organizerId = session?.user?.id;

  const loadData = useCallback(async () => {
    if (!organizerId) {
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
        fetchUserNotifications(organizerId),
        fetchUserNotificationPreferences(organizerId),
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
  }, [organizerId]);

  useEffect(() => {
    loadData();

    if (!organizerId) return;

    const unsubscribe = subscribeToUserNotifications(organizerId, (newNotif) => {
      setNotifications((prev) => [newNotif, ...prev]);
    });

    return () => {
      unsubscribe();
    };
  }, [loadData, organizerId]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleMarkAllRead = async () => {
    if (!organizerId) return;
    await markAllNotificationsAsRead(organizerId);
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
    if (!preferences || !organizerId) return;
    const updated = { ...preferences, [key]: value };
    setPreferences(updated);
    await updateUserNotificationPreferences(organizerId, { [key]: value });
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <Screen edges={['top']}>
      <ScreenHeader
        title="Crew Alerts"
        subtitle={unreadCount > 0 ? `${unreadCount} unread` : 'Live applications & venue check-ins'}
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
            { value: 'inbox', label: `Crew Feed (${notifications.length})` },
            { value: 'preferences', label: 'Preferences' },
          ]}
          value={activeTab}
          onChange={setActiveTab}
        />
      </View>

      {!organizerId ? (
        <View style={{ flex: 1, justifyContent: 'center', padding: spacing.xl }}>
          <EmptyState
            title="Sign In Required"
            description="Please sign in to view your organizer crew alerts and shift notifications."
            actionLabel="Sign In"
            onAction={() => router.push('/auth/login?redirect=/notifications' as any)}
          />
        </View>
      ) : loading ? (
        <LoadingView message="Loading crew alerts…" />
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
              title="Enable organizer crew alerts"
              message="Receive alerts when applicants apply, crew check in, or shifts need replacements."
              actionLabel="Enable Push Alerts"
              onAction={() => requestPermission(organizerId)}
              onDismiss={() => setPrimingDismissed(true)}
            />
          )}

          {notifications.length === 0 ? (
            <EmptyState
              title="No crew alerts yet"
              description="You will receive updates when workers apply or check in at your venues."
            />
          ) : (
            notifications.map((item) => (
              <TouchableOpacity
                key={item.id}
                activeOpacity={0.8}
                onPress={() => handleNotificationPress(item)}
                accessibilityRole="button"
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
                          numberOfLines={2}
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
                        })}{' '}
                        •{' '}
                        {new Date(item.createdAt).toLocaleDateString('en-IN', {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </Text>
                    </View>

                    {item.priority === 'urgent' && (
                      <Badge label="ACTION REQUIRED" variant="danger" size="sm" />
                    )}
                  </View>
                </Card>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: 60 }}>
          <Text style={[typography.h3, { color: colors.textPrimary }]}>Organizer Alert Channels</Text>
          <Toggle
            label="Push Notifications"
            description="Arrivals, check-in code entries, and applicant submissions"
            value={!!preferences?.pushEnabled}
            onValueChange={(val) => handleTogglePreference('pushEnabled', val)}
          />
          <Toggle
            label="WhatsApp Roster Summaries"
            description="Daily crew reporting headcount and check-in summary"
            value={!!preferences?.whatsappEnabled}
            onValueChange={(val) => handleTogglePreference('whatsappEnabled', val)}
          />
          <Toggle
            label="SMS Critical Alerts"
            description="Crew cancellations and immediate replacement alerts"
            value={!!preferences?.smsEnabled}
            onValueChange={(val) => handleTogglePreference('smsEnabled', val)}
          />

          <Text style={[typography.h3, { color: colors.textPrimary, marginTop: spacing.sm }]}>
            Shift Event Filters
          </Text>
          <Toggle
            label="New Applications"
            description="Alert when verified workers apply to your shift"
            value={!!preferences?.notifyApplications}
            onValueChange={(val) => handleTogglePreference('notifyApplications', val)}
          />
          <Toggle
            label="Venue Attendance & Check-Ins"
            description="Notification when a worker enters their attendance pass code"
            value={!!preferences?.notifyAttendanceUpdates}
            onValueChange={(val) => handleTogglePreference('notifyAttendanceUpdates', val)}
          />
          <Toggle
            label="Disputes & Claims"
            description="Immediate alert if hours or conduct are contested"
            value={!!preferences?.notifyDisputes}
            onValueChange={(val) => handleTogglePreference('notifyDisputes', val)}
          />
        </ScrollView>
      )}
    </Screen>
  );
}
