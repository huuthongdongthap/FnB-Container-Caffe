/**
 * StitchOrderSuccessNew — Order success confirmation screen for AURA CAFE
 *
 * Regenerated from the original Stitch HTML export to match pixel-for-pixel:
 *   /tmp/stitch_original/stitch_aura_cafe/aura_cafe_order_success_confirmation/code.html
 *
 * Design tokens (inlined via Tailwind, matching original Stitch HTML config):
 *   primary (bronze): #f2bb98
 *   primary-container: #c49271
 *   chrome: #a1a1aa
 *   background (void): #09141e
 *   on-surface: #d8e4f2
 *   on-surface-variant: #d5c3b9
 *   glass: rgba(21,33,43,0.4) backdrop-blur-xl border rgba(161,161,170,0.2)
 *   Display font: 'EB Garamond', serif
 *   Body font: 'Space Grotesk', sans-serif
 */
'use client';

import { useTranslation } from 'react-i18next';
import { ArrowLeft, UserCircle } from 'lucide-react';

/* ─── Re-exports for external consumers ──────────────────────────────────── */
export type {
  OrderSuccessNewItem,
  OrderSuccessNewData,
  StitchOrderSuccessNewProps,
} from './StitchOrderSuccessNew-types';

/* ─── Sub-components ─────────────────────────────────────────────────────── */
import { ShaderBackground } from './StitchOrderSuccessNew-confetti';
import { WaitTimeDisplay } from './StitchOrderSuccessNew-tracking';
import {
  OrderSummaryCard,
  ChromeButton,
} from './StitchOrderSuccessNew-summary';
import { LocationCard } from './StitchOrderSuccessNew-location';
import { OrderSuccessNewFooter } from './StitchOrderSuccessNew-footer';
import {
  OrderSuccessNewSkeleton,
  ErrorState,
  EmptyState,
} from './StitchOrderSuccessNew-states';

/* ─── Hooks & utils ──────────────────────────────────────────────────────── */
import { useStitchOrderSuccess } from './use-stitch-order-success';
import { shineKeyframes } from './stitch-order-success-default';
import { formatPrice } from './stitch-order-success-default';
import type { StitchOrderSuccessNewProps } from './StitchOrderSuccessNew-types';

/* ─── Main Component ─────────────────────────────────────────────────────── */

export function StitchOrderSuccessNew({
  order,
  isLoading = false,
  error = null,
  locale = 'vi',
  currency,
  onTrackOrder,
  onBack,
  onAccount,
  onRefresh,
}: Readonly<StitchOrderSuccessNewProps>) {
  const { t } = useTranslation();
  const isVietnamese = locale === 'vi' || locale.startsWith('vi');
  const effectiveCurrency = currency ?? (isVietnamese ? 'VND' : 'USD');
  const fmt = (amount: number) =>
    formatPrice(amount, locale, effectiveCurrency);

  /* ── Status badge flash effect ──────────────────────────────────────── */
  useStitchOrderSuccess();

  /* ── Loading ────────────────────────────────────────────────────────── */
  if (isLoading) {
    return <OrderSuccessNewSkeleton />;
  }

  /* ── Error ──────────────────────────────────────────────────────────── */
  if (error) {
    return <ErrorState message={error} onRetry={onRefresh} />;
  }

  /* ── Empty ──────────────────────────────────────────────────────────── */
  if (!order) {
    return <EmptyState />;
  }

  /* ── Render ─────────────────────────────────────────────────────────── */
  return (
    <div className="min-h-screen bg-[var(--aura-surface-dim)] flex flex-col items-center font-body antialiased">
      {/* Animation keyframes */}
      <style>{shineKeyframes}</style>

      {/* WebGL shader background nebula (matching HTML ANIMATION_63) */}
      <ShaderBackground />

      {/* ═══════════ HEADER ════════════════════════════════════════════ */}
      <header className="fixed top-0 w-full z-50 bg-[color-mix(in_oklab,var(--aura-surface-dim)_80%,transparent)] backdrop-blur-xl border-b border-white/10 flex justify-between items-center px-5 h-16">
        <button
          onClick={onBack}
          className="text-[var(--aura-chrome-bright)] hover:opacity-80 transition-opacity active:scale-95 transition-transform duration-200"
          aria-label={t('stitch.orderSuccessNewBack')}
        >
          <ArrowLeft aria-hidden="true" />
        </button>

        <h1
          className="text-2xl tracking-tight text-[var(--aura-chrome-bright)]"
          style={{ fontFamily: "'EB Garamond', serif" }}
        >
          AURA CAFE
        </h1>

        <button
          onClick={onAccount}
          className="text-[var(--aura-chrome-bright)] hover:opacity-80 transition-opacity active:scale-95 transition-transform duration-200"
          aria-label={t('stitch.orderSuccessNewAccount')}
        >
          <UserCircle aria-hidden="true" />
        </button>
      </header>

      {/* ═══════════ MAIN CONTENT ═════════════════════════════════════ */}
      <main className="w-full max-w-md px-5 pt-24 pb-8 flex flex-col gap-8 items-center">
        {/* Wait time display */}
        <WaitTimeDisplay estimatedMinutes={order.estimatedMinutes} />

        {/* Order summary glass card */}
        <OrderSummaryCard
          orderId={order.orderId}
          items={order.items}
          total={order.total}
          formatFn={fmt}
        />

        {/* Track Order CTA */}
        <ChromeButton
          onClick={onTrackOrder}
          label={t('stitch.orderSuccessNewTrackOrder', {
            defaultValue: 'TRACK ORDER',
          })}
          ariaLabel={t('stitch.orderSuccessNewTrackOrder', {
            defaultValue: 'TRACK ORDER',
          })}
        />

        {/* Location card */}
        <LocationCard
          locationName={order.locationName}
          imageUrl={order.locationImageUrl}
        />
      </main>

      {/* ═══════════ FOOTER ════════════════════════════════════════════ */}
      <OrderSuccessNewFooter />
    </div>
  );
}
