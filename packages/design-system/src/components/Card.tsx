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
  elevationLayer?: 0 | 1 | 2 | 3;
  style?: StyleProp<ViewStyle>;
  padding?: number;
  testID?: string;
}

export const Card: React.FC<CardProps> = ({
  children,
  onPress,
  variant = 'elevated',
  elevationLayer,
  style,
  padding,
  testID,
}) => {
  const { colors, radii, spacing, shadows, elevationLayers } = useOpsklTheme();

  const cardPadding = padding !== undefined ? padding : spacing.lg;

  const layerStyle: ViewStyle = (() => {
    if (elevationLayer === 0) return { ...elevationLayers.layer0, backgroundColor: colors.background };
    if (elevationLayer === 1) return { ...elevationLayers.layer1, backgroundColor: colors.surface };
    if (elevationLayer === 2) return { ...elevationLayers.layer2, backgroundColor: colors.surfaceElevated };
    if (elevationLayer === 3) return { ...elevationLayers.layer3, backgroundColor: colors.surfaceElevated };
    return {};
  })();

  const baseStyle: ViewStyle = {
    backgroundColor: variant === 'flat' ? colors.surfaceMuted : colors.surface,
    borderRadius: radii.md,
    padding: cardPadding,
    borderWidth: 1,
    borderColor: colors.border,
    width: '100%',
    ...(variant === 'elevated' ? shadows.sm : {}),
    ...layerStyle,
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
