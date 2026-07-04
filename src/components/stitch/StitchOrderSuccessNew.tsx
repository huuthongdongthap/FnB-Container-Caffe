/**
 * StitchOrderSuccessNew — Order success confirmation screen for AURA CAFE
 *
 * Dark navy glassmorphism confirmation with wait time display, order summary,
 * progress tracker, and location card.
 *
 * Source: Stitch AI aura_cafe_order_success_confirmation export.
 *
 * Design tokens (inlined via Tailwind, matching original Stitch HTML):
 *   - Background: #09141e (--void / bg-background)
 *   - Primary (bronze text): #f2bb98 (--primary)
 *   - Primary-container (bronze fill): #c49271 (--primary-bronze)
 *   - Chrome/silver: #a1a1aa (--chrome)
 *   - On-surface: #d8e4f2
 *   - On-surface-variant: #d5c3b9
 *   - Glass: rgba(21,33,43,0.4) backdrop-blur-xl border rgba(161,161,170,0.2)
 *   - Display font: EB Garamond
 *   - Body font: Space Grotesk
 *
 * Features:
 *   - Wait time display with "Preparing your brew" live badge
 *   - Order summary glass card (order ID, items, total)
 *   - 3-step progress tracker (Received -> Preparing -> Ready)
 *   - "Track Order" chrome gradient CTA
 *   - Location card with cover image
 *   - Loading / error / empty states
 *   - Mobile-first responsive
 */
'use client';

import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/cn';

/* ─── Types ────────────────────────────────────────────────────────────────── */

export interface OrderSuccessNewItem {
  id: string;
  name: string;
  quantity: number;
  price: number;
}

export interface OrderSuccessNewData {
  orderId: string;
  items: OrderSuccessNewItem[];
  total: number;
  estimatedMinutes: number;
  locationName: string;
  locationImageUrl?: string;
  customerName?: string;
  table?: string;
}

export interface StitchOrderSuccessNewProps {
  order: OrderSuccessNewData | null;
  isLoading?: boolean;
  error?: string | null;
  locale?: string;
  currency?: 'VND' | 'USD';
  onTrackOrder?: () => void;
  onBack?: () => void;
  onAccount?: () => void;
  onRefresh?: () => void;
}

/* ─── Constants ────────────────────────────────────────────────────────────── */

const STATUS_STEPS = ['received', 'preparing', 'ready'] as const;

const PROGRESS_PERCENT = 50; // Matches HTML design: Received + Preparing active

/* ─── Glass panel style class (matches original HTML glass-card) ───────────── */

const glassPanelClasses =
  'bg-[rgba(21,33,43,0.4)] backdrop-blur-xl border border-[rgba(161,161,170,0.2)]';

/* ─── Price formatting ─────────────────────────────────────────────────────── */

function formatPrice(amount: number, localeStr: string, currencyType: 'VND' | 'USD'): string {
  const isVietnamese = localeStr === 'vi' || localeStr.startsWith('vi');
  const cur = currencyType || (isVietnamese ? 'VND' : 'USD');
  return new Intl.NumberFormat(cur === 'VND' ? 'vi-VN' : 'en-US', {
    style: 'currency',
    currency: cur,
    minimumFractionDigits: cur === 'VND' ? 0 : 2,
  }).format(amount);
}

/* ─── Loading Skeleton ─────────────────────────────────────────────────────── */

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

function OrderSuccessNewSkeleton() {
  return (
    <section
      aria-busy="true"
      aria-label="Loading order confirmation"
      className="min-h-screen bg-[#09141e] pt-24 pb-16"
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

/* ─── Error State ──────────────────────────────────────────────────────────── */

function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const { t } = useTranslation();
  return (
    <section
      className="flex min-h-screen items-center justify-center bg-[#09141e] px-5"
      role="alert"
      aria-live="assertive"
    >
      <div className="flex max-w-sm flex-col items-center gap-6 text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[#ffb4ab]/10 border border-[#ffb4ab]/30">
          <span className="material-symbols-outlined text-[40px] text-[#ffb4ab]" aria-hidden="true">
            error_outline
          </span>
        </div>
        <div>
          <h2 className="font-display text-2xl font-medium text-[#d8e4f2]">
            {t('stitch.orderSuccessError')}
          </h2>
          <p className="mt-2 text-sm text-[#d5c3b9]">{message}</p>
        </div>
        {onRetry && (
          <button
            onClick={onRetry}
            className="flex items-center gap-2 rounded-full bg-gradient-to-r from-[#d4d4d8] via-[#a1a1aa] to-[#8e9097] px-8 py-3 text-xs font-bold uppercase tracking-[0.2em] text-[#09141e] shadow-xl transition-all hover:brightness-110 active:scale-95"
            aria-label={t('stitch.orderSuccessRetry')}
          >
            <span className="material-symbols-outlined text-sm" aria-hidden="true">
              refresh
            </span>
            {t('stitch.orderSuccessRetry')}
          </button>
        )}
      </div>
    </section>
  );
}

/* ─── Empty State ──────────────────────────────────────────────────────────── */

function EmptyState() {
  const { t } = useTranslation();
  return (
    <section
      className="flex min-h-screen items-center justify-center bg-[#09141e] px-5"
      role="status"
      aria-label={t('stitch.orderSuccessNotFound')}
    >
      <div className="flex max-w-sm flex-col items-center gap-6 text-center">
        <div className={cn('flex h-20 w-20 items-center justify-center rounded-full', glassPanelClasses)}>
          <span className="material-symbols-outlined text-[40px] text-[#d5c3b9]" aria-hidden="true">
            receipt_long
          </span>
        </div>
        <div>
          <h2 className="font-display text-2xl font-medium text-[#d8e4f2]">
            {t('stitch.orderSuccessNotFound')}
          </h2>
          <p className="mt-2 text-sm text-[#d5c3b9]">
            {t('stitch.orderSuccessNotFoundDesc')}
          </p>
        </div>
      </div>
    </section>
  );
}

/* ─── Shine animation keyframes (CSS-in-JS) ────────────────────────────────── */

const shineKeyframes = `
@keyframes shine {
  0% { transform: translateX(-100%) translateY(-100%); }
  100% { transform: translateX(100%) translateY(100%); }
}
@keyframes pulse-bronze {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.6; transform: scale(1.05); }
}
`;

/* ─── Sub-components ────────────────────────────────────────────────────────── */

interface WaitTimeDisplayProps {
  estimatedMinutes: number;
}

function WaitTimeDisplay({ estimatedMinutes }: WaitTimeDisplayProps) {
  const { t } = useTranslation();
  return (
    <div className="relative w-full overflow-hidden rounded-[40px] flex flex-col items-center justify-center aspect-square">
      {/* Background glow (matching HTML body bg) */}
      <div
        className="absolute inset-0 opacity-30"
        style={{
          background:
            'radial-gradient(ellipse at 50% 50%, rgba(242,187,152,0.15) 0%, transparent 70%)',
        }}
        aria-hidden="true"
      />

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center gap-2 text-center">
        <span className="text-[12px] leading-none font-bold uppercase tracking-[0.2em] text-[#f2bb98]">
          {t('stitch.orderSuccessNewEstimatedWait', { defaultValue: 'ESTIMATED WAIT' })}
        </span>

        <div className="flex items-baseline justify-center">
          <span
            className="text-[84px] leading-none text-[#d8e4f2]"
            style={{ fontFamily: "var(--aura-font-display-serif, 'EB Garamond', serif)" }}
          >
            {estimatedMinutes}
          </span>
          <span className="ml-2 text-2xl font-medium uppercase tracking-widest text-[#f2bb98]">
            {t('stitch.orderSuccessNewMin', { defaultValue: 'min' })}
          </span>
        </div>

        {/* Live status badge */}
        <div className="mt-2 inline-flex items-center gap-2 self-center rounded-full border border-[#f2bb98]/30 bg-[#f2bb98]/10 px-4 py-1.5">
          <div className="h-2 w-2 rounded-full bg-[#c49271] animate-[pulse-bronze_2s_cubic-bezier(0.4,0,0.6,1)_infinite]" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-[#f2bb98]">
            {t('stitch.orderSuccessNewPreparingBrew', { defaultValue: 'PREPARING YOUR BREW' })}
          </span>
        </div>
      </div>
    </div>
  );
}

interface OrderSummaryCardProps {
  orderId: string;
  items: OrderSuccessNewItem[];
  total: number;
  formatFn: (amount: number) => string;
}

function OrderSummaryCard({ orderId, items, total, formatFn }: OrderSummaryCardProps) {
  const { t } = useTranslation();

  return (
    <div
      className={cn('w-full rounded-[24px] p-4 flex flex-col gap-4', glassPanelClasses)}
      role="region"
      aria-label={t('stitch.orderSummary')}
    >
      {/* Header: Order ID + Total */}
      <div className="flex items-center justify-between border-b border-white/5 pb-3">
        <span className="text-[12px] leading-none font-bold uppercase tracking-[0.1em] text-[#d5c3b9]">
          {t('stitch.orderSuccessId', { defaultValue: 'ORDER' })} #{orderId}
        </span>
        <span
          className="text-2xl text-[#f2bb98]"
          style={{ fontFamily: "var(--aura-font-display-serif, 'EB Garamond', serif)" }}
          aria-label={`${t('stitch.orderSuccessTotal')}: ${formatFn(total)}`}
        >
          {formatFn(total)}
        </span>
      </div>

      {/* Items list */}
      <div className="flex flex-col gap-2" role="list" aria-label={t('stitch.selectedItems')}>
        {items.length === 0 ? (
          <p className="text-center text-sm text-[#d5c3b9]">
            {t('stitch.orderSuccessEmptyItems')}
          </p>
        ) : (
          items.map((item) => (
            <div key={item.id} className="flex items-center justify-between" role="listitem">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-[#f2bb98]">{item.quantity}x</span>
                <span className="font-body text-sm text-[#d8e4f2]">
                  {item.name}
                </span>
              </div>
              <span className="text-sm italic text-[#d5c3b9]"
                style={{ fontFamily: "var(--aura-font-display-serif, 'EB Garamond', serif)" }}>
                {formatFn(item.price)}
              </span>
            </div>
          ))
        )}
      </div>

      {/* Divider between items and progress */}
      <div className="w-full h-px bg-white/5 my-1" />

      {/* Progress tracker (3 steps: Received -> Preparing -> Ready) */}
      <div className="flex flex-col gap-4 pt-2">
        <div className="relative h-[2px] w-full bg-white/10">
          {/* Active progress fill */}
          <div
            className="absolute h-full bg-[#c49271] transition-all duration-700"
            style={{ width: `${PROGRESS_PERCENT}%` }}
          />

          {/* Step dots */}
          <div className="absolute left-0 top-1/2 flex w-full -translate-y-1/2 justify-between">
            {STATUS_STEPS.map((step, idx) => {
              const isCompleted = idx === 0; // Only "Received" is fully completed
              const isActive = idx === 1;    // "Preparing" is current/active (pulsing, no check)
              const isPending = idx === 2;   // "Ready" is pending (no fill)

              return (
                <div
                  key={step}
                  className={cn(
                    'flex h-4 w-4 items-center justify-center rounded-full ring-4 ring-[#09141e] border-2 transition-all',
                    (isCompleted || isActive) && 'bg-[#c49271]',
                    isCompleted && 'border-white/20',
                    isActive && 'border-white/20 animate-[pulse-bronze_2s_cubic-bezier(0.4,0,0.6,1)_infinite]',
                    isPending && 'border-white/10',
                  )}
                  role="img"
                  aria-label={`Step ${idx + 1}: ${step}`}
                >
                  {isCompleted && (
                    <span
                      className="material-symbols-outlined text-[8px] text-[#09141e]"
                      style={{ fontVariationSettings: "'FILL' 1" }}
                      aria-hidden="true"
                    >
                      check
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Step labels */}
        <div className="flex w-full justify-between px-1">
          <span className="text-[10px] uppercase text-[#f2bb98]">
            {t('stitch.orderSuccessStatusReceived', { defaultValue: 'RECEIVED' })}
          </span>
          <span className="text-[10px] uppercase text-[#d8e4f2]">
            {t('stitch.orderSuccessStatusPreparing', { defaultValue: 'PREPARING' })}
          </span>
          <span className="text-[10px] uppercase text-[#d5c3b9]">
            {t('stitch.orderSuccessStatusReady', { defaultValue: 'READY' })}
          </span>
        </div>
      </div>
    </div>
  );
}

interface ChromeButtonProps {
  onClick?: () => void;
  label: string;
  ariaLabel?: string;
}

function ChromeButton({ onClick, label, ariaLabel }: ChromeButtonProps) {
  return (
    <button
      onClick={onClick}
      className="relative w-full overflow-hidden py-4 text-center text-[12px] leading-none font-bold uppercase tracking-[0.2em] text-[#09141e] shadow-[0_10px_30px_rgba(196,146,113,0.1)] transition-transform active:scale-[0.98] rounded-none"
      style={{
        background: 'linear-gradient(180deg, #d4d4d8 0%, #a1a1aa 100%)',
      }}
      aria-label={ariaLabel ?? label}
    >
      {/* Shine animation overlay */}
      <span
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'linear-gradient(45deg, transparent 45%, rgba(255,255,255,0.4) 50%, transparent 55%)',
          animation: 'shine 4s infinite',
        }}
        aria-hidden="true"
      />
      <span className="relative z-10">{label}</span>
    </button>
  );
}

interface LocationCardProps {
  locationName: string;
  imageUrl?: string;
}

function LocationCard({ locationName, imageUrl }: LocationCardProps) {
  const { t } = useTranslation();
  const defaultImage =
    'https://lh3.googleusercontent.com/aida-public/AB6AXuB90p-HQ3qdJbW1M_x492UqW3HLs03n6XsrLpvu0QVEMyWAfjJXfgdukv-IePi8OLn_Qk9sRXhCB6TWZxQjiHd7x9Q-zKzEv3dC2jWN-rAGGQG1RdY0ZqNz8O3uN0qzYCM0SzE8jsiY0fnJpqyKmnBwU-X8AabgCNah__hRLDyWmhZiERlXaxI9lHVuvx09XcBxXH5agT7CFRnKpMCN0BX-7MEbyZ5crFzbW59kesuIm7l2ve_cVVnwUvWu9O6OVeVE7SMuo6ycupg';

  return (
    <div
      className={cn(
        'group relative w-full h-40 cursor-pointer overflow-hidden rounded-[24px] transition-all duration-500',
        glassPanelClasses,
        'hover:border-[#f2bb98]/40',
      )}
      role="region"
      aria-label={`${t('stitch.orderSuccessNewLocation')}: ${locationName}`}
    >
      {/* Background image */}
      <div
        className="absolute inset-0 bg-cover bg-center transition-transform duration-1000 group-hover:scale-110"
        style={{ backgroundImage: `url('${imageUrl || defaultImage}')` }}
        role="img"
        aria-label={locationName}
      />

      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-[#09141e] to-transparent opacity-80" />

      {/* Location label */}
      <div className="absolute bottom-4 left-4 flex flex-col z-10">
        <span className="text-[10px] font-bold uppercase tracking-widest text-[#f2bb98]">
          {t('stitch.orderSuccessNewLocation', { defaultValue: 'LOCATION' })}
        </span>
        <span className="text-2xl font-medium text-[#d8e4f2]">
          {locationName}
        </span>
      </div>

      {/* Map icon */}
      <div className="absolute right-4 top-4 z-10 rounded-full border border-white/10 bg-[#09141e]/60 p-2 backdrop-blur-md">
        <span className="material-symbols-outlined text-lg text-[#f2bb98]" aria-hidden="true">
          map
        </span>
      </div>
    </div>
  );
}

/* ─── Main Component ───────────────────────────────────────────────────────── */

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
  const fmt = (amount: number) => formatPrice(amount, locale, effectiveCurrency);

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
    <div className="min-h-screen bg-[#09141e] font-body">
      {/* Shine animation keyframes */}
      <style>{shineKeyframes}</style>

      {/* ═══════════ HEADER ════════════════════════════════════════════ */}
      <header
        className="fixed top-0 left-0 z-50 flex h-16 w-full items-center justify-between border-b border-white/10 bg-[#09141e]/80 px-5 backdrop-blur-xl"
        role="banner"
      >
        <button
          onClick={onBack}
          className="text-[#f2bb98] transition-opacity hover:opacity-80 active:scale-95"
          aria-label={t('stitch.orderSuccessNewBack')}
        >
          <span className="material-symbols-outlined" aria-hidden="true">
            arrow_back
          </span>
        </button>

        <h1
          className="text-2xl tracking-tight text-[#f2bb98]"
          style={{ fontFamily: "var(--aura-font-display-serif, 'EB Garamond', serif)" }}
        >
          AURA CAFE
        </h1>

        <button
          onClick={onAccount}
          className="text-[#f2bb98] transition-opacity hover:opacity-80 active:scale-95"
          aria-label={t('stitch.orderSuccessNewAccount')}
        >
          <span className="material-symbols-outlined" aria-hidden="true">
            account_circle
          </span>
        </button>
      </header>

      {/* ═══════════ MAIN CONTENT ═════════════════════════════════════ */}
      <main className="mx-auto flex w-full max-w-md flex-col items-center gap-8 px-5 pb-8 pt-24">
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
          label={t('stitch.orderSuccessNewTrackOrder', { defaultValue: 'TRACK ORDER' })}
          ariaLabel={t('stitch.orderSuccessNewTrackOrder', { defaultValue: 'TRACK ORDER' })}
        />

        {/* Location card */}
        <LocationCard
          locationName={order.locationName}
          imageUrl={order.locationImageUrl}
        />
      </main>

      {/* ═══════════ FOOTER ════════════════════════════════════════════ */}
      <footer
        className="flex w-full flex-col items-center gap-2 border-t border-white/5 px-5 py-6"
        role="contentinfo"
      >
        <nav className="flex gap-4" aria-label={t('footer.footerAriaLabel')}>
          <a
            href="#"
            className="text-[12px] leading-none font-bold uppercase tracking-[0.1em] text-[#d5c3b9] transition-colors hover:text-[#f2bb98]"
          >
            {t('stitch.orderSuccessNewSupport', { defaultValue: 'SUPPORT' })}
          </a>
          <a
            href="#"
            className="text-[12px] leading-none font-bold uppercase tracking-[0.1em] text-[#d5c3b9] transition-colors hover:text-[#f2bb98]"
          >
            {t('footer.footerPrivacy', { defaultValue: 'PRIVACY POLICY' })}
          </a>
          <a
            href="#"
            className="text-[12px] leading-none font-bold uppercase tracking-[0.1em] text-[#d5c3b9] transition-colors hover:text-[#f2bb98]"
          >
            {t('footer.footerTerms', { defaultValue: 'TERMS' })}
          </a>
        </nav>
        <p className="text-[10px] font-bold uppercase tracking-widest text-[#d5c3b9] opacity-40">
          {t('footer.copyright', { defaultValue: '© {{year}} AURA CAFE. ALL RIGHTS RESERVED.', year: 2024 })}
        </p>
      </footer>
    </div>
  );
}
