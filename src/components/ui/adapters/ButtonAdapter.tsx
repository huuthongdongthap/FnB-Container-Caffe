import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { MD3Button, type MD3ButtonProps } from '@/components/md3/md3-button';

/**
 * ButtonAdapter — backward-compatible wrapper around MD3Button.
 * Preserves legacy Button API: variant (primary|secondary|ghost|destructive),
 * size (sm|md|lg), loading state, and all native button props.
 */
export interface ButtonAdapterProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'destructive';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
}

const variantMap: Record<NonNullable<ButtonAdapterProps['variant']>, MD3ButtonProps['variant']> = {
  primary: 'filled',
  secondary: 'outlined',
  ghost: 'text',
  destructive: 'filled',
};

const sizeMap: Record<NonNullable<ButtonAdapterProps['size']>, MD3ButtonProps['size']> = {
  sm: 'compact',
  md: 'default',
  lg: 'default',
};

export const Button = forwardRef<HTMLButtonElement, ButtonAdapterProps>(
  function Button(
    {
      className,
      variant = 'primary',
      size = 'md',
      loading,
      disabled,
      children,
      type = 'button',
      ...rest
    },
    ref,
  ) {
    const isDisabled = disabled || loading;
    const md3Variant = variantMap[variant];
    const md3Size = sizeMap[size];

    return (
      <MD3Button
        ref={ref}
        variant={md3Variant}
        size={md3Size}
        disabled={isDisabled}
        className={className}
        type={type}
        {...rest}
      >
        {loading && (
          <span
            className="inline-flex shrink-0 [&>svg]:h-5 [&>svg]:w-5 animate-spin"
            aria-hidden="true"
          >
            <svg viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </span>
        )}
        {children}
      </MD3Button>
    );
  },
);

Button.displayName = 'Button';