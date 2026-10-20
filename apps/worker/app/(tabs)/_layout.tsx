import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useOpsklTheme, Compass, ClipboardList, IndianRupee, User } from '@opskil/design-system';

export default function TabsLayout() {
  const { colors, navigation, typography, fontWeights } = useOpsklTheme();
  const insets = useSafeAreaInsets();
  const bottomPad = Math.max(insets.bottom, 8);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          height: navigation.tabBarHeight + bottomPad - 10,
          paddingBottom: bottomPad,
          paddingTop: 6,
        },
        tabBarLabelStyle: {
          fontSize: typography.micro.fontSize,
          fontWeight: fontWeights.semibold,
          marginBottom: 2,
        },
        tabBarHideOnKeyboard: true,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Discover',
          tabBarAccessibilityLabel: 'Discover shifts',
          tabBarIcon: ({ color }) => (
            <Compass size={22} color={color} strokeWidth={2} />
          ),
        }}
      />
      <Tabs.Screen
        name="my-shifts"
        options={{
          title: 'My Shifts',
          tabBarAccessibilityLabel: 'My shifts',
          tabBarIcon: ({ color }) => (
            <ClipboardList size={22} color={color} strokeWidth={2} />
          ),
        }}
      />
      <Tabs.Screen
        name="earnings"
        options={{
          title: 'Earnings',
          tabBarAccessibilityLabel: 'Earnings and payouts',
          tabBarIcon: ({ color }) => (
            <IndianRupee size={22} color={color} strokeWidth={2} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarAccessibilityLabel: 'Worker profile',
          tabBarIcon: ({ color }) => (
            <User size={22} color={color} strokeWidth={2} />
          ),
        }}
      />
    </Tabs>
  );
}
