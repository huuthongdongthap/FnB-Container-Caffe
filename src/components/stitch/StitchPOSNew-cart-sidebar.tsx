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
import { formatPosPrice, type POSNewCartItem, type POSOrderType, type POSTableOption } from './StitchPOSNew-types';
import type { POSCustomer } from '@/hooks/use-pos-customer';
import { CustomerLookup } from './StitchPOSNew-customer-lookup';

function formatTableStatusVi(status: string): string {
  const s = status.trim().toLowerCase();
  if (s === 'available' || s === 'free') return 'Trống';
  if (s === 'occupied') return 'Đang có khách';
  if (s === 'reserved') return 'Đã đặt';
  return status;
}

interface CartSidebarProps {
  cart: POSNewCartItem[];
  addToCart: (item: POSNewCartItem) => void;
  removeFromCart: (id: string) => void;
  subtotal: number;
  tax: number;
  total: number;
  discount?: number;
  paymentMethod?: 'payos' | 'cod';
  tables?: POSTableOption[];
  selectedTableId?: string;
  onSelectTable?: (tableId: string | undefined) => void;
  orderType?: POSOrderType;
  deliveryAddress?: string;
  tableLabel?: string;
  guestLabel?: string;
  orderNumber?: string;
  cartOpen: boolean;
  setCartOpen: (open: boolean) => void;
  onCompleteOrder?: (cart: POSNewCartItem[], total: number) => void;
  onPayment?: (method: 'payos' | 'cod') => void;
  customer?: POSCustomer | null;
  onCustomerFound?: (customer: POSCustomer) => void;
  onClearCustomer?: () => void;
  useCashback?: boolean;
  onToggleCashback?: (enabled: boolean) => void;
  cashTendered?: string;
  onCashTenderedChange?: (value: string) => void;
}

export function CartSidebar({
  cart,
  addToCart,
  removeFromCart,
  subtotal,
  tax,
  total,
  discount = 0,
  paymentMethod = 'payos',
  tables = [],
  selectedTableId,
  onSelectTable,
  orderType,
  deliveryAddress = '',
  tableLabel,
  guestLabel,
  orderNumber,
  cartOpen,
  setCartOpen: _setCartOpen,
  onCompleteOrder,
  onPayment,
  customer = null,
  onCustomerFound,
  onClearCustomer,
  useCashback = false,
  onToggleCashback,
  cashTendered = '',
  onCashTenderedChange,
}: CartSidebarProps) {
  const { t } = useTranslation();
  const resolvedOrderType: POSOrderType = orderType ?? (selectedTableId ? 'dine_in' : 'takeaway');
  const formattedSubtotal = formatPosPrice(subtotal);
  const selectedTable = tables.find((tb) => tb.id === selectedTableId);
  const resolvedTableBadge =
    resolvedOrderType === 'delivery'
      ? t('orderMgmt.channel.delivery', { defaultValue: 'Giao hàng' })
      : resolvedOrderType === 'dine_in'
        ? selectedTable
          ? selectedTable.name
          : t('posNew.noTableSelected', { defaultValue: 'Chưa chọn bàn' })
        : tableLabel || t('posNew.takeaway', { defaultValue: 'Mang về' });

  const totalItemQuantity = cart.reduce((sum, item) => sum + item.quantity, 0);
  const shippingFee = resolvedOrderType === 'delivery' && totalItemQuantity > 0 && totalItemQuantity < 2 ? 15_000 : 0;
  const totalWithShipping = Math.max(0, Math.round(total) + shippingFee);
  const effectivePaymentMethod: 'payos' | 'cod' = resolvedOrderType === 'delivery' ? 'payos' : paymentMethod;

  const rawCashbackDeduction = useCashback && customer && customer.cashback_balance > 0
    ? Math.min(Math.floor(customer.cashback_balance), totalWithShipping)
    : 0;
  const cashbackDeduction =
    effectivePaymentMethod === 'payos' &&
    rawCashbackDeduction > 0 &&
    totalWithShipping - rawCashbackDeduction > 0 &&
    totalWithShipping - rawCashbackDeduction < 1000
      ? Math.max(0, totalWithShipping - 1000)
      : rawCashbackDeduction;
  const payableTotal = Math.max(0, totalWithShipping - cashbackDeduction);
  return (
    <aside
      className={cn(
        'fixed right-0 top-0 h-full w-96 flex flex-col z-40 bg-[var(--aura-noir-void,#050814)]/95 backdrop-blur-md border-l border-[var(--aura-chrome-light,#B8C5D0)]/15 shadow-xl transition-transform duration-300',
        'pt-16',
        cartOpen ? 'translate-x-0' : 'translate-x-full',
        'lg:translate-x-0'
      )}
      aria-label={t('posNew.cartSection')}
    >
      {/* Cart Header & Table Selector (#113) */}
      <div className="px-6 py-4 border-b border-[var(--aura-chrome-light,#B8C5D0)]/12">
        <div className="flex justify-between items-center mb-2">
          <h2 className="text-[14px] text-[#f2c08d] font-semibold uppercase tracking-wider font-body">
            {t('posNew.orderSummary')}
          </h2>
          <span
            data-testid="pos-bill-channel-badge"
            className="bg-[var(--aura-chrome-light,#B8C5D0)]/10 text-[#f2c08d] border border-[var(--aura-chrome-light,#B8C5D0)]/20 px-2.5 py-0.5 rounded-sm text-[11px] font-body"
          >
            {resolvedTableBadge}
          </span>
        </div>
        {resolvedOrderType === 'dine_in' && onSelectTable ? (
          <div className="mt-1">
            <label htmlFor="pos-table-selector" className="sr-only">
              {t('posNew.selectTable', { defaultValue: 'Chọn bàn phục vụ' })}
            </label>
            <select
              id="pos-table-selector"
              data-testid="pos-table-selector"
              value={selectedTableId || ''}
              onChange={(e) => onSelectTable(e.target.value || undefined)}
              aria-label={t('posNew.selectTable', { defaultValue: 'Chọn bàn phục vụ' })}
              className="w-full bg-[var(--aura-noir-deep,#0A1A2E)] border border-[var(--aura-chrome-light,#B8C5D0)]/20 rounded-md px-3 py-2 text-[12px] text-[var(--aura-text-primary,#eae1db)] font-body outline-none focus:border-[#f2c08d] cursor-pointer"
            >
              <option value="">
                {t('posNew.selectTablePlaceholder', { defaultValue: 'Chọn bàn phục vụ...' })}
              </option>
              {tables.map((tb) => (
                <option key={tb.id} value={tb.id}>
                  {tb.name}
                  {tb.capacity ? ` (${tb.capacity} chỗ)` : ''} — {formatTableStatusVi(tb.status)}
                </option>
              ))}
            </select>
          </div>
        ) : resolvedOrderType === 'delivery' ? (
          <div
            data-testid="pos-bill-delivery-summary"
            className="mt-1 rounded-md border border-amber-400/20 bg-[var(--aura-noir-deep,#0A1A2E)] px-3 py-2 text-[12px] font-body"
          >
            {deliveryAddress.trim() ? (
              <p className="text-[var(--aura-text-primary,#eae1db)] truncate" title={deliveryAddress.trim()}>
                Giao tới: {deliveryAddress.trim()}
              </p>
            ) : (
              <p className="text-amber-300">
                Chưa nhập địa chỉ giao hàng
              </p>
            )}
          </div>
        ) : (
          (guestLabel || orderNumber) && (
            <p className="text-[12px] text-[var(--aura-text-muted,#8A8E96)] font-body">
              {[guestLabel, orderNumber ? `${t('posNew.order')} #${orderNumber}` : ''].filter(Boolean).join(' • ')}
            </p>
          )
        )}
      </div>

      {/* Customer Lookup */}
      <CustomerLookup
        customer={customer}
        onCustomerFound={onCustomerFound}
        onClearCustomer={onClearCustomer}
        useCashback={useCashback}
        onToggleCashback={onToggleCashback}
      />

      {/* Cart Items */}
      <div className="flex-1 overflow-y-auto px-6 py-3 custom-scrollbar-pos">
        {cart.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <ShoppingCart className="w-10 h-10 text-[var(--aura-chrome-light,#B8C5D0)]/20 mb-3" />
            <p className="text-[13px] text-[var(--aura-text-muted,#8A8E96)] font-body">
              {t('posNew.cartEmpty')}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {cart.map((item) => (
              <div key={item.id} className="flex items-center gap-3 py-2 group">
                <div className="w-2 h-10 bg-[#f2c08d] opacity-0 group-hover:opacity-100 transition-opacity -ml-6 mr-0 rounded-r-sm" />
                <div className="flex-1 min-w-0">
                  <h4 className="text-[14px] text-[var(--aura-text-primary,#eae1db)] truncate font-body">
                    {item.name}
                  </h4>
                  <p className="text-[12px] text-[var(--aura-text-muted,#8A8E96)] font-body">
                    {`${item.quantity} × ${formatPosPrice(item.price)}`}
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
                    className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-sm bg-[var(--aura-chrome-light,#B8C5D0)]/12 text-[#f2c08d] border border-[var(--aura-chrome-light,#B8C5D0)]/20 active:scale-90 transition-transform"
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
      <div className="px-6 py-4 bg-[var(--aura-noir-deep,#0A1A2E)]/80 border-t border-[var(--aura-chrome-light,#B8C5D0)]/12 flex flex-col gap-2">
        <div className="flex justify-between text-[13px] text-[var(--aura-text-muted,#8A8E96)] font-body">
          <span>{t('posNew.subtotal')}</span>
          <span aria-label={formattedSubtotal}>{formattedSubtotal}</span>
        </div>
        {discount > 0 && (
          <div className="flex justify-between text-[13px] text-[var(--aura-text-muted,#8A8E96)] font-body">
            <span>{t('posNew.discount', { defaultValue: 'Discount' })}</span>
            <span>-{formatPosPrice(discount)}</span>
          </div>
        )}
        <div className="flex justify-between text-[13px] text-[var(--aura-text-muted,#8A8E96)] font-body">
          <span>{t('posNew.tax')}</span>
          <span>{formatPosPrice(tax)}</span>
        </div>
        {orderType === 'delivery' && (
          <div className="flex justify-between text-[13px] text-[var(--aura-text-muted,#8A8E96)] font-body" data-testid="pos-shipping-fee-row">
            <span>Phí giao hàng</span>
            <span>{shippingFee > 0 ? formatPosPrice(shippingFee) : 'Miễn phí'}</span>
          </div>
        )}
        {cashbackDeduction > 0 && (
          <div className="flex justify-between text-[13px] text-emerald-400 font-body" data-testid="pos-cashback-discount-row">
            <span>Ví hoàn tiền</span>
            <span>-{formatPosPrice(cashbackDeduction)}</span>
          </div>
        )}
        <div className="flex justify-between items-center mt-2 pt-2 border-t border-[var(--aura-chrome-light,#B8C5D0)]/15">
          <span className="text-[15px] font-semibold uppercase tracking-widest font-body">
            {t('posNew.total')}
          </span>
          <span className="text-[22px] text-[#f2c08d] font-bold font-body" data-testid="pos-payable-total">
            {formatPosPrice(payableTotal)}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-3 mt-3">
          <button
            type="button"
            aria-pressed={effectivePaymentMethod === 'payos'}
            className={cn(
              'industrial-gradient py-3 px-3 rounded-lg border flex flex-col items-center gap-1 active:brightness-110 transition-all bronze-glow cursor-pointer',
              effectivePaymentMethod === 'payos'
                ? 'border-[#f2c08d] ring-1 ring-[#f2c08d]'
                : 'border-[var(--aura-chrome-light,#B8C5D0)]/20'
            )}
            onClick={() => onPayment?.('payos')}
            aria-label={t('posNew.payos')}
          >
            <CreditCard className="w-6 h-6 text-[#f2c08d]" />
            <span className="text-[11px] text-[var(--aura-text-primary,#eae1db)] uppercase tracking-tight font-body">
              {t('posNew.payos')}
            </span>
          </button>
          <button
            type="button"
            disabled={orderType === 'delivery'}
            aria-pressed={effectivePaymentMethod === 'cod'}
            title={orderType === 'delivery' ? 'Đơn giao hàng yêu cầu thanh toán PayOS trả trước' : undefined}
            className={cn(
              'industrial-gradient py-3 px-3 rounded-lg border flex flex-col items-center gap-1 active:brightness-110 transition-all bronze-glow',
              orderType === 'delivery'
                ? 'opacity-40 cursor-not-allowed border-[var(--aura-chrome-light,#B8C5D0)]/10'
                : 'cursor-pointer',
              effectivePaymentMethod === 'cod'
                ? 'border-[#f2c08d] ring-1 ring-[#f2c08d]'
                : 'border-[var(--aura-chrome-light,#B8C5D0)]/20'
            )}
            onClick={() => {
              if (orderType !== 'delivery') onPayment?.('cod');
            }}
            aria-label={t('posNew.cod')}
          >
            <Wallet className="w-6 h-6 text-[var(--aura-text-primary,#eae1db)]" />
            <span className="text-[11px] text-[var(--aura-text-primary,#eae1db)] uppercase tracking-tight font-body">
              {t('posNew.cod')}
            </span>
          </button>
        </div>
        {orderType === 'delivery' && (
          <p className="text-[11px] text-amber-300/90 font-body" data-testid="pos-delivery-payos-note">
            Đơn giao hàng yêu cầu thanh toán trả trước qua PayOS.
          </p>
        )}
        {effectivePaymentMethod === 'cod' && onCashTenderedChange && payableTotal > 0 && (
          <div className="mt-2 rounded-lg border border-white/15 bg-black/25 px-3 py-2 flex flex-col gap-1.5 font-body">
            <div className="flex items-center justify-between gap-2">
              <label htmlFor="pos-cash-tendered-input" className="text-[11px] text-[var(--aura-text-muted,#8A8E96)]">
                Tiền khách đưa:
              </label>
              <input
                id="pos-cash-tendered-input"
                type="number"
                min={0}
                step={1000}
                inputMode="numeric"
                data-testid="pos-cash-tendered-input"
                value={cashTendered}
                onChange={(e) => onCashTenderedChange(e.target.value)}
                placeholder={String(payableTotal)}
                className="w-32 rounded border border-white/20 bg-black/40 px-2 py-1 text-right text-xs text-white outline-none focus:border-[#f2c08d]"
              />
            </div>
            {cashTendered.trim() !== '' && Number.isFinite(Number(cashTendered)) && (
              <div className="flex items-center justify-between text-xs" data-testid="pos-cash-change-due">
                <span className="text-[var(--aura-text-muted,#8A8E96)]">Tiền thối:</span>
                <span className={Number(cashTendered) >= payableTotal ? 'font-semibold text-emerald-300' : 'font-semibold text-red-300'}>
                  {Number(cashTendered) >= payableTotal
                    ? formatPosPrice(Number(cashTendered) - payableTotal)
                    : 'Chưa đủ tiền'}
                </span>
              </div>
            )}
          </div>
        )}
        <button
          type="button"
          className="w-full bg-[#f2c08d] hover:bg-[#f6cda3] disabled:opacity-40 py-4 rounded-xl flex items-center justify-center gap-2 text-[14px] font-semibold text-[#1a1008] uppercase tracking-widest active:scale-[0.97] transition-all mt-3 shadow-[0_0_20px_rgba(242,192,141,0.18)] font-body cursor-pointer disabled:cursor-not-allowed"
          onClick={() => onCompleteOrder?.(cart, totalWithShipping)}
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
