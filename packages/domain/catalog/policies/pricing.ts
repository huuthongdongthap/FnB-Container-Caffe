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

export type Channel = 'dine_in' | 'takeaway' | 'online' | 'delivery';

/**
 * Normalizes input channel string into a valid supported Channel.
 * Unsupported or invalid channels deterministically fall back to 'dine_in'.
 */
export function normalizeChannel(channel?: string | null): Channel {
  if (!channel) return 'dine_in';
  const clean = channel.trim().toLowerCase();
  if (clean === 'takeaway') return 'takeaway';
  if (clean === 'online') return 'online';
  if (clean === 'delivery') return 'delivery';
  if (clean === 'dine_in') return 'dine_in';
  return 'dine_in';
}

export interface ChannelDeltaConfig {
  dine_in?: number;
  takeaway?: number;
  online?: number;
  delivery?: number;
  [channel: string]: number | undefined;
}

export interface ResolveItemPriceInput {
  basePriceCents: number;
  channel: Channel | string;
  modifierChoices: ReadonlyArray<ModifierChoice>;
  happyHourWindows: ReadonlyArray<HappyHourWindow>;
  now: Date;
  channelDeltas?: ChannelDeltaConfig;
}

/**
 * Resolve the effective unit price (integer VND cents) for a product.
 *
 * Sequence:
 * `base product price → channel delta → modifier delta → time rule → final sell price`
 *
 * - `basePriceCents`: The canonical price from `products.price` (server-authoritative).
 * - `channel`: Sales channel ('dine_in', 'takeaway', 'online', 'delivery').
 * - `modifierChoices`: Selected modifier choices with authoritative `price_delta`.
 * - `happyHourWindows`: Configured happy hour windows for time rule evaluation.
 * - `now`: Current evaluation timestamp.
 * - `channelDeltas`: Optional channel adjustments (default: 0).
 *
 * Returns the final sell price in integer VND cents, clamped to minimum 0.
 */
export function resolveItemPrice(input: ResolveItemPriceInput): number {
  const {
    basePriceCents,
    channel,
    modifierChoices,
    happyHourWindows,
    now,
    channelDeltas = {},
  } = input;

  // 1. Base product price (integer VND cents >= 0)
  let effectivePrice = Math.max(0, Math.floor(Number(basePriceCents) || 0));

  // 2. Channel delta (positive surcharge or negative discount)
  const normChannel = normalizeChannel(channel);
  const delta =
    channelDeltas[normChannel] ??
    (normChannel === 'online' ? channelDeltas.delivery : (normChannel === 'delivery' ? channelDeltas.online : 0)) ??
    0;
  effectivePrice += Math.round(Number(delta) || 0);

  // 3. Modifier deltas (sum of validated modifier price deltas)
  for (const choice of modifierChoices) {
    effectivePrice += Math.round(Number(choice.price_delta) || 0);
  }

  // 4. Time rule (Happy Hour active window)
  const hh = happyHourDiscountFor(happyHourWindows, now);
  if (hh) {
    const rawRate = Number(hh.discount_rate) || 0;
    // Supports both 0..1 (e.g. 0.2 = 20%) and percentage 1..100 (e.g. 10 = 10%)
    const discountMultiplier = rawRate <= 1 && rawRate > 0 ? rawRate : rawRate / 100;
    const discountAmount = Math.floor(effectivePrice * discountMultiplier);
    effectivePrice -= discountAmount;
  }

  // 5. Final sell price: integer money value clamped to >= 0
  return Math.max(0, Math.floor(effectivePrice));
}
