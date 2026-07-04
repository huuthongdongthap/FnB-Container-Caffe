/**
 * StitchAccountDashNew — AURA CAFE Account Dashboard
 *
 * Full-page dashboard using StitchAccountDashNew component.
 * Mobile-first, dark navy theme with glassmorphism cards, bronze gradients,
 * and chrome/silver accents.
 *
 * Source: Stitch AI account dashboard export (new variant).
 */
'use client';

import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { User, ArrowRight, AlertCircle, Gift } from 'lucide-react';
import { useAccount } from '@/hooks/use-account';
import { useAuthStore } from '@/hooks/stores/use-auth-store';
import { StitchAccountDashNew } from '@/components/stitch';
import type { DashAccountProfile, DashLoyaltyData, DashOrderItem } from '@/components/stitch';

/* ─── Constants ────────────────────────────────────────────────────── */

const TIER_ORDER = ['bronze', 'silver', 'gold', 'platinum'] as const;

const TIER_POINTS: Record<string, number> = {
  bronze: 0,
  silver: 500,
  gold: 2000,
  platinum: 5000,
};

function getNextTier(tier: string): string | null {
  const idx = TIER_ORDER.indexOf(tier as (typeof TIER_ORDER)[number]);
  if (idx >= 0 && idx < TIER_ORDER.length - 1) return TIER_ORDER[idx + 1] ?? null;
  return null;
}

function getTierProgress(
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

function formatTimeAgo(dateStr: string, t: (key: string, opts?: Record<string, unknown>) => string): string {
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

/* ─── Data Transformation ──────────────────────────────────────────── */

function mapOrderItemIcon(productName: string): DashOrderItem['icon'] {
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

function mapOrderStatus(status: string): DashOrderItem['status'] {
  return ['pending', 'confirmed', 'preparing'].includes(status) ? 'preparing' : 'delivered';
}

/* ─── Main Component ───────────────────────────────────────────────── */

export default function AccountPage() {
  const user = useAuthStore((s) => s.user);
  const { profile, orders, loading, error, refetchProfile } = useAccount();
  const navigate = useNavigate();
  const { t } = useTranslation('account');

  /* ─── Not logged in ───────────────────────────────────────────── */
  if (!user) {
    return (
      <div className="mx-auto max-w-2xl px-[var(--aura-container-padding,24px)] pt-8 pb-24">
        <div
          className="flex flex-col items-center justify-center gap-5 rounded-xl p-12 text-center"
          style={{
            backgroundColor: 'rgba(30, 41, 59, 0.4)',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
          }}
        >
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center"
            style={{ backgroundColor: 'var(--aura-bg-elevated, #162a3d)' }}
          >
            <User
              className="h-8 w-8"
              style={{ color: 'var(--aura-text-secondary, #a0a8b0)' }}
            />
          </div>
          <h3
            className="text-2xl font-semibold"
            style={{
              fontFamily: 'var(--aura-font-display, "EB Garamond", Georgia, serif)',
              color: 'var(--aura-text-primary, #e8e8e8)',
            }}
          >
            {t('notLoggedIn.title')}
          </h3>
          <p
            className="max-w-xs text-sm"
            style={{
              color: 'var(--aura-text-secondary, #a0a8b0)',
              fontFamily: 'var(--aura-font-body, "Space Grotesk", system-ui, sans-serif)',
            }}
          >
            {t('notLoggedIn.body')}
          </p>
          <button
            type="button"
            onClick={() => navigate('/menu')}
            className="px-8 py-3 rounded-lg font-bold text-sm flex items-center gap-2 transition-all active:scale-95"
            style={{
              backgroundColor: 'var(--aura-primary, #c6c6c7)',
              color: 'var(--aura-on-primary, #1a1a2e)',
              fontFamily: 'var(--aura-font-body, "Space Grotesk", system-ui, sans-serif)',
            }}
          >
            {t('notLoggedIn.cta')}
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  /* ─── Loading state ────────────────────────────────────────────── */
  if (loading) {
    return (
      <div className="mx-auto max-w-2xl px-[var(--aura-container-padding,24px)] pt-8 pb-24">
        <div
          className="animate-pulse space-y-4"
          aria-label={t('loadingData')}
          role="status"
        >
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="rounded-xl p-6"
              style={{
                backgroundColor: 'var(--aura-bg-glass, rgba(255,255,255,0.03))',
                border: '1px solid var(--aura-glass-border, rgba(255,255,255,0.08))',
              }}
            >
              <div className="h-6 w-3/4 rounded" style={{ backgroundColor: 'var(--aura-bg-high, #1e3550)' }} />
              <div className="h-3 w-1/2 rounded mt-3" style={{ backgroundColor: 'var(--aura-bg-high, #1e3550)' }} />
            </div>
          ))}
          <span className="sr-only">{t('loading')}</span>
        </div>
      </div>
    );
  }

  /* ─── Error state (no profile data due to error) ──────────────── */
  if (error && !profile) {
    return (
      <div className="mx-auto max-w-2xl px-[var(--aura-container-padding,24px)] pt-8 pb-24">
        <div
          className="flex flex-col items-center justify-center gap-4 rounded-xl p-10 text-center"
          style={{
            backgroundColor: 'var(--aura-bg-glass, rgba(255,255,255,0.03))',
            backdropFilter: 'blur(var(--aura-glass-blur, 12px))',
            WebkitBackdropFilter: 'blur(var(--aura-glass-blur, 12px))',
            border: '1px solid var(--aura-glass-border, rgba(255,255,255,0.08))',
          }}
          role="alert"
        >
          <AlertCircle
            className="h-12 w-12"
            style={{ color: 'var(--aura-error, #ffb4ab)' }}
          />
          <h3
            className="text-xl font-semibold"
            style={{
              fontFamily: 'var(--aura-font-display, "EB Garamond", Georgia, serif)',
              color: 'var(--aura-text-primary, #e8e8e8)',
            }}
          >
            {t('error.title')}
          </h3>
          <p
            className="text-sm"
            style={{
              color: 'var(--aura-text-secondary, #a0a8b0)',
              fontFamily: 'var(--aura-font-body, "Space Grotesk", system-ui, sans-serif)',
            }}
          >
            {error}
          </p>
          <button
            type="button"
            onClick={refetchProfile}
            className="px-6 py-3 rounded-lg font-bold text-sm transition-all active:scale-95"
            style={{
              backgroundColor: 'var(--aura-primary, #c6c6c7)',
              color: 'var(--aura-on-primary, #1a1a2e)',
              fontFamily: 'var(--aura-font-body, "Space Grotesk", system-ui, sans-serif)',
            }}
          >
            {t('error.retry')}
          </button>
        </div>
      </div>
    );
  }

  /* ─── Profile loaded with data ─────────────────────────────────── */
  if (profile) {
    const points = profile.loyalty_points ?? profile.cashback_balance ?? 0;
    const lifetimePoints = profile.lifetime_points ?? points;
    const progress = getTierProgress(profile.loyalty_tier, lifetimePoints);

    const dashProfile: DashAccountProfile = {
      name: profile.name,
      avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.name)}&background=1e3550&color=c6c6c7&size=80`,
      tier: profile.loyalty_tier.charAt(0).toUpperCase() + profile.loyalty_tier.slice(1),
      memberSince: new Date(profile.created_at).getFullYear().toString(),
    };

    const dashLoyalty: DashLoyaltyData = {
      points,
      nextTier: progress.nextTier
        ? progress.nextTier.charAt(0).toUpperCase() + progress.nextTier.slice(1)
        : profile.loyalty_tier.charAt(0).toUpperCase() + profile.loyalty_tier.slice(1),
      pointsToNext: progress.remaining,
      progressPercent: progress.percent,
    };

    const dashOrders: DashOrderItem[] = orders.map((order) => {
      let items: { product_name: string; quantity: number }[] = [];
      try { items = JSON.parse(order.items) as { product_name: string; quantity: number }[]; } catch { items = []; }
      const productName = items.length > 0 ? items[0]!.product_name : 'Order';

      return {
        id: order.id,
        itemName: productName,
        icon: mapOrderItemIcon(productName),
        time: formatTimeAgo(order.created_at, t),
        status: mapOrderStatus(order.status),
      };
    });

    return (
      <StitchAccountDashNew
        profile={dashProfile}
        loyalty={dashLoyalty}
        orders={dashOrders}
      />
    );
  }

  /* ─── Empty state (no profile after loading completed) ─────────── */
  return (
    <div className="mx-auto max-w-2xl px-[var(--aura-container-padding,24px)] pt-8 pb-24">
      <div
        className="flex flex-col items-center justify-center gap-4 rounded-xl p-10 text-center"
        style={{
          backgroundColor: 'rgba(30, 41, 59, 0.4)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
        }}
      >
        <Gift
          className="h-10 w-10"
          style={{ color: 'var(--aura-text-disabled, #5a6270)' }}
        />
        <p
          className="text-sm"
          style={{
            color: 'var(--aura-text-secondary, #a0a8b0)',
            fontFamily: 'var(--aura-font-body, "Space Grotesk", system-ui, sans-serif)',
          }}
        >
          {t('noData')}
        </p>
      </div>
    </div>
  );
}
