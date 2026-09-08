import { type HTMLAttributes, type ReactNode, forwardRef } from 'react';
import { cn } from '@/lib/cn';

export interface MD3CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'elevated' | 'filled' | 'outlined';
  children: ReactNode;
}

const variantClasses: Record<NonNullable<MD3CardProps['variant']>, string> = {
  elevated:
    'bg-md-surface-container-low shadow-[0px_1px_3px_1px_rgba(0,0,0,0.15),0px_1px_2px_rgba(0,0,0,0.3)]',
  filled: 'bg-md-surface-container-highest',
  outlined: 'bg-md-surface border border-md-outline-variant',
};

/**
 * Material Design 3 Card component.
 * Supports elevated, filled, and outlined variants.
 * Corner radius 12px (rounded-md-md). Optional interactive state on click.
 */
export const MD3Card = forwardRef<HTMLDivElement, MD3CardProps>(
  function MD3Card({ variant = 'elevated', className, children, onClick, ...rest }, ref) {
    const interactive = typeof onClick === 'function';

    return (
      <div
        ref={ref}
        role={interactive ? 'button' : undefined}
        tabIndex={interactive ? 0 : undefined}
        onClick={onClick}
        onKeyDown={
          interactive
            ? (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onClick?.(e as unknown as React.MouseEvent<HTMLDivElement>);
                }
              }
            : undefined
        }
        className={cn(
          'rounded-md-md overflow-hidden',
          'transition-colors duration-200 ease-[cubic-bezier(0.2,0,0,1)]',
          variantClasses[variant],
          interactive && 'cursor-pointer hover:bg-md-on-surface/8 active:bg-md-on-surface/12',
          className,
        )}
        {...rest}
      >
        {children}
      </div>
    );
  },
);
