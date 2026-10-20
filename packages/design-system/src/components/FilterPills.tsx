import React from 'react';
import {
  ScrollView,
  Pressable,
  Text,
  View,
  StyleProp,
  ViewStyle,
} from 'react-native';
import { useOpsklTheme } from '../context/ThemeContext';

export interface FilterPillItem {
  id: string;
  label: string;
  count?: number;
}

export interface FilterPillsProps {
  items: FilterPillItem[];
  selectedId: string;
  onSelect: (id: string) => void;
  style?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
  testID?: string;
}

export const FilterPills: React.FC<FilterPillsProps> = ({
  items,
  selectedId,
  onSelect,
  style,
  contentContainerStyle,
  testID = 'filter-pills',
}) => {
  const { colors, spacing, typography, radii } = useOpsklTheme();

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={[{ flexGrow: 0 }, style]}
      contentContainerStyle={[
        {
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.xs,
          gap: spacing.sm,
          alignItems: 'center',
        },
        contentContainerStyle,
      ]}
      accessibilityRole="tablist"
      testID={testID}
    >
      {items.map((item) => {
        const isSelected = item.id === selectedId;

        return (
          <Pressable
            key={item.id}
            onPress={() => onSelect(item.id)}
            accessibilityRole="tab"
            accessibilityState={{ selected: isSelected }}
            accessibilityLabel={
              item.count !== undefined ? `${item.label}, ${item.count}` : item.label
            }
            testID={`${testID}-item-${item.id}`}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.sm,
              borderRadius: radii.full,
              backgroundColor: isSelected ? colors.primary : colors.surfaceSecondary,
              borderWidth: 1,
              borderColor: isSelected ? colors.primary : colors.border,
              minHeight: 44,
              opacity: pressed ? 0.9 : 1,
            })}
          >
            <Text
              style={{
                fontSize: typography.caption.fontSize,
                fontWeight: isSelected ? '600' : '500',
                color: isSelected ? colors.textInverse : colors.textPrimary,
              }}
            >
              {item.label}
            </Text>

            {item.count !== undefined ? (
              <View
                style={{
                  marginLeft: spacing.xs,
                  paddingHorizontal: 6,
                  paddingVertical: 1,
                  borderRadius: radii.full,
                  backgroundColor: isSelected
                    ? 'rgba(255, 255, 255, 0.25)'
                    : colors.borderStrong,
                }}
              >
                <Text
                  style={{
                    fontSize: typography.micro.fontSize,
                    fontWeight: '700',
                    color: isSelected ? colors.textInverse : colors.textSecondary,
                  }}
                >
                  {item.count}
                </Text>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </ScrollView>
  );
};
