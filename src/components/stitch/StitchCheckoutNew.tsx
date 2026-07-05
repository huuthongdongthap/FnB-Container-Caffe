import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/cn';
import {
  ShoppingBag,
  CircleUser,
  User,
  Wallet,
  Banknote,
  Package,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';

// ─── Types ─────────────────────────────────────────────────────────────────

export interface CheckoutNewItem {
  id: string;
  name: string;
  variant: string;
  quantity: number;
  price: number;
  imageUrl: string;
}

export interface CheckoutNewSummary {
  items: CheckoutNewItem[];
  subtotal: number;
  tax: number;
  taxLabel?: string;
  deliveryFee: number;
  deliveryLabel?: string;
  total: number;
}

export interface CheckoutNewFormData {
  fullName: string;
  phone: string;
  address: string;
  notes: string;
  paymentMethod: 'payos' | 'cod';
}

export interface StitchCheckoutNewProps {
  summary: CheckoutNewSummary | null;
  isProcessing?: boolean;
  error?: string | null;
  onPlaceOrder: (data: CheckoutNewFormData) => Promise<void>;
  locale?: string;
}

type PaymentMethod = 'payos' | 'cod';

// ─── Constants ──────────────────────────────────────────────────────────────

const PAYMENT_OPTIONS: {
  value: PaymentMethod;
  label: string;
  descriptionKey: string;
  icon: React.ElementType;
}[] = [
  {
    value: 'payos',
    label: 'PayOS',
    descriptionKey: 'stitch.payosDesc',
    icon: Wallet,
  },
  {
    value: 'cod',
    label: 'Cash on Delivery',
    descriptionKey: 'stitch.codDesc',
    icon: Banknote,
  },
];

// ─── Helpers ────────────────────────────────────────────────────────────────

const formatPrice = (amount: number, localeStr: string): string => {
  const isVietnamese = localeStr === 'vi' || localeStr.startsWith('vi');
  return new Intl.NumberFormat(isVietnamese ? 'vi-VN' : 'en-US', {
    style: 'currency',
    currency: isVietnamese ? 'VND' : 'USD',
    minimumFractionDigits: isVietnamese ? 0 : 2,
  }).format(amount);
};

// ─── Glass Panel Background (no border — each element supplies its own) ──────

const glassPanelBg =
  'bg-[color-mix(in_srgb,var(--aura-surface-container)_75%,transparent)] backdrop-blur-[20px]';

// ─── Input Field Classes ─────────────────────────────────────────────────────

const inputClasses =
  'bg-[var(--aura-surface-container)] border-b border-[color-mix(in_srgb,var(--aura-chrome-dim)_30%,transparent)] focus:border-[var(--aura-chrome-bright)] px-4 py-3 text-[#e5e2e1] transition-all rounded-t-sm placeholder:text-[color-mix(in_srgb,var(--aura-chrome-soft)_50%,transparent)]';

// ─── Loading Skeleton ───────────────────────────────────────────────────────

function SkeletonBlock({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'animate-pulse rounded bg-[color-mix(in_srgb,var(--aura-surface-container)_75%,transparent)] backdrop-blur-[20px]',
        className,
      )}
    />
  );
}

function CheckoutNewSkeleton() {
  return (
    <section
      aria-busy="true"
      aria-label="Loading checkout"
      className="min-h-screen bg-[var(--aura-surface-container)] pt-24 pb-32"
    >
      <div className="mx-auto max-w-7xl px-10 space-y-12">
        <SkeletonBlock className="h-10 w-72" />
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-12">
          <div className="space-y-10 lg:col-span-7">
            <div className="rounded-xl p-6 space-y-6 bg-[color-mix(in_srgb,var(--aura-surface-container)_75%,transparent)] backdrop-blur-[20px] border border-[rgba(198,198,199,0.15)]">
              <SkeletonBlock className="h-6 w-48" />
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <SkeletonBlock className="h-14 w-full" />
                <SkeletonBlock className="h-14 w-full" />
                <SkeletonBlock className="h-14 w-full md:col-span-2" />
                <SkeletonBlock className="h-20 w-full md:col-span-2" />
              </div>
            </div>
            <div className="rounded-xl p-6 space-y-6 bg-[color-mix(in_srgb,var(--aura-surface-container)_75%,transparent)] backdrop-blur-[20px] border border-[rgba(198,198,199,0.15)]">
              <SkeletonBlock className="h-6 w-44" />
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <SkeletonBlock className="h-20 w-full" />
                <SkeletonBlock className="h-20 w-full" />
              </div>
            </div>
          </div>
          <div className="lg:col-span-5">
            <div className="rounded-xl p-8 space-y-6 bg-[color-mix(in_srgb,var(--aura-surface-container)_75%,transparent)] backdrop-blur-[20px] border border-[rgba(198,198,199,0.15)]">
              <SkeletonBlock className="h-6 w-40" />
              {Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4">
                  <SkeletonBlock className="h-16 w-16 shrink-0 rounded" />
                  <div className="flex-1 space-y-2">
                    <SkeletonBlock className="h-4 w-32" />
                    <SkeletonBlock className="h-3 w-24" />
                  </div>
                  <SkeletonBlock className="h-4 w-16" />
                </div>
              ))}
              <div className="space-y-3 border-t border-[color-mix(in_srgb,var(--aura-chrome-dim)_20%,transparent)] pt-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex justify-between">
                    <SkeletonBlock className="h-4 w-20" />
                    <SkeletonBlock className="h-4 w-14" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Input Field ────────────────────────────────────────────────────────────

interface FieldProps {
  label: string;
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  multiline?: boolean;
  rows?: number;
}

function Field({
  label,
  placeholder,
  value,
  onChange,
  type = 'text',
  multiline = false,
  rows = 3,
}: Readonly<FieldProps>) {
  const fieldId = `checkout-field-${label.toLowerCase().replace(/\s+/g, '-')}`;
  const sharedClasses = cn(
    inputClasses,
    value && 'border-[var(--aura-chrome-bright)]',
    'focus:outline-none focus:shadow-[0_4px_12px_-4px_color-mix(in_srgb,var(--aura-chrome-bright)_30%,transparent)]',
  );

  // Micro-interaction: scale on focus (matches HTML script behavior)
  const handleFocus = (e: React.FocusEvent<HTMLElement>) => {
    const parent = (e.target as HTMLElement).parentElement;
    if (parent) parent.classList.add('scale-[1.01]');
  };

  const handleBlur = (e: React.FocusEvent<HTMLElement>) => {
    const parent = (e.target as HTMLElement).parentElement;
    if (parent) parent.classList.remove('scale-[1.01]');
  };

  return (
    <div className="flex flex-col gap-2">
      <label
        htmlFor={fieldId}
        className="font-['Space_Grotesk'] text-[14px] leading-[1.2] font-medium tracking-[0.1em] uppercase text-[var(--aura-chrome-soft)]"
      >
        {label}
      </label>
      {multiline ? (
        <textarea
          id={fieldId}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={handleFocus}
          onBlur={handleBlur}
          rows={rows}
          className={cn('resize-none', sharedClasses)}
          aria-label={label}
        />
      ) : (
        <input
          id={fieldId}
          type={type}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={handleFocus}
          onBlur={handleBlur}
          className={sharedClasses}
          aria-label={label}
        />
      )}
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────

export function StitchCheckoutNew({
  summary,
  isProcessing = false,
  error = null,
  onPlaceOrder,
  locale = 'vi',
}: Readonly<StitchCheckoutNewProps>) {
  const { t } = useTranslation();
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('payos');
  const [form, setForm] = useState<CheckoutNewFormData>({
    fullName: '',
    phone: '',
    address: '',
    notes: '',
    paymentMethod: 'payos',
  });
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ── Loading State ─────────────────────────────────────────────────────────
  if (!summary) {
    return <CheckoutNewSkeleton />;
  }

  // ── Empty State ───────────────────────────────────────────────────────────
  if (summary.items.length === 0) {
    return (
      <section
        className="flex min-h-screen items-center justify-center bg-[var(--aura-surface-container)]"
        role="status"
        aria-label={t('stitch.emptyCartTitle', 'Your cart is empty')}
      >
        <div className="flex flex-col items-center gap-6 px-4 text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--aura-surface-container)_75%,transparent)] backdrop-blur-[20px] border border-[rgba(198,198,199,0.15)]">
            <Package className="w-10 h-10 text-[var(--aura-chrome-soft)]" aria-hidden="true" />
          </div>
          <div>
            <h2 className="font-['EB_Garamond'] text-2xl font-medium text-[var(--aura-noir-void)]">
              {t('stitch.emptyCartTitle', 'Your cart is empty')}
            </h2>
            <p className="mt-2 text-[var(--aura-chrome-soft)]">
              {t('stitch.emptyCartDesc', 'Add some items to get started')}
            </p>
          </div>
        </div>
      </section>
    );
  }

  // ── Derived State ─────────────────────────────────────────────────────────
  const displayError = error || submitError;
  const processing = isProcessing || isSubmitting;

  // ── Handlers ──────────────────────────────────────────────────────────────
  const updateField = <K extends keyof CheckoutNewFormData>(
    key: K,
    value: CheckoutNewFormData[K],
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    setIsSubmitting(true);
    try {
      await onPlaceOrder({ ...form, paymentMethod });
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : t('stitch.orderFailed', 'Order failed'),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="min-h-screen bg-[var(--aura-surface-container)] font-['Space_Grotesk'] text-[16px] leading-[1.6] text-[#e5e2e1] overflow-x-hidden"
    >
      {/* ══════ TOP NAVIGATION BAR ═══════════════════════════════════════ */}
      <header className="fixed top-0 left-0 w-full z-50 flex justify-between items-center px-6 py-4 bg-[#131313]/80 backdrop-blur-xl border-b border-[rgba(198,198,199,0.2)] shadow-sm">
        <a
          href="/"
          className="font-['EB_Garamond'] text-[32px] leading-[1.2] font-medium tracking-tight text-[var(--aura-noir-void)]"
        >
          AURA CAFE
        </a>
        <div className="flex items-center gap-6">
          <button
            type="button"
            className="text-[var(--aura-noir-void)] hover:text-[var(--aura-chrome-bright)] transition-colors duration-300"
            aria-label={t('stitch.cart', 'Cart')}
          >
            <ShoppingBag className="w-6 h-6" />
          </button>
          <button
            type="button"
            className="text-[var(--aura-noir-void)] hover:text-[var(--aura-chrome-bright)] transition-colors duration-300"
            aria-label={t('stitch.account', 'Account')}
          >
            <CircleUser className="w-6 h-6" />
          </button>
        </div>
      </header>

      {/* ══════ MAIN CONTENT ════════════════════════════════════════════ */}
      <main className="pt-24 pb-32 px-10 max-w-7xl mx-auto">
        <h1 className="font-['EB_Garamond'] text-[48px] leading-[1.1] tracking-[-0.02em] font-medium text-[var(--aura-noir-void)] mb-12">
          {t('stitch.confirmOrder', 'Finalize Selection')}
        </h1>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          {/* ══════ LEFT COLUMN: FORM ══════════════════════════════════ */}
          <div className="lg:col-span-7 space-y-10">
            {/* ── Customer Information ──────────────────────────────── */}
            <section>
              <h2 className="font-['EB_Garamond'] text-[32px] leading-[1.2] font-medium text-[#c6c6c7] mb-6 flex items-center gap-3">
                <User className="w-8 h-8" aria-hidden="true" />
                {t('stitch.customerInfo', 'Customer Information')}
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Field
                  label={t('stitch.fullName', 'Full Name')}
                  placeholder="Julian Vane"
                  value={form.fullName}
                  onChange={(v) => updateField('fullName', v)}
                />
                <Field
                  label={t('stitch.phone', 'Phone Number')}
                  placeholder="+1 (555) 000-0000"
                  value={form.phone}
                  onChange={(v) => updateField('phone', v)}
                  type="tel"
                />
                <div className="md:col-span-2">
                  <Field
                    label={t('stitch.deliveryAddress', 'Delivery Address')}
                    placeholder="128 Obsidian Plaza, Nocturne District"
                    value={form.address}
                    onChange={(v) => updateField('address', v)}
                  />
                </div>
                <div className="md:col-span-2">
                  <Field
                    label={t('stitch.orderNotes', 'Order Notes')}
                    placeholder="Extra foam on the latte, please."
                    value={form.notes}
                    onChange={(v) => updateField('notes', v)}
                    multiline
                    rows={3}
                  />
                </div>
              </div>
            </section>

            {/* ── Payment Method ────────────────────────────────────── */}
            <section>
              <h2 className="font-['EB_Garamond'] text-[32px] leading-[1.2] font-medium text-[#c6c6c7] mb-6 flex items-center gap-3">
                <Wallet className="w-8 h-8" aria-hidden="true" />
                {t('stitch.paymentMethod', 'Payment Method')}
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {PAYMENT_OPTIONS.map((option) => {
                  const selected = paymentMethod === option.value;
                  const isPayos = option.value === 'payos';
                  const IconComp = option.icon;

                  return (
                    <label key={option.value} className="relative cursor-pointer group">
                      <input
                        type="radio"
                        name="payment"
                        value={option.value}
                        checked={selected}
                        onChange={() => setPaymentMethod(option.value)}
                        className="sr-only peer"
                      />
                      <div
                        className={cn(
                          glassPanelBg,
                          'p-6 rounded-xl flex items-center justify-between border border-[rgba(198,198,199,0.1)] transition-all',
                          // Selected PayOS: tertiary border + tint + bronze glow
                          selected && isPayos && 'border-[var(--aura-chrome-bright)] bg-[color-mix(in_srgb,var(--aura-chrome-bright)_5%,transparent)] shadow-[0_0_15px_color-mix(in_srgb,var(--aura-chrome-bright)_20%,transparent)]',
                          // Selected COD: secondary border + tint
                          selected && !isPayos && 'border-[#c6c6c7] bg-[rgba(198,198,199,0.05)]',
                          // PayOS always has bronze glow (even when not selected)
                          isPayos && !selected && 'shadow-[0_0_15px_color-mix(in_srgb,var(--aura-chrome-bright)_20%,transparent)]',
                        )}
                      >
                        <div className="flex items-center gap-4">
                          <div
                            className={cn(
                              'w-12 h-12 rounded-full flex items-center justify-center',
                              isPayos
                                ? 'bg-[color-mix(in_srgb,var(--aura-chrome-bright)_20%,transparent)] text-[var(--aura-chrome-bright)]'
                                : 'bg-[rgba(198,198,199,0.2)] text-[#c6c6c7]',
                            )}
                          >
                            <IconComp className="w-6 h-6" aria-hidden="true" />
                          </div>
                          <div>
                            <div className="font-['Space_Grotesk'] text-[14px] leading-[1.2] font-medium tracking-[0.1em] uppercase text-[#e5e2e1]">
                              {option.label}
                            </div>
                            <div className="text-xs text-[var(--aura-chrome-soft)]">
                              {t(option.descriptionKey)}
                            </div>
                          </div>
                        </div>
                        {/* Custom radio indicator */}
                        <div
                          className={cn(
                            'w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors',
                            selected
                              ? isPayos
                                ? 'border-[var(--aura-chrome-bright)]'
                                : 'border-[#c6c6c7]'
                              : 'border-[var(--aura-chrome-dim)] group-hover:border-[var(--aura-chrome-bright)]',
                          )}
                        >
                          <div
                            className={cn(
                              'w-2.5 h-2.5 rounded-full transition-opacity',
                              isPayos ? 'bg-[var(--aura-chrome-bright)]' : 'bg-[#c6c6c7]',
                              selected ? 'opacity-100' : 'opacity-0',
                            )}
                          />
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>
            </section>
          </div>

          {/* ══════ RIGHT COLUMN: ORDER SUMMARY ═══════════════════════ */}
          <div className="lg:col-span-5">
            <div
              className={cn(
                glassPanelBg,
                'rounded-xl p-8 sticky top-28 border border-[rgba(198,198,199,0.2)] shadow-2xl',
              )}
            >
              <h3 className="font-['EB_Garamond'] text-[32px] leading-[1.2] font-medium text-[var(--aura-noir-void)] mb-8 border-b border-[color-mix(in_srgb,var(--aura-chrome-dim)_20%,transparent)] pb-4">
                {t('stitch.orderSummary', 'Order Summary')}
              </h3>

              {/* Items list */}
              <div className="space-y-6 mb-10 max-h-[300px] overflow-y-auto pr-4 custom-scrollbar">
                {summary.items.map((item) => (
                  <div key={item.id} className="flex justify-between items-center group">
                    <div className="flex gap-4">
                      <div
                        className="w-16 h-16 shrink-0 rounded bg-cover bg-center"
                        style={{ backgroundImage: `url(${item.imageUrl})` }}
                        role="img"
                        aria-label={item.name}
                      />
                      <div className="flex flex-col justify-center">
                        <span className="font-['Space_Grotesk'] text-[18px] leading-[1.6] text-[#e5e2e1]">
                          {item.name}
                        </span>
                        <span className="text-xs text-[var(--aura-chrome-soft)] uppercase tracking-widest font-['Space_Grotesk']">
                          {item.variant}
                          {' • '}
                          {item.quantity}x
                        </span>
                      </div>
                    </div>
                    <span className="font-['Space_Grotesk'] text-[14px] leading-[1.2] font-medium tracking-[0.1em] text-[var(--aura-chrome-bright)] whitespace-nowrap">
                      {formatPrice(item.price, locale)}
                    </span>
                  </div>
                ))}
              </div>

              {/* Totals */}
              <div className="space-y-4 pt-6 border-t border-[color-mix(in_srgb,var(--aura-chrome-dim)_20%,transparent)]">
                <div className="flex justify-between text-[var(--aura-chrome-soft)]">
                  <span className="font-['Space_Grotesk'] text-[14px] leading-[1.2] font-medium tracking-[0.1em]">
                    {t('stitch.subtotal', 'Subtotal')}
                  </span>
                  <span className="font-['Space_Grotesk'] text-[14px] leading-[1.2] font-medium tracking-[0.1em]">
                    {formatPrice(summary.subtotal, locale)}
                  </span>
                </div>
                <div className="flex justify-between text-[var(--aura-chrome-soft)]">
                  <span className="font-['Space_Grotesk'] text-[14px] leading-[1.2] font-medium tracking-[0.1em]">
                    {summary.taxLabel ?? t('stitch.tax', 'Luxury Tax (5%)')}
                  </span>
                  <span className="font-['Space_Grotesk'] text-[14px] leading-[1.2] font-medium tracking-[0.1em]">
                    {formatPrice(summary.tax, locale)}
                  </span>
                </div>
                <div className="flex justify-between text-[var(--aura-chrome-soft)]">
                  <span className="font-['Space_Grotesk'] text-[14px] leading-[1.2] font-medium tracking-[0.1em]">
                    {summary.deliveryLabel ?? t('stitch.deliveryFee', 'Delivery Fee')}
                  </span>
                  <span className="font-['Space_Grotesk'] text-[14px] leading-[1.2] font-medium tracking-[0.1em]">
                    {summary.deliveryFee === 0
                      ? '$0.00'
                      : formatPrice(summary.deliveryFee, locale)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* ══════ FLOATING FOOTER TOTAL BAR ════════════════════════════ */}
      <footer className="fixed bottom-0 left-0 w-full z-50">
        <div className="max-w-7xl mx-auto px-4 pb-8">
          <div
            className={cn(
              glassPanelBg,
              'p-6 md:px-12 rounded-full border border-[rgba(198,198,199,0.3)] shadow-[0_-8px_30px_rgba(0,0,0,0.5)] flex flex-col md:flex-row justify-between items-center gap-4',
            )}
          >
            {/* Left info */}
            <div className="flex items-center gap-8">
              <div className="hidden md:flex flex-col">
                <span className="text-xs text-[var(--aura-chrome-soft)] uppercase tracking-widest">
                  {t('stitch.selectedItems', 'Selected Items')}
                </span>
                <span className="font-['Space_Grotesk'] text-[14px] leading-[1.2] font-medium tracking-[0.1em] text-[#e5e2e1]">
                  {summary.items.length} {t('stitch.items', 'Nocturnal Crafts')}
                </span>
              </div>
              <div className="flex flex-col items-center md:items-start">
                <span className="text-xs font-bold text-[var(--aura-chrome-bright)] uppercase tracking-widest">
                  {t('stitch.totalAmount', 'Total Amount')}
                </span>
                <span className="font-['EB_Garamond'] text-[32px] leading-[1.2] font-medium text-[var(--aura-chrome-bright)]">
                  {formatPrice(summary.total, locale)}
                </span>
              </div>
            </div>

            {/* Error message */}
            {displayError && (
              <div className="flex items-center gap-2 text-sm" role="alert" aria-live="assertive">
                <AlertTriangle className="w-4 h-4 text-[var(--aura-error)]" aria-hidden="true" />
                <span className="text-[var(--aura-error)]">{displayError}</span>
              </div>
            )}

            {/* Place Order button */}
            <button
              type="submit"
              disabled={processing}
              className={cn(
                'min-w-[240px] px-12 py-4 rounded-full font-[\'Space_Grotesk\'] text-[14px] leading-[1.2] font-medium tracking-[0.1em] uppercase font-bold shadow-xl transition-all',
                'bg-gradient-to-br from-[#E3E2E3] via-[#C6C6C7] to-[var(--aura-chrome-dim)]',
                'text-[var(--aura-surface-container)]',
                processing
                  ? 'cursor-not-allowed opacity-60'
                  : 'hover:brightness-110 active:scale-95',
              )}
            >
              {processing ? (
                <span className="flex items-center justify-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin" aria-hidden="true" />
                  {t('stitch.processing', 'Processing...')}
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <ShoppingBag className="w-4 h-4" aria-hidden="true" />
                  {t('stitch.placeOrder', 'Place Order')}
                </span>
              )}
            </button>
          </div>
        </div>
      </footer>

      {/* ── Animated Background Effect ─────────────────────────────── */}
      <div className="fixed inset-0 -z-10 pointer-events-none opacity-40" aria-hidden="true" />

      {/* ── Custom scrollbar styles ────────────────────────────────── */}
      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #454748;
          border-radius: 10px;
        }
      `}</style>
    </form>
  );
}
