import { useState, useId, forwardRef } from 'react';
import type { InputHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';

/* ─── Types ───────────────────────────────────────────────── */
export interface MD3TextFieldProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label: string;
  variant?: 'filled' | 'outlined';
  error?: string;
  supportingText?: string;
  maxLength?: number;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
  className?: string;
}

/* ─── Component ───────────────────────────────────────────── */
export const MD3TextField = forwardRef<HTMLInputElement, MD3TextFieldProps>(
  function MD3TextField(
    {
      label,
      variant = 'filled',
      error,
      supportingText,
      maxLength,
      leadingIcon,
      trailingIcon,
      className,
      onFocus,
      onBlur,
      value,
      defaultValue,
      disabled,
      id: externalId,
      ...rest
    },
    ref,
  ) {
    const autoId = useId();
    const id = externalId ?? autoId;
    const [focused, setFocused] = useState(false);
    const [hasValue, setHasValue] = useState(
      Boolean(value ?? defaultValue),
    );

    const floated = focused || hasValue;
    const isFilled = variant === 'filled';
    const isOutlined = variant === 'outlined';
    const charCount = typeof value === 'string' ? value.length : 0;

    return (
      <div className={cn('flex flex-col gap-1', className)}>
        {/* Field container */}
        <div
          className={cn(
            'relative flex items-center',
            'min-h-14 px-3',
            isFilled && [
              'bg-md-surface-container-highest',
              'rounded-t-md-sm border-b-2',
              error
                ? 'border-b-md-error'
                : focused
                  ? 'border-b-md-primary'
                  : 'border-b-md-on-surface-variant',
            ],
            isOutlined && [
              'rounded-md-sm border-1',
              error
                ? 'border-md-error'
                : focused
                  ? 'border-2 border-md-primary'
                  : 'border-md-outline',
            ],
            disabled && 'opacity-50',
          )}
        >
          {/* Leading icon */}
          {leadingIcon && (
            <span
              className={cn(
                'mr-3 flex items-center justify-center [&_svg]:w-5 [&_svg]:h-5',
                focused ? 'text-md-primary' : 'text-md-on-surface-variant',
              )}
              aria-hidden="true"
            >
              {leadingIcon}
            </span>
          )}

          {/* Floating label */}
          <label
            htmlFor={id}
            className={cn(
              'absolute pointer-events-none transition-all duration-200 origin-left',
              leadingIcon ? 'left-12' : 'left-3',
              floated
                ? [
                    'top-1 text-xs',
                    error
                      ? 'text-md-error'
                      : focused
                        ? 'text-md-primary'
                        : 'text-md-on-surface-variant',
                  ]
                : [
                    'top-1/2 -translate-y-1/2 text-base',
                    'text-md-on-surface-variant',
                  ],
            )}
          >
            {label}
          </label>

          {/* Input */}
          <input
            ref={ref}
            id={id}
            value={value}
            defaultValue={defaultValue}
            disabled={disabled}
            maxLength={maxLength}
            aria-invalid={Boolean(error) || undefined}
            aria-describedby={
              error
                ? `${id}-error`
                : supportingText
                  ? `${id}-helper`
                  : undefined
            }
            onFocus={(e) => {
              setFocused(true);
              onFocus?.(e);
            }}
            onBlur={(e) => {
              setFocused(false);
              setHasValue(Boolean(e.target.value));
              onBlur?.(e);
            }}
            onChange={(e) => {
              setHasValue(Boolean(e.target.value));
              rest.onChange?.(e);
            }}
            className={cn(
              'w-full bg-transparent outline-none',
              'text-md-on-surface placeholder-transparent',
              floated ? 'pt-4 pb-1' : 'py-3.5',
              leadingIcon && 'ml-0',
            )}
            {...rest}
          />

          {/* Trailing icon */}
          {trailingIcon && (
            <span
              className={cn(
                'ml-2 flex items-center justify-center [&_svg]:w-5 [&_svg]:h-5',
                'text-md-on-surface-variant',
              )}
              aria-hidden="true"
            >
              {trailingIcon}
            </span>
          )}
        </div>

        {/* Helper / error row */}
        {(error || supportingText || maxLength) && (
          <div className="flex items-center justify-between px-3">
            <span
              id={error ? `${id}-error` : `${id}-helper`}
              className={cn(
                'text-xs',
                error ? 'text-md-error' : 'text-md-on-surface-variant',
              )}
            >
              {error || supportingText}
            </span>

            {maxLength !== undefined && (
              <span className="text-xs text-md-on-surface-variant tabular-nums">
                {charCount}/{maxLength}
              </span>
            )}
          </div>
        )}
      </div>
    );
  },
);
