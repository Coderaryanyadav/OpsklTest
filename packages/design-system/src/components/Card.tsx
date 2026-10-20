import React from 'react';
import {
  View,
  Text,
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
  const { colors, radii, spacing, shadows } = useOpsklTheme();

  const cardPadding = padding !== undefined ? padding : spacing.lg;

  const baseStyle: ViewStyle = {
    backgroundColor: variant === 'flat' ? colors.surfaceMuted : colors.surface,
    borderRadius: radii.md,
    padding: cardPadding,
    borderWidth: 1,
    borderColor: colors.border,
    width: '100%',
    ...(variant === 'elevated' ? shadows.sm : {}),
  };

  // On React Native Web, naked strings/whitespace outside of <Text> cause
  // "Unexpected text node". Filter whitespace-only strings; wrap other strings in Text.
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
          <Text key={`card-text-${index}`} style={{ color: colors.textPrimary }}>
            {child}
          </Text>
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
