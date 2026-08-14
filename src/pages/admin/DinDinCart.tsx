'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { HelmetHead } from '@/components/seo/HelmetHead';

interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  modifiers?: string;
}

interface DinDinCart {
  sessionId: string;
  items: CartItem[];
  total: number;
  createdAt?: string;
}

export default function DinDinCart() {
  const { t } = useTranslation('admin');
  const [carts, setCarts] = useState<DinDinCart[]>([]);
  const [activeCart, setActiveCart] = useState<DinDinCart | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [sessionInput, setSessionInput] = useState('');
  const [d02Alert, setD02Alert] = useState<string | null>(null);
  const [itemId, setItemId] = useState('');
  const [itemQty, setItemQty] = useState(1);

  const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8787';

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('admin_token') || '';
      const res = await fetch(`${API_BASE}/api/admin/dindin/carts`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) throw new Error(t('dindin.errors.D05', { defaultValue: 'Không có quyền (D05)' }));
      if (!res.ok) throw new Error('Lỗi tải danh sách giỏ hàng');
      const data = await res.json();
      setCarts(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi');
    } finally {
      setLoading(false);
    }
  }, [API_BASE, t]);

  const loadOne = useCallback(async (sessionId: string) => {
    setLoading(true);
    setError(null);
    setD02Alert(null);
    try {
      const token = localStorage.getItem('admin_token') || '';
      const res = await fetch(`${API_BASE}/api/admin/dindin/cart/${encodeURIComponent(sessionId)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) {
        setError(t('dindin.errors.D05', { defaultValue: 'Không có quyền (D05)' }));
        setLoading(false);
        return;
      }
      if (!res.ok) throw new Error(`Không tìm thấy giỏ ${sessionId}`);
      const data = await res.json();
      setActiveCart(data);
      setSessionInput(sessionId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi');
      setActiveCart(null);
    } finally {
      setLoading(false);
    }
  }, [API_BASE, t]);

  useEffect(() => { void loadAll(); }, [loadAll]);

  const patchCart = async (op: 'add' | 'remove' | 'update') => {
    if (!activeCart) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    setD02Alert(null);
    try {
      const token = localStorage.getItem('admin_token') || '';
      const body: Record<string, unknown> = { sessionId: activeCart.sessionId, op, itemId, qty: itemQty };
      if (op === 'update') body.qty = itemQty;
      const res = await fetch(`${API_BASE}/api/admin/dindin/cart/${encodeURIComponent(activeCart.sessionId)}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
      const result = await res.json().catch(() => ({}));
      if (res.status === 401) throw new Error(t('dindin.errors.D05', { defaultValue: 'Không có quyền (D05)' }));
      if (res.status === 400 && result?.code === 'D01') throw new Error(result.message ?? 'Giỏ hàng rỗng (D01)');
      if (res.status === 422 && result?.code === 'D02') { setD02Alert(result.message ?? 'Sai giá / món không thuộc menu (D02)'); }
      if (res.status === 400 && result?.code === 'D07') throw new Error(result.message ?? 'Lỗi cấu trúc giỏ (D07)');
      if (!res.ok) throw new Error(result?.message ?? 'Lỗi cập nhật giỏ');
      setActiveCart(result.cart ?? result);
      setMessage(t('dindin.cartUpdated', { defaultValue: 'Đã cập nhật giỏ hàng' }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi');
    } finally {
      setSaving(false);
    }
  };

  if (loading && !activeCart) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <p className="text-sm text-[var(--aura-text-secondary)]">{t('loading', { defaultValue: 'Đang tải...' })}</p>
      </div>
    );
  }

  return (
    <>
      <HelmetHead title={t('dindin.cartTitle', { defaultValue: 'Giỏ hàng' })} description={t('dindin.cartDesc', { defaultValue: 'Quản lý giỏ hàng khách hàng' })} />
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        <h1 className="text-2xl font-bold text-[var(--aura-text-primary)]">
          {t('dindin.cartTitle', { defaultValue: 'Giỏ hàng' })}
        </h1>

        {error && (
          <div className="rounded-xl px-4 py-3 text-sm" style={{ background: 'rgba(255,80,80,0.1)', border: '1px solid rgba(255,80,80,0.3)' }} role="alert">
            {error}
          </div>
        )}
        {message && <p className="text-sm text-green-400">{message}</p>}
        {d02Alert && <p className="text-sm text-yellow-400">{d02Alert}</p>}

        {/* Session input */}
        <div className="flex gap-2">
          <input
            type="text"
            value={sessionInput}
            onChange={(e) => setSessionInput(e.target.value)}
            placeholder={t('dindin.sessionId', { defaultValue: 'Session ID' })}
            className="flex-1 rounded-xl px-3 py-2 text-sm bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)]"
          />
          <button type="button" onClick={() => { if (sessionInput.trim()) loadOne(sessionInput.trim()); }} className="rounded-full px-4 py-2 text-xs font-semibold bg-[var(--aura-chrome-mid)] text-white">
            {t('load', { defaultValue: 'Tải' })}
          </button>
        </div>

        {activeCart && (
          <div className="rounded-2xl p-5 space-y-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-[var(--aura-text-primary)]">
                {t('dindin.activeCart', { defaultValue: 'Giỏ hiện tại' })} — #{activeCart.sessionId}
              </h2>
              <span className="text-xs text-[var(--aura-text-secondary)]">
                {new Date(activeCart.createdAt ?? '').toLocaleString('vi-VN')}
              </span>
            </div>
            <div className="space-y-2">
              {(activeCart.items ?? []).map((item) => (
                <div key={item.id} className="flex items-center gap-3 text-sm">
                  <span className="flex-1 text-[var(--aura-text-primary)]">{item.name}</span>
                  <span className="text-[var(--aura-text-secondary)]">₫{item.price.toLocaleString('vi-VN')}</span>
                  <input
                    type="number"
                    min={1}
                    value={item.quantity}
                    onChange={(e) => setItemQty(Number(e.target.value))}
                    className="w-12 rounded-lg px-2 py-1 text-xs bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] text-center"
                  />
                  <button type="button" onClick={() => { setItemId(item.id); patchCart('update'); }} className="text-xs text-blue-400">Cập nhật</button>
                  <button type="button" onClick={() => { setItemId(item.id); patchCart('remove'); }} className="text-xs text-red-400">{t('delete', { defaultValue: 'Xoá' })}</button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={itemId}
                onChange={(e) => setItemId(e.target.value)}
                placeholder={t('dindin.itemId', { defaultValue: 'ID món' })}
                className="flex-1 rounded-xl px-3 py-2 text-sm bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)]"
              />
              <button type="button" onClick={() => patchCart('add')} disabled={!itemId.trim() || itemQty <= 0} className="rounded-full px-4 py-2 text-xs bg-[var(--aura-chrome-mid)] text-white disabled:opacity-50">
                {t('dindin.addItem', { defaultValue: 'Thêm' })}
              </button>
            </div>
            <p className="text-right text-base font-semibold text-[var(--aura-text-primary)]">
              Tổng: ₫{activeCart.total.toLocaleString('vi-VN')}
            </p>
          </div>
        )}

        {/* List of carts */}
        {carts.length > 0 && (
          <div className="rounded-2xl p-5 space-y-2" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <h3 className="text-sm font-semibold text-[var(--aura-text-secondary)]">{t('dindin.allCarts', { defaultValue: 'Tất cả giỏ hàng' })}</h3>
            {carts.map((c) => (
              <button key={c.sessionId} onClick={() => loadOne(c.sessionId)} className="w-full text-left rounded-xl px-3 py-2 text-xs hover:bg-[rgba(255,255,255,0.05)] flex justify-between">
                <span className="font-mono text-[var(--aura-text-primary)]">#{c.sessionId}</span>
                <span className="text-[var(--aura-text-secondary)]">{c.items.length} món · ₫{c.total.toLocaleString('vi-VN')}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
