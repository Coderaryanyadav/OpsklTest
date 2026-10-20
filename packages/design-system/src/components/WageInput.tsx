import React from 'react';
import { Input, InputProps } from './Input';

export interface WageInputProps extends Omit<InputProps, 'prefix' | 'keyboardType'> {
  currencySymbol?: string;
}

/** Numeric wage field with currency prefix (default ₹). */
export const WageInput: React.FC<WageInputProps> = ({
  currencySymbol = '₹',
  label = 'Hourly wage',
  ...rest
}) => {
  return (
    <Input
      label={label}
      prefix={currencySymbol}
      keyboardType="decimal-pad"
      placeholder="0"
      {...rest}
    />
  );
};
