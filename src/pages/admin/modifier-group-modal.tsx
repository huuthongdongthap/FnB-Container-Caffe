import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import type { ModifierGroupFormData } from './types';

interface ModifierGroupModalProps {
  open: boolean;
  form: ModifierGroupFormData;
  errors: Record<string, string>;
  onChange: (field: keyof ModifierGroupFormData, value: string | boolean) => void;
  onSave: () => void;
  onClose: () => void;
  saving: boolean;
}

export function ModifierGroupModal({
  open,
  form,
  errors,
  onChange,
  onSave,
  onClose,
  saving,
}: ModifierGroupModalProps) {
  const { t } = useTranslation();

  return (
    <Modal open={open} onClose={onClose} title={t('adminMenu.addModifierGroup')}>
      <div className="space-y-4">
        {errors._form && (
          <div className="rounded-lg bg-red-500/10 border border-red-500/30 p-3 text-sm text-red-300">{errors._form}</div>
        )}

        <Input
          label={t('adminMenu.fieldNameCategory')}
          placeholder={t('adminMenu.modifierGroupNamePlaceholder')}
          value={form.name}
          onChange={(e) => onChange('name', e.target.value)}
          error={errors.name}
        />

        <div>
          <label className="mb-1.5 block text-sm font-medium">{t('adminMenu.colType')}</label>
          <select
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            value={form.type}
            onChange={(e) => onChange('type', e.target.value)}
          >
            <option value="single">{t('adminMenu.modifierTypeSingle')}</option>
            <option value="multiple">{t('adminMenu.modifierTypeMultiple')}</option>
          </select>
          <p className="mt-1 text-xs text-muted">{t('adminMenu.modifierTypeHelper')}</p>
        </div>

        <Input
          label={t('adminMenu.fieldSortOrder')}
          type="number"
          placeholder="0"
          value={form.sort_order}
          onChange={(e) => onChange('sort_order', e.target.value)}
        />

        <div className="flex justify-end gap-3 pt-2">
          <Button variant="secondary" onClick={onClose}>{t('common.cancel')}</Button>
          <Button onClick={onSave} loading={saving} disabled={saving}>
            {t('adminMenu.addModifierGroup')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
