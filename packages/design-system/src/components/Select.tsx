import { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  Modal,
  FlatList,
  StyleProp,
  ViewStyle,
} from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { useOpsklTheme } from '../context/ThemeContext';

export interface SelectOption<T extends string = string> {
  value: T;
  label: string;
  disabled?: boolean;
}

export interface SelectProps<T extends string = string> {
  label?: string;
  placeholder?: string;
  options: SelectOption<T>[];
  value?: T | null;
  onChange: (value: T) => void;
  error?: string;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/** Single-select dropdown via modal list (no decorative control without behavior). */
export function Select<T extends string = string>({
  label,
  placeholder = 'Select…',
  options,
  value,
  onChange,
  error,
  disabled = false,
  style,
  testID,
}: SelectProps<T>) {
  const { colors, spacing, radii, typography, touchTarget, componentSizes } = useOpsklTheme();
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);

  return (
    <View style={[{ width: '100%', marginBottom: spacing.md }, style]} testID={testID}>
      {label ? (
        <Text
          style={{
            fontSize: typography.caption.fontSize,
            fontWeight: '600',
            color: colors.textSecondary,
            marginBottom: spacing.xs,
          }}
        >
          {label}
        </Text>
      ) : null}

      <Pressable
        disabled={disabled}
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={label || 'Select option'}
        accessibilityState={{ disabled, expanded: open }}
        style={({ pressed }) => ({
          minHeight: componentSizes.inputHeight,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: spacing.md,
          borderRadius: radii.md,
          borderWidth: error ? 1.5 : 1,
          borderColor: error ? colors.danger : pressed ? colors.borderFocus : colors.border,
          backgroundColor: disabled ? colors.surfaceMuted : pressed ? colors.surfaceSecondary : colors.surface,
          opacity: disabled ? 0.6 : 1,
        })}
      >
        <Text
          style={{
            flex: 1,
            fontSize: typography.body.fontSize,
            color: selected ? colors.textPrimary : colors.textMuted,
          }}
          numberOfLines={1}
        >
          {selected?.label ?? placeholder}
        </Text>
        <ChevronRight size={18} color={colors.textSecondary} />
      </Pressable>

      {error ? (
        <Text style={{ marginTop: spacing.xs, fontSize: typography.caption.fontSize, color: colors.danger }}>
          {error}
        </Text>
      ) : null}

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' }}
          onPress={() => setOpen(false)}
          accessibilityLabel="Dismiss"
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={{
              backgroundColor: colors.surface,
              borderTopLeftRadius: radii.lg,
              borderTopRightRadius: radii.lg,
              maxHeight: '60%',
              paddingBottom: spacing.xxl,
            }}
          >
            <View
              style={{
                paddingHorizontal: spacing.lg,
                paddingVertical: spacing.md,
                borderBottomWidth: 1,
                borderBottomColor: colors.border,
              }}
            >
              <Text style={[typography.h3, { color: colors.textPrimary }]}>{label || 'Select'}</Text>
            </View>
            <FlatList
              data={options}
              keyExtractor={(item) => item.value}
              renderItem={({ item }) => {
                const isSelected = item.value === value;
                return (
                  <Pressable
                    disabled={item.disabled}
                    onPress={() => {
                      onChange(item.value);
                      setOpen(false);
                    }}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected, disabled: !!item.disabled }}
                    style={({ pressed }) => ({
                      minHeight: touchTarget.min,
                      paddingHorizontal: spacing.lg,
                      paddingVertical: spacing.md,
                      backgroundColor: isSelected
                        ? colors.surfaceSecondary
                        : pressed
                        ? colors.surfaceMuted
                        : 'transparent',
                      opacity: item.disabled ? 0.4 : 1,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    })}
                  >
                    <Text
                      style={{
                        fontSize: typography.body.fontSize,
                        fontWeight: isSelected ? '600' : '400',
                        color: colors.textPrimary,
                      }}
                    >
                      {item.label}
                    </Text>
                    {isSelected ? (
                      <Text style={{ color: colors.textPrimary, fontWeight: '700' }}>✓</Text>
                    ) : null}
                  </Pressable>
                );
              }}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
