import React from 'react';
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';
import { useOpsklTheme } from '../context/ThemeContext';
import { Card } from './Card';
import { Skeleton } from './Skeleton';

export interface LoadingViewProps {
  message?: string;
}

export const LoadingView: React.FC<LoadingViewProps> = ({ message = 'Loading shifts…' }) => {
  const { colors, spacing, typography } = useOpsklTheme();

  return (
    <View style={[styles.center, { backgroundColor: colors.background }]}>
      <ActivityIndicator size="large" color={colors.primary} />
      <Text
        style={{
          marginTop: spacing.md,
          color: colors.textSecondary,
          fontSize: typography.body.fontSize,
          fontWeight: '500',
        }}
      >
        {message}
      </Text>
    </View>
  );
};

export const SkeletonCard: React.FC = () => {
  const { colors, radii, spacing } = useOpsklTheme();

  return (
    <Card style={{ marginBottom: spacing.md }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.sm }}>
        <Skeleton width="55%" height={20} borderRadius={radii.xs} />
        <Skeleton width={70} height={20} borderRadius={radii.full} />
      </View>
      <Skeleton width="40%" height={16} borderRadius={radii.xs} style={{ marginBottom: spacing.md }} />
      <View style={{ width: '100%', height: 1, backgroundColor: colors.border, marginBottom: spacing.md }} />
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Skeleton width={90} height={24} borderRadius={radii.xs} />
        <Skeleton width={110} height={36} borderRadius={radii.md} />
      </View>
    </Card>
  );
};

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
});
