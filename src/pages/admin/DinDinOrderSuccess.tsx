'use client';

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { HelmetHead } from '@/components/seo/HelmetHead';

export default function DinDinOrderSuccess() {
  const { t } = useTranslation('admin');
  const [lastOrder, setLastOrder] = useState<{ orderId: string; total: number; paymentMethod: string } | null>(null);

  // Placeholder: in production this would be populated from checkout redirect params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const oid = params.get('orderId');
    const total = params.get('total');
    const pm = params.get('paymentMethod');
    if (oid) setLastOrder({ orderId: oid, total: Number(total || 0), paymentMethod: pm || 'cod' });
  }, []);

  return (
    <>
      <HelmetHead title={t('dindin.successTitle', { defaultValue: 'Đặt hàng thành công' })} description={t('dindin.successDesc', { defaultValue: 'Xác nhận đơn hàng thành công' })} />
      <div className="max-w-lg mx-auto px-4 py-16 space-y-6 text-center">
        <div className="text-6xl">✅</div>
        <h1 className="text-2xl font-bold text-[var(--aura-text-primary)]">
          {t('dindin.orderConfirmed', { defaultValue: 'Đơn hàng đã xác nhận!' })}
        </h1>

        {lastOrder ? (
          <div className="rounded-2xl p-6 space-y-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <p className="text-sm text-[var(--aura-text-secondary)]">{t('dindin.orderNumber', { defaultValue: 'Mã đơn hàng' })}</p>
            <p className="text-lg font-mono font-semibold text-[var(--aura-text-primary)]">#{lastOrder.orderId.slice(0, 12)}</p>
            <div className="flex justify-between text-sm pt-2 border-t border-[rgba(255,255,255,0.06)]">
              <span className="text-[var(--aura-text-secondary)]">{t('dindin.total', { defaultValue: 'Tổng' })}</span>
              <span className="font-semibold text-[var(--aura-text-primary)]">₫{lastOrder.total.toLocaleString('vi-VN')}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-[var(--aura-text-secondary)]">{t('dindin.paymentMethod', { defaultValue: 'Thanh toán' })}</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${lastOrder.paymentMethod === 'cod' ? 'bg-blue-500/20 text-blue-400' : 'bg-purple-500/20 text-purple-400'}`}>
                {lastOrder.paymentMethod === 'cod' ? 'COD' : 'QRPay'}
              </span>
            </div>
          </div>
        ) : (
          <p className="text-sm text-[var(--aura-text-secondary)]">{t('dindin.noOrderData', { defaultValue: 'Không có thông tin đơn hàng' })}</p>
        )}

        <p className="text-xs text-[var(--aura-text-secondary)]">
          {t('dindin.thankYou', { defaultValue: 'Cảm ơn quý khách! Món sẽ được chuẩn bị sớm.' })}
        </p>
      </div>
    </>
  );
}
