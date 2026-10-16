/**
 * OPSKL DESIGN SYSTEM — ENTERPRISE SAAS & APPLE-QUALITY COLOR TOKENS
 * Unified across Worker App, Organizer App, and Admin Web Console.
 *
 * Core Palette:
 * - Brand Primary: #2563EB (Cool Royal Blue)
 * - Brand Hover/Pressed: #1D4ED8
 * - Brand Subtle Surface: #EFF6FF
 * - Page Background: #FFFFFF
 * - Secondary Surface: #F8FAFC
 * - Tertiary Surface: #F1F5F9
 * - Border: #E2E8F0
 * - Strong Border: #CBD5E1
 * - Primary Text: #0F172A (Deep Slate)
 * - Body Text: #334155 (Slate 700)
 * - Secondary Text: #64748B (Slate 500)
 * - Muted Text: #94A3B8 (Slate 400)
 *
 * Semantic Statuses:
 * - Approved / Success: #DCFCE7 / #15803D
 * - Pending / Warning: #FEF3C7 / #B45309
 * - Rejected / Danger: #FEE2E2 / #B91C1C
 * - Info / Navigation: #DBEAFE / #1D4ED8
 * - Neutral / Inactive: #F1F5F9 / #475569
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
  primary: '#2563EB',
  primaryHover: '#1D4ED8',
  primaryLight: '#EFF6FF',
  accent: '#2563EB',
  background: '#FFFFFF',
  surface: '#FFFFFF',
  surfaceElevated: '#FFFFFF',
  surfaceMuted: '#F8FAFC',
  surfaceSecondary: '#F8FAFC',
  surfaceTertiary: '#F1F5F9',
  textPrimary: '#0F172A',
  textBody: '#334155',
  textSecondary: '#64748B',
  textMuted: '#94A3B8',
  textInverse: '#FFFFFF',
  border: '#E2E8F0',
  borderStrong: '#CBD5E1',
  borderMuted: '#F1F5F9',
  borderFocus: '#2563EB',
  // Semantic Statuses (WCAG AA Compliant)
  success: '#15803D',
  successLight: '#DCFCE7',
  warning: '#B45309',
  warningLight: '#FEF3C7',
  danger: '#B91C1C',
  dangerLight: '#FEE2E2',
  info: '#1D4ED8',
  infoLight: '#DBEAFE',
  neutralStatus: '#475569',
  neutralStatusLight: '#F1F5F9',
  cardShadow: 'rgba(15, 23, 42, 0.04)',
};

export const darkColors: OpsklThemeColors = {
  primary: '#3B82F6',
  primaryHover: '#60A5FA',
  primaryLight: '#1E293B',
  accent: '#3B82F6',
  background: '#0F172A',
  surface: '#1E293B',
  surfaceElevated: '#334155',
  surfaceMuted: '#1E293B',
  surfaceSecondary: '#1E293B',
  surfaceTertiary: '#0F172A',
  textPrimary: '#F8FAFC',
  textBody: '#E2E8F0',
  textSecondary: '#94A3B8',
  textMuted: '#64748B',
  textInverse: '#0F172A',
  border: '#334155',
  borderStrong: '#475569',
  borderMuted: '#1E293B',
  borderFocus: '#3B82F6',
  // Dark Semantic Statuses
  success: '#22C55E',
  successLight: '#052E16',
  warning: '#F59E0B',
  warningLight: '#451A03',
  danger: '#EF4444',
  dangerLight: '#450A0A',
  info: '#60A5FA',
  infoLight: '#172554',
  neutralStatus: '#94A3B8',
  neutralStatusLight: '#1E293B',
  cardShadow: 'rgba(0, 0, 0, 0.4)',
};
