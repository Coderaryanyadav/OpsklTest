import { TextStyle } from 'react-native';

/**
 * OPSKL DESIGN SYSTEM TYPOGRAPHY TOKENS
 * Optimized for rapid scanning: bold rates, clear status badges, legible addresses.
 *
 * Naming:
 * - Primary scale: display, h1–h3, subtitle, body, caption, micro, label
 * - Apple-like aliases: largeTitle, title1–title3, headline, subheadline, footnote
 * - Interaction: button / buttonSm / buttonLg
 * - Domain: wageCallout (hourly/total wage emphasis)
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
  // ── Primary scale ──────────────────────────────────────────────
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

  /**
   * Large wage / rate callout (e.g. "₹450/hr" on shift detail).
   * Heavier than h2; use sparingly for money emphasis only.
   */
  wageCallout: {
    fontSize: 26,
    lineHeight: 32,
    fontWeight: '800',
    letterSpacing: -0.5,
  },

  // ── Button text ────────────────────────────────────────────────
  /** Default (md) button label — matches bodyBold size, semibold weight */
  button: {
    fontSize: fontSizes.md,
    lineHeight: lineHeights.md,
    fontWeight: '600',
    letterSpacing: -0.1,
  },
  /** Small button label — caption size */
  buttonSm: {
    fontSize: fontSizes.sm,
    lineHeight: lineHeights.sm,
    fontWeight: '600',
    letterSpacing: -0.1,
  },
  /** Large button label — subtitle size */
  buttonLg: {
    fontSize: fontSizes.lg,
    lineHeight: lineHeights.lg,
    fontWeight: '600',
    letterSpacing: -0.1,
  },

  // ── Apple-like aliases (map onto the primary scale) ────────────
  /** ≈ display — ScreenHeader largeTitle mode */
  largeTitle: {
    fontSize: fontSizes.display,
    lineHeight: lineHeights.display,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  /** ≈ h1 */
  title1: {
    fontSize: fontSizes.xxxl,
    lineHeight: lineHeights.xxxl,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  /** ≈ h2 — MetricCard value, Dialog title */
  title2: {
    fontSize: fontSizes.xxl,
    lineHeight: lineHeights.xxl,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  /** ≈ h3 */
  title3: {
    fontSize: fontSizes.xl,
    lineHeight: lineHeights.xl,
    fontWeight: '600',
  },
  /** ≈ subtitle */
  headline: {
    fontSize: fontSizes.lg,
    lineHeight: lineHeights.lg,
    fontWeight: '600',
  },
  /** ≈ caption — ScreenHeader subtitle under large title */
  subheadline: {
    fontSize: fontSizes.sm,
    lineHeight: lineHeights.sm,
    fontWeight: '500',
  },
  /** ≈ caption (lighter secondary copy) */
  footnote: {
    fontSize: fontSizes.sm,
    lineHeight: lineHeights.sm,
    fontWeight: '400',
  },

  // ── Stitch DESIGN.md Typographic Tokens ────────────────────────
  displayLg: {
    fontSize: 36,
    lineHeight: 44,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  displayLgMobile: {
    fontSize: 28,
    lineHeight: 36,
    fontWeight: '700',
    letterSpacing: -0.4,
  },
  headlineLg: {
    fontSize: 24,
    lineHeight: 32,
    fontWeight: '600',
    letterSpacing: -0.4,
  },
  headlineLgMobile: {
    fontSize: 20,
    lineHeight: 28,
    fontWeight: '600',
    letterSpacing: -0.3,
  },
  headlineSm: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  bodyLg: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '400',
    letterSpacing: -0.1,
  },
  bodyMd: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '400',
    letterSpacing: 0,
  },
  bodySm: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '400',
    letterSpacing: 0.1,
  },
  labelLg: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  labelMd: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  labelXs: {
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  numericData: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '500',
    letterSpacing: -0.2,
    fontVariant: ['tabular-nums'],
  },
};
