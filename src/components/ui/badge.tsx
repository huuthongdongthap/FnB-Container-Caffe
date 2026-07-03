import { type HTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

type BadgeVariant = 'default' | 'success' | 'warning' | 'destructive' | 'info';

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  children: ReactNode;
  variant?: BadgeVariant;
}

const variantClasses: Record<BadgeVariant, string> = {
  default: 'bg-muted/20 text-foreground',
  success: 'bg-green-500/15 text-green-400',
  warning: 'bg-yellow-500/15 text-yellow-400',
  destructive: 'bg-red-500/15 text-red-400',
  info: 'bg-blue-500/15 text-blue-400',
};

export function Badge({ className, children, variant = 'default', ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium font-utility',
        variantClasses[variant],
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}
