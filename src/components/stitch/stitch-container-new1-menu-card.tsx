'use client';

import type { MenuItem } from './stitch-container-new1-types';

/**
 * Menu item card for Evening Selections section.
 */
export function MenuCard({
  item,
  onClick,
}: {
  item: MenuItem;
  onClick?: (id: string) => void;
}) {
  return (
    <article
      className="glass-panel group cursor-pointer transition-colors"
      style={{
        padding: '24px',
        backgroundColor: 'rgba(18, 37, 61, 0.6)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        border: '1px solid rgba(198, 198, 199, 0.15)',
      }}
      onClick={() => onClick?.(item.id)}
      aria-label={item.name}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClick?.(item.id); }}
    >
      <div className="mb-6 aspect-square overflow-hidden" style={{ backgroundColor: '#23364e' }}>
        <img
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          src={item.imageUrl}
          alt={item.imageAlt}
          loading="lazy"
        />
      </div>
      <div className="flex items-end justify-between">
        <div>
          <h4
            className="text-[24px] leading-[1.4]"
            style={{
              fontFamily: "'EB Garamond', Georgia, serif",
              color: 'var(--aura-chrome-bright)',
              fontWeight: 400,
            }}
          >
            {item.name}
          </h4>
          <p
            className="mt-1 text-xs leading-[1.0] tracking-[0.05em]"
            style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontWeight: 600,
              color: 'var(--aura-chrome-bright)',
            }}
          >
            {item.description}
          </p>
        </div>
        <span
          className="text-[14px] leading-[1.0] tracking-[0.1em]"
          style={{
            fontFamily: "'Space Grotesk', sans-serif",
            fontWeight: 500,
            color: 'var(--aura-chrome-bright)',
          }}
        >
          {item.price}
        </span>
      </div>
    </article>
  );
}
