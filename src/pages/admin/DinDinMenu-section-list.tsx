import { useTranslation } from 'react-i18next';
import type { DinDinConfig } from './DinDinMenu-types';
import { EMPTY_ITEM } from './DinDinMenu-constants';

interface Props {
  config: DinDinConfig;
  onStartEdit: (secIdx: number, itIdx: number) => void;
  onRemove: (secIdx: number, itIdx: number) => void;
  onAddItem: (secIdx: number) => void;
}

export function DinDinSectionList({ config, onStartEdit, onRemove, onAddItem }: Props) {
  const { t } = useTranslation('admin');

  return (
    <>
      {config.sections.map((section, secIdx) => (
        <div key={secIdx} className="rounded-2xl p-5 space-y-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <h2 className="text-lg font-semibold text-[var(--aura-text-primary)]">{section.name}</h2>
          <div className="space-y-2">
            {section.items.map((item, itIdx) => (
              <div key={itIdx} className="flex items-center gap-3 text-sm">
                <span className="flex-1 font-body text-[var(--aura-text-primary)]">{item.name}</span>
                <span className="text-[var(--aura-text-secondary)]">₫{item.price.toLocaleString('vi-VN')}</span>
                <span className={`text-xs px-2 py-1 rounded-full ${item.available ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                  {item.available ? '✓' : '✗'}
                </span>
                <button type="button" onClick={() => onStartEdit(secIdx, itIdx)} className="text-xs text-blue-400">{t('edit', { defaultValue: 'Sửa' })}</button>
                <button type="button" onClick={() => onRemove(secIdx, itIdx)} className="text-xs text-red-400">{t('delete', { defaultValue: 'Xoá' })}</button>
              </div>
            ))}
          </div>
          <button type="button" onClick={() => onAddItem(secIdx)} className="text-xs text-[var(--aura-chrome-mid)]">
            {t('dindin.addItem', { defaultValue: '+ Thêm món' })}
          </button>
        </div>
      ))}
    </>
  );
}
