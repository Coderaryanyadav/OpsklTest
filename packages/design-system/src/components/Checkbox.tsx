import React from 'react';
import {
  Pressable,
  View,
  Text,
  StyleProp,
  ViewStyle,
} from 'react-native';
import { useOpsklTheme } from '../context/ThemeContext';
import { OpsklIcon } from './Icon';

export interface CheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export const Checkbox: React.FC<CheckboxProps> = ({
  checked,
  onChange,
  label,
  disabled = false,
  style,
  testID = 'opskl-checkbox',
}) => {
  const { colors, radii, spacing, typography } = useOpsklTheme();

  return (
    <Pressable
      onPress={() => !disabled && onChange(!checked)}
      disabled={disabled}
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          opacity: disabled ? 0.5 : 1,
          paddingVertical: spacing.xs,
          minHeight: 44,
        },
        style,
      ]}
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked, disabled }}
      testID={testID}
    >
      <View
        style={{
          width: 22,
          height: 22,
          borderRadius: radii.xs,
          borderWidth: checked ? 0 : 1.5,
          borderColor: colors.borderStrong,
          backgroundColor: checked ? colors.primary : 'transparent',
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: label ? spacing.sm : 0,
        }}
      >
        {checked ? (
          <OpsklIcon name="check" size="sm" color={colors.textInverse} strokeWidth={2.5} />
        ) : null}
      </View>

      {label ? (
        <Text
          style={{
            fontSize: typography.body.fontSize,
            color: colors.textPrimary,
            fontWeight: '500',
          }}
        >
          {label}
        </Text>
      ) : null}
    </Pressable>
  );
};
