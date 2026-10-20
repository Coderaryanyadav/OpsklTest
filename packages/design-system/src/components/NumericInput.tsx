import React from 'react';
import { Input, InputProps } from './Input';

export interface NumericInputProps extends Omit<InputProps, 'keyboardType'> {
  integer?: boolean;
}

/** Integer or decimal numeric field. */
export const NumericInput: React.FC<NumericInputProps> = ({ integer = true, ...rest }) => {
  return (
    <Input
      keyboardType={integer ? 'number-pad' : 'decimal-pad'}
      {...rest}
    />
  );
};
