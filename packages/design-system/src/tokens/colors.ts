/**
 * OPSKL DESIGN SYSTEM — STRICT MONOCHROME PALETTE
 * Apple-Level Polish · High Contrast · Strict Restraint
 *
 * Core Tokens:
 * - Primary Black: #000000
 * - Primary White: #FFFFFF
 * - Soft White: #F5F5F5
 * - Light Neutral: #E5E5E5
 * - Mid Gray: #737373
 * - Dark Neutral: #262626
 */

export const monochrome = {
  black: '#000000',
  white: '#FFFFFF',
  softWhite: '#F5F5F5',
  lightNeutral: '#E5E5E5',
  borderLight: '#E5E5E5',
  midGray: '#737373',
  darkNeutral: '#262626',
  surfaceDark: '#121212',
  cardDark: '#1A1A1A',
  borderDark: '#262626',
} as const;

export interface OpsklThemeColors {
  primary: string;
  primaryHover: string;
  primaryLight: string;
  accent: string;
  background: string;
  surface: string;
  surfaceElevated: string;
  surfaceMuted: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  textInverse: string;
  border: string;
  borderMuted: string;
  borderFocus: string;
  // Semantic indicators strictly reserved for functional status/safety/error handling
  success: string;
  successLight: string;
  warning: string;
  warningLight: string;
  danger: string;
  dangerLight: string;
  info: string;
  infoLight: string;
  cardShadow: string;
}

export const lightColors: OpsklThemeColors = {
  primary: '#000000',
  primaryHover: '#262626',
  primaryLight: '#F5F5F5',
  accent: '#000000',
  background: '#FFFFFF',
  surface: '#FFFFFF',
  surfaceElevated: '#FFFFFF',
  surfaceMuted: '#F5F5F5',
  textPrimary: '#000000',
  textSecondary: '#737373',
  textMuted: '#6B6B6B', // WCAG AA 4.9:1 against white
  textInverse: '#FFFFFF',
  border: '#E5E5E5',
  borderMuted: '#F5F5F5',
  borderFocus: '#000000',
  // Functional semantic status colors
  success: '#15803D', // WCAG AA 4.8:1 against white
  successLight: '#F0FDF4',
  warning: '#B45309', // WCAG AA 4.7:1 against white
  warningLight: '#FFFBEB',
  danger: '#DC2626',
  dangerLight: '#FEF2F2',
  info: '#262626',
  infoLight: '#F5F5F5',
  cardShadow: 'rgba(0, 0, 0, 0.04)',
};

export const darkColors: OpsklThemeColors = {
  primary: '#FFFFFF',
  primaryHover: '#E5E5E5',
  primaryLight: '#1A1A1A',
  accent: '#FFFFFF',
  background: '#000000',
  surface: '#121212',
  surfaceElevated: '#1A1A1A',
  surfaceMuted: '#1E1E1E',
  textPrimary: '#FFFFFF',
  textSecondary: '#A3A3A3',
  textMuted: '#8A8A8A', // WCAG AA 4.6:1 against dark surface #121212
  textInverse: '#000000',
  border: '#262626',
  borderMuted: '#1A1A1A',
  borderFocus: '#FFFFFF',
  // Functional semantic status colors
  success: '#22C55E',
  successLight: '#14532D',
  warning: '#F59E0B',
  warningLight: '#78350F',
  danger: '#EF4444',
  dangerLight: '#7F1D1D',
  info: '#E5E5E5',
  infoLight: '#262626',
  cardShadow: 'rgba(0, 0, 0, 0.6)',
};
