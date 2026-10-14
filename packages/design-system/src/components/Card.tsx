import React from 'react';
import {
  View,
  Pressable,
  StyleProp,
  ViewStyle,
} from 'react-native';
import { useOpsklTheme } from '../context/ThemeContext';

export interface CardProps {
  children: React.ReactNode;
  onPress?: () => void;
  variant?: 'elevated' | 'outlined' | 'flat';
  style?: StyleProp<ViewStyle>;
  padding?: number;
  testID?: string;
}

export const Card: React.FC<CardProps> = ({
  children,
  onPress,
  variant = 'elevated',
  style,
  padding,
  testID,
}) => {
  const { colors, radii, spacing, shadows, isDark } = useOpsklTheme();

  const cardPadding = padding !== undefined ? padding : spacing.lg;

  const baseStyle: ViewStyle = {
    backgroundColor: variant === 'flat' ? colors.surfaceMuted : colors.surface,
    borderRadius: radii.lg,
    padding: cardPadding,
    borderWidth: 1,
    borderColor: colors.border,
    ...(variant === 'elevated' ? (isDark ? shadows.sm : shadows.sm) : {}),
  };

  if (onPress) {
    return (
      <Pressable
        testID={testID}
        onPress={onPress}
        style={({ pressed }) => [
          baseStyle,
          {
            opacity: pressed ? 0.92 : 1,
            transform: [{ scale: pressed ? 0.99 : 1 }],
          },
          style,
        ]}
        accessibilityRole="button"
      >
        {children}
      </Pressable>
    );
  }

  return (
    <View testID={testID} style={[baseStyle, style]}>
      {children}
    </View>
  );
};
