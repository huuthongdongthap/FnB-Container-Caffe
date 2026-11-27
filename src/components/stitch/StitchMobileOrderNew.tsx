/**
 * StitchMobileOrderNew — AURA CAFE Mobile Ordering (Stitch v3 export)
 *
 * Mobile-first ordering page with glassmorphism cards, chrome accents,
 * bottom cart bar, and premium nocturnal lounge feel.
 *
 * States: idle (default), loading, empty, error
 */
'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Coffee } from 'lucide-react';
import { useOrderStore } from '@/hooks/stores/use-order-store';

import type { MenuItem, CartItem, StitchMobileOrderNewProps } from './StitchMobileOrderNew-types';
import { DEFAULT_ITEMS, CATEGORIES } from './StitchMobileOrderNew-default-data';
import { resolvePosCategoryLabel } from './StitchPOSNew-types';
import { ProductCard } from './StitchMobileOrderNew-product-card';
import { FloatingCartBar } from './StitchMobileOrderNew-cart-bar';
import { CategoryFilter } from './StitchMobileOrderNew-category-filter';
import { OrderHeader } from './StitchMobileOrderNew-header';

export type { MenuItem, CartItem, StitchMobileOrderNewProps };

function readTableCart(storageKey: string): CartItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as CartItem[]) : [];
  } catch {
    return [];
  }
}

export function StitchMobileOrderNew({
  items = DEFAULT_ITEMS,
  tableId = 'B01',
  loading = false,
  error = null,
  categoryLabels,
  onBack,
  onSearch,
  onViewCart,
}: Readonly<StitchMobileOrderNewProps>) {
  const { t } = useTranslation();
  const storageKey = `aura_table_order_cart:${tableId || 'default'}`;
  const prevStorageKeyRef = useRef(storageKey);
  const currentOrderId = useOrderStore((s) => s.currentOrder?.id ?? null);
  const initialOrderIdRef = useRef<string | null>(currentOrderId);
  const submittedOrderRef = useRef(false);
  const [activeCategory, setActiveCategory] = useState('all');
  const [cart, setCart] = useState<CartItem[]>(() => readTableCart(storageKey));
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);

  useEffect(() => {
    if (
      submittedOrderRef.current &&
      currentOrderId &&
      currentOrderId !== initialOrderIdRef.current
    ) {
      initialOrderIdRef.current = currentOrderId;
      submittedOrderRef.current = false;
      setCart([]);
      try {
        window.localStorage.removeItem(storageKey);
      } catch {
        /* ignore storage errors */
      }
    }
  }, [currentOrderId, storageKey]);

  const handleViewCart = (currentCart: CartItem[]) => {
    submittedOrderRef.current = true;
    onViewCart?.(currentCart);
  };

  useEffect(() => {
    if (prevStorageKeyRef.current !== storageKey) {
      prevStorageKeyRef.current = storageKey;
      setCart(readTableCart(storageKey));
      return;
    }
    try {
      if (cart.length === 0) {
        window.localStorage.removeItem(storageKey);
      } else {
        window.localStorage.setItem(storageKey, JSON.stringify(cart));
      }
    } catch {
      /* ignore storage errors */
    }
  }, [cart, storageKey]);

  const derivedCategories = useMemo(() => {
    const knownKeys = new Set<string>(CATEGORIES.map((c) => c.key));
    const itemCats = Array.from(
      new Set(items.map((item) => item.category?.trim()).filter((c): c is string => Boolean(c))),
    );
    const hasCustomCategories = itemCats.some((c) => !knownKeys.has(c));
    if (!hasCustomCategories) return CATEGORIES;
    return [
      { key: 'all', label: 'Tất cả' },
      ...itemCats.map((cat) => ({
        key: cat,
        label: resolvePosCategoryLabel(cat, categoryLabels),
      })),
    ];
  }, [items, categoryLabels]);

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchesCategory =
        activeCategory === 'all' || item.category === activeCategory;
      const matchesSearch =
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.description.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [items, activeCategory, searchQuery]);

  const getQuantity = (id: string): number =>
    cart.find((c) => c.id === id)?.quantity ?? 0;

  const addToCart = (item: MenuItem) => {
    setCart((prev) => {
      const existing = prev.find((c) => c.id === item.id);
      if (existing) {
        return prev.map((c) =>
          c.id === item.id ? { ...c, quantity: c.quantity + 1 } : c,
        );
      }
      return [...prev, { ...item, quantity: 1 }];
    });
  };

  const removeFromCart = (id: string) => {
    setCart((prev) => {
      const existing = prev.find((c) => c.id === id);
      if (existing && existing.quantity <= 1) {
        return prev.filter((c) => c.id !== id);
      }
      return prev.map((c) =>
        c.id === id ? { ...c, quantity: c.quantity - 1 } : c,
      );
    });
  };

  const totalItems = cart.reduce((acc, c) => acc + c.quantity, 0);
  const totalPrice = cart.reduce((acc, c) => acc + c.price * c.quantity, 0);

  const handleToggleSearch = () => {
    setShowSearch((prev) => {
      if (prev) {
        setSearchQuery('');
        onSearch?.('');
      }
      return !prev;
    });
  };

  const handleSearchChange = (query: string) => {
    setSearchQuery(query);
    onSearch?.(query);
  };

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ backgroundColor: 'var(--aura-bg-page, var(--aura-bg-surface))', color: 'var(--aura-text-primary, #e8e8e8)' }}
      role="main"
      aria-label={t('stitch.ordering.pageLabel', {
        defaultValue: 'Mobile Ordering — AURA CAFE',
      })}
    >
      <OrderHeader
        tableId={tableId}
        showSearch={showSearch}
        searchQuery={searchQuery}
        onBack={onBack}
        onToggleSearch={handleToggleSearch}
        onSearchChange={handleSearchChange}
      />

      <main className="pt-16 pb-32 min-h-screen px-5 flex flex-col gap-8">
        {loading && (
          <section className="flex flex-col items-center justify-center py-20 gap-4" aria-live="polite">
            <div className="w-10 h-10 border-2 border-[var(--aura-primary, #c6c6c7)] border-t-transparent rounded-full animate-spin" />
            <p className="font-body text-[14px] text-[var(--aura-text-secondary, #a0a8b0)]">
              {t('stitch.ordering.loading', { defaultValue: 'Loading menu...' })}
            </p>
          </section>
        )}

        {!loading && error && (
          <section className="flex flex-col items-center justify-center py-20 gap-4" aria-live="assertive">
            <Coffee className="w-10 h-10 text-[rgba(var(--aura-chrome-light),0.2)]" />
            <p className="font-body text-[14px] text-[var(--aura-error,#FFB4AB)]">
              {t('stitch.ordering.error', { defaultValue: error })}
            </p>
          </section>
        )}

        {!loading && !error && (
          <>
            <CategoryFilter
              categories={derivedCategories}
              activeCategory={activeCategory}
              onSelect={setActiveCategory}
            />

            <section className="flex flex-col gap-4" aria-label={t('stitch.ordering.menuSection', { defaultValue: 'Menu items' })}>
              <h2 className="font-display text-[22px] text-[var(--aura-chrome-bright,#E8EEF3)] font-medium mb-1">
                {t('stitch.ordering.curationsTitle', { defaultValue: 'Our Curations' })}
              </h2>

              {filteredItems.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <Coffee className="w-12 h-12 text-[rgba(var(--aura-chrome-light),0.15)]" />
                  <p className="font-body text-[14px] text-[var(--aura-text-secondary, #a0a8b0)]">
                    {t('stitch.ordering.noItems', { defaultValue: 'No items found' })}
                  </p>
                </div>
              )}

              {filteredItems.map((item) => (
                <ProductCard
                  key={item.id}
                  item={item}
                  quantity={getQuantity(item.id)}
                  onAdd={() => addToCart(item)}
                  onRemove={() => removeFromCart(item.id)}
                />
              ))}
            </section>
          </>
        )}
      </main>

      {totalItems > 0 && (
        <FloatingCartBar
          totalItems={totalItems}
          totalPrice={totalPrice}
          cart={cart}
          onViewCart={handleViewCart}
        />
      )}

      <style>{`
        .glass-panel {
          background: rgba(22, 42, 68, 0.4);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          border: 0.5px solid rgba(229, 228, 226, 0.15);
          border-radius: 16px;
          transition: all 0.2s ease;
        }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}

export default StitchMobileOrderNew;
