// Pricing policies — pure functions, no DB access.
// Happy-hour window match mirrors the SQL contract it replaced:
// active + same weekday + (start <= t < end, wrap-free) + priority/discount tiebreak.

import type { HappyHourWindow } from '../model/catalog-types';

const toHHMM = (d: Date): string =>
  `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

/**
 * Best-matching active happy-hour window for `now`, or null.
 * Ordering: priority DESC, then discount_rate DESC, then first occurrence.
 */
export function happyHourDiscountFor(
  windows: HappyHourWindow[],
  now: Date,
): HappyHourWindow | null {
  const currentTime = toHHMM(now);
  const dayOfWeek = now.getDay();
  const matched = windows
    .filter(
      (w) =>
        w.active === 1 &&
        w.day_of_week === dayOfWeek &&
        w.start_time <= w.end_time &&
        currentTime >= w.start_time &&
        currentTime < w.end_time,
    )
    .sort(
      (a, b) =>
        b.priority - a.priority || b.discount_rate - a.discount_rate,
    );
  return matched[0] ?? null;
}
