import { type HTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

interface CardSectionProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export function Card({ className, children, ...props }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-xl border border-border bg-white/80 backdrop-blur-sm shadow-md',
        'transition-shadow duration-200 hover:shadow-lg',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({ className, children, ...props }: CardSectionProps) {
  return (
    <div className={cn('border-b border-border px-6 py-4', className)} {...props}>
      {children}
    </div>
  );
}

export function CardBody({ className, children, ...props }: CardSectionProps) {
  return (
    <div className={cn('px-6 py-4', className)} {...props}>
      {children}
    </div>
  );
}

export function CardFooter({ className, children, ...props }: CardSectionProps) {
  return (
    <div className={cn('border-t border-border px-6 py-4', className)} {...props}>
      {children}
    </div>
  );
}
