import { View, Text, Pressable, StyleProp, ViewStyle } from 'react-native';
import { useOpsklTheme } from '../context/ThemeContext';

export interface SegmentOption<T extends string = string> {
  value: T;
  label: string;
  disabled?: boolean;
}

export interface SegmentedControlProps<T extends string = string> {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/** Compact tabs / segmented control with selected + pressed + disabled states. */
export function SegmentedControl<T extends string = string>({
  options,
  value,
  onChange,
  style,
  testID,
}: SegmentedControlProps<T>) {
  const { colors, spacing, radii, typography, touchTarget } = useOpsklTheme();

  return (
    <View
      testID={testID}
      accessibilityRole="tablist"
      style={[
        {
          flexDirection: 'row',
          backgroundColor: colors.surfaceSecondary,
          borderRadius: radii.md,
          padding: spacing.xxs,
        },
        style,
      ]}
    >
      {options.map((opt) => {
        const selected = opt.value === value;
        return (
          <Pressable
            key={opt.value}
            disabled={opt.disabled}
            onPress={() => onChange(opt.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected, disabled: !!opt.disabled }}
            style={({ pressed }) => ({
              flex: 1,
              minHeight: touchTarget.min,
              alignItems: 'center',
              justifyContent: 'center',
              paddingHorizontal: spacing.sm,
              borderRadius: radii.sm,
              backgroundColor: selected
                ? colors.surface
                : pressed
                ? colors.surfaceTertiary
                : 'transparent',
              opacity: opt.disabled ? 0.4 : 1,
            })}
          >
            <Text
              style={{
                fontSize: typography.caption.fontSize,
                fontWeight: selected ? '700' : '500',
                color: selected ? colors.textPrimary : colors.textSecondary,
              }}
              numberOfLines={1}
            >
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
