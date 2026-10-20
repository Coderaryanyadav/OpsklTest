import React from 'react';
import { View, Text, StyleProp, ViewStyle } from 'react-native';
import { useOpsklTheme } from '../context/ThemeContext';

export type StatusTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'primary';

export interface StatusIndicatorProps {
  label: string;
  tone?: StatusTone;
  /** Always show text label — never color alone. */
  withDot?: boolean;
  size?: 'sm' | 'md';
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/** Status chip with mandatory text label (dot is optional reinforcement). */
export const StatusIndicator: React.FC<StatusIndicatorProps> = ({
  label,
  tone = 'neutral',
  withDot = true,
  size = 'sm',
  style,
  testID,
}) => {
  const { colors, spacing, radii, typography, componentSizes } = useOpsklTheme();

  const palette = (() => {
    switch (tone) {
      case 'success':
        return { fg: colors.success, bg: colors.successLight };
      case 'warning':
        return { fg: colors.warning, bg: colors.warningLight };
      case 'danger':
        return { fg: colors.danger, bg: colors.dangerLight };
      case 'info':
        return { fg: colors.info, bg: colors.infoLight };
      case 'primary':
        return { fg: colors.textInverse, bg: colors.primary };
      default:
        return { fg: colors.neutralStatus, bg: colors.neutralStatusLight };
    }
  })();

  return (
    <View
      testID={testID}
      accessibilityRole="text"
      accessibilityLabel={label}
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          alignSelf: 'flex-start',
          gap: spacing.xs,
          paddingHorizontal: spacing.sm,
          paddingVertical: size === 'sm' ? spacing.xxs + 2 : spacing.xs,
          borderRadius: radii.full,
          backgroundColor: palette.bg,
        },
        style,
      ]}
    >
      {withDot ? (
        <View
          style={{
            width: componentSizes.statusDot,
            height: componentSizes.statusDot,
            borderRadius: componentSizes.statusDot / 2,
            backgroundColor: palette.fg,
          }}
        />
      ) : null}
      <Text
        style={{
          fontSize: size === 'sm' ? typography.micro.fontSize : typography.caption.fontSize,
          fontWeight: '700',
          letterSpacing: 0.4,
          textTransform: 'uppercase',
          color: palette.fg,
        }}
      >
        {label}
      </Text>
    </View>
  );
};
