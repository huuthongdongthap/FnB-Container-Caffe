/**
 * Account page — tier logic, time formatting, and order mappers.
 * Pure utilities, no React.
 */
import type { DashOrderItem } from '@/components/stitch';

/* ─── Tier system ─────────────────────────────────────────────────── */

export const TIER_ORDER = ['bronze', 'silver', 'gold', 'platinum'] as const;

export const TIER_POINTS: Record<string, number> = {
  bronze: 0,
  silver: 500,
  gold: 2000,
  platinum: 5000,
};

export function getNextTier(tier: string): string | null {
  const idx = TIER_ORDER.indexOf(tier as (typeof TIER_ORDER)[number]);
  if (idx >= 0 && idx < TIER_ORDER.length - 1) return TIER_ORDER[idx + 1] ?? null;
  return null;
}

export function getTierProgress(
  tier: string,
  points: number,
): { percent: number; remaining: number; nextTier: string | null } {
  const nextTier = getNextTier(tier);
  if (!nextTier) return { percent: 100, remaining: 0, nextTier: null };

  const currentMin = TIER_POINTS[tier] ?? 0;
  const nextMin = TIER_POINTS[nextTier] ?? currentMin + 1000;
  const range = nextMin - currentMin;
  const progress = Math.max(0, Math.min(range, points - currentMin));
  const percent = range > 0 ? Math.round((progress / range) * 100) : 0;
  const remaining = Math.max(0, nextMin - points);

  return { percent, remaining, nextTier };
}

/* ─── Time formatting ─────────────────────────────────────────────── */

export function formatTimeAgo(
  dateStr: string,
  t: (key: string, opts?: Record<string, unknown>) => string,
): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const time = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

  if (diffDays === 0) return t('todayWithTime', { time });
  if (diffDays === 1) return t('yesterdayWithTime', { time });
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/* ─── Order data mappers ──────────────────────────────────────────── */

export function mapOrderItemIcon(productName: string): DashOrderItem['icon'] {
  const lower = productName.toLowerCase();
  if (
    lower.includes('coffee') || lower.includes('brew') || lower.includes('espresso') ||
    lower.includes('latte') || lower.includes('cortado') || lower.includes('mocha')
  ) return 'coffee';
  if (
    lower.includes('croissant') || lower.includes('bread') ||
    lower.includes('pastry') || lower.includes('bake')
  ) return 'bakery';
  if (lower.includes('ice') || lower.includes('cream')) return 'icecream';
  return 'coffee';
}

export function mapOrderStatus(status: string): DashOrderItem['status'] {
  return ['pending', 'confirmed', 'preparing'].includes(status) ? 'preparing' : 'delivered';
}
