/**
 * Order history section for StitchAccountNew.
 * Extracted from StitchAccountNew.tsx to keep individual files under 200 LOC.
 */

'use client';

import { useTranslation } from 'react-i18next';
import { Coffee, UtensilsCrossed, IceCream, CupSoda } from 'lucide-react';
import type { OrderItemNew, OrderItemIcon } from './StitchAccountNew-types';
import { OrderNewStatusBadge } from './StitchAccountNew-order-status-badge';

/* ─── Icon Map ────────────────────────────────────────────────── */

const iconMap: Record<OrderItemIcon, React.ReactNode> = {
  coffee: <Coffee className="w-5 h-5 text-[#d4a574]" />,
  bakery: <UtensilsCrossed className="w-5 h-5 text-[#d4a574]" />,
  icecream: <IceCream className="w-5 h-5 text-[#d4a574]" />,
  cupSoda: <CupSoda className="w-5 h-5 text-[#d4a574]" />,
};

const glassCardStyle = {
  background: 'rgba(30, 41, 59, 0.4)',
  backdropFilter: 'blur(24px)',
  WebkitBackdropFilter: 'blur(24px)',
  border: '1px solid rgba(255, 255, 255, 0.1)',
  boxShadow: 'inset 0 1px 0 rgba(205,127,50,0.3)',
} as const;

/* ─── Order History Section ───────────────────────────────────── */

export function AccountNewOrderHistory({
  orders,
}: {
  orders: OrderItemNew[];
}) {
  const { t } = useTranslation();
  return (
    <section aria-label={t('stitch.accountDashboard.recentTransactions')}>
      <div className="flex justify-between items-center mb-4">
        <h3
          className="text-sm font-semibold"
          style={{ fontFamily: "var(--aura-font-display)" }}
        >
          {t('stitch.accountDashboard.recentTransactions')}
        </h3>
        <button
          type="button"
          className="text-[10px] font-bold tracking-wider uppercase text-[#d4a574] hover:opacity-80 transition-opacity"
          aria-label={t('stitch.accountDashboard.viewAll')}
        >
          {t('stitch.accountDashboard.viewAll')}
        </button>
      </div>

      {orders.length === 0 ? (
        /* Empty state */
        <div
          className="rounded-xl p-8 text-center"
          style={{
            background: 'rgba(255,255,255,0.03)',
            backdropFilter: 'blur(24px)',
            border: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          <Coffee className="w-10 h-10 mx-auto mb-3 text-[rgba(198,198,199,0.2)]" />
          <p className="text-sm font-medium mb-1 text-[var(--aura-text-primary, #e8e8e8)]">
            {t('stitch.accountDashboard.noTransactionsYet')}
          </p>
          <p className="text-xs text-[var(--aura-text-secondary, #a0a8b0)]">
            {t('stitch.accountDashboard.noTransactionsDesc')}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => (
            <div
              key={order.id}
              className="flex items-center justify-between p-4 rounded-lg active:scale-[0.99] transition-transform"
              style={glassCardStyle}
            >
              <div className="flex items-center gap-4">
                <div
                  className="w-12 h-12 rounded-lg flex items-center justify-center border border-white/5"
                  style={{ backgroundColor: '#1f2a3c' }}
                >
                  {iconMap[order.icon]}
                </div>
                <div>
                  <p className="text-sm font-semibold text-[var(--aura-text-primary, #e8e8e8)]">
                    {order.itemName}
                  </p>
                  <p className="text-[12px] text-[var(--aura-text-secondary, #a0a8b0)] mt-0.5">
                    {order.time}
                  </p>
                </div>
              </div>
              <OrderNewStatusBadge status={order.status} />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
