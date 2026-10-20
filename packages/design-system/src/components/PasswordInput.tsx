import React, { useState } from 'react';
import {
  View,
  TextInput,
  Text,
  Pressable,
  TextInputProps,
  StyleProp,
  ViewStyle,
} from 'react-native';
import { useOpsklTheme } from '../context/ThemeContext';

export interface PasswordInputProps extends Omit<TextInputProps, 'secureTextEntry'> {
  label?: string;
  error?: string;
  helperText?: string;
  containerStyle?: StyleProp<ViewStyle>;
  testID?: string;
}

export const PasswordInput: React.FC<PasswordInputProps> = ({
  label = 'Password',
  error,
  helperText,
  containerStyle,
  style,
  testID = 'password-input',
  onFocus,
  onBlur,
  editable = true,
  ...rest
}) => {
  const { colors, radii, spacing, typography } = useOpsklTheme();
  const [isFocused, setIsFocused] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const isDisabled = editable === false;

  const borderColor = error
    ? colors.danger
    : isFocused
    ? colors.borderFocus
    : colors.border;

  return (
    <View style={[{ width: '100%', marginBottom: spacing.md }, containerStyle]} testID={testID}>
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
          backgroundColor: isDisabled ? colors.surfaceMuted : colors.surface,
          borderWidth: isFocused || error ? 1.5 : 1,
          borderColor,
          borderRadius: radii.md,
          paddingHorizontal: spacing.md,
          minHeight: 48,
          opacity: isDisabled ? 0.7 : 1,
        }}
      >
        <TextInput
          style={[
            {
              flex: 1,
              color: colors.textPrimary,
              fontSize: typography.body.fontSize,
              paddingVertical: spacing.sm,
            },
            style,
          ]}
          secureTextEntry={!isVisible}
          editable={editable}
          placeholderTextColor={colors.textMuted}
          onFocus={(e) => {
            setIsFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setIsFocused(false);
            onBlur?.(e);
          }}
          testID={`${testID}-field`}
          accessibilityLabel={label}
          {...rest}
        />

        <Pressable
          onPress={() => setIsVisible(!isVisible)}
          hitSlop={8}
          disabled={isDisabled}
          testID={`${testID}-toggle`}
          accessibilityLabel={isVisible ? 'Hide password' : 'Show password'}
          accessibilityRole="button"
          style={{
            minWidth: 44,
            minHeight: 44,
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: spacing.xs,
          }}
        >
          <Text
            style={{
              fontSize: typography.caption.fontSize,
              fontWeight: '600',
              color: colors.textSecondary,
            }}
          >
            {isVisible ? 'Hide' : 'Show'}
          </Text>
        </Pressable>
      </View>

      {error ? (
        <Text
          style={{
            fontSize: typography.caption.fontSize,
            color: colors.danger,
            marginTop: spacing.xxs,
            fontWeight: '500',
          }}
          accessibilityRole="alert"
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
