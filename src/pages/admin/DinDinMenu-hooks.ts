import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import type { DinDinConfig, DinDinItem } from './DinDinMenu-types';
import { EMPTY_ITEM } from './DinDinMenu-constants';
import { apiFetch } from '@/lib/api-client';

export function useDinDinMenu() {
  const { t } = useTranslation('admin');
  const [config, setConfig] = useState<DinDinConfig>({ sections: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [editingSection, setEditingSection] = useState<number | null>(null);
  const [editingItem, setEditingItem] = useState<number | null>(null);
  const [newItem, setNewItem] = useState<DinDinItem>(EMPTY_ITEM);
  const [sectionName, setSectionName] = useState('');
  const [d08Warning, setD08Warning] = useState<string | null>(null);

  const loadConfig = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<DinDinConfig>('/api/admin/dindin/config');
      if (!data || typeof data !== 'object' || !Array.isArray(data.sections)) {
        throw new Error(t('dindin.errors.D07', { defaultValue: 'Cấu hình menu bị lỗi định dạng (D07)' }));
      }
      setConfig(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi tải menu');
    } finally {
      setLoading(false);
    }
  }, [t]);

  const addSection = () => {
    if (!sectionName.trim()) return;
    setConfig((c) => ({
      ...c,
      sections: [...c.sections, { name: sectionName.trim(), items: [] }],
    }));
    setSectionName('');
  };

  const startEditItem = (sectionIdx: number, itemIdx: number) => {
    if (sectionIdx < 0 || sectionIdx >= config.sections.length) return;
    const items = config.sections[sectionIdx]?.items;
    if (!items || itemIdx < 0 || itemIdx >= items.length) return;
    const item = items[itemIdx];
    if (!item) return;
    setEditingSection(sectionIdx);
    setEditingItem(itemIdx);
    setNewItem(item);
  };

  const saveItem = (sectionIdx: number) => {
    if (sectionIdx < 0 || sectionIdx >= config.sections.length) return;
    if (editingItem === null || editingItem === undefined) return;
    const target = config.sections[sectionIdx];
    if (!target || editingItem < 0 || editingItem >= target.items.length) return;
    const updated: DinDinConfig = {
      sections: config.sections.map((s, i) =>
        i === sectionIdx ? { ...s, items: [...s.items] } : s
      ),
    };
    const sec = updated.sections[sectionIdx];
    if (!sec) return;
    (sec.items as DinDinItem[])[editingItem] = newItem;
    setConfig(updated);
    setEditingSection(null);
    setEditingItem(null);
    setNewItem(EMPTY_ITEM);
    setSuccess(null);
  };

  const removeItem = (sectionIdx: number, itemIdx: number) => {
    if (sectionIdx < 0 || sectionIdx >= config.sections.length) return;
    const updated: DinDinConfig = {
      sections: config.sections.map((s, i) =>
        i === sectionIdx ? { ...s, items: s.items.filter((_, j) => j !== itemIdx) } : s
      ),
    };
    setConfig(updated);
  };

  const toggleAvailable = (sectionIdx: number, itemIdx: number) => {
    if (sectionIdx < 0 || sectionIdx >= config.sections.length) return;
    const updated: DinDinConfig = {
      sections: config.sections.map((s, i) =>
        i === sectionIdx
          ? { ...s, items: s.items.map((it, j) => j === itemIdx ? { ...it, available: !it.available } : it) }
          : s
      ),
    };
    setConfig(updated);
  };

  const persistConfig = async (cfg: DinDinConfig) => {
    setSaving(true);
    setError(null);
    setSuccess(null);
    setD08Warning(null);
    try {
      const savedBody = (await apiFetch<{ _d08Warning?: string }>('/api/admin/dindin/config', {
      method: 'PUT',
      body: JSON.stringify(cfg),
    })) ?? {};
      if (savedBody?._d08Warning) setD08Warning(savedBody._d08Warning);
      setSuccess(t('dindin.saved', { defaultValue: 'Đã lưu cấu hình menu' }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi lưu');
    } finally {
      setSaving(false);
    }
  };

  return {
    config, loading, error, success, saving,
    editingSection, editingItem, newItem, sectionName, d08Warning,
    setSectionName, setNewItem, setEditingSection, setEditingItem,
    loadConfig, addSection, startEditItem, saveItem,
    removeItem, toggleAvailable, persistConfig,
  };
}
