import React from 'react';
import { View, Text, Pressable, StyleProp, ViewStyle } from 'react-native';
import { useOpsklTheme } from '../context/ThemeContext';
import { OpsklIcon } from './Icon';

export interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  backLabel?: string;
  rightAction?: React.ReactNode;
  largeTitle?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export const ScreenHeader: React.FC<ScreenHeaderProps> = ({
  title,
  subtitle,
  onBack,
  backLabel,
  rightAction,
  largeTitle = false,
  style,
  testID = 'screen-header',
}) => {
  const { colors, spacing, typography } = useOpsklTheme();

  return (
    <View
      style={[
        {
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.md,
          paddingBottom: spacing.sm,
          backgroundColor: colors.background,
        },
        style,
      ]}
      testID={testID}
    >
      {/* Top row: Back button & Right action */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          minHeight: 44,
          marginBottom: largeTitle ? spacing.sm : 0,
        }}
      >
        {onBack ? (
          <Pressable
            onPress={onBack}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={backLabel || 'Go back'}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              minHeight: 44,
              paddingRight: spacing.sm,
            }}
            testID={`${testID}-back`}
          >
            <OpsklIcon name="chevron-left" size="md" color={colors.textPrimary} />
            {backLabel ? (
              <Text
                style={{
                  fontSize: typography.body.fontSize,
                  color: colors.primary,
                  marginLeft: spacing.xs,
                  fontWeight: '500',
                }}
              >
                {backLabel}
              </Text>
            ) : null}
          </Pressable>
        ) : (
          <View style={{ width: 44 }} />
        )}

        {!largeTitle && (
          <View style={{ flex: 1, alignItems: 'center', paddingHorizontal: spacing.sm }}>
            <Text
              style={{
                fontSize: typography.bodyBold.fontSize,
                fontWeight: '700',
                color: colors.textPrimary,
                textAlign: 'center',
              }}
              numberOfLines={2}
            >
              {title}
            </Text>
            {subtitle ? (
              <Text
                style={{
                  fontSize: typography.caption.fontSize,
                  color: colors.textSecondary,
                  textAlign: 'center',
                  marginTop: 2,
                }}
                numberOfLines={2}
              >
                {subtitle}
              </Text>
            ) : null}
          </View>
        )}

        <View style={{ minWidth: 44, alignItems: 'flex-end', justifyContent: 'center' }}>
          {rightAction}
        </View>
      </View>

      {/* Large Title Style (iOS style) */}
      {largeTitle && (
        <View style={{ marginTop: spacing.xs }} accessibilityRole="header">
          <Text
            style={{
              fontSize: typography.largeTitle.fontSize,
              lineHeight: typography.largeTitle.lineHeight,
              fontWeight: typography.largeTitle.fontWeight,
              color: colors.textPrimary,
              letterSpacing: typography.largeTitle.letterSpacing,
            }}
            accessibilityRole="header"
          >
            {title}
          </Text>
          {subtitle ? (
            <Text
              style={{
                fontSize: typography.subheadline.fontSize,
                lineHeight: typography.subheadline.lineHeight,
                fontWeight: typography.subheadline.fontWeight,
                color: colors.textSecondary,
                marginTop: spacing.xxs,
              }}
            >
              {subtitle}
            </Text>
          ) : null}
        </View>
      )}
    </View>
  );
};
