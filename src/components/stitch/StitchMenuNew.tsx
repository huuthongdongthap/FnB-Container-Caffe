'use client';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, ShoppingBag, Check, X } from 'lucide-react';

/* ── Type Definitions ─────────────────────────────────────────────── */

export interface MenuItemData {
  id: string;
  name: string;
  description: string;
  price: string;
  imageSrc: string;
  imageAlt: string;
  category: string;
  badge?: string;
}

export interface StitchMenuNewProps {
  /** Menu items to display */
  items?: MenuItemData[];
  /** Brand name shown in the navigation */
  brandName?: string;
  /** Callback when Add to Cart is clicked */
  onAddToCart?: (item: MenuItemData) => void;
  /** Callback when the cart FAB is clicked */
  onCartClick?: () => void;
  /** Number of items currently in the cart */
  cartItemCount?: number;
}

/* ── Default Menu Items ────────────────────────────────────────────── */

const DEFAULT_ITEMS: MenuItemData[] = [
  {
    id: '1',
    name: 'Midnight Espresso',
    description: 'Triple-shot ristretto using our obsidian blend, served in a pre-chilled chrome-rimmed glass.',
    price: '$6.50',
    imageSrc: 'https://lh3.googleusercontent.com/aida-public/AB6AXuC_QGdUYMDZ4bshFGGOuDClk1QO2FbSuIAAyiGKyZPvZ2j0P1k9fTsCP1QEePIsP_4_AGSSF0noB-pMgP31tTLK5lONgX7aYWGJD8JHQRi7wtaYWcSgyQSl333QcLPg-K-_ye57vjIvaBaGy3r9C31P5tt4-zKdNIxY7kYFSyJORgVUkCrX9l5qM9cKYf5Uv_pTIYJk1wXo8eDgJDk4EOLpqOpH1Dbx6TLvj2ApS5j240P5kDgcabws484acm24ikkEa3VpDiPAWNo',
    imageAlt: 'Macro photograph of a rich dark espresso shot being pulled into a minimalist glass cup with steam rising against a dark navy industrial background',
    category: 'coffee',
    badge: 'FEATURED',
  },
  {
    id: '2',
    name: 'Chrome Velvet Latte',
    description: 'Infused with active charcoal and Madagascar vanilla, finished with a precise velvet microfoam.',
    price: '$8.00',
    imageSrc: 'https://lh3.googleusercontent.com/aida-public/AB6AXuALjkXkK9PvJmhMhQQTpMT1PBUly68XCUmWFe_68ragLLJXSWI7XZbcQp8eoISOj960gbBxXSt1yqhQxTzuqe2z0D2pubqGrxJjapmjy3mZ3T3_vmb3iQKQTOzTKdjEnrzf-KyX9x5XayazvprUnxJ5m8O6GEmWyavZbUaAArbsW5BWwwB-aDj8WaGUVw_KnDCCC_XcbG9VQmn-BCta9TJjY_cqOowGMSZ2b3RPcESMsVgf5--vUhqQkf8t577BnVN-lux8ZPR-4bA',
    imageAlt: 'Silky latte featuring intricate charcoal-colored latte art in a brushed metallic chrome vessel on a dark stone coaster',
    category: 'coffee',
  },
  {
    id: '3',
    name: 'Industrial Cold Brew',
    description: '24-hour slow drip extraction through stainless steel filtration. Intense, clean, and energizing.',
    price: '$7.25',
    imageSrc: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCyrdmvvc0Z7n8qHuPaerW9_V-RLpkxo1asQBGo2lrzTR1AS1R3Nd_dZ1ZvwjJUxJjDRylrXOYEaMdOXgob8NpAlbulht0fxsLpykQMsimhIENB44M9IFx0OFp16N71Y6yRKi-wvLZCTKDxTXbGPxQrd5snG3IDeFxQFB43Y22vH7t84u9wnLUKSpqmDh0qFMNKe0X-DpOb2iSG0-WLB54k1EPBRzHsn6g7PzaOkohUdHN48UY8VtKTFJAUVtztLNyG8JfSg8OyLf0',
    imageAlt: 'Clear apothecary glass bottle filled with dark cold brew coffee with condensation droplets beside a glass with a single large clear ice sphere',
    category: 'cold-brew',
    badge: 'VEGETARIAN',
  },
  {
    id: '4',
    name: 'Bronze Chai',
    description: 'Hand-ground spices bloomed in local honey, paired with a selection of premium black teas.',
    price: '$6.75',
    imageSrc: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAfTnFSl0lRavfOjng3uA94TL3rKuQXqtLXgpSV9hgW6GloyXk22c6QL7HDuzZPECrexBDwlvOnZkfXv9-liX4zHLiaYnReBurMC6l6fTUmn5OzJ8odnX79mVvqupVKqN8qiiCGu2zBNG8PNRZF7439vMXyajna9CJR877470iChAjL2TLrvnaJC7Yo4yTVel8VPTj-DnlILPeLDzT-7N_oK5s6vUMyTQsGP5Comu1Pc7KzVviaMdseBfMI95_LrOdF8fJ-xBYTIRw',
    imageAlt: 'Warm bronze-colored spiced chai latte topped with cinnamon and star anise in a matte black ceramic cup with metallic bronze interior rim',
    category: 'tea',
  },
  {
    id: '5',
    name: 'Ceremonial Matcha',
    description: 'Stone-ground ceremonial grade tea from Uji, whisked to perfection with oat milk.',
    price: '$7.50',
    imageSrc: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCo3Ezdo07YoM0sKYg-Yfrh6ntsqGTJvDLWfbmgtAz4sX8D5CtD_Op74E1PhfSk_5DwhqocqR_68cEfC51f-QGhGvMXOPZybvsZvY5uQweisHu9TIWxKBV4wfCKfngQXvjxVfQvXRncZ8e91L7oZM2Yy_WrieJo3XbNclhpy5PQJQk5tlV7Jkv4O2mygsSYTcWdXw14c2tZq5Jrg1mzOHrOC96aHLaGfvYj6uZIzzfUl4MJIUTZJcy_Cjrb3ZJ_KlGUBnaEOKinryM',
    imageAlt: 'Minimalist presentation of a vibrant green matcha latte in a shallow glass bowl with dark granite textures and chrome accents',
    category: 'signature',
  },
  {
    id: '6',
    name: 'Nitro Tonic',
    description: 'Nitro-infused espresso charged with premium tonic and a hint of botanical citrus.',
    price: '$9.00',
    imageSrc: 'https://lh3.googleusercontent.com/aida-public/AB6AXuB2hGTvBgNF-yso83PziL85EL-6LOc8S5kmoITQUZfQgJeF0a7VRpJnAwUJTV4kRh5eeHJHdlODJf9XkuqFCmG-emNjmamLKDCu5xgDH0G-OFqv3DJ8FnUj_Dp0Y6sGhEUR_9Ys9h8C_pmNiyeagQuk9I5bZO84yQpFi1rPUBTg-2dIxsxLz8lKKIZY6ezzgeX4nQZb55L22oh8wmuw9HSTjX2c4GwGHqzQlyBKc8ZHN5A9ZmjTfp-nz3JHOUGDshJovxWLGzzQJv4',
    imageAlt: 'Artisanal sparkling cold coffee drink served in a crystal flute with a twist of orange peel and visible carbonation bubbles',
    category: 'cold-brew',
  },
];

const CATEGORIES = [
  { key: 'all', label: 'All' },
  { key: 'coffee', label: 'Coffee' },
  { key: 'tea', label: 'Tea' },
  { key: 'cold-brew', label: 'Cold Brew' },
  { key: 'signature', label: 'Signature' },
] as const;

/* ── Scoped CSS for glass-panel gradient border — mirrors the original Stitch HTML ── */
const GLASS_PANEL_STYLE_ID = '__aura_glass_panel_styles';

/* ── Component ─────────────────────────────────────────────────────── */

export function StitchMenuNew({
  items = DEFAULT_ITEMS,
  brandName = 'AURA CAFE',
  onAddToCart,
  onCartClick,
  cartItemCount = 0,
}: Readonly<StitchMenuNewProps>) {
  const { t } = useTranslation();
  const [activeCategory, setActiveCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [addedItems, setAddedItems] = useState<Set<string>>(new Set());

  const filteredItems = items.filter((item) => {
    const matchesCategory = activeCategory === 'all' || item.category === activeCategory;
    const matchesSearch =
      searchQuery === '' ||
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const handleAddToCart = (item: MenuItemData) => {
    onAddToCart?.(item);
    setAddedItems((prev) => {
      const next = new Set(prev);
      next.add(item.id);
      return next;
    });
    setTimeout(() => {
      setAddedItems((prev) => {
        const next = new Set(prev);
        next.delete(item.id);
        return next;
      });
    }, 2000);
  };

  const hasNoResults = searchQuery !== '' && filteredItems.length === 0;
  const hasNoItemsInCategory = activeCategory !== 'all' && searchQuery === '' && filteredItems.length === 0;

  return (
    <div
      className="relative min-h-screen bg-[var(--aura-surface-dim)] text-[var(--aura-chrome-bright)] overflow-x-hidden"
      aria-label={t('stitch.menu')}
    >
      <style id={GLASS_PANEL_STYLE_ID}>{`
        /* Glass panel gradient border — matches original Stitch HTML exactly */
        .aura-glass {
          background: rgba(11, 32, 58, 0.6);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border: 1px solid transparent;
          background-clip: padding-box;
          position: relative;
        }
        .aura-glass::after {
          content: "";
          position: absolute;
          inset: 0;
          border-radius: inherit;
          padding: 1px;
          background: linear-gradient(135deg, #C6C6C7 0%, #4A4A4A 100%);
          -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
          mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
          -webkit-mask-composite: xor;
          mask-composite: exclude;
          pointer-events: none;
        }
        .chrome-btn {
          background: linear-gradient(135deg, #C6C6C7 0%, var(--aura-chrome-dim) 100%);
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .chrome-btn:hover {
          filter: brightness(1.1);
          transform: translateY(-1px);
        }
        .bronze-glow {
          box-shadow: inset 0 0 10px rgba(239, 189, 138, 0.2);
        }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>

      {/* ── Top Navigation Bar ── */}
      <header
        className="fixed top-0 z-50 w-full border-b border-[var(--aura-chrome-dim)]/30 bg-[var(--aura-surface-dim)]/60 backdrop-blur-md shadow-sm"
        aria-label={t('stitch.header')}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-2">
          {/* Brand — matches HTML: font-headline-lg text-headline-lg font-semibold text-primary tracking-tight */}
          <div
            className="text-[32px] leading-[1.2] font-semibold tracking-tight text-[var(--aura-noir-void)]"
            style={{ fontFamily: '"EB Garamond", Georgia, serif' }}
          >
            {t('stitch.brandName', { defaultValue: brandName })}
          </div>

          {/* Desktop Nav — matches HTML exactly: no explicit font-family on nav links */}
          <nav className="hidden items-center gap-4 md:flex" aria-label={t('stitch.nav')}>
            <a
              href="#"
              className="font-medium text-[var(--aura-chrome-soft)] transition-colors duration-300 hover:text-[var(--aura-chrome-bright)]"
            >
              {t('stitch.navHome', { defaultValue: 'Home' })}
            </a>
            <a
              href="#"
              className="border-b-2 border-[var(--aura-chrome-bright)] pb-1 font-medium text-[var(--aura-chrome-bright)] transition-colors duration-300"
            >
              {t('stitch.navMenu', { defaultValue: 'Menu' })}
            </a>
            <a
              href="#"
              className="font-medium text-[var(--aura-chrome-soft)] transition-colors duration-300 hover:text-[var(--aura-chrome-bright)]"
            >
              {t('stitch.navLocation', { defaultValue: 'Location' })}
            </a>
          </nav>

          {/* Reservation CTA — matches HTML: bg-tertiary text-on-tertiary rounded-full font-label-caps text-label-caps */}
          <button
            className="rounded-full bg-[var(--aura-chrome-bright)] px-6 py-2 text-xs font-semibold tracking-[0.1em] text-[var(--aura-noir-deep)] transition-all active:scale-95 hover:opacity-90"
            style={{ fontFamily: '"Space Grotesk", system-ui, sans-serif' }}
          >
            {t('stitch.reservation', { defaultValue: 'Reservation' })}
          </button>
        </div>
      </header>

      {/* ── Main Content ── */}
      <main className="min-h-screen pt-24 pb-8">
        <div className="mx-auto max-w-7xl px-6">
          {/* Hero Header Section — matches HTML: mb-stack-lg flex flex-col md:flex-row md:items-end justify-between gap-stack-md */}
          <div className="mb-8 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <h1
                className="text-[48px] leading-[1.1] font-semibold tracking-[-0.02em] text-[var(--aura-chrome-bright)] mb-2"
                style={{ fontFamily: '"EB Garamond", Georgia, serif' }}
              >
                {t('stitch.theDigitalReserve', { defaultValue: 'The Digital Reserve' })}
              </h1>
              <p className="max-w-lg text-base leading-[1.6] text-[var(--aura-chrome-soft)]" style={{ fontFamily: '"Space Grotesk", system-ui, sans-serif' }}>
                {t('stitch.menuDescription', { defaultValue: 'Industrial precision meets high-end hospitality. Explore our curated selection of signature roasts and artisanal blends.' })}
              </p>
            </div>

            {/* Search Bar — matches HTML exactly */}
            <div className="relative w-full md:w-80 group" role="search">
              <Search
                className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[var(--aura-chrome-dim)] transition-colors group-focus-within:text-[#c6c6c7]"
                aria-hidden="true"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('stitch.searchPlaceholder', { defaultValue: 'Search our craft...' })}
                aria-label={t('stitch.searchAriaLabel')}
                className="w-full rounded-full border border-[var(--aura-chrome-dim)]/50 bg-[#061c35] py-3 pl-12 pr-12 text-base text-[#c6c6c7] placeholder-[var(--aura-chrome-dim)] transition-all focus:border-[#c6c6c7] focus:outline-none"
                style={{ fontFamily: '"Space Grotesk", system-ui, sans-serif' }}
              />
              {searchQuery !== '' && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--aura-chrome-dim)] transition-colors hover:text-[#c6c6c7]"
                  aria-label={t('stitch.clearSearchAriaLabel')}
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              )}
            </div>
          </div>

          {/* ── Category Filter Chips — matches HTML: font-label-caps text-label-caps (NOT uppercase) ── */}
          <div
            className="mb-8 flex gap-3 overflow-x-auto pb-4 no-scrollbar"
            role="tablist"
            aria-label={t('stitch.filterAriaLabel')}
          >
            {CATEGORIES.map((cat) => {
              const isActive = activeCategory === cat.key;
              return (
                <button
                  key={cat.key}
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => setActiveCategory(cat.key)}
                  className={`flex-shrink-0 rounded-full border px-6 py-2 text-xs font-semibold tracking-[0.1em] transition-all aura-glass ${
                    isActive
                      ? 'border-[var(--aura-chrome-bright)] text-[var(--aura-chrome-bright)] bronze-glow'
                      : 'border-[var(--aura-chrome-dim)]/30 text-[var(--aura-chrome-soft)] hover:border-[#c6c6c7] hover:text-[#c6c6c7]'
                  }`}
                  style={{ fontFamily: '"Space Grotesk", system-ui, sans-serif' }}
                >
                  {cat.label}
                </button>
              );
            })}
          </div>

          {/* ── Menu Grid ── */}
          {hasNoResults && (
            <div className="py-20 text-center" role="status">
              <p className="text-base text-[var(--aura-chrome-soft)]">
                {t('menu.notFoundDesc')}
              </p>
            </div>
          )}

          {hasNoItemsInCategory && (
            <div className="py-20 text-center" role="status">
              <p className="text-base text-[var(--aura-chrome-soft)]">
                {t('stitch.noItemsInCategory')}
              </p>
            </div>
          )}

          {!hasNoResults && !hasNoItemsInCategory && (
            <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filteredItems.map((item, index) => {
                const isAdded = addedItems.has(item.id);
                /* Items 5 and 6 in the default set have opacity-90 in the original HTML */
                const isDefaultItem5or6 = index >= 4 && items === DEFAULT_ITEMS;
                return (
                  <article
                    key={item.id}
                    className={`group flex h-full flex-col overflow-hidden rounded-xl aura-glass ${isDefaultItem5or6 ? 'opacity-90' : ''}`}
                    aria-label={item.name}
                  >
                    {/* Image */}
                    <div className="relative h-64 overflow-hidden">
                      <img
                        src={item.imageSrc}
                        alt={item.imageAlt}
                        className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                        loading="lazy"
                      />

                      {/* Badge — matches HTML: bg-tertiary text-on-tertiary rounded-sm font-label-caps text-[10px] */}
                      {item.badge && (
                        <div
                          className="absolute left-4 top-4 rounded-sm bg-[var(--aura-chrome-bright)] px-3 py-1 text-[10px] font-semibold tracking-[0.1em] text-[var(--aura-noir-deep)]"
                          style={{ fontFamily: '"Space Grotesk", system-ui, sans-serif' }}
                        >
                          {item.badge}
                        </div>
                      )}

                      {/* Price — matches HTML: font-price text-price text-tertiary bg-surface/80 backdrop-blur-md rounded-sm */}
                      <div
                        className="absolute right-4 top-4 rounded-sm bg-[var(--aura-surface-dim)]/80 px-2 py-1 text-lg font-medium text-[var(--aura-chrome-bright)] backdrop-blur-md"
                        style={{ fontFamily: '"Space Grotesk", system-ui, sans-serif' }}
                      >
                        {item.price}
                      </div>
                    </div>

                    {/* Content — matches HTML: p-6 flex flex-col flex-grow */}
                    <div className="flex grow flex-col p-6">
                      <h3
                        className="mb-2 text-[22px] leading-[1.4] font-medium tracking-[0.01em] text-[var(--aura-chrome-bright)]"
                        style={{ fontFamily: '"EB Garamond", Georgia, serif' }}
                      >
                        {item.name}
                      </h3>
                      <p
                        className="mb-6 grow text-base leading-[1.6] text-[var(--aura-chrome-soft)]/70 font-light"
                        style={{ fontFamily: '"Space Grotesk", system-ui, sans-serif' }}
                      >
                        {item.description}
                      </p>

                      {/* Add to Cart — matches HTML: chrome-gradient-btn uppercase text-label-caps */}
                      <button
                        onClick={() => handleAddToCart(item)}
                        disabled={isAdded}
                        aria-label={t('stitch.addToCartAria', { name: item.name })}
                        className={`flex w-full items-center justify-center gap-2 rounded-sm py-3 text-xs font-semibold uppercase tracking-[0.1em] transition-all duration-300 ${
                          isAdded
                            ? 'cursor-default bg-[var(--aura-chrome-bright)] text-[var(--aura-noir-deep)]'
                            : 'chrome-btn text-[#2f3132]'
                        }`}
                      >
                        {isAdded ? (
                          <>
                            <Check className="h-3.5 w-3.5" aria-hidden="true" />
                            {t('stitch.added', { defaultValue: 'Added' })}
                          </>
                        ) : (
                          t('stitch.addToCart', { defaultValue: 'Add to Cart' })
                        )}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* ── Footer — matches HTML: bg-surface-container-lowest border-t border-outline-variant w-full py-stack-lg ── */}
      <footer
        className="w-full border-t border-[var(--aura-chrome-dim)] bg-[var(--aura-bg-page)] py-8"
        aria-label={t('footer.connect')}
      >
        <div className="mx-auto flex max-w-7xl flex-col items-center gap-4 px-6 md:flex-row md:justify-between">
          {/* Footer Brand — matches HTML: font-headline-lg text-headline-lg text-primary (no font-semibold, no tracking-tight) */}
          <div
            className="text-[32px] leading-[1.2] text-[var(--aura-noir-void)]"
            style={{ fontFamily: '"EB Garamond", Georgia, serif' }}
          >
            {t('stitch.brandName', { defaultValue: brandName })}
          </div>
          <p className="text-base leading-[1.6] text-[var(--aura-chrome-soft)] text-center md:text-left" style={{ fontFamily: '"Space Grotesk", system-ui, sans-serif' }}>
            &copy; 2024 {brandName}.{' '}
            {t('stitch.footerTagline', { defaultValue: 'Industrial Luxury Dining.' })}
          </p>
          {/* Footer Nav — matches HTML: font-label-caps text-label-caps (NOT uppercase) */}
          <nav className="flex gap-4" aria-label={t('footer.connect')}>
            <a
              href="#"
              className="text-xs font-semibold tracking-[0.1em] text-[var(--aura-chrome-soft)] transition-colors hover:text-[var(--aura-noir-void)]"
              style={{ fontFamily: '"Space Grotesk", system-ui, sans-serif' }}
            >
              {t('stitch.footerContact', { defaultValue: 'Contact' })}
            </a>
            <a
              href="#"
              className="text-xs font-semibold tracking-[0.1em] text-[var(--aura-chrome-soft)] transition-colors hover:text-[var(--aura-noir-void)]"
              style={{ fontFamily: '"Space Grotesk", system-ui, sans-serif' }}
            >
              {t('stitch.footerPrivacy', { defaultValue: 'Privacy Policy' })}
            </a>
            <a
              href="#"
              className="text-xs font-semibold tracking-[0.1em] text-[var(--aura-chrome-soft)] transition-colors hover:text-[var(--aura-noir-void)]"
              style={{ fontFamily: '"Space Grotesk", system-ui, sans-serif' }}
            >
              {t('stitch.footerTerms', { defaultValue: 'Terms of Service' })}
            </a>
          </nav>
        </div>
      </footer>

      {/* ── Cart FAB ── */}
      <div className="fixed bottom-8 right-8 z-40">
        <button
          onClick={onCartClick}
          className="relative flex h-16 w-16 items-center justify-center rounded-full bg-[var(--aura-chrome-bright)] text-[var(--aura-noir-deep)] shadow-xl transition-all duration-300 active:scale-95 hover:shadow-2xl hover:shadow-[var(--aura-chrome-bright)]/20"
          aria-label={t('stitch.cartAriaLabel')}
        >
          <ShoppingBag className="h-6 w-6" aria-hidden="true" />
          {cartItemCount > 0 && (
            <span
              className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-white text-[10px] font-bold text-[var(--aura-surface-dim)]"
              aria-live="polite"
              aria-atomic="true"
            >
              {cartItemCount}
            </span>
          )}
        </button>
      </div>
    </div>
  );
}

export default StitchMenuNew;
