import React from 'react';
import { Input, InputProps } from './Input';

export interface TimeInputProps extends Omit<InputProps, 'keyboardType' | 'autoCapitalize'> {
  formatHint?: string;
}

/** Time text field (HH:MM, 24-hour). */
export const TimeInput: React.FC<TimeInputProps> = ({
  label = 'Time',
  placeholder = 'HH:MM',
  formatHint = '24-hour HH:MM',
  helperText,
  error,
  ...rest
}) => {
  return (
    <Input
      label={label}
      placeholder={placeholder}
      keyboardType="numbers-and-punctuation"
      autoCapitalize="none"
      autoCorrect={false}
      maxLength={5}
      error={error}
      helperText={error ? undefined : helperText ?? formatHint}
      {...rest}
    />
  );
};
