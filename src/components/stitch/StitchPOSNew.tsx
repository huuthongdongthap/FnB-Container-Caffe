/**
 * StitchPOSNew — AURA CAFE POS Terminal (Warm Bronze Edition)
 *
 * Two-panel layout: left menu grid with search + category chips + add-ons,
 * right cart sidebar with quantity controls, subtotal/tax/total, pay buttons.
 * Warm bronze/amber glassmorphism palette.
 * Source: Stitch AI aura_cafe_pos_terminal export.
 *
 * States: loading, error, empty, populated
 */
'use client';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, AlertCircle } from 'lucide-react';

import type { StitchPOSNewProps, POSNewCartItem } from './StitchPOSNew-types';
import { DEFAULT_MENU_ITEMS, DEFAULT_ADDONS } from './StitchPOSNew-types';
import type { POSCustomer } from '@/hooks/use-pos-customer';
import { POSHeader } from './StitchPOSNew-header';
import { MenuSection } from './StitchPOSNew-menu-section';
import { CartSidebar } from './StitchPOSNew-cart-sidebar';
import { POSFooter } from './StitchPOSNew-footer';
import { POS_STYLES } from './StitchPOSNew-styles';

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
  customer = null,
  onCustomerFound,
  onClearCustomer,
}: Readonly<StitchPOSNewProps>) {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('Coffee');
  const [cart, setCart] = useState<POSNewCartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(true);

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

  const addToCart = (item: { id: string; name: string; price: number; category?: string }) => {
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
        style={{ backgroundColor: 'var(--aura-bg-page, #16130f)' }}
      >
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 animate-spin text-[var(--aura-primary, #f2c08d)]" />
          <p className="text-[13px] text-[#8a7a6a] tracking-widest uppercase font-body">
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
        style={{ backgroundColor: 'var(--aura-bg-page, #16130f)' }}
      >
        <div className="glass-card p-10 flex flex-col items-center gap-4 max-w-md text-center">
          <AlertCircle className="w-10 h-10 text-[#ff6b6b]" />
          <p className="text-[14px] text-[#ff6b6b] font-body">{error}</p>
          <button
            type="button"
            className="px-6 py-3 bg-[var(--aura-primary, #f2c08d)] text-[#1a1008] text-[11px] font-semibold uppercase tracking-wider rounded-lg hover:brightness-110 transition-all font-body"
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
      style={{ backgroundColor: 'var(--aura-bg-page, #16130f)', color: 'var(--aura-text-primary, #eae1db)', overflow: 'hidden', height: '100vh' }}
    >
      <POSHeader brandName={brandName} />

      <main className="pt-16 flex h-screen w-full relative">
        <MenuSection
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          activeCategory={activeCategory}
          onCategoryChange={setActiveCategory}
          filteredItems={filteredItems}
          addOns={addOns}
          getQuantity={getQuantity}
          addToCart={addToCart}
          removeFromCart={removeFromCart}
          cartOpen={cartOpen}
        />

        {/* Mobile Cart Toggle */}
        <button
          type="button"
          className="fixed bottom-20 right-4 z-40 lg:hidden bg-[var(--aura-primary, #f2c08d)] text-[#1a1008] min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full shadow-lg active:scale-90 transition-transform"
          onClick={() => setCartOpen(!cartOpen)}
          aria-label={cartOpen ? t('posNew.closeCart') : t('posNew.openCart')}
        >
          <span className="relative">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="m1 1 4 0 2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
            {cartItemCount > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-[#1a1008] text-[var(--aura-primary, #f2c08d)] text-[10px] font-bold flex items-center justify-center">
                {cartItemCount}
              </span>
            )}
          </span>
        </button>

        <CartSidebar
          cart={cart}
          addToCart={addToCart}
          removeFromCart={removeFromCart}
          subtotal={subtotal}
          tax={tax}
          total={total}
          tableLabel={tableLabel}
          guestLabel={guestLabel}
          orderNumber={orderNumber}
          cartOpen={cartOpen}
          setCartOpen={setCartOpen}
          onCompleteOrder={onCompleteOrder}
          onPayment={onPayment}
          customer={customer}
          onCustomerFound={onCustomerFound}
          onClearCustomer={onClearCustomer}
        />
      </main>

      <POSFooter cartOpen={cartOpen} />
      <style>{POS_STYLES}</style>
    </div>
  );
}
