/**
 * TimelineStep — single step in the vertical progress timeline
 */

import type { TimelineStepProps } from './StitchTrackOrderNew-types';

export function TimelineStep({
  label,
  time,
  isActive,
  isCompleted,
  isLast,
}: TimelineStepProps) {
  const isHighlighted = isActive || isCompleted;
  const diamondColor = isActive
    ? 'var(--aura-bronze-shimmer)'
    : isCompleted
      ? 'var(--aura-chrome-bright)'
      : 'var(--aura-chrome-soft)';
  const diamondOpacity = isHighlighted ? '1' : '0.4';
  const textOpacity = isHighlighted ? '1' : '0.4';

  return (
    <div className="flex items-center gap-6 relative">
      <div className="z-10 w-11 h-11 flex items-center justify-center bg-[var(--aura-surface-dim)]">
        <div
          className="w-3 h-3"
          style={{
            transform: 'rotate(45deg)',
            backgroundColor: diamondColor,
            opacity: diamondOpacity,
            boxShadow: isActive ? '0 0 15px rgba(212, 165, 116, 0.4)' : 'none',
            animation: isActive ? 'aura-pulse-bronze 2s infinite ease-in-out' : 'none',
          }}
        />
      </div>
      <div>
        <h3
          className="font-['Space_Grotesk'] text-[14px] font-medium tracking-[0.05em] uppercase"
          style={{
            color: isHighlighted ? 'var(--aura-bronze-shimmer)' : 'var(--aura-chrome-soft)',
            opacity: textOpacity,
          }}
        >
          {label}
        </h3>
        {time && (
          <p className="text-[10px] text-[var(--aura-chrome-soft)] mt-1">{time}</p>
        )}
      </div>
    </div>
  );
}
