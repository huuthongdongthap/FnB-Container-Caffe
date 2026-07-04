/**
 * StitchPOSNew — AURA CAFE POS Terminal (Dark Navy / Chrome Edition)
 *
 * Two-panel layout: left menu grid with search + category chips + add-ons,
 * right cart sidebar with quantity controls, subtotal/tax/total, pay buttons.
 * Dark navy glassmorphism with chrome/silver accents.
 * Source: Stitch AI aura_cafe_pos_terminal export.
 *
 * States: loading, error, empty, populated
 */
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/cn';
import {
  Search,
  Plus,
  Minus,
  ShoppingCart,
  CreditCard,
  Wallet,
  ArrowRight,
  Clock,
  Terminal,
  PersonStanding,
  LogOut,
  Receipt,
  Printer,
  Loader2,
  AlertCircle,
  Coffee,
} from 'lucide-react';

/* ─── Types ─────────────────────────────────────────────────────────── */
export interface POSNewMenuItem {
  id: string;
  name: string;
  price: number;
  category?: string;
  image?: string;
}

export interface POSNewAddOn {
  id: string;
  name: string;
  price: number;
}

export interface POSNewCartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

export interface StitchPOSNewProps {
  menuItems?: POSNewMenuItem[];
  addOns?: POSNewAddOn[];
  tableLabel?: string;
  guestLabel?: string;
  orderNumber?: string;
  loading?: boolean;
  error?: string | null;
  brandName?: string;
  /** Tax rate as a decimal (e.g. 0.05 = 5 %) */
  taxRate?: number;
  /** Fired when "Complete Order" is clicked */
  onCompleteOrder?: (cart: POSNewCartItem[], total: number) => void;
  /** Fired when a payment method is selected */
  onPayment?: (method: 'payos' | 'cod') => void;
}

/* ─── Constants ─────────────────────────────────────────────────────── */
const MENU_CATEGORIES = ['Coffee', 'Tea', 'Signature', 'Pastries', 'Brunch', 'Merchandise'];

const DEFAULT_MENU_ITEMS: POSNewMenuItem[] = [
  { id: 'm1', name: 'Midnight Espresso', price: 6.50, category: 'Coffee' },
  { id: 'm2', name: 'Chrome Velvet', price: 8.25, category: 'Coffee' },
  { id: 'm3', name: 'Silver Leaf Pastry', price: 5.50, category: 'Pastries' },
  { id: 'm4', name: 'Industrial Cold', price: 7.00, category: 'Coffee' },
  { id: 'm5', name: 'Matcha Zen', price: 6.75, category: 'Tea' },
  { id: 'm6', name: 'Smoked Truffle Croissant', price: 9.00, category: 'Pastries' },
  { id: 'm7', name: 'Hibiscus Spritz', price: 7.50, category: 'Signature' },
  { id: 'm8', name: 'Avocado Sourdough', price: 12.00, category: 'Brunch' },
  { id: 'm9', name: 'AURA Tumbler', price: 25.00, category: 'Merchandise' },
  { id: 'm10', name: 'Dark Chocolate Tart', price: 8.50, category: 'Pastries' },
  { id: 'm11', name: 'Lavender Scone', price: 5.00, category: 'Pastries' },
  { id: 'm12', name: 'Golden Matcha Latte', price: 7.25, category: 'Tea' },
];

const DEFAULT_ADDONS: POSNewAddOn[] = [
  { id: 'a1', name: 'Oat Milk', price: 1.00 },
  { id: 'a2', name: 'Double Shot', price: 2.00 },
  { id: 'a3', name: 'Vanilla Bean', price: 0.75 },
];

/* ─── Sub-components ────────────────────────────────────────────────── */

function LiveClock() {
  const [time, setTime] = useState('');
  const updateClock = useCallback(() => {
    const now = new Date();
    setTime(
      now.toLocaleTimeString('en-US', {
        hour12: true,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    );
  }, []);

  useEffect(() => {
    updateClock();
    const id = setInterval(updateClock, 1000);
    return () => clearInterval(id);
  }, [updateClock]);

  return <span className="text-[13px] text-[#a0abb8] font-body">{time}</span>;
}

function MenuItemCard({
  item,
  quantity,
  onAdd,
  onRemove,
}: {
  item: POSNewMenuItem;
  quantity: number;
  onAdd: () => void;
  onRemove: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div
      className="relative overflow-hidden rounded-xl aspect-[4/5] flex flex-col cursor-pointer active:scale-[0.98] transition-transform glass-card"
      role="button"
      tabIndex={0}
      aria-label={`${item.name} — $${item.price.toFixed(2)}`}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onAdd(); } }}
    >
      {/* Image gradient placeholder */}
      <div className="absolute inset-0 bg-gradient-to-br from-[rgba(198,198,199,0.05)] to-[rgba(0,0,0,0.35)]" />
      <div className="absolute inset-0 bg-gradient-to-t from-[#0A1420]/95 via-transparent to-transparent" />
      <div className="mt-auto p-4 relative z-10">
        <h3 className="text-[16px] text-[var(--aura-text-primary, #e8e8e8)] font-medium leading-tight font-body">
          {item.name}
        </h3>
        <div className="flex items-center justify-between mt-2">
          <p className="text-[14px] text-[var(--aura-primary, #c6c6c7)] font-semibold font-body">
            ${item.price.toFixed(2)}
          </p>
          {quantity > 0 ? (
            <div className="flex items-center gap-1 bg-[rgba(198,198,199,0.1)] rounded-lg px-1.5 py-1">
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onRemove(); }}
                className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-md text-[var(--aura-text-primary, #e8e8e8)] hover:bg-[rgba(198,198,199,0.15)] transition-all active:scale-90"
                aria-label={t('posNew.decrementQuantity')}
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <span className="w-6 text-center text-[13px] text-[var(--aura-text-primary, #e8e8e8)] font-medium font-body">
                {quantity}
              </span>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onAdd(); }}
                className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-md bg-[rgba(198,198,199,0.15)] text-[var(--aura-primary, #c6c6c7)] transition-all active:scale-90"
                aria-label={t('posNew.incrementQuantity')}
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onAdd(); }}
              className="w-8 h-8 flex items-center justify-center rounded-lg bg-[rgba(198,198,199,0.08)] text-[var(--aura-primary, #c6c6c7)] hover:bg-[rgba(198,198,199,0.15)] transition-all active:scale-90"
              aria-label={t('posNew.addToCart')}
            >
              <Plus className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function AddOnChip({ addon, onAdd }: { addon: POSNewAddOn; onAdd: () => void }) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      onClick={onAdd}
      className="glass-card px-4 py-2 rounded-lg flex items-center gap-2 cursor-pointer hover:bg-[rgba(26,42,62,0.5)] transition-colors active:scale-95"
      aria-label={`${t('posNew.addOnPrefix')} ${addon.name}`}
    >
      <Plus className="w-4 h-4 text-[var(--aura-primary, #c6c6c7)]" />
      <div className="text-left">
        <p className="text-[13px] text-[var(--aura-text-primary, #e8e8e8)] font-body">{addon.name}</p>
        <p className="text-[11px] text-[#a0abb8] font-body">
          +${addon.price.toFixed(2)}
        </p>
      </div>
    </button>
  );
}

/* ─── Main Component ─────────────────────────────────────────────────── */
export function StitchPOSNew({
  menuItems = DEFAULT_MENU_ITEMS,
  addOns = DEFAULT_ADDONS,
  tableLabel = 'Table 12',
  guestLabel = 'Guest 2',
  orderNumber = '842',
  loading = false,
  error = null,
  brandName = 'AURA CAFE',
  taxRate = 0.05,
  onCompleteOrder,
  onPayment,
}: Readonly<StitchPOSNewProps>) {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('Coffee');
  const [cart, setCart] = useState<POSNewCartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(true);

  /* ─── Derived data ──────────────────────────────────────────────── */
  const filteredItems = menuItems.filter((item) => {
    const matchesCategory =
      activeCategory === 'All' || item.category === activeCategory;
    const matchesSearch = item.name
      .toLowerCase()
      .includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const getQuantity = (id: string) =>
    cart.find((c) => c.id === id)?.quantity ?? 0;

  const addToCart = (item: POSNewMenuItem) => {
    setCart((prev) => {
      const existing = prev.find((c) => c.id === item.id);
      if (existing) {
        return prev.map((c) =>
          c.id === item.id ? { ...c, quantity: c.quantity + 1 } : c
        );
      }
      return [
        ...prev,
        { id: item.id, name: item.name, price: item.price, quantity: 1 },
      ];
    });
  };

  const removeFromCart = (id: string) => {
    setCart((prev) => {
      const existing = prev.find((c) => c.id === id);
      if (existing && existing.quantity <= 1) {
        return prev.filter((c) => c.id !== id);
      }
      return prev.map((c) =>
        c.id === id ? { ...c, quantity: c.quantity - 1 } : c
      );
    });
  };

  const subtotal = cart.reduce((acc, c) => acc + c.price * c.quantity, 0);
  const tax = subtotal * taxRate;
  const total = subtotal + tax;

  const cartItemCount = cart.reduce((a, c) => a + c.quantity, 0);

  /* ─── Loading State ─────────────────────────────────────────────── */
  if (loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: 'var(--aura-bg-page, #0A1A2E)' }}
      >
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 animate-spin text-[var(--aura-primary, #c6c6c7)]" />
          <p className="text-[13px] text-[#a0abb8] tracking-widest uppercase font-body">
            {t('posNew.loadingText')}
          </p>
        </div>
      </div>
    );
  }

  /* ─── Error State ───────────────────────────────────────────────── */
  if (error) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: 'var(--aura-bg-page, #0A1A2E)' }}
      >
        <div className="glass-card p-10 flex flex-col items-center gap-4 max-w-md text-center">
          <AlertCircle className="w-10 h-10 text-[#ff6b6b]" />
          <p className="text-[14px] text-[#ff6b6b] font-body">{error}</p>
          <button
            type="button"
            className="px-6 py-3 bg-[var(--aura-primary, #c6c6c7)] text-[#0A1420] text-[11px] font-semibold uppercase tracking-wider rounded-lg hover:brightness-110 transition-all font-body"
            onClick={() => window.location.reload()}
            aria-label={t('posNew.reboot')}
          >
            {t('posNew.reboot')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen flex flex-col select-none"
      style={{ backgroundColor: 'var(--aura-bg-page, #0A1A2E)', color: 'var(--aura-text-primary, #e8e8e8)', overflow: 'hidden', height: '100vh' }}
    >
      {/* ─── Top App Bar ──────────────────────────────────────────────── */}
      <header
        className="bg-[rgba(18,30,52,0.8)] backdrop-blur-xl border-b border-[rgba(198,198,199,0.08)] flex justify-between items-center px-6 h-16 w-full fixed top-0 z-50"
        role="banner"
      >
        <div className="flex items-center gap-4">
          <h1 className="text-[14px] text-[var(--aura-primary, #c6c6c7)] uppercase tracking-widest font-semibold font-body">
            {brandName}
          </h1>
          <div
            className="h-6 w-px bg-[rgba(198,198,199,0.15)]"
            aria-hidden="true"
          />
          <span className="text-[12px] text-[#a0abb8] flex items-center gap-1.5 font-body">
            <Terminal className="w-4 h-4" />
            {t('posNew.terminalSession')}
          </span>
        </div>
        <div className="flex items-center gap-5">
          <button
            type="button"
            className="text-[#a0abb8] hover:text-[var(--aura-text-primary, #e8e8e8)] transition-colors cursor-pointer"
            aria-label={t('posNew.schedule')}
          >
            <Clock className="w-5 h-5" />
          </button>
          <div
            className="flex items-center gap-2 bg-[rgba(26,42,62,0.3)] px-3 py-1.5 rounded-lg border border-[rgba(198,198,199,0.1)] cursor-pointer active:scale-95 transition-transform"
            role="button"
            tabIndex={0}
            aria-label={t('posNew.userProfile')}
          >
            <PersonStanding className="w-4 h-4 text-[var(--aura-primary, #c6c6c7)]" />
            <span className="text-[12px] font-body">Julian R.</span>
          </div>
        </div>
      </header>

      {/* ─── Main Layout ───────────────────────────────────────────────── */}
      <main className="pt-16 flex h-screen w-full relative">
        {/* Left Panel: Menu */}
        <section
          className={cn(
            'flex-1 flex flex-col h-full overflow-hidden px-5 py-4',
            cartOpen ? 'lg:mr-96' : ''
          )}
          aria-label={t('posNew.menuSection')}
        >
          {/* Search & Filters */}
          <div className="flex flex-col gap-4 mb-5">
            <div className="relative w-full max-w-2xl">
              <Search
                className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#7a8a9a]"
                aria-hidden="true"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('posNew.searchPlaceholder')}
                className="w-full bg-[rgba(26,42,62,0.5)] border border-[rgba(198,198,199,0.15)] rounded-lg py-3 pl-11 pr-4 text-[14px] text-[var(--aura-text-primary, #e8e8e8)] focus:outline-none focus:border-[rgba(198,198,199,0.4)] transition-all placeholder:text-[#7a8a9a] font-body"
                aria-label={t('posNew.searchPlaceholder')}
              />
            </div>
            {/* Category Chips */}
            <div
              className="flex gap-3 overflow-x-auto pb-1 custom-scrollbar-pos"
              role="tablist"
              aria-label={t('posNew.categoryFilter')}
            >
              {MENU_CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setActiveCategory(cat)}
                  className={cn(
                    'px-5 py-2 rounded-sm text-[12px] font-semibold uppercase tracking-wider whitespace-nowrap active:scale-95 transition-all font-body',
                    activeCategory === cat
                      ? 'bg-[var(--aura-primary, #c6c6c7)] text-[#0A1420]'
                      : 'glass-card text-[#a0abb8] hover:bg-[rgba(26,42,62,0.4)]'
                  )}
                  role="tab"
                  aria-selected={activeCategory === cat}
                  aria-label={`${cat} ${t('posNew.category')}`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Menu Grid Area */}
          <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar-pos">
            {filteredItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Coffee className="w-12 h-12 text-[rgba(198,198,199,0.12)] mb-4" />
                <p className="text-[14px] text-[#a0abb8] font-body">
                  {searchQuery
                    ? t('posNew.noResults')
                    : t('posNew.noItemsInCategory')}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 gap-4 mb-6">
                {filteredItems.map((item) => (
                  <MenuItemCard
                    key={item.id}
                    item={item}
                    quantity={getQuantity(item.id)}
                    onAdd={() => addToCart(item)}
                    onRemove={() => removeFromCart(item.id)}
                  />
                ))}
              </div>
            )}

            {/* Popular Add-ons */}
            {addOns.length > 0 && (
              <div className="mb-6">
                <h2 className="text-[13px] text-[#a0abb8] uppercase tracking-widest mb-3 font-body">
                  {t('posNew.popularAddOns')}
                </h2>
                <div className="flex gap-3 flex-wrap">
                  {addOns.map((addon) => (
                    <AddOnChip
                      key={addon.id}
                      addon={addon}
                      onAdd={() =>
                        addToCart({
                          id: addon.id,
                          name: addon.name,
                          price: addon.price,
                          category: 'Add-ons',
                        })
                      }
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Mobile Cart Toggle */}
        <button
          type="button"
          className="fixed bottom-20 right-4 z-40 lg:hidden bg-[var(--aura-primary, #c6c6c7)] text-[#0A1420] min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full shadow-lg active:scale-90 transition-transform"
          onClick={() => setCartOpen(!cartOpen)}
          aria-label={cartOpen ? t('posNew.closeCart') : t('posNew.openCart')}
        >
          <ShoppingCart className="w-5 h-5" />
          {cartItemCount > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-[#0A1420] text-[var(--aura-primary, #c6c6c7)] text-[10px] font-bold flex items-center justify-center">
              {cartItemCount}
            </span>
          )}
        </button>

        {/* Right Panel: Cart Sidebar */}
        <aside
          className={cn(
            'fixed right-0 top-0 h-full w-96 flex flex-col z-40 bg-[rgba(26,42,62,0.7)] backdrop-blur-2xl border-l border-[rgba(198,198,199,0.08)] shadow-xl transition-transform duration-300',
            'pt-16',
            cartOpen ? 'translate-x-0' : 'translate-x-full',
            'lg:translate-x-0'
          )}
          aria-label={t('posNew.cartSection')}
        >
          {/* Cart Header */}
          <div className="px-6 py-4 border-b border-[rgba(198,198,199,0.08)]">
            <div className="flex justify-between items-start mb-1">
              <h2 className="text-[14px] text-[var(--aura-primary, #c6c6c7)] font-semibold uppercase tracking-wider font-body">
                {t('posNew.orderSummary')}
              </h2>
              <span className="bg-[rgba(198,198,199,0.08)] text-[var(--aura-primary, #c6c6c7)] border border-[rgba(198,198,199,0.15)] px-2.5 py-0.5 rounded-sm text-[11px] font-body">
                {tableLabel}
              </span>
            </div>
            <p className="text-[12px] text-[#a0abb8] font-body">
              {guestLabel} &bull; {t('posNew.order')} #{orderNumber}
            </p>
          </div>

          {/* Cart Items */}
          <div className="flex-1 overflow-y-auto px-6 py-3 custom-scrollbar-pos">
            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <ShoppingCart className="w-10 h-10 text-[rgba(198,198,199,0.1)] mb-3" />
                <p className="text-[13px] text-[#a0abb8] font-body">
                  {t('posNew.cartEmpty')}
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {cart.map((item) => (
                  <div key={item.id} className="flex items-center gap-3 py-2 group">
                    <div className="w-2 h-10 bg-[var(--aura-primary, #c6c6c7)] opacity-0 group-hover:opacity-100 transition-opacity -ml-6 mr-0 rounded-r-sm" />
                    <div className="flex-1 min-w-0">
                      <h4 className="text-[14px] text-[var(--aura-text-primary, #e8e8e8)] truncate font-body">
                        {item.name}
                      </h4>
                      <p className="text-[12px] text-[#a0abb8] font-body">
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
                        className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-sm bg-[rgba(198,198,199,0.1)] text-[var(--aura-primary, #c6c6c7)] border border-[rgba(198,198,199,0.18)] active:scale-90 transition-transform"
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
          <div className="px-6 py-4 bg-[rgba(18,30,52,0.5)] border-t border-[rgba(198,198,199,0.08)] flex flex-col gap-2">
            <div className="flex justify-between text-[13px] text-[#a0abb8] font-body">
              <span>{t('posNew.subtotal')}</span>
              <span>${subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-[13px] text-[#a0abb8] font-body">
              <span>{t('posNew.tax')}</span>
              <span>${tax.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center mt-2 pt-2 border-t border-[rgba(198,198,199,0.12)]">
              <span className="text-[15px] font-semibold uppercase tracking-widest font-body">
                {t('posNew.total')}
              </span>
              <span className="text-[22px] text-[var(--aura-primary, #c6c6c7)] font-bold font-body">
                ${total.toFixed(2)}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3 mt-3">
              <button
                type="button"
                className="industrial-gradient py-3 px-3 rounded-lg border border-[rgba(198,198,199,0.15)] flex flex-col items-center gap-1 active:brightness-125 transition-all chrome-glow"
                onClick={() => onPayment?.('payos')}
                aria-label={t('posNew.payos')}
              >
                <CreditCard className="w-6 h-6 text-[var(--aura-primary, #c6c6c7)]" />
                <span className="text-[11px] text-[var(--aura-text-primary, #e8e8e8)] uppercase tracking-tight font-body">
                  {t('posNew.payos')}
                </span>
              </button>
              <button
                type="button"
                className="industrial-gradient py-3 px-3 rounded-lg border border-[rgba(198,198,199,0.15)] flex flex-col items-center gap-1 active:brightness-125 transition-all chrome-glow"
                onClick={() => onPayment?.('cod')}
                aria-label={t('posNew.cod')}
              >
                <Wallet className="w-6 h-6 text-[var(--aura-text-primary, #e8e8e8)]" />
                <span className="text-[11px] text-[var(--aura-text-primary, #e8e8e8)] uppercase tracking-tight font-body">
                  {t('posNew.cod')}
                </span>
              </button>
            </div>
            <button
              type="button"
              className="w-full bg-[var(--aura-primary, #c6c6c7)] py-4 rounded-xl flex items-center justify-center gap-2 text-[14px] font-semibold text-[#0A1420] uppercase tracking-widest active:scale-[0.97] transition-transform mt-3 shadow-[0_0_20px_rgba(198,198,199,0.15)] font-body"
              onClick={() => onCompleteOrder?.(cart, total)}
              disabled={cart.length === 0}
              aria-label={t('posNew.completeOrder')}
            >
              {t('posNew.completeOrder')}
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        </aside>
      </main>

      {/* ─── Footer Bar ──────────────────────────────────────────────────── */}
      <footer
        className={cn(
          'fixed bottom-0 left-0 right-0 bg-[rgba(10,20,32,0.9)] border-t border-[rgba(198,198,199,0.08)] flex justify-start items-center gap-5 px-6 h-14 z-50',
          'lg:right-96'
        )}
        role="contentinfo"
      >
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-[var(--aura-text-primary, #e8e8e8)] uppercase tracking-tight font-body">
            {t('posNew.terminalVersion')}
          </span>
          <div
            className="w-2 h-2 rounded-full bg-[#4CAF50] animate-pulse"
            aria-label={t('posNew.connected')}
          />
        </div>
        <div
          className="h-5 w-px bg-[rgba(198,198,199,0.15)]"
          aria-hidden="true"
        />
        <nav className="flex items-center gap-3" aria-label={t('posNew.footerNav')}>
          <button
            type="button"
            className="text-[#a0abb8] px-5 py-1.5 border border-[rgba(198,198,199,0.15)] rounded-full text-[11px] hover:border-[rgba(198,198,199,0.4)] hover:text-[var(--aura-text-primary, #e8e8e8)] transition-all active:scale-95 font-body"
            aria-label={t('posNew.openDrawer')}
          >
            <LogOut className="w-3.5 h-3.5 inline mr-1.5" />
            {t('posNew.openDrawer')}
          </button>
          <button
            type="button"
            className="text-[#a0abb8] px-5 py-1.5 border border-[rgba(198,198,199,0.15)] rounded-full text-[11px] hover:border-[rgba(198,198,199,0.4)] hover:text-[var(--aura-text-primary, #e8e8e8)] transition-all active:scale-95 font-body"
            aria-label={t('posNew.printReceipt')}
          >
            <Printer className="w-3.5 h-3.5 inline mr-1.5" />
            {t('posNew.printReceipt')}
          </button>
          <button
            type="button"
            className="bg-[var(--aura-primary, #c6c6c7)] text-[#0A1420] font-bold px-5 py-1.5 rounded-full text-[11px] active:scale-95 font-body"
            aria-label={t('posNew.endShift')}
          >
            <Receipt className="w-3.5 h-3.5 inline mr-1.5" />
            {t('posNew.endShift')}
          </button>
        </nav>
        <div className="ml-auto">
          <LiveClock />
        </div>
      </footer>

      <style>{POS_STYLES}</style>
    </div>
  );
}

/* ─── Styles ────────────────────────────────────────────────────────── */
const POS_STYLES = `
  .glass-card {
    background: rgba(18, 30, 52, 0.55);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border: 1px solid rgba(198, 198, 199, 0.08);
    border-radius: 12px;
  }
  .industrial-gradient {
    background: linear-gradient(135deg, #2a3a4e 0%, #1a2a3e 100%);
  }
  .chrome-glow:active {
    box-shadow: 0px 0px 12px rgba(198, 198, 199, 0.4);
    filter: brightness(1.1);
  }
  .custom-scrollbar-pos::-webkit-scrollbar {
    width: 4px;
  }
  .custom-scrollbar-pos::-webkit-scrollbar-track {
    background: transparent;
  }
  .custom-scrollbar-pos::-webkit-scrollbar-thumb {
    background: rgba(198, 198, 199, 0.2);
    border-radius: 10px;
  }
`;
