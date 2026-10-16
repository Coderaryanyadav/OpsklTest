import React from 'react';
import {
  Pressable,
  Text,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
  StyleProp,
  View,
} from 'react-native';
import { useOpsklTheme } from '../context/ThemeContext';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  testID?: string;
}

export const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  icon,
  iconPosition = 'left',
  fullWidth = true,
  style,
  textStyle,
  testID,
}) => {
  const { colors, radii, spacing, typography } = useOpsklTheme();

  const getContainerStyle = (pressed: boolean): ViewStyle => {
    let bg = colors.primary;
    let border = 'transparent';
    let borderWidth = 0;

    switch (variant) {
      case 'primary':
        bg = pressed ? colors.primaryHover : colors.primary;
        break;
      case 'secondary':
        bg = pressed ? colors.surfaceTertiary : colors.surface;
        border = colors.border;
        borderWidth = 1;
        break;
      case 'outline':
        bg = pressed ? colors.primaryLight : 'transparent';
        border = colors.border;
        borderWidth = 1;
        break;
      case 'danger':
        bg = pressed ? '#991B1B' : colors.danger;
        break;
      case 'ghost':
        bg = pressed ? colors.primaryLight : 'transparent';
        break;
    }

    if (disabled) {
      bg = variant === 'outline' || variant === 'ghost' ? 'transparent' : colors.surfaceMuted;
      border = variant === 'outline' ? colors.borderMuted : 'transparent';
    }

    const paddingVertical =
      size === 'sm' ? spacing.xs + 4 : size === 'lg' ? spacing.lg : spacing.md;
    const minHeight = size === 'sm' ? 44 : size === 'lg' ? 56 : 48;

    return {
      backgroundColor: bg,
      borderColor: border,
      borderWidth,
      borderRadius: radii.md,
      paddingVertical,
      paddingHorizontal: size === 'sm' ? spacing.md : spacing.xl,
      minHeight,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      opacity: disabled ? 0.6 : 1,
      width: fullWidth ? '100%' : 'auto',
    };
  };

  const getTextColor = (): string => {
    if (disabled) return colors.textMuted;
    switch (variant) {
      case 'primary':
      case 'danger':
        return colors.textInverse;
      case 'secondary':
        return colors.textPrimary;
      case 'outline':
      case 'ghost':
        return colors.primary;
      default:
        return colors.textInverse;
    }
  };

  const fontSize =
    size === 'sm' ? typography.caption.fontSize : size === 'lg' ? typography.subtitle.fontSize : typography.bodyBold.fontSize;

  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled || loading}
      hitSlop={size === 'sm' ? 8 : 4}
      style={({ pressed }) => [
        getContainerStyle(pressed),
        {
          transform: [{ scale: pressed && !disabled && !loading ? 0.98 : 1 }],
        },
        style,
      ]}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === 'outline' || variant === 'ghost' ? colors.primary : colors.textInverse}
        />
      ) : (
        <>
          {icon && iconPosition === 'left' ? <View style={{ marginRight: spacing.sm }}>{icon}</View> : null}
          <Text
            style={[
              {
                color: getTextColor(),
                fontSize,
                fontWeight: '600',
              },
              textStyle,
            ]}
          >
            {title}
          </Text>
          {icon && iconPosition === 'right' ? <View style={{ marginLeft: spacing.sm }}>{icon}</View> : null}
        </>
      )}
    </Pressable>
  );
};
