import React from 'react';
import { View, Text, StyleProp, ViewStyle } from 'react-native';
import { useOpsklTheme } from '../context/ThemeContext';

export interface DividerProps {
  label?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export const Divider: React.FC<DividerProps> = ({
  label,
  style,
  testID = 'divider',
}) => {
  const { colors, spacing, typography } = useOpsklTheme();

  if (label) {
    return (
      <View
        style={[
          {
            flexDirection: 'row',
            alignItems: 'center',
            marginVertical: spacing.md,
          },
          style,
        ]}
        accessible={false}
        testID={testID}
      >
        <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
        <Text
          style={{
            paddingHorizontal: spacing.sm,
            fontSize: typography.caption.fontSize,
            color: colors.textMuted,
            fontWeight: '500',
            textTransform: 'uppercase',
            letterSpacing: 0.5,
          }}
        >
          {label}
        </Text>
        <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
      </View>
    );
  }

  return (
    <View
      style={[
        {
          height: 1,
          backgroundColor: colors.border,
          marginVertical: spacing.sm,
        },
        style,
      ]}
      accessible={false}
      testID={testID}
    />
  );
};
