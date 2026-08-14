import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import type { PlanRecord, PlanFormData } from './subscription-types';

interface PlanModalProps {
  open: boolean;
  editing: PlanRecord | null;
  form: PlanFormData;
  errors: Record<string, string>;
  onChange: (field: keyof PlanFormData, value: string | boolean) => void;
  onSave: () => void;
  onClose: () => void;
  saving: boolean;
  t: (key: string, options?: Record<string, unknown>) => string;
}

export function PlanModal({
  open,
  editing,
  form,
  errors,
  onChange,
  onSave,
  onClose,
  saving,
  t,
}: PlanModalProps) {
  return (
    <Modal open={open} onClose={onClose} title={editing ? t('editPlanTitle') : t('addPlanTitle')}>
      <div className="max-h-[70vh] space-y-4 overflow-y-auto">
        {errors._form && (
          <div className="rounded-lg bg-red-500/10 p-3 text-sm text-red-800">{errors._form}</div>
        )}

        <Input label={t('fieldPlanName')} placeholder={t('fieldPlanNamePlaceholder')} value={form.name} onChange={(e) => onChange('name', e.target.value)} error={errors.name} />
        <Input label={t('fieldSlug')} placeholder={t('fieldSlugPlaceholder')} value={form.slug} onChange={(e) => onChange('slug', e.target.value)} />
        <Input label={t('fieldDescription')} placeholder={t('fieldDescriptionPlaceholder')} value={form.description} onChange={(e) => onChange('description', e.target.value)} />

        <div className="grid grid-cols-2 gap-3">
          <Input label={t('fieldContainerSize')} placeholder={t('fieldContainerSizePlaceholder')} value={form.container_size} onChange={(e) => onChange('container_size', e.target.value)} />
          <Input label={t('fieldMaxOccupants')} type="number" min={1} value={form.max_occupants} onChange={(e) => onChange('max_occupants', e.target.value)} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Input label={t('fieldMonthlyPrice')} type="number" min={0} placeholder={t('fieldMonthlyPricePlaceholder')} value={form.monthly_price_vnd} onChange={(e) => onChange('monthly_price_vnd', e.target.value)} error={errors.monthly_price_vnd} />
          <Input label={t('fieldDeposit')} type="number" min={0} placeholder={t('fieldDepositPlaceholder')} value={form.deposit_vnd} onChange={(e) => onChange('deposit_vnd', e.target.value)} />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-foreground">{t('fieldFeaturesLabel')}</label>
          <textarea
            className="min-h-[100px] rounded-lg border border-border bg-[var(--aura-bg-elevated)] px-4 py-2.5 text-base text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
            placeholder={t('fieldFeaturesPlaceholder')}
            value={form.features}
            onChange={(e) => onChange('features', e.target.value)}
          />
        </div>

        <Input label={t('fieldSortOrder')} type="number" min={0} value={form.sort_order} onChange={(e) => onChange('sort_order', e.target.value)} helperText={t('helperSortOrder')} />

        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-foreground">{t('labelPopular')}</label>
          <button
            type="button"
            role="switch"
            aria-checked={form.is_popular}
            onClick={() => onChange('is_popular', !form.is_popular)}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 ${
              form.is_popular ? 'bg-accent' : 'bg-muted/50'
            }`}
          >
            <span className={`inline-block h-5 w-5 transform rounded-full bg-[var(--aura-bg-elevated)] shadow-sm ring-0 transition-transform duration-200 ${form.is_popular ? 'translate-x-[22px]' : 'translate-x-[2px]'}`} />
          </button>
        </div>

        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-foreground">{t('labelActivePlan')}</label>
          <button
            type="button"
            role="switch"
            aria-checked={form.is_active}
            onClick={() => onChange('is_active', !form.is_active)}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 ${
              form.is_active ? 'bg-green-500' : 'bg-muted/50'
            }`}
          >
            <span className={`inline-block h-5 w-5 transform rounded-full bg-[var(--aura-bg-elevated)] shadow-sm ring-0 transition-transform duration-200 ${form.is_active ? 'translate-x-[22px]' : 'translate-x-[2px]'}`} />
          </button>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Button variant="secondary" onClick={onClose}>{t('cancel')}</Button>
          <Button onClick={onSave} loading={saving} disabled={saving}>
            {editing ? t('saveChanges') : t('addPlan')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
