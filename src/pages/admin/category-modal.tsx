import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import type { Category, CategoryFormData } from './types';

interface CategoryModalProps {
  open: boolean;
  editing: Category | null;
  form: CategoryFormData;
  errors: Record<string, string>;
  onChange: (field: keyof CategoryFormData, value: string) => void;
  onSave: () => void;
  onClose: () => void;
  saving: boolean;
}

export function CategoryModal({
  open,
  editing,
  form,
  errors,
  onChange,
  onSave,
  onClose,
  saving,
}: CategoryModalProps) {
  const { t } = useTranslation();
  return (
    <Modal open={open} onClose={onClose} title={editing ? t('adminMenu.editCategory') : t('adminMenu.addCategory')}>
      <div className="space-y-4">
        {errors._form && (
          <div className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{errors._form}</div>
        )}

        <Input
          label={t('adminMenu.fieldNameCategory')}
          placeholder={t('adminMenu.categoryNamePlaceholder')}
          value={form.name}
          onChange={(e) => onChange('name', e.target.value)}
          error={errors.name}
        />

        <Input
          label={t('adminMenu.fieldSlug')}
          placeholder="ten-danh-muc"
          value={form.slug}
          onChange={(e) => onChange('slug', e.target.value)}
          helperText={t('adminMenu.slugCategoryHelper')}
        />

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
            {editing ? t('common.save') : t('adminMenu.addCategory')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
