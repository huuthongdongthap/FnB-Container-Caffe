import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import type { ModifierChoice, ModifierChoiceFormData } from './types';
import { formatVndDelta } from './modifier-format';

interface ModifierChoiceModalProps {
  open: boolean;
  groupName: string;
  /** Existing choices, shown so staff can see what they already priced. */
  choices: ModifierChoice[];
  form: ModifierChoiceFormData;
  errors: Record<string, string>;
  onChange: (field: keyof ModifierChoiceFormData, value: string) => void;
  onSave: () => void;
  onClose: () => void;
  saving: boolean;
}

export function ModifierChoiceModal({
  open,
  groupName,
  choices,
  form,
  errors,
  onChange,
  onSave,
  onClose,
  saving,
}: ModifierChoiceModalProps) {
  const { t } = useTranslation();

  return (
    <Modal open={open} onClose={onClose} title={`${t('adminMenu.manageChoices')} — ${groupName}`}>
      <div className="space-y-4">
        {errors._form && (
          <div className="rounded-lg bg-red-500/10 border border-red-500/30 p-3 text-sm text-red-300">{errors._form}</div>
        )}

        {choices.length > 0 && (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {choices.map((choice) => (
              <li key={choice.id} className="flex items-center justify-between px-3 py-2 text-sm">
                <span>{choice.name}</span>
                <span className={choice.price_delta > 0 ? 'text-primary' : 'text-muted'}>
                  {formatVndDelta(choice.price_delta)}
                </span>
              </li>
            ))}
          </ul>
        )}

        <Input
          label={t('adminMenu.fieldChoiceName')}
          placeholder={t('adminMenu.choiceNamePlaceholder')}
          value={form.name}
          onChange={(e) => onChange('name', e.target.value)}
          error={errors.name}
        />

        <Input
          label={t('adminMenu.fieldPriceDelta')}
          type="number"
          step={1}
          placeholder="0"
          value={form.price_delta}
          onChange={(e) => onChange('price_delta', e.target.value)}
          error={errors.price_delta}
          helperText={t('adminMenu.priceDeltaHelper')}
        />

        <div className="flex justify-end gap-3 pt-2">
          <Button variant="secondary" onClick={onClose}>{t('common.cancel')}</Button>
          <Button onClick={onSave} loading={saving} disabled={saving}>
            {t('adminMenu.addChoice')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
