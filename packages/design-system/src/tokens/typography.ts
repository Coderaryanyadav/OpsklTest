import { TextStyle } from 'react-native';

/**
 * OPSKL DESIGN SYSTEM TYPOGRAPHY TOKENS
 * Optimized for rapid scanning: bold rates, clear status badges, legible addresses.
 */

export const fontSizes = {
  xs: 11,
  sm: 13,
  md: 15,
  lg: 17,
  xl: 20,
  xxl: 24,
  xxxl: 28,
  display: 34,
} as const;

export const lineHeights = {
  xs: 15,
  sm: 18,
  md: 22,
  lg: 24,
  xl: 28,
  xxl: 32,
  xxxl: 36,
  display: 42,
} as const;

export const typography: Record<string, TextStyle> = {
  display: {
    fontSize: fontSizes.display,
    lineHeight: lineHeights.display,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  h1: {
    fontSize: fontSizes.xxxl,
    lineHeight: lineHeights.xxxl,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  h2: {
    fontSize: fontSizes.xxl,
    lineHeight: lineHeights.xxl,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  h3: {
    fontSize: fontSizes.xl,
    lineHeight: lineHeights.xl,
    fontWeight: '600',
  },
  subtitle: {
    fontSize: fontSizes.lg,
    lineHeight: lineHeights.lg,
    fontWeight: '600',
  },
  body: {
    fontSize: fontSizes.md,
    lineHeight: lineHeights.md,
    fontWeight: '400',
  },
  bodyBold: {
    fontSize: fontSizes.md,
    lineHeight: lineHeights.md,
    fontWeight: '600',
  },
  caption: {
    fontSize: fontSizes.sm,
    lineHeight: lineHeights.sm,
    fontWeight: '500',
  },
  micro: {
    fontSize: fontSizes.xs,
    lineHeight: lineHeights.xs,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  label: {
    fontSize: fontSizes.xs,
    lineHeight: lineHeights.xs,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  wageCallout: {
    fontSize: 26,
    lineHeight: 32,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
};
