import React from 'react';
import { View, Text, Pressable, StyleProp, ViewStyle } from 'react-native';
import { useOpsklTheme } from '../context/ThemeContext';

export type InlineBannerVariant = 'info' | 'warning' | 'error' | 'success';

export interface InlineBannerProps {
  variant?: InlineBannerVariant;
  title?: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  onDismiss?: () => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export const InlineBanner: React.FC<InlineBannerProps> = ({
  variant = 'info',
  title,
  message,
  actionLabel,
  onAction,
  onDismiss,
  style,
  testID,
}) => {
  const { colors, spacing, radii, typography } = useOpsklTheme();

  const getBorderColor = () => {
    switch (variant) {
      case 'warning':
        return colors.warning;
      case 'error':
        return colors.danger;
      case 'success':
        return colors.success;
      case 'info':
      default:
        return colors.border;
    }
  };

  const getBgColor = () => {
    switch (variant) {
      case 'warning':
        return colors.warningLight;
      case 'error':
        return colors.dangerLight;
      case 'success':
        return colors.successLight;
      case 'info':
      default:
        return colors.surfaceMuted;
    }
  };

  return (
    <View
      testID={testID}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      style={[
        {
          flexDirection: 'row',
          alignItems: 'flex-start',
          padding: spacing.md,
          borderRadius: radii.sm,
          borderWidth: 1,
          marginVertical: spacing.xs,
          backgroundColor: getBgColor(),
          borderColor: getBorderColor(),
        },
        style,
      ]}
    >
      <View style={{ flex: 1 }}>
        {title ? (
          <Text
            style={{
              fontSize: typography.caption.fontSize,
              fontWeight: '700',
              marginBottom: spacing.xxs,
              color: colors.textPrimary,
            }}
          >
            {title}
          </Text>
        ) : null}
        <Text
          style={{
            fontSize: typography.caption.fontSize,
            lineHeight: typography.caption.lineHeight,
            color: colors.textSecondary,
          }}
        >
          {message}
        </Text>

        {actionLabel && onAction ? (
          <Pressable
            onPress={onAction}
            accessibilityRole="button"
            accessibilityLabel={actionLabel}
            style={{
              marginTop: spacing.xs,
              alignSelf: 'flex-start',
              minHeight: 44,
              justifyContent: 'center',
            }}
            hitSlop={8}
          >
            <Text
              style={{
                fontSize: typography.caption.fontSize,
                fontWeight: '700',
                textDecorationLine: 'underline',
                color: colors.textPrimary,
              }}
            >
              {actionLabel}
            </Text>
          </Pressable>
        ) : null}
      </View>

      {onDismiss ? (
        <Pressable
          onPress={onDismiss}
          accessibilityRole="button"
          accessibilityLabel="Dismiss banner"
          style={{
            marginLeft: spacing.sm,
            minWidth: 44,
            minHeight: 44,
            alignItems: 'center',
            justifyContent: 'center',
          }}
          hitSlop={8}
        >
          <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textSecondary }}>✕</Text>
        </Pressable>
      ) : null}
    </View>
  );
};
