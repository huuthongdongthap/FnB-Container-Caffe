import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { cn } from '@/lib/cn';
import type { Product, ProductFormData, Category } from './types';

interface ProductModalProps {
  open: boolean;
  editing: Product | null;
  form: ProductFormData;
  errors: Record<string, string>;
  categories: Category[];
  onChange: (field: keyof ProductFormData, value: string | boolean) => void;
  onSave: () => void;
  onClose: () => void;
  saving: boolean;
}

export function ProductModal({
  open,
  editing,
  form,
  errors,
  categories,
  onChange,
  onSave,
  onClose,
  saving,
}: ProductModalProps) {
  const { t } = useTranslation();
  return (
    <Modal open={open} onClose={onClose} title={editing ? t('adminMenu.editProduct') : t('adminMenu.addProduct')}>
      <div className="space-y-4">
        {errors._form && (
          <div className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{errors._form}</div>
        )}

        <Input
          label={t('adminMenu.fieldName')}
          placeholder={t('adminMenu.namePlaceholder')}
          value={form.name}
          onChange={(e) => onChange('name', e.target.value)}
          error={errors.name}
        />

        <Input
          label={t('adminMenu.fieldSlug')}
          placeholder="ten-san-pham"
          value={form.slug}
          onChange={(e) => onChange('slug', e.target.value)}
          helperText={t('adminMenu.slugHelper')}
        />

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-foreground">{t('adminMenu.fieldDescription')}</label>
          <textarea
            className="rounded-lg border border-border bg-white px-4 py-2.5 text-base text-foreground placeholder:text-muted transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent min-h-[80px] resize-y"
            placeholder={t('adminMenu.descriptionPlaceholder')}
            value={form.description}
            onChange={(e) => onChange('description', e.target.value)}
          />
        </div>

        <Input
          label={t('adminMenu.fieldPrice')}
          type="number"
          placeholder="0"
          value={form.price}
          onChange={(e) => onChange('price', e.target.value)}
          error={errors.price}
        />

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-foreground">{t('adminMenu.fieldCategory')}</label>
          <select
            className={cn(
              'rounded-lg border border-border bg-white px-4 py-2.5 text-base text-foreground transition-colors duration-150',
              'focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent',
              errors.category_id && 'border-destructive',
            )}
            value={form.category_id}
            onChange={(e) => onChange('category_id', e.target.value)}
          >
            <option value="">{t('adminMenu.selectCategory')}</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>{cat.name}</option>
            ))}
          </select>
          {errors.category_id && (
            <p className="text-sm text-destructive" role="alert">{errors.category_id}</p>
          )}
        </div>

        <Input
          label={t('adminMenu.fieldImageUrl')}
          placeholder="https://..."
          value={form.image_url}
          onChange={(e) => onChange('image_url', e.target.value)}
        />

        <Input
          label={t('adminMenu.fieldSortOrder')}
          type="number"
          placeholder="0"
          value={String(form.sort_order)}
          onChange={(e) => onChange('sort_order', e.target.value)}
        />

        <div className="flex items-center gap-2">
          <input
            id="product-available"
            type="checkbox"
            checked={form.is_available}
            onChange={(e) => onChange('is_available', e.target.checked)}
            className="h-4 w-4 rounded border-border"
          />
          <label htmlFor="product-available" className="text-sm font-medium text-foreground">{t('adminMenu.available')}</label>
        </div>

        <div className="flex items-center gap-2">
          <input
            id="product-is-variable"
            type="checkbox"
            checked={form.is_variable_price}
            onChange={(e) => onChange('is_variable_price', e.target.checked)}
            className="h-4 w-4 rounded border-border"
          />
          <label htmlFor="product-is-variable" className="text-sm font-medium text-foreground">{t('adminMenu.variablePrice')}</label>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose}>{t('common.cancel')}</Button>
          <Button onClick={onSave} disabled={saving}>
            {saving ? t('common.loading') : t('common.save')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
