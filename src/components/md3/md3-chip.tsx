import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface MD3ChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'assist' | 'filter' | 'input' | 'suggestion';
  selected?: boolean;
  elevated?: boolean;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
}

const variantClasses: Record<NonNullable<MD3ChipProps['variant']>, string> = {
  assist: 'bg-md-surface-container-low text-md-on-surface border border-md-outline-variant',
  filter: 'bg-transparent text-md-on-surface-variant border border-md-outline-variant',
  input: 'bg-md-surface-container-low text-md-on-surface-variant border border-md-outline-variant',
  suggestion: 'bg-md-surface-container-low text-md-on-surface border border-md-outline-variant',
};

const selectedClasses: Record<NonNullable<MD3ChipProps['variant']>, string> = {
  assist: '',
  filter: 'bg-md-secondary-container text-md-on-secondary-container border-md-secondary-container',
  input: '',
  suggestion: '',
};

const elevatedClasses = 'shadow-[0px_1px_2px_rgba(0,0,0,0.3),0px_1px_3px_1px_rgba(0,0,0,0.15)]';

/**
 * Material Design 3 Chip component.
 * Height 32px, corner-small (8px). Supports assist, filter, input, suggestion variants.
 * Filter variant supports selected state with checkmark icon.
 */
export const MD3Chip = forwardRef<HTMLButtonElement, MD3ChipProps>(
  function MD3Chip(
    {
      variant = 'suggestion',
      selected = false,
      elevated = false,
      leadingIcon,
      trailingIcon,
      className,
      children,
      ...rest
    },
    ref,
  ) {
    return (
      <button
        ref={ref}
        role="option"
        aria-selected={selected || undefined}
        className={cn(
          'inline-flex items-center gap-2',
          'h-8 rounded-md-sm px-3',
          'text-xs font-medium leading-[1.33] tracking-[0.1px]',
          'select-none whitespace-nowrap',
          'transition-colors duration-200 ease-[cubic-bezier(0.2,0,0,1)]',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-md-primary',
          'hover:bg-md-on-surface/8 active:bg-md-on-surface/12',
          variantClasses[variant],
          elevated && elevatedClasses,
          selected && selectedClasses[variant],
          className,
        )}
        {...rest}
      >
        {selected && !leadingIcon && (
          <span className="inline-flex shrink-0 [&>svg]:h-4 [&>svg]:w-4">
            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M9.55 18.2L3.85 12.5l1.425-1.425L9.55 15.35l9.175-9.175L20.15 7.6z" />
            </svg>
          </span>
        )}
        {leadingIcon && (
          <span className="inline-flex shrink-0 [&>svg]:h-4 [&>svg]:w-4">
            {leadingIcon}
          </span>
        )}
        {children}
        {trailingIcon && (
          <span className="inline-flex shrink-0 [&>svg]:h-4 [&>svg]:w-4">
            {trailingIcon}
          </span>
        )}
      </button>
    );
  },
);
