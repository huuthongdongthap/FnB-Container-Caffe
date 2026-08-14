/**
 * StitchOrderSuccessNew-states — Loading, error, and empty state components
 *
 * SkeletonBlock: reusable pulse-animated placeholder.
 * OrderSuccessNewSkeleton: full-page loading skeleton layout.
 * ErrorState: error display with optional retry button.
 * EmptyState: displayed when no order data is available.
 */

'use client';

import { useTranslation } from 'react-i18next';
import { AlertCircle, RefreshCw, Receipt } from 'lucide-react';
import { cn } from '@/lib/cn';
import { glassPanelClasses } from './stitch-order-success-default';

/* ─── Loading Skeleton ───────────────────────────────────────────────────── */

function SkeletonBlock({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'animate-pulse rounded bg-[rgba(21,33,43,0.4)] backdrop-blur-xl',
        className,
      )}
    />
  );
}

export function OrderSuccessNewSkeleton() {
  return (
    <section
      aria-busy="true"
      aria-label="Loading order confirmation"
      className="min-h-screen bg-[var(--aura-surface-dim)] pt-24 pb-16"
    >
      <div className="mx-auto flex max-w-md flex-col items-center gap-8 px-5">
        {/* Wait time skeleton */}
        <SkeletonBlock className="h-48 w-full rounded-[40px]" />
        {/* Order summary skeleton */}
        <SkeletonBlock className="h-48 w-full rounded-[24px]" />
        {/* Progress bar skeleton */}
        <SkeletonBlock className="h-12 w-full rounded-[24px]" />
        {/* Button skeleton */}
        <SkeletonBlock className="h-14 w-full" />
        {/* Location card skeleton */}
        <SkeletonBlock className="h-40 w-full rounded-[24px]" />
      </div>
    </section>
  );
}

/* ─── Error State ────────────────────────────────────────────────────────── */

export function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  const { t } = useTranslation();
  return (
    <section
      className="flex min-h-screen items-center justify-center bg-[var(--aura-surface-dim)] px-5"
      role="alert"
      aria-live="assertive"
    >
      <div className="flex max-w-sm flex-col items-center gap-6 text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[color-mix(in_oklab,var(--aura-error)_10%,transparent)] border border-[color-mix(in_oklab,var(--aura-error)_30%,transparent)]">
          <AlertCircle
            className="text-[var(--aura-error)]"
            size={40}
            aria-hidden="true"
          />
        </div>
        <div>
          <h2
            className="text-2xl font-medium text-[var(--aura-chrome-bright)]"
            style={{ fontFamily: "'EB Garamond', serif" }}
          >
            {t('stitch.orderSuccessError')}
          </h2>
          <p className="mt-2 text-sm text-[var(--aura-chrome-soft)]">{message}</p>
        </div>
        {onRetry && (
          <button
            onClick={onRetry}
            className="flex items-center gap-2 rounded-full bg-gradient-to-r from-[var(--aura-chrome-soft)] via-[var(--aura-chrome-dim)] to-[var(--aura-chrome-dim)] px-8 py-3 text-xs font-bold uppercase tracking-[0.2em] text-[var(--aura-chrome-bright)] shadow-xl transition-all hover:brightness-110 active:scale-95"
            aria-label={t('stitch.orderSuccessRetry')}
          >
            <RefreshCw className="text-sm" aria-hidden="true" />
            {t('stitch.orderSuccessRetry')}
          </button>
        )}
      </div>
    </section>
  );
}

/* ─── Empty State ────────────────────────────────────────────────────────── */

export function EmptyState() {
  const { t } = useTranslation();
  return (
    <section
      className="flex min-h-screen items-center justify-center bg-[var(--aura-surface-dim)] px-5"
      role="status"
      aria-label={t('stitch.orderSuccessNotFound')}
    >
      <div className="flex max-w-sm flex-col items-center gap-6 text-center">
        <div
          className={cn(
            'flex h-20 w-20 items-center justify-center rounded-full',
            glassPanelClasses,
          )}
        >
          <Receipt className="text-[var(--aura-chrome-soft)]" size={40} aria-hidden="true" />
        </div>
        <div>
          <h2
            className="text-2xl font-medium text-[var(--aura-chrome-bright)]"
            style={{ fontFamily: "'EB Garamond', serif" }}
          >
            {t('stitch.orderSuccessNotFound')}
          </h2>
          <p className="mt-2 text-sm text-[var(--aura-chrome-soft)]">
            {t('stitch.orderSuccessNotFoundDesc')}
          </p>
        </div>
      </div>
    </section>
  );
}
