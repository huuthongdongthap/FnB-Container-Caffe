/**
 * StitchOrderSuccessNew-summary — Order summary card and chrome button
 *
 * OrderSummaryCard: glass card with items list and 3-step progress tracker.
 * ChromeButton: gradient button with shine animation overlay.
 */

'use client';

import { useTranslation } from 'react-i18next';
import { Check, Sparkles, Wallet } from 'lucide-react';
import { cn } from '@/lib/cn';
import type { OrderSuccessNewItem } from './StitchOrderSuccessNew-types';
import { PROGRESS_PERCENT, STATUS_STEPS } from './StitchOrderSuccessNew-types';
import { glassPanelClasses } from './stitch-order-success-default';

/* ─── Order Summary Glass Card ───────────────────────────────────────────── */

interface OrderSummaryCardProps {
  orderId: string;
  items: OrderSuccessNewItem[];
  total: number;
  formatFn: (amount: number) => string;
  pointsEarned?: number;
  cashbackEarned?: number;
}

export function OrderSummaryCard({
  orderId,
  items,
  total,
  formatFn,
  pointsEarned,
  cashbackEarned,
}: OrderSummaryCardProps) {
  const { t } = useTranslation();

  return (
    <div
      className={cn(
        'w-full rounded-[24px] p-4 flex flex-col gap-4',
        glassPanelClasses,
      )}
      role="region"
      aria-label={t('stitch.orderSummary')}
    >
      {/* Header: Order ID + Total */}
      <div className="flex justify-between items-center border-b border-white/5 pb-2">
        <span className="text-[12px] leading-none font-bold uppercase tracking-[0.1em] text-[var(--aura-chrome-soft)]">
          {t('stitch.orderSuccessId', { defaultValue: 'ORDER' })} #
          {orderId}
        </span>
        <span
          className="text-2xl text-[var(--aura-chrome-bright)]"
          style={{ fontFamily: "var(--aura-font-display)" }}
          aria-label={`${t('stitch.orderSuccessTotal')}: ${formatFn(total)}`}
        >
          {formatFn(total)}
        </span>
      </div>

      {/* Items list */}
      <div
        className="flex flex-col gap-2"
        role="list"
        aria-label={t('stitch.selectedItems')}
      >
        {items.length === 0 ? (
          <p className="text-center text-sm text-[var(--aura-chrome-soft)]">
            {t('stitch.orderSuccessEmptyItems')}
          </p>
        ) : (
          items.map((item) => (
            <div
              key={item.id}
              className="flex justify-between items-center"
              role="listitem"
            >
              <div className="flex gap-2 items-center">
                <span className="text-[var(--aura-chrome-bright)] font-bold">
                  {item.quantity}x
                </span>
                <span className="text-sm text-[var(--aura-chrome-bright)]">{item.name}</span>
              </div>
              <span
                className="text-sm italic text-[var(--aura-chrome-soft)]"
                style={{ fontFamily: "var(--aura-font-display)" }}
              >
                {formatFn(item.price)}
              </span>
            </div>
          ))
        )}
      </div>

      {/* Divider between items and progress */}
      <div className="w-full h-px bg-white/5 my-1" />

      {/* Loyalty earnings — points + cashback credited for this order */}
      {(pointsEarned ?? 0) > 0 || (cashbackEarned ?? 0) > 0 ? (
        <div
          className="flex flex-wrap gap-2"
          data-testid="loyalty-earnings"
        >
          {(pointsEarned ?? 0) > 0 && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-[rgba(var(--aura-chrome-light),0.4)] bg-[rgba(var(--aura-chrome-light),0.12)] text-[11px] font-semibold text-[var(--aura-chrome-bright)]">
              <Sparkles size={12} aria-hidden="true" />
              +{pointsEarned?.toLocaleString('vi-VN')} {t('stitch.loyaltyPointsEarned', { defaultValue: 'điểm' })}
            </span>
          )}
          {(cashbackEarned ?? 0) > 0 && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-white/[0.12] bg-white/[0.04] text-[11px] font-semibold text-[var(--aura-chrome-soft)]">
              <Wallet size={12} aria-hidden="true" />
              +{formatFn(cashbackEarned ?? 0)} {t('stitch.loyaltyCashbackEarned', { defaultValue: 'Ví Aura' })}
            </span>
          )}
        </div>
      ) : null}

      {/* Progress tracker (3 steps: Received -> Preparing -> Ready) */}
      <div className="flex flex-col gap-4 pt-2">
        {/* Progress track line */}
        <div className="relative w-full h-[2px] bg-white/10">
          {/* Active progress fill */}
          <div
            className="absolute h-full bg-[var(--aura-chrome-bright)] transition-all duration-700"
            style={{ width: `${PROGRESS_PERCENT}%` }}
          />

          {/* Step dots */}
          <div className="absolute top-1/2 left-0 -translate-y-1/2 flex justify-between w-full">
            {STATUS_STEPS.map((step, idx) => {
              const isCompleted = idx === 0;
              const isActive = idx === 1;
              const isPending = idx === 2;

              return (
                <div
                  key={step}
                  className={cn(
                    'w-4 h-4 rounded-full ring-4 ring-[var(--aura-surface-dim)] border-2 transition-all',
                    isCompleted &&
                      'bg-[var(--aura-chrome-bright)] border-white/20 flex items-center justify-center',
                    isActive &&
                      'bg-[var(--aura-chrome-mid, #6B9FB8)] border-white/20 animate-[pulse-bronze_2s_cubic-bezier(0.4,0,0.6,1)_infinite]',
                    isPending && 'bg-white/5 border-white/10',
                  )}
                  role="img"
                  aria-label={`Step ${idx + 1}: ${step}`}
                >
                  {isCompleted && (
                    <Check
                      size={8}
                      className="text-[var(--aura-noir-deep)]"
                      style={{ strokeWidth: 3 }}
                      aria-hidden="true"
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Step labels */}
        <div className="flex justify-between w-full px-1">
          <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--aura-chrome-mid, #6B9FB8)]">
            {t('stitch.orderSuccessStatusReceived', {
              defaultValue: 'RECEIVED',
            })}
          </span>
          <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--aura-chrome-mid, #6B9FB8)]">
            {t('stitch.orderSuccessStatusPreparing', {
              defaultValue: 'PREPARING',
            })}
          </span>
          <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--aura-chrome-soft)]">
            {t('stitch.orderSuccessStatusReady', {
              defaultValue: 'READY',
            })}
          </span>
        </div>
      </div>
    </div>
  );
}

/* ─── Chrome Gradient Button ─────────────────────────────────────────────── */

interface ChromeButtonProps {
  onClick?: () => void;
  label: string;
  ariaLabel?: string;
}

export function ChromeButton({ onClick, label, ariaLabel }: ChromeButtonProps) {
  return (
    <button type="button"
      onClick={onClick}
      className="relative w-full overflow-hidden py-4 text-center text-[12px] leading-none font-bold uppercase tracking-[0.2em] text-[var(--aura-chrome-bright)] shadow-[0_10px_30px_rgba(196,146,113,0.1)] transition-transform active:scale-[0.98] rounded-none"
      style={{
        background: 'linear-gradient(180deg, var(--aura-chrome-light, #C9D6DF) 0%, var(--aura-text-muted, #a1a1aa) 100%)',
      }}
      aria-label={ariaLabel ?? label}
    >
      {/* Shine animation overlay (matching HTML chrome-button::after) */}
      <span
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'linear-gradient(45deg, transparent 45%, rgba(var(--aura-glass-bg),0.4) 50%, transparent 55%)',
          animation: 'shine 4s infinite',
        }}
        aria-hidden="true"
      />
      <span className="relative z-10">{label}</span>
    </button>
  );
}
