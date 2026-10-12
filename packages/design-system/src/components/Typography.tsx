import React from 'react';
import { Text, TextProps, StyleProp, TextStyle } from 'react-native';
import { useOpsklTheme } from '../context/ThemeContext';

export interface ThemedTextProps extends TextProps {
  children: React.ReactNode;
  style?: StyleProp<TextStyle>;
  color?: string;
}

export const Headline: React.FC<ThemedTextProps> = ({ children, style, color, ...rest }) => {
  const { colors, typography } = useOpsklTheme();
  return (
    <Text style={[typography.h1, { color: color || colors.textPrimary }, style]} {...rest}>
      {children}
    </Text>
  );
};

export const Title: React.FC<ThemedTextProps> = ({ children, style, color, ...rest }) => {
  const { colors, typography } = useOpsklTheme();
  return (
    <Text style={[typography.h2, { color: color || colors.textPrimary }, style]} {...rest}>
      {children}
    </Text>
  );
};

export const Subtitle: React.FC<ThemedTextProps> = ({ children, style, color, ...rest }) => {
  const { colors, typography } = useOpsklTheme();
  return (
    <Text style={[typography.subtitle, { color: color || colors.textSecondary }, style]} {...rest}>
      {children}
    </Text>
  );
};

export const Body: React.FC<ThemedTextProps> = ({ children, style, color, ...rest }) => {
  const { colors, typography } = useOpsklTheme();
  return (
    <Text style={[typography.body, { color: color || colors.textPrimary }, style]} {...rest}>
      {children}
    </Text>
  );
};

export const Caption: React.FC<ThemedTextProps> = ({ children, style, color, ...rest }) => {
  const { colors, typography } = useOpsklTheme();
  return (
    <Text style={[typography.caption, { color: color || colors.textSecondary }, style]} {...rest}>
      {children}
    </Text>
  );
};

export const WageText: React.FC<ThemedTextProps> = ({ children, style, color, ...rest }) => {
  const { colors, typography } = useOpsklTheme();
  return (
    <Text style={[typography.wageCallout, { color: color || colors.primary }, style]} {...rest}>
      {children}
    </Text>
  );
};
