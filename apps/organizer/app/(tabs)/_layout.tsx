import { Tabs, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useOpsklTheme, useAuth, Calendar, Plus, Users, IndianRupee, Briefcase } from '@opskil/design-system';

export default function OrganizerTabsLayout() {
  const router = useRouter();
  const { session } = useAuth();
  const { colors, navigation, typography, fontWeights } = useOpsklTheme();
  const insets = useSafeAreaInsets();
  const bottomPad = Math.max(insets.bottom, 8);

  const createAuthTabListener = (tabPath: string) => ({
    tabPress: (e: any) => {
      if (!session?.user) {
        e.preventDefault();
        router.push(`/auth/login?redirect=${encodeURIComponent(tabPath)}` as any);
      }
    },
  });

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
          title: 'Shifts',
          tabBarLabel: 'Shifts',
          tabBarAccessibilityLabel: 'Shifts dashboard',
          tabBarIcon: ({ color }) => (
            <Calendar size={22} color={color} strokeWidth={2} />
          ),
        }}
      />
      <Tabs.Screen
        name="create"
        listeners={createAuthTabListener('/(tabs)/create')}
        options={{
          title: 'Post',
          tabBarLabel: 'Post',
          tabBarAccessibilityLabel: 'Post a shift',
          tabBarIcon: ({ color }) => (
            <Plus size={22} color={color} strokeWidth={2.5} />
          ),
        }}
      />
      <Tabs.Screen
        name="roster"
        listeners={createAuthTabListener('/(tabs)/roster')}
        options={{
          title: 'Roster',
          tabBarLabel: 'Roster',
          tabBarAccessibilityLabel: 'Applicant roster',
          tabBarIcon: ({ color }) => (
            <Users size={22} color={color} strokeWidth={2} />
          ),
        }}
      />
      <Tabs.Screen
        name="finances"
        listeners={createAuthTabListener('/(tabs)/finances')}
        options={{
          title: 'Finances',
          tabBarLabel: 'Finances',
          tabBarAccessibilityLabel: 'Finances and invoices',
          tabBarIcon: ({ color }) => (
            <IndianRupee size={22} color={color} strokeWidth={2} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        listeners={createAuthTabListener('/(tabs)/profile')}
        options={{
          title: 'Profile',
          tabBarLabel: 'Profile',
          tabBarAccessibilityLabel: 'Organization profile',
          tabBarIcon: ({ color }) => (
            <Briefcase size={22} color={color} strokeWidth={2} />
          ),
        }}
      />
    </Tabs>
  );
}
