import React from 'react';
import { View, Text, StyleProp, ViewStyle } from 'react-native';
import { useOpsklTheme } from '../context/ThemeContext';

export interface FormFieldProps {
  label?: string;
  error?: string;
  helperText?: string;
  required?: boolean;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/** Label + control + validation/helper message. Wraps any input without adding a card. */
export const FormField: React.FC<FormFieldProps> = ({
  label,
  error,
  helperText,
  required,
  children,
  style,
  testID,
}) => {
  const { colors, spacing, typography } = useOpsklTheme();

  return (
    <View style={[{ width: '100%', marginBottom: spacing.md }, style]} testID={testID}>
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
          {required ? <Text style={{ color: colors.danger }}> *</Text> : null}
        </Text>
      ) : null}
      {children}
      {error ? (
        <Text
          accessibilityLiveRegion="polite"
          style={{
            marginTop: spacing.xs,
            fontSize: typography.caption.fontSize,
            color: colors.danger,
            fontWeight: '500',
          }}
        >
          {error}
        </Text>
      ) : helperText ? (
        <Text
          style={{
            marginTop: spacing.xs,
            fontSize: typography.caption.fontSize,
            color: colors.textMuted,
          }}
        >
          {helperText}
        </Text>
      ) : null}
    </View>
  );
};
