/* ── Loyalty store helper functions ── */

import { LOYALTY_KEY, type Reward, type PointsHistoryEntry, type StoredLoyalty } from './loyalty-store-types';

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

export function parseLoyaltySummary(data: Record<string, unknown>): { tier: string; points: number; cashbackRate: number } {
  const tier = (data.tier as string) || 'bronze';
  const points = Number(data.total_points ?? data.points ?? 0);
  const tierConfig = data.tier_config as Record<string, unknown> | undefined;
  const cashbackRate = Number(
    (data.cashbackRate as number) ??
    (tierConfig?.cashback_rate as number) ??
    3
  );
  return { tier, points, cashbackRate };
}
