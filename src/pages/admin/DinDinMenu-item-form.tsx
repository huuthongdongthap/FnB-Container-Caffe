import { useTranslation } from 'react-i18next';
import type { DinDinItem } from './DinDinMenu-types';

interface Props {
  isNew: boolean;
  item: DinDinItem;
  onChange: (item: DinDinItem) => void;
  onSave: () => void;
  onCancel: () => void;
}

export function DinDinItemForm({ isNew, item, onChange, onSave, onCancel }: Props) {
  const { t } = useTranslation('admin');

  return (
    <div className="rounded-2xl p-5 space-y-3" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)' }}>
      <h3 className="text-sm font-semibold text-[var(--aura-text-primary)]">
        {isNew ? t('dindin.addItem', { defaultValue: 'Thêm món' }) : t('edit', { defaultValue: 'Sửa món' })}
      </h3>
      <input
        type="text"
        value={item.name ?? ''}
        onChange={(e) => onChange({ ...item, name: e.target.value })}
        placeholder={t('dindin.itemName', { defaultValue: 'Tên món' })}
        className="w-full rounded-xl px-3 py-2 text-sm bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)]"
      />
      <input
        type="number"
        value={item.price}
        onChange={(e) => onChange({ ...item, price: Number(e.target.value) })}
        placeholder={t('dindin.itemPrice', { defaultValue: 'Giá (VND)' })}
        className="w-full rounded-xl px-3 py-2 text-sm bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)]"
      />
      <textarea
        value={item.description ?? ''}
        onChange={(e) => onChange({ ...item, description: e.target.value })}
        placeholder={t('dindin.itemDesc', { defaultValue: 'Mô tả' })}
        className="w-full rounded-xl px-3 py-2 text-sm bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)]"
      />
      <label className="flex items-center gap-2 text-xs text-[var(--aura-text-secondary)]">
        <input
          type="checkbox"
          checked={item.available}
          onChange={(e) => onChange({ ...item, available: e.target.checked })}
        />
        {t('dindin.available', { defaultValue: 'Còn hàng' })}
      </label>
      <div className="flex gap-2">
        <button type="button" onClick={onSave} disabled={!item.name.trim() || item.price <= 0} className="rounded-full px-4 py-2 text-xs font-semibold bg-[var(--aura-chrome-mid)] text-white disabled:opacity-50">
          {t('save', { defaultValue: 'Lưu' })}
        </button>
        <button type="button" onClick={onCancel} className="rounded-full px-4 py-2 text-xs bg-[rgba(255,255,255,0.08)] text-[var(--aura-text-secondary)]">
          {t('cancel', { defaultValue: 'Hủy' })}
        </button>
      </div>
    </div>
  );
}
