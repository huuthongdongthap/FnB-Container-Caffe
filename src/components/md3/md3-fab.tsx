import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface MD3FabProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'tertiary' | 'surface';
  size?: 'small' | 'medium' | 'large';
  icon: ReactNode;
  label?: string;
}

const variantClasses: Record<NonNullable<MD3FabProps['variant']>, string> = {
  primary: 'bg-md-primary-container text-md-on-primary-container',
  secondary: 'bg-md-secondary-container text-md-on-secondary-container',
  tertiary: 'bg-md-tertiary-container text-md-on-tertiary-container',
  surface: 'bg-md-surface-container-high text-md-primary',
};

const sizeClasses: Record<NonNullable<MD3FabProps['size']>, string> = {
  small: 'h-10 w-10 rounded-md-lg',
  medium: 'h-14 w-14 rounded-md-lg',
  large: 'h-24 w-24 rounded-md-xl',
};

const iconSizeClasses: Record<NonNullable<MD3FabProps['size']>, string> = {
  small: '[&>svg]:h-5 [&>svg]:w-5',
  medium: '[&>svg]:h-6 [&>svg]:w-6',
  large: '[&>svg]:h-8 [&>svg]:w-8',
};

/**
 * Material Design 3 Floating Action Button.
 * Icon-only (required icon prop) with optional extended label.
 * aria-label required for icon-only usage.
 */
export const MD3Fab = forwardRef<HTMLButtonElement, MD3FabProps>(
  function MD3Fab(
    {
      variant = 'primary',
      size = 'medium',
      icon,
      label,
      className,
      ...rest
    },
    ref,
  ) {
    const extended = Boolean(label);

    return (
      <button
        ref={ref}
        aria-label={!label ? rest['aria-label'] || 'Action button' : undefined}
        className={cn(
          'inline-flex items-center justify-center',
          'shadow-[0px_1px_3px_1px_rgba(0,0,0,0.15),0px_1px_2px_rgba(0,0,0,0.3)]',
          'hover:shadow-[0px_1px_2px_rgba(0,0,0,0.3),0px_2px_6px_2px_rgba(0,0,0,0.15)]',
          'transition-shadow duration-200 ease-[cubic-bezier(0.2,0,0,1)]',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-md-primary',
          variantClasses[variant],
          !extended && sizeClasses[size],
          // Extended FAB: auto width, medium height, large corner
          extended && 'h-14 rounded-md-lg px-4 gap-3',
          className,
        )}
        {...rest}
      >
        <span className={cn('inline-flex shrink-0', iconSizeClasses[size])}>
          {icon}
        </span>
        {label && (
          <span className="text-sm font-medium tracking-[0.1px] leading-[1.43]">
            {label}
          </span>
        )}
      </button>
    );
  },
);
