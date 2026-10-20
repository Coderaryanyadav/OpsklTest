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
  dangerHover: string;
  dangerLight: string;
  info: string;
  infoLight: string;
  neutralStatus: string;
  neutralStatusLight: string;
  cardShadow: string;
}

export const lightColors: OpsklThemeColors = {
  primary: '#0F1115',
  primaryHover: '#1F242D',
  primaryLight: '#F1F3F5',
  accent: '#0F52BA',
  background: '#F8F9FA',
  surface: '#FFFFFF',
  surfaceElevated: '#FFFFFF',
  surfaceMuted: '#F1F3F5',
  surfaceSecondary: '#EDEEEF',
  surfaceTertiary: '#E7E8E9',
  textPrimary: '#0F1115',
  textBody: '#191C1D',
  textSecondary: '#64748B',
  textMuted: '#737784',
  textInverse: '#FFFFFF',
  border: '#E2E4E8',
  borderStrong: '#CBD5E1',
  borderMuted: '#E2E4E8',
  borderFocus: '#0F52BA',
  disabled: '#CBD5E1',
  // Restrained Semantic Statuses (WCAG AA Compliant)
  success: '#047857',
  successLight: '#ECFDF5',
  warning: '#B45309',
  warningLight: '#FFFBEB',
  danger: '#B91C1C',
  dangerHover: '#991B1B',
  dangerLight: '#FEF2F2',
  info: '#1D4ED8',
  infoLight: '#EFF6FF',
  neutralStatus: '#475569',
  neutralStatusLight: '#F1F5F9',
  cardShadow: 'rgba(15, 17, 21, 0.04)',
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
  /** Lightened for WCAG AA on near-black surfaces (~#A3A3A3). */
  textMuted: '#A3A3A3',
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
  dangerHover: '#DC2626',
  dangerLight: '#450A0A',
  info: '#E5E5E5',
  infoLight: '#1F1F1F',
  neutralStatus: '#A3A3A3',
  neutralStatusLight: '#1F1F1F',
  cardShadow: 'rgba(0, 0, 0, 0.6)',
};
