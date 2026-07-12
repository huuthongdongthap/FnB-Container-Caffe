import { useState } from 'react';
import { PageHeader, PageFooter } from '@/components/stitch/StitchLayout';

interface CartItem { name: string; qty: number; price: number; }

export default function CheckoutPage() {
const [selectedPayment, setSelectedPayment] = useState<'payos' | 'cod'>('payos');
const [customerName, setCustomerName] = useState('');
const [customerPhone, setCustomerPhone] = useState('');
const [customerAddress, setCustomerAddress] = useState('');
const [orderNotes, setOrderNotes] = useState('');

const ITEM_PRICES: Record<string, number> = { 'Midnight Espresso': 6.50, 'Chrome Velvet Latte': 8.00 };

const cartItems: CartItem[] = [
{ name: 'Midnight Espresso', qty: 2, price: 6.50 },
{ name: 'Chrome Velvet Latte', qty: 1, price: 8.00 },
];

const subtotal = cartItems.reduce((sum, item) => sum + item.qty * (ITEM_PRICES[item.name] ?? 0), 0);
const tax = subtotal * 0.05;
const delivery = subtotal >= 10 ? 0 : 2.00;
const total = subtotal + tax + delivery;

return (
<div className="min-h-screen bg-[var(--aura-noir-deep)] text-[var(--aura-chrome-bright)]">
{/* Top Nav */}
<PageHeader
brand="🛒 CHECKOUT"
rightContent={
<span className="w-8 h-8 rounded-full bg-[var(--aura-tertiary)]/20 flex items-center justify-center text-sm">👤</span>
}
/>

<main className="max-w-6xl mx-auto px-5 py-24">
<h1 className="font-display text-3xl md:text-4xl text-[var(--aura-chrome-bright)] italic mb-8" style={{ fontFamily: 'var(--font-display, "Libre Caslon Text", serif)' }}>
Complete Your Order
</h1>

<div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
{/* Left Column — Customer Info */}
<div className="space-y-6">
{/* Customer Info */}
<section className="glass-panel rounded-2xl p-6">
<h2 className="font-headline-md text-headline-md text-[var(--aura-chrome-bright)] mb-4">Customer Information</h2>
<div className="space-y-4">
<div>
<label className="font-label-caps text-[10px] text-[var(--aura-chrome-mid)] uppercase tracking-widest block mb-1">Full Name / Họ và tên</label>
<input type="text" value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="Nguyen Van A" className="w-full bg-transparent border-b border-white/10 py-2 text-[var(--aura-chrome-bright)] font-body text-sm focus:outline-none focus:border-[var(--aura-tertiary)] transition-colors placeholder:text-white/20" />
</div>
<div>
<label className="font-label-caps text-[10px] text-[var(--aura-chrome-mid)] uppercase tracking-widest block mb-1">Phone / Điện thoại</label>
<input type="tel" value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} placeholder="+84 90 xxx xxxx" className="w-full bg-transparent border-b border-white/10 py-2 text-[var(--aura-chrome-bright)] font-body text-sm focus:outline-none focus:border-[var(--aura-tertiary)] transition-colors placeholder:text-white/20" />
</div>
<div>
<label className="font-label-caps text-[10px] text-[var(--aura-chrome-mid)] uppercase tracking-widest block mb-1">Delivery Address / Địa chỉ</label>
<input type="text" value={customerAddress} onChange={e => setCustomerAddress(e.target.value)} placeholder="42 Nguyen Hue, District 1" className="w-full bg-transparent border-b border-white/10 py-2 text-[var(--aura-chrome-bright)] font-body text-sm focus:outline-none focus:border-[var(--aura-tertiary)] transition-colors placeholder:text-white/20" />
</div>
<div>
<label className="font-label-caps text-[10px] text-[var(--aura-chrome-mid)] uppercase tracking-widest block mb-1">Order Notes / Ghi chú</label>
<textarea value={orderNotes} onChange={e => setOrderNotes(e.target.value)} placeholder="Extra oat milk, no sugar..." rows={2} className="w-full bg-transparent border-b border-white/10 py-2 text-[var(--aura-chrome-bright)] font-body text-sm focus:outline-none focus:border-[var(--aura-tertiary)] transition-colors resize-none placeholder:text-white/20" />
</div>
</div>
</section>

{/* Payment Method */}
<section className="glass-panel rounded-2xl p-6">
<h2 className="font-headline-md text-headline-md text-[var(--aura-chrome-bright)] mb-4">Payment Method</h2>
<div className="space-y-3">
{[
{ id: 'payos', label: 'PayOS', desc: 'Pay with QR code / Thanh toán QR', icon: '📱' },
{ id: 'cod', label: 'Cash on Delivery', desc: 'Pay cash when delivered / Trả tiền mặt khi nhận', icon: '💵' },
].map(option => (
<button key={option.id} onClick={() => setSelectedPayment(option.id as 'payos' | 'cod')} className={`w-full flex items-center gap-4 p-4 rounded-xl border transition-all ${selectedPayment === option.id ? 'border-[var(--aura-tertiary)]/40 bg-[var(--aura-tertiary)]/5' : 'border-white/10 hover:border-white/20'}`}>
<span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${selectedPayment === option.id ? 'border-[var(--aura-tertiary)]' : 'border-white/20'}`}>
{selectedPayment === option.id && <span className="w-2.5 h-2.5 rounded-full bg-[var(--aura-tertiary)]" />}
</span>
<span className="text-2xl">{option.icon}</span>
<div className="text-left">
<p className="font-body text-sm text-[var(--aura-chrome-bright)]">{option.label}</p>
<p className="font-label-caps text-[10px] text-[var(--aura-chrome-mid)]">{option.desc}</p>
</div>
</button>
))}
</div>
</section>
</div>

{/* Right Column — Order Summary */}
<div>
<div className="sticky top-24">
<section className="glass-panel rounded-2xl p-6">
<h2 className="font-headline-md text-headline-md text-[var(--aura-chrome-bright)] mb-4">Order Summary</h2>

{/* Guest + Table Info */}
<div className="flex justify-between mb-4 pb-4 border-b border-white/10">
<div className="flex items-center gap-2">
<span className="text-lg">👤</span>
<span className="font-body-sm text-sm text-[var(--aura-chrome-bright)]">{customerName || 'Guest / Khách'}</span>
</div>
<div className="flex items-center gap-2">
<span className="text-lg">🪑</span>
<span className="font-body-sm text-sm text-[var(--aura-chrome-mid)]">Table 04</span>
</div>
</div>

{/* Items List */}
<div className="space-y-3 mb-4">
{cartItems.map(item => (
<div key={item.name} className="flex items-start justify-between gap-3 pb-3 border-b border-white/5">
<div className="flex-1">
<p className="font-body text-sm text-[var(--aura-chrome-bright)]">{item.name}</p>
<p className="font-label-caps text-[10px] text-[var(--aura-chrome-mid)]">${item.price.toFixed(2)} each</p>
</div>
<div className="flex items-center gap-3">
<button className="w-7 h-7 rounded-full border border-white/10 flex items-center justify-center text-xs text-[var(--aura-chrome-mid)] hover:border-[var(--aura-tertiary)]/40 transition-colors">−</button>
<span className="font-body text-sm text-[var(--aura-chrome-bright)] min-w-[20px] text-center">{item.qty}</span>
<button className="w-7 h-7 rounded-full border border-white/10 flex items-center justify-center text-xs text-[var(--aura-chrome-mid)] hover:border-[var(--aura-tertiary)]/40 transition-colors">+</button>
</div>
<span className="font-body-sm text-sm text-[var(--aura-tertiary)] min-w-[60px] text-right">${(item.price * item.qty).toFixed(2)}</span>
</div>
))}
</div>

{/* Totals */}
<div className="space-y-2 pt-2 border-t border-white/10">
<div className="flex justify-between font-body-sm text-sm">
<span className="text-[var(--aura-chrome-mid)]">Subtotal</span>
<span className="text-[var(--aura-chrome-bright)]">${subtotal.toFixed(2)}</span>
</div>
<div className="flex justify-between font-body-sm text-sm">
<span className="text-[var(--aura-chrome-mid)]">Tax (5%)</span>
<span className="text-[var(--aura-chrome-bright)]">${tax.toFixed(2)}</span>
</div>
<div className="flex justify-between font-body-sm text-sm">
<span className="text-[var(--aura-chrome-mid)]">Delivery</span>
<span className="text-[var(--aura-chrome-bright)]">{delivery === 0 ? 'FREE' : `$${delivery.toFixed(2)}`}</span>
</div>
<div className="flex justify-between font-headline-md text-headline-md pt-3 border-t border-white/10">
<span className="text-[var(--aura-chrome-bright)]">Total</span>
<span className="text-[var(--aura-tertiary)]">${total.toFixed(2)}</span>
</div>
</div>

{/* Place Order */}
<button className="w-full mt-6 py-4 rounded-xl bg-[var(--aura-tertiary)] text-[var(--aura-noir-deep)] font-headline-sm uppercase tracking-widest text-sm font-bold hover:brightness-110 active:scale-[0.98] transition-all">
Place Order / Đặt hàng — ${total.toFixed(2)}
</button>
</section>
</div>
</div>
</div>
</main>

{/* Footer */}
<PageFooter
brand="AURA CAFE"
copyLine="© 2024 AURA CAFE."
/>
</div>
);
}
