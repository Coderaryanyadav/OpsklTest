import React from 'react';
import { View, Text } from 'react-native';
import { Search } from 'lucide-react-native';
import { useOpsklTheme } from '../context/ThemeContext';
import { Button } from './Button';

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  actionTitle?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  actionTitle,
  actionLabel,
  onAction,
}) => {
  const { colors, spacing, typography } = useOpsklTheme();
  const resolvedActionTitle = actionTitle || actionLabel;

  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: spacing.xxxl,
      }}
      accessibilityRole="summary"
      accessibilityLabel={`${title}. ${description}`}
    >
      <View
        style={{
          width: 72,
          height: 72,
          borderRadius: 36,
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: spacing.xl,
          backgroundColor: colors.surfaceMuted,
        }}
      >
        {icon ? icon : <Search size={32} color={colors.textMuted} strokeWidth={2} />}
      </View>
      <Text
        style={[
          typography.h2,
          { color: colors.textPrimary, textAlign: 'center', marginBottom: spacing.xs },
        ]}
      >
        {title}
      </Text>
      <Text
        style={[
          typography.body,
          {
            color: colors.textSecondary,
            textAlign: 'center',
            lineHeight: 22,
            marginBottom: spacing.xl,
            maxWidth: 320,
          },
        ]}
      >
        {description}
      </Text>

      {resolvedActionTitle && onAction ? (
        <Button
          title={resolvedActionTitle}
          onPress={onAction}
          variant="primary"
          size="md"
          fullWidth={false}
          style={{ minWidth: 160 }}
        />
      ) : null}
    </View>
  );
};
