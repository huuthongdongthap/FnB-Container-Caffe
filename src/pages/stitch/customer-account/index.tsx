'use client';

import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

type OrderStatus = 'completed' | 'preparing' | 'pending' | 'cancelled';

const statusLabels: Record<OrderStatus, string> = {
  completed: 'Hoàn thành',
  preparing: 'Đang chuẩn bị',
  pending: 'Chờ xác nhận',
  cancelled: 'Đã hủy',
};

const statusVariant: Record<OrderStatus, 'default' | 'success' | 'info' | 'warning' | 'destructive' | 'outline'> = {
  completed: 'success',
  preparing: 'info',
  pending: 'warning',
  cancelled: 'destructive',
};

const mockOrders = [
  { id: 'ORD-0042', date: '2026-07-28', items: ['Phin Luwak', 'Croissant'], total: 145000, status: 'completed' as OrderStatus },
  { id: 'ORD-0041', date: '2026-07-26', items: ['Cold Brew', 'Banh mi'], total: 128000, status: 'completed' as OrderStatus },
];

const mockReviews = [
  { id: 'REV-01', orderId: 'ORD-0042', rating: 5, comment: 'Cà phê tuyệt vời!', date: '2026-07-29' },
  { id: 'REV-02', orderId: 'ORD-0041', rating: 4, comment: 'Rất ngon.', date: '2026-07-27' },
];

function formatVND(n: number) {
  return new Intl.NumberFormat('vi-VN').format(n) + 'đ';
}

export default function CustomerAccountPage(): ReactNode {
  const [tab, setTab] = useState('orders');

  return (
    <div className="min-h-screen bg-[var(--aura-deep)]">
      <div className="mx-auto max-w-5xl px-4 py-10">
        <h1 className="font-heading text-3xl font-bold text-[var(--aura-chrome)]">Tài khoản của bạn</h1>

        <div className="mt-6 flex rounded-full bg-[var(--aura-dock)] p-1">
          {['orders', 'reviews', 'loyalty'].map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 rounded-full px-4 py-2 text-sm font-medium transition ${
                tab === t ? 'bg-[var(--aura-gold)] text-[var(--aura-deep)]' : 'text-[var(--aura-cloud)]'
              }`}
            >
              {t === 'orders' ? 'Đơn hàng' : t === 'reviews' ? 'Đánh giá' : 'Thành viên'}
            </button>
          ))}
        </div>

        {tab === 'orders' && (
          <div className="mt-6 space-y-4">
            {mockOrders.map((o) => (
              <div key={o.id} className="rounded-2xl border border-[rgba(212,168,83,0.12)] bg-[var(--aura-dock)] p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-mono text-sm text-[var(--aura-cloud)]">{o.id}</p>
                    <p className="text-sm text-[var(--aura-mist)]">{o.date}</p>
                  </div>
                  <p className="text-sm text-[var(--aura-chrome)]">{o.items.join(' + ')}</p>
                  <p className="text-sm font-semibold text-[var(--aura-chrome)]">{formatVND(o.total)}</p>
                  <Badge variant={statusVariant[o.status]}>{statusLabels[o.status]}</Badge>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === 'reviews' && (
          <div className="mt-6 space-y-4">
            {mockReviews.map((r) => (
              <div key={r.id} className="rounded-2xl border border-[rgba(212,168,83,0.12)] bg-[var(--aura-dock)] p-5">
                <div className="flex items-center justify-between">
                  <p className="font-mono text-xs text-[var(--aura-cloud)]">{r.orderId}</p>
                  <p className="text-xs text-[var(--aura-mist)]">{r.date}</p>
                </div>
                <p className="mt-2 text-sm text-[var(--aura-chrome)]">{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</p>
                <p className="mt-1 text-sm text-[var(--aura-chrome)]">{r.comment}</p>
              </div>
            ))}
          </div>
        )}

        {tab === 'loyalty' && (
          <div className="mt-6 space-y-4">
            <div className="rounded-2xl border border-[var(--aura-gold)]/30 bg-[var(--aura-dock)] p-6">
              <p className="text-sm uppercase tracking-widest text-[var(--aura-cloud)]">Hạng hiện tại</p>
              <p className="mt-1 text-2xl font-bold text-[var(--aura-gold)]">Vàng</p>
              <p className="mt-2 text-sm text-[var(--aura-cloud)]">Điểm: 1,240 pts</p>
            </div>
            <div className="grid grid-cols-3 gap-4">
              {['Đồng / Bronze', 'Bạc / Silver', 'Vàng / Gold'].map((t) => (
                <div key={t} className="rounded-2xl border border-[rgba(212,168,83,0.12)] bg-[var(--aura-dock)] p-5">
                  <p className="text-sm font-bold text-[var(--aura-chrome)]">{t}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
