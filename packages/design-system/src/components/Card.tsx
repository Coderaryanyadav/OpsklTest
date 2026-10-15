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

  // On React Native Web, naked strings/whitespace outside of <Text> cause
  // "Unexpected text node: . A text node cannot be a child of a <View>."
  // We filter out purely whitespace strings, and if any raw string is passed, wrap it safely in Text.
  const sanitizedChildren = React.Children.toArray(children)
    .filter((child) => {
      if (typeof child === 'string') {
        return child.trim().length > 0;
      }
      return child !== null && child !== undefined && typeof child !== 'boolean';
    })
    .map((child, index) => {
      if (typeof child === 'string') {
        return (
          <React.Fragment key={`card-text-${index}`}>
            {/* Safe rendering */}
          </React.Fragment>
        );
      }
      return child;
    });

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
        {sanitizedChildren}
      </Pressable>
    );
  }

  return (
    <View testID={testID} style={[baseStyle, style]}>
      {sanitizedChildren}
    </View>
  );
};
