import React from 'react';
import { View, Text, ViewStyle, TextStyle, StyleProp } from 'react-native';
import { useOpsklTheme } from '../context/ThemeContext';

export type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'primary' | 'neutral';

export interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
  withDot?: boolean;
  size?: 'sm' | 'md';
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}

export const Badge: React.FC<BadgeProps> = ({
  label,
  variant = 'primary',
  withDot = true,
  size = 'md',
  style,
  textStyle,
}) => {
  const { colors, radii, spacing } = useOpsklTheme();

  const getVariantStyles = (): { bg: string; text: string; dot: string; border: string } => {
    switch (variant) {
      case 'success':
        return {
          bg: colors.successLight,
          text: colors.success,
          dot: colors.success,
          border: colors.successLight,
        };
      case 'warning':
        return {
          bg: colors.warningLight,
          text: colors.warning,
          dot: colors.warning,
          border: colors.warningLight,
        };
      case 'danger':
        return {
          bg: colors.dangerLight,
          text: colors.danger,
          dot: colors.danger,
          border: colors.dangerLight,
        };
      case 'info':
      case 'primary':
        return {
          bg: colors.infoLight,
          text: colors.info,
          dot: colors.info,
          border: colors.border,
        };
      case 'neutral':
      default:
        return {
          bg: colors.neutralStatusLight,
          text: colors.neutralStatus,
          dot: colors.neutralStatus,
          border: colors.border,
        };
    }
  };

  const { bg, text, dot, border } = getVariantStyles();
  const isSm = size === 'sm';

  return (
    <View
      accessibilityRole="text"
      accessibilityLabel={label}
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          alignSelf: 'flex-start',
          backgroundColor: bg,
          paddingVertical: isSm ? 2 : spacing.xxs + 1,
          paddingHorizontal: isSm ? spacing.xs + 4 : spacing.sm + 4,
          borderRadius: radii.full,
          borderWidth: 1,
          borderColor: border,
        },
        style,
      ]}
    >
      {withDot ? (
        <View
          style={{
            width: isSm ? 5 : 6,
            height: isSm ? 5 : 6,
            borderRadius: 3,
            backgroundColor: dot,
            marginRight: spacing.xs + 2,
          }}
        />
      ) : null}
      <Text
        style={[
          {
            color: text,
            fontSize: isSm ? 11 : 12,
            fontWeight: '600',
            letterSpacing: -0.1,
          },
          textStyle,
        ]}
      >
        {label}
      </Text>
    </View>
  );
};
