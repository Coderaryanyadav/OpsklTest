import React from 'react';
import { View, Text, ViewStyle, TextStyle, StyleProp } from 'react-native';
import { useOpsklTheme } from '../context/ThemeContext';

export type BadgeVariant =
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'primary'
  | 'neutral'
  | 'draft'
  | 'applied'
  | 'selected'
  | 'checked_in'
  | 'disputed'
  | 'paid';

export interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
  withDot?: boolean;
  icon?: React.ReactNode;
  size?: 'sm' | 'md';
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}

export const Badge: React.FC<BadgeProps> = ({
  label,
  variant = 'primary',
  withDot = true,
  icon,
  size = 'md',
  style,
  textStyle,
}) => {
  const { colors, radii, spacing } = useOpsklTheme();

  const getVariantStyles = (): { bg: string; text: string; dot: string; border: string } => {
    switch (variant) {
      case 'draft':
        return {
          bg: colors.operationalDraft.bg,
          text: colors.operationalDraft.text,
          dot: colors.operationalDraft.text,
          border: colors.operationalDraft.border,
        };
      case 'applied':
        return {
          bg: colors.operationalApplied.bg,
          text: colors.operationalApplied.text,
          dot: colors.operationalApplied.text,
          border: colors.operationalApplied.border,
        };
      case 'selected':
        return {
          bg: colors.operationalSelected.bg,
          text: colors.operationalSelected.text,
          dot: colors.operationalSelected.text,
          border: colors.operationalSelected.border,
        };
      case 'checked_in':
        return {
          bg: colors.operationalCheckedIn.bg,
          text: colors.operationalCheckedIn.text,
          dot: colors.operationalCheckedIn.text,
          border: colors.operationalCheckedIn.border,
        };
      case 'disputed':
        return {
          bg: colors.operationalDisputed.bg,
          text: colors.operationalDisputed.text,
          dot: colors.operationalDisputed.text,
          border: colors.operationalDisputed.border,
        };
      case 'paid':
        return {
          bg: colors.operationalPaid.bg,
          text: colors.operationalPaid.text,
          dot: colors.operationalPaid.text,
          border: colors.operationalPaid.border,
        };
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
          paddingVertical: isSm ? 2 : spacing.xxs + 2,
          paddingHorizontal: isSm ? spacing.xs + 4 : spacing.sm + 4,
          borderRadius: radii.full,
          borderWidth: 1,
          borderColor: border,
          minHeight: isSm ? 20 : 24,
        },
        style,
      ]}
    >
      {icon ? (
        <View style={{ marginRight: spacing.xs }}>{icon}</View>
      ) : withDot ? (
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
            fontSize: isSm ? 10 : 11,
            fontWeight: '700',
            letterSpacing: 0.4,
            textTransform: 'uppercase',
          },
          textStyle,
        ]}
      >
        {label}
      </Text>
    </View>
  );
};
