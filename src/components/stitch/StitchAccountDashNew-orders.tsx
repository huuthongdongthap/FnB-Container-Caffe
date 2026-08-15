/**
 * DashOrdersSection — Recent Transactions + OrderDashStatusBadge for StitchAccountDashNew
 */
import type React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { clsx } from 'clsx';
import { Coffee, RotateCcw, Croissant, IceCream, CupSoda } from 'lucide-react';
import { useCartStore } from '@/hooks/stores/use-cart-store';
import type { DashOrderItem } from './StitchAccountDashNew-types';
import { BODY_FONT } from './StitchAccountDashNew-constants';

/* ─── Icon Map ────────────────────────────────────────────── */
const iconMap: Record<DashOrderItem['icon'], React.ReactNode> = {
  coffee: <Coffee className="w-6 h-6 text-[var(--aura-chrome-bright)]" />,
  bakery: <Croissant className="w-6 h-6 text-[var(--aura-chrome-bright)]" />,
  icecream: <IceCream className="w-6 h-6 text-[var(--aura-chrome-bright)]" />,
  cupSoda: <CupSoda className="w-6 h-6 text-[var(--aura-chrome-bright)]" />,
};

/* ─── Status Badge ─────────────────────────────────────────── */
function OrderDashStatusBadge({ status }: { status: DashOrderItem['status'] }) {
  const { t } = useTranslation();
  const config = {
    preparing: {
      label: t('stitch.accountDashboard.statusPreparing', 'Preparing'),
      class: 'bg-[rgba(255,183,121,0.1)] text-[var(--aura-chrome-bright)] border border-[rgba(255,183,121,0.2)]',
    },
    delivered: {
      label: t('stitch.accountDashboard.statusDelivered', 'Delivered'),
      class: 'bg-[rgba(184,199,226,0.1)] text-[var(--aura-chrome-bright)] border border-[rgba(184,199,226,0.2)]',
    },
  };
  const c = config[status];
  return (
    <span
      className={clsx(
        'inline-flex items-center px-3 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase border whitespace-nowrap',
        c.class,
      )}
      style={{ fontFamily: BODY_FONT }}
    >
      {c.label}
    </span>
  );
}

/* ─── Reorder Logic ────────────────────────────────────────── */
function useReorder() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (order: DashOrderItem) => {
    if (!order.rawItems) return;
    let items: { name?: string; product_name?: string; price?: number; quantity?: number }[];
    try {
      items = JSON.parse(order.rawItems);
    } catch {
      return;
    }
    if (!Array.isArray(items) || items.length === 0) return;

    const { clearCart, addItem } = useCartStore.getState();
    const currentItems = useCartStore.getState().items;
    if (currentItems.length > 0) {
      const ok = window.confirm(
        t('stitch.accountDashboard.reorderConfirm', 'This will replace your current cart items. Continue?'),
      );
      if (!ok) return;
    }

    clearCart();
    for (const item of items) {
      const qty = (item as { quantity?: number }).quantity ?? 1;
      for (let i = 0; i < qty; i++) {
        addItem({
          id: crypto.randomUUID(),
          name: item.name || item.product_name || 'Item',
          price: item.price ?? 0,
        });
      }
    }
    navigate('/checkout');
  };
}

/* ─── Orders Section ───────────────────────────────────────── */
interface DashOrdersSectionProps {
  orders: DashOrderItem[];
  setGlassCardRef: (el: HTMLElement | null) => void;
}

export function DashOrdersSection({ orders, setGlassCardRef }: DashOrdersSectionProps) {
  const { t } = useTranslation();
  const handleReorder = useReorder();

  return (
    <section className="space-y-4" aria-label={t('stitch.accountDashboard.recentTransactions', 'Recent Transactions')}>
      <div className="flex justify-between items-center">
        <h3
          className="text-[12px] font-bold tracking-[0.15em] uppercase text-[var(--aura-chrome-bright)]"
          style={{ fontFamily: BODY_FONT, lineHeight: '1' }}
        >
          {t('stitch.accountDashboard.recentTransactions', 'Recent Transactions')}
        </h3>
        <button
          type="button"
          className="text-[11px] font-bold uppercase tracking-widest text-[var(--aura-chrome-bright)] border-b border-[var(--aura-chrome-bright)]/30"
          style={{ fontFamily: BODY_FONT, lineHeight: '1' }}
          aria-label={t('stitch.accountDashboard.viewAll', 'View All')}
        >
          {t('stitch.accountDashboard.viewAll', 'View All')}
        </button>
      </div>

      {orders.length === 0 ? (
        <div className="rounded-xl p-8 text-center bg-[rgba(30,41,59,0.4)] backdrop-blur-xl border border-white/10">
          <Coffee className="w-10 h-10 mx-auto mb-3 text-[rgba(184,199,226,0.2)]" />
          <p className="text-sm font-medium mb-1 text-[var(--aura-chrome-bright)]">
            {t('stitch.accountDashboard.noTransactionsYet', 'No transactions yet')}
          </p>
          <p className="text-xs text-[var(--aura-chrome-soft)]">
            {t('stitch.accountDashboard.noTransactionsDesc', 'Your recent orders will appear here.')}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {orders.map((order, idx) => (
            <div
              key={order.id}
              ref={setGlassCardRef}
              className={clsx(
                'flex items-center justify-between p-4 rounded-lg bg-[rgba(30,41,59,0.4)] backdrop-blur-xl border border-[rgba(148,163,184,0.3)]',
                idx === orders.length - 1 && 'opacity-60',
              )}
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg flex items-center justify-center border border-white/5 bg-[var(--aura-bg-elevated)]">
                  {iconMap[order.icon]}
                </div>
                <div>
                  <p
                    className="text-lg font-medium text-[var(--aura-chrome-bright)]"
                    style={{ fontFamily: BODY_FONT, lineHeight: '1.6' }}
                  >
                    {order.itemName}
                  </p>
                  <p
                    className="text-[10px] text-[var(--aura-chrome-soft)] mt-0.5"
                    style={{ fontFamily: BODY_FONT, lineHeight: '1', letterSpacing: '0.1em', fontWeight: 700 }}
                  >
                    {order.time}
                  </p>
                </div>
              </div>
              <div className="flex flex-col items-end gap-1.5">
                <OrderDashStatusBadge status={order.status} />
                {order.rawItems && (() => {
                  try {
                    const p = JSON.parse(order.rawItems);
                    return Array.isArray(p) && p.length > 0;
                  } catch { return false; }
                })() && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); handleReorder(order); }}
                    className="flex items-center gap-1 text-[10px] font-bold tracking-wider uppercase text-[var(--aura-chrome-bright)] hover:opacity-80 transition-opacity active:scale-95 px-2 py-0.5 rounded border border-[rgba(148,163,184,0.2)]"
                    style={{ fontFamily: BODY_FONT }}
                    aria-label={t('stitch.accountDashboard.reorder', 'Reorder')}
                  >
                    <RotateCcw className="w-3 h-3" />
                    {t('stitch.accountDashboard.reorder', 'Reorder')}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
