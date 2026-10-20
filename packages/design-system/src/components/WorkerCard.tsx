import React from 'react';
import { View, Text, StyleProp, ViewStyle } from 'react-native';
import { useOpsklTheme } from '../context/ThemeContext';
import { Card } from './Card';
import { Badge } from './Badge';
import { OpsklIcon } from './Icon';

export interface WorkerCardData {
  id: string;
  fullName: string;
  rating?: number;
  completedShifts?: number;
  isVerified?: boolean;
  skills?: string[];
  city?: string;
  reliabilityScore?: number;
}

export interface WorkerCardProps {
  worker: WorkerCardData;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export const WorkerCard: React.FC<WorkerCardProps> = ({
  worker,
  onPress,
  style,
  testID = 'worker-card',
}) => {
  const { colors, spacing, typography, radii } = useOpsklTheme();

  const initials = worker.fullName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');

  return (
    <Card
      onPress={onPress}
      variant="elevated"
      style={[{ marginBottom: spacing.md }, style]}
      testID={testID}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        {/* Avatar */}
        <View
          style={{
            width: 48,
            height: 48,
            borderRadius: radii.full,
            backgroundColor: colors.surfaceSecondary,
            borderWidth: 1,
            borderColor: colors.border,
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: spacing.md,
          }}
        >
          <Text
            style={{
              fontSize: 16,
              fontWeight: '700',
              color: colors.textPrimary,
            }}
          >
            {initials}
          </Text>
        </View>

        {/* Info */}
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text
              style={{
                fontSize: typography.bodyBold.fontSize,
                fontWeight: '700',
                color: colors.textPrimary,
                marginRight: spacing.xs,
              }}
              numberOfLines={2}
            >
              {worker.fullName}
            </Text>
            {worker.isVerified ? (
              <OpsklIcon name="verified" size={16} color={colors.primary} />
            ) : null}
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2, gap: spacing.sm }}>
            {worker.rating !== undefined ? (
              <Text
                style={{
                  fontSize: typography.caption.fontSize,
                  color: colors.textSecondary,
                  fontWeight: '600',
                }}
              >
                ★ {worker.rating.toFixed(1)}
              </Text>
            ) : null}
            {worker.completedShifts !== undefined ? (
              <Text
                style={{
                  fontSize: typography.caption.fontSize,
                  color: colors.textMuted,
                }}
              >
                {worker.completedShifts} shifts
              </Text>
            ) : null}
            {worker.city ? (
              <Text
                style={{
                  fontSize: typography.caption.fontSize,
                  color: colors.textMuted,
                }}
              >
                {worker.city}
              </Text>
            ) : null}
          </View>
        </View>
      </View>

      {/* Skills */}
      {worker.skills && worker.skills.length > 0 ? (
        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: spacing.xs,
            marginTop: spacing.md,
            paddingTop: spacing.xs,
            borderTopWidth: 1,
            borderColor: colors.border,
          }}
        >
          {worker.skills.slice(0, 4).map((skill, index) => (
            <Badge key={index} label={skill} variant="neutral" size="sm" withDot={false} />
          ))}
        </View>
      ) : null}
    </Card>
  );
};
