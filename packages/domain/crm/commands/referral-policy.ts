/**
 * CRM — Referral reward policy (pure).
 *
 * Two reward modes preserved from legacy v1/v3:
 * - points: 100 points to referrer on referee first paid order
 * - cashback: 10,000 VND cashback to referrer on referee first paid order >= 20k VND
 *
 * kv overlay: `referral:policy` merges over defaults (partial override).
 */

export type ReferralBonusType = 'points' | 'cashback';

export interface ReferralPolicy {
  bonusType: ReferralBonusType;
  pointsReferrer: number;
  pointsReferee: number;
  cashbackReferrerVnd: number;
  cashbackRefereeVnd: number;
  minOrderVnd: number;
}

export const DEFAULT_REFERRAL_POLICY: ReferralPolicy = {
  bonusType: 'cashback',
  pointsReferrer: 100,
  pointsReferee: 50,
  cashbackReferrerVnd: 10_000,
  cashbackRefereeVnd: 5_000,
  minOrderVnd: 20_000,
};

/**
 * Resolve policy: KV overlay merges over defaults. Missing/invalid → defaults.
 */
export async function resolveReferralPolicy(
  kv?: import('@cloudflare/workers-types').KVNamespace,
): Promise<ReferralPolicy> {
  if (!kv) return DEFAULT_REFERRAL_POLICY;
  try {
    const raw = await kv.get('referral:policy');
    if (!raw) return DEFAULT_REFERRAL_POLICY;
    const parsed = JSON.parse(raw) as Partial<ReferralPolicy>;
    return {
      ...DEFAULT_REFERRAL_POLICY,
      ...parsed,
    };
  } catch {
    return DEFAULT_REFERRAL_POLICY;
  }
}
