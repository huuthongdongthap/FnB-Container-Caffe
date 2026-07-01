import { cn } from '@/lib/cn';

type SkeletonVariant = 'text' | 'circular' | 'rectangular';

interface SkeletonProps {
  className?: string;
  variant?: SkeletonVariant;
}

const variantClasses: Record<SkeletonVariant, string> = {
  text: 'h-4 w-full rounded',
  circular: 'rounded-full',
  rectangular: 'rounded-lg',
};

export function Skeleton({ className, variant = 'text' }: SkeletonProps) {
  return (
    <div
      className={cn(
        'animate-pulse bg-muted/30',
        variantClasses[variant],
        className,
      )}
      aria-hidden="true"
    />
  );
}
