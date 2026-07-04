/**
 * StitchMobileOrderNew — AURA CAFE Mobile Ordering (Stitch v3 export)
 *
 * Mobile-first ordering page with glassmorphism cards, chrome accents,
 * bottom cart bar, and premium nocturnal lounge feel.
 * Source: Stitch AI aura_cafe_mobile_ordering export.
 *
 * States: idle (default), loading, empty, error
 */
'use client';

import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { clsx } from 'clsx';
import {
  Search,
  ShoppingCart,
  Plus,
  Minus,
  ArrowLeft,
  Coffee,
  ChevronRight,
  Star,
} from 'lucide-react';

/* ─── Types ─────────────────────────────────────────────────────────── */

export interface MenuItem {
  id: string;
  name: string;
  description: string;
  price: number;
  /** Price display string (e.g. "$6.50") */
  priceLabel: string;
  category: string;
  /** Optional badge shown in top-left of the image (e.g. "Signature") */
  badge?: string;
  /** High-res image URL for the product */
  imageSrc: string;
  /** Descriptive alt text for accessibility */
  imageAlt: string;
  /** Whether this item is featured / recommended */
  featured?: boolean;
}

export interface CartItem extends MenuItem {
  quantity: number;
}

export interface StitchMobileOrderNewProps {
  /** Menu items to display. Falls back to default AURA CAFE items. */
  items?: MenuItem[];
  /** Table identifier shown in the header */
  tableId?: string;
  /** Whether data is still loading */
  loading?: boolean;
  /** Error message if fetching fails */
  error?: string | null;
  /** Placeholder image URL when a product card lacks an image */
  fallbackImage?: string;
  /** Called when the back button is pressed */
  onBack?: () => void;
  /** Called when the search button / bar is activated */
  onSearch?: (query: string) => void;
  /** Called when "View Cart" is pressed */
  onViewCart?: (cart: CartItem[]) => void;
}

/* ─── Default Menu Data ─────────────────────────────────────────────── */

const DEFAULT_ITEMS: MenuItem[] = [
  {
    id: '1',
    name: 'Midnight Espresso',
    description: 'Double shot of reserve beans, notes of dark cocoa and star anise.',
    price: 6.5,
    priceLabel: '$6.50',
    category: 'coffee',
    badge: 'Signature',
    featured: true,
    imageSrc:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuCwdsFH89n5qOne2pC5RLJOugzRVNz_2K7TiYtIwSBFa_o2fTRtUdH0v3HZuxfIH4qSRynBF5k98BQek1PnbvU5bfnCA3RNz8TP9OgytrC9t9rR0N2uOFIa_yVN95yxowo_xspC10KiuymqoVK1VsU6RE4awCLAlWQqf5lN4etscE_1bWpMy6pKhg6wyxQe9u07flyVAWUvGx_LMd3ndty3GfG1XJZsqAJMrUFEq3erkUiT9v7YN9s_jMhKA_iuVfhd1739-cl_LHY',
    imageAlt:
      'Cinematic close-up of a Midnight Espresso in a minimalist glass cup against a dark industrial cafe background with subtle blue neon accents',
  },
  {
    id: '2',
    name: 'Chrome Velvet Latte',
    description: 'Silky texture with a hint of vanilla and silver-dusted topping.',
    price: 7.25,
    priceLabel: '$7.25',
    category: 'coffee',
    featured: true,
    imageSrc:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuDW4_mtBXw9yFcpHcU0qYN7ITB4vUmRIfuNsNaGMxab_GB2MLIMgw2NCiGyE2yio81jNy2hRNByMHlI-AqOdCPR1A93RA4EM5uZp_BYVw8SChv6NpvdTOG4xEYQwpwPGxNrDk8aY8wSIelzJLltcTSyCH7_XQwtud2XV03XmfWQwilm5jPN2_98oEb56nAhoxMfbz3c39hZxhqbpaRG3cueTQKmZFVDBQkunCL6AL68YpaoQb-IfivMl_NJrQZJvMSAZ7dhuhsUS0o',
    imageAlt:
      'Premium Chrome Velvet Latte with intricate latte art in a textured ceramic mug set against metallic silver and navy blue accents',
  },
  {
    id: '3',
    name: 'Smoky Amber Cold Brew',
    description: '18-hour cold steeped with smoked cedar infusion.',
    price: 8.0,
    priceLabel: '$8.00',
    category: 'cold-brew',
    badge: 'Signature',
    imageSrc:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuDCjEHWXhk-wZ78ADsOLT2qxDEb7cEFtonZe8IBVBaA8dSYj2XfRa55YmkQC_91xBwEn8TxfQ14l-u0PtB80LNcraAoxMjH-EmQfMrHe6z_uUXLH7Tu7LOF7Nj3vcNUzWNoz51aXJbwa2ZyvRDwRsyuh81QWET7tvv5nc-RHd9UsOgCCblDMLh5ASp0ZnPlhoQgPRDqvSiQje115mX2lH7LrjRkw-IRjybvD8aBzfdsv_s0ignn1QZ7rZYQoQH0PsxUuaex9BIAsmc',
    imageAlt:
      'Sophisticated presentation of a Smoky Amber Cold Brew in a tall crystal glass with large clear ice spheres against blurred high-end lounge background',
  },
  {
    id: '4',
    name: 'Jasmine Pearl Tea',
    description: 'Hand-rolled jasmine pearls steeped to perfection.',
    price: 5.5,
    priceLabel: '$5.50',
    category: 'tea',
    imageSrc:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuCzY8QDxMfEFkPH6YDIM7_6MfFMgYD_aDAs7VnSoMyaQys0_ekK1s1VCP0mmqRKxF9x_bqDqNGWYxE-0bHFJY5Whntq9jsqj6DP1y_ZM_mjHjOCf9qwXFn_0FlOBoGY1C3yAWn6V8nD9WrhIn8nIYj3GGtMoF9cCXCCF_qIGdMojz3qC6t5I-JhctPSy6v7MgVNZUQTQzUUKGYysV5ld9GQ3v8_vJCVu7tBfCcncCgW4zV4iGEZQjH3xhWlmpAF4wdcbWFCY5w',
    imageAlt:
      'Delicate jasmine pearl tea in a clear glass teapot with steam rising against a warm ambient background',
  },
  {
    id: '5',
    name: 'Golden Turmeric Latte',
    description: 'Plant-based golden milk with ginger, honey, and black pepper.',
    price: 6.75,
    priceLabel: '$6.75',
    category: 'signature',
    badge: 'Signature',
    featured: true,
    imageSrc:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuA_sYBGC9BpGTJP8c-2TfgTzvBqOznOcFP1iUFWIGyFnK6EVsRMr8Y3UfoDjBd6gWDWEl-JACrV6IG8V3-SlYN3XeC_j2zUehDo7D85mdG6YbjV4gX03tDzGnLByAt9iQjVQ2Mr5ceGVpKRE6pZGNyVssPBQzTpSaN9FT2uUNSwmqgQ8_8vnAp2fV3GDFQvNb6tS6XZgBdQBQLYVmDDKX7tW8GRHBBrv_BRHC9vd4DJFP7Qq3vA_ORw3CpjYyPjH-pIe6D0',
    imageAlt:
      'Vibrant golden turmeric latte in a ceramic cup with artistic foam pattern on a dark wooden surface',
  },
];

const CATEGORIES = [
  { key: 'all', label: 'All' },
  { key: 'coffee', label: 'Coffee' },
  { key: 'tea', label: 'Tea' },
  { key: 'signature', label: 'Signature' },
  { key: 'cold-brew', label: 'Cold Brew' },
] as const;

/* ─── Helpers ───────────────────────────────────────────────────────── */

function formatPrice(price: number): string {
  return `$${price.toFixed(2)}`;
}

/* ─── Product Card ──────────────────────────────────────────────────── */

function ProductCard({
  item,
  quantity,
  onAdd,
  onRemove,
}: Readonly<{
  item: MenuItem;
  quantity: number;
  onAdd: () => void;
  onRemove: () => void;
}>) {
  const { t } = useTranslation();
  const [imgError, setImgError] = useState(false);

  return (
    <article
      className="glass-panel rounded-xl overflow-hidden flex flex-col relative active:scale-[0.98] transition-transform"
      aria-label={t('stitch.ordering.productCardLabel', {
        name: item.name,
        price: item.priceLabel,
        defaultValue: `${item.name} — ${item.priceLabel}`,
      })}
    >
      {/* Image Section */}
      <div className="h-48 w-full relative">
        {imgError || !item.imageSrc ? (
          <div className="w-full h-full flex items-center justify-center bg-[rgba(198,198,199,0.05)]">
            <Coffee className="w-10 h-10 text-[rgba(198,198,199,0.2)]" />
          </div>
        ) : (
          <img
            className="w-full h-full object-cover"
            src={item.imageSrc}
            alt={item.imageAlt}
            onError={() => setImgError(true)}
            loading="lazy"
          />
        )}

        {/* Badge */}
        {item.badge && (
          <span
            className="absolute top-4 left-4 bg-[var(--aura-chrome-mid)] text-white px-3 py-1 rounded-sm font-body text-[11px] font-semibold tracking-wider uppercase shadow-xl"
            aria-label={t('stitch.ordering.badgeLabel', {
              badge: item.badge,
              defaultValue: `${item.badge}`,
            })}
          >
            {item.badge}
          </span>
        )}
      </div>

      {/* Content Section */}
      <div className="p-4 flex justify-between items-start">
        <div className="flex-1 pr-4">
          <div className="flex items-center gap-2">
            <h3 className="font-display text-[17px] text-[var(--aura-text-primary, #e8e8e8)] font-semibold leading-tight">
              {item.name}
            </h3>
            {item.featured && (
              <Star className="w-3.5 h-3.5 fill-[var(--aura-chrome-light)] text-[var(--aura-chrome-light)] flex-shrink-0" />
            )}
          </div>
          <p className="font-body text-[13px] text-[var(--aura-text-secondary, #a0a8b0)] mt-1.5 leading-relaxed line-clamp-2">
            {item.description}
          </p>
          <p className="font-body text-[20px] text-[var(--aura-primary, #c6c6c7)] font-bold mt-3 tracking-tight">
            {item.priceLabel}
          </p>
        </div>

        {/* Add / Quantity Controls */}
        <div className="flex-shrink-0">
          {quantity > 0 ? (
            <div className="flex items-center gap-2 bg-[rgba(198,198,199,0.1)] rounded-lg px-2 py-1">
              <button
                type="button"
                onClick={onRemove}
                className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-md text-[var(--aura-text-secondary, #a0a8b0)] hover:text-[var(--aura-primary, #c6c6c7)] hover:bg-[rgba(198,198,199,0.1)] transition-all active:scale-90"
                aria-label={t('stitch.ordering.removeItem', {
                  name: item.name,
                  defaultValue: `Remove one ${item.name}`,
                })}
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <span className="font-body text-[13px] text-[var(--aura-text-primary, #e8e8e8)] font-medium w-5 text-center">
                {quantity}
              </span>
              <button
                type="button"
                onClick={onAdd}
                className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-md text-[var(--aura-primary, #c6c6c7)] hover:bg-[rgba(198,198,199,0.15)] transition-all active:scale-90"
                aria-label={t('stitch.ordering.addItem', {
                  name: item.name,
                  defaultValue: `Add one ${item.name}`,
                })}
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={onAdd}
              className="w-10 h-10 rounded-full bg-[rgba(205,127,50,0.2)] flex items-center justify-center text-[var(--aura-chrome-mid)] shadow-lg shadow-[rgba(205,127,50,0.15)] active:scale-90 transition-transform"
              aria-label={t('stitch.ordering.addToCart', {
                name: item.name,
                defaultValue: `Add ${item.name} to cart`,
              })}
            >
              <Plus className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

/* ─── Main Component ────────────────────────────────────────────────── */

export function StitchMobileOrderNew({
  items = DEFAULT_ITEMS,
  tableId = 'B01',
  loading = false,
  error = null,
  onBack,
  onSearch,
  onViewCart,
}: Readonly<StitchMobileOrderNewProps>) {
  const { t } = useTranslation();
  const [activeCategory, setActiveCategory] = useState('all');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);

  /* ── Derived State ─────────────────────────────────────────────── */

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

    // Pulse feedback on the add button (handled via CSS transition)
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

  /* ── Render ────────────────────────────────────────────────────── */

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ backgroundColor: 'var(--aura-bg-page, #0A1A2E)', color: 'var(--aura-text-primary, #e8e8e8)' }}
      role="main"
      aria-label={t('stitch.ordering.pageLabel', {
        defaultValue: 'Mobile Ordering — AURA CAFE',
      })}
    >
      {/* ═══ Header ═══ */}
      <header
        className="fixed top-0 left-0 w-full z-50"
        style={{
          background: 'rgba(10, 26, 46, 0.6)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          borderBottom: '0.5px solid rgba(229, 228, 226, 0.15)',
        }}
      >
        <div className="flex items-center justify-between px-5 h-12">
          {/* Back Button */}
          <button
            type="button"
            onClick={onBack}
            className="active:scale-95 transition-transform text-[#ffb779]"
            aria-label={t('stitch.ordering.back', {
              defaultValue: 'Go back',
            })}
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          {/* Table Title */}
          <h1 className="font-display text-[18px] text-[var(--aura-text-primary, #e8e8e8)] font-medium">
            {t('stitch.ordering.tableTitle', {
              tableId,
              defaultValue: `Table ${tableId} — Dining in`,
            })}
          </h1>

          {/* Search Toggle */}
          <button
            type="button"
            onClick={handleToggleSearch}
            className={clsx(
              'active:scale-95 transition-transform',
              showSearch ? 'text-[var(--aura-text-primary, #e8e8e8)]' : 'text-[#ffb779]',
            )}
            aria-label={t('stitch.ordering.toggleSearch', {
              defaultValue: showSearch ? 'Close search' : 'Open search',
            })}
          >
            <Search className="w-5 h-5" />
          </button>
        </div>

        {/* Inline Search Bar (toggled) */}
        {showSearch && (
          <div className="px-5 pb-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--aura-text-secondary, #a0a8b0)]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder={t('stitch.ordering.searchPlaceholder', {
                  defaultValue: 'Search menu...',
                })}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl text-[13px] font-body bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.08)] text-[var(--aura-text-primary, #e8e8e8)] placeholder:text-[var(--aura-text-secondary, #a0a8b0)] focus:outline-none focus:border-[rgba(198,198,199,0.3)] focus:ring-1 focus:ring-[rgba(198,198,199,0.1)] transition-all"
                aria-label={t('stitch.ordering.searchInput', {
                  defaultValue: 'Search menu items',
                })}
                autoFocus
              />
            </div>
          </div>
        )}
      </header>

      {/* ═══ Main Content ═══ */}
      <main className="pt-16 pb-32 min-h-screen px-5 flex flex-col gap-8">
        {/* ── Loading State ── */}
        {loading && (
          <section
            className="flex flex-col items-center justify-center py-20 gap-4"
            aria-live="polite"
          >
            <div className="w-10 h-10 border-2 border-[var(--aura-primary, #c6c6c7)] border-t-transparent rounded-full animate-spin" />
            <p className="font-body text-[14px] text-[var(--aura-text-secondary, #a0a8b0)]">
              {t('stitch.ordering.loading', {
                defaultValue: 'Loading menu...',
              })}
            </p>
          </section>
        )}

        {/* ── Error State ── */}
        {!loading && error && (
          <section
            className="flex flex-col items-center justify-center py-20 gap-4"
            aria-live="assertive"
          >
            <Coffee className="w-10 h-10 text-[rgba(198,198,199,0.2)]" />
            <p className="font-body text-[14px] text-[#ffb4ab]">
              {t('stitch.ordering.error', {
                defaultValue: error,
              })}
            </p>
          </section>
        )}

        {/* ── Ready State ── */}
        {!loading && !error && (
          <>
            {/* Category Horizontal Scroll */}
            <section
              className="flex overflow-x-auto gap-3 -mx-5 px-5 no-scrollbar items-center"
              aria-label={t('stitch.ordering.categoriesLabel', {
                defaultValue: 'Menu categories',
              })}
            >
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.key}
                  type="button"
                  onClick={() => setActiveCategory(cat.key)}
                  className={clsx(
                    'px-6 py-2 rounded-full whitespace-nowrap font-body text-[11px] font-semibold tracking-wider uppercase active:scale-95 transition-all',
                    activeCategory === cat.key
                      ? 'bg-[rgba(205,127,50,0.25)] text-[var(--aura-chrome-mid)]'
                      : 'text-[var(--aura-text-secondary, #a0a8b0)] hover:text-[var(--aura-primary, #c6c6c7)]',
                  )}
                  style={
                    activeCategory !== cat.key
                      ? {
                          background: 'rgba(22, 42, 68, 0.4)',
                          backdropFilter: 'blur(24px)',
                          WebkitBackdropFilter: 'blur(24px)',
                          border: '0.5px solid rgba(229, 228, 226, 0.15)',
                        }
                      : undefined
                  }
                  aria-label={t('stitch.ordering.categoryFilter', {
                    category: cat.label,
                    defaultValue: `Filter by ${cat.label}`,
                  })}
                  aria-pressed={activeCategory === cat.key}
                >
                  {cat.label}
                </button>
              ))}
            </section>

            {/* Menu Section */}
            <section
              className="flex flex-col gap-4"
              aria-label={t('stitch.ordering.menuSection', {
                defaultValue: 'Menu items',
              })}
            >
              <h2 className="font-display text-[22px] text-[#ffb779] font-medium mb-1">
                {t('stitch.ordering.curationsTitle', {
                  defaultValue: 'Our Curations',
                })}
              </h2>

              {/* ── Empty State ── */}
              {filteredItems.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <Coffee className="w-12 h-12 text-[rgba(198,198,199,0.15)]" />
                  <p className="font-body text-[14px] text-[var(--aura-text-secondary, #a0a8b0)]">
                    {t('stitch.ordering.noItems', {
                      defaultValue: 'No items found',
                    })}
                  </p>
                </div>
              )}

              {/* Product Cards */}
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

      {/* ═══ Floating Cart Bar ═══ */}
      {totalItems > 0 && (
        <footer
          className="fixed bottom-0 left-0 w-full z-50 px-4 pb-6"
          aria-label={t('stitch.ordering.cartBar', {
            defaultValue: 'Cart summary',
          })}
        >
          <div
            className="rounded-2xl p-4 flex items-center justify-between"
            style={{
              background: 'rgba(11, 32, 58, 0.92)',
              backdropFilter: 'blur(24px)',
              WebkitBackdropFilter: 'blur(24px)',
              borderTop: '1px solid rgba(229, 228, 226, 0.25)',
              boxShadow: '0 -4px 30px rgba(0, 0, 0, 0.4)',
            }}
          >
            {/* Cart Details */}
            <div className="flex items-center gap-3">
              <div className="relative">
                <ShoppingCart className="w-5 h-5 text-[var(--aura-primary, #c6c6c7)]" />
                <span className="absolute -top-2 -right-2 w-4 h-4 rounded-full bg-[var(--aura-chrome-mid)] text-[10px] font-bold text-white flex items-center justify-center font-body">
                  {totalItems}
                </span>
              </div>
              <div className="flex flex-col">
                <span className="font-body text-[11px] text-[var(--aura-text-secondary, #a0a8b0)]">
                  {t('stitch.ordering.total', { defaultValue: 'Total' })}
                </span>
                <span className="font-body text-[20px] text-[var(--aura-text-primary, #e8e8e8)] font-bold tracking-tight">
                  {formatPrice(totalPrice)}
                </span>
              </div>
            </div>

            {/* View Cart Button */}
            <button
              type="button"
              onClick={() => onViewCart?.(cart)}
              className="bg-[var(--aura-chrome-mid)] text-white px-8 py-3 rounded-full font-body text-[12px] font-semibold tracking-wider uppercase active:scale-95 transition-transform shadow-lg flex items-center gap-2"
              aria-label={t('stitch.ordering.viewCart', {
                count: totalItems,
                defaultValue: `View cart with ${totalItems} items`,
              })}
            >
              {t('stitch.ordering.viewCartButton', {
                defaultValue: 'View Cart',
              })}
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </footer>
      )}

      {/* ═══ Global Glassmorphism Styles ═══ */}
      <style>{`
        .glass-panel {
          background: rgba(22, 42, 68, 0.4);
          backdrop-filter: blur(24px);
          -webkit-backdrop-filter: blur(24px);
          border: 0.5px solid rgba(229, 228, 226, 0.15);
          border-radius: 16px;
          transition: all 0.2s ease;
        }
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  );
}

export default StitchMobileOrderNew;
