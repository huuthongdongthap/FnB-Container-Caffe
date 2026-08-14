'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { HelmetHead } from '@/components/seo/HelmetHead';

interface DinDinConfig {
  sections: Array<{
    name: string;
    items: Array<{
      id: string;
      name: string;
      price: number;
      description?: string;
      available: boolean;
      modifiers?: string[];
    }>;
  }>;
}

interface DinDinItem {
  id?: string;
  name: string;
  price: number;
  description?: string;
  available: boolean;
  modifiers?: string[];
}

interface DinDinSection {
  name: string;
  items: DinDinItem[];
}

export default function DinDinMenu() {
  const { t } = useTranslation('admin');
  const [config, setConfig] = useState<DinDinConfig>({ sections: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [editingSection, setEditingSection] = useState<number | null>(null);
  const [editingItem, setEditingItem] = useState<number | null>(null);
  const [newItem, setNewItem] = useState<DinDinItem>({
    name: '',
    price: 0,
    description: '',
    available: true,
    modifiers: [],
  });
  const [sectionName, setSectionName] = useState('');
  const [d08Warning, setD08Warning] = useState<string | null>(null);

  const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8787';

  const loadConfig = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('admin_token') || '';
      const res = await fetch(`${API_BASE}/api/admin/dindin/config`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) throw new Error(t('dindin.errors.D05', { defaultValue: 'Không có quyền truy cập' }));
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || t('dindin.errors.unknown', { defaultValue: 'Lỗi tải cấu hình' }));
      }
      const data = await res.json();
      // D07: invalid JSON handled server-side; client guards too
      if (!data || typeof data !== 'object' || !Array.isArray(data.sections)) {
        throw new Error(t('dindin.errors.D07', { defaultValue: 'Cấu hình menu bị lỗi định dạng (D07)' }));
      }
      setConfig(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi tải menu');
    } finally {
      setLoading(false);
    }
  }, [API_BASE, t]);

  useEffect(() => { void loadConfig(); }, [loadConfig]);

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

  function saveItem(sectionIdx: number) {
    if (sectionIdx < 0 || sectionIdx >= config.sections.length) return;
    const target = config.sections[sectionIdx];
    if (!target || editingItem === null || editingItem === undefined) return;
    if (editingItem < 0 || editingItem >= target.items.length) return;
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
    setNewItem({ name: '', price: 0, description: '', available: true, modifiers: [] });
    setSuccess(null);
  }

  function removeItem(sectionIdx: number, itemIdx: number) {
    if (sectionIdx < 0 || sectionIdx >= config.sections.length) return;
    const updated: DinDinConfig = {
      sections: config.sections.map((s, i) =>
        i === sectionIdx ? { ...s, items: s.items.filter((_, j) => j !== itemIdx) } : s
      ),
    };
    setConfig(updated);
  }

  function toggleAvailable(sectionIdx: number, itemIdx: number) {
    if (sectionIdx < 0 || sectionIdx >= config.sections.length) return;
    const updated: DinDinConfig = {
      sections: config.sections.map((s, i) =>
        i === sectionIdx
          ? { ...s, items: s.items.map((it, j) => j === itemIdx ? { ...it, available: !it.available } : it) }
          : s
      ),
    };
    setConfig(updated);
  }

  async function persistConfig(cfg: DinDinConfig) {
    setSaving(true);
    setError(null);
    setSuccess(null);
    setD08Warning(null);
    try {
      const token = localStorage.getItem('admin_token') || '';
      const res = await fetch(`${API_BASE}/api/admin/dindin/config`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(cfg),
      });
      if (res.status === 401) throw new Error(t('dindin.errors.D05', { defaultValue: 'Không có quyền (D05)' }));
      if (!res.ok) {
        let msg = 'Lỗi lưu cấu hình';
        try {
          const body = await res.json();
          if (typeof body.message === 'string') msg = body.message;
        } catch { /* ignore */ }
        throw new Error(msg);
      }
      // D08: idempotency duplicate notice
      const savedBody = await res.json().catch(() => ({}));
      if (savedBody?._d08Warning) setD08Warning(savedBody._d08Warning);
      setSuccess(t('dindin.saved', { defaultValue: 'Đã lưu cấu hình menu' }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi lưu');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <p className="text-sm text-[var(--aura-text-secondary)]">{t('loading', { defaultValue: 'Đang tải...' })}</p>
      </div>
    );
  }

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

        {/* Add section */}
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

        {/* Sections */}
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
                  <button type="button" onClick={() => startEditItem(secIdx, itIdx)} className="text-xs text-blue-400">{t('edit', {defaultValue:'Sửa'})}</button>
                  <button type="button" onClick={() => removeItem(secIdx, itIdx)} className="text-xs text-red-400">{t('delete', {defaultValue:'Xoá'})}</button>
                </div>
              ))}
            </div>
            <button type="button" onClick={() => { setEditingSection(secIdx); setEditingItem(null); setNewItem({name:'',price:0,description:'',available:true,modifiers:[]}); }} className="text-xs text-[var(--aura-chrome-mid)]">
              {t('dindin.addItem', { defaultValue: '+ Thêm món' })}
            </button>
          </div>
        ))}

        {/* Edit/add item */}
        {editingSection !== null && (
          <div className="rounded-2xl p-5 space-y-3" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)' }}>
            <h3 className="text-sm font-semibold text-[var(--aura-text-primary)]">
              {editingItem !== null ? t('edit', { defaultValue: 'Sửa món' }) : t('dindin.addItem', { defaultValue: 'Thêm món' })}
            </h3>
            <input
              type="text"
              value={newItem.name ?? ''}
              onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
              placeholder={t('dindin.itemName', { defaultValue: 'Tên món' })}
              className="w-full rounded-xl px-3 py-2 text-sm bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)]"
            />
            <input
              type="number"
              value={newItem.price}
              onChange={(e) => setNewItem({ ...newItem, price: Number(e.target.value) })}
              placeholder={t('dindin.itemPrice', { defaultValue: 'Giá (VND)' })}
              className="w-full rounded-xl px-3 py-2 text-sm bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)]"
            />
            <textarea
              value={newItem.description ?? ''}
              onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
              placeholder={t('dindin.itemDesc', { defaultValue: 'Mô tả' })}
              className="w-full rounded-xl px-3 py-2 text-sm bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)]"
            />
            <label className="flex items-center gap-2 text-xs text-[var(--aura-text-secondary)]">
              <input
                type="checkbox"
                checked={newItem.available}
                onChange={(e) => setNewItem({ ...newItem, available: e.target.checked })}
              />
              {t('dindin.available', { defaultValue: 'Còn hàng' })}
            </label>
            <div className="flex gap-2">
              <button type="button" onClick={() => saveItem(editingSection)} disabled={!newItem.name.trim() || newItem.price <= 0} className="rounded-full px-4 py-2 text-xs font-semibold bg-[var(--aura-chrome-mid)] text-white disabled:opacity-50">
                {t('save', { defaultValue: 'Lưu' })}
              </button>
              <button type="button" onClick={() => { setEditingSection(null); setEditingItem(null); }} className="rounded-full px-4 py-2 text-xs bg-[rgba(255,255,255,0.08)] text-[var(--aura-text-secondary)]">
                {t('cancel', { defaultValue: 'Hủy' })}
              </button>
            </div>
          </div>
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
