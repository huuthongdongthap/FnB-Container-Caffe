/* ── Loyalty store helper functions ── */

import {
  LOYALTY_KEY,
  type Reward,
  type PointsHistoryEntry,
  type StoredLoyalty,
  type LoyaltyTierLadderItem,
  type NextTierInfo,
  type RedeemedVoucher,
  type CashbackTransactionEntry,
} from './loyalty-store-types';

export function loadInitialLoyalty(): StoredLoyalty | null {
  try {
    const raw = localStorage.getItem(LOYALTY_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.tier !== undefined) return parsed as StoredLoyalty;
    }
  } catch { /* ignore parse errors */ }
  return null;
}

export function persistLoyalty(tier: string, points: number, cashbackRate: number): void {
  try {
    localStorage.setItem(LOYALTY_KEY, JSON.stringify({ tier, points, cashbackRate }));
  } catch { /* storage full or unavailable */ }
}

export function parsePointsHistory(data: Record<string, unknown>[]): PointsHistoryEntry[] {
  return data.map((entry) => ({
    id: String(entry.id || ''),
    date: String(entry.created_at || entry.date || ''),
    reason: String(entry.reason || ''),
    points: Number(entry.points_change ?? entry.points ?? 0),
    balance: Number(entry.balance_after ?? entry.balance ?? 0),
  }));
}

export function parseRewards(data: Record<string, unknown>[]): Reward[] {
  return data.map((r) => ({
    id: String(r.id || ''),
    name: String(r.title || r.name || ''),
    cost: Number(r.point_cost ?? r.cost ?? 0),
    icon: String(r.icon || '🎁'),
    description: String(r.description || ''),
  }));
}

export function parseLoyaltySummary(data: Record<string, unknown>): {
  tier: string;
  points: number;
  lifetimePoints: number;
  cashbackRate: number;
  cashbackBalance: number;
  cashbackTotalEarned: number;
  cashbackTotalSpent: number;
  cashbackExpiring7d: number;
  nextTier: NextTierInfo | null;
} {
  const tier = (data.tier as string) || 'bronze';
  const points = Number(data.total_points ?? data.points ?? 0);
  const lifetimePoints = Number(data.lifetime_points ?? data.total_points ?? data.points ?? 0);
  const tierConfig = data.tier_config as Record<string, unknown> | undefined;
  const wallet = data.wallet as Record<string, unknown> | undefined;
  const cashbackBalance = Math.max(0, Number(wallet?.balance ?? data.cashback_balance ?? data.balance ?? 0));
  const cashbackTotalEarned = Math.max(0, Number(wallet?.total_earned ?? data.total_earned ?? 0));
  const cashbackTotalSpent = Math.max(0, Number(wallet?.total_spent ?? data.total_spent ?? 0));
  const rawExpiring = Math.max(0, Number(wallet?.expiring_within_7d ?? data.expiring_within_7d ?? 0));
  const cashbackExpiring7d = Math.max(0, Math.min(rawExpiring, cashbackBalance));
  const rawRate = Number(
    (data.cashbackRate as number) ??
    (tierConfig?.cashback_rate as number) ??
    3
  );
  const cashbackRate = rawRate > 0 && rawRate < 1 ? Math.round(rawRate * 100) : rawRate;
  const rawNext = data.next_tier as Record<string, unknown> | null | undefined;
  const nextTier: NextTierInfo | null = rawNext && typeof rawNext === 'object'
    ? {
        tier_name: String(rawNext.tier_name ?? rawNext.tier ?? ''),
        display_name_vi: String(rawNext.display_name_vi ?? rawNext.tier_name ?? ''),
        min_points: Number(rawNext.min_points ?? 0),
        points_needed: Number(rawNext.points_needed ?? 0),
      }
    : null;
  return {
    tier,
    points,
    lifetimePoints,
    cashbackRate,
    cashbackBalance,
    cashbackTotalEarned,
    cashbackTotalSpent,
    cashbackExpiring7d,
    nextTier,
  };
}

export function parseCashbackHistory(data: Record<string, unknown>[]): CashbackTransactionEntry[] {
  return data.map((row) => ({
    id: String(row.id || ''),
    type: String(row.type || 'earn'),
    amount: Number(row.amount ?? 0),
    balanceAfter: Number(row.balance_after ?? row.balanceAfter ?? 0),
    orderId: row.order_id ? String(row.order_id) : row.orderId ? String(row.orderId) : null,
    expiresAt: row.expires_at ? String(row.expires_at) : row.expiresAt ? String(row.expiresAt) : null,
    description: String(row.description || ''),
    createdAt: String(row.created_at || row.createdAt || ''),
  }));
}

export function parseMyRewards(data: Record<string, unknown>[]): RedeemedVoucher[] {
  const now = Date.now();
  return data
    .map((row) => {
      const code = String(row.code ?? row.voucher_code ?? row.voucherCode ?? '').trim();
      const expiresAt = row.expires_at ? String(row.expires_at) : row.expiresAt ? String(row.expiresAt) : null;
      const rawStatus = String(row.status ?? 'active').toLowerCase();
      let status: 'active' | 'used' | 'expired' =
        rawStatus === 'used' ? 'used' : rawStatus === 'expired' ? 'expired' : 'active';
      if (status === 'active' && expiresAt && new Date(expiresAt).getTime() < now) {
        status = 'expired';
      }
      return {
        id: String(row.id ?? code),
        rewardId: String(row.reward_id ?? row.rewardId ?? ''),
        code,
        title: String(row.title ?? row.reward ?? row.name ?? code),
        status,
        expiresAt,
        createdAt: row.created_at ? String(row.created_at) : null,
        discountType: row.discount_type ? String(row.discount_type) : undefined,
        discountValue: row.discount_value !== undefined ? Number(row.discount_value) : undefined,
      };
    })
    .filter((v) => Boolean(v.code));
}

export function parseTierLadder(data: Record<string, unknown>[], currentTier: string): LoyaltyTierLadderItem[] {
  return data
    .map((tier) => ({
      tier_name: String(tier.tier_name || ''),
      display_name_vi: String(tier.display_name_vi || tier.tier_name || ''),
      min_points: Number(tier.min_points ?? 0),
      point_multiplier: Number(tier.point_multiplier ?? 1),
      cashback_rate: Number(tier.cashback_rate ?? 0),
      is_current: String(tier.tier_name || '') === currentTier,
    }))
    .sort((a, b) => a.min_points - b.min_points);
}
