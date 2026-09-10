import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { ShoppingBag, CircleUser, User, Wallet, Award, CreditCard } from 'lucide-react';

import { CheckoutNewSkeleton } from './StitchCheckoutNew-skeleton';
import { EmptyCartState } from './StitchCheckoutNew-empty-state';
import { Field } from './StitchCheckoutNew-field';
import { PaymentMethodSelector } from './StitchCheckoutNew-payment-selector';
import { OrderSummaryPanel } from './StitchCheckoutNew-order-summary';
import { CheckoutFooter } from './StitchCheckoutNew-footer';

import { cn } from '@/lib/cn';
import { apiFetch } from '@/lib/api-client';
import type {
  StitchCheckoutNewProps,
  CheckoutNewFormData,
  PaymentMethod,
  OrderType,
} from './StitchCheckoutNew-types';

interface LoyaltyLookupResult {
  tier: string;
  tier_vi: string;
  balance: number;
  loyalty_points: number;
  member_since: string;
}

// Re-export types for backward compatibility
export type {
  CheckoutNewItem,
  CheckoutNewSummary,
  CheckoutNewFormData,
  StitchCheckoutNewProps,
  OrderType,
} from './StitchCheckoutNew-types';

export function StitchCheckoutNew({
  summary,
  isProcessing = false,
  error = null,
  onPlaceOrder,
  locale = 'vi',
}: Readonly<StitchCheckoutNewProps>) {
  const { t } = useTranslation();
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('payos');
  const [orderType, setOrderType] = useState<OrderType>('delivery');
  const [form, setForm] = useState<CheckoutNewFormData>({
    fullName: '',
    phone: '',
    address: '',
    notes: '',
    paymentMethod: 'payos',
    orderType: 'delivery',
    tableNumber: '',
  });
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loyalty, setLoyalty] = useState<LoyaltyLookupResult | null>(null);
  const [isLookingUp, setIsLookingUp] = useState(false);
  const lookupTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Loyalty lookup: debounce 400ms on phone change, fetch tier + wallet balance
  const lookupLoyalty = useCallback(async (phone: string) => {
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 9 || digits.length > 12) {
      setLoyalty(null);
      return;
    }
    setIsLookingUp(true);
    try {
      const res = await apiFetch<{ ok: boolean; member?: LoyaltyLookupResult }>(
        `/api/loyalty/lookup?phone=${encodeURIComponent(digits)}`
      );
      setLoyalty(res?.ok && res.member ? res.member : null);
    } catch {
      setLoyalty(null);
    } finally {
      setIsLookingUp(false);
    }
  }, []);

  useEffect(() => {
    if (lookupTimerRef.current) clearTimeout(lookupTimerRef.current);
    lookupTimerRef.current = setTimeout(() => lookupLoyalty(form.phone), 400);
    return () => {
      if (lookupTimerRef.current) clearTimeout(lookupTimerRef.current);
    };
  }, [form.phone, lookupLoyalty]);

  useEffect(() => {
    return () => {
      if (lookupTimerRef.current) clearTimeout(lookupTimerRef.current);
    };
  }, []);

  if (!summary) return <CheckoutNewSkeleton />;
  if (summary.items.length === 0) return <EmptyCartState />;

  const displayError = error || submitError;

  // VN mobile numbers: exactly 10 digits starting with 0
  const isPhoneValid = /^0\d{9}$/.test(form.phone.replace(/\s/g, ''));
  const isAddressMissing = orderType === 'delivery' && !form.address.trim();
  const isTableMissing = orderType === 'dine_in' && !form.tableNumber?.trim();
  const canSubmit = isPhoneValid && !isAddressMissing && !isTableMissing;
  const processing = isProcessing || isSubmitting;

  const updateField = <K extends keyof CheckoutNewFormData>(
    key: K,
    value: CheckoutNewFormData[K],
  ) => setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    if (!canSubmit) {
      setSubmitError(
        !isPhoneValid
          ? t('stitch.phoneInvalid', 'Số điện thoại không hợp lệ (VD: 0901234567)')
          : isAddressMissing
            ? t('stitch.addressRequired', 'Vui lòng nhập địa chỉ giao hàng')
            : t('stitch.tableRequired', 'Vui lòng nhập số bàn'),
      );
      return;
    }
    setIsSubmitting(true);
    try {
      await onPlaceOrder({ ...form, paymentMethod, orderType });
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : t('stitch.orderFailed', 'Đặt hàng thất bại'),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="min-h-screen bg-[var(--aura-surface-container)] font-['Space_Grotesk'] text-[16px] leading-[1.6] text-[var(--aura-chrome-bright, #e5e2e1)] overflow-x-hidden"
    >
      <header className="fixed top-0 left-0 w-full z-50 flex justify-between items-center px-6 py-4 bg-[var(--aura-noir-void, #131313)]/80 backdrop-blur-[8px] border-b border-[rgba(var(--aura-chrome-light),0.2)] shadow-sm">
        <a href="/" className="font-['EB_Garamond'] text-2xl sm:text-[32px] leading-[1.2] font-medium tracking-tight text-[var(--aura-chrome-bright)]">AURA CAFE</a>
        <div className="flex items-center gap-6">
          <button type="button" className="text-[var(--aura-chrome-light)] hover:text-[var(--aura-chrome-light, #efbd8a)] transition-colors duration-300" aria-label={t('stitch.cart', 'Cart')}>
            <ShoppingBag className="w-6 h-6" />
          </button>
          <button type="button" className="text-[var(--aura-chrome-light)] hover:text-[var(--aura-chrome-light, #efbd8a)] transition-colors duration-300" aria-label={t('stitch.account', 'Account')}>
            <CircleUser className="w-6 h-6" />
          </button>
        </div>
      </header>

      <main className="pt-24 pb-32 px-4 sm:px-6 lg:px-10 max-w-7xl mx-auto">
        <h1 className="font-['EB_Garamond'] text-[32px] sm:text-[40px] lg:text-[48px] leading-[1.1] tracking-[-0.02em] font-medium text-[var(--aura-chrome-bright)] mb-12">
          {locale?.startsWith('vi') ? 'Xác Nhận Đơn Hàng & Thanh Toán' : t('stitch.confirmOrder', 'Finalize Selection')}
        </h1>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          <div className="lg:col-span-7 space-y-10">
            {/* Order Type Selection */}
            <section className="p-6 rounded-2xl bg-white/[0.02] border border-[rgba(var(--aura-chrome-light),0.15)]">
              <label className="block font-['Space_Grotesk'] text-[14px] leading-[1.2] font-medium tracking-[0.1em] uppercase text-[var(--aura-chrome-soft)] mb-4">
                Hình Thức Nhận Món / Order Type
              </label>
              <div className="grid grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => { setOrderType('delivery'); updateField('orderType', 'delivery'); }}
                  className={cn(
                    'py-3.5 px-3 rounded-xl border text-sm font-medium transition-all text-center flex flex-col items-center gap-1.5 cursor-pointer',
                    orderType === 'delivery'
                      ? 'border-[var(--aura-chrome-bright)] bg-[rgba(var(--aura-chrome-light),0.15)] text-[var(--aura-chrome-bright)] shadow-[0_0_15px_rgba(var(--aura-chrome-light),0.2)]'
                      : 'border-white/[0.1] bg-white/[0.02] text-[var(--aura-chrome-soft)] hover:border-white/[0.2]'
                  )}
                >
                  <span className="text-2xl">🛵</span>
                  <span className="font-semibold">Giao tận nơi</span>
                  <span className="text-[11px] opacity-70">TP. Sa Đéc</span>
                </button>

                <button
                  type="button"
                  onClick={() => { setOrderType('takeaway'); updateField('orderType', 'takeaway'); }}
                  className={cn(
                    'py-3.5 px-3 rounded-xl border text-sm font-medium transition-all text-center flex flex-col items-center gap-1.5 cursor-pointer',
                    orderType === 'takeaway'
                      ? 'border-[var(--aura-chrome-bright)] bg-[rgba(var(--aura-chrome-light),0.15)] text-[var(--aura-chrome-bright)] shadow-[0_0_15px_rgba(var(--aura-chrome-light),0.2)]'
                      : 'border-white/[0.1] bg-white/[0.02] text-[var(--aura-chrome-soft)] hover:border-white/[0.2]'
                  )}
                >
                  <span className="text-2xl">🛍️</span>
                  <span className="font-semibold">Mang đi</span>
                  <span className="text-[11px] opacity-70">Lấy tại quầy bar</span>
                </button>

                <button
                  type="button"
                  onClick={() => { setOrderType('dine_in'); updateField('orderType', 'dine_in'); }}
                  className={cn(
                    'py-3.5 px-3 rounded-xl border text-sm font-medium transition-all text-center flex flex-col items-center gap-1.5 cursor-pointer',
                    orderType === 'dine_in'
                      ? 'border-[var(--aura-chrome-bright)] bg-[rgba(var(--aura-chrome-light),0.15)] text-[var(--aura-chrome-bright)] shadow-[0_0_15px_rgba(var(--aura-chrome-light),0.2)]'
                      : 'border-white/[0.1] bg-white/[0.02] text-[var(--aura-chrome-soft)] hover:border-white/[0.2]'
                  )}
                >
                  <span className="text-2xl">☕</span>
                  <span className="font-semibold">Tại quán</span>
                  <span className="text-[11px] opacity-70">Chọn số bàn</span>
                </button>
              </div>
            </section>

            <section>
              <h2 className="font-['EB_Garamond'] text-[32px] leading-[1.2] font-medium text-[var(--aura-text-body, #c6c6c7)] mb-6 flex items-center gap-3">
                <User className="w-8 h-8" aria-hidden="true" />
                {t('stitch.customerInfo', 'Thông Tin Khách Hàng')}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Field
                  label={locale?.startsWith('vi') ? 'Họ và Tên' : t('stitch.fullName', 'Full Name')}
                  placeholder={locale?.startsWith('vi') ? 'Ví dụ: Nguyễn Văn A' : 'Julian Vane'}
                  value={form.fullName}
                  onChange={(v) => updateField('fullName', v)}
                />
                <div>
                  <Field
                    label={locale?.startsWith('vi') ? 'Số Điện Thoại' : t('stitch.phone', 'Phone Number')}
                    placeholder="0901 234 567"
                    value={form.phone}
                    onChange={(v) => updateField('phone', v)}
                    type="tel"
                  />
                  <p className="mt-1.5 text-xs text-[var(--aura-chrome-bright)]/80 flex items-center gap-1">
                    <span>✨</span>
                    <span>Tự động tích điểm & hoàn tiền vào Ví Aura (1.0x - 1.5x)</span>
                  </p>
                  {form.phone && !isPhoneValid && (
                    <p className="mt-1 text-xs text-red-400" data-testid="phone-error">
                      {t('stitch.phoneInvalid', 'Số điện thoại không hợp lệ (VD: 0901234567)')}
                    </p>
                  )}

                  {/* Loyalty tier badge + wallet balance chip (debounced lookup) */}
                  {isLookingUp && (
                    <p className="mt-1 text-xs text-[var(--aura-chrome-mid)] animate-pulse" data-testid="loyalty-lookup-loading">
                      Đang tra cứu thành viên...
                    </p>
                  )}
                  {!isLookingUp && loyalty && (
                    <div
                      className="mt-2 flex flex-wrap items-center gap-2"
                      data-testid="loyalty-member-badge"
                    >
                      <span
                        className={cn(
                          'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-semibold',
                          'border-[rgba(var(--aura-chrome-light),0.4)] bg-[rgba(var(--aura-chrome-light),0.12)] text-[var(--aura-chrome-bright)]'
                        )}
                      >
                        <Award className="w-3.5 h-3.5" aria-hidden="true" />
                        {loyalty.tier_vi} · {loyalty.loyalty_points.toLocaleString('vi-VN')} điểm
                      </span>
                      <span
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-semibold border-white/[0.12] bg-white/[0.04] text-[var(--aura-chrome-soft)]"
                        data-testid="loyalty-wallet-balance"
                      >
                        <CreditCard className="w-3.5 h-3.5" aria-hidden="true" />
                        Ví Aura: {loyalty.balance.toLocaleString('vi-VN')}₫
                      </span>
                    </div>
                  )}
                </div>

                {orderType === 'delivery' && (
                  <div className="md:col-span-2">
                    <Field
                      label={locale?.startsWith('vi') ? 'Địa Chỉ Giao Hàng (Sa Đéc) *' : t('stitch.deliveryAddress', 'Delivery Address *')}
                      placeholder="Số nhà, tên đường, Phường 1 / Phường 2 / Tân Quy Đông..."
                      value={form.address}
                      onChange={(v) => updateField('address', v)}
                    />
                    {isAddressMissing && (
                      <p className="mt-1 text-xs text-red-400" data-testid="address-error">
                        {t('stitch.addressRequired', 'Vui lòng nhập địa chỉ giao hàng')}
                      </p>
                    )}
                  </div>
                )}

                {orderType === 'dine_in' && (
                  <div className="md:col-span-2">
                    <Field
                      label="Số Bàn (Bàn 1 đến 12) *"
                      placeholder="Ví dụ: Bàn 5"
                      value={form.tableNumber || ''}
                      onChange={(v) => updateField('tableNumber', v)}
                    />
                    {isTableMissing && (
                      <p className="mt-1 text-xs text-red-400" data-testid="table-error">
                        {t('stitch.tableRequired', 'Vui lòng nhập số bàn')}
                      </p>
                    )}
                  </div>
                )}

                {orderType === 'takeaway' && (
                  <div className="md:col-span-2 p-3.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-xs text-[var(--aura-chrome-bright)]/80 flex items-center gap-2">
                    <span className="text-base">📍</span>
                    <span>Điểm lấy món: Quầy Bar AURA CAFE — 39 Nguyễn Tất Thành, TP. Sa Đéc</span>
                  </div>
                )}

                <div className="md:col-span-2">
                  <Field
                    label={locale?.startsWith('vi') ? 'Ghi Chú Đơn Hàng' : t('stitch.orderNotes', 'Order Notes')}
                    placeholder="Ví dụ: ít đá, ít đường, gọi trước khi giao..."
                    value={form.notes}
                    onChange={(v) => updateField('notes', v)}
                    multiline
                    rows={3}
                  />
                </div>
              </div>
            </section>

            <PaymentMethodSelector selected={paymentMethod} onSelect={setPaymentMethod} />
          </div>

          <OrderSummaryPanel summary={summary} locale={locale} />
        </div>
      </main>

      <CheckoutFooter summary={summary} locale={locale} processing={processing} displayError={displayError} />

      <div className="fixed inset-0 -z-10 pointer-events-none opacity-40" aria-hidden="true" />

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: var(--aura-text-muted, #8A8E96); border-radius: 10px; }
      `}</style>
    </form>
  );
}
