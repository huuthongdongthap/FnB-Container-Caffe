import { forwardRef, type InputHTMLAttributes } from 'react';
import { MD3TextField } from '@/components/md3/md3-text-field';

/**
 * InputAdapter — backward-compatible wrapper around MD3TextField.
 * Preserves legacy Input API: label, error, helperText, and all native input props.
 */
export interface InputAdapterProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Input = forwardRef<HTMLInputElement, InputAdapterProps>(
  function Input({ label = '', error, helperText, className, id, ...rest }, ref) {
    return (
      <MD3TextField
        ref={ref}
        id={id}
        label={label}
        error={error}
        supportingText={helperText}
        className={className}
        {...rest}
      />
    );
  },
);

Input.displayName = 'Input';