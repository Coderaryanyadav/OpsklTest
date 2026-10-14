import { Tabs } from 'expo-router';
import { useOpsklTheme, Calendar, Plus, Users, IndianRupee, Briefcase } from '@opskil/design-system';

export default function OrganizerTabsLayout() {
  const { colors } = useOpsklTheme();

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
          height: 62,
          paddingBottom: 8,
          paddingTop: 6,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Shifts',
          tabBarLabel: 'Shifts',
          tabBarIcon: ({ color }) => (
            <Calendar size={22} color={color} strokeWidth={2} />
          ),
        }}
      />
      <Tabs.Screen
        name="create"
        options={{
          title: 'Post',
          tabBarLabel: 'Post',
          tabBarIcon: ({ color }) => (
            <Plus size={22} color={color} strokeWidth={2.5} />
          ),
        }}
      />
      <Tabs.Screen
        name="roster"
        options={{
          title: 'Roster',
          tabBarLabel: 'Roster',
          tabBarIcon: ({ color }) => (
            <Users size={22} color={color} strokeWidth={2} />
          ),
        }}
      />
      <Tabs.Screen
        name="finances"
        options={{
          title: 'Finances',
          tabBarLabel: 'Finances',
          tabBarIcon: ({ color }) => (
            <IndianRupee size={22} color={color} strokeWidth={2} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarLabel: 'Profile',
          tabBarIcon: ({ color }) => (
            <Briefcase size={22} color={color} strokeWidth={2} />
          ),
        }}
      />
    </Tabs>
  );
}
