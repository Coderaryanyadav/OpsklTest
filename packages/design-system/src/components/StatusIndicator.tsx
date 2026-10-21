import React from 'react';
import { View, Text, StyleProp, ViewStyle } from 'react-native';
import { useOpsklTheme } from '../context/ThemeContext';

export type StatusTone =
  | 'neutral'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'primary'
  | 'draft'
  | 'applied'
  | 'selected'
  | 'checked_in'
  | 'disputed'
  | 'paid';

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
      case 'draft':
        return { fg: colors.operationalDraft.text, bg: colors.operationalDraft.bg, border: colors.operationalDraft.border };
      case 'applied':
        return { fg: colors.operationalApplied.text, bg: colors.operationalApplied.bg, border: colors.operationalApplied.border };
      case 'selected':
        return { fg: colors.operationalSelected.text, bg: colors.operationalSelected.bg, border: colors.operationalSelected.border };
      case 'checked_in':
        return { fg: colors.operationalCheckedIn.text, bg: colors.operationalCheckedIn.bg, border: colors.operationalCheckedIn.border };
      case 'disputed':
        return { fg: colors.operationalDisputed.text, bg: colors.operationalDisputed.bg, border: colors.operationalDisputed.border };
      case 'paid':
        return { fg: colors.operationalPaid.text, bg: colors.operationalPaid.bg, border: colors.operationalPaid.border };
      case 'success':
        return { fg: colors.success, bg: colors.successLight, border: colors.successLight };
      case 'warning':
        return { fg: colors.warning, bg: colors.warningLight, border: colors.warningLight };
      case 'danger':
        return { fg: colors.danger, bg: colors.dangerLight, border: colors.dangerLight };
      case 'info':
        return { fg: colors.info, bg: colors.infoLight, border: colors.border };
      case 'primary':
        return { fg: colors.textInverse, bg: colors.primary, border: colors.primary };
      default:
        return { fg: colors.neutralStatus, bg: colors.neutralStatusLight, border: colors.border };
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
          borderWidth: 1,
          borderColor: palette.border,
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
