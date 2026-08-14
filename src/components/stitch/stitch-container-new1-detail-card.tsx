'use client';

import { clsx } from 'clsx';

/**
 * Detail card used in the Bento Grid section.
 */
export function DetailCard({
  icon,
  title,
  description,
  highlight = false,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={clsx('glass-panel flex-1', highlight && 'border-l-4')}
      style={{
        padding: '24px',
        backgroundColor: 'rgba(18, 37, 61, 0.6)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        border: '1px solid rgba(198, 198, 199, 0.15)',
        borderLeftColor: highlight ? 'var(--aura-chrome-bright)' : undefined,
        borderLeftWidth: highlight ? '4px' : undefined,
      }}
    >
      <div className="mb-3 flex items-center gap-3">
        <span style={{ color: 'var(--aura-chrome-bright)' }}>{icon}</span>
        <h4
          className="text-[14px] uppercase leading-[1.0] tracking-[0.1em]"
          style={{
            fontFamily: "'Space Grotesk', sans-serif",
            fontWeight: 500,
            color: '#c6c6c7',
          }}
        >
          {title}
        </h4>
        {highlight && (
          <div
            className="h-2 w-2 animate-pulse rounded-full"
            style={{
              backgroundColor: 'var(--aura-chrome-bright)',
              boxShadow: '0 0 8px var(--aura-chrome-bright)',
            }}
          />
        )}
      </div>
      <p
        className="text-base"
        style={{
          fontFamily: "'Space Grotesk', sans-serif",
          lineHeight: '1.6',
          color: 'var(--aura-chrome-soft)',
        }}
      >
        {description}
      </p>
    </div>
  );
}
