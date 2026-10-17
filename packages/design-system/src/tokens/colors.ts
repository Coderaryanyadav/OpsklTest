/**
 * OPSKL DESIGN SYSTEM — APPLE-INSPIRED MINIMALIST PALETTE
 * Unified across Worker App, Organizer App, and Admin Web Console.
 *
 * Core Palette:
 * - Black: #000000
 * - White: #FFFFFF
 * - Secondary background: #F5F5F5
 * - Subtle surface: #FAFAFA
 * - Primary text: #111111
 * - Secondary text: #737373
 * - Dividers: #E5E5E5
 * - Disabled: #D4D4D4
 *
 * Semantic Statuses (Restrained & Accessible WCAG AA):
 * - Approved / Success: #F0FDF4 / #15803D
 * - Pending / Warning: #FFFBEB / #B45309
 * - Rejected / Danger: #FEF2F2 / #DC2626
 * - Info / Neutral: #F5F5F5 / #111111
 */

export interface OpsklThemeColors {
  primary: string;
  primaryHover: string;
  primaryLight: string;
  accent: string;
  background: string;
  surface: string;
  surfaceElevated: string;
  surfaceMuted: string;
  surfaceSecondary: string;
  surfaceTertiary: string;
  textPrimary: string;
  textBody: string;
  textSecondary: string;
  textMuted: string;
  textInverse: string;
  border: string;
  borderStrong: string;
  borderMuted: string;
  borderFocus: string;
  disabled: string;
  // Semantic status colors
  success: string;
  successLight: string;
  warning: string;
  warningLight: string;
  danger: string;
  dangerLight: string;
  info: string;
  infoLight: string;
  neutralStatus: string;
  neutralStatusLight: string;
  cardShadow: string;
}

export const lightColors: OpsklThemeColors = {
  primary: '#000000',
  primaryHover: '#262626',
  primaryLight: '#F5F5F5',
  accent: '#111111',
  background: '#FFFFFF',
  surface: '#FFFFFF',
  surfaceElevated: '#FFFFFF',
  surfaceMuted: '#FAFAFA',
  surfaceSecondary: '#F5F5F5',
  surfaceTertiary: '#E5E5E5',
  textPrimary: '#111111',
  textBody: '#111111',
  textSecondary: '#737373',
  textMuted: '#737373',
  textInverse: '#FFFFFF',
  border: '#E5E5E5',
  borderStrong: '#D4D4D4',
  borderMuted: '#E5E5E5',
  borderFocus: '#000000',
  disabled: '#D4D4D4',
  // Restrained Semantic Statuses (WCAG AA Compliant)
  success: '#15803D',
  successLight: '#F0FDF4',
  warning: '#B45309',
  warningLight: '#FFFBEB',
  danger: '#DC2626',
  dangerLight: '#FEF2F2',
  info: '#111111',
  infoLight: '#F5F5F5',
  neutralStatus: '#737373',
  neutralStatusLight: '#F5F5F5',
  cardShadow: 'rgba(0, 0, 0, 0.03)',
};

export const darkColors: OpsklThemeColors = {
  primary: '#FFFFFF',
  primaryHover: '#E5E5E5',
  primaryLight: '#1F1F1F',
  accent: '#FFFFFF',
  background: '#000000',
  surface: '#111111',
  surfaceElevated: '#1A1A1A',
  surfaceMuted: '#171717',
  surfaceSecondary: '#1A1A1A',
  surfaceTertiary: '#262626',
  textPrimary: '#FFFFFF',
  textBody: '#F5F5F5',
  textSecondary: '#A3A3A3',
  textMuted: '#737373',
  textInverse: '#000000',
  border: '#262626',
  borderStrong: '#404040',
  borderMuted: '#1F1F1F',
  borderFocus: '#FFFFFF',
  disabled: '#404040',
  // Dark Semantic Statuses
  success: '#22C55E',
  successLight: '#052E16',
  warning: '#F59E0B',
  warningLight: '#451A03',
  danger: '#EF4444',
  dangerLight: '#450A0A',
  info: '#E5E5E5',
  infoLight: '#1F1F1F',
  neutralStatus: '#A3A3A3',
  neutralStatusLight: '#1F1F1F',
  cardShadow: 'rgba(0, 0, 0, 0.6)',
};
