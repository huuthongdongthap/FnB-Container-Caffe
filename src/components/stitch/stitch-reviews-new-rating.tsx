/**
 * StitchReviewsNew — Star rating display components
 *
 * HalfStar: renders a half-filled star (for aggregate ratings like 4.9).
 * ReviewStars: renders full/empty star rows for individual review cards.
 */

import { Star } from 'lucide-react';

/* ─── Half Star (aggregate rating 4.9) ───────────────────────────── */

export function HalfStar({
  className = 'h-5 w-5',
  color = '#c6c6c7',
}: {
  className?: string;
  color?: string;
}) {
  return (
    <div
      className="relative"
      style={{
        width: className.includes('w-') ? undefined : '1.25rem',
        height: className.includes('h-') ? undefined : '1.25rem',
      }}
    >
      <Star className={className} style={{ color }} />
      <div className="absolute inset-0 overflow-hidden" style={{ width: '50%' }}>
        <Star className={className} fill={color} style={{ color }} />
      </div>
    </div>
  );
}

/* ─── Star Rating Display (review cards) ──────────────────────────── */

export function ReviewStars({
  rating,
  sm = false,
}: {
  rating: number;
  sm?: boolean;
}) {
  const fullStars = Math.floor(rating);
  const starSize = sm ? 'h-[14px] w-[14px]' : 'h-5 w-5';

  return (
    <div className="flex gap-0.5" role="img" aria-label={`${rating} out of 5 stars`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={starSize}
          fill={i < fullStars ? '#c6c6c7' : 'none'}
          style={{ color: i < fullStars ? '#c6c6c7' : 'var(--aura-chrome-dim)' }}
          stroke={i < fullStars ? undefined : 'currentColor'}
        />
      ))}
    </div>
  );
}
