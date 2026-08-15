import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ShoppingBag, CircleUser, User, Wallet } from 'lucide-react';

import { CheckoutNewSkeleton } from './StitchCheckoutNew-skeleton';
import { EmptyCartState } from './StitchCheckoutNew-empty-state';
import { Field } from './StitchCheckoutNew-field';
import { PaymentMethodSelector } from './StitchCheckoutNew-payment-selector';
import { OrderSummaryPanel } from './StitchCheckoutNew-order-summary';
import { CheckoutFooter } from './StitchCheckoutNew-footer';

import type {
  StitchCheckoutNewProps,
  CheckoutNewFormData,
  PaymentMethod,
} from './StitchCheckoutNew-types';

// Re-export types for backward compatibility
export type {
  CheckoutNewItem,
  CheckoutNewSummary,
  CheckoutNewFormData,
  StitchCheckoutNewProps,
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
  const [form, setForm] = useState<CheckoutNewFormData>({
    fullName: '',
    phone: '',
    address: '',
    notes: '',
    paymentMethod: 'payos',
  });
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!summary) return <CheckoutNewSkeleton />;
  if (summary.items.length === 0) return <EmptyCartState />;

  const displayError = error || submitError;
  const processing = isProcessing || isSubmitting;

  const updateField = <K extends keyof CheckoutNewFormData>(
    key: K,
    value: CheckoutNewFormData[K],
  ) => setForm((prev) => ({ ...prev, [key]: value }));

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

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="min-h-screen bg-[var(--aura-surface-container)] font-['Space_Grotesk'] text-[16px] leading-[1.6] text-[#e5e2e1] overflow-x-hidden"
    >
      <header className="fixed top-0 left-0 w-full z-50 flex justify-between items-center px-6 py-4 bg-[#131313]/80 backdrop-blur-xl border-b border-[rgba(198,198,199,0.2)] shadow-sm">
        <a href="/" className="font-['EB_Garamond'] text-[32px] leading-[1.2] font-medium tracking-tight text-[var(--aura-noir-void)]">AURA CAFE</a>
        <div className="flex items-center gap-6">
          <button type="button" className="text-[var(--aura-noir-void)] hover:text-[#efbd8a] transition-colors duration-300" aria-label={t('stitch.cart', 'Cart')}>
            <ShoppingBag className="w-6 h-6" />
          </button>
          <button type="button" className="text-[var(--aura-noir-void)] hover:text-[#efbd8a] transition-colors duration-300" aria-label={t('stitch.account', 'Account')}>
            <CircleUser className="w-6 h-6" />
          </button>
        </div>
      </header>

      <main className="pt-24 pb-32 px-10 max-w-7xl mx-auto">
        <h1 className="font-['EB_Garamond'] text-[48px] leading-[1.1] tracking-[-0.02em] font-medium text-[var(--aura-noir-void)] mb-12">
          {t('stitch.confirmOrder', 'Finalize Selection')}
        </h1>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          <div className="lg:col-span-7 space-y-10">
            <section>
              <h2 className="font-['EB_Garamond'] text-[32px] leading-[1.2] font-medium text-[#c6c6c7] mb-6 flex items-center gap-3">
                <User className="w-8 h-8" aria-hidden="true" />
                {t('stitch.customerInfo', 'Customer Information')}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Field label={t('stitch.fullName', 'Full Name')} placeholder="Julian Vane" value={form.fullName} onChange={(v) => updateField('fullName', v)} />
                <Field label={t('stitch.phone', 'Phone Number')} placeholder="+1 (555) 000-0000" value={form.phone} onChange={(v) => updateField('phone', v)} type="tel" />
                <div className="md:col-span-2">
                  <Field label={t('stitch.deliveryAddress', 'Delivery Address')} placeholder="128 Obsidian Plaza, Nocturne District" value={form.address} onChange={(v) => updateField('address', v)} />
                </div>
                <div className="md:col-span-2">
                  <Field label={t('stitch.orderNotes', 'Order Notes')} placeholder="Extra foam on the latte, please." value={form.notes} onChange={(v) => updateField('notes', v)} multiline rows={3} />
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
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #454748; border-radius: 10px; }
      `}</style>
    </form>
  );
}
