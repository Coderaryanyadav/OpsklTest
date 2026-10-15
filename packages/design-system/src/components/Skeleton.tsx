import React, { useEffect, useRef } from 'react';
import {
  Animated,
  ViewStyle,
  StyleProp,
  StyleSheet,
  AccessibilityInfo,
  Platform,
} from 'react-native';
import { useOpsklTheme } from '../context/ThemeContext';

export interface SkeletonProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/**
 * Premium pulsating skeleton placeholder for content loading states.
 * Respects system reduced-motion preferences to prevent discomfort.
 */
export const Skeleton: React.FC<SkeletonProps> = ({
  width = '100%',
  height = 16,
  borderRadius,
  style,
  testID,
}) => {
  const { radii, isDark } = useOpsklTheme();
  const opacityAnim = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    let isMounted = true;
    let activeAnimation: Animated.CompositeAnimation | null = null;

    AccessibilityInfo.isReduceMotionEnabled().then((isReduced) => {
      if (!isMounted) return;
      if (isReduced) {
        opacityAnim.setValue(0.5);
        return;
      }

      activeAnimation = Animated.loop(
        Animated.sequence([
          Animated.timing(opacityAnim, {
            toValue: 0.85,
            duration: 800,
            useNativeDriver: Platform.OS !== 'web',
          }),
          Animated.timing(opacityAnim, {
            toValue: 0.35,
            duration: 800,
            useNativeDriver: Platform.OS !== 'web',
          }),
        ])
      );

      activeAnimation.start();
    });

    return () => {
      isMounted = false;
      if (activeAnimation) {
        activeAnimation.stop();
      }
    };
  }, [opacityAnim]);

  const baseRadius = borderRadius !== undefined ? borderRadius : radii.sm;
  const skeletonColor = isDark ? '#262626' : '#E5E5E5';

  return (
    <Animated.View
      testID={testID}
      accessible={true}
      accessibilityRole="progressbar"
      accessibilityLabel="Loading content"
      style={[
        {
          width: width as any,
          height,
          borderRadius: baseRadius,
          backgroundColor: skeletonColor,
          opacity: opacityAnim,
        },
        style,
      ]}
    />
  );
};

export const ShiftCardSkeleton: React.FC = () => {
  const { colors, radii, spacing } = useOpsklTheme();

  return (
    <Animated.View
      style={[
        styles.cardContainer,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderRadius: radii.lg,
          padding: spacing.lg,
          marginBottom: spacing.md,
        },
      ]}
    >
      <Animated.View style={styles.rowBetween}>
        <Skeleton width="45%" height={16} />
        <Skeleton width={80} height={22} borderRadius={radii.full} />
      </Animated.View>
      <Skeleton width="75%" height={22} style={{ marginVertical: spacing.sm }} />
      <Skeleton width="60%" height={14} style={{ marginBottom: spacing.md }} />
      <Animated.View
        style={{
          height: 1,
          backgroundColor: colors.border,
          marginVertical: spacing.sm,
        }}
      />
      <Animated.View style={styles.rowBetween}>
        <Skeleton width={110} height={28} />
        <Skeleton width={90} height={36} borderRadius={radii.md} />
      </Animated.View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  cardContainer: {
    borderWidth: 1,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
});
