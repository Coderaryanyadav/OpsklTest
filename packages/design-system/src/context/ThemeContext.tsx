import React, { createContext, useContext, useState, useMemo } from 'react';
import { useColorScheme } from 'react-native';
import { lightColors, darkColors, OpsklThemeColors } from '../tokens/colors';
import { spacing, radii, shadows, borders, elevationLayers } from '../tokens/spacing';
import { typography } from '../tokens/typography';
import { motion } from '../tokens/motion';
import {
  fontWeights,
  iconSizes,
  touchTarget,
  componentSizes,
  navigation,
  safeArea,
  breakpoints,
} from '../tokens/layout';

export type ThemeMode = 'light' | 'dark' | 'system';

export interface ThemeContextValue {
  mode: ThemeMode;
  isDark: boolean;
  colors: OpsklThemeColors;
  spacing: typeof spacing;
  radii: typeof radii;
  shadows: typeof shadows;
  borders: typeof borders;
  elevationLayers: typeof elevationLayers;
  typography: typeof typography;
  motion: typeof motion;
  fontWeights: typeof fontWeights;
  iconSizes: typeof iconSizes;
  touchTarget: typeof touchTarget;
  componentSizes: typeof componentSizes;
  navigation: typeof navigation;
  safeArea: typeof safeArea;
  breakpoints: typeof breakpoints;
  setMode: (mode: ThemeMode) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export interface ThemeProviderProps {
  children: React.ReactNode;
  initialMode?: ThemeMode;
}

export const OpsklThemeProvider: React.FC<ThemeProviderProps> = ({
  children,
  initialMode = 'system',
}) => {
  const systemColorScheme = useColorScheme();
  const [mode, setMode] = useState<ThemeMode>(initialMode);

  const isDark = useMemo(() => {
    if (mode === 'system') {
      return systemColorScheme === 'dark';
    }
    return mode === 'dark';
  }, [mode, systemColorScheme]);

  const colors = useMemo(() => (isDark ? darkColors : lightColors), [isDark]);

  const toggleTheme = () => {
    setMode((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  const value = useMemo(
    () => ({
      mode,
      isDark,
      colors,
      spacing,
      radii,
      shadows,
      borders,
      elevationLayers,
      typography,
      motion,
      fontWeights,
      iconSizes,
      touchTarget,
      componentSizes,
      navigation,
      safeArea,
      breakpoints,
      setMode,
      toggleTheme,
    }),
    [mode, isDark, colors]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export function useOpsklTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    // Return safe default if rendered outside provider
    return {
      mode: 'light',
      isDark: false,
      colors: lightColors,
      spacing,
      radii,
      shadows,
      borders,
      elevationLayers,
      typography,
      motion,
      fontWeights,
      iconSizes,
      touchTarget,
      componentSizes,
      navigation,
      safeArea,
      breakpoints,
      setMode: () => {},
      toggleTheme: () => {},
    };
  }
  return context;
}
