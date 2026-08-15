import { useState } from 'react';
import { StitchShell } from '../StitchBase';
import { PageHeader, PageFooter } from '@/components/stitch/StitchLayout';

import { CART_ITEMS, TAX_RATE, DELIVERY_FEE, ICON_CUSTOMER, ICON_PAYMENT, ICON_PAYOS, ICON_COD } from './premium-checkout-constants';
import { fmt, subtotal, tax } from './premium-checkout-utils';
import { Field, TotalRow } from './premium-checkout-components';
import type { PaymentMethod, CartItem, FieldProps } from './premium-checkout-types';

/* ── Re-exports for backward compatibility ─────────── */
export type { PaymentMethod, CartItem, FieldProps } from './premium-checkout-types';
export { CART_ITEMS, TAX_RATE, DELIVERY_FEE, ICON_CUSTOMER, ICON_PAYMENT, ICON_PAYOS, ICON_COD } from './premium-checkout-constants';
export { fmt, subtotal, tax } from './premium-checkout-utils';
export { Field, TotalRow } from './premium-checkout-components';

/* ═══════════════════════════════════════════════════════
   PremiumCheckout
   ═══════════════════════════════════════════════════════ */
export default function PremiumCheckout() {
  const [payment, setPayment] = useState<PaymentMethod>('payos');

  const sub = subtotal(CART_ITEMS);
  const taxAmt = tax(sub);
  const total = sub + taxAmt + DELIVERY_FEE;

  return (
    <StitchShell>
      <PageHeader brand="AURA CAFE" scrollEffect />

      <main className="pt-24 pb-40 px-5 md:px-10 lg:px-16 max-w-7xl mx-auto">
        <h1 className="font-display text-3xl md:text-5xl text-[var(--aura-chrome-bright)] mb-12 tracking-tight">
          Finalize Selection
        </h1>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          {/* LEFT: Checkout Form */}
          <div className="lg:col-span-7 space-y-10">
            {/* Customer Information */}
            <section>
              <h2 className="font-display text-2xl text-[var(--aura-chrome-mid)] mb-6 flex items-center gap-3">
                <span className="text-[var(--aura-tertiary)]">{ICON_CUSTOMER}</span>
                Customer Information
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Field label="Full Name" type="text" placeholder="Julian Vane" />
                <Field label="Phone Number" type="tel" placeholder="+1 (555) 000-0000" />
                <div className="md:col-span-2">
                  <Field label="Delivery Address" type="text" placeholder="128 Obsidian Plaza, Nocturne District" />
                </div>
                <div className="md:col-span-2">
                  <Field label="Order Notes" type="textarea" placeholder="Extra foam on the latte, please." rows={3} />
                </div>
              </div>
            </section>

            {/* Payment Method */}
            <section>
              <h2 className="font-display text-2xl text-[var(--aura-chrome-mid)] mb-6 flex items-center gap-3">
                <span className="text-[var(--aura-tertiary)]">{ICON_PAYMENT}</span>
                Payment Method
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* PayOS */}
                <label className="relative cursor-pointer group">
                  <input
                    checked={payment === 'payos'}
                    className="peer sr-only"
                    name="payment"
                    type="radio"
                    value="payos"
                    onChange={() => setPayment('payos')}
                  />
                  <div className={['glass-panel p-6 rounded-xl flex items-center justify-between border transition-all', payment === 'payos' ? 'border-[var(--aura-tertiary)] bg-[var(--aura-tertiary)]/10 bronze-glow' : 'border-white/10'].join(' ')}>
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-[var(--aura-tertiary)]/20 flex items-center justify-center text-[var(--aura-tertiary)] text-xl">{ICON_PAYOS}</div>
                      <div>
                        <div className="font-body text-sm text-[var(--aura-chrome-bright)]">PayOS</div>
                        <div className="text-xs text-[var(--aura-chrome-dark)]">Instant Secure Transfer</div>
                      </div>
                    </div>
                    <div className="w-5 h-5 rounded-full border-2 border-outline flex items-center justify-center transition-colors" style={{ borderColor: payment === 'payos' ? 'var(--aura-tertiary)' : undefined }}>
                      <div className="w-2.5 h-2.5 rounded-full bg-[var(--aura-tertiary)] transition-opacity" style={{ opacity: payment === 'payos' ? 1 : 0 }} />
                    </div>
                  </div>
                </label>

                {/* COD */}
                <label className="relative cursor-pointer group">
                  <input
                    checked={payment === 'cod'}
                    className="peer sr-only"
                    name="payment"
                    type="radio"
                    value="cod"
                    onChange={() => setPayment('cod')}
                  />
                  <div className={['glass-panel p-6 rounded-xl flex items-center justify-between border transition-all', payment === 'cod' ? 'border-[var(--aura-chrome-mid)] bg-[var(--aura-chrome-mid)]/10' : 'border-white/10'].join(' ')}>
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-[var(--aura-chrome-mid)]/20 flex items-center justify-center text-[var(--aura-chrome-mid)] text-xl">{ICON_COD}</div>
                      <div>
                        <div className="font-body text-sm text-[var(--aura-chrome-bright)]">Cash on Delivery</div>
                        <div className="text-xs text-[var(--aura-chrome-dark)]">Pay at your doorstep</div>
                      </div>
                    </div>
                    <div className="w-5 h-5 rounded-full border-2 border-outline flex items-center justify-center transition-colors" style={{ borderColor: payment === 'cod' ? 'var(--aura-chrome-mid)' : undefined }}>
                      <div className="w-2.5 h-2.5 rounded-full bg-[var(--aura-chrome-mid)] transition-opacity" style={{ opacity: payment === 'cod' ? 1 : 0 }} />
                    </div>
                  </div>
                </label>
              </div>
            </section>
          </div>

          {/* RIGHT: Order Summary */}
          <div className="lg:col-span-5">
            <div className="glass-panel rounded-xl p-6 md:p-8 sticky top-28 border border-white/20 shadow-2xl">
              <h3 className="font-display text-2xl text-[var(--aura-chrome-bright)] mb-8 border-b border-white/10 pb-4">Order Summary</h3>
              <div className="space-y-5 mb-8 max-h-[300px] overflow-y-auto pr-3 custom-scrollbar">
                {CART_ITEMS.map((item) => (
                  <div key={item.id} className="flex justify-between items-center gap-4">
                    <div className="flex gap-4 items-center">
                      <div className="w-14 h-14 md:w-16 md:h-16 rounded bg-cover bg-center shrink-0" style={{ backgroundImage: `url('${item.image}')` }} role="img" aria-label={item.alt} />
                      <div className="flex flex-col justify-center min-w-0">
                        <span className="font-body text-base text-[var(--aura-chrome-bright)] truncate">{item.name}</span>
                        <span className="text-xs text-[var(--aura-chrome-dark)] uppercase tracking-widest">{item.detail}</span>
                      </div>
                    </div>
                    <span className="font-body text-sm text-[var(--aura-tertiary)] shrink-0">{fmt(item.price)}</span>
                  </div>
                ))}
              </div>
              <div className="space-y-4 pt-4 border-t border-white/10">
                <TotalRow label="Subtotal" value={fmt(sub)} />
                <TotalRow label={`Luxury Tax (${(TAX_RATE * 100).toFixed(0)}%)`} value={fmt(taxAmt)} />
                <TotalRow label="Delivery Fee" value={fmt(DELIVERY_FEE)} />
              </div>
            </div>
          </div>
        </div>
      </main>

      <PageFooter brand="AURA CAFE" socialSize="sm" />
    </StitchShell>
  );
}
