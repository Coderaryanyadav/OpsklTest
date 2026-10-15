import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, StyleProp, ViewStyle } from 'react-native';
import { spacing } from '../tokens/spacing';
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
  const { colors } = useOpsklTheme();

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
        styles.container,
        {
          backgroundColor: getBgColor(),
          borderColor: getBorderColor(),
        },
        style,
      ]}
    >
      <View style={styles.content}>
        {title ? (
          <Text style={[styles.title, { color: colors.textPrimary }]}>{title}</Text>
        ) : null}
        <Text style={[styles.message, { color: colors.textSecondary }]}>{message}</Text>

        {actionLabel && onAction ? (
          <TouchableOpacity
            onPress={onAction}
            accessibilityRole="button"
            accessibilityLabel={actionLabel}
            style={styles.actionBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={[styles.actionText, { color: colors.textPrimary }]}>{actionLabel}</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {onDismiss ? (
        <TouchableOpacity
          onPress={onDismiss}
          accessibilityRole="button"
          accessibilityLabel="Dismiss banner"
          style={styles.dismissBtn}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Text style={[styles.dismissText, { color: colors.textSecondary }]}>✕</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: spacing.md,
    borderRadius: 8,
    borderWidth: 1,
    marginVertical: spacing.xs,
  },
  content: {
    flex: 1,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: spacing.xxs,
  },
  message: {
    fontSize: 13,
    lineHeight: 18,
  },
  actionBtn: {
    marginTop: spacing.xs,
    alignSelf: 'flex-start',
  },
  actionText: {
    fontSize: 13,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  dismissBtn: {
    marginLeft: spacing.sm,
    padding: spacing.xxs,
  },
  dismissText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
