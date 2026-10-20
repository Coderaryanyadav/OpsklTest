import React from 'react';
import { View, Text, StyleProp, ViewStyle } from 'react-native';
import { useOpsklTheme } from '../context/ThemeContext';
import { Card } from './Card';
import { Badge, BadgeVariant } from './Badge';
import { OpsklIcon } from './Icon';

export interface ShiftCardData {
  id: string;
  title: string;
  companyName?: string;
  hourlyRate: number;
  totalWage?: number;
  shiftDate: string;
  startTime: string;
  endTime: string;
  venueName?: string;
  city?: string;
  status: 'draft' | 'open' | 'in_progress' | 'completed' | 'cancelled' | string;
  filledSlots?: number;
  totalSlots?: number;
}

export interface ShiftCardProps {
  shift: ShiftCardData;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export const ShiftCard: React.FC<ShiftCardProps> = ({
  shift,
  onPress,
  style,
  testID = 'shift-card',
}) => {
  const { colors, spacing, typography, radii } = useOpsklTheme();

  const getStatusBadge = (): { label: string; variant: BadgeVariant } => {
    switch (shift.status.toLowerCase()) {
      case 'open':
        return { label: 'Open', variant: 'success' };
      case 'in_progress':
        return { label: 'In Progress', variant: 'warning' };
      case 'completed':
        return { label: 'Completed', variant: 'info' };
      case 'cancelled':
        return { label: 'Cancelled', variant: 'danger' };
      case 'draft':
      default:
        return { label: 'Draft', variant: 'neutral' };
    }
  };

  const statusBadge = getStatusBadge();

  return (
    <Card
      onPress={onPress}
      variant="outlined"
      style={[
        {
          marginBottom: spacing.md,
          borderRadius: radii.lg,
          borderColor: colors.border,
          backgroundColor: colors.surface,
          padding: spacing.md,
        },
        style,
      ]}
      testID={testID}
    >
      {/* Header: Title and Status Badge */}
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: spacing.xs,
        }}
      >
        <View style={{ flex: 1, marginRight: spacing.sm }}>
          <Text
            style={{
              fontSize: typography.bodyBold.fontSize,
              fontWeight: '700',
              color: colors.textPrimary,
              letterSpacing: -0.2,
            }}
            numberOfLines={2}
          >
            {shift.title}
          </Text>
          {shift.companyName ? (
            <Text
              style={{
                fontSize: typography.caption.fontSize,
                color: colors.textSecondary,
                marginTop: 2,
                fontWeight: '500',
              }}
              numberOfLines={2}
            >
              {shift.companyName}
            </Text>
          ) : null}
        </View>

        <Badge label={statusBadge.label} variant={statusBadge.variant} size="sm" />
      </View>

      {/* Wage Pill & Capacity */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginVertical: spacing.xs,
          paddingVertical: spacing.xs,
          borderTopWidth: 1,
          borderBottomWidth: 1,
          borderColor: colors.border,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
          <Text
            style={{
              fontSize: typography.h2.fontSize || 22,
              fontWeight: '800',
              color: colors.textPrimary,
              letterSpacing: -0.3,
            }}
          >
            ₹{shift.totalWage ? shift.totalWage : shift.hourlyRate}
          </Text>
          <Text
            style={{
              fontSize: typography.caption.fontSize,
              color: colors.textSecondary,
              marginLeft: 4,
              fontWeight: '600',
            }}
          >
            {shift.totalWage ? 'total' : '/hr'}
          </Text>
          {shift.totalWage ? (
            <Text
              style={{
                fontSize: 12,
                color: colors.textSecondary,
                marginLeft: spacing.xs,
              }}
            >
              (₹{shift.hourlyRate}/hr)
            </Text>
          ) : null}
        </View>

        {shift.totalSlots !== undefined ? (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: colors.surfaceMuted,
              paddingHorizontal: spacing.sm,
              paddingVertical: 3,
              borderRadius: radii.full,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <OpsklIcon name="users" size={13} color={colors.textSecondary} style={{ marginRight: 4 }} />
            <Text
              style={{
                fontSize: 11,
                fontWeight: '700',
                color: colors.textPrimary,
                textTransform: 'uppercase',
                letterSpacing: 0.3,
              }}
            >
              {shift.filledSlots ?? 0}/{shift.totalSlots} confirmed
            </Text>
          </View>
        ) : null}
      </View>

      {/* Metadata: Date, Time, Venue */}
      <View style={{ marginTop: spacing.xs, gap: 5 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <OpsklIcon name="time" size={14} color={colors.accent} style={{ marginRight: spacing.xs }} />
          <Text
            style={{
              fontSize: typography.caption.fontSize,
              color: colors.textSecondary,
              fontWeight: '500',
            }}
          >
            {shift.shiftDate} • {shift.startTime} – {shift.endTime} (IST)
          </Text>
        </View>

        {(shift.venueName || shift.city) && (
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <OpsklIcon name="location" size={14} color={colors.accent} style={{ marginRight: spacing.xs }} />
            <Text
              style={{
                fontSize: typography.caption.fontSize,
                color: colors.textSecondary,
                fontWeight: '500',
              }}
              numberOfLines={2}
            >
              {[shift.venueName, shift.city].filter(Boolean).join(', ')}
            </Text>
          </View>
        )}
      </View>
    </Card>
  );
};
