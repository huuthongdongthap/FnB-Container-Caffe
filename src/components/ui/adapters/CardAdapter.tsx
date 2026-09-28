import { forwardRef, type HTMLAttributes } from 'react';
import { MD3Card, type MD3CardProps } from '@/components/md3/md3-card';

/**
 * CardAdapter — backward-compatible wrapper around MD3Card.
 * Preserves legacy Card/CardHeader/CardBody/CardFooter API.
 */
export interface CardAdapterProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'elevated' | 'filled' | 'outlined';
  interactive?: boolean;
}

export const Card = forwardRef<HTMLDivElement, CardAdapterProps>(
  function Card({ className, variant = 'elevated', interactive, children, ...rest }, ref) {
    return (
      <MD3Card
        ref={ref}
        variant={variant}
        className={className}
        onClick={interactive ? rest.onClick : undefined}
        {...(interactive ? { role: 'button', tabIndex: 0 } : {})}
        {...rest}
      >
        {children}
      </MD3Card>
    );
  },
);

Card.displayName = 'Card';

/* ── Sub-components (pass-through, no MD3 equivalents) ───────────────── */

export const CardHeader = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  function CardHeader({ className, children, ...rest }, ref) {
    return (
      <div ref={ref} className={`border-b border-border px-6 py-4 ${className}`} {...rest}>
        {children}
      </div>
    );
  },
);
CardHeader.displayName = 'CardHeader';

export const CardBody = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  function CardBody({ className, children, ...rest }, ref) {
    return (
      <div ref={ref} className={`px-6 py-4 ${className}`} {...rest}>
        {children}
      </div>
    );
  },
);
CardBody.displayName = 'CardBody';

export const CardFooter = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  function CardFooter({ className, children, ...rest }, ref) {
    return (
      <div ref={ref} className={`border-t border-border px-6 py-4 ${className}`} {...rest}>
        {children}
      </div>
    );
  },
);
CardFooter.displayName = 'CardFooter';