/**
 * StitchAccount — AURA CAFE Account Dashboard
 *
 * Premium glassmorphism account page with profile header, loyalty points,
 * progress bar, quick order CTA, recent transactions, and digital membership card.
 * Dark navy + chrome/silver + warm bronze. Mobile-first responsive.
 *
 * Source: Stitch AI account/design.html export (dark theme).
 */
'use client';

import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { clsx } from 'clsx';
import { useTranslation } from 'react-i18next';
import {
  Coffee,
  Utensils,
  IceCream,
  CreditCard,
  AlertCircle,
  Gift,
  ArrowRight,
  User,
} from 'lucide-react';
import { useAccount, type OrderSummary, type CustomerProfile } from '@/hooks/use-account';
import { useAuthStore } from '@/hooks/stores/use-auth-store';

/* ─── Constants ────────────────────────────────────────────────────── */

const TIER_ORDER = ['bronze', 'silver', 'gold', 'platinum'] as const;

const TIER_POINTS: Record<string, number> = {
  bronze: 0,
  silver: 500,
  gold: 2000,
  platinum: 5000,
};

const TIER_I18N_KEYS: Record<string, string> = {
  bronze: 'tier.bronze',
  silver: 'tier.silver',
  gold: 'tier.gold',
  platinum: 'tier.platinum',
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

  if (diffDays === 0) {
    return t('todayWithTime', { time });
  }
  if (diffDays === 1) {
    return t('yesterdayWithTime', { time });
  }
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/* ─── Status Badge ─────────────────────────────────────────────────── */

const STATUS_CONFIG: Record<string, { labelKey: string; className: string }> = {
  pending: {
    labelKey: 'status.preparing',
    className:
      'border-[var(--aura-tertiary,#d4a574)]/30 text-[var(--aura-tertiary,#d4a574)] bg-[var(--aura-tertiary,#d4a574)]/10',
  },
  confirmed: {
    labelKey: 'status.confirmed',
    className:
      'border-[var(--aura-primary,#c6c6c7)]/30 text-[var(--aura-primary,#c6c6c7)] bg-[var(--aura-primary,#c6c6c7)]/10',
  },
  preparing: {
    labelKey: 'status.preparing',
    className:
      'border-[var(--aura-tertiary,#d4a574)]/30 text-[var(--aura-tertiary,#d4a574)] bg-[var(--aura-tertiary,#d4a574)]/10',
  },
  ready: {
    labelKey: 'status.ready',
    className:
      'border-[var(--aura-success,#4CAF50)]/30 text-[var(--aura-success,#4CAF50)] bg-[var(--aura-success,#4CAF50)]/10',
  },
  served: {
    labelKey: 'status.served',
    className:
      'border-[var(--aura-primary,#c6c6c7)]/30 text-[var(--aura-primary,#c6c6c7)] bg-[var(--aura-primary,#c6c6c7)]/10',
  },
  completed: {
    labelKey: 'status.delivered',
    className:
      'border-[var(--aura-primary,#c6c6c7)]/30 text-[var(--aura-primary,#c6c6c7)] bg-[var(--aura-primary,#c6c6c7)]/10',
  },
  cancelled: {
    labelKey: 'status.cancelled',
    className:
      'border-[var(--aura-error,#ffb4ab)]/30 text-[var(--aura-error,#ffb4ab)] bg-[var(--aura-error,#ffb4ab)]/10',
  },
};

function StatusBadge({ status }: { status: string }) {
  const { t } = useTranslation('account');
  const defaultCfg = {
    labelKey: 'status.unknown',
    className:
      'border-[var(--aura-primary,#c6c6c7)]/30 text-[var(--aura-primary,#c6c6c7)] bg-[var(--aura-primary,#c6c6c7)]/10',
  };
  const cfg = STATUS_CONFIG[status] ?? defaultCfg;
  return (
    <span
      className={clsx(
        'px-3 py-1 rounded-full text-[10px] uppercase tracking-wider border whitespace-nowrap font-semibold',
        cfg.className,
      )}
    >
      {t(cfg.labelKey)}
    </span>
  );
}

/* ─── Item Icon ─────────────────────────────────────────────────────── */

function OrderItemIcon({ productName }: { productName: string }) {
  const lower = productName.toLowerCase();
  if (
    lower.includes('coffee') ||
    lower.includes('brew') ||
    lower.includes('espresso') ||
    lower.includes('latte') ||
    lower.includes('cortado') ||
    lower.includes('mocha')
  ) {
    return <Coffee className="h-5 w-5" />;
  }
  if (
    lower.includes('croissant') ||
    lower.includes('bread') ||
    lower.includes('pastry') ||
    lower.includes('bake')
  ) {
    return <Utensils className="h-5 w-5" />;
  }
  if (lower.includes('ice') || lower.includes('cream')) {
    return <IceCream className="h-5 w-5" />;
  }
  return <Coffee className="h-5 w-5" />;
}

/* ─── State: Loading Skeleton ───────────────────────────────────────── */

function AccountSkeleton() {
  const { t } = useTranslation('account');
  return (
    <div
      className="space-y-[var(--aura-card-gap,16px)] animate-pulse"
      aria-label={t('loadingData')}
      role="status"
    >
      {/* Profile card skeleton */}
      <div
        className="rounded-xl p-6 flex items-center gap-4"
        style={{
          backgroundColor: 'var(--aura-bg-glass, rgba(255,255,255,0.03))',
          border: '1px solid var(--aura-glass-border, rgba(255,255,255,0.08))',
        }}
      >
        <div
          className="w-20 h-20 rounded-full shrink-0"
          style={{ backgroundColor: 'var(--aura-bg-high, #1e3550)' }}
        />
        <div className="space-y-2 flex-1">
          <div
            className="h-6 w-36 rounded"
            style={{ backgroundColor: 'var(--aura-bg-high, #1e3550)' }}
          />
          <div
            className="h-3 w-24 rounded"
            style={{ backgroundColor: 'var(--aura-bg-high, #1e3550)' }}
          />
        </div>
      </div>

      {/* Loyalty card skeleton */}
      <div
        className="rounded-xl p-6 space-y-4"
        style={{
          backgroundColor: 'var(--aura-bg-glass, rgba(255,255,255,0.03))',
          border: '1px solid var(--aura-glass-border, rgba(255,255,255,0.08))',
        }}
      >
        <div className="flex justify-between">
          <div className="space-y-2">
            <div
              className="h-3 w-24 rounded"
              style={{ backgroundColor: 'var(--aura-bg-high, #1e3550)' }}
            />
            <div
              className="h-8 w-32 rounded"
              style={{ backgroundColor: 'var(--aura-bg-high, #1e3550)' }}
            />
          </div>
          <div className="space-y-2 text-right">
            <div
              className="h-3 w-24 rounded ml-auto"
              style={{ backgroundColor: 'var(--aura-bg-high, #1e3550)' }}
            />
            <div
              className="h-4 w-20 rounded ml-auto"
              style={{ backgroundColor: 'var(--aura-bg-high, #1e3550)' }}
            />
          </div>
        </div>
        <div
          className="h-1.5 w-full rounded-full"
          style={{ backgroundColor: 'var(--aura-bg-high, #1e3550)' }}
        />
      </div>

      {/* Quick order skeleton */}
      <div
        className="h-16 rounded-xl"
        style={{ backgroundColor: 'var(--aura-bg-high, #1e3550)' }}
      />

      {/* Transactions skeleton */}
      <div className="space-y-2">
        <div
          className="h-4 w-40 rounded"
          style={{ backgroundColor: 'var(--aura-bg-high, #1e3550)' }}
        />
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="rounded-lg p-4 flex items-center gap-4"
            style={{
              backgroundColor: 'var(--aura-bg-glass, rgba(255,255,255,0.03))',
              border: '1px solid var(--aura-glass-border, rgba(255,255,255,0.08))',
            }}
          >
            <div
              className="w-12 h-12 rounded-lg shrink-0"
              style={{ backgroundColor: 'var(--aura-bg-high, #1e3550)' }}
            />
            <div className="flex-1 space-y-2">
              <div
                className="h-4 w-36 rounded"
                style={{ backgroundColor: 'var(--aura-bg-high, #1e3550)' }}
              />
              <div
                className="h-3 w-24 rounded"
                style={{ backgroundColor: 'var(--aura-bg-high, #1e3550)' }}
              />
            </div>
            <div
              className="h-5 w-20 rounded-full shrink-0"
              style={{ backgroundColor: 'var(--aura-bg-high, #1e3550)' }}
            />
          </div>
        ))}
      </div>

      {/* Membership card skeleton */}
      <div
        className="w-full aspect-[1.6/1] rounded-2xl"
        style={{ backgroundColor: 'var(--aura-bg-high, #1e3550)' }}
      />

      <span className="sr-only">{t('loading')}</span>
    </div>
  );
}

/* ─── State: Error ──────────────────────────────────────────────────── */

function AccountError({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  const { t } = useTranslation('account');
  return (
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
          fontFamily: 'var(--aura-font-display, "Cormorant Garamond", Georgia, serif)',
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
        {message}
      </p>
      <button
        type="button"
        onClick={onRetry}
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
  );
}

/* ─── State: Not Logged In ──────────────────────────────────────────── */

function NotLoggedIn() {
  const navigate = useNavigate();
  const { t } = useTranslation('account');
  return (
    <div
      className="flex flex-col items-center justify-center gap-5 rounded-xl p-12 text-center"
      style={{
        backgroundColor: 'var(--aura-bg-glass, rgba(255,255,255,0.03))',
        backdropFilter: 'blur(var(--aura-glass-blur, 12px))',
        WebkitBackdropFilter: 'blur(var(--aura-glass-blur, 12px))',
        border: '1px solid var(--aura-glass-border, rgba(255,255,255,0.08))',
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
          fontFamily: 'var(--aura-font-display, "Cormorant Garamond", Georgia, serif)',
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
  );
}

/* ─── Sub-Component: Profile Header ─────────────────────────────────── */

function ProfileHeader({ profile }: { profile: CustomerProfile }) {
  const { t } = useTranslation('account');
  const tierLabelKey = TIER_I18N_KEYS[profile.loyalty_tier] ?? null;
  const tierLabel = tierLabelKey ? t(tierLabelKey) : profile.loyalty_tier;
  const initials = profile.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <section
      className="relative overflow-hidden rounded-xl p-6"
      style={{
        background: 'rgba(30, 41, 59, 0.4)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        boxShadow: 'inset 0 1px 0 0 rgba(205, 127, 50, 0.3)',
      }}
    >
      {/* Glow orb decoration */}
      <div
        className="absolute -top-10 -right-10 w-32 h-32 blur-[48px] pointer-events-none rounded-full"
        style={{ backgroundColor: 'rgba(212, 165, 116, 0.08)' }}
      />

      <div className="flex items-center gap-4 relative z-10">
        <div className="relative shrink-0">
          <div
            className="w-20 h-20 rounded-full overflow-hidden flex items-center justify-center text-xl font-bold"
            style={{
              border: '2px solid rgba(212, 165, 116, 0.3)',
              backgroundColor: 'var(--aura-bg-high, #1e3550)',
              color: 'var(--aura-primary, #c6c6c7)',
            }}
          >
            {initials}
          </div>
          <div
            className="absolute -bottom-1 -right-1 px-2 py-0.5 rounded-full text-[8px] uppercase tracking-widest font-bold"
            style={{
              backgroundColor: 'var(--aura-tertiary, #d4a574)',
              color: 'var(--aura-on-tertiary, #1a1a2e)',
            }}
          >
            {tierLabel}
          </div>
        </div>
        <div className="min-w-0">
          <h2
            className="text-xl font-semibold truncate"
            style={{
              fontFamily:
                'var(--aura-font-display, "Cormorant Garamond", Georgia, serif)',
              color: 'var(--aura-text-primary, #e8e8e8)',
            }}
          >
            {profile.name}
          </h2>
          <p
            className="text-[10px] uppercase tracking-widest font-semibold mt-0.5"
            style={{
              color: 'var(--aura-tertiary, #d4a574)',
              fontFamily:
                'var(--aura-font-body, "Space Grotesk", system-ui, sans-serif)',
            }}
          >
            {t('tierMember', { tier: tierLabel })}
          </p>
        </div>
      </div>
    </section>
  );
}

/* ─── Sub-Component: Loyalty Section ────────────────────────────────── */

function LoyaltySection({
  tier,
  points,
  lifetimePoints,
}: {
  tier: string;
  points: number;
  lifetimePoints: number;
}) {
  const { t } = useTranslation('account');
  const progress = useMemo(
    () => getTierProgress(tier, lifetimePoints),
    [tier, lifetimePoints],
  );
  const nextTierKey = progress.nextTier ? (TIER_I18N_KEYS[progress.nextTier] ?? null) : null;
  const nextTierLabel = nextTierKey ? t(nextTierKey) : null;
  const currentTierKey = TIER_I18N_KEYS[tier] ?? null;
  const currentTierLabel = currentTierKey ? t(currentTierKey) : tier;

  return (
    <section
      className="rounded-xl p-6 space-y-4"
      style={{
        background: 'rgba(30, 41, 59, 0.4)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
      }}
    >
      <div className="flex justify-between items-end">
        <div>
          <p
            className="text-[10px] uppercase mb-1 font-semibold tracking-wider"
            style={{
              color: 'var(--aura-text-secondary, #a0a8b0)',
              fontFamily:
                'var(--aura-font-body, "Space Grotesk", system-ui, sans-serif)',
            }}
          >
            {t('loyalty.balance')}
          </p>
          <p
            className="text-[32px] font-medium leading-tight"
            style={{
              fontFamily:
                'var(--aura-font-display, "Cormorant Garamond", Georgia, serif)',
              color: 'var(--aura-primary, #c6c6c7)',
            }}
          >
            {points.toLocaleString()}{' '}
            <span
              className="text-[16px] opacity-60"
              style={{
                fontFamily:
                  'var(--aura-font-body, "Space Grotesk", system-ui, sans-serif)',
              }}
            >
              {t('loyalty.pts')}
            </span>
          </p>
        </div>
        {nextTierLabel && (
          <div className="text-right shrink-0">
            <p
              className="text-[10px] uppercase mb-1 font-semibold tracking-wider"
              style={{
                color: 'var(--aura-text-secondary, #a0a8b0)',
                fontFamily:
                  'var(--aura-font-body, "Space Grotesk", system-ui, sans-serif)',
              }}
            >
              {t('loyalty.nextTier', { tier: nextTierLabel })}
            </p>
            <p
              className="text-sm font-medium"
              style={{
                color: 'var(--aura-tertiary, #d4a574)',
                fontFamily:
                  'var(--aura-font-body, "Space Grotesk", system-ui, sans-serif)',
              }}
            >
              {t('loyalty.ptsToGo', { count: progress.remaining })}
            </p>
          </div>
        )}
      </div>

      {/* Progress bar */}
      <div
        className="h-1.5 w-full rounded-full overflow-hidden"
        style={{ backgroundColor: 'var(--aura-bg-high, #1e3550)' }}
      >
        <div
          className="h-full rounded-full"
          style={{
            width: `${Math.min(100, Math.max(0, progress.percent))}%`,
            background: 'linear-gradient(135deg, #CD7F32 0%, #A0522D 100%)',
            boxShadow: '0 0 12px rgba(205, 127, 50, 0.25)',
            transition: 'width 0.6s ease',
          }}
        />
      </div>

      <div className="flex justify-between text-[9px] uppercase tracking-[0.2em] font-semibold opacity-50">
        <span>{currentTierLabel}</span>
        <span>{nextTierLabel ?? t('loyalty.max')}</span>
      </div>
    </section>
  );
}

/* ─── Sub-Component: Quick Order Button ──────────────────────────────── */

function QuickOrderButton() {
  const navigate = useNavigate();
  const { t } = useTranslation('account');
  return (
    <button
      type="button"
      onClick={() => navigate('/menu')}
      className="w-full h-16 rounded-xl flex items-center justify-center gap-3 shadow-lg active:scale-[0.98] transition-transform group"
      style={{
        background: 'linear-gradient(135deg, #CD7F32 0%, #A0522D 100%)',
      }}
      aria-label={t('quickOrder')}
    >
      <Coffee
        className="h-6 w-6 group-hover:rotate-12 transition-transform"
        style={{ color: 'var(--aura-on-secondary, #ffffff)' }}
      />
      <span
        className="text-lg font-bold uppercase tracking-wider"
        style={{
          fontFamily:
            'var(--aura-font-body, "Space Grotesk", system-ui, sans-serif)',
          color: 'var(--aura-on-secondary, #ffffff)',
        }}
      >
        {t('quickOrder')}
      </span>
    </button>
  );
}

/* ─── Sub-Component: Recent Transactions ─────────────────────────────── */

function RecentTransactions({ orders }: { orders: OrderSummary[] }) {
  const navigate = useNavigate();
  const { t } = useTranslation('account');

  return (
    <section className="space-y-4">
      <div className="flex justify-between items-center">
        <h3
          className="text-[12px] uppercase tracking-[0.15em] font-semibold"
          style={{
            color: 'var(--aura-text-primary, #e8e8e8)',
            fontFamily:
              'var(--aura-font-body, "Space Grotesk", system-ui, sans-serif)',
          }}
        >
          {t('recentTransactions')}
        </h3>
        <button
          type="button"
          onClick={() => navigate('/track-order')}
          className="text-[11px] uppercase tracking-widest font-semibold"
          style={{
            color: 'var(--aura-primary, #c6c6c7)',
            fontFamily:
              'var(--aura-font-body, "Space Grotesk", system-ui, sans-serif)',
            borderBottom: '1px solid rgba(198, 198, 199, 0.3)',
          }}
        >
          {t('viewAll')}
        </button>
      </div>

      {orders.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center py-10 text-center rounded-xl"
          style={{
            backgroundColor: 'rgba(30, 41, 59, 0.4)',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
          }}
        >
          <Coffee
            className="h-8 w-8 mb-3"
            style={{ color: 'var(--aura-text-disabled, #5a6270)' }}
          />
          <p
            className="text-sm font-medium"
            style={{
              color: 'var(--aura-text-secondary, #a0a8b0)',
              fontFamily:
                'var(--aura-font-body, "Space Grotesk", system-ui, sans-serif)',
            }}
          >
            {t('noTransactions')}
          </p>
          <p
            className="text-xs mt-1"
            style={{
              color: 'var(--aura-text-disabled, #5a6270)',
              fontFamily:
                'var(--aura-font-body, "Space Grotesk", system-ui, sans-serif)',
            }}
          >
            {t('noTransactions.body')}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {orders.slice(0, 5).map((order) => {
            let items: { product_name: string; quantity: number }[] = [];
            try {
              items = JSON.parse(order.items) as {
                product_name: string;
                quantity: number;
              }[];
            } catch {
              items = [];
            }

            const productName =
              items.length > 0 ? items[0]!.product_name : t('orderLabel');

            return (
              <div
                key={order.id}
                className="rounded-lg p-4 flex items-center justify-between"
                style={{
                  backgroundColor: 'rgba(30, 41, 59, 0.4)',
                  backdropFilter: 'blur(24px)',
                  WebkitBackdropFilter: 'blur(24px)',
                  border: '1px solid rgba(148, 163, 184, 0.3)',
                }}
              >
                <div className="flex items-center gap-4 min-w-0 flex-1">
                  <div
                    className="w-12 h-12 rounded-lg flex items-center justify-center shrink-0"
                    style={{
                      backgroundColor: 'var(--aura-bg-high, #1e3550)',
                      border: '1px solid rgba(255, 255, 255, 0.05)',
                      color: 'var(--aura-tertiary, #d4a574)',
                    }}
                  >
                    <OrderItemIcon productName={productName} />
                  </div>
                  <div className="min-w-0">
                    <p
                      className="text-base font-medium truncate"
                      style={{
                        color: 'var(--aura-text-primary, #e8e8e8)',
                        fontFamily:
                          'var(--aura-font-body, "Space Grotesk", system-ui, sans-serif)',
                      }}
                    >
                      {productName}
                      {items.length > 1 && (
                        <span
                          className="text-xs ml-1"
                          style={{
                            color: 'var(--aura-text-secondary, #a0a8b0)',
                          }}
                        >
                          +{items.length - 1}
                        </span>
                      )}
                    </p>
                    <p
                      className="text-[10px] font-semibold tracking-wider mt-0.5"
                      style={{
                        color: 'var(--aura-text-secondary, #a0a8b0)',
                        fontFamily:
                          'var(--aura-font-body, "Space Grotesk", system-ui, sans-serif)',
                      }}
                    >
                      {formatTimeAgo(order.created_at, t)}
                    </p>
                  </div>
                </div>
                <StatusBadge status={order.status} />
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

/* ─── Sub-Component: Digital Membership Card ────────────────────────── */

function DigitalMembershipCard({
  profile,
}: {
  profile: CustomerProfile;
}) {
  const { t } = useTranslation('account');
  const memberYear = new Date(profile.created_at).getFullYear();

  return (
    <section className="pt-4">
      <div
        className="relative w-full aspect-[1.6/1] rounded-2xl overflow-hidden group"
        style={{ border: '1px solid rgba(255, 255, 255, 0.1)' }}
      >
        {/* Background gradient */}
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(135deg, var(--aura-bg-high, #1e3550), var(--aura-bg-surface, #0d1b2a))',
          }}
        />

        {/* Brushed metal texture overlay */}
        <div
          className="absolute inset-0 opacity-[0.04] pointer-events-none"
          style={{
            backgroundImage:
              'url("data:image/svg+xml,%3Csvg width=\'100\' height=\'100\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noise\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.65\' numOctaves=\'3\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100\' height=\'100\' filter=\'url(%23noise)\' opacity=\'1\'/%3E%3C/svg%3E")',
          }}
        />

        {/* Content */}
        <div className="absolute inset-0 p-6 md:p-8 flex flex-col justify-between">
          {/* Top row */}
          <div className="flex justify-between items-start">
            <span
              className="text-[20px] tracking-widest font-bold"
              style={{
                background: 'linear-gradient(180deg, #FFFFFF 0%, #94A3B8 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                fontFamily:
                  'var(--aura-font-display, "Cormorant Garamond", Georgia, serif)',
              }}
            >
              AURA
            </span>
            <CreditCard
              className="h-7 w-7"
              style={{ color: 'rgba(212, 165, 116, 0.6)' }}
            />
          </div>

          {/* Bottom row */}
          <div className="space-y-1">
            <p
              className="text-[12px] tracking-[0.3em] uppercase font-semibold"
              style={{
                color: 'var(--aura-tertiary, #d4a574)',
                fontFamily:
                  'var(--aura-font-body, "Space Grotesk", system-ui, sans-serif)',
              }}
            >
              {profile.name.toUpperCase()}
            </p>
            <p
              className="text-[10px] uppercase tracking-wider"
              style={{
                color: 'rgba(160, 168, 176, 0.4)',
                fontFamily:
                  'var(--aura-font-body, "Space Grotesk", system-ui, sans-serif)',
              }}
            >
              {t('memberSince', { year: memberYear })}
            </p>
          </div>
        </div>

        {/* Hover rim glow */}
        <div
          className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none rounded-2xl"
          style={{
            boxShadow: 'inset 0 1px 0 0 rgba(205, 127, 50, 0.3)',
          }}
        />
      </div>
    </section>
  );
}

/* ─── Main Component ───────────────────────────────────────────────── */

export default function AccountPage() {
  const user = useAuthStore((s) => s.user);
  const {
    profile,
    orders,
    loading,
    ordersLoading,
    error,
    refetchProfile,
  } = useAccount();
  const { t } = useTranslation('account');

  /* ─── Not logged in ───────────────────────────────────────────── */
  if (!user) {
    return (
      <div className="mx-auto max-w-2xl px-[var(--aura-container-padding,24px)] pt-8 pb-24">
        <NotLoggedIn />
      </div>
    );
  }

  /* ─── Loading state ────────────────────────────────────────────── */
  if (loading) {
    return (
      <div className="mx-auto max-w-2xl px-[var(--aura-container-padding,24px)] pt-8 pb-24">
        <AccountSkeleton />
      </div>
    );
  }

  /* ─── Error state (no profile data due to error) ──────────────── */
  if (error && !profile) {
    return (
      <div className="mx-auto max-w-2xl px-[var(--aura-container-padding,24px)] pt-8 pb-24">
        <AccountError message={error} onRetry={refetchProfile} />
      </div>
    );
  }

  /* ─── Profile loaded with data ─────────────────────────────────── */
  if (!profile) {
    /* ─── Empty state (no profile after loading completed) ───────── */
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
              fontFamily:
                'var(--aura-font-body, "Space Grotesk", system-ui, sans-serif)',
            }}
          >
            {t('noData')}
          </p>
        </div>
      </div>
    );
  }

  const pointsToDisplay =
    profile.loyalty_points ?? profile.cashback_balance ?? 0;

  return (
    <div className="mx-auto max-w-2xl px-[var(--aura-container-padding,24px)] pt-8 pb-24 space-y-[var(--aura-card-gap,16px)]">
      {/* Profile Header */}
      <ProfileHeader profile={profile} />

      {/* Loyalty Section */}
      <LoyaltySection
        tier={profile.loyalty_tier}
        points={pointsToDisplay}
        lifetimePoints={profile.lifetime_points ?? pointsToDisplay}
      />

      {/* Quick Order Button */}
      <QuickOrderButton />

      {/* Recent Transactions */}
      <RecentTransactions orders={orders} />

      {/* Digital Membership Card */}
      <DigitalMembershipCard profile={profile} />
    </div>
  );
}
