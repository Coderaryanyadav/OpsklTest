import { Tabs } from 'expo-router';
import { Text, View } from 'react-native';
import { useOpsklTheme } from '@opskil/design-system';

interface TabIconProps {
  iconSymbol: string;
  color: any;
}

const TabIcon: React.FC<TabIconProps> = ({ iconSymbol, color }) => {
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontSize: 20, color }}>{iconSymbol}</Text>
    </View>
  );
};

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
          height: 60,
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
          title: 'Live Shifts',
          tabBarIcon: ({ color }) => (
            <TabIcon iconSymbol="📊" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="create"
        options={{
          title: 'Post Shift',
          tabBarIcon: ({ color }) => (
            <TabIcon iconSymbol="➕" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="roster"
        options={{
          title: 'Applicants',
          tabBarIcon: ({ color }) => (
            <TabIcon iconSymbol="👥" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="finances"
        options={{
          title: 'Finances',
          tabBarIcon: ({ color }) => (
            <TabIcon iconSymbol="💳" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Organization',
          tabBarIcon: ({ color }) => (
            <TabIcon iconSymbol="🏢" color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
