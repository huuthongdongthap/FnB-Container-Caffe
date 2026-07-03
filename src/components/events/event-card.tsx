import { cn, Card, Badge, Button } from '@/components/ui';
import type { EventItem } from '@/hooks/use-events';

interface EventCardProps {
  event: EventItem;
  onRegister?: (eventId: string) => void;
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

const EVENT_ICONS: Record<string, string> = {
  Tasting: 'coffee',
  Workshop: '\u{1F331}',
  Community: '\u{1F389}',
};

export function EventCard({ event, onRegister, className }: EventCardProps) {
  const { title, description, date, time, location, tag, capacity, registered } = event;
  const isFull = registered >= capacity;
  const spotsLeft = capacity - registered;
  const icon = EVENT_ICONS[tag] ?? '\u{1F3AA}';

  return (
    <Card
      className={cn(
        'flex flex-col overflow-hidden transition-all duration-200 hover:-translate-y-1 hover:shadow-lg',
        isFull && 'opacity-70',
        className,
      )}
    >
      {/* Visual */}
      <div className="relative flex items-center justify-center bg-gradient-to-br from-muted/20 to-muted/5 p-8">
        <span className="text-5xl" aria-hidden="true">
          {icon}
        </span>
        <div className="absolute right-3 top-3 flex flex-col items-center rounded-lg bg-background/80 px-3 py-1.5 text-center backdrop-blur-sm">
          <span className="font-display text-lg font-bold leading-none">
            {new Date(date).getDate()}
          </span>
          <span className="text-[10px] uppercase text-muted/60">
            {new Date(date).toLocaleDateString('vi-VN', { month: 'short' })}
          </span>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col p-5">
        <Badge variant="info" className="mb-2 w-fit text-[10px] uppercase">
          {tag}
        </Badge>

        <h3 className="mb-1 font-display text-lg font-bold">{title}</h3>
        <p className="mb-3 text-sm leading-relaxed text-muted/70">{description}</p>

        <div className="mb-4 space-y-1 text-xs text-muted/60">
          <div className="flex items-center gap-2">
            <span aria-hidden="true">&#x1F557;</span>
            <span>
              {time} &middot; {location}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span aria-hidden="true">&#x1F465;</span>
            <span>
              {registered}/{capacity} cho &middot;
              {isFull ? ' Het cho' : ` Con ${spotsLeft} cho`}
            </span>
          </div>
        </div>

        <div className="mt-auto">
          <Button
            variant={isFull ? 'secondary' : 'primary'}
            size="sm"
            className="w-full"
            disabled={isFull}
            onClick={() => onRegister?.(event.id)}
          >
            {isFull ? 'Het cho' : 'Dang ky ngay'}
          </Button>
        </div>
      </div>
    </Card>
  );
}
