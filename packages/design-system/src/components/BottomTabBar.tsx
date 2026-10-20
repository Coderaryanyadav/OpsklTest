import React from 'react';
import { View, Text, Pressable, StyleProp, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useOpsklTheme } from '../context/ThemeContext';

export interface BottomTabItem {
  key: string;
  label: string;
  icon: (props: { color: string; size: number; focused: boolean }) => React.ReactNode;
  accessibilityLabel?: string;
}

export interface BottomTabBarProps {
  items: BottomTabItem[];
  activeKey: string;
  onChange: (key: string) => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/**
 * Reusable bottom navigation. Prefer wiring via Expo Router Tabs options;
 * use this for custom shells or documentation/examples.
 */
export const BottomTabBar: React.FC<BottomTabBarProps> = ({
  items,
  activeKey,
  onChange,
  style,
  testID,
}) => {
  const { colors, spacing, navigation } = useOpsklTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      testID={testID}
      accessibilityRole="tablist"
      style={[
        {
          flexDirection: 'row',
          borderTopWidth: 1,
          borderTopColor: colors.border,
          backgroundColor: colors.surface,
          minHeight: navigation.tabBarHeight,
          paddingBottom: Math.max(insets.bottom, spacing.xs),
          paddingTop: spacing.xs,
        },
        style,
      ]}
    >
      {items.map((item) => {
        const focused = item.key === activeKey;
        const color = focused ? colors.primary : colors.textMuted;
        return (
          <Pressable
            key={item.key}
            onPress={() => onChange(item.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={item.accessibilityLabel || item.label}
            style={({ pressed }) => ({
              flex: 1,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: pressed ? 0.7 : 1,
              minHeight: 48,
            })}
          >
            {item.icon({ color, size: navigation.tabBarIconSize, focused })}
            <Text
              style={{
                marginTop: 2,
                fontSize: navigation.tabBarLabelSize,
                fontWeight: focused ? '700' : '500',
                color,
              }}
              numberOfLines={1}
            >
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
};
