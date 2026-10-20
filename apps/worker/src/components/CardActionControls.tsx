import { View, Text, Pressable, StyleSheet } from 'react-native';
import { RotateCcw, X, Info, Check } from 'lucide-react-native';
import { useOpsklTheme } from '@opskil/design-system';

export interface CardActionControlsProps {
  canUndo: boolean;
  disabled?: boolean;
  onPass: () => void;
  onApply: () => void;
  onUndo: () => void;
  onDetails: () => void;
}

export function CardActionControls({
  canUndo,
  disabled = false,
  onPass,
  onApply,
  onUndo,
  onDetails,
}: CardActionControlsProps) {
  const { colors, radii, touchTarget, shadows } = useOpsklTheme();

  return (
    <View style={styles.controlsContainer}>
      {/* Undo Button */}
      <Pressable
        onPress={onUndo}
        disabled={!canUndo || disabled}
        style={({ pressed }) => [
          styles.actionButton,
          styles.smallButton,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
            opacity: !canUndo || disabled ? 0.35 : pressed ? 0.75 : 1,
            borderRadius: radii.full,
            minWidth: touchTarget.min,
            minHeight: touchTarget.min,
            ...shadows.sm,
          },
        ]}
        accessibilityRole="button"
        accessibilityLabel="Undo last skipped shift"
        accessibilityState={{ disabled: !canUndo || disabled }}
      >
        <RotateCcw size={18} color={colors.textSecondary} strokeWidth={2.2} />
      </Pressable>

      {/* Pass Button (Swipe Left equivalent) */}
      <Pressable
        onPress={onPass}
        disabled={disabled}
        style={({ pressed }) => [
          styles.actionButton,
          styles.mainButton,
          styles.passButton,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
            opacity: disabled ? 0.4 : pressed ? 0.75 : 1,
            borderRadius: radii.full,
            minHeight: touchTarget.comfortable,
            ...shadows.sm,
          },
        ]}
        accessibilityRole="button"
        accessibilityLabel="Pass on this shift (Skip left)"
      >
        <X size={18} color={colors.textSecondary} strokeWidth={2.4} />
        <Text style={[styles.passLabelText, { color: colors.textSecondary }]}>Pass</Text>
      </Pressable>

      {/* Details Button */}
      <Pressable
        onPress={onDetails}
        disabled={disabled}
        style={({ pressed }) => [
          styles.actionButton,
          styles.smallButton,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
            opacity: disabled ? 0.4 : pressed ? 0.75 : 1,
            borderRadius: radii.full,
            minWidth: touchTarget.min,
            minHeight: touchTarget.min,
            ...shadows.sm,
          },
        ]}
        accessibilityRole="button"
        accessibilityLabel="View full shift details"
      >
        <Info size={18} color={colors.textSecondary} strokeWidth={2.2} />
      </Pressable>

      {/* Apply Button (Swipe Right equivalent) */}
      <Pressable
        onPress={onApply}
        disabled={disabled}
        style={({ pressed }) => [
          styles.actionButton,
          styles.mainButton,
          styles.applyButton,
          {
            backgroundColor: colors.primary,
            borderColor: colors.primary,
            opacity: disabled ? 0.4 : pressed ? 0.75 : 1,
            borderRadius: radii.full,
          },
        ]}
        accessibilityRole="button"
        accessibilityLabel="Apply for this shift (Express interest)"
      >
        <Check size={18} color={colors.textInverse} strokeWidth={2.6} />
        <Text style={[styles.applyLabelText, { color: colors.textInverse }]}>Apply</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  controlsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
  },
  actionButton: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  smallButton: {
    width: 44,
    height: 44,
  },
  mainButton: {
    height: 52,
    paddingHorizontal: 20,
    flexDirection: 'row',
    gap: 8,
  },
  passButton: {},
  passLabelText: {
    fontSize: 15,
    fontWeight: '800',
  },
  applyButton: {},
  applyLabelText: {
    fontSize: 15,
    fontWeight: '800',
  },
});
