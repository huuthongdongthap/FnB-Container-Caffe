import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import type { DinDinCart } from './dindin-cart-types';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8787';

function getAuthHeaders() {
  const token = localStorage.getItem('admin_token') || '';
  return { Authorization: `Bearer ${token}` };
}

export function useDinDinCart() {
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

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/admin/dindin/carts`, {
        headers: getAuthHeaders(),
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
  }, [t]);

  const loadOne = useCallback(async (sessionId: string) => {
    setLoading(true);
    setError(null);
    setD02Alert(null);
    try {
      const res = await fetch(`${API_BASE}/api/admin/dindin/cart/${encodeURIComponent(sessionId)}`, {
        headers: getAuthHeaders(),
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
  }, [t]);

  useEffect(() => { void loadAll(); }, [loadAll]);

  const patchCart = async (op: 'add' | 'remove' | 'update') => {
    if (!activeCart) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    setD02Alert(null);
    try {
      const body: Record<string, unknown> = { sessionId: activeCart.sessionId, op, itemId, qty: itemQty };
      if (op === 'update') body.qty = itemQty;
      const res = await fetch(`${API_BASE}/api/admin/dindin/cart/${encodeURIComponent(activeCart.sessionId)}`, {
        method: 'PATCH',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const result = await res.json().catch(() => ({}));
      if (res.status === 401) throw new Error(t('dindin.errors.D05', { defaultValue: 'Không có quyền (D05)' }));
      if (res.status === 400 && result?.code === 'D01') throw new Error(result.message ?? 'Giỏ hàng rỗng (D01)');
      if (res.status === 422 && result?.code === 'D02') setD02Alert(result.message ?? 'Sai giá / món không thuộc menu (D02)');
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

  return {
    carts, activeCart, loading, error, saving, message, sessionInput, d02Alert, itemId, itemQty,
    setSessionInput, setItemId, setItemQty, loadAll, loadOne, patchCart, t,
  };
}
