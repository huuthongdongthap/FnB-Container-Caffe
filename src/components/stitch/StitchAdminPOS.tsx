/**
 * StitchAdminPOS — AURA CAFE Point of Sale Terminal
 *
 * Two-panel layout: left menu grid with search + category chips + add-ons,
 * right cart sidebar with quantity controls, subtotal/tax/total, pay buttons.
 * Footer live clock. Mobile-first with collapsible cart.
 * Source: Stitch AI admin-pos export.
 *
 * States: loading, error, empty, populated
 */
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { clsx } from 'clsx';
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
  Pizza,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

/* ─── Types ─────────────────────────────────────────────────────────── */
export interface POSMenuItem {
  id: string;
  name: string;
  price: number;
  category?: string;
  image?: string;
}

export interface POSAddOn {
  id: string;
  name: string;
  price: number;
}

export interface POSCartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

export interface StitchAdminPOSProps {
  menuItems?: POSMenuItem[];
  addOns?: POSAddOn[];
  tableLabel?: string;
  guestLabel?: string;
  orderNumber?: string;
  loading?: boolean;
  error?: string | null;
  brandName?: string;
}

/* ─── Constants ─────────────────────────────────────────────────────── */
const MENU_CATEGORIES = ['Coffee', 'Tea', 'Signature', 'Pastries', 'Brunch', 'Merchandise'];

const DEFAULT_MENU_ITEMS: POSMenuItem[] = [
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

const DEFAULT_ADDONS: POSAddOn[] = [
  { id: 'a1', name: 'Oat Milk', price: 1.00 },
  { id: 'a2', name: 'Double Shot', price: 2.00 },
  { id: 'a3', name: 'Vanilla Bean', price: 0.75 },
];

/* ─── Sub-components ────────────────────────────────────────────────── */

function LiveClock() {
  const [time, setTime] = useState('');
  const updateClock = useCallback(() => {
    const now = new Date();
    setTime(now.toLocaleTimeString('en-US', { hour12: true, hour: '2-digit', minute: '2-digit', second: '2-digit' }));
  }, []);

  useEffect(() => {
    updateClock();
    const id = setInterval(updateClock, 1000);
    return () => clearInterval(id);
  }, [updateClock]);

  return <span className="font-['Space_Grotesk',sans-serif] text-[12px] text-[#a0a8b0]">{time}</span>;
}

function MenuItemCard({
  item,
  quantity,
  onAdd,
  onRemove,
}: {
  item: POSMenuItem;
  quantity: number;
  onAdd: () => void;
  onRemove: () => void;
}) {
  return (
    <div className="glass-panel-pos group relative overflow-hidden rounded-xl aspect-[4/5] flex flex-col cursor-pointer active:scale-[0.98] transition-transform bronze-glow-pos">
      {/* Image placeholder with gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-[rgba(198,198,199,0.06)] to-[rgba(0,0,0,0.3)]" />
      <div className="absolute inset-0 bg-gradient-to-t from-[rgba(17,14,10,0.95)] via-transparent to-transparent" />
      <div className="mt-auto p-4 relative z-10">
        <h3 className="font-['Space_Grotesk',sans-serif] text-[16px] text-[#eae1db] font-medium leading-tight">
          {item.name}
        </h3>
        <div className="flex items-center justify-between mt-2">
          <p className="font-['Space_Grotesk',sans-serif] text-[14px] text-[#f2c08d] font-semibold">
            ${item.price.toFixed(2)}
          </p>
          {quantity > 0 ? (
            <div className="flex items-center gap-1 bg-[rgba(242,192,141,0.15)] rounded-lg px-1.5 py-1">
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onRemove(); }}
                className="w-7 h-7 flex items-center justify-center rounded-md text-[#eae1db] hover:bg-[rgba(242,192,141,0.2)] transition-all active:scale-90"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <span className="w-6 text-center font-['Space_Grotesk',sans-serif] text-[13px] text-[#eae1db] font-medium">
                {quantity}
              </span>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onAdd(); }}
                className="w-7 h-7 flex items-center justify-center rounded-md bg-[rgba(242,192,141,0.2)] text-[#f2c08d] transition-all active:scale-90"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onAdd(); }}
              className="w-8 h-8 flex items-center justify-center rounded-lg bg-[rgba(242,192,141,0.12)] text-[#f2c08d] hover:bg-[rgba(242,192,141,0.2)] transition-all active:scale-90"
            >
              <Plus className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function AddOnChip({ addon, onAdd }: { addon: POSAddOn; onAdd: () => void }) {
  return (
    <button
      type="button"
      onClick={onAdd}
      className="glass-panel-pos px-4 py-2 rounded-lg flex items-center gap-2 cursor-pointer hover:bg-[rgba(61,56,52,0.4)] transition-colors active:scale-95"
    >
      <Plus className="w-4 h-4 text-[#f2c08d]" />
      <div className="text-left">
        <p className="font-['Space_Grotesk',sans-serif] text-[13px] text-[#eae1db]">{addon.name}</p>
        <p className="font-['Space_Grotesk',sans-serif] text-[11px] text-[#d4c4b7]">+${addon.price.toFixed(2)}</p>
      </div>
    </button>
  );
}

/* ─── Main Component ─────────────────────────────────────────────────── */
export default function StitchAdminPOS({
  menuItems = DEFAULT_MENU_ITEMS,
  addOns = DEFAULT_ADDONS,
  tableLabel = 'Table 12',
  guestLabel = 'Guest 2',
  orderNumber = '842',
  loading = false,
  error = null,
  brandName = 'AURA CAFE',
}: Readonly<StitchAdminPOSProps>) {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('Coffee');
  const [cart, setCart] = useState<POSCartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(true);
  const LUXURY_TAX_RATE = 0.05;

  const filteredItems = menuItems.filter((item) => {
    const matchesCategory = activeCategory === 'All' || item.category === activeCategory;
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const getQuantity = (id: string) => cart.find((c) => c.id === id)?.quantity ?? 0;

  const addToCart = (item: POSMenuItem) => {
    setCart((prev) => {
      const existing = prev.find((c) => c.id === item.id);
      if (existing) {
        return prev.map((c) => c.id === item.id ? { ...c, quantity: c.quantity + 1 } : c);
      }
      return [...prev, { id: item.id, name: item.name, price: item.price, quantity: 1 }];
    });
  };

  const removeFromCart = (id: string) => {
    setCart((prev) => {
      const existing = prev.find((c) => c.id === id);
      if (existing && existing.quantity <= 1) {
        return prev.filter((c) => c.id !== id);
      }
      return prev.map((c) => c.id === id ? { ...c, quantity: c.quantity - 1 } : c);
    });
  };

  const subtotal = cart.reduce((acc, c) => acc + c.price * c.quantity, 0);
  const luxuryTax = subtotal * LUXURY_TAX_RATE;
  const total = subtotal + luxuryTax;

  /* ─── Loading State ─────────────────────────────────────────────── */
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#16130f' }}>
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 animate-spin text-[#f2c08d]" />
          <p className="font-['Space_Grotesk',sans-serif] text-[13px] text-[#d4c4b7] tracking-widest uppercase">
            {t('adminPOS.loadingText')}
          </p>
        </div>
      </div>
    );
  }

  /* ─── Error State ───────────────────────────────────────────────── */
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#16130f' }}>
        <div className="glass-panel-pos p-10 flex flex-col items-center gap-4 max-w-md text-center">
          <AlertCircle className="w-10 h-10 text-[#ffb4ab]" />
          <p className="font-['Space_Grotesk',sans-serif] text-[14px] text-[#ffb4ab]">{error}</p>
          <button
            type="button"
            className="px-6 py-3 bg-[#f2c08d] text-[#472a03] font-['Space_Grotesk',sans-serif] text-[11px] font-semibold uppercase tracking-wider rounded-lg hover:brightness-110 transition-all"
            onClick={() => window.location.reload()}
          >
            {t('adminPOS.reboot')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col select-none" style={{ backgroundColor: '#16130f', color: '#eae1db', overflow: 'hidden', height: '100vh' }}>
      {/* ─── Top App Bar ──────────────────────────────────────────────── */}
      <header className="bg-[rgba(35,31,27,0.8)] backdrop-blur-xl border-b border-[rgba(80,69,59,0.15)] flex justify-between items-center px-6 h-16 w-full fixed top-0 z-50">
        <div className="flex items-center gap-4">
          <h1 className="font-['Space_Grotesk',sans-serif] text-[14px] text-[#f2c08d] uppercase tracking-widest font-semibold">
            {brandName}
          </h1>
          <div className="h-6 w-px bg-[rgba(80,69,59,0.3)]" />
          <span className="font-['Space_Grotesk',sans-serif] text-[12px] text-[#d4c4b7] flex items-center gap-1.5">
            <Terminal className="w-4 h-4" />
            {t('adminPOS.terminalSession')}
          </span>
        </div>
        <div className="flex items-center gap-5">
          <button type="button" className="text-[#d4c4b7] hover:text-[#f2c08d] transition-colors cursor-pointer">
            <Clock className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2 bg-[rgba(61,56,52,0.2)] px-3 py-1.5 rounded-lg border border-[rgba(229,228,226,0.12)] cursor-pointer active:scale-95 transition-transform">
            <PersonStanding className="w-4 h-4 text-[#f2c08d]" />
            <span className="font-['Space_Grotesk',sans-serif] text-[12px]">Julian R.</span>
          </div>
        </div>
      </header>

      {/* ─── Main Layout ───────────────────────────────────────────────── */}
      <main className="pt-16 flex h-screen w-full relative">
        {/* Left Panel: Menu */}
        <section className={clsx(
          'flex-1 flex flex-col h-full overflow-hidden px-5 py-4',
          cartOpen ? 'lg:mr-96' : ''
        )}>
          {/* Search */}
          <div className="flex flex-col gap-4 mb-5">
            <div className="relative w-full max-w-2xl">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9c8e82]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('adminPOS.searchPlaceholder')}
                className="w-full bg-[rgba(46,41,37,0.5)] border border-[rgba(80,69,59,0.3)] rounded-lg py-3 pl-11 pr-4 font-['Space_Grotesk',sans-serif] text-[14px] text-[#eae1db] focus:outline-none focus:border-[rgba(242,192,141,0.4)] transition-all placeholder:text-[#9c8e82]"
              />
            </div>
            {/* Category Chips */}
            <div className="flex gap-3 overflow-x-auto pb-1 custom-scrollbar-pos">
              {MENU_CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setActiveCategory(cat)}
                  className={clsx(
                    'px-5 py-2 rounded-sm font-[\'Space_Grotesk\',sans-serif] text-[12px] font-semibold uppercase tracking-wider whitespace-nowrap active:scale-95 transition-all',
                    activeCategory === cat
                      ? 'bg-[#f2c08d] text-[#472a03]'
                      : 'glass-panel-pos text-[#d4c4b7] hover:bg-[rgba(61,56,52,0.3)]'
                  )}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Menu Grid */}
          <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar-pos">
            {filteredItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Coffee className="w-12 h-12 text-[rgba(242,192,141,0.15)] mb-4" />
                <p className="font-['Space_Grotesk',sans-serif] text-[14px] text-[#d4c4b7]">
                  {searchQuery
                    ? t('adminPOS.noResults')
                    : t('adminPOS.noItemsInCategory')}
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

            {/* Add-ons */}
            {addOns.length > 0 && (
              <div className="mb-6">
                <h2 className="font-['Space_Grotesk',sans-serif] text-[13px] text-[#d4c4b7] uppercase tracking-widest mb-3">
                  {t('adminPOS.popularAddOns')}
                </h2>
                <div className="flex gap-3 flex-wrap">
                  {addOns.map((addon) => (
                    <AddOnChip key={addon.id} addon={addon} onAdd={() => addToCart({ id: addon.id, name: addon.name, price: addon.price, category: 'Add-ons' })} />
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Mobile Cart Toggle */}
        <button
          type="button"
          className="fixed bottom-20 right-4 z-40 lg:hidden bg-[#f2c08d] text-[#472a03] p-3 rounded-full shadow-lg active:scale-90 transition-transform"
          onClick={() => setCartOpen(!cartOpen)}
        >
          <ShoppingCart className="w-5 h-5" />
          {cart.length > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-[#472a03] text-[#f2c08d] text-[10px] font-bold flex items-center justify-center">
              {cart.reduce((a, c) => a + c.quantity, 0)}
            </span>
          )}
        </button>

        {/* Right Panel: Cart Sidebar */}
        <aside className={clsx(
          'fixed right-0 top-0 h-full w-96 flex flex-col z-40 bg-[rgba(46,41,37,0.7)] backdrop-blur-2xl border-l border-[rgba(80,69,59,0.15)] shadow-xl transition-transform duration-300',
          'pt-16',
          cartOpen ? 'translate-x-0' : 'translate-x-full',
          'lg:translate-x-0'
        )}>
          {/* Cart Header */}
          <div className="px-6 py-4 border-b border-[rgba(80,69,59,0.15)]">
            <div className="flex justify-between items-start mb-1">
              <h2 className="font-['Space_Grotesk',sans-serif] text-[14px] text-[#f2c08d] font-semibold uppercase tracking-wider">
                {t('adminPOS.orderSummary')}
              </h2>
              <span className="bg-[rgba(242,192,141,0.1)] text-[#f2c08d] border border-[rgba(242,192,141,0.2)] px-2.5 py-0.5 rounded-sm font-['Space_Grotesk',sans-serif] text-[11px]">
                {tableLabel}
              </span>
            </div>
            <p className="font-['Space_Grotesk',sans-serif] text-[12px] text-[#d4c4b7]">
              {guestLabel} &bull; Order #{orderNumber}
            </p>
          </div>

          {/* Cart Items */}
          <div className="flex-1 overflow-y-auto px-6 py-3 custom-scrollbar-pos">
            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <ShoppingCart className="w-10 h-10 text-[rgba(242,192,141,0.15)] mb-3" />
                <p className="font-['Space_Grotesk',sans-serif] text-[13px] text-[#d4c4b7]">
                  {t('adminPOS.cartEmpty')}
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {cart.map((item) => (
                  <div key={item.id} className="flex items-center gap-3 py-2 group">
                    <div className="w-2 h-10 bg-[#f2c08d] opacity-0 group-hover:opacity-100 transition-opacity -ml-6 mr-0 rounded-r-sm" />
                    <div className="flex-1 min-w-0">
                      <h4 className="font-['Space_Grotesk',sans-serif] text-[14px] text-[#eae1db] truncate">{item.name}</h4>
                      <p className="font-['Space_Grotesk',sans-serif] text-[12px] text-[#d4c4b7]">
                        ${(item.price * item.quantity).toFixed(2)}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => removeFromCart(item.id)}
                        className="w-8 h-8 flex items-center justify-center rounded-sm glass-panel-pos active:scale-90 transition-transform"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="w-8 text-center font-['Space_Grotesk',sans-serif] text-[14px]">{item.quantity}</span>
                      <button
                        type="button"
                        onClick={() => addToCart(item)}
                        className="w-8 h-8 flex items-center justify-center rounded-sm bg-[rgba(242,192,141,0.15)] text-[#f2c08d] border border-[rgba(242,192,141,0.25)] active:scale-90 transition-transform"
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
          <div className="px-6 py-4 bg-[rgba(35,31,27,0.5)] border-t border-[rgba(80,69,59,0.15)] flex flex-col gap-2">
            <div className="flex justify-between font-['Space_Grotesk',sans-serif] text-[13px] text-[#d4c4b7]">
              <span>{t('adminPOS.subtotal')}</span>
              <span>${subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between font-['Space_Grotesk',sans-serif] text-[13px] text-[#d4c4b7]">
              <span>{t('adminPOS.luxuryTax')}</span>
              <span>${luxuryTax.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center mt-2 pt-2 border-t border-[rgba(80,69,59,0.2)]">
              <span className="font-['Space_Grotesk',sans-serif] text-[15px] font-semibold uppercase tracking-widest">{t('adminPOS.total')}</span>
              <span className="font-['Space_Grotesk',sans-serif] text-[22px] text-[#f2c08d] font-bold">
                ${total.toFixed(2)}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3 mt-3">
              <button
                type="button"
                className="industrial-gradient-pos py-3 px-3 rounded-lg border border-[rgba(80,69,59,0.3)] flex flex-col items-center gap-1 active:brightness-125 transition-all bronze-glow-pos"
              >
                <CreditCard className="w-6 h-6 text-[#f2c08d]" />
                <span className="font-['Space_Grotesk',sans-serif] text-[11px] text-[#eae1db] uppercase tracking-tight">{t('adminPOS.payos')}</span>
              </button>
              <button
                type="button"
                className="industrial-gradient-pos py-3 px-3 rounded-lg border border-[rgba(80,69,59,0.3)] flex flex-col items-center gap-1 active:brightness-125 transition-all bronze-glow-pos"
              >
                <Wallet className="w-6 h-6 text-[#c7c6c4]" />
                <span className="font-['Space_Grotesk',sans-serif] text-[11px] text-[#eae1db] uppercase tracking-tight">{t('adminPOS.cod')}</span>
              </button>
            </div>
            <button
              type="button"
              className="w-full bg-[#f2c08d] py-4 rounded-xl flex items-center justify-center gap-2 font-['Space_Grotesk',sans-serif] text-[14px] font-semibold text-[#472a03] uppercase tracking-widest active:scale-[0.97] transition-transform mt-3 shadow-[0_0_20px_rgba(242,192,141,0.15)]"
            >
              {t('adminPOS.completeOrder')}
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        </aside>
      </main>

      {/* ─── Footer Bar ──────────────────────────────────────────────────── */}
      <footer className="fixed bottom-0 left-0 right-0 lg:right-96 bg-[rgba(17,14,10,0.9)] border-t border-[rgba(80,69,59,0.15)] flex justify-start items-center gap-5 px-6 h-14 z-50">
        <div className="flex items-center gap-2">
          <span className="font-['Space_Grotesk',sans-serif] text-[11px] text-[#eae1db] uppercase tracking-tight">
            {t('adminPOS.terminalVersion')}
          </span>
          <div className="w-2 h-2 rounded-full bg-[#4CAF50] animate-pulse" />
        </div>
        <div className="h-5 w-px bg-[rgba(80,69,59,0.3)]" />
        <nav className="flex items-center gap-3">
          <button
            type="button"
            className="text-[#c7c6c4] px-5 py-1.5 border border-[rgba(80,69,59,0.3)] rounded-full font-['Space_Grotesk',sans-serif] text-[11px] hover:border-[rgba(242,192,141,0.4)] hover:text-[#f2c08d] transition-all active:scale-95"
          >
            <LogOut className="w-3.5 h-3.5 inline mr-1.5" />
            {t('adminPOS.openDrawer')}
          </button>
          <button
            type="button"
            className="text-[#c7c6c4] px-5 py-1.5 border border-[rgba(80,69,59,0.3)] rounded-full font-['Space_Grotesk',sans-serif] text-[11px] hover:border-[rgba(242,192,141,0.4)] hover:text-[#f2c08d] transition-all active:scale-95"
          >
            <Printer className="w-3.5 h-3.5 inline mr-1.5" />
            {t('adminPOS.printReceipt')}
          </button>
          <button
            type="button"
            className="bg-[#f2c08d] text-[#472a03] font-bold px-5 py-1.5 rounded-full font-['Space_Grotesk',sans-serif] text-[11px] active:scale-95"
          >
            <Receipt className="w-3.5 h-3.5 inline mr-1.5" />
            End Shift
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
  .glass-panel-pos {
    background: rgba(35, 31, 27, 0.6);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border: 1px solid rgba(229, 228, 226, 0.1);
    border-radius: 12px;
  }
  .industrial-gradient-pos {
    background: linear-gradient(135deg, #464746 0%, #1b1c1b 100%);
  }
  .bronze-glow-pos:active {
    box-shadow: 0px 0px 12px rgba(242, 192, 141, 0.6);
    filter: brightness(1.1);
  }
  .custom-scrollbar-pos::-webkit-scrollbar {
    width: 4px;
  }
  .custom-scrollbar-pos::-webkit-scrollbar-track {
    background: transparent;
  }
  .custom-scrollbar-pos::-webkit-scrollbar-thumb {
    background: rgba(242, 192, 141, 0.3);
    border-radius: 10px;
  }
`;
