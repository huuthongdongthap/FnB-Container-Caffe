/**
 * CRM — Loyalty policy loader.
 * Pure function: reads loyalty_tiers + active bonus_campaigns + optional KV overrides.
 * Hono-free, D1-only. Failures fall back to safe defaults so the customer
 * journey never breaks because a campaign row is missing.
 */

import type { D1Database } from '@cloudflare/workers-types';
import type { KVNamespace } from '@cloudflare/workers-types';

export interface LoyaltyTierPolicy {
  tierName: string;
  minPoints: number;
  cashbackRate: number;
  pointMultiplier: number;
  expiryDays: number | null;
}

export interface LoyaltyPolicy {
  tiers: LoyaltyTierPolicy[];
  defaultTier: LoyaltyTierPolicy;
  campaignMultiplier: number;
  maxCapPerTx: number;
  campaignCode: string | null;
  expiresAt: string | null;
}

const DEFAULT_MAX_CASHBACK_PER_TX = 50_000;
const DEFAULT_TIER: LoyaltyTierPolicy = {
  tierName: 'bronze',
  minPoints: 0,
  cashbackRate: 0.03,
  pointMultiplier: 1.0,
  expiryDays: 365,
};

/**
 * Load the live loyalty policy: tiers sorted by min_points ASC,
 * plus any active campaign multiplier / cap overrides.
 *
 * KV override key: `loyalty:policy` (JSON partial<LoyaltyPolicy>).
 * Parsed with try/catch — bad JSON falls back to DB policy.
 */
export async function loadPolicy(
  db: D1Database,
  kv?: KVNamespace,
  now: Date = new Date(),
): Promise<LoyaltyPolicy> {
  let tiers: LoyaltyTierPolicy[] = [];
  let campaignMultiplier = 1.0;
  let maxCapPerTx = DEFAULT_MAX_CASHBACK_PER_TX;
  let campaignCode: string | null = null;
  let campaignEndDate: string | null = null;

  try {
    const { results } = await db
      .prepare(
        `SELECT tier_name, min_points, cashback_rate, point_multiplier, expiry_days
         FROM loyalty_tiers ORDER BY min_points ASC`,
      )
      .all<{
        tier_name: string;
        min_points: number;
        cashback_rate: number;
        point_multiplier: number;
        expiry_days: number | null;
      }>();

    tiers = (results || []).map((r) => ({
      tierName: r.tier_name,
      minPoints: r.min_points,
      cashbackRate: r.cashback_rate,
      pointMultiplier: r.point_multiplier,
      expiryDays: r.expiry_days,
    }));
  } catch {
    tiers = [];
  }

  try {
    const iso = now.toISOString().replace('T', ' ').slice(0, 19);
    const campaign = await db
      .prepare(
        `SELECT code, cashback_multiplier, max_cap_per_customer_vnd, end_date
         FROM bonus_campaigns
         WHERE active = 1 AND start_date <= ? AND end_date >= ?
         ORDER BY id DESC LIMIT 1`,
      )
      .bind(iso, iso)
      .first<{
        code: string;
        cashback_multiplier: number;
        max_cap_per_customer_vnd: number;
        end_date: string;
      }>();

    if (campaign) {
      campaignMultiplier = campaign.cashback_multiplier ?? 1.0;
      maxCapPerTx = campaign.max_cap_per_customer_vnd ?? DEFAULT_MAX_CASHBACK_PER_TX;
      campaignCode = campaign.code;
      campaignEndDate = campaign.end_date;
    }
  } catch {
    // campaign columns may not exist in older deployments — fall back to defaults
  }

  const defaultTier = tiers[0] ?? DEFAULT_TIER;
  let policy: LoyaltyPolicy = {
    tiers,
    defaultTier,
    campaignMultiplier,
    maxCapPerTx,
    campaignCode,
    expiresAt: campaignEndDate
      ? new Date(campaignEndDate).toISOString()
      : defaultTier.expiryDays
        ? new Date(now.getTime() + defaultTier.expiryDays * 86_400_000).toISOString()
        : null,
  };

  if (kv) {
    policy = await applyKvOverride(policy, kv);
  }

  return policy;
}

async function applyKvOverride(
  policy: LoyaltyPolicy,
  kv: KVNamespace,
): Promise<LoyaltyPolicy> {
  try {
    const raw = await kv.get('loyalty:policy');
    if (!raw) return policy;
    const override = JSON.parse(raw) as Partial<LoyaltyPolicy>;
    return {
      ...policy,
      ...override,
      tiers: override.tiers ?? policy.tiers,
      defaultTier: override.defaultTier ?? policy.defaultTier,
    };
  } catch {
    return policy;
  }
}

/** Look up a single tier by exact name, falling back to default. */
export function tierByName(
  policy: LoyaltyPolicy,
  tierName: string | null,
): LoyaltyTierPolicy {
  if (!tierName) return policy.defaultTier;
  return policy.tiers.find((t) => t.tierName === tierName) ?? policy.defaultTier;
}
