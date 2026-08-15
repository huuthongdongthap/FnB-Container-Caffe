'use client';

import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/cn';
import {
  ShoppingCart,
  CreditCard,
  Wallet,
  ArrowRight,
  Plus,
  Minus,
} from 'lucide-react';
import type { POSNewCartItem } from './StitchPOSNew-types';

interface CartSidebarProps {
  cart: POSNewCartItem[];
  addToCart: (item: POSNewCartItem) => void;
  removeFromCart: (id: string) => void;
  subtotal: number;
  tax: number;
  total: number;
  tableLabel: string;
  guestLabel: string;
  orderNumber: string;
  cartOpen: boolean;
  setCartOpen: (open: boolean) => void;
  onCompleteOrder?: (cart: POSNewCartItem[], total: number) => void;
  onPayment?: (method: 'payos' | 'cod') => void;
}

export function CartSidebar({
  cart,
  addToCart,
  removeFromCart,
  subtotal,
  tax,
  total,
  tableLabel,
  guestLabel,
  orderNumber,
  cartOpen,
  setCartOpen,
  onCompleteOrder,
  onPayment,
}: CartSidebarProps) {
  const { t } = useTranslation();
  return (
    <aside
      className={cn(
        'fixed right-0 top-0 h-full w-96 flex flex-col z-40 bg-[rgba(28,20,14,0.7)] backdrop-blur-2xl border-l border-[rgba(242,192,141,0.08)] shadow-xl transition-transform duration-300',
        'pt-16',
        cartOpen ? 'translate-x-0' : 'translate-x-full',
        'lg:translate-x-0'
      )}
      aria-label={t('posNew.cartSection')}
    >
      {/* Cart Header */}
      <div className="px-6 py-4 border-b border-[rgba(242,192,141,0.08)]">
        <div className="flex justify-between items-start mb-1">
          <h2 className="text-[14px] text-[var(--aura-primary, #f2c08d)] font-semibold uppercase tracking-wider font-body">
            {t('posNew.orderSummary')}
          </h2>
          <span className="bg-[rgba(242,192,141,0.08)] text-[var(--aura-primary, #f2c08d)] border border-[rgba(242,192,141,0.15)] px-2.5 py-0.5 rounded-sm text-[11px] font-body">
            {tableLabel}
          </span>
        </div>
        <p className="text-[12px] text-[#8a7a6a] font-body">
          {guestLabel} &bull; {t('posNew.order')} #{orderNumber}
        </p>
      </div>

      {/* Cart Items */}
      <div className="flex-1 overflow-y-auto px-6 py-3 custom-scrollbar-pos">
        {cart.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <ShoppingCart className="w-10 h-10 text-[rgba(242,192,141,0.1)] mb-3" />
            <p className="text-[13px] text-[#8a7a6a] font-body">
              {t('posNew.cartEmpty')}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {cart.map((item) => (
              <div key={item.id} className="flex items-center gap-3 py-2 group">
                <div className="w-2 h-10 bg-[var(--aura-primary, #f2c08d)] opacity-0 group-hover:opacity-100 transition-opacity -ml-6 mr-0 rounded-r-sm" />
                <div className="flex-1 min-w-0">
                  <h4 className="text-[14px] text-[var(--aura-text-primary, #eae1db)] truncate font-body">
                    {item.name}
                  </h4>
                  <p className="text-[12px] text-[#8a7a6a] font-body">
                    ${(item.price * item.quantity).toFixed(2)}
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => removeFromCart(item.id)}
                    className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-sm glass-card active:scale-90 transition-transform"
                    aria-label={`${t('posNew.decrementQuantity')} ${item.name}`}
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <span className="w-8 text-center text-[14px] font-body">
                    {item.quantity}
                  </span>
                  <button
                    type="button"
                    onClick={() => addToCart(item)}
                    className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-sm bg-[rgba(242,192,141,0.1)] text-[var(--aura-primary, #f2c08d)] border border-[rgba(242,192,141,0.18)] active:scale-90 transition-transform"
                    aria-label={`${t('posNew.incrementQuantity')} ${item.name}`}
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Calculation Area */}
      <div className="px-6 py-4 bg-[rgba(24,16,10,0.5)] border-t border-[rgba(242,192,141,0.08)] flex flex-col gap-2">
        <div className="flex justify-between text-[13px] text-[#8a7a6a] font-body">
          <span>{t('posNew.subtotal')}</span>
          <span>${subtotal.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-[13px] text-[#8a7a6a] font-body">
          <span>{t('posNew.tax')}</span>
          <span>${tax.toFixed(2)}</span>
        </div>
        <div className="flex justify-between items-center mt-2 pt-2 border-t border-[rgba(242,192,141,0.12)]">
          <span className="text-[15px] font-semibold uppercase tracking-widest font-body">
            {t('posNew.total')}
          </span>
          <span className="text-[22px] text-[var(--aura-primary, #f2c08d)] font-bold font-body">
            ${total.toFixed(2)}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-3 mt-3">
          <button
            type="button"
            className="industrial-gradient py-3 px-3 rounded-lg border border-[rgba(242,192,141,0.15)] flex flex-col items-center gap-1 active:brightness-110 transition-all bronze-glow"
            onClick={() => onPayment?.('payos')}
            aria-label={t('posNew.payos')}
          >
            <CreditCard className="w-6 h-6 text-[var(--aura-primary, #f2c08d)]" />
            <span className="text-[11px] text-[var(--aura-text-primary, #eae1db)] uppercase tracking-tight font-body">
              {t('posNew.payos')}
            </span>
          </button>
          <button
            type="button"
            className="industrial-gradient py-3 px-3 rounded-lg border border-[rgba(242,192,141,0.15)] flex flex-col items-center gap-1 active:brightness-110 transition-all bronze-glow"
            onClick={() => onPayment?.('cod')}
            aria-label={t('posNew.cod')}
          >
            <Wallet className="w-6 h-6 text-[var(--aura-text-primary, #eae1db)]" />
            <span className="text-[11px] text-[var(--aura-text-primary, #eae1db)] uppercase tracking-tight font-body">
              {t('posNew.cod')}
            </span>
          </button>
        </div>
        <button
          type="button"
          className="w-full bg-[var(--aura-primary, #f2c08d)] py-4 rounded-xl flex items-center justify-center gap-2 text-[14px] font-semibold text-[#1a1008] uppercase tracking-widest active:scale-[0.97] transition-transform mt-3 shadow-[0_0_20px_rgba(242,192,141,0.15)] font-body"
          onClick={() => onCompleteOrder?.(cart, total)}
          disabled={cart.length === 0}
          aria-label={t('posNew.completeOrder')}
        >
          {t('posNew.completeOrder')}
          <ArrowRight className="w-5 h-5" />
        </button>
      </div>
    </aside>
  );
}
