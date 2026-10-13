import { View, Text, Pressable } from 'react-native';
import { useOpsklTheme } from '../context/ThemeContext';

export interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  rightAction?: React.ReactNode;
}

export const ScreenHeader: React.FC<ScreenHeaderProps> = ({
  title,
  subtitle,
  onBack,
  rightAction,
}) => {
  const { colors, spacing, typography } = useOpsklTheme();

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
        backgroundColor: colors.surface,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
        {onBack ? (
          <Pressable
            onPress={onBack}
            style={({ pressed }) => ({
              width: 44,
              height: 44,
              borderRadius: 22,
              backgroundColor: pressed ? colors.surfaceMuted : 'transparent',
              justifyContent: 'center',
              alignItems: 'center',
              marginRight: spacing.sm,
            })}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <View
              style={{
                width: 10,
                height: 10,
                borderLeftWidth: 2.2,
                borderBottomWidth: 2.2,
                borderColor: colors.textPrimary,
                transform: [{ rotate: '45deg' }],
                marginLeft: 3,
              }}
            />
          </Pressable>
        ) : null}

        <View style={{ flex: 1 }}>
          <Text
            style={[
              typography.h2,
              { color: colors.textPrimary },
            ]}
            numberOfLines={1}
          >
            {title}
          </Text>
          {subtitle ? (
            <Text
              style={[
                typography.caption,
                { color: colors.textSecondary, marginTop: 2 },
              ]}
              numberOfLines={1}
            >
              {subtitle}
            </Text>
          ) : null}
        </View>
      </View>

      {rightAction ? <View>{rightAction}</View> : null}
    </View>
  );
};
