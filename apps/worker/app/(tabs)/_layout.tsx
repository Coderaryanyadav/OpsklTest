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

export default function TabsLayout() {
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
          title: 'Discover',
          tabBarIcon: ({ color }) => (
            <TabIcon iconSymbol="⚡" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="my-shifts"
        options={{
          title: 'My Shifts',
          tabBarIcon: ({ color }) => (
            <TabIcon iconSymbol="📋" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="earnings"
        options={{
          title: 'Earnings',
          tabBarIcon: ({ color }) => (
            <TabIcon iconSymbol="₹" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color }) => (
            <TabIcon iconSymbol="👤" color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
