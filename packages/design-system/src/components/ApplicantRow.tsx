import React from 'react';
import { View, Text, Pressable, StyleProp, ViewStyle } from 'react-native';
import { useOpsklTheme } from '../context/ThemeContext';
import { Badge, BadgeVariant } from './Badge';
import { Button } from './Button';

export interface ApplicantRowData {
  id: string;
  workerId: string;
  workerName: string;
  rating?: number;
  reliabilityScore?: number;
  status: 'applied' | 'accepted' | 'rejected' | 'withdrawn' | string;
  appliedAt?: string;
}

export interface ApplicantRowProps {
  applicant: ApplicantRowData;
  onAccept?: () => void;
  onReject?: () => void;
  onViewProfile?: () => void;
  isProcessing?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export const ApplicantRow: React.FC<ApplicantRowProps> = ({
  applicant,
  onAccept,
  onReject,
  onViewProfile,
  isProcessing = false,
  style,
  testID = 'applicant-row',
}) => {
  const { colors, spacing, typography, radii } = useOpsklTheme();

  const initials = applicant.workerName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');

  const getStatusBadge = (): { label: string; variant: BadgeVariant } => {
    switch (applicant.status.toLowerCase()) {
      case 'accepted':
        return { label: 'Accepted', variant: 'success' };
      case 'rejected':
        return { label: 'Rejected', variant: 'danger' };
      case 'withdrawn':
        return { label: 'Withdrawn', variant: 'neutral' };
      case 'applied':
      default:
        return { label: 'Applied', variant: 'warning' };
    }
  };

  const statusBadge = getStatusBadge();
  const isPending = applicant.status.toLowerCase() === 'applied';

  return (
    <View
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingVertical: spacing.md,
          paddingHorizontal: spacing.sm,
          borderBottomWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surface,
        },
        style,
      ]}
      testID={testID}
    >
      {/* Worker info */}
      <Pressable
        onPress={onViewProfile}
        disabled={!onViewProfile}
        accessibilityRole={onViewProfile ? 'button' : undefined}
        accessibilityLabel={onViewProfile ? `View ${applicant.workerName} profile` : undefined}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          flex: 1,
          marginRight: spacing.sm,
          minHeight: 44,
        }}
        testID={`${testID}-profile-trigger`}
      >
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: radii.full,
            backgroundColor: colors.surfaceSecondary,
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: spacing.sm,
          }}
        >
          <Text style={{ fontSize: 14, fontWeight: '700', color: colors.textPrimary }}>
            {initials}
          </Text>
        </View>

        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontSize: typography.bodyBold.fontSize,
              fontWeight: '600',
              color: colors.textPrimary,
            }}
            numberOfLines={2}
          >
            {applicant.workerName}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2, gap: spacing.xs }}>
            {applicant.rating !== undefined ? (
              <Text style={{ fontSize: typography.caption.fontSize, color: colors.textSecondary }}>
                ★ {applicant.rating.toFixed(1)}
              </Text>
            ) : null}
            {applicant.reliabilityScore !== undefined ? (
              <Text style={{ fontSize: typography.caption.fontSize, color: colors.textMuted }}>
                • {applicant.reliabilityScore}% reliability
              </Text>
            ) : null}
          </View>
        </View>
      </Pressable>

      {/* Action Buttons or Status Badge */}
      {isPending && (onAccept || onReject) ? (
        <View style={{ flexDirection: 'row', gap: spacing.xs, alignItems: 'center' }}>
          {onReject ? (
            <Button
              title="Decline"
              variant="outline"
              size="sm"
              onPress={onReject}
              disabled={isProcessing}
              fullWidth={false}
              testID={`${testID}-decline-btn`}
              style={{ paddingHorizontal: spacing.sm }}
            />
          ) : null}
          {onAccept ? (
            <Button
              title="Accept"
              variant="primary"
              size="sm"
              onPress={onAccept}
              loading={isProcessing}
              fullWidth={false}
              testID={`${testID}-accept-btn`}
              style={{ paddingHorizontal: spacing.sm }}
            />
          ) : null}
        </View>
      ) : (
        <Badge label={statusBadge.label} variant={statusBadge.variant} size="sm" />
      )}
    </View>
  );
};
