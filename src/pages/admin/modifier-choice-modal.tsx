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
  /** Non-null while editing an existing choice; drives the Edit/Delete affordances. */
  editingChoice: ModifierChoice | null;
  form: ModifierChoiceFormData;
  errors: Record<string, string>;
  onChange: (field: keyof ModifierChoiceFormData, value: string) => void;
  onSave: () => void;
  onEdit: (choice: ModifierChoice) => void;
  onDelete: (choice: ModifierChoice) => void;
  onClose: () => void;
  saving: boolean;
}

export function ModifierChoiceModal({
  open,
  groupName,
  choices,
  editingChoice,
  form,
  errors,
  onChange,
  onSave,
  onEdit,
  onDelete,
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
              <li
                key={choice.id}
                className={`flex items-center justify-between gap-2 px-3 py-2 text-sm ${
                  editingChoice?.id === choice.id ? 'bg-primary/5' : ''
                }`}
              >
                <span className="truncate">{choice.name}</span>
                <span className="flex shrink-0 items-center gap-2">
                  <span className={choice.price_delta > 0 ? 'text-primary' : 'text-muted'}>
                    {formatVndDelta(choice.price_delta)}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onEdit(choice)}
                    aria-label={t('adminMenu.editChoice')}
                  >
                    {t('adminMenu.editChoice')}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onDelete(choice)}
                    aria-label={t('adminMenu.deleteChoice')}
                  >
                    {t('adminMenu.deleteChoice')}
                  </Button>
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
            {editingChoice ? t('common.save') : t('adminMenu.addChoice')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
