import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { DeliveryInfo } from './delivery-info';
import { PaymentMethodSelector } from './payment-method-selector';
import { TipInput } from './tip-input';
import { DeliveryTimeSection } from './delivery-time-section';
import { DiscountCodeSection } from './discount-code-section';
import { OrderSummarySection } from './order-summary-section';
import { CheckoutFormSubmitButton } from './checkout-form-submit-button';
import { checkoutFormSchema, type CheckoutFormData, type PaymentMethod } from '@/lib/validators';
import { INITIAL_FORM } from './checkout-form-constants';
import type { CheckoutFormProps, FormErrors } from './checkout-form-types';

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

  const handleDeliveryTimeChange = useCallback((time: 'now' | 'scheduled') => {
    setForm((p) => ({ ...p, deliveryTime: time }));
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

  const tip = form.tip ?? 0;

  return (
    <form onSubmit={handleSubmit} className="space-y-8" noValidate>
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

      <DeliveryTimeSection
        deliveryTime={form.deliveryTime}
        scheduledTime={form.scheduledTime}
        disabled={isSubmitting}
        onChange={handleChange}
        onDeliveryTimeChange={handleDeliveryTimeChange}
      />

      <PaymentMethodSelector
        selected={form.paymentMethod}
        onChange={handlePaymentChange}
        disabled={isSubmitting}
      />

      <DiscountCodeSection
        discountCode={form.discountCode}
        disabled={isSubmitting}
        onChange={handleChange}
      />

      <TipInput
        value={tip}
        onChange={handleTipChange}
        disabled={isSubmitting}
      />

      <OrderSummarySection
        cartItems={cartItems}
        subtotal={subtotal}
        serviceFee={serviceFee}
        total={total}
        tip={tip}
        qualifiesForFreeDelivery={qualifiesForFreeDelivery}
        remainingForFreeDelivery={remainingForFreeDelivery}
      />

      <CheckoutFormSubmitButton
        total={total}
        tip={tip}
        isSubmitting={isSubmitting}
        hasItems={cartItems.length > 0}
      />
    </form>
  );
}
