import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Lock as LockIcon } from 'lucide-react';

interface CheckoutFormSubmitButtonProps {
  total: number;
  tip: number;
  isSubmitting: boolean;
  hasItems: boolean;
}

const formatVND = (value: number) =>
  new Intl.NumberFormat('vi-VN').format(value) + '₫';

export function CheckoutFormSubmitButton({
  total,
  tip,
  isSubmitting,
  hasItems,
}: CheckoutFormSubmitButtonProps) {
  const { t } = useTranslation();

  return (
    <>
      <Button
        type="submit"
        size="lg"
        className="w-full"
        loading={isSubmitting}
        disabled={isSubmitting || !hasItems}
      >
        {isSubmitting
          ? t('order.processing')
          : `${t('order.placeOrder')} — ${formatVND(total + tip)}`}
      </Button>

      <p className="text-center text-xs text-muted">
        <LockIcon size={12} className="inline" /> {t('order.securePayment')}
      </p>
    </>
  );
}
