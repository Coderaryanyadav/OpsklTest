/**
 * OPSKL LAYOUT TOKENS
 * Component dimensions, navigation, icons, safe areas, breakpoints.
 */

export const fontWeights = {
  regular: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
  heavy: '800' as const,
};

export const iconSizes = {
  xs: 14,
  sm: 16,
  md: 20,
  lg: 24,
  xl: 28,
  xxl: 32,
} as const;

/** Minimum interactive target — Apple HIG ≈ 44pt */
export const touchTarget = {
  min: 44,
  comfortable: 48,
  large: 56,
} as const;

export const componentSizes = {
  inputHeight: 48,
  inputHeightSm: 44,
  buttonHeightSm: 44,
  buttonHeightMd: 48,
  buttonHeightLg: 56,
  chipHeight: 36,
  avatarSm: 32,
  avatarMd: 40,
  avatarLg: 56,
  otpCell: 48,
  statusDot: 8,
} as const;

export const navigation = {
  tabBarHeight: 68,
  tabBarIconSize: 22,
  tabBarLabelSize: 11,
  headerHeight: 44,
  headerLargeTitleOffset: 8,
  sidebarWidth: 260,
  contentMaxWidth: 1400,
} as const;

/**
 * Default inset padding when SafeArea edges are unavailable.
 * Prefer `useSafeAreaInsets()` from react-native-safe-area-context in screens.
 */
export const safeArea = {
  topFallback: 12,
  bottomFallback: 16,
  horizontal: 16,
} as const;

/** Logical widths for responsive layout decisions (web + large tablets). */
export const breakpoints = {
  phone: 0,
  phoneLarge: 430,
  tablet: 768,
  desktop: 1024,
  desktopWide: 1280,
} as const;

export type FontWeights = typeof fontWeights;
export type IconSizes = typeof iconSizes;
export type ComponentSizes = typeof componentSizes;
export type NavigationTokens = typeof navigation;
export type Breakpoints = typeof breakpoints;
