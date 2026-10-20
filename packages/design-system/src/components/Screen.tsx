import React from 'react';
import { View, StyleProp, ViewStyle, ScrollView, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useOpsklTheme } from '../context/ThemeContext';

export interface ScreenProps {
  children: React.ReactNode;
  /** Apply safe-area insets (default all edges). */
  edges?: Array<'top' | 'right' | 'bottom' | 'left'>;
  scroll?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  testID?: string;
}

/**
 * Screen container — safe areas + optional scroll/refresh.
 * Prefer this over ad-hoc View wrappers for consistent padding hierarchy.
 */
export const Screen: React.FC<ScreenProps> = ({
  children,
  edges = ['top', 'left', 'right'],
  scroll = false,
  refreshing = false,
  onRefresh,
  style,
  contentStyle,
  testID,
}) => {
  const { colors, spacing } = useOpsklTheme();

  const body = scroll ? (
    <ScrollView
      contentContainerStyle={[{ flexGrow: 1, paddingBottom: spacing.xxl }, contentStyle]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      refreshControl={
        onRefresh ? (
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.textPrimary} />
        ) : undefined
      }
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[{ flex: 1 }, contentStyle]}>{children}</View>
  );

  return (
    <SafeAreaView
      edges={edges}
      style={[{ flex: 1, backgroundColor: colors.background }, style]}
      testID={testID}
    >
      {body}
    </SafeAreaView>
  );
};
