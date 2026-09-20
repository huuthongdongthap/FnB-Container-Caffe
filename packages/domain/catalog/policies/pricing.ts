// Pricing policies — pure functions, no DB access.
// Happy-hour window match mirrors the SQL contract it replaced:
// active + same weekday + (start <= t < end, wrap-free) + priority/discount tiebreak.

import type { HappyHourWindow, ModifierChoice } from '../model/catalog-types';

const toHHMM = (d: Date): string =>
  `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

/**
 * Best-matching active happy-hour window for `now`, or null.
 * Ordering: priority DESC, then discount_rate DESC, then first occurrence.
 */
export function happyHourDiscountFor(
  windows: ReadonlyArray<HappyHourWindow>,
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

export type Channel = 'dine_in' | 'takeaway' | 'delivery';

export interface ChannelDeltaConfig {
  dine_in: number;
  takeaway: number;
  delivery: number;
}

export interface ResolveItemPriceInput {
  basePriceCents: number;
  channel: Channel;
  modifierChoices: ReadonlyArray<ModifierChoice>;
  happyHourWindows: ReadonlyArray<HappyHourWindow>;
  now: Date;
  channelDeltas?: ChannelDeltaConfig;
}

/**
 * Resolve the effective unit price (integer VND cents) for a menu item in a specific channel.
 *
 * Formula: effectivePrice = basePriceCents + channelDelta + sum(modifierChoices.price_delta) - happyHourDiscount
 *
 * - `basePriceCents`: The canonical price from `menu_items.price` (server-authoritative).
 * - `channel`: The customer's order type (`dine_in`, `takeaway`, `delivery`).
 * - `modifierChoices`: Array of selected modifier choices with their `price_delta` cents.
 * - `happyHourWindows`: All configured happy hour windows for discount matching.
 * - `now`: Current time for happy hour evaluation.
 * - `channelDeltas`: Optional per-channel price deltas (default: all 0).
 *
 * Returns the final unit price in integer VND cents, clamped to minimum 0.
 */
export function resolveItemPrice(input: ResolveItemPriceInput): number {
  const {
    basePriceCents,
    channel,
    modifierChoices,
    happyHourWindows,
    now,
    channelDeltas = { dine_in: 0, takeaway: 0, delivery: 0 },
  } = input;

  // Start with base catalog price
  let effectivePrice = basePriceCents;

  // Apply channel delta (positive = surcharge, negative = discount)
  effectivePrice += channelDeltas[channel] ?? 0;

  // Aggregate modifier price deltas (always additive)
  for (const choice of modifierChoices) {
    effectivePrice += choice.price_delta ?? 0;
  }

  // Apply happy hour discount if active and matching
  const hh = happyHourDiscountFor(happyHourWindows, now);
  if (hh) {
    // discount_rate is a percentage (e.g., 10 = 10%)
    const discountAmount = Math.floor((effectivePrice * hh.discount_rate) / 100);
    effectivePrice -= discountAmount;
  }

  // Clamp to minimum 0 (never negative price)
  return Math.max(0, effectivePrice);
}
