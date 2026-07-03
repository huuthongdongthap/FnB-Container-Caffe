import { useState } from 'react';
import {
  Wallet,
  Banknote,
  User,
  Phone,
  MapPin,
  FileText,
  Package,
  ShoppingBag,
  Loader2,
  AlertCircle,
  CreditCard,
} from 'lucide-react';
import { cn } from '@/lib/cn';

// ─── Types ───────────────────────────────────────────────────────────────

export interface OrderItem {
  id: string;
  name: string;
  variant: string;
  quantity: number;
  price: number;
  imageUrl: string;
}

export interface OrderSummaryData {
  items: OrderItem[];
  subtotal: number;
  tax: number;
  taxLabel?: string;
  deliveryFee: number;
  deliveryLabel?: string;
  total: number;
}

export interface OrderFormData {
  fullName: string;
  phone: string;
  address: string;
  notes: string;
  paymentMethod: 'payos' | 'cod';
}

export interface StitchCheckoutProps {
  summary: OrderSummaryData | null;
  isProcessing?: boolean;
  error?: string | null;
  onPlaceOrder: (data: OrderFormData) => Promise<void>;
  locale?: string;
}

// ─── Token Helpers ──────────────────────────────────────────────────────

const token = (name: string) => `var(${name})`;

const aura = {
  // Background
  bgPage: token('--aura-bg-page'),
  bgGlass: token('--aura-glass-bg'),
  bgGlassHover: token('--aura-glass-hover-bg'),
  bgInput: token('--aura-bg-input'),
  // Text
  textPrimary: token('--aura-text-primary'),
  textSecondary: token('--aura-text-secondary'),
  textDisabled: token('--aura-text-disabled'),
  // Brand
  primary: token('--aura-primary'),
  tertiary: token('--aura-tertiary'),
  secondary: token('--aura-secondary'),
  // Border
  glassBorder: token('--aura-glass-border'),
  borderHover: token('--aura-border-hover'),
  borderFocus: token('--aura-border-focus'),
  borderSubtle: token('--aura-border-subtle'),
  outline: token('--aura-outline'),
  // Glass
  glassBlur: token('--aura-glass-blur'),
  // Shadow
  shadowLg: token('--aura-shadow-lg'),
  shadowGlow: token('--aura-shadow-glow'),
  // Font
  fontDisplay: token('--aura-font-display'),
  fontBody: token('--aura-font-body'),
  // Radius
  radiusSm: token('--aura-radius-sm'),
  radiusMd: token('--aura-radius-md'),
  radiusLg: token('--aura-radius-lg'),
  radiusXl: token('--aura-radius-xl'),
  radiusFull: token('--aura-radius-full'),
  // Spacing
  space1: token('--aura-space-1'),
  space2: token('--aura-space-2'),
  space3: token('--aura-space-3'),
  space4: token('--aura-space-4'),
  space5: token('--aura-space-5'),
  space6: token('--aura-space-6'),
  space8: token('--aura-space-8'),
  space10: token('--aura-space-10'),
  space12: token('--aura-space-12'),
  space16: token('--aura-space-16'),
  // Misc
  success: token('--aura-success'),
  error: token('--aura-error'),
  containerPadding: token('--aura-container-padding'),
  maxWidth: token('--aura-max-width'),
};

// ─── Style Presets ──────────────────────────────────────────────────────

const glassPanel: React.CSSProperties = {
  background: aura.bgGlass,
  backdropFilter: `blur(${aura.glassBlur})`,
  WebkitBackdropFilter: `blur(${aura.glassBlur})`,
  border: `1px solid ${aura.glassBorder}`,
};

const chromeGradient: React.CSSProperties = {
  background: `linear-gradient(135deg, ${aura.primary} 0%, ${aura.borderHover} 50%, ${aura.outline} 100%)`,
};

const inputStyle: React.CSSProperties = {
  background: aura.bgInput,
  borderBottom: `1px solid ${aura.borderSubtle}`,
  color: aura.textPrimary,
  fontFamily: aura.fontBody,
  fontSize: 'var(--aura-text-body)',
  transition: 'border-color var(--aura-duration-fast) var(--aura-easing-default)',
};

// ─── Payment Options ────────────────────────────────────────────────────

const PAYMENT_OPTIONS = [
  {
    value: 'payos' as const,
    label: 'PayOS',
    description: { vi: 'Chuyển khoản bảo mật tức thì', en: 'Instant Secure Transfer' },
    icon: Wallet,
  },
  {
    value: 'cod' as const,
    label: 'Cash on Delivery',
    description: { vi: 'Thanh toán khi nhận hàng', en: 'Pay at your doorstep' },
    icon: Banknote,
  },
] as const;

// ─── Loading Skeleton ───────────────────────────────────────────────────

function SkeletonBlock({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <div
      className={cn('animate-pulse rounded', className)}
      style={{ background: aura.bgGlass, ...style }}
    />
  );
}

function CheckoutSkeleton() {
  return (
    <section aria-busy="true" aria-label="Loading checkout" className="py-24">
      <div
        className="mx-auto space-y-12"
        style={{ maxWidth: aura.maxWidth, paddingInline: aura.containerPadding }}
      >
        {/* Title */}
        <SkeletonBlock className="mb-12 h-10 w-72" />
        {/* Two column layout */}
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-12">
          {/* Left column skeleton */}
          <div className="space-y-10 lg:col-span-7">
            {/* Customer info */}
            <div className="space-y-6 rounded-xl p-6" style={glassPanel}>
              <SkeletonBlock className="h-6 w-48" />
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <SkeletonBlock className="h-14 w-full" />
                <SkeletonBlock className="h-14 w-full" />
                <SkeletonBlock className="h-14 w-full md:col-span-2" />
                <SkeletonBlock className="h-20 w-full md:col-span-2" />
              </div>
            </div>
            {/* Payment method */}
            <div className="space-y-6 rounded-xl p-6" style={glassPanel}>
              <SkeletonBlock className="h-6 w-44" />
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <SkeletonBlock className="h-20 w-full" />
                <SkeletonBlock className="h-20 w-full" />
              </div>
            </div>
          </div>
          {/* Right column skeleton */}
          <div className="lg:col-span-5">
            <div className="space-y-6 rounded-xl p-8" style={glassPanel}>
              <SkeletonBlock className="h-6 w-40" />
              {Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4">
                  <SkeletonBlock className="h-16 w-16 shrink-0" />
                  <div className="flex-1 space-y-2">
                    <SkeletonBlock className="h-4 w-32" />
                    <SkeletonBlock className="h-3 w-24" />
                  </div>
                  <SkeletonBlock className="h-4 w-16" />
                </div>
              ))}
              <div className="space-y-3 border-t pt-4" style={{ borderColor: aura.borderSubtle }}>
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

// ─── Input Field ────────────────────────────────────────────────────────

interface FieldProps {
  label: string;
  icon: React.ElementType;
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  multiline?: boolean;
  rows?: number;
}

function Field({ label, icon: Icon, placeholder, value, onChange, type = 'text', multiline, rows = 3 }: Readonly<FieldProps>) {
  const id = `field-${label.toLowerCase().replace(/\s+/g, '-')}`;

  return (
    <div className="flex flex-col gap-2">
      <label
        htmlFor={id}
        className="flex items-center gap-1.5 uppercase tracking-widest"
        style={{
          fontFamily: aura.fontBody,
          fontSize: 'var(--aura-text-label-sm)',
          color: aura.textSecondary,
          fontWeight: 600,
        }}
      >
        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
        {label}
      </label>
      {multiline ? (
        <textarea
          id={id}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={rows}
          className="resize-none rounded-t-sm px-4 py-3 transition-all focus:outline-none"
          style={{
            ...inputStyle,
            borderBottomColor: value ? aura.tertiary : undefined,
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderBottomColor = aura.tertiary;
            e.currentTarget.style.boxShadow = `0 4px 12px -4px ${aura.tertiary}4D`;
          }}
          onBlur={(e) => {
            if (!value) {
              e.currentTarget.style.borderBottomColor = aura.borderSubtle;
            }
            e.currentTarget.style.boxShadow = 'none';
          }}
        />
      ) : (
        <input
          id={id}
          type={type}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="rounded-t-sm px-4 py-3 transition-all focus:outline-none"
          style={{
            ...inputStyle,
            borderBottomColor: value ? aura.tertiary : undefined,
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderBottomColor = aura.tertiary;
            e.currentTarget.style.boxShadow = `0 4px 12px -4px ${aura.tertiary}4D`;
          }}
          onBlur={(e) => {
            if (!value) {
              e.currentTarget.style.borderBottomColor = aura.borderSubtle;
            }
            e.currentTarget.style.boxShadow = 'none';
          }}
        />
      )}
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────

export default function StitchCheckout({
  summary,
  isProcessing = false,
  error = null,
  onPlaceOrder,
  locale = 'vi',
}: Readonly<StitchCheckoutProps>) {
  const [paymentMethod, setPaymentMethod] = useState<'payos' | 'cod'>('payos');
  const [form, setForm] = useState<OrderFormData>({
    fullName: '',
    phone: '',
    address: '',
    notes: '',
    paymentMethod: 'payos',
  });
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isVietnamese = locale === 'vi' || locale.startsWith('vi');
  const t = (vi: string, en: string) => (isVietnamese ? vi : en);

  // ── Loading State ──────────────────────────────────────────────────────
  if (!summary) {
    return <CheckoutSkeleton />;
  }

  // ── Empty State ────────────────────────────────────────────────────────
  if (summary.items.length === 0) {
    return (
      <section className="flex min-h-[60vh] flex-col items-center justify-center gap-6 px-4 text-center" role="status">
        <div
          className="flex h-20 w-20 items-center justify-center rounded-full"
          style={{ background: aura.bgGlass, border: `1px solid ${aura.glassBorder}` }}
        >
          <Package
            style={{ width: 40, height: 40, color: aura.textSecondary }}
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
            {t('Giỏ hàng trống', 'Your cart is empty')}
          </h2>
          <p style={{ color: aura.textSecondary, marginTop: 8 }}>
            {t('Thêm món vào giỏ hàng để tiếp tục', 'Add items to your cart to proceed')}
          </p>
        </div>
      </section>
    );
  }

  // ── Error Display ──────────────────────────────────────────────────────
  const displayError = error || submitError;

  // ── Handlers ───────────────────────────────────────────────────────────
  const updateField = <K extends keyof OrderFormData>(key: K, value: OrderFormData[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    setIsSubmitting(true);
    try {
      await onPlaceOrder({ ...form, paymentMethod });
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : t('Đặt hàng thất bại', 'Order failed'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatPrice = (amount: number) =>
    new Intl.NumberFormat(isVietnamese ? 'vi-VN' : 'en-US', {
      style: 'currency',
      currency: isVietnamese ? 'VND' : 'USD',
      minimumFractionDigits: isVietnamese ? 0 : 2,
    }).format(amount);

  const processing = isProcessing || isSubmitting;

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="pb-32 pt-24"
    >
      <div
        className="mx-auto"
        style={{ maxWidth: aura.maxWidth, paddingInline: aura.containerPadding }}
      >
        {/* ── Title ────────────────────────────────────────────────── */}
        <h1
          className="mb-12 tracking-tight"
          style={{
            fontFamily: aura.fontDisplay,
            fontSize: 'var(--aura-text-display-md)',
            color: aura.primary,
            fontWeight: 500,
          }}
        >
          {t('Xác nhận đơn hàng', 'Finalize Selection')}
        </h1>

        {/* ── Two Column Layout ───────────────────────────────────── */}
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-12">
          {/* ══════ LEFT COLUMN: FORM ═══════════════════════════════ */}
          <div className="space-y-10 lg:col-span-7">
            {/* ── Customer Information ──────────────────────────────── */}
            <section>
              <h2
                className="mb-6 flex items-center gap-3"
                style={{
                  fontFamily: aura.fontDisplay,
                  fontSize: 'var(--aura-text-headline-lg)',
                  color: aura.primary,
                  fontWeight: 500,
                }}
              >
                <User style={{ color: aura.textSecondary }} className="h-6 w-6" aria-hidden="true" />
                {t('Thông tin khách hàng', 'Customer Information')}
              </h2>
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <Field
                  label={t('Họ và tên', 'Full Name')}
                  icon={User}
                  placeholder="Julian Vane"
                  value={form.fullName}
                  onChange={(v) => updateField('fullName', v)}
                />
                <Field
                  label={t('Số điện thoại', 'Phone Number')}
                  icon={Phone}
                  placeholder="+84 123 456 789"
                  value={form.phone}
                  onChange={(v) => updateField('phone', v)}
                  type="tel"
                />
                <div className="md:col-span-2">
                  <Field
                    label={t('Địa chỉ giao hàng', 'Delivery Address')}
                    icon={MapPin}
                    placeholder={t('Số nhà, đường, quận/huyện', '123 Main Street, District 1')}
                    value={form.address}
                    onChange={(v) => updateField('address', v)}
                  />
                </div>
                <div className="md:col-span-2">
                  <Field
                    label={t('Ghi chú đơn hàng', 'Order Notes')}
                    icon={FileText}
                    placeholder={t('Thêm foam cho latte, cảm ơn!', 'Extra foam on the latte, please.')}
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
              <h2
                className="mb-6 flex items-center gap-3"
                style={{
                  fontFamily: aura.fontDisplay,
                  fontSize: 'var(--aura-text-headline-lg)',
                  color: aura.primary,
                  fontWeight: 500,
                }}
              >
                <CreditCard style={{ color: aura.textSecondary }} className="h-6 w-6" aria-hidden="true" />
                {t('Phương thức thanh toán', 'Payment Method')}
              </h2>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {PAYMENT_OPTIONS.map((option) => {
                  const selected = paymentMethod === option.value;
                  const isPayos = option.value === 'payos';
                  const accentColor = isPayos ? aura.tertiary : aura.primary;
                  return (
                    <label
                      key={option.value}
                      className={cn(
                        'relative cursor-pointer rounded-xl p-6 transition-all',
                      )}
                      style={{
                        ...glassPanel,
                        border: selected
                          ? `1px solid ${accentColor}`
                          : `1px solid ${aura.glassBorder}`,
                        background: selected
                          ? `color-mix(in srgb, ${accentColor} 8%, transparent)`
                          : aura.bgGlass,
                        boxShadow: selected && isPayos
                          ? `0 0 15px ${aura.tertiary}33`
                          : undefined,
                      }}
                    >
                      <input
                        type="radio"
                        name="payment"
                        value={option.value}
                        checked={selected}
                        onChange={() => setPaymentMethod(option.value)}
                        className="sr-only peer"
                        aria-describedby={`payment-desc-${option.value}`}
                      />
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div
                            className="flex h-12 w-12 items-center justify-center rounded-full"
                            style={{
                              background: `color-mix(in srgb, ${accentColor} 20%, transparent)`,
                              color: accentColor,
                            }}
                          >
                            <option.icon className="h-6 w-6" aria-hidden="true" />
                          </div>
                          <div>
                            <div
                              style={{
                                fontFamily: aura.fontBody,
                                fontSize: 'var(--aura-text-label-lg)',
                                color: aura.textPrimary,
                                fontWeight: 500,
                              }}
                            >
                              {option.label}
                            </div>
                            <div
                              id={`payment-desc-${option.value}`}
                              className="text-xs"
                              style={{ color: aura.textSecondary }}
                            >
                              {option.description[isVietnamese ? 'vi' : 'en']}
                            </div>
                          </div>
                        </div>
                        <div
                          className="flex h-5 w-5 items-center justify-center rounded-full border-2 transition-colors"
                          style={{
                            borderColor: selected ? accentColor : aura.borderSubtle,
                          }}
                        >
                          <div
                            className="h-2.5 w-2.5 rounded-full transition-opacity"
                            style={{
                              background: selected ? accentColor : 'transparent',
                              opacity: selected ? 1 : 0,
                            }}
                          />
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>
            </section>
          </div>

          {/* ══════ RIGHT COLUMN: ORDER SUMMARY ════════════════════════ */}
          <div className="lg:col-span-5">
            <div
              className="sticky rounded-xl p-8"
              style={{
                ...glassPanel,
                top: 'var(--aura-space-20)',
                boxShadow: aura.shadowLg,
              }}
            >
              <h3
                className="mb-8 border-b pb-4"
                style={{
                  fontFamily: aura.fontDisplay,
                  fontSize: 'var(--aura-text-headline-lg)',
                  color: aura.primary,
                  fontWeight: 500,
                  borderColor: aura.borderSubtle,
                }}
              >
                {t('Tóm tắt đơn hàng', 'Order Summary')}
              </h3>

              {/* Items list */}
              <div
                className="mb-10 max-h-[300px] space-y-6 overflow-y-auto pr-4"
                style={{ scrollbarWidth: 'thin', scrollbarColor: `${aura.outline} transparent` }}
              >
                {summary.items.map((item) => (
                  <div key={item.id} className="flex items-center justify-between">
                    <div className="flex gap-4">
                      {/* Item image */}
                      <div
                        className="h-16 w-16 shrink-0 rounded bg-cover bg-center"
                        style={{ backgroundImage: `url(${item.imageUrl})` }}
                        role="img"
                        aria-label={item.name}
                      />
                      <div className="flex flex-col justify-center">
                        <span
                          style={{
                            fontFamily: aura.fontBody,
                            fontSize: 'var(--aura-text-body-lg)',
                            color: aura.textPrimary,
                          }}
                        >
                          {item.name}
                        </span>
                        <span
                          className="text-xs uppercase tracking-widest"
                          style={{
                            fontFamily: aura.fontBody,
                            color: aura.textSecondary,
                            fontWeight: 600,
                          }}
                        >
                          {item.variant}
                          {' • '}
                          {item.quantity}
                          x
                        </span>
                      </div>
                    </div>
                    <span
                      style={{
                        fontFamily: aura.fontBody,
                        fontSize: 'var(--aura-text-label-lg)',
                        color: aura.tertiary,
                        fontWeight: 500,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {formatPrice(item.price)}
                    </span>
                  </div>
                ))}
              </div>

              {/* Totals */}
              <div className="space-y-4 pt-6" style={{ borderTop: `1px solid ${aura.borderSubtle}` }}>
                <div className="flex justify-between" style={{ color: aura.textSecondary }}>
                  <span style={{ fontFamily: aura.fontBody, fontSize: 'var(--aura-text-label-lg)' }}>
                    {t('Tạm tính', 'Subtotal')}
                  </span>
                  <span style={{ fontFamily: aura.fontBody, fontSize: 'var(--aura-text-label-lg)' }}>
                    {formatPrice(summary.subtotal)}
                  </span>
                </div>
                <div className="flex justify-between" style={{ color: aura.textSecondary }}>
                  <span style={{ fontFamily: aura.fontBody, fontSize: 'var(--aura-text-label-lg)' }}>
                    {summary.taxLabel ?? t('Thuế (5%)', 'Tax (5%)')}
                  </span>
                  <span style={{ fontFamily: aura.fontBody, fontSize: 'var(--aura-text-label-lg)' }}>
                    {formatPrice(summary.tax)}
                  </span>
                </div>
                <div className="flex justify-between" style={{ color: aura.textSecondary }}>
                  <span style={{ fontFamily: aura.fontBody, fontSize: 'var(--aura-text-label-lg)' }}>
                    {summary.deliveryLabel ?? t('Phí giao hàng', 'Delivery Fee')}
                  </span>
                  <span style={{ fontFamily: aura.fontBody, fontSize: 'var(--aura-text-label-lg)' }}>
                    {summary.deliveryFee === 0
                      ? t('Miễn phí', 'Free')
                      : formatPrice(summary.deliveryFee)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ══════ FLOATING FOOTER TOTAL BAR ════════════════════════════ */}
      <footer
        className="fixed bottom-0 left-0 w-full"
        style={{ zIndex: 50 }}
      >
        <div
          className="mx-auto pb-8"
          style={{ maxWidth: aura.maxWidth, paddingInline: aura.containerPadding }}
        >
          <div
            className="flex flex-col items-center gap-4 rounded-full p-6 shadow-[0_-8px_30px_rgb(0,0,0,0.5)] md:flex-row md:justify-between md:px-12"
            style={{
              ...glassPanel,
              border: `1px solid ${aura.borderHover}`,
            }}
          >
            {/* Left info */}
            <div className="flex items-center gap-8">
              <div className="hidden flex-col md:flex">
                <span
                  className="text-xs uppercase tracking-widest"
                  style={{ color: aura.textSecondary }}
                >
                  {t('Số món đã chọn', 'Selected Items')}
                </span>
                <span
                  style={{
                    fontFamily: aura.fontBody,
                    fontSize: 'var(--aura-text-label-lg)',
                    color: aura.textPrimary,
                    fontWeight: 500,
                  }}
                >
                  {summary.items.length} {t('món', 'items')}
                </span>
              </div>
              <div className="flex flex-col items-center md:items-start">
                <span
                  className="text-xs font-bold uppercase tracking-widest"
                  style={{ color: aura.tertiary }}
                >
                  {t('Tổng tiền', 'Total Amount')}
                </span>
                <span
                  style={{
                    fontFamily: aura.fontDisplay,
                    fontSize: 'var(--aura-text-headline-lg)',
                    color: aura.tertiary,
                    fontWeight: 500,
                  }}
                >
                  {formatPrice(summary.total)}
                </span>
              </div>
            </div>

            {/* Error message */}
            {displayError && (
              <div
                className="flex items-center gap-2 text-sm md:absolute md:left-1/2 md:-translate-x-1/2"
                role="alert"
                style={{ color: aura.error }}
              >
                <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{displayError}</span>
              </div>
            )}

            {/* Place Order button */}
            <button
              type="submit"
              disabled={processing}
              className={cn(
                'flex min-w-[240px] items-center justify-center gap-2 rounded-full px-12 py-4 text-center font-bold uppercase tracking-widest shadow-xl transition-all',
                processing
                  ? 'cursor-not-allowed opacity-60'
                  : 'hover:brightness-110 active:scale-95',
              )}
              style={{
                ...chromeGradient,
                color: aura.bgPage,
                fontFamily: aura.fontBody,
                fontSize: 'var(--aura-text-label-lg)',
              }}
            >
              {processing ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
                  {t('Đang xử lý...', 'Processing...')}
                </>
              ) : (
                <>
                  <ShoppingBag className="h-5 w-5" aria-hidden="true" />
                  {t('Đặt hàng', 'Place Order')}
                </>
              )}
            </button>
          </div>
        </div>
      </footer>
    </form>
  );
}
