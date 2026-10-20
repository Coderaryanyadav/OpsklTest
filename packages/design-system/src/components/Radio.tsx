import {
  Pressable,
  View,
  Text,
  StyleProp,
  ViewStyle,
} from 'react-native';
import { useOpsklTheme } from '../context/ThemeContext';

export interface RadioOption<T = string> {
  value: T;
  label: string;
  description?: string;
  disabled?: boolean;
}

export interface RadioGroupProps<T = string> {
  options: RadioOption<T>[];
  selectedValue: T;
  onSelect: (val: T) => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function RadioGroup<T = string>({
  options,
  selectedValue,
  onSelect,
  style,
  testID = 'opskl-radiogroup',
}: RadioGroupProps<T>) {
  const { colors, radii, spacing, typography } = useOpsklTheme();

  return (
    <View
      style={[{ width: '100%' }, style]}
      accessibilityRole="radiogroup"
      testID={testID}
    >
      {options.map((option, idx) => {
        const isSelected = selectedValue === option.value;
        const isDisabled = Boolean(option.disabled);

        return (
          <Pressable
            key={String(option.value)}
            onPress={() => !isDisabled && onSelect(option.value)}
            disabled={isDisabled}
            accessibilityRole="radio"
            accessibilityLabel={option.label}
            accessibilityHint={option.description}
            accessibilityState={{ selected: isSelected, disabled: isDisabled }}
            testID={`${testID}-option-${idx}`}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingVertical: spacing.sm,
              minHeight: 44,
              opacity: isDisabled ? 0.4 : 1,
            }}
          >
            <View
              style={{
                width: 20,
                height: 20,
                borderRadius: radii.full,
                borderWidth: isSelected ? 6 : 1.5,
                borderColor: isSelected ? colors.primary : colors.borderStrong,
                backgroundColor: colors.surface,
                marginRight: spacing.sm,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            />

            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontSize: typography.body.fontSize,
                  fontWeight: isSelected ? '600' : '400',
                  color: colors.textPrimary,
                }}
              >
                {option.label}
              </Text>
              {option.description ? (
                <Text
                  style={{
                    fontSize: typography.caption.fontSize,
                    color: colors.textSecondary,
                    marginTop: 2,
                  }}
                >
                  {option.description}
                </Text>
              ) : null}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}
