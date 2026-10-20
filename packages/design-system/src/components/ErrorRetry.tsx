import React from 'react';
import { View, Text, StyleProp, ViewStyle } from 'react-native';
import { AlertCircle } from 'lucide-react-native';
import { useOpsklTheme } from '../context/ThemeContext';
import { Button } from './Button';
import { EmptyState } from './EmptyState';

export interface ErrorRetryProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
  /** `banner` = inline strip; `block` = full empty-state replacement */
  variant?: 'banner' | 'block';
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/**
 * Error + optional retry — visually distinct from empty success states.
 * Use whenever an API fails so zeros/empty lists are not mistaken for real data.
 */
export const ErrorRetry: React.FC<ErrorRetryProps> = ({
  title = 'Something went wrong',
  message,
  onRetry,
  retryLabel = 'Retry',
  variant = 'banner',
  style,
  testID,
}) => {
  const { colors, spacing, radii, typography, iconSizes } = useOpsklTheme();

  if (variant === 'block') {
    return (
      <EmptyState
        icon={<AlertCircle size={iconSizes.xxl} color={colors.danger} />}
        title={title}
        description={message}
        actionTitle={onRetry ? retryLabel : undefined}
        onAction={onRetry}
      />
    );
  }

  return (
    <View
      testID={testID}
      accessibilityRole="alert"
      accessibilityLiveRegion="assertive"
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
          padding: spacing.md,
          borderRadius: radii.md,
          backgroundColor: colors.dangerLight,
          borderWidth: 1,
          borderColor: colors.danger,
        },
        style,
      ]}
    >
      <AlertCircle size={iconSizes.md} color={colors.danger} />
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: typography.caption.fontSize, fontWeight: '700', color: colors.danger }}>
          {title}
        </Text>
        <Text style={{ fontSize: typography.caption.fontSize, color: colors.danger, marginTop: 2 }}>
          {message}
        </Text>
      </View>
      {onRetry ? (
        <Button title={retryLabel} onPress={onRetry} variant="outline" size="sm" fullWidth={false} />
      ) : null}
    </View>
  );
};
