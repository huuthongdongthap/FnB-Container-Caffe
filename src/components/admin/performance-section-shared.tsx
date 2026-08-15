import { RefreshCw } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { ErrorCardProps } from './performance-section-types';

export function ErrorCard({ message, onRetry }: ErrorCardProps) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-red-600">{message}</p>
        <button
          onClick={onRetry}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Retry
        </button>
      </div>
    </Card>
  );
}

export function EmptyCard({ title }: { title: string }) {
  return (
    <Card className="p-4">
      <h3 className="text-sm font-display font-semibold mb-1">{title}</h3>
      <p className="text-sm text-muted">No data available for the selected period.</p>
    </Card>
  );
}

export function WebVitalsSkeleton() {
  return (
    <Card className="p-4">
      <Skeleton className="h-4 w-24 mb-4" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="border border-border rounded-lg p-3 space-y-2">
            <Skeleton className="h-3 w-10" />
            <Skeleton className="h-4 w-full" variant="rectangular" />
            <Skeleton className="h-3 w-32" />
          </div>
        ))}
      </div>
    </Card>
  );
}

export function LatencySkeleton() {
  return (
    <Card className="p-4">
      <Skeleton className="h-4 w-24 mb-4" />
      <div className="grid grid-cols-3 gap-3 mb-5">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="border border-border rounded-lg p-3 text-center space-y-1">
            <Skeleton className="h-3 w-8 mx-auto" />
            <Skeleton className="h-5 w-16 mx-auto" />
          </div>
        ))}
      </div>
      <Skeleton className="h-3 w-28 mb-2" />
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} className="h-3 w-full mb-1.5" />
      ))}
    </Card>
  );
}
