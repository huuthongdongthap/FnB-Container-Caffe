'use client';

import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { HelmetHead } from '@/components/seo/HelmetHead';
import { EMPTY_ITEM } from './DinDinMenu-constants';
import { useDinDinMenu } from './DinDinMenu-hooks';
import { DinDinLoading } from './DinDinMenu-loading';
import { DinDinSectionList } from './DinDinMenu-section-list';
import { DinDinItemForm } from './DinDinMenu-item-form';

export default function DinDinMenu() {
  const { t } = useTranslation('admin');
  const {
    config, loading, error, success, saving,
    editingSection, editingItem, newItem, sectionName, d08Warning,
    setSectionName, setNewItem, setEditingSection, setEditingItem,
    loadConfig, addSection, startEditItem, saveItem,
    removeItem, persistConfig,
  } = useDinDinMenu();

  useEffect(() => { void loadConfig(); }, [loadConfig]);

  if (loading) return <DinDinLoading />;

  return (
    <>
      <HelmetHead title={t('dindin.menuTitle', { defaultValue: 'Quản lý Menu' })} description={t('dindin.menuDesc', { defaultValue: 'Quản lý menu nhà hàng' })} />
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        <h1 className="text-2xl font-bold text-[var(--aura-text-primary)]">
          {t('dindin.menuTitle', { defaultValue: 'Quản lý Menu' })}
        </h1>

        {error && (
          <div className="rounded-xl px-4 py-3 text-sm" style={{ background: 'rgba(255,80,80,0.1)', border: '1px solid rgba(255,80,80,0.3)' }} role="alert">
            {error}
          </div>
        )}
        {success && <p className="text-sm text-green-400">{success}</p>}
        {d08Warning && <p className="text-xs text-yellow-400" role="status">{d08Warning}</p>}

        <div className="flex gap-2">
          <input
            type="text"
            value={sectionName}
            onChange={(e) => setSectionName(e.target.value)}
            placeholder={t('dindin.sectionName', { defaultValue: 'Tên nhóm món' })}
            className="flex-1 rounded-xl px-3 py-2 text-sm bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] text-[var(--aura-text-primary)]"
          />
          <button type="button" onClick={addSection} className="rounded-full px-4 py-2 text-xs font-semibold bg-[var(--aura-chrome-mid)] text-white">
            {t('dindin.addSection', { defaultValue: '+ Nhóm' })}
          </button>
        </div>

        <DinDinSectionList
          config={config}
          onStartEdit={startEditItem}
          onRemove={removeItem}
          onAddItem={(secIdx) => {
            setEditingSection(secIdx);
            setEditingItem(null);
            setNewItem(EMPTY_ITEM);
          }}
        />

        {editingSection !== null && (
          <DinDinItemForm
            isNew={editingItem === null}
            item={newItem}
            onChange={setNewItem}
            onSave={() => saveItem(editingSection)}
            onCancel={() => { setEditingSection(null); setEditingItem(null); }}
          />
        )}

        {config.sections.length > 0 && (
          <div className="pt-2">
            <button
              type="button"
              onClick={() => persistConfig(config)}
              disabled={saving}
              className="rounded-full px-6 py-3 text-sm font-semibold bg-[var(--aura-chrome-mid)] text-white active:scale-95 transition-transform disabled:opacity-50"
            >
              {saving ? t('saving', { defaultValue: 'Đang lưu...' }) : t('save', { defaultValue: 'Lưu menu' })}
            </button>
          </div>
        )}
      </div>
    </>
  );
}
