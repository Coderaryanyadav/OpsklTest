import React from 'react';
import {
  Pressable,
  View,
  Text,
  StyleProp,
  ViewStyle,
} from 'react-native';
import { useOpsklTheme } from '../context/ThemeContext';

export interface ToggleProps {
  value: boolean;
  onValueChange: (val: boolean) => void;
  label?: string;
  description?: string;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export const Toggle: React.FC<ToggleProps> = ({
  value,
  onValueChange,
  label,
  description,
  disabled = false,
  style,
  testID = 'opskl-toggle',
}) => {
  const { colors, radii, spacing, typography } = useOpsklTheme();

  return (
    <Pressable
      onPress={() => !disabled && onValueChange(!value)}
      disabled={disabled}
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: label ? 'space-between' : 'center',
          opacity: disabled ? 0.5 : 1,
          paddingVertical: spacing.xs,
          minHeight: 44,
        },
        style,
      ]}
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: value, disabled }}
      testID={testID}
    >
      {label ? (
        <View style={{ flex: 1, marginRight: spacing.md }}>
          <Text
            style={{
              fontSize: typography.bodyBold.fontSize,
              fontWeight: '600',
              color: colors.textPrimary,
            }}
          >
            {label}
          </Text>
          {description ? (
            <Text
              style={{
                fontSize: typography.caption.fontSize,
                color: colors.textSecondary,
                marginTop: spacing.xxs,
              }}
            >
              {description}
            </Text>
          ) : null}
        </View>
      ) : null}

      <View
        style={{
          width: 50,
          height: 30,
          borderRadius: radii.full,
          backgroundColor: value ? colors.primary : colors.surfaceTertiary,
          padding: 2,
          justifyContent: 'center',
          borderWidth: 1,
          borderColor: value ? colors.primary : colors.border,
        }}
      >
        <View
          style={{
            width: 24,
            height: 24,
            borderRadius: radii.full,
            backgroundColor: colors.surface,
            alignSelf: value ? 'flex-end' : 'flex-start',
            shadowColor: colors.primary,
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.15,
            shadowRadius: 2,
            elevation: 1,
          }}
        />
      </View>
    </Pressable>
  );
};
