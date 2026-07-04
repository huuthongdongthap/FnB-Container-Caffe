/**
 * StitchOrderSuccess — Order success/confirmation screen for AURA CAFE
 *
 * Dark navy glassmorphism confirmation with animated status tracker.
 * Source: Stitch AI order-success export.
 *
 * Features:
 * - Full-screen dark gradient background (nocturnal nebula aesthetic)
 * - Animated checkmark on order confirmation
 * - Glass card with order summary (items, total, order ID)
 * - Status tracker: Received -> Preparing -> Ready -> Served
 * - Wait time countdown with live elapsed/fixed ETA
 * - Mobile-first responsive layout
 * - Loading / error / empty states
 */
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { clsx } from 'clsx';
import {
  CheckCircle2,
  Clock,
  Package,
  ShoppingBag,
  ChefHat,
  Beer,
  Loader2,
  AlertCircle,
  RefreshCw,
  MapPin,
  Phone,
  User,
  FileText,
} from 'lucide-react';
import { cn } from '@/lib/cn';

/* ─── Types ─────────────────────────────────────────────────────────┘ */

export type OrderStatus = 'received' | 'preparing' | 'ready' | 'served';

export interface OrderSuccessItem {
  id: string;
  name: string;
  variant: string;
  quantity: number;
  price: number;
}

export interface OrderSuccessData {
  orderId: string;
  customerName: string;
  phone?: string;
  notes?: string;
  table?: string;
  items: OrderSuccessItem[];
  subtotal: number;
  tax: number;
  taxLabel?: string;
  total: number;
  estimatedMinutes: number;      // total estimated wait time
  currentStatus: OrderStatus;
  statusUpdatedAt?: string;       // ISO timestamp
  placedAt?: string;              // ISO timestamp
}

export interface StitchOrderSuccessProps {
  order: OrderSuccessData | null;
  isLoading?: boolean;
  error?: string | null;
  locale?: string;
  currency?: 'VND' | 'USD';
  onViewOrders?: () => void;
  onNewOrder?: () => void;
  onRefresh?: () => void;
}

/* ─── Token Helpers (matches StitchCheckout pattern) ───────────────── */

const token = (name: string) => `var(${name})`;

const aura = {
  bgVoid:          token('--aura-bg-void'),
  bgPage:          token('--aura-bg-page'),
  bgGlass:         token('--aura-glass-bg'),
  bgGlassHover:    token('--aura-glass-hover-bg'),
  bgInput:         token('--aura-bg-input'),
  textPrimary:     token('--aura-text-primary'),
  textSecondary:   token('--aura-text-secondary'),
  textDisabled:    token('--aura-text-disabled'),
  primary:         token('--aura-primary'),
  tertiary:        token('--aura-tertiary'),
  secondary:       token('--aura-secondary'),
  glassBorder:     token('--aura-glass-border'),
  borderHover:     token('--aura-border-hover'),
  borderFocus:     token('--aura-border-focus'),
  borderSubtle:    token('--aura-border-subtle'),
  outline:         token('--aura-outline'),
  glassBlur:       token('--aura-glass-blur'),
  shadowLg:        token('--aura-shadow-lg'),
  shadowGlow:      token('--aura-shadow-glow'),
  success:         token('--aura-success'),
  error:           token('--aura-error'),
  fontDisplay:     token('--aura-font-display'),
  fontBody:        token('--aura-font-body'),
  fontMono:        token('--aura-font-mono'),
  radiusSm:        token('--aura-radius-sm'),
  radiusMd:        token('--aura-radius-md'),
  radiusLg:        token('--aura-radius-lg'),
  radiusXl:        token('--aura-radius-xl'),
  radius2xl:       token('--aura-radius-2xl'),
  radiusFull:      token('--aura-radius-full'),
  containerPad:    token('--aura-container-padding'),
  maxWidth:        token('--aura-max-width'),
};

/* ─── Glass panel preset ──────────────────────────────────────────── */

const glassPanel: React.CSSProperties = {
  background: aura.bgGlass,
  backdropFilter: `blur(${aura.glassBlur})`,
  WebkitBackdropFilter: `blur(${aura.glassBlur})`,
  border: `1px solid ${aura.glassBorder}`,
};

/* ─── Status Tracker numeric order ────────────────────────────────── */

const STATUS_ORDER: Record<OrderStatus, number> = {
  received:  0,
  preparing: 1,
  ready:     2,
  served:    3,
};

/* ─── Timer hook ──────────────────────────────────────────────────── */

function useCountdown(estimatedMinutes: number, placedAt?: string) {
  const [remainingSeconds, setRemainingSeconds] = useState<number>(estimatedMinutes * 60);
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    let baseElapsed = 0;
    if (placedAt) {
      const placed = new Date(placedAt).getTime();
      baseElapsed = Math.floor((Date.now() - placed) / 1000);
    }

    const timer = setInterval(() => {
      const now = Date.now();
      const placedTime = placedAt ? new Date(placedAt).getTime() : now;
      const secsSincePlaced = Math.floor((now - placedTime) / 1000);
      setElapsedSeconds(secsSincePlaced);
      setRemainingSeconds(Math.max(0, estimatedMinutes * 60 - secsSincePlaced));
    }, 1000);

    return () => clearInterval(timer);
  }, [estimatedMinutes, placedAt]);

  return { remainingSeconds, elapsedSeconds };
}

/* ─── Helpers ─────────────────────────────────────────────────────── */

function formatSeconds(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m > 0) return `${m}:${String(s).padStart(2, '0')}`;
  return `0:${String(s).padStart(2, '0')}`;
}

function formatPrice(amount: number, isVnd: boolean): string {
  return new Intl.NumberFormat(isVnd ? 'vi-VN' : 'en-US', {
    style: 'currency',
    currency: isVnd ? 'VND' : 'USD',
    minimumFractionDigits: isVnd ? 0 : 2,
  }).format(amount);
}

/* ─── Loading State ───────────────────────────────────────────────── */

function SkeletonBlock({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <div
      className={cn('animate-pulse rounded', className)}
      style={{ background: aura.bgGlass, ...style }}
    />
  );
}

function SuccessSkeleton() {
  return (
    <section aria-busy="true" aria-label="Loading order status" className="flex min-h-dvh flex-col items-center justify-center px-4 py-16">
      <div className="flex w-full max-w-md flex-col items-center gap-8">
        {/* Header icon */}
        <SkeletonBlock className="h-[88px] w-[88px] rounded-full" />
        {/* Title */}
        <SkeletonBlock className="h-5 w-56" />
        <SkeletonBlock className="h-4 w-72" />
        {/* Status tracker */}
        <div className="flex w-full justify-between gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonBlock key={i} className="h-[72px] flex-1 rounded-lg" />
          ))}
        </div>
        {/* Timer */}
        <SkeletonBlock className="h-24 w-full rounded-xl" />
        {/* Summary card */}
        <SkeletonBlock className="h-72 w-full rounded-xl" />
        {/* Buttons */}
        <div className="flex w-full gap-3">
          <SkeletonBlock className="h-12 flex-1 rounded-full" />
          <SkeletonBlock className="h-12 flex-1 rounded-full" />
        </div>
      </div>
    </section>
  );
}

/* ─── Animated Checkmark ──────────────────────────────────────────── */

function AnimatedCheckmark({ size = 80 }: { size?: number }) {
  return (
    <div
      className="relative flex items-center justify-center rounded-full"
      style={{
        width: size,
        height: size,
        background: `linear-gradient(135deg, ${aura.primary} 0%, ${aura.tertiary} 100%)`,
        boxShadow: `0 0 30px ${aura.tertiary}4D`,
      }}
    >
      {/* Pulse ring */}
      <span
        className="absolute inset-0 animate-ping rounded-full"
        style={{
          border: `2px solid ${aura.tertiary}`,
          opacity: 0.4,
        }}
      />
      <CheckCircle2
        className="h-10 w-10"
        style={{ color: aura.bgVoid }}
        aria-hidden="true"
      />
    </div>
  );
}

/* ─── Countdown Timer Card ────────────────────────────────────────── */

interface TimerCardProps {
  remainingSeconds: number;
  elapsedSeconds: number;
}

function TimerCard({ remainingSeconds, elapsedSeconds }: TimerCardProps) {
  const { t } = useTranslation();
  const isOverdue = remainingSeconds <= 0;

  return (
    <div
      className="flex w-full items-center gap-4 rounded-xl px-6 py-4 transition-all"
      style={{
        ...glassPanel,
        borderColor: isOverdue ? aura.tertiary : aura.glassBorder,
        boxShadow: isOverdue ? `0 0 12px ${aura.tertiary}33` : undefined,
      }}
    >
      <div
        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full"
        style={{
          background: isOverdue
            ? `color-mix(in srgb, ${aura.tertiary} 20%, transparent)`
            : aura.bgGlass,
          color: isOverdue ? aura.tertiary : aura.primary,
        }}
      >
        <Clock className="h-6 w-6" aria-hidden="true" />
      </div>
      <div className="flex-1">
        <div
          className="text-xs uppercase tracking-widest"
          style={{ color: aura.textSecondary }}
        >
          {isOverdue
            ? t('stitch.orderSuccessOverdue')
            : t('stitch.orderSuccessEstimatedWait')}
        </div>
        <div
          className="tabular-nums"
          style={{
            fontFamily: aura.fontMono,
            fontSize: 'var(--aura-text-headline-md)',
            color: isOverdue ? aura.tertiary : aura.textPrimary,
            fontWeight: 500,
          }}
        >
          {isOverdue ? '-' : ''}
          {formatSeconds(remainingSeconds || elapsedSeconds)} / {formatSeconds(remainingSeconds + elapsedSeconds)}
        </div>
      </div>
      {isOverdue && (
        <span
          className="animate-pulse text-xs uppercase tracking-wider"
          style={{ color: aura.tertiary }}
        >
          {t('stitch.orderSuccessOverdueBadge')}
        </span>
      )}
    </div>
  );
}

/* ─── Status Tracker ──────────────────────────────────────────────── */

interface StatusTrackerProps {
  currentStatus: OrderStatus;
}

function StatusTracker({ currentStatus }: StatusTrackerProps) {
  const { t } = useTranslation();
  const activeIndex = STATUS_ORDER[currentStatus] ?? 0;

  const STATUS_STEPS: { key: OrderStatus; icon: React.ElementType }[] = [
    { key: 'received',  icon: Package },
    { key: 'preparing', icon: ChefHat },
    { key: 'ready',     icon: ShoppingBag },
    { key: 'served',    icon: Beer },
  ];

  const stepLabels: Record<OrderStatus, string> = {
    received:  t('stitch.orderSuccessStatusReceived'),
    preparing: t('stitch.orderSuccessStatusPreparing'),
    ready:     t('stitch.orderSuccessStatusReady'),
    served:    t('stitch.orderSuccessStatusServed'),
  };

  return (
    <div
      className="flex w-full items-center justify-between gap-0 rounded-xl p-2"
      style={glassPanel}
      role="progressbar"
      aria-valuenow={activeIndex + 1}
      aria-valuemin={1}
      aria-valuemax={STATUS_STEPS.length}
      aria-label={t('stitch.orderSuccessStatus')}
    >
      {STATUS_STEPS.map((step, idx) => {
        const isActive = idx <= activeIndex;
        const isCurrent = idx === activeIndex;
        const StepIcon = step.icon;
        return (
          <div
            key={step.key}
            className="flex flex-1 flex-col items-center gap-1.5 px-1 py-3 transition-all"
          >
            <div
              className="flex h-10 w-10 items-center justify-center rounded-full transition-all"
              style={{
                background: isActive
                  ? `linear-gradient(135deg, ${aura.primary} 0%, ${aura.tertiary} 100%)`
                  : aura.bgGlass,
                border: isCurrent ? `2px solid ${aura.tertiary}` : `1px solid ${aura.glassBorder}`,
                boxShadow: isCurrent ? `0 0 12px ${aura.tertiary}4D` : undefined,
              }}
            >
              <StepIcon
                className={cn('h-5 w-5', isActive ? 'animate-pulse' : '')}
                style={{
                  color: isActive ? aura.bgVoid : aura.textDisabled,
                }}
                aria-hidden="true"
              />
            </div>
            <span
              className="whitespace-nowrap text-[10px] font-semibold uppercase tracking-wider"
              style={{
                color: isActive ? aura.primary : aura.textDisabled,
                fontFamily: aura.fontBody,
                transition: 'color var(--aura-duration-normal) var(--aura-easing-default)',
              }}
            >
              {stepLabels[step.key]}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/* ─── Empty State ─────────────────────────────────────────────────── */

function EmptyState() {
  const { t } = useTranslation();
  return (
    <section className="flex min-h-dvh flex-col items-center justify-center gap-6 px-4 text-center" role="status">
      <div
        className="flex h-20 w-20 items-center justify-center rounded-full"
        style={{ background: aura.bgGlass, border: `1px solid ${aura.glassBorder}` }}
      >
        <Package
          className="h-10 w-10"
          style={{ color: aura.textSecondary }}
        />
      </div>
      <div>
        <h2
          style={{
            fontFamily: aura.fontDisplay,
            fontSize: 'var(--aura-text-headline-md)',
            color: aura.textPrimary,
            fontWeight: 500,
          }}
        >
          {t('stitch.orderSuccessNotFound')}
        </h2>
        <p style={{ color: aura.textSecondary, marginTop: 8, maxWidth: 280 }}>
          {t('stitch.orderSuccessNotFoundDesc')}
        </p>
      </div>
    </section>
  );
}

/* ─── Main Component ──────────────────────────────────────────────── */

export default function StitchOrderSuccess({
  order,
  isLoading = false,
  error = null,
  locale = 'vi',
  currency,
  onViewOrders,
  onNewOrder,
  onRefresh,
}: Readonly<StitchOrderSuccessProps>) {
  const { t } = useTranslation();
  const isVietnamese = locale === 'vi' || locale.startsWith('vi');
  const isVnd = currency ? currency === 'VND' : isVietnamese;
  const fmt = (amount: number) => formatPrice(amount, isVnd);

  /* ── Loading ──────────────────────────────────────────────────── */
  if (isLoading) {
    return <SuccessSkeleton />;
  }

  /* ── Error ────────────────────────────────────────────────────── */
  if (error) {
    return (
      <section className="flex min-h-dvh flex-col items-center justify-center gap-6 px-4 text-center" role="alert">
        <div
          className="flex h-20 w-20 items-center justify-center rounded-full"
          style={{ background: `color-mix(in srgb, ${aura.error} 15%, transparent)`, border: `1px solid ${aura.error}` }}
        >
          <AlertCircle
            className="h-10 w-10"
            style={{ color: aura.error }}
          />
        </div>
        <div>
          <h2
            style={{
              fontFamily: aura.fontDisplay,
              fontSize: 'var(--aura-text-headline-md)',
              color: aura.textPrimary,
              fontWeight: 500,
            }}
          >
            {t('stitch.orderSuccessError')}
          </h2>
          <p className="mt-2 text-sm" style={{ color: aura.textSecondary, maxWidth: 320 }}>
            {error}
          </p>
        </div>
        {onRefresh && (
          <button
            onClick={onRefresh}
            className="flex items-center gap-2 rounded-full px-6 py-3 text-sm font-bold uppercase tracking-widest transition-all hover:brightness-110 active:scale-95"
            style={{
              background: `linear-gradient(135deg, ${aura.primary} 0%, ${aura.tertiary} 100%)`,
              color: aura.bgVoid,
              fontFamily: aura.fontBody,
            }}
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            {t('stitch.orderSuccessRetry')}
          </button>
        )}
      </section>
    );
  }

  /* ── Empty ────────────────────────────────────────────────────── */
  if (!order) {
    return <EmptyState />;
  }

  /* ── Countdown ────────────────────────────────────────────────── */
  const { remainingSeconds, elapsedSeconds } = useCountdown(
    order.estimatedMinutes,
    order.placedAt,
  );

  return (
    <section
      className="flex min-h-dvh flex-col items-center py-16"
      style={{
        background: `linear-gradient(180deg, ${aura.bgVoid} 0%, ${aura.bgPage} 100%)`,
      }}
    >
      <div
        className="mx-auto flex w-full max-w-md flex-col items-center gap-8 px-4"
      >
        {/* ═══════════ HEADER — Animated success ════════════════════ */}
        <AnimatedCheckmark size={88} />

        <div className="text-center">
          <h1
            className="text-center tracking-tight"
            style={{
              fontFamily: aura.fontDisplay,
              fontSize: 'var(--aura-text-display-md)',
              color: aura.primary,
              fontWeight: 500,
            }}
          >
            {t('stitch.orderSuccessTitle')}
          </h1>
          <p className="mt-2" style={{ color: aura.textSecondary, fontSize: 'var(--aura-text-body)' }}>
            {t('stitch.orderSuccessDesc')}
          </p>
        </div>

        {/* ═══════════ ORDER ID ──────────────────────────────────── */}
        <div
          className="rounded-lg px-5 py-2 text-center"
          style={{
            background: `color-mix(in srgb, ${aura.tertiary} 10%, transparent)`,
            border: `1px solid ${aura.tertiary}33`,
          }}
        >
          <span
            className="text-xs uppercase tracking-widest"
            style={{ color: aura.textSecondary }}
          >
            {t('stitch.orderSuccessId')}
          </span>
          <span
            className="ml-2 tabular-nums font-bold tracking-wider"
            style={{
              fontFamily: aura.fontMono,
              color: aura.tertiary,
              fontSize: 'var(--aura-text-title-md)',
            }}
          >
            #{order.orderId}
          </span>
        </div>

        {/* ═══════════ STATUS TRACKER ────────────────────────────── */}
        <StatusTracker
          currentStatus={order.currentStatus}
        />

        {/* ═══════════ WAIT TIMER ────────────────────────────────── */}
        <TimerCard
          remainingSeconds={remainingSeconds}
          elapsedSeconds={elapsedSeconds}
        />

        {/* ═══════════ ORDER INFO — Glass Card ───────────────────── */}
        <div
          className="w-full rounded-xl p-6"
          style={{
            ...glassPanel,
            boxShadow: aura.shadowLg,
          }}
        >
          {/* Customer info */}
          <div className="mb-6 flex flex-wrap items-center gap-x-6 gap-y-2">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4" style={{ color: aura.textSecondary }} aria-hidden="true" />
              <span style={{ color: aura.textPrimary, fontSize: 'var(--aura-text-body-sm)', fontFamily: aura.fontBody }}>
                {order.customerName}
              </span>
            </div>
            {order.table && (
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4" style={{ color: aura.textSecondary }} aria-hidden="true" />
                <span style={{ color: aura.textPrimary, fontSize: 'var(--aura-text-body-sm)', fontFamily: aura.fontBody }}>
                  {t('stitch.orderSuccessTable')} {order.table}
                </span>
              </div>
            )}
            {order.phone && (
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4" style={{ color: aura.textSecondary }} aria-hidden="true" />
                <span style={{ color: aura.textSecondary, fontSize: 'var(--aura-text-body-sm)', fontFamily: aura.fontBody }}>
                  {order.phone}
                </span>
              </div>
            )}
          </div>

          {/* Divider */}
          <div style={{ height: 1, background: aura.borderSubtle }} className="mb-4" />

          {/* Order items */}
          <div className="space-y-4">
            {order.items.length === 0 ? (
              <p className="text-center text-sm" style={{ color: aura.textDisabled }}>
                {t('stitch.orderSuccessEmptyItems')}
              </p>
            ) : (
              order.items.map((item) => (
                <div key={item.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span
                      className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold"
                      style={{
                        background: `color-mix(in srgb, ${aura.tertiary} 15%, transparent)`,
                        color: aura.tertiary,
                        fontFamily: aura.fontBody,
                      }}
                    >
                      {item.quantity}
                    </span>
                    <div>
                      <span
                        style={{
                          fontFamily: aura.fontBody,
                          fontSize: 'var(--aura-text-body-sm)',
                          color: aura.textPrimary,
                        }}
                      >
                        {item.name}
                      </span>
                      {item.variant && (
                        <span
                          className="ml-2 text-[11px] uppercase tracking-wider"
                          style={{ color: aura.textSecondary }}
                        >
                          {item.variant}
                        </span>
                      )}
                    </div>
                  </div>
                  <span
                    className="tabular-nums"
                    style={{
                      fontFamily: aura.fontBody,
                      fontSize: 'var(--aura-text-body-sm)',
                      color: aura.tertiary,
                      fontWeight: 500,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {fmt(item.price)}
                  </span>
                </div>
              ))
            )}
          </div>

          {/* Divider */}
          <div style={{ height: 1, background: aura.borderSubtle }} className="my-4" />

          {/* Totals */}
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-xs" style={{ color: aura.textSecondary }}>
                {t('stitch.orderSuccessSubtotal')}
              </span>
              <span className="text-xs tabular-nums" style={{ color: aura.textSecondary }}>
                {fmt(order.subtotal)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-xs" style={{ color: aura.textSecondary }}>
                {order.taxLabel ?? t('stitch.orderSuccessTax')}
              </span>
              <span className="text-xs tabular-nums" style={{ color: aura.textSecondary }}>
                {fmt(order.tax)}
              </span>
            </div>
            <div className="flex justify-between pt-2" style={{ borderTop: `1px solid ${aura.borderSubtle}` }}>
              <span
                style={{
                  fontFamily: aura.fontDisplay,
                  fontSize: 'var(--aura-text-title-md)',
                  color: aura.primary,
                  fontWeight: 500,
                }}
              >
                {t('stitch.orderSuccessTotal')}
              </span>
              <span
                className="tabular-nums"
                style={{
                  fontFamily: aura.fontDisplay,
                  fontSize: 'var(--aura-text-title-md)',
                  color: aura.tertiary,
                  fontWeight: 600,
                }}
              >
                {fmt(order.total)}
              </span>
            </div>
          </div>
        </div>

        {/* ═══════════ NOTES ───────────────────────────────────────── */}
        {order.notes && (
          <div
            className="flex w-full items-start gap-3 rounded-xl px-5 py-4"
            style={{
              ...glassPanel,
            }}
          >
            <FileText className="mt-0.5 h-4 w-4 shrink-0" style={{ color: aura.textSecondary }} aria-hidden="true" />
            <p className="text-sm italic" style={{ color: aura.textSecondary }}>
              &ldquo;{order.notes}&rdquo;
            </p>
          </div>
        )}

        {/* ═══════════ ACTION BUTTONS ─────────────────────────────── */}
        <div className="flex w-full flex-col gap-3 sm:flex-row">
          {onViewOrders && (
            <button
              onClick={onViewOrders}
              className="flex flex-1 items-center justify-center gap-2 rounded-full px-6 py-4 text-sm font-bold uppercase tracking-widest transition-all hover:brightness-110 active:scale-95"
              style={{
                background: `linear-gradient(135deg, ${aura.primary} 0%, ${aura.tertiary} 100%)`,
                color: aura.bgVoid,
                fontFamily: aura.fontBody,
                boxShadow: `0 4px 16px ${aura.tertiary}33`,
              }}
            >
              <ShoppingBag className="h-4 w-4" aria-hidden="true" />
              {t('stitch.orderSuccessViewOrders')}
            </button>
          )}
          {onNewOrder && (
            <button
              onClick={onNewOrder}
              className="flex flex-1 items-center justify-center gap-2 rounded-full px-6 py-4 text-sm font-bold uppercase tracking-widest transition-all hover:brightness-110 active:scale-95"
              style={{
                background: 'transparent',
                color: aura.primary,
                fontFamily: aura.fontBody,
                border: `1px solid ${aura.glassBorder}`,
              }}
            >
              <Beer className="h-4 w-4" aria-hidden="true" />
              {t('stitch.orderSuccessNewOrder')}
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
