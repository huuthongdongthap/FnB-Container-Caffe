import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import type { Promotion, PromotionFormData } from './types';

interface PromotionFormModalProps {
  open: boolean;
  editing: Promotion | null;
  form: PromotionFormData;
  errors: Record<string, string>;
  onChange: (field: keyof PromotionFormData, value: string | boolean) => void;
  onSave: () => void;
  onClose: () => void;
  saving: boolean;
}

export function PromotionFormModal({
  open,
  editing,
  form,
  errors,
  onChange,
  onSave,
  onClose,
  saving,
}: PromotionFormModalProps) {
  const { t } = useTranslation('adminPromotions');

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? t('editTitle') : t('addTitle')}
    >
      <div className="space-y-4">
        {errors._form && (
          <div className="rounded-lg bg-red-500/10 p-3 text-sm text-red-800">
            {errors._form}
          </div>
        )}

        <Input
          label={t('fieldCodeLabel')}
          placeholder={t('fieldCodePlaceholder')}
          value={form.code}
          onChange={(e) => onChange('code', e.target.value.toUpperCase())}
          error={errors.code}
          disabled={!!editing}
        />

        <div className="grid grid-cols-2 gap-3">
          <Input
            label={t('fieldPercentLabel')}
            type="number"
            placeholder={t('fieldPercentPlaceholder')}
            min={1}
            max={100}
            value={form.percent}
            onChange={(e) => onChange('percent', e.target.value)}
            error={errors.percent}
          />
          <Input
            label={t('fieldMaxDiscountLabel')}
            type="number"
            placeholder={t('fieldMaxDiscountPlaceholder')}
            min={0}
            value={form.max_discount}
            onChange={(e) => onChange('max_discount', e.target.value)}
            error={errors.max_discount}
            helperText={t('helperNoLimit')}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Input
            label={t('fieldMinOrderLabel')}
            type="number"
            placeholder={t('fieldMinOrderPlaceholder')}
            min={0}
            value={form.min_order}
            onChange={(e) => onChange('min_order', e.target.value)}
            error={errors.min_order}
            helperText={t('helperNoRequirement')}
          />
          <Input
            label={t('fieldUsageLimitLabel')}
            type="number"
            placeholder={t('fieldUsageLimitPlaceholder')}
            min={0}
            value={form.usage_limit}
            onChange={(e) => onChange('usage_limit', e.target.value)}
            error={errors.usage_limit}
            helperText={t('helperNoLimit')}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-foreground">{t('labelStartDate')}</label>
            <input
              type="datetime-local"
              className="rounded-lg border border-border bg-[var(--aura-bg-elevated)] px-4 py-2.5 text-base text-foreground focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
              value={form.starts_at}
              onChange={(e) => onChange('starts_at', e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-foreground">{t('labelEndDate')}</label>
            <input
              type="datetime-local"
              className="rounded-lg border border-border bg-[var(--aura-bg-elevated)] px-4 py-2.5 text-base text-foreground focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
              value={form.expires_at}
              onChange={(e) => onChange('expires_at', e.target.value)}
            />
            {errors.expires_at && (
              <p className="text-sm text-destructive" role="alert">{errors.expires_at}</p>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-foreground">{t('labelActiveToggle')}</label>
          <button
            type="button"
            role="switch"
            aria-checked={form.is_active}
            onClick={() => onChange('is_active', !form.is_active)}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 ${
              form.is_active ? 'bg-green-500' : 'bg-muted/50'
            }`}
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition-transform duration-200 ${
                form.is_active ? 'translate-x-[22px]' : 'translate-x-[2px]'
              }`}
            />
          </button>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Button variant="secondary" onClick={onClose}>
            {t('cancel')}
          </Button>
          <Button
            onClick={onSave}
            loading={saving}
            disabled={saving}
          >
            {editing ? t('saveChanges') : t('addPromotion')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
