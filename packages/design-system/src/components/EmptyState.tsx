import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useOpsklTheme } from '../context/ThemeContext';
import { Button } from './Button';

export interface EmptyStateProps {
  icon?: React.ReactNode | string;
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
    <View style={styles.container}>
      {icon ? (
        <View style={[styles.iconContainer, { backgroundColor: colors.surfaceMuted }]}>
          {typeof icon === 'string' ? (
            <Text style={styles.icon}>{icon}</Text>
          ) : (
            icon
          )}
        </View>
      ) : null}
      <Text style={[typography.h2, { color: colors.textPrimary, textAlign: 'center', marginBottom: spacing.xs }]}>
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  iconContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  icon: {
    fontSize: 32,
  },
});
