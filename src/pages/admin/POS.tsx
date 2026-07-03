/**
 * AURA CAFE — Point of Sale Terminal
 *
 * Two-panel POS layout: left menu grid with search + category chips + add-ons,
 * right cart sidebar with quantity controls, subtotal/Luxury Tax/total, PayOS/COD buttons.
 * Footer with live clock and admin actions.
 *
 * Source: Stitch AI admin-pos HTML -> React TSX
 * Tokens: var(--aura-*) from stitch-tokens.css
 * Icons: Lucide React (matching Material Symbols semantics)
 *
 * States: loading (glass skeleton spinner), error (glass error card with retry),
 *         empty (glass empty message for search/category), populated
 */
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useMenu } from '@/hooks/use-menu';
import { useCart } from '@/hooks/use-cart';
import { useCheckout, useProcessPayOS } from '@/hooks/use-checkout';
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
  X,
  CheckCircle2,
} from 'lucide-react';
import type { PaymentMethod } from '@/lib/validators';
import { brandConfig } from '@/config/brand-types';

/* ─── Constants ─────────────────────────────────────────────────────────── */
const LUXURY_TAX_RATE = 0.05;

const ADDON_ITEMS = [
  { id: 'addon-oat-milk', name: 'Oat Milk', price: 1.0 },
  { id: 'addon-double-shot', name: 'Double Shot', price: 2.0 },
  { id: 'addon-vanilla-bean', name: 'Vanilla Bean', price: 0.75 },
] as const;

/* ─── LiveClock Sub-Component ────────────────────────────────────────────── */
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
      }),
    );
  }, []);

  useEffect(() => {
    updateClock();
    const id = setInterval(updateClock, 1000);
    return () => clearInterval(id);
  }, [updateClock]);

  return <span>{time}</span>;
}

/* ─── MenuItemCard Sub-Component ─────────────────────────────────────────── */
function MenuItemCard({
  item,
  quantity,
  onAdd,
  onRemove,
}: Readonly<{
  item: { id: number | string; name: string; price: number };
  quantity: number;
  onAdd: () => void;
  onRemove: () => void;
}>) {
  return (
    <div
      className="group relative overflow-hidden rounded-xl aspect-[4/5] flex flex-col cursor-pointer active:scale-[0.98] transition-transform"
      style={{
        background: 'var(--aura-glass-bg)',
        backdropFilter: 'blur(var(--aura-glass-blur))',
        WebkitBackdropFilter: 'blur(var(--aura-glass-blur))',
        border: '1px solid var(--aura-glass-border)',
      }}
    >
      {/* Image placeholder gradient layer */}
      <div className="absolute inset-0 bg-gradient-to-br from-[rgba(198,198,199,0.06)] to-[rgba(0,0,0,0.3)]" />
      {/* Bottom fade gradient */}
      <div className="absolute inset-0 bg-gradient-to-t from-[var(--aura-bg-void)] via-transparent to-transparent opacity-90" />

      <div className="mt-auto p-md relative z-10">
        <h3
          className="leading-tight font-medium truncate"
          style={{
            fontFamily: 'var(--aura-font-body)',
            fontSize: 'var(--aura-text-body)',
            color: 'var(--aura-text-primary)',
          }}
        >
          {item.name}
        </h3>
        <div className="flex items-center justify-between mt-2">
          <p
            className="font-semibold"
            style={{
              fontFamily: 'var(--aura-font-body)',
              fontSize: 'var(--aura-text-body-sm)',
              color: 'var(--aura-tertiary)',
            }}
          >
            ${item.price.toFixed(2)}
          </p>

          {quantity > 0 ? (
            <div
              className="flex items-center gap-1 rounded-lg px-1.5 py-1"
              style={{ backgroundColor: 'rgba(212,165,116,0.15)' }}
            >
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove();
                }}
                className="w-7 h-7 flex items-center justify-center rounded-md transition-all active:scale-90 hover:bg-[rgba(212,165,116,0.2)]"
                style={{ color: 'var(--aura-text-primary)' }}
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <span
                className="w-6 text-center font-medium"
                style={{
                  fontFamily: 'var(--aura-font-body)',
                  fontSize: '13px',
                  color: 'var(--aura-text-primary)',
                }}
              >
                {quantity}
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onAdd();
                }}
                className="w-7 h-7 flex items-center justify-center rounded-md transition-all active:scale-90"
                style={{
                  backgroundColor: 'rgba(212,165,116,0.2)',
                  color: 'var(--aura-tertiary)',
                }}
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onAdd();
              }}
              className="w-8 h-8 flex items-center justify-center rounded-lg transition-all active:scale-90 hover:bg-[rgba(212,165,116,0.2)]"
              style={{
                backgroundColor: 'rgba(212,165,116,0.12)',
                color: 'var(--aura-tertiary)',
              }}
            >
              <Plus className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── AddOnChip Sub-Component ────────────────────────────────────────────── */
function AddOnChip({
  addon,
  onAdd,
}: Readonly<{
  addon: { id: string; name: string; price: number };
  onAdd: () => void;
}>) {
  return (
    <button
      type="button"
      onClick={onAdd}
      className="flex items-center gap-sm cursor-pointer transition-colors active:scale-95 hover:bg-[rgba(61,56,52,0.4)] px-md py-sm rounded-lg"
      style={{
        background: 'var(--aura-glass-bg)',
        backdropFilter: 'blur(var(--aura-glass-blur))',
        WebkitBackdropFilter: 'blur(var(--aura-glass-blur))',
        border: '1px solid var(--aura-glass-border)',
      }}
    >
      <Plus className="w-4 h-4" style={{ color: 'var(--aura-tertiary)' }} />
      <div className="text-left">
        <p
          style={{
            fontFamily: 'var(--aura-font-body)',
            fontSize: 'var(--aura-text-body-sm)',
            color: 'var(--aura-text-primary)',
          }}
        >
          {addon.name}
        </p>
        <p
          style={{
            fontFamily: 'var(--aura-font-body)',
            fontSize: 'var(--aura-text-label-sm)',
            color: 'var(--aura-text-secondary)',
          }}
        >
          +${addon.price.toFixed(2)}
        </p>
      </div>
    </button>
  );
}

/* ─── Main Page Component ────────────────────────────────────────────────── */
export default function AdminPOSPage() {
  /* ── Data Hooks ───────────────────────────────────────────────────── */
  const {
    data: menuData,
    isLoading: menuLoading,
    isError: menuIsError,
    error: menuError,
    refetch: refetchMenu,
  } = useMenu({ available: true, limit: 100 });

  const {
    items: cartItems,
    totalItems,
    subtotal,
    addItem,
    removeItem,
    updateQuantity,
    clearCart,
  } = useCart();

  const checkoutMutation = useCheckout();
  const payOSMutation = useProcessPayOS();

  /* ── Local State ──────────────────────────────────────────────────── */
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('');
  const [cartOpen, setCartOpen] = useState(true);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('payos');
  const [checkoutSuccess, setCheckoutSuccess] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [isCompleting, setIsCompleting] = useState(false);

  /* ── Derived Data ─────────────────────────────────────────────────── */
  const menuItems = menuData?.items ?? [];
  const categories = [...new Set(menuItems.map((item) => item.category))];
  const displayCategories = activeCategory
    ? [activeCategory, ...categories.filter((c) => c !== activeCategory)]
    : categories;
  const activeCat = activeCategory || categories[0] || '';

  const filteredItems = menuItems.filter((item) => {
    const matchesCategory =
      !activeCat || item.category?.toLowerCase() === activeCat.toLowerCase();
    const matchesSearch = item.name
      .toLowerCase()
      .includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  /* ── Cart Helpers ─────────────────────────────────────────────────── */
  const getQuantity = (id: number) => {
    const found = cartItems.find((c) => c.id === String(id));
    return found?.quantity ?? 0;
  };

  const addToCart = useCallback(
    (item: { id: number | string; name: string; price: number }) => {
      addItem({ id: String(item.id), name: item.name, price: item.price });
    },
    [addItem],
  );

  const handleRemoveFromCart = useCallback(
    (id: string) => {
      const existing = cartItems.find((c) => c.id === id);
      if (existing && existing.quantity > 1) {
        updateQuantity(id, existing.quantity - 1);
      } else {
        removeItem(id);
      }
    },
    [cartItems, updateQuantity, removeItem],
  );

  const luxuryTax = subtotal * LUXURY_TAX_RATE;
  const grandTotal = subtotal + luxuryTax;

  /* ── Checkout Handler ─────────────────────────────────────────────── */
  const handleCompleteOrder = useCallback(async () => {
    if (cartItems.length === 0 || isCompleting) return;

    setIsCompleting(true);
    setCheckoutError(null);
    setCheckoutSuccess(false);

    try {
      const result = await checkoutMutation.mutateAsync({
        items: cartItems.map((ci) => ({
          id: ci.id,
          name: ci.name,
          price: ci.price,
          quantity: ci.quantity,
        })),
        total: grandTotal,
        customer_name: 'Khách tại quán',
        customer_phone: '0900000000',
        customer_email: undefined,
        customer_address: 'Tại quán',
        payment_method: paymentMethod,
      } as Parameters<typeof checkoutMutation.mutateAsync>[0]);

      if (result.success) {
        if (
          paymentMethod === 'payos' &&
          (result.payment_url || (result as any).checkout_url)
        ) {
          const url =
            result.payment_url || (result as any).checkout_url;
          window.open(url, '_blank');
        }

        setCheckoutSuccess(true);
        clearCart();
        setTimeout(() => setCheckoutSuccess(false), 3000);
      } else {
        setCheckoutError(
          (result as any).message || 'Khong the tao don hang',
        );
      }
    } catch (err) {
      setCheckoutError(
        err instanceof Error ? err.message : 'Khong the tao don hang',
      );
    } finally {
      setIsCompleting(false);
    }
  }, [
    cartItems,
    grandTotal,
    paymentMethod,
    checkoutMutation,
    clearCart,
    isCompleting,
  ]);

  /* ── Loading State ────────────────────────────────────────────────── */
  if (menuLoading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center select-none"
        style={{
          backgroundColor: 'var(--aura-bg-page)',
          color: 'var(--aura-text-primary)',
        }}
      >
        <div className="flex flex-col items-center gap-4">
          <Loader2
            className="w-10 h-10 animate-spin"
            style={{ color: 'var(--aura-tertiary)' }}
          />
          <p
            className="text-[13px] uppercase tracking-widest"
            style={{
              fontFamily: 'var(--aura-font-body)',
              color: 'var(--aura-text-secondary)',
            }}
          >
            Initializing POS Terminal...
          </p>
        </div>
      </div>
    );
  }

  /* ── Error State ──────────────────────────────────────────────────── */
  if (menuIsError) {
    return (
      <div
        className="min-h-screen flex items-center justify-center select-none"
        style={{ backgroundColor: 'var(--aura-bg-page)' }}
      >
        <div
          className="p-10 flex flex-col items-center gap-4 max-w-md text-center rounded-xl"
          style={{
            background: 'var(--aura-glass-bg)',
            backdropFilter: 'blur(var(--aura-glass-blur))',
            WebkitBackdropFilter: 'blur(var(--aura-glass-blur))',
            border: '1px solid var(--aura-glass-border)',
          }}
        >
          <AlertCircle
            className="w-10 h-10"
            style={{ color: 'var(--aura-error)' }}
          />
          <p
            style={{
              fontFamily: 'var(--aura-font-body)',
              fontSize: 'var(--aura-text-body-sm)',
              color: 'var(--aura-error)',
            }}
          >
            {menuError instanceof Error
              ? menuError.message
              : 'Failed to load menu. Check server connection.'}
          </p>
          <button
            type="button"
            onClick={() => refetchMenu()}
            className="px-6 py-3 rounded-lg text-[11px] font-semibold uppercase tracking-wider transition-all hover:brightness-110 active:scale-95"
            style={{
              backgroundColor: 'var(--aura-tertiary)',
              color: 'var(--aura-on-tertiary)',
              fontFamily: 'var(--aura-font-body)',
            }}
          >
            Reboot Terminal
          </button>
        </div>
      </div>
    );
  }

  /* ── Main Render ──────────────────────────────────────────────────── */
  return (
    <div
      className="min-h-screen flex flex-col select-none"
      style={{
        backgroundColor: 'var(--aura-bg-page)',
        color: 'var(--aura-text-primary)',
        overflow: 'hidden',
        height: '100vh',
      }}
    >
      {/* ═══ Top App Bar ════════════════════════════════════════════════ */}
      <header
        className="flex justify-between items-center px-margin-edge h-16 w-full fixed top-0 z-50"
        style={{
          backgroundColor: 'rgba(35,31,27,0.8)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          borderBottom: '1px solid var(--aura-border-subtle)',
        }}
      >
        <div className="flex items-center gap-md">
          <h1
            className="uppercase tracking-widest font-semibold"
            style={{
              fontFamily: 'var(--aura-font-body)',
              fontSize: 'var(--aura-text-body-sm)',
              color: 'var(--aura-tertiary)',
            }}
          >
            {brandConfig.brand.nameShort}
          </h1>
          <div
            className="h-6 w-px"
            style={{ backgroundColor: 'var(--aura-border-subtle)' }}
          />
          <span
            className="flex items-center gap-xs"
            style={{
              fontFamily: 'var(--aura-font-body)',
              fontSize: 'var(--aura-text-label-sm)',
              color: 'var(--aura-text-secondary)',
            }}
          >
            <Terminal className="w-4 h-4" />
            Terminal Session: Active
          </span>
        </div>

        <div className="flex items-center gap-gutter">
          <button
            type="button"
            className="transition-colors cursor-pointer"
            style={{ color: 'var(--aura-text-secondary)' }}
          >
            <Clock className="w-5 h-5 hover:text-[var(--aura-tertiary)]" />
          </button>
          <div
            className="flex items-center gap-xs px-sm py-xs rounded-lg cursor-pointer active:scale-95 transition-transform"
            style={{
              backgroundColor: 'rgba(61,56,52,0.2)',
              border: '1px solid var(--aura-border-subtle)',
            }}
          >
            <PersonStanding
              className="w-4 h-4"
              style={{ color: 'var(--aura-tertiary)' }}
            />
            <span
              style={{
                fontFamily: 'var(--aura-font-body)',
                fontSize: 'var(--aura-text-label-sm)',
              }}
            >
              Julian R.
            </span>
          </div>
        </div>
      </header>

      {/* ═══ Main Layout ════════════════════════════════════════════════ */}
      <main className="pt-16 flex h-screen w-full relative">
        {/* ── Left Panel: Menu & Search ──────────────────────────────── */}
        <section
          className={clsx(
            'flex-1 flex flex-col h-full overflow-hidden px-margin-edge py-md',
            cartOpen && 'lg:mr-96',
          )}
        >
          {/* Search & Filters */}
          <div className="flex flex-col gap-md mb-lg">
            <div className="relative w-full max-w-2xl">
              <Search
                className="absolute left-sm top-1/2 -translate-y-1/2 w-4 h-4"
                style={{ color: 'var(--aura-outline)' }}
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search menu items, orders, or customers..."
                className="w-full py-sm pl-xl pr-md rounded-lg transition-all focus:outline-none"
                style={{
                  backgroundColor: 'var(--aura-bg-glass)',
                  border: '1px solid var(--aura-border-subtle)',
                  fontFamily: 'var(--aura-font-body)',
                  fontSize: 'var(--aura-text-body-sm)',
                  color: 'var(--aura-text-primary)',
                }}
              />
            </div>

            {/* Category Chips */}
            <div className="flex gap-sm overflow-x-auto pb-base">
              {displayCategories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setActiveCategory(cat)}
                  className={clsx(
                    'px-md py-xs rounded-sm whitespace-nowrap uppercase tracking-wider active:scale-95 transition-all text-[12px] font-semibold',
                    activeCat === cat ||
                      (!activeCategory && cat === displayCategories[0])
                      ? ''
                      : 'hover:bg-[rgba(61,56,52,0.3)]',
                  )}
                  style={{
                    fontFamily: 'var(--aura-font-body)',
                    backgroundColor:
                      activeCat === cat ||
                      (!activeCategory && cat === displayCategories[0])
                        ? 'var(--aura-tertiary)'
                        : 'var(--aura-glass-bg)',
                    color:
                      activeCat === cat ||
                      (!activeCategory && cat === displayCategories[0])
                        ? 'var(--aura-on-tertiary)'
                        : 'var(--aura-text-secondary)',
                    border:
                      activeCat === cat ||
                      (!activeCategory && cat === displayCategories[0])
                        ? 'none'
                        : '1px solid var(--aura-glass-border)',
                  }}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Menu Grid */}
          <div className="flex-1 overflow-y-auto pr-xs">
            {filteredItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Coffee
                  className="w-12 h-12 mb-4"
                  style={{ color: 'rgba(212,165,116,0.15)' }}
                />
                <p
                  style={{
                    fontFamily: 'var(--aura-font-body)',
                    fontSize: 'var(--aura-text-body-sm)',
                    color: 'var(--aura-text-secondary)',
                  }}
                >
                  {searchQuery
                    ? 'No menu items match your search.'
                    : 'No items in this category.'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 gap-gutter mb-xl">
                {filteredItems.map((item) => (
                  <MenuItemCard
                    key={item.id}
                    item={item}
                    quantity={getQuantity(item.id)}
                    onAdd={() =>
                      addToCart({
                        id: item.id,
                        name: item.name,
                        price: item.price,
                      })
                    }
                    onRemove={() => handleRemoveFromCart(String(item.id))}
                  />
                ))}
              </div>
            )}

            {/* Add-ons Section */}
            <div className="mb-gutter">
              <h2
                className="uppercase tracking-widest mb-md"
                style={{
                  fontFamily: 'var(--aura-font-body)',
                  fontSize: 'var(--aura-text-body-sm)',
                  color: 'var(--aura-text-secondary)',
                }}
              >
                Popular Add-ons
              </h2>
              <div className="flex gap-gutter flex-wrap">
                {ADDON_ITEMS.map((addon) => (
                  <AddOnChip
                    key={addon.id}
                    addon={addon}
                    onAdd={() =>
                      addToCart({
                        id: addon.id,
                        name: addon.name,
                        price: addon.price,
                      })
                    }
                  />
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── Right Panel: Cart Sidebar ──────────────────────────────── */}
        <aside
          className={clsx(
            'fixed right-0 top-0 h-full w-96 flex flex-col z-40 shadow-xl transition-transform duration-300',
            'pt-16',
            cartOpen ? 'translate-x-0' : 'translate-x-full',
            'lg:translate-x-0',
          )}
          style={{
            backgroundColor: 'rgba(46,41,37,0.7)',
            backdropFilter: 'blur(32px)',
            WebkitBackdropFilter: 'blur(32px)',
            borderLeft: '1px solid var(--aura-border-subtle)',
          }}
        >
          {/* Cart Header */}
          <div
            className="px-margin-edge py-md border-b"
            style={{ borderColor: 'var(--aura-border-subtle)' }}
          >
            <div className="flex justify-between items-start mb-base">
              <h2
                className="uppercase tracking-wider font-semibold"
                style={{
                  fontFamily: 'var(--aura-font-body)',
                  fontSize: 'var(--aura-text-body-sm)',
                  color: 'var(--aura-tertiary)',
                }}
              >
                Order Summary
              </h2>
              <span
                className="px-sm py-[2px] rounded-sm text-[11px]"
                style={{
                  backgroundColor: 'rgba(212,165,116,0.1)',
                  color: 'var(--aura-tertiary)',
                  border: '1px solid rgba(212,165,116,0.2)',
                  fontFamily: 'var(--aura-font-body)',
                }}
              >
                Table 12
              </span>
            </div>
            <p
              style={{
                fontFamily: 'var(--aura-font-body)',
                fontSize: 'var(--aura-text-label-sm)',
                color: 'var(--aura-text-secondary)',
              }}
            >
              Guest 2 &bull; Order #842
            </p>
          </div>

          {/* Cart Items */}
          <div className="flex-1 overflow-y-auto px-margin-edge py-sm">
            {cartItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <ShoppingCart
                  className="w-10 h-10 mb-3"
                  style={{ color: 'rgba(212,165,116,0.15)' }}
                />
                <p
                  style={{
                    fontFamily: 'var(--aura-font-body)',
                    fontSize: 'var(--aura-text-body-sm)',
                    color: 'var(--aura-text-secondary)',
                  }}
                >
                  Cart is empty. Select menu items to begin.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-sm">
                {cartItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-sm py-sm group"
                  >
                    {/* Left accent bar on hover */}
                    <div
                      className="w-[3px] h-10 rounded-r-sm opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                      style={{ backgroundColor: 'var(--aura-tertiary)' }}
                    />
                    <div className="flex-1 min-w-0">
                      <h4
                        className="truncate"
                        style={{
                          fontFamily: 'var(--aura-font-body)',
                          fontSize: 'var(--aura-text-body-sm)',
                          color: 'var(--aura-text-primary)',
                        }}
                      >
                        {item.name}
                      </h4>
                      <p
                        style={{
                          fontFamily: 'var(--aura-font-body)',
                          fontSize: 'var(--aura-text-label-sm)',
                          color: 'var(--aura-text-secondary)',
                        }}
                      >
                        ${(item.price * item.quantity).toFixed(2)}
                      </p>
                    </div>
                    <div className="flex items-center gap-xs shrink-0">
                      <button
                        type="button"
                        onClick={() => handleRemoveFromCart(item.id)}
                        className="w-8 h-8 flex items-center justify-center rounded-sm active:scale-90 transition-transform"
                        style={{
                          background: 'var(--aura-glass-bg)',
                          backdropFilter: 'blur(12px)',
                          border: '1px solid var(--aura-glass-border)',
                        }}
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span
                        className="w-8 text-center"
                        style={{
                          fontFamily: 'var(--aura-font-body)',
                          fontSize: 'var(--aura-text-body-sm)',
                        }}
                      >
                        {item.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => addToCart(item)}
                        className="w-8 h-8 flex items-center justify-center rounded-sm active:scale-90 transition-transform"
                        style={{
                          backgroundColor: 'rgba(212,165,116,0.15)',
                          color: 'var(--aura-tertiary)',
                          border: '1px solid rgba(212,165,116,0.25)',
                        }}
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
          <div
            className="px-margin-edge py-md flex flex-col gap-sm"
            style={{
              backgroundColor: 'rgba(35,31,27,0.5)',
              borderTop: '1px solid var(--aura-border-subtle)',
            }}
          >
            <div
              className="flex justify-between"
              style={{
                fontFamily: 'var(--aura-font-body)',
                fontSize: 'var(--aura-text-body-sm)',
                color: 'var(--aura-text-secondary)',
              }}
            >
              <span>Subtotal</span>
              <span>${subtotal.toFixed(2)}</span>
            </div>
            <div
              className="flex justify-between"
              style={{
                fontFamily: 'var(--aura-font-body)',
                fontSize: 'var(--aura-text-body-sm)',
                color: 'var(--aura-text-secondary)',
              }}
            >
              <span>Luxury Tax (5%)</span>
              <span>${luxuryTax.toFixed(2)}</span>
            </div>

            <div
              className="flex justify-between items-center mt-base"
              style={{
                borderTop: '1px solid rgba(80,69,59,0.2)',
                paddingTop: 'var(--aura-space-2)',
              }}
            >
              <span
                className="uppercase tracking-widest font-semibold"
                style={{
                  fontFamily: 'var(--aura-font-body)',
                  fontSize: 'var(--aura-text-body)',
                }}
              >
                Total
              </span>
              <span
                className="font-bold"
                style={{
                  fontFamily: 'var(--aura-font-body)',
                  fontSize: '22px',
                  color: 'var(--aura-tertiary)',
                }}
              >
                ${grandTotal.toFixed(2)}
              </span>
            </div>

            {/* Status Messages */}
            {checkoutSuccess && (
              <div
                className="flex items-center gap-2 text-xs py-2 px-3 rounded-lg"
                style={{
                  backgroundColor: 'rgba(76,175,80,0.1)',
                  color: 'var(--aura-success)',
                  border: '1px solid rgba(76,175,80,0.2)',
                }}
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Order created successfully!</span>
              </div>
            )}

            {checkoutError && (
              <div
                className="flex items-center gap-2 text-xs py-2 px-3 rounded-lg"
                style={{
                  backgroundColor: 'rgba(255,180,171,0.1)',
                  color: 'var(--aura-error)',
                  border: '1px solid rgba(255,180,171,0.2)',
                }}
              >
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span className="flex-1">{checkoutError}</span>
                <button
                  type="button"
                  onClick={() => setCheckoutError(null)}
                  className="shrink-0"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Payment Buttons */}
            <div className="grid grid-cols-2 gap-sm mt-md">
              <button
                type="button"
                onClick={() => setPaymentMethod('payos')}
                className="py-md px-sm rounded-lg flex flex-col items-center gap-xs transition-all active:brightness-125"
                style={{
                  background:
                    paymentMethod === 'payos'
                      ? 'linear-gradient(135deg, #464746 0%, #1b1c1b 100%)'
                      : 'var(--aura-glass-bg)',
                  border:
                    paymentMethod === 'payos'
                      ? '1px solid var(--aura-border-hover)'
                      : '1px solid var(--aura-border-subtle)',
                }}
              >
                <CreditCard
                  className="w-[28px] h-[28px]"
                  style={{ color: 'var(--aura-tertiary)' }}
                />
                <span
                  className="text-[11px] uppercase tracking-tight"
                  style={{
                    fontFamily: 'var(--aura-font-body)',
                    color: 'var(--aura-text-primary)',
                  }}
                >
                  PayOS
                </span>
              </button>
              <button
                type="button"
                onClick={() => setPaymentMethod('cod')}
                className="py-md px-sm rounded-lg flex flex-col items-center gap-xs transition-all active:brightness-125"
                style={{
                  background:
                    paymentMethod === 'cod'
                      ? 'linear-gradient(135deg, #464746 0%, #1b1c1b 100%)'
                      : 'var(--aura-glass-bg)',
                  border:
                    paymentMethod === 'cod'
                      ? '1px solid var(--aura-border-hover)'
                      : '1px solid var(--aura-border-subtle)',
                }}
              >
                <Wallet
                  className="w-[28px] h-[28px]"
                  style={{ color: 'var(--aura-primary)' }}
                />
                <span
                  className="text-[11px] uppercase tracking-tight"
                  style={{
                    fontFamily: 'var(--aura-font-body)',
                    color: 'var(--aura-text-primary)',
                  }}
                >
                  COD
                </span>
              </button>
            </div>

            {/* Complete Order Button */}
            <button
              type="button"
              disabled={cartItems.length === 0 || isCompleting}
              onClick={handleCompleteOrder}
              className="w-full py-lg rounded-xl flex items-center justify-center gap-sm uppercase tracking-widest font-semibold transition-transform active:scale-[0.97] mt-sm disabled:opacity-40 disabled:cursor-not-allowed"
              style={{
                backgroundColor: 'var(--aura-tertiary)',
                color: 'var(--aura-on-tertiary)',
                fontFamily: 'var(--aura-font-body)',
                fontSize: 'var(--aura-text-body-sm)',
                boxShadow: '0 0 20px rgba(212,165,116,0.15)',
              }}
            >
              {isCompleting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  Complete Order
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </div>
        </aside>

        {/* Mobile Cart Toggle FAB */}
        <button
          type="button"
          className="fixed bottom-20 right-4 z-40 p-3 rounded-full shadow-lg active:scale-90 transition-transform lg:hidden"
          style={{
            backgroundColor: 'var(--aura-tertiary)',
            color: 'var(--aura-on-tertiary)',
          }}
          onClick={() => setCartOpen(!cartOpen)}
        >
          <ShoppingCart className="w-5 h-5" />
          {totalItems > 0 && (
            <span
              className="absolute -top-1 -right-1 w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center"
              style={{
                backgroundColor: 'var(--aura-on-tertiary)',
                color: 'var(--aura-tertiary)',
              }}
            >
              {totalItems}
            </span>
          )}
        </button>
      </main>

      {/* ═══ Footer ═════════════════════════════════════════════════════ */}
      <footer
        className="fixed bottom-0 left-0 right-0 lg:right-96 flex justify-start items-center gap-gutter px-margin-edge h-14 z-50"
        style={{
          backgroundColor: 'rgba(17,14,10,0.9)',
          borderTop: '1px solid var(--aura-border-subtle)',
        }}
      >
        <div className="flex items-center gap-sm">
          <span
            className="uppercase tracking-tight text-[11px]"
            style={{
              fontFamily: 'var(--aura-font-body)',
              color: 'var(--aura-text-primary)',
            }}
          >
            AURA Terminal v2.4
          </span>
          <div
            className="w-2 h-2 rounded-full animate-pulse"
            style={{ backgroundColor: 'var(--aura-success)' }}
          />
        </div>
        <div
          className="h-5 w-px"
          style={{ backgroundColor: 'var(--aura-border-subtle)' }}
        />
        <nav className="flex items-center gap-md">
          <button
            type="button"
            className="px-5 py-1.5 rounded-full text-[11px] transition-all active:scale-95"
            style={{
              color: 'var(--aura-primary)',
              border: '1px solid var(--aura-border-subtle)',
              fontFamily: 'var(--aura-font-body)',
            }}
          >
            <LogOut className="w-3.5 h-3.5 inline mr-1.5" />
            Open Drawer
          </button>
          <button
            type="button"
            className="px-5 py-1.5 rounded-full text-[11px] transition-all active:scale-95"
            style={{
              color: 'var(--aura-primary)',
              border: '1px solid var(--aura-border-subtle)',
              fontFamily: 'var(--aura-font-body)',
            }}
          >
            <Printer className="w-3.5 h-3.5 inline mr-1.5" />
            Print Receipt
          </button>
          <button
            type="button"
            className="px-5 py-1.5 rounded-full text-[11px] font-bold active:scale-95"
            style={{
              backgroundColor: 'var(--aura-tertiary)',
              color: 'var(--aura-on-tertiary)',
              fontFamily: 'var(--aura-font-body)',
            }}
          >
            <Receipt className="w-3.5 h-3.5 inline mr-1.5" />
            End Shift
          </button>
        </nav>
        <div
          className="ml-auto text-[11px]"
          style={{
            fontFamily: 'var(--aura-font-body)',
            color: 'var(--aura-text-secondary)',
          }}
        >
          <LiveClock />
        </div>
      </footer>

      {/* ═══ Inline Styles ═════════════════════════════════════════════ */}
      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(212,165,116,0.3);
          border-radius: 10px;
        }
        .industrial-gradient {
          background: linear-gradient(135deg, #464746 0%, #1b1c1b 100%);
        }
      `}</style>
    </div>
  );
}
