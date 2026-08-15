import { useTranslation } from 'react-i18next';
import { Zap, Calendar } from 'lucide-react';

interface DeliveryTimeSectionProps {
  deliveryTime: string;
  scheduledTime: string | undefined;
  disabled: boolean;
  onChange: (field: string, value: string) => void;
  onDeliveryTimeChange: (time: 'now' | 'scheduled') => void;
}

export function DeliveryTimeSection({
  deliveryTime,
  scheduledTime,
  disabled,
  onChange,
  onDeliveryTimeChange,
}: DeliveryTimeSectionProps) {
  const { t } = useTranslation();

  return (
    <fieldset className="space-y-3" disabled={disabled}>
      <legend className="font-display text-lg font-semibold text-foreground">
        {t('order.deliveryTime')}
      </legend>
      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => onDeliveryTimeChange('now')}
          className={`flex-1 rounded-xl border-2 p-4 text-left transition-all ${
            deliveryTime === 'now'
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
          onClick={() => onDeliveryTimeChange('scheduled')}
          className={`flex-1 rounded-xl border-2 p-4 text-left transition-all ${
            deliveryTime === 'scheduled'
              ? 'border-accent-warm bg-accent-warm/5 shadow-md'
              : 'border-border/30 hover:border-border/60'
          }`}
        >
          <span className="text-xl"><Calendar size={20} /></span>
          <div className="mt-1 font-medium text-foreground">{t('order.schedule')}</div>
          <div className="text-xs text-muted">{t('order.scheduleDesc')}</div>
        </button>
      </div>
      {deliveryTime === 'scheduled' && (
        <input
          type="datetime-local"
          className="w-full rounded-lg border border-border bg-[var(--aura-bg-input)] px-4 py-2.5 text-base"
          value={scheduledTime ?? ''}
          onChange={(e) => onChange('scheduledTime', e.target.value)}
        />
      )}
    </fieldset>
  );
}
