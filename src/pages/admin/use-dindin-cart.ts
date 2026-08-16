import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import type { DinDinCart } from './dindin-cart-types';
import { apiFetch } from '@/lib/api-client';

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
      const data = await apiFetch<DinDinCart[]>('/api/admin/dindin/carts');
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
      setActiveCart(await apiFetch<DinDinCart>(`/api/admin/dindin/cart/${encodeURIComponent(sessionId)}`));
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
      const result = (await apiFetch<Record<string, unknown>>(`/api/admin/dindin/cart/${encodeURIComponent(activeCart.sessionId)}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      })) ?? {};
      if ((result as { code?: string }).code === 'D01') throw new Error((result as { message?: string }).message ?? 'Giỏ hàng rỗng (D01)');
      if ((result as { code?: string }).code === 'D02') setD02Alert((result as { message?: string }).message ?? 'Sai giá / món không thuộc menu (D02)');
      if ((result as { code?: string }).code === 'D07') throw new Error((result as { message?: string }).message ?? 'Lỗi cấu trúc giỏ (D07)');
      setActiveCart((result as { cart?: DinDinCart }).cart ?? (result as unknown as DinDinCart));
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
