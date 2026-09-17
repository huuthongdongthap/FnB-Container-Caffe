/**
 * CRM — Frequency banding (RFM-lite).
 *
 * Pure function: classifies a customer into a lifecycle band from
 * first/last order timestamps + order count. No D1, no side effects.
 *
 * Band semantics:
 *   new            — first order within `newMaxDays` (default 30)
 *   regular        — last order within `regularMaxDays` (default 60)
 *   lapsing        — last order between regularMaxDays and dormantMinDays
 *   dormant        — last order older than dormantMinDays (default 120)
 *   resurrected    — was dormant, placed a new order within resurrectWindowDays (default 30)
 *
 * KV key `crm:band_policy` can override any window. Malformed JSON falls
 * back to defaults.
 */

export type FrequencyBand =
  | 'new'
  | 'regular'
  | 'lapsing'
  | 'dormant'
  | 'resurrected';

export interface BandPolicy {
  /** Max days since first order to still be considered "new". */
  newMaxDays: number;
  /** Max days since last order to be "regular". */
  regularMaxDays: number;
  /** Min days since last order to be "dormant". */
  dormantMinDays: number;
  /** Window after dormancy to flag "resurrected". */
  resurrectWindowDays: number;
}

export interface OrderSummary {
  /** ISO timestamp of the customer's first order (oldest). */
  firstOrderAt: string;
  /** ISO timestamp of the customer's most recent order. */
  lastOrderAt: string;
  /** Total number of orders. */
  orderCount: number;
  /** Second-most-recent order timestamp — used to detect resurrection. */
  previousOrderAt?: string;
}

export const DEFAULT_BAND_POLICY: BandPolicy = {
  newMaxDays: 30,
  regularMaxDays: 60,
  dormantMinDays: 120,
  resurrectWindowDays: 30,
};

const MS_PER_DAY = 86_400_000;

/**
 * Resolve the effective band policy: KV override merged over defaults.
 * Bad JSON / missing key → defaults.
 */
export async function resolveBandPolicy(
  kv?: { get: (key: string) => Promise<string | null> },
): Promise<BandPolicy> {
  if (!kv) return DEFAULT_BAND_POLICY;
  try {
    const raw = await kv.get('crm:band_policy');
    if (!raw) return DEFAULT_BAND_POLICY;
    const override = JSON.parse(raw) as Partial<BandPolicy>;
    return { ...DEFAULT_BAND_POLICY, ...override };
  } catch {
    return DEFAULT_BAND_POLICY;
  }
}

/**
 * Pure band classification. `now` is injectable for deterministic tests.
 */
export function computeFrequencyBand(
  summary: OrderSummary,
  policy: BandPolicy = DEFAULT_BAND_POLICY,
  now: Date = new Date(),
): FrequencyBand {
  const firstMs = new Date(summary.firstOrderAt).getTime();
  const lastMs = new Date(summary.lastOrderAt).getTime();
  const daysSinceFirst = (now.getTime() - firstMs) / MS_PER_DAY;
  const daysSinceLast = (now.getTime() - lastMs) / MS_PER_DAY;

  // New customer: first order is recent AND low order count.
  if (daysSinceFirst <= policy.newMaxDays && summary.orderCount <= 3) {
    return 'new';
  }

  // Resurrected: was dormant (previous order old) but placed a fresh order.
  if (summary.previousOrderAt) {
    const prevMs = new Date(summary.previousOrderAt).getTime();
    const daysSincePrev = (now.getTime() - prevMs) / MS_PER_DAY;
    if (daysSincePrev >= policy.dormantMinDays &&
        daysSinceLast <= policy.resurrectWindowDays) {
      return 'resurrected';
    }
  }

  // Dormant: last order older than dormant threshold.
  if (daysSinceLast >= policy.dormantMinDays) {
    return 'dormant';
  }

  // Lapsing: between regular and dormant.
  if (daysSinceLast > policy.regularMaxDays) {
    return 'lapsing';
  }

  return 'regular';
}
