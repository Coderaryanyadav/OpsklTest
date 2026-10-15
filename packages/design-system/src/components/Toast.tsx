import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, TouchableOpacity, StyleProp, ViewStyle } from 'react-native';
import { spacing } from '../tokens/spacing';
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
  const { colors } = useOpsklTheme();
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-20)).current;

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (visible) {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
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
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: -20,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();
    }

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [visible, duration]);

  const handleDismiss = () => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: -20,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onDismiss();
    });
  };

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
            shadowColor: colors.primary,
          },
          style,
        ]}
      >
        <Text style={[styles.message, { color: colors.textPrimary }]} numberOfLines={2}>
          {message}
        </Text>

        {actionLabel && onAction ? (
          <TouchableOpacity
            onPress={() => {
              onAction();
              handleDismiss();
            }}
            style={styles.actionBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={[styles.actionText, { color: colors.textPrimary }]}>{actionLabel}</Text>
          </TouchableOpacity>
        ) : null}

        <TouchableOpacity
          onPress={handleDismiss}
          accessibilityLabel="Dismiss notification"
          style={styles.closeBtn}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Text style={[styles.closeText, { color: colors.textSecondary }]}>✕</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  toastWrapper: {
    position: 'absolute',
    top: 50,
    left: spacing.lg,
    right: spacing.lg,
    zIndex: 9999,
    alignItems: 'center',
  },
  toastCard: {
    width: '100%',
    maxWidth: 420,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: 8,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 6,
  },
  message: {
    flex: 1,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '500',
  },
  actionBtn: {
    marginLeft: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  actionText: {
    fontSize: 13,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  closeBtn: {
    marginLeft: spacing.xs,
    padding: spacing.xxs,
  },
  closeText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
