import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Switch,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  useOpsklTheme,
  Card,
  Badge,
  Button,
  usePushNotifications,
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
  const { colors, spacing, radii, typography } = useOpsklTheme();
  const router = useRouter();
  const { permissionGranted, requestPermission } = usePushNotifications();

  const [activeTab, setActiveTab] = useState<ActiveTab>('inbox');
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [preferences, setPreferences] = useState<UserNotificationPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [primingDismissed, setPrimingDismissed] = useState(false);

  const organizerId = 'org-current-profile';

  const loadData = useCallback(async () => {
    try {
      const [notifs, prefs] = await Promise.all([
        fetchUserNotifications(organizerId),
        fetchUserNotificationPreferences(organizerId),
      ]);
      setNotifications(notifs);
      setPreferences(prefs);
    } catch {
      // Fallback in services
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [organizerId]);

  useEffect(() => {
    loadData();

    // Subscribe to Realtime notifications with automatic channel cleanup
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
    if (!preferences) return;
    const updated = { ...preferences, [key]: value };
    setPreferences(updated);
    await updateUserNotificationPreferences(organizerId, { [key]: value });
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      {/* Top Header */}
      <View
        style={{
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.md,
          backgroundColor: colors.surface,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={{ fontSize: 22, color: colors.textPrimary }}>←</Text>
          </TouchableOpacity>
          <View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
              <Text style={[typography.h3, { color: colors.textPrimary }]}>Crew Alerts</Text>
              {unreadCount > 0 && (
                <Badge label={`${unreadCount} NEW`} variant="primary" size="sm" />
              )}
            </View>
            <Text style={[typography.caption, { color: colors.textMuted }]}>
              Live shift applications & venue check-ins
            </Text>
          </View>
        </View>

        {activeTab === 'inbox' && unreadCount > 0 && (
          <TouchableOpacity onPress={handleMarkAllRead}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: colors.primary }}>
              Mark all read
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Tab Switcher */}
      <View
        style={{
          flexDirection: 'row',
          marginHorizontal: spacing.lg,
          marginTop: spacing.md,
          backgroundColor: colors.surfaceMuted,
          borderRadius: radii.md,
          padding: 4,
        }}
      >
        <TouchableOpacity
          onPress={() => setActiveTab('inbox')}
          style={{
            flex: 1,
            paddingVertical: spacing.sm,
            alignItems: 'center',
            backgroundColor: activeTab === 'inbox' ? colors.surface : 'transparent',
            borderRadius: radii.sm,
          }}
        >
          <Text
            style={{
              fontSize: 13,
              fontWeight: '700',
              color: activeTab === 'inbox' ? colors.primary : colors.textSecondary,
            }}
          >
            Crew Feed ({notifications.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setActiveTab('preferences')}
          style={{
            flex: 1,
            paddingVertical: spacing.sm,
            alignItems: 'center',
            backgroundColor: activeTab === 'preferences' ? colors.surface : 'transparent',
            borderRadius: radii.sm,
          }}
        >
          <Text
            style={{
              fontSize: 13,
              fontWeight: '700',
              color: activeTab === 'preferences' ? colors.primary : colors.textSecondary,
            }}
          >
            Preferences
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : activeTab === 'inbox' ? (
        /* INBOX TAB */
        <ScrollView
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: 60 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {/* Permission Priming Banner */}
          {!permissionGranted && !primingDismissed && (
            <Card
              variant="elevated"
              style={{
                backgroundColor: '#EFF6FF',
                borderColor: colors.primary,
                padding: spacing.md,
              }}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <View style={{ flex: 1, marginRight: spacing.sm }}>
                  <Text style={{ fontSize: 14, fontWeight: '800', color: colors.primary }}>
                    Enable Organizer Crew Alerts 🔔
                  </Text>
                  <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 4, lineHeight: 18 }}>
                    Receive real-time alerts when applicants apply, crew members check in at the venue, or shifts require replacement workers.
                  </Text>
                </View>
                <TouchableOpacity onPress={() => setPrimingDismissed(true)}>
                  <Text style={{ fontSize: 16, color: colors.textMuted }}>✕</Text>
                </TouchableOpacity>
              </View>

              <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md }}>
                <Button
                  title="Enable Push Alerts"
                  variant="primary"
                  size="sm"
                  onPress={() => requestPermission(organizerId)}
                  style={{ flex: 1 }}
                />
              </View>
            </Card>
          )}

          {notifications.length === 0 ? (
            <Card variant="outlined" style={{ padding: spacing.xl, alignItems: 'center' }}>
              <Text style={[typography.body, { color: colors.textMuted }]}>
                No crew alerts yet.
              </Text>
            </Card>
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
                      <Badge label="ACTION REQUIRED" variant="danger" size="sm" />
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
            Organizer Alert Channels
          </Text>
          <Card variant="outlined" style={{ padding: spacing.md, gap: spacing.md }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View style={{ flex: 1, marginRight: spacing.md }}>
                <Text style={{ fontSize: 14, fontWeight: '700', color: colors.textPrimary }}>
                  Push Notifications
                </Text>
                <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>
                  Arrivals, check-in code entries, and applicant submissions
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
                  WhatsApp Roster Summaries
                </Text>
                <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>
                  Daily crew reporting headcount and check-in summary
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
                  SMS Critical Alerts
                </Text>
                <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>
                  Crew cancellations and immediate replacement alerts
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
            Shift Event Filters
          </Text>
          <Card variant="outlined" style={{ padding: spacing.md, gap: spacing.md }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View style={{ flex: 1, marginRight: spacing.md }}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textPrimary }}>
                  New Applications
                </Text>
                <Text style={{ fontSize: 12, color: colors.textMuted }}>
                  Alert when verified workers apply to your shift
                </Text>
              </View>
              <Switch
                value={preferences?.notifyApplications}
                onValueChange={(val) => handleTogglePreference('notifyApplications', val)}
                trackColor={{ true: colors.primary, false: colors.border }}
              />
            </View>

            <View style={{ height: 1, backgroundColor: colors.border }} />

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View style={{ flex: 1, marginRight: spacing.md }}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textPrimary }}>
                  Venue Attendance & Check-Ins
                </Text>
                <Text style={{ fontSize: 12, color: colors.textMuted }}>
                  Immediate notification upon worker check-in code entry
                </Text>
              </View>
              <Switch
                value={preferences?.notifyAttendanceUpdates}
                onValueChange={(val) => handleTogglePreference('notifyAttendanceUpdates', val)}
                trackColor={{ true: colors.primary, false: colors.border }}
              />
            </View>

            <View style={{ height: 1, backgroundColor: colors.border }} />

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View style={{ flex: 1, marginRight: spacing.md }}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textPrimary }}>
                  Disputes & Claims
                </Text>
                <Text style={{ fontSize: 12, color: colors.textMuted }}>
                  Immediate alert if hours or conduct are contested
                </Text>
              </View>
              <Switch
                value={preferences?.notifyDisputes}
                onValueChange={(val) => handleTogglePreference('notifyDisputes', val)}
                trackColor={{ true: colors.primary, false: colors.border }}
              />
            </View>
          </Card>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
