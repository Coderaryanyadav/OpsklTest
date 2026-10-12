/**
 * OPSKL DESIGN SYSTEM COLOR PALETTE
 * Tailored for high-clarity on-the-go mobility in Indian ambient lighting conditions.
 * Brand signature: Deep Emerald (#0F766E) with Electric Teal accent.
 */

export const brandColors = {
  emerald950: '#022C22',
  emerald900: '#064E3B',
  emerald800: '#065F46',
  emerald700: '#047857',
  emerald600: '#059669',
  emerald500: '#10B981',
  emerald400: '#34D399',
  emerald300: '#6EE7B7',
  emerald200: '#A7F3D0',
  emerald100: '#D1FAE5',
  emerald50: '#ECFDF5',

  teal600: '#0D9488',
  teal500: '#14B8A6',
  teal400: '#2DD4BF',

  slate950: '#020617',
  slate900: '#0F172A',
  slate800: '#1E293B',
  slate700: '#334155',
  slate600: '#475569',
  slate500: '#64748B',
  slate400: '#94A3B8',
  slate300: '#CBD5E1',
  slate200: '#E2E8F0',
  slate100: '#F1F5F9',
  slate50: '#F8FAFC',

  white: '#FFFFFF',
  black: '#000000',

  amber500: '#F59E0B',
  amber600: '#D97706',
  amber50: '#FFFBEB',

  red500: '#EF4444',
  red600: '#DC2626',
  red50: '#FEF2F2',

  blue500: '#3B82F6',
  blue600: '#2563EB',
  blue50: '#EFF6FF',
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
  primary: '#0F766E',
  primaryHover: '#115E59',
  primaryLight: '#CCFBF1',
  accent: '#14B8A6',
  background: '#F8FAFC',
  surface: '#FFFFFF',
  surfaceElevated: '#FFFFFF',
  surfaceMuted: '#F1F5F9',
  textPrimary: '#0F172A',
  textSecondary: '#475569',
  textMuted: '#94A3B8',
  textInverse: '#FFFFFF',
  border: '#E2E8F0',
  borderMuted: '#F1F5F9',
  borderFocus: '#0F766E',
  success: '#059669',
  successLight: '#D1FAE5',
  warning: '#D97706',
  warningLight: '#FEF3C7',
  danger: '#DC2626',
  dangerLight: '#FEE2E2',
  info: '#2563EB',
  infoLight: '#DBEAFE',
  cardShadow: 'rgba(15, 23, 42, 0.08)',
};

export const darkColors: OpsklThemeColors = {
  primary: '#14B8A6',
  primaryHover: '#2DD4BF',
  primaryLight: '#134E4A',
  accent: '#2DD4BF',
  background: '#090D14',
  surface: '#111726',
  surfaceElevated: '#171F33',
  surfaceMuted: '#1E293B',
  textPrimary: '#F8FAFC',
  textSecondary: '#94A3B8',
  textMuted: '#64748B',
  textInverse: '#0F172A',
  border: '#1E293B',
  borderMuted: '#151D2C',
  borderFocus: '#14B8A6',
  success: '#10B981',
  successLight: '#064E3B',
  warning: '#F59E0B',
  warningLight: '#78350F',
  danger: '#EF4444',
  dangerLight: '#7F1D1D',
  info: '#3B82F6',
  infoLight: '#1E3A8A',
  cardShadow: 'rgba(0, 0, 0, 0.4)',
};
