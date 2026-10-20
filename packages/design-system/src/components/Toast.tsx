import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Pressable,
  StyleProp,
  ViewStyle,
  Platform,
} from 'react-native';
import { useOpsklTheme } from '../context/ThemeContext';

export type ToastType = 'info' | 'success' | 'warning' | 'error';

export interface ToastProps {
  visible: boolean;
  message: string;
  type?: ToastType;
  duration?: number;
  onDismiss: () => void;
  actionLabel?: string;
  onAction?: () => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export const Toast: React.FC<ToastProps> = ({
  visible,
  message,
  type = 'info',
  duration = 3500,
  onDismiss,
  actionLabel,
  onAction,
  style,
  testID,
}) => {
  const { colors, spacing, radii, typography } = useOpsklTheme();
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-20)).current;

  const handleDismiss = () => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 0,
        duration: 150,
        useNativeDriver: Platform.OS !== 'web',
      }),
      Animated.timing(translateY, {
        toValue: -20,
        duration: 150,
        useNativeDriver: Platform.OS !== 'web',
      }),
    ]).start(() => {
      onDismiss();
    });
  };

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    if (visible) {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(translateY, {
          toValue: 0,
          duration: 200,
          useNativeDriver: Platform.OS !== 'web',
        }),
      ]).start();

      if (duration > 0) {
        timer = setTimeout(() => {
          handleDismiss();
        }, duration);
      }
    } else {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 0,
          duration: 150,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(translateY, {
          toValue: -20,
          duration: 150,
          useNativeDriver: Platform.OS !== 'web',
        }),
      ]).start();
    }

    return () => {
      if (timer) clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- animate only on visibility/duration changes
  }, [visible, duration]);

  if (!visible) return null;

  const getBorderColor = () => {
    switch (type) {
      case 'success':
        return colors.success;
      case 'warning':
        return colors.warning;
      case 'error':
        return colors.danger;
      case 'info':
      default:
        return colors.border;
    }
  };

  return (
    <Animated.View
      testID={testID}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      style={[
        styles.toastWrapper,
        {
          left: spacing.lg,
          right: spacing.lg,
          opacity,
          transform: [{ translateY }],
        },
      ]}
    >
      <View
        style={[
          styles.toastCard,
          {
            backgroundColor: colors.surfaceElevated || colors.surface,
            borderColor: getBorderColor(),
            borderRadius: radii.sm,
            paddingVertical: spacing.sm,
            paddingHorizontal: spacing.md,
            shadowColor: colors.primary,
          },
          style,
        ]}
      >
        <Text
          style={{
            flex: 1,
            fontSize: typography.caption.fontSize,
            lineHeight: typography.caption.lineHeight,
            fontWeight: '500',
            color: colors.textPrimary,
          }}
          numberOfLines={2}
        >
          {message}
        </Text>

        {actionLabel && onAction ? (
          <Pressable
            onPress={() => {
              onAction();
              handleDismiss();
            }}
            style={{
              marginLeft: spacing.sm,
              minHeight: 44,
              justifyContent: 'center',
              paddingHorizontal: spacing.xs,
            }}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={actionLabel}
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

        <Pressable
          onPress={handleDismiss}
          accessibilityLabel="Dismiss notification"
          accessibilityRole="button"
          style={{
            marginLeft: spacing.xs,
            minWidth: 44,
            minHeight: 44,
            alignItems: 'center',
            justifyContent: 'center',
          }}
          hitSlop={8}
        >
          <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textSecondary }}>✕</Text>
        </Pressable>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  toastWrapper: {
    position: 'absolute',
    top: 50,
    zIndex: 9999,
    alignItems: 'center',
  },
  toastCard: {
    width: '100%',
    maxWidth: 420,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 6,
  },
});
