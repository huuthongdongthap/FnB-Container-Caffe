import { useState } from 'react';
import { StitchShell } from '../StitchBase';
import { PageHeader, PageFooter } from '@/components/stitch/StitchLayout'

/* ── Payment Method ──────────────────────────────────── */
type PaymentMethod = 'payos' | 'cod';

/* ── Cart Item ───────────────────────────────────────── */
interface CartItem {
  id: string;
  name: string;
  detail: string;
  price: number;
  image: string;
  alt: string;
}

const CART_ITEMS: readonly CartItem[] = [
  {
    id: 'midnight-espresso',
    name: 'Midnight Espresso',
    detail: 'Double Shot • 1x',
    price: 6.5,
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCkatwcMiZs9JBTKRqd_tOJbxPzqOg_MDkzpHnl3vQLiodjumMJG14taUwf8p-QPxhPKKydr7dh4Xdb-IxCy7xvQWxnMlDExqjoX17Lfq1nbS0GCzrU9dfgFjeAKYQXLiY-g2x78qqFMcePLqhhG4inAGF6C2ATE0ZKsVDz97nrjiyTJK69TRJpXeLKoyCegTLRBD-5XJ1M_Wk4fa30Vd_hZBIsHdmMjpOoTKsr0IZEDD1vieiHnepnWdQA4ciXpVhdB4juGviNjFg',
    alt: 'Midnight Espresso in dark obsidian ceramic cup, dim luxury industrial lounge, steam rising',
  },
  {
    id: 'chrome-velvet-latte',
    name: 'Chrome Velvet Latte',
    detail: 'Oat Milk • 1x',
    price: 7.25,
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuA4hIWRxSPnuozowY9004vMsDXVriJIdSVmFKVJmj4selLCgoJ_8ik1nMFrHsByIbnzUF9TPYQlAGITSYLEEcy6djLpOSYgcGpO8qX9VZhYww5DDMGpgUQQFAO__n_PG4buNrwbA4i71ngg5V0z70o7PIkwU798KMgo69YvtmgXPFe020gCMqB5JfPvAwfXKIx04TaXKdkM4nYpRBmffaREyCsHGwpOsWZlgkA2nNA8-blojfRbxOx4wwklQP1V_2N_ARLFkqkMVCI',
    alt: 'Chrome Velvet Latte in semi-transparent glass mug, blurred nocturnal cafe, warm bronze lighting',
  },
] as const;

const TAX_RATE = 0.05;
const DELIVERY_FEE = 0;

/* ── ICONS (emoji replacements for Material Symbols) ─── */
const ICON_CUSTOMER = '👤';
const ICON_PAYMENT = '💳';
const ICON_PAYOS = '🏦';
const ICON_COD = '💵';

/* ── Helpers ─────────────────────────────────────────── */
function fmt(n: number): string {
  return `$${n.toFixed(2)}`;
}

function subtotal(items: readonly CartItem[]): number {
  return items.reduce((s, i) => s + i.price, 0);
}

function tax(amount: number): number {
  return Math.round(amount * TAX_RATE * 100) / 100;
}

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
      {/* ── NAV ─────────────────────────────────────────── */}
<PageHeader brand="AURA CAFE" scrollEffect />

      <main className="pt-24 pb-40 px-5 md:px-10 lg:px-16 max-w-7xl mx-auto">
        {/* Page Title */}
        <h1 className="font-display text-3xl md:text-5xl text-[var(--aura-chrome-bright)] mb-12 tracking-tight">
          Finalize Selection
        </h1>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          {/* ── LEFT: Checkout Form ───────────────────────── */}
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
                  <div
                    className={[
                      'glass-panel p-6 rounded-xl flex items-center justify-between border transition-all',
                      payment === 'payos'
                        ? 'border-[var(--aura-tertiary)] bg-[var(--aura-tertiary)]/10 bronze-glow'
                        : 'border-white/10',
                    ].join(' ')}
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-[var(--aura-tertiary)]/20 flex items-center justify-center text-[var(--aura-tertiary)] text-xl">
                        {ICON_PAYOS}
                      </div>
                      <div>
                        <div className="font-body text-sm text-[var(--aura-chrome-bright)]">PayOS</div>
                        <div className="text-xs text-[var(--aura-chrome-dark)]">Instant Secure Transfer</div>
                      </div>
                    </div>
                    <div className="w-5 h-5 rounded-full border-2 border-outline flex items-center justify-center transition-colors" style={{ borderColor: payment === 'payos' ? 'var(--aura-tertiary)' : undefined }}>
                      <div
                        className="w-2.5 h-2.5 rounded-full bg-[var(--aura-tertiary)] transition-opacity"
                        style={{ opacity: payment === 'payos' ? 1 : 0 }}
                      />
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
                  <div
                    className={[
                      'glass-panel p-6 rounded-xl flex items-center justify-between border transition-all',
                      payment === 'cod'
                        ? 'border-[var(--aura-chrome-mid)] bg-[var(--aura-chrome-mid)]/10'
                        : 'border-white/10',
                    ].join(' ')}
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-[var(--aura-chrome-mid)]/20 flex items-center justify-center text-[var(--aura-chrome-mid)] text-xl">
                        {ICON_COD}
                      </div>
                      <div>
                        <div className="font-body text-sm text-[var(--aura-chrome-bright)]">Cash on Delivery</div>
                        <div className="text-xs text-[var(--aura-chrome-dark)]">Pay at your doorstep</div>
                      </div>
                    </div>
                    <div className="w-5 h-5 rounded-full border-2 border-outline flex items-center justify-center transition-colors" style={{ borderColor: payment === 'cod' ? 'var(--aura-chrome-mid)' : undefined }}>
                      <div
                        className="w-2.5 h-2.5 rounded-full bg-[var(--aura-chrome-mid)] transition-opacity"
                        style={{ opacity: payment === 'cod' ? 1 : 0 }}
                      />
                    </div>
                  </div>
                </label>
              </div>
            </section>
          </div>

          {/* ── RIGHT: Order Summary ──────────────────────── */}
          <div className="lg:col-span-5">
            <div className="glass-panel rounded-xl p-6 md:p-8 sticky top-28 border border-white/20 shadow-2xl">
              <h3 className="font-display text-2xl text-[var(--aura-chrome-bright)] mb-8 border-b border-white/10 pb-4">
                Order Summary
              </h3>

              {/* Items */}
              <div className="space-y-5 mb-8 max-h-[300px] overflow-y-auto pr-3 custom-scrollbar">
                {CART_ITEMS.map((item) => (
                  <div key={item.id} className="flex justify-between items-center gap-4">
                    <div className="flex gap-4 items-center">
                      <div
                        className="w-14 h-14 md:w-16 md:h-16 rounded bg-cover bg-center shrink-0"
                        style={{ backgroundImage: `url('${item.image}')` }}
                        role="img"
                        aria-label={item.alt}
                      />
                      <div className="flex flex-col justify-center min-w-0">
                        <span className="font-body text-base text-[var(--aura-chrome-bright)] truncate">{item.name}</span>
                        <span className="text-xs text-[var(--aura-chrome-dark)] uppercase tracking-widest">{item.detail}</span>
                      </div>
                    </div>
                    <span className="font-body text-sm text-[var(--aura-tertiary)] shrink-0">{fmt(item.price)}</span>
                  </div>
                ))}
              </div>

              {/* Totals */}
              <div className="space-y-4 pt-4 border-t border-white/10">
                <TotalRow label="Subtotal" value={fmt(sub)} />
                <TotalRow label={`Luxury Tax (${(TAX_RATE * 100).toFixed(0)}%)`} value={fmt(taxAmt)} />
                <TotalRow label="Delivery Fee" value={fmt(DELIVERY_FEE)} />
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* ── FLOATING FOOTER ─────────────────────────────── */}
<PageFooter
  brand="AURA CAFE"
  socialSize="sm"
  />
    </StitchShell>
  );
}

/* ═══════════════════════════════════════════════════════
   Field — reusable input with focus micro-interaction
   ═══════════════════════════════════════════════════════ */
interface FieldProps {
  label: string;
  type: 'text' | 'tel' | 'textarea';
  placeholder?: string;
  rows?: number;
}

function Field({ label, type, placeholder, rows = 3 }: FieldProps) {
  const [focused, setFocused] = useState(false);

  const inputClass = [
    'w-full bg-[#111c2d] border-b border-outline/30 px-4 py-3 text-[var(--aura-chrome-bright)] transition-all rounded-t-sm',
    focused ? 'border-[var(--aura-tertiary)] scale-[1.01]' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className="flex flex-col gap-2">
      <label className="font-body text-xs uppercase tracking-widest text-[var(--aura-chrome-dark)]">
        {label}
      </label>
      {type === 'textarea' ? (
        <textarea
          className={inputClass}
          placeholder={placeholder}
          rows={rows}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
      ) : (
        <input
          className={inputClass}
          placeholder={placeholder}
          type={type}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   TotalRow
   ═══════════════════════════════════════════════════════ */
function TotalRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-[var(--aura-chrome-dark)]">
      <span className="font-body text-xs uppercase tracking-wider">{label}</span>
      <span className="font-body text-xs uppercase tracking-wider">{value}</span>
    </div>
  );
}
