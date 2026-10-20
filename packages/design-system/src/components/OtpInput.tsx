import React, { useRef, useState } from 'react';
import {
  View,
  TextInput,
  Text,
  StyleProp,
  ViewStyle,
  NativeSyntheticEvent,
  TextInputKeyPressEventData,
} from 'react-native';
import { useOpsklTheme } from '../context/ThemeContext';

export interface OtpInputProps {
  length?: number;
  value: string;
  onChange: (otp: string) => void;
  error?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  containerStyle?: StyleProp<ViewStyle>;
  testID?: string;
}

export const OtpInput: React.FC<OtpInputProps> = ({
  length = 6,
  value,
  onChange,
  error,
  disabled = false,
  autoFocus = false,
  containerStyle,
  testID = 'otp-input',
}) => {
  const { colors, radii, spacing, typography } = useOpsklTheme();
  const inputRefs = useRef<Array<TextInput | null>>([]);
  const [focusedIndex, setFocusedIndex] = useState<number | null>(autoFocus ? 0 : null);

  const digits = Array.from({ length }, (_, i) => value[i] || '');

  const handleChangeText = (text: string, index: number) => {
    // Handle paste of multiple characters
    const cleaned = text.replace(/[^0-9]/g, '');
    if (cleaned.length > 1) {
      const merged = (value.slice(0, index) + cleaned).slice(0, length);
      onChange(merged);
      const nextIndex = Math.min(merged.length, length - 1);
      inputRefs.current[nextIndex]?.focus();
      return;
    }

    const newDigits = [...digits];
    newDigits[index] = cleaned;
    const newOtp = newDigits.join('').slice(0, length);
    onChange(newOtp);

    if (cleaned && index < length - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (
    e: NativeSyntheticEvent<TextInputKeyPressEventData>,
    index: number
  ) => {
    if (e.nativeEvent.key === 'Backspace') {
      if (!digits[index] && index > 0) {
        const newDigits = [...digits];
        newDigits[index - 1] = '';
        onChange(newDigits.join(''));
        inputRefs.current[index - 1]?.focus();
      }
    }
  };

  return (
    <View style={[{ width: '100%', alignItems: 'center' }, containerStyle]} testID={testID}>
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'center',
          gap: spacing.sm,
          width: '100%',
        }}
      >
        {Array.from({ length }).map((_, index) => {
          const isFocused = focusedIndex === index;
          const hasVal = Boolean(digits[index]);
          const borderColor = error
            ? colors.danger
            : isFocused
            ? colors.borderFocus
            : hasVal
            ? colors.textPrimary
            : colors.border;

          return (
            <TextInput
              key={index}
              ref={(ref) => {
                inputRefs.current[index] = ref;
              }}
              value={digits[index]}
              onChangeText={(text) => handleChangeText(text, index)}
              onKeyPress={(e) => handleKeyPress(e, index)}
              onFocus={() => setFocusedIndex(index)}
              onBlur={() => setFocusedIndex(null)}
              keyboardType="number-pad"
              maxLength={index === 0 ? length : 1}
              selectTextOnFocus
              editable={!disabled}
              testID={`${testID}-digit-${index}`}
              style={{
                width: 46,
                height: 54,
                borderRadius: radii.md,
                borderWidth: isFocused ? 2 : 1,
                borderColor,
                backgroundColor: disabled ? colors.surfaceMuted : colors.surface,
                color: colors.textPrimary,
                fontSize: 22,
                fontWeight: '700',
                textAlign: 'center',
                shadowColor: colors.cardShadow,
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.05,
                shadowRadius: 2,
              }}
              accessibilityLabel={`OTP digit ${index + 1} of ${length}`}
              accessibilityState={{ disabled }}
            />
          );
        })}
      </View>

      {error ? (
        <Text
          style={{
            fontSize: typography.caption.fontSize,
            color: colors.danger,
            marginTop: spacing.sm,
            fontWeight: '500',
            textAlign: 'center',
          }}
          accessibilityRole="alert"
        >
          {error}
        </Text>
      ) : null}
    </View>
  );
};
