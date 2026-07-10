'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { HelmetHead } from '@/components/seo/HelmetHead';

interface CheckoutEntry {
  orderId: string;
  sessionId: string;
  paymentMethod: 'cod' | 'payos';
  total: number;
  status: string;
  printed: boolean;
  qcOk: boolean;
  createdAt?: string;
}

export default function DinDinCheckout() {
  const { t } = useTranslation('admin');
  const [entries, setEntries] = useState<CheckoutEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'pending' | 'printed' | 'qc_ok'>('all');

  const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8787';

  const loadEntries = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('admin_token') || '';
      const res = await fetch(`${API_BASE}/api/admin/dindin/checkouts?filter=${filter}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) throw new Error(t('dindin.errors.D05', { defaultValue: 'Không có quyền (D05)' }));
      if (!res.ok) throw new Error('Lỗi tải danh sách checkout');
      const data = await res.json();
      setEntries(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi');
    } finally {
      setLoading(false);
    }
  }, [API_BASE, t, filter]);

  useEffect(() => { void loadEntries(); }, [loadEntries]);

  const markPrinted = async (orderId: string) => {
    setEntries((prev) => prev.map((e) => (e.orderId === orderId ? { ...e, printed: true } : e)));
    try {
      const token = localStorage.getItem('admin_token') || '';
      await fetch(`${API_BASE}/api/admin/dindin/checkout/${orderId}/print`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch { /* silent */ }
  };

  const markQcOk = async (orderId: string) => {
    setEntries((prev) => prev.map((e) => (e.orderId === orderId ? { ...e, qcOk: true } : e)));
    try {
      const token = localStorage.getItem('admin_token') || '';
      await fetch(`${API_BASE}/api/admin/dindin/checkout/${orderId}/qc`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch { /* silent */ }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <p className="text-sm text-[var(--aura-text-secondary)]">{t('loading', { defaultValue: 'Đang tải...' })}</p>
      </div>
    );
  }

  return (
    <>
      <HelmetHead title={t('dindin.checkoutTitle', { defaultValue: 'Kiểm tra Checkout' })} description={t('dindin.checkoutDesc', { defaultValue: 'Xem lại đơn hàng trước khi xác nhận' })} />
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        <h1 className="text-2xl font-bold text-[var(--aura-text-primary)]">
          {t('dindin.checkoutTitle', { defaultValue: 'Kiểm tra Checkout' })}
        </h1>

        {error && (
          <div className="rounded-xl px-4 py-3 text-sm" style={{ background: 'rgba(255,80,80,0.1)', border: '1px solid rgba(255,80,80,0.3)' }} role="alert">
            {error}
          </div>
        )}

        {/* Filters */}
        <div className="flex gap-2">
          {(['all', 'pending', 'printed', 'qc_ok'] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`rounded-full px-3 py-1 text-xs font-semibold ${filter === f ? 'bg-[var(--aura-chrome-mid)] text-white' : 'bg-[rgba(255,255,255,0.08)] text-[var(--aura-text-secondary)]'}`}
            >
              {f === 'all' ? t('dindin.all', { defaultValue: 'Tất cả' }) : f === 'pending' ? t('dindin.pending', { defaultValue: 'Chờ xử lý' }) : f === 'printed' ? t('dindin.printed', { defaultValue: 'Đã in' }) : t('dindin.qcOk', { defaultValue: 'QC đạt' })}
            </button>
          ))}
        </div>

        {/* Checkout log table */}
        <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[rgba(255,255,255,0.06)]">
                <th className="px-4 py-3 text-left text-[var(--aura-text-secondary)] font-medium">#{t('dindin.order', { defaultValue: 'Đơn' })}</th>
                <th className="px-4 py-3 text-left text-[var(--aura-text-secondary)] font-medium">{t('dindin.paymentMethod', { defaultValue: 'Thanh toán' })}</th>
                <th className="px-4 py-3 text-right text-[var(--aura-text-secondary)] font-medium">{t('dindin.amount', { defaultValue: 'Số tiền' })}</th>
                <th className="px-4 py-3 text-center text-[var(--aura-text-secondary)] font-medium">{t('dindin.print', { defaultValue: 'In phiếu' })}</th>
                <th className="px-4 py-3 text-center text-[var(--aura-text-secondary)] font-medium">QC</th>
                <th className="px-4 py-3 text-right text-[var(--aura-text-secondary)] font-medium">{t('dindin.actions', { defaultValue: 'Thao tác' })}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[rgba(255,255,255,0.04)]">
              {entries.map((entry) => (
                <tr key={entry.orderId} className="hover:bg-[rgba(255,255,255,0.02)]">
                  <td className="px-4 py-3 font-mono text-[var(--aura-text-primary)]">#{entry.orderId.slice(0, 8)}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-[10px] font-semibold ${entry.paymentMethod === 'cod' ? 'bg-blue-500/20 text-blue-400' : 'bg-purple-500/20 text-purple-400'}`}>
                      {entry.paymentMethod === 'cod' ? 'COD' : 'QRPay'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-[var(--aura-text-secondary)]">₫{entry.total.toLocaleString('vi-VN')}</td>
                  <td className="px-4 py-3 text-center">
                    {entry.printed ? (
                      <span className="text-green-400">✓</span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => markPrinted(entry.orderId)}
                        className="text-[10px] text-blue-400 hover:underline"
                      >
                        {t('dindin.printSlip', { defaultValue: 'In phiếu' })}
                      </button>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {entry.qcOk ? (
                      <span className="text-green-400">✓</span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => markQcOk(entry.orderId)}
                        className="text-[10px] text-green-400 hover:underline"
                      >
                        QC OK
                      </button>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-[10px] text-[var(--aura-text-secondary)]">
                      {entry.createdAt ? new Date(entry.createdAt).toLocaleTimeString('vi-VN') : '—'}
                    </span>
                  </td>
                </tr>
              ))}
              {entries.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-[var(--aura-text-secondary)]">
                    {t('dindin.noCheckouts', { defaultValue: 'Chưa có checkout nào' })}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
