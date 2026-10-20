import React from 'react';
import { Input, InputProps } from './Input';

export interface DateInputProps extends Omit<InputProps, 'keyboardType' | 'autoCapitalize'> {
  /** Expected format hint shown as helper when no error. */
  formatHint?: string;
}

/**
 * Date text field (YYYY-MM-DD).
 * Uses text entry to avoid new native date-picker dependencies;
 * apps may wrap with a platform picker later and still use this for fallbacks.
 */
export const DateInput: React.FC<DateInputProps> = ({
  label = 'Date',
  placeholder = 'YYYY-MM-DD',
  formatHint = 'Use YYYY-MM-DD',
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
      maxLength={10}
      error={error}
      helperText={error ? undefined : helperText ?? formatHint}
      {...rest}
    />
  );
};
