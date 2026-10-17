import { cn } from '@/lib/cn';
import { STATUS_TRANSITIONS } from './OrderTable-constants';
import type { StatusActionsProps } from './OrderTable-types';

export function StatusActions({ currentStatus, isUpdating, onUpdate, t }: StatusActionsProps) {
  const nextStatuses = STATUS_TRANSITIONS[currentStatus];

  if (!nextStatuses || nextStatuses.length === 0) {
    return <span className="text-xs text-muted">-</span>;
  }

  return (
    <div className="flex gap-1 justify-center">
      {nextStatuses.map((status) => (
        <button
          key={status}
          onClick={() => onUpdate(status)}
          disabled={isUpdating}
          className={cn(
            'px-2 py-0.5 rounded text-[10px] font-medium transition-colors',
            status === 'cancelled'
              ? 'bg-red-500/15 text-red-300 hover:bg-red-500/25'
              : 'bg-sky-500/15 text-sky-300 hover:bg-sky-500/25',
            isUpdating && 'opacity-50 cursor-not-allowed'
          )}
        >
          {isUpdating ? '...' : t(`adminOrders.status${status.charAt(0).toUpperCase() + status.slice(1)}`)}
        </button>
      ))}
    </div>
  );
}
