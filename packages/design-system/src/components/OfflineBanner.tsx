import React from 'react';
import { View, Text, StyleProp, ViewStyle } from 'react-native';
import { WifiOff } from 'lucide-react-native';
import { useOpsklTheme } from '../context/ThemeContext';
import { Button } from './Button';
import { EmptyState } from './EmptyState';

export interface OfflineBannerProps {
  message?: string;
  onRetry?: () => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/** Compact offline strip for top of screen. */
export const OfflineBanner: React.FC<OfflineBannerProps> = ({
  message = 'You are offline. Some actions may be unavailable.',
  onRetry,
  style,
  testID,
}) => {
  const { colors, spacing, typography, iconSizes } = useOpsklTheme();

  return (
    <View
      testID={testID}
      accessibilityRole="alert"
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.sm,
          backgroundColor: colors.warningLight,
          borderBottomWidth: 1,
          borderBottomColor: colors.warning,
        },
        style,
      ]}
    >
      <WifiOff size={iconSizes.sm} color={colors.warning} />
      <Text style={{ flex: 1, fontSize: typography.caption.fontSize, color: colors.warning, fontWeight: '600' }}>
        {message}
      </Text>
      {onRetry ? (
        <Button title="Retry" onPress={onRetry} variant="ghost" size="sm" fullWidth={false} />
      ) : null}
    </View>
  );
};

export interface OfflineStateProps {
  title?: string;
  description?: string;
  onRetry?: () => void;
}

/** Full-screen offline empty state. */
export const OfflineState: React.FC<OfflineStateProps> = ({
  title = 'You are offline',
  description = 'Check your connection and try again. Opskl will not invent data while offline.',
  onRetry,
}) => {
  const { colors, iconSizes } = useOpsklTheme();
  return (
    <EmptyState
      icon={<WifiOff size={iconSizes.xxl} color={colors.textMuted} />}
      title={title}
      description={description}
      actionTitle={onRetry ? 'Try again' : undefined}
      onAction={onRetry}
    />
  );
};
