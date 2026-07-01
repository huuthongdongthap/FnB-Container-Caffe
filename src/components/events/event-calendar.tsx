import { cn, Card, Badge } from '@/components/ui';
import type { EventItem } from '@/hooks/use-events';

interface EventCalendarProps {
  upcoming: EventItem[];
  past: EventItem[];
  showPast?: boolean;
  onTogglePast?: () => void;
  className?: string;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('vi-VN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function EventCalendar({
  upcoming,
  past,
  showPast = false,
  onTogglePast,
  className,
}: EventCalendarProps) {
  const events = showPast ? past : upcoming;

  return (
    <div className={cn('space-y-4', className)}>
      {/* Toggle */}
      <div className="flex items-center gap-3">
        <h3 className="font-display text-lg font-bold">Lich hoat dong</h3>
        {onTogglePast && (
          <button
            type="button"
            onClick={onTogglePast}
            className="rounded-full border border-border/40 px-4 py-1 text-xs font-medium transition-colors hover:bg-muted/10"
          >
            {showPast ? 'Su kien sap toi' : 'Su kien da qua'}
          </button>
        )}
      </div>

      {/* Empty State */}
      {events.length === 0 && (
        <Card className="p-8 text-center">
          <span className="mb-2 block text-3xl" aria-hidden="true">
            &#128197;
          </span>
          <p className="text-sm text-muted/60">
            {showPast ? 'Chua co su kien nao da qua' : 'Chua co su kien sap toi'}
          </p>
        </Card>
      )}

      {/* Event List */}
      <div className="divide-y divide-border/20 overflow-hidden rounded-xl border border-border/30">
        {events.map((event) => {
          const isPast = new Date(event.date).getTime() < Date.now();
          return (
            <div
              key={event.id}
              className={cn(
                'flex items-center gap-4 px-4 py-4 transition-colors hover:bg-muted/5',
                isPast && 'opacity-50',
              )}
            >
              {/* Date Box */}
              <div className="flex shrink-0 flex-col items-center rounded-lg border border-border/40 px-3 py-2 text-center">
                <span className="font-display text-lg font-bold leading-none">
                  {new Date(event.date).getDate()}
                </span>
                <span className="text-[10px] uppercase text-muted/60">
                  {new Date(event.date).toLocaleDateString('vi-VN', { month: 'short' })}
                </span>
              </div>

              {/* Info */}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{event.title}</p>
                <p className="text-xs text-muted/60">
                  {event.time} &middot; {event.location} &middot; {event.registered}/{event.capacity} cho
                </p>
              </div>

              {/* Status Badge */}
              {!isPast && event.registered < event.capacity && (
                <Badge variant="success" className="shrink-0 text-[10px]">
                  Con cho
                </Badge>
              )}
              {!isPast && event.registered >= event.capacity && (
                <Badge variant="destructive" className="shrink-0 text-[10px]">
                  Het cho
                </Badge>
              )}
              {isPast && (
                <Badge variant="default" className="shrink-0 text-[10px]">
                  Da qua
                </Badge>
              )}
            </div>
          );
        })}
      </div>

      {showPast && past.length > 0 && (
        <p className="text-center text-xs text-muted/40">
          Hien thi {past.length} su kien da qua
        </p>
      )}
    </div>
  );
}
