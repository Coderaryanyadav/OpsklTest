import React from 'react';
import { View, Text, StyleProp, ViewStyle } from 'react-native';
import { useOpsklTheme } from '../context/ThemeContext';
import { Card } from './Card';
import { OpsklIcon, IconName } from './Icon';

export interface MetricCardProps {
  label: string;
  value: string | number;
  icon?: IconName;
  trend?: {
    value: string;
    isPositive?: boolean;
    neutral?: boolean;
  };
  subtitle?: string;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  label,
  value,
  icon,
  trend,
  subtitle,
  onPress,
  style,
  testID = 'metric-card',
}) => {
  const { colors, spacing, typography, radii } = useOpsklTheme();

  return (
    <Card
      variant="elevated"
      onPress={onPress}
      style={[{ flex: 1, padding: spacing.md }, style]}
      testID={testID}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: spacing.xs,
        }}
      >
        <Text
          style={{
            fontSize: typography.caption.fontSize,
            color: colors.textSecondary,
            fontWeight: '600',
            textTransform: 'uppercase',
            letterSpacing: 0.5,
          }}
          numberOfLines={1}
        >
          {label}
        </Text>

        {icon ? (
          <View
            style={{
              width: 32,
              height: 32,
              borderRadius: radii.sm,
              backgroundColor: colors.surfaceSecondary,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <OpsklIcon name={icon} size={16} color={colors.primary} />
          </View>
        ) : null}
      </View>

      <Text
        style={{
          fontSize: typography.title2.fontSize,
          lineHeight: typography.title2.lineHeight,
          fontWeight: typography.title2.fontWeight,
          color: colors.textPrimary,
          letterSpacing: typography.title2.letterSpacing,
        }}
        numberOfLines={1}
        accessibilityLabel={`${label}: ${value}`}
      >
        {value}
      </Text>

      {trend || subtitle ? (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            marginTop: spacing.xxs,
            gap: spacing.xs,
          }}
        >
          {trend ? (
            <Text
              style={{
                fontSize: typography.caption.fontSize,
                fontWeight: '700',
                color: trend.neutral
                  ? colors.textSecondary
                  : trend.isPositive
                  ? colors.success
                  : colors.danger,
              }}
            >
              {trend.isPositive ? '↑ ' : trend.neutral ? '• ' : '↓ '}
              {trend.value}
            </Text>
          ) : null}

          {subtitle ? (
            <Text
              style={{
                fontSize: typography.caption.fontSize,
                color: colors.textMuted,
              }}
              numberOfLines={1}
            >
              {subtitle}
            </Text>
          ) : null}
        </View>
      ) : null}
    </Card>
  );
};
