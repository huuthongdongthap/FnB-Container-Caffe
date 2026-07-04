import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { DeliveryInfo } from './delivery-info';
import { PaymentMethodSelector } from './payment-method-selector';
import { TipInput } from './tip-input';
import { OrderSummary } from './order-summary';
import { checkoutFormSchema, type CheckoutFormData, type PaymentMethod } from '@/lib/validators';
import { Zap, Calendar, Lock as LockIcon } from 'lucide-react';

interface CheckoutFormProps {
  cartItems: Array<{ id: string; name: string; price: number; quantity: number }>;
  subtotal: number;
  serviceFee: number;
  total: number;
  qualifiesForFreeDelivery: boolean;
  remainingForFreeDelivery: number;
  isSubmitting: boolean;
  onSubmit: (data: CheckoutFormData) => void;
  onFormChange?: (data: { fullName: string; phone: string; paymentMethod: string }) => void;
}

type FormErrors = Record<string, string | undefined>;

const INITIAL_FORM: CheckoutFormData = {
  fullName: '',
  email: '',
  phone: '',
  address: '',
  ward: '',
  notes: '',
  deliveryTime: 'now',
  scheduledTime: '',
  paymentMethod: 'cod',
  discountCode: '',
  tip: 0,
};

export function CheckoutForm({
  cartItems,
  subtotal,
  serviceFee,
  total,
  qualifiesForFreeDelivery,
  remainingForFreeDelivery,
  isSubmitting,
  onSubmit,
  onFormChange,
}: CheckoutFormProps) {
  const { t } = useTranslation();
  const [form, setForm] = useState<CheckoutFormData>(INITIAL_FORM);
  const [errors, setErrors] = useState<FormErrors>({});

  const notifyFormChange = useCallback(
    (latest: CheckoutFormData) => {
      onFormChange?.({
        fullName: latest.fullName,
        phone: latest.phone,
        paymentMethod: latest.paymentMethod,
      });
    },
    [onFormChange],
  );

  const handleChange = useCallback(
    (field: string, value: string) => {
      setForm((prev) => {
        const next = { ...prev, [field]: value };
        notifyFormChange(next);
        return next;
      });
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    },
    [notifyFormChange],
  );

  const handlePaymentChange = useCallback(
    (method: PaymentMethod) => {
      setForm((prev) => {
        const next = { ...prev, paymentMethod: method };
        notifyFormChange(next);
        return next;
      });
    },
    [notifyFormChange],
  );

  const handleTipChange = useCallback((tip: number) => {
    setForm((prev) => ({ ...prev, tip }));
  }, []);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const result = checkoutFormSchema.safeParse(form);
      if (!result.success) {
        const fieldErrors: FormErrors = {};
        for (const issue of result.error.issues) {
          const path = issue.path[0] as string;
          if (!fieldErrors[path]) {
            fieldErrors[path] = issue.message;
          }
        }
        setErrors(fieldErrors);
        return;
      }
      setErrors({});
      onSubmit(result.data);
    },
    [form, onSubmit],
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-8" noValidate>
      {/* Delivery Info */}
      <DeliveryInfo
        fullName={form.fullName}
        email={form.email ?? ''}
        phone={form.phone}
        address={form.address}
        ward={form.ward ?? ''}
        notes={form.notes ?? ''}
        errors={errors}
        onChange={handleChange}
        disabled={isSubmitting}
      />

      {/* Delivery Time */}
      <fieldset className="space-y-3" disabled={isSubmitting}>
        <legend className="font-display text-lg font-semibold text-foreground">
          {t('order.deliveryTime')}
        </legend>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => setForm((p) => ({ ...p, deliveryTime: 'now' }))}
            className={`flex-1 rounded-xl border-2 p-4 text-left transition-all ${
              form.deliveryTime === 'now'
                ? 'border-accent-warm bg-accent-warm/5 shadow-md'
                : 'border-border/30 hover:border-border/60'
            }`}
          >
            <span className="text-xl"><Zap size={20} /></span>
            <div className="mt-1 font-medium text-foreground">{t('order.deliverNow')}</div>
            <div className="text-xs text-muted">{t('order.deliverNowEstimate')}</div>
          </button>
          <button
            type="button"
            onClick={() => setForm((p) => ({ ...p, deliveryTime: 'scheduled' }))}
            className={`flex-1 rounded-xl border-2 p-4 text-left transition-all ${
              form.deliveryTime === 'scheduled'
                ? 'border-accent-warm bg-accent-warm/5 shadow-md'
                : 'border-border/30 hover:border-border/60'
            }`}
          >
            <span className="text-xl"><Calendar size={20} /></span>
            <div className="mt-1 font-medium text-foreground">{t('order.schedule')}</div>
            <div className="text-xs text-muted">{t('order.scheduleDesc')}</div>
          </button>
        </div>
        {form.deliveryTime === 'scheduled' && (
          <input
            type="datetime-local"
            className="w-full rounded-lg border border-border bg-[var(--aura-bg-input)] px-4 py-2.5 text-base"
            value={form.scheduledTime ?? ''}
            onChange={(e) => handleChange('scheduledTime', e.target.value)}
          />
        )}
      </fieldset>

      {/* Payment Method */}
      <PaymentMethodSelector
        selected={form.paymentMethod}
        onChange={handlePaymentChange}
        disabled={isSubmitting}
      />

      {/* Discount */}
      <div className="space-y-2">
        <h3 className="font-display text-lg font-semibold text-foreground">{t('order.discountCode')}</h3>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder={t('order.discountPlaceholder')}
            value={form.discountCode ?? ''}
            onChange={(e) => handleChange('discountCode', e.target.value)}
            disabled={isSubmitting}
            className="flex-1 rounded-lg border border-border bg-[var(--aura-bg-input)] px-4 py-2.5 text-base placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent"
          />
          <Button type="button" variant="secondary" disabled={isSubmitting}>
            {t('order.apply')}
          </Button>
        </div>
      </div>

      {/* Tip */}
      <TipInput
        value={form.tip ?? 0}
        onChange={handleTipChange}
        disabled={isSubmitting}
      />

      {/* Order Summary Sidebar (desktop) */}
      <div className="rounded-xl border border-border/20 bg-background/50 p-6">
        <h3 className="mb-4 font-display text-lg font-semibold text-foreground">
          {t('order.summary')}
        </h3>
        {/* Mini items list */}
        <div className="mb-4 space-y-2">
          {cartItems.map((item) => (
            <div key={item.id} className="flex justify-between text-sm">
              <span className="text-muted">
                {item.name} <span className="text-muted/60">x{item.quantity}</span>
              </span>
              <span className="tabular-nums text-foreground">
                {new Intl.NumberFormat('vi-VN').format(item.price * item.quantity) + '₫'}
              </span>
            </div>
          ))}
        </div>
        <OrderSummary
          subtotal={subtotal}
          serviceFee={serviceFee}
          deliveryFee={0}
          discount={0}
          total={total + (form.tip ?? 0)}
          qualifiesForFreeDelivery={qualifiesForFreeDelivery}
          remainingForFreeDelivery={remainingForFreeDelivery}
        />
      </div>

      {/* Submit */}
      <Button
        type="submit"
        size="lg"
        className="w-full"
        loading={isSubmitting}
        disabled={isSubmitting || cartItems.length === 0}
      >
        {isSubmitting ? t('order.processing') : `${t('order.placeOrder')} — ${new Intl.NumberFormat('vi-VN').format(total + (form.tip ?? 0))}₫`}
      </Button>

      <p className="text-center text-xs text-muted">
        <LockIcon size={12} className="inline" /> {t('order.securePayment')}
      </p>
    </form>
  );
}
