import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';

interface DiscountCodeSectionProps {
  discountCode: string | undefined;
  disabled: boolean;
  onChange: (field: string, value: string) => void;
}

export function DiscountCodeSection({
  discountCode,
  disabled,
  onChange,
}: DiscountCodeSectionProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-2">
      <h3 className="font-display text-lg font-semibold text-foreground">{t('order.discountCode')}</h3>
      <div className="flex gap-2">
        <input
          type="text"
          placeholder={t('order.discountPlaceholder')}
          value={discountCode ?? ''}
          onChange={(e) => onChange('discountCode', e.target.value)}
          disabled={disabled}
          className="flex-1 rounded-lg border border-border bg-[var(--aura-bg-input)] px-4 py-2.5 text-base placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent"
        />
        <Button type="button" variant="secondary" disabled={disabled}>
          {t('order.apply')}
        </Button>
      </div>
    </div>
  );
}
