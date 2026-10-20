import React from 'react';
import { View, Text, Pressable, StyleProp, ViewStyle } from 'react-native';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useOpsklTheme } from '../context/ThemeContext';

export interface PaginationProps {
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
  /** Optional “Showing X–Y of Z” when total items known. */
  summaryLabel?: string;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/** Prev / next pagination with explicit page state (1-indexed). */
export const Pagination: React.FC<PaginationProps> = ({
  page,
  pageCount,
  onPageChange,
  summaryLabel,
  disabled,
  style,
  testID,
}) => {
  const { colors, spacing, radii, typography, touchTarget, iconSizes } = useOpsklTheme();
  const canPrev = page > 1 && !disabled;
  const canNext = page < pageCount && !disabled;

  return (
    <View
      testID={testID}
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: spacing.md,
          paddingVertical: spacing.sm,
        },
        style,
      ]}
    >
      <Pressable
        disabled={!canPrev}
        onPress={() => onPageChange(page - 1)}
        accessibilityRole="button"
        accessibilityLabel="Previous page"
        style={({ pressed }) => ({
          minWidth: touchTarget.min,
          minHeight: touchTarget.min,
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: radii.sm,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: pressed && canPrev ? colors.surfaceSecondary : colors.surface,
          opacity: canPrev ? 1 : 0.35,
        })}
      >
        <ChevronLeft size={iconSizes.md} color={colors.textPrimary} />
      </Pressable>

      <View style={{ flex: 1, alignItems: 'center' }}>
        <Text style={{ fontSize: typography.bodyBold.fontSize, color: colors.textPrimary, fontWeight: '600' }}>
          Page {page} of {Math.max(pageCount, 1)}
        </Text>
        {summaryLabel ? (
          <Text style={{ fontSize: typography.caption.fontSize, color: colors.textMuted, marginTop: 2 }}>
            {summaryLabel}
          </Text>
        ) : null}
      </View>

      <Pressable
        disabled={!canNext}
        onPress={() => onPageChange(page + 1)}
        accessibilityRole="button"
        accessibilityLabel="Next page"
        style={({ pressed }) => ({
          minWidth: touchTarget.min,
          minHeight: touchTarget.min,
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: radii.sm,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: pressed && canNext ? colors.surfaceSecondary : colors.surface,
          opacity: canNext ? 1 : 0.35,
        })}
      >
        <ChevronRight size={iconSizes.md} color={colors.textPrimary} />
      </Pressable>
    </View>
  );
};
