import React, { useState } from 'react';
import {
  View,
  TextInput,
  Pressable,
  TextInputProps,
  StyleProp,
  ViewStyle,
} from 'react-native';
import { useOpsklTheme } from '../context/ThemeContext';
import { OpsklIcon } from './Icon';

export interface SearchInputProps extends TextInputProps {
  onClear?: () => void;
  containerStyle?: StyleProp<ViewStyle>;
  testID?: string;
}

export const SearchInput: React.FC<SearchInputProps> = ({
  value,
  onChangeText,
  onClear,
  placeholder = 'Search shifts, roles or venues...',
  containerStyle,
  style,
  testID = 'search-input',
  onFocus,
  onBlur,
  editable = true,
  ...rest
}) => {
  const { colors, radii, spacing, typography } = useOpsklTheme();
  const [isFocused, setIsFocused] = useState(false);
  const isDisabled = editable === false;

  const handleClear = () => {
    onChangeText?.('');
    onClear?.();
  };

  return (
    <View
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: isDisabled ? colors.surfaceMuted : colors.surfaceSecondary,
          borderRadius: radii.full,
          paddingHorizontal: spacing.md,
          minHeight: 44,
          borderWidth: isFocused ? 1.5 : 1,
          borderColor: isFocused ? colors.borderFocus : colors.border,
          opacity: isDisabled ? 0.7 : 1,
        },
        containerStyle,
      ]}
      testID={testID}
    >
      <OpsklIcon
        name="search"
        size="sm"
        color={colors.textSecondary}
        style={{ marginRight: spacing.xs }}
      />

      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        editable={editable}
        style={[
          {
            flex: 1,
            color: colors.textPrimary,
            fontSize: typography.body.fontSize,
            paddingVertical: spacing.xs,
          },
          style,
        ]}
        testID={`${testID}-field`}
        returnKeyType="search"
        accessibilityRole="search"
        onFocus={(e) => {
          setIsFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setIsFocused(false);
          onBlur?.(e);
        }}
        {...rest}
      />

      {value && value.length > 0 ? (
        <Pressable
          onPress={handleClear}
          hitSlop={8}
          disabled={isDisabled}
          testID={`${testID}-clear`}
          accessibilityLabel="Clear search query"
          accessibilityRole="button"
          style={{
            minWidth: 44,
            minHeight: 44,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <OpsklIcon name="close" size="sm" color={colors.textSecondary} />
        </Pressable>
      ) : null}
    </View>
  );
};
