import { useRef } from 'react';
import type { EventItem } from './events-promotions-2-types';

/* ── Event Card Component ─────────────────────────────────────────────── */

export function EventCard({ event }: { event: EventItem }) {
  const cardRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = cardRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    el.style.setProperty('--mouse-x', `${e.clientX - rect.left}px`);
    el.style.setProperty('--mouse-y', `${e.clientY - rect.top}px`);
  };

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      className="glass-panel glass-panel-hover rounded-[32px] overflow-hidden flex flex-col group transition-all duration-500"
    >
      {/* Image */}
      <div className="relative h-64 overflow-hidden">
        <div
          className="w-full h-full bg-cover bg-center group-hover:scale-110 transition-transform duration-700"
          style={{ backgroundImage: `url('${event.image}')` }}
          role="img"
          aria-label={event.alt}
        />
        <div className="absolute top-4 left-4 bg-[var(--aura-tertiary)] text-[var(--aura-noir-deep)] px-3 py-1 rounded-full font-body text-[10px] font-semibold uppercase tracking-widest">
          {event.date}
        </div>
      </div>

      {/* Content */}
      <div className="p-6 flex-grow flex flex-col">
        <h3 className="font-display text-2xl text-white mb-2 italic">{event.title}</h3>
        <p className="font-body text-sm text-[var(--aura-chrome-mid)] mb-4 flex-grow">
          {event.description}
        </p>
        <div className="mt-auto flex items-center justify-between">
          <span className="flex items-center gap-1 font-body text-[10px] uppercase tracking-widest text-[var(--aura-chrome-dark)]">
            <span className="text-sm">{event.timeIcon}</span>
            {event.time}
          </span>
          <button className="btn-chrome px-4 py-2 rounded-lg font-body text-[10px] uppercase tracking-widest">
            Book Table
          </button>
        </div>
      </div>
    </div>
  );
}
