import React, { useState } from 'react';
import {
  View,
  TextInput,
  Text,
  TextInputProps,
  StyleProp,
  ViewStyle,
} from 'react-native';
import { useOpsklTheme } from '../context/ThemeContext';

export interface InputProps extends TextInputProps {
  label?: string;
  prefix?: string;
  suffix?: string;
  error?: string;
  helperText?: string;
  containerStyle?: StyleProp<ViewStyle>;
}

export const Input: React.FC<InputProps> = ({
  label,
  prefix,
  suffix,
  error,
  helperText,
  containerStyle,
  style,
  onFocus,
  onBlur,
  ...rest
}) => {
  const { colors, radii, spacing, typography } = useOpsklTheme();
  const [isFocused, setIsFocused] = useState(false);

  const borderColor = error
    ? colors.danger
    : isFocused
    ? colors.borderFocus
    : colors.border;

  return (
    <View style={[{ width: '100%', marginBottom: spacing.md }, containerStyle]}>
      {label ? (
        <Text
          style={{
            fontSize: typography.caption.fontSize,
            fontWeight: '600',
            color: colors.textSecondary,
            marginBottom: spacing.xs,
          }}
        >
          {label}
        </Text>
      ) : null}

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: colors.surface,
          borderWidth: isFocused || error ? 1.5 : 1,
          borderColor,
          borderRadius: radii.md,
          paddingHorizontal: spacing.md,
          minHeight: 48,
        }}
      >
        {prefix ? (
          <Text
            style={{
              fontSize: typography.bodyBold.fontSize,
              fontWeight: '600',
              color: colors.textSecondary,
              marginRight: spacing.xs,
            }}
          >
            {prefix}
          </Text>
        ) : null}

        <TextInput
          style={[
            {
              flex: 1,
              color: colors.textPrimary,
              fontSize: typography.body.fontSize,
              paddingVertical: spacing.sm,
              textAlignVertical: rest.multiline ? 'top' : 'center',
            },
            style,
          ]}
          placeholderTextColor={colors.textMuted}
          onFocus={(e) => {
            setIsFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setIsFocused(false);
            onBlur?.(e);
          }}
          {...rest}
        />

        {suffix ? (
          <Text
            style={{
              fontSize: typography.caption.fontSize,
              color: colors.textSecondary,
              marginLeft: spacing.xs,
            }}
          >
            {suffix}
          </Text>
        ) : null}
      </View>

      {error ? (
        <Text
          style={{
            fontSize: typography.caption.fontSize,
            color: colors.danger,
            marginTop: spacing.xxs,
            fontWeight: '500',
          }}
        >
          {error}
        </Text>
      ) : helperText ? (
        <Text
          style={{
            fontSize: typography.caption.fontSize,
            color: colors.textMuted,
            marginTop: spacing.xxs,
          }}
        >
          {helperText}
        </Text>
      ) : null}
    </View>
  );
};
