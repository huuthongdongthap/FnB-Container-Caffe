'use client';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, ShoppingBag, X } from 'lucide-react';

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
      className="relative min-h-screen bg-[#00142c] text-[#d4e3ff] overflow-x-hidden"
      aria-label={t('stitch.menu')}
    >
      {/* ── Top Navigation Bar ── */}
      <header
        className="fixed top-0 z-50 w-full border-b border-[#44474d]/30 bg-[#00142c]/60 backdrop-blur-md shadow-sm"
        aria-label={t('nav.openMenu')}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3 md:px-8">
          {/* Brand */}
          <div className="font-['EB_Garamond',serif] text-2xl font-semibold tracking-tight text-[#b8c7e2] md:text-[32px]">
            {t('hero.title')}
          </div>

          {/* Desktop Nav */}
          <nav className="hidden items-center gap-6 md:flex" aria-label={t('stitch.filterAriaLabel')}>
            <a
              href="#"
              className="font-['Space_Grotesk',sans-serif] text-base font-medium text-[#c5c6cd] transition-colors hover:text-[#efbd8a]"
              aria-label={t('nav.menu')}
            >
              {t('nav.menu')}
            </a>
            <a
              href="#"
              className="border-b-2 border-[#efbd8a] pb-1 font-['Space_Grotesk',sans-serif] text-base font-medium text-[#efbd8a]"
              aria-label={t('menu.featured')}
            >
              {t('menu.featured')}
            </a>
            <a
              href="#"
              className="font-['Space_Grotesk',sans-serif] text-base font-medium text-[#c5c6cd] transition-colors hover:text-[#efbd8a]"
              aria-label={t('nav.reservations')}
            >
              {t('nav.reservations')}
            </a>
          </nav>

          {/* Reservation CTA */}
          <button
            className="rounded-full bg-[#efbd8a] px-5 py-2 font-['Space_Grotesk',sans-serif] text-xs font-semibold uppercase tracking-[0.1em] text-[#1e314b] transition-all duration-300 active:scale-95 hover:opacity-90"
            aria-label={t('stitch.reservation')}
          >
            {t('stitch.reservation')}
          </button>
        </div>
      </header>

      {/* ── Main Content ── */}
      <main className="min-h-screen pt-24 pb-12">
        <div className="mx-auto max-w-7xl px-6 md:px-8">
          {/* Hero Header */}
          <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <h1 className="font-['EB_Garamond',serif] text-[clamp(2.5rem,6vw,3rem)] font-medium leading-tight text-[#d4e3ff]">
                {t('stitch.specialtyDrinks')}
              </h1>
              <p className="mt-2 max-w-lg font-['Space_Grotesk',sans-serif] text-base leading-relaxed text-[#c5c6cd]/70">
                {t('stitch.menuDescription')}
              </p>
            </div>

            {/* Search Bar */}
            <div className="relative w-full md:w-80" role="search" aria-label={t('stitch.searchAriaLabel')}>
              <Search
                className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#8e9097]"
                aria-hidden="true"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('stitch.searchPlaceholder')}
                aria-label={t('stitch.searchAriaLabel')}
                className="w-full rounded-full border border-[#44474d]/50 bg-[#061c35] py-3 pl-12 pr-12 font-['Space_Grotesk',sans-serif] text-base text-[#c6c6c7] placeholder-[#8e9097] transition-all focus:border-[#c6c6c7] focus:outline-none"
              />
              {searchQuery !== '' && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8e9097] transition-colors hover:text-[#c6c6c7]"
                  aria-label={t('stitch.clearSearchAriaLabel')}
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              )}
            </div>
          </div>

          {/* ── Category Filter Chips ── */}
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
                  className={`flex-shrink-0 rounded-full border px-6 py-2 font-['Space_Grotesk',sans-serif] text-xs font-semibold uppercase tracking-[0.1em] transition-all duration-300 ${
                    isActive
                      ? 'border-[#efbd8a] bg-[rgba(11,32,58,0.6)] text-[#efbd8a] shadow-[inset_0_0_10px_rgba(239,189,138,0.2)] backdrop-blur-md'
                      : 'border-[#44474d]/30 bg-[rgba(11,32,58,0.4)] text-[#c5c6cd] backdrop-blur-sm hover:border-[#c6c6c7] hover:text-[#c6c6c7]'
                  }`}
                >
                  {cat.label}
                </button>
              );
            })}
          </div>

          {/* ── Menu Grid ── */}
          {hasNoResults && (
            <div className="py-20 text-center" role="status">
              <p className="font-['Space_Grotesk',sans-serif] text-lg text-[#c5c6cd]">
                {t('menu.notFoundDesc')}
              </p>
            </div>
          )}

          {hasNoItemsInCategory && (
            <div className="py-20 text-center" role="status">
              <p className="font-['Space_Grotesk',sans-serif] text-lg text-[#c5c6cd]">
                {t('stitch.noItemsInCategory')}
              </p>
            </div>
          )}

          {!hasNoResults && !hasNoItemsInCategory && (
            <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filteredItems.map((item) => {
                const isAdded = addedItems.has(item.id);
                return (
                  <article
                    key={item.id}
                    className="group relative flex h-full flex-col overflow-hidden rounded-xl border border-[#44474d]/20 bg-[rgba(11,32,58,0.6)] backdrop-blur-[12px] transition-all duration-500 hover:-translate-y-1 hover:border-[#c6c6c7]/30 hover:shadow-[0_0_20px_rgba(198,198,199,0.08)]"
                    aria-label={item.name}
                  >

                    {/* Image */}
                    <div className="relative h-56 overflow-hidden md:h-64">
                      <img
                        src={item.imageSrc}
                        alt={item.imageAlt}
                        className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                        loading="lazy"
                      />

                      {/* Badge */}
                      {item.badge && (
                        <div className="absolute left-3 top-3 rounded-sm bg-[#efbd8a] px-3 py-1 font-['Space_Grotesk',sans-serif] text-[10px] font-semibold uppercase tracking-[0.1em] text-[#1e314b]">
                          {t('menu.featured')}
                        </div>
                      )}

                      {/* Price */}
                      <div className="absolute right-3 top-3 rounded-sm bg-[#00142c]/80 px-2 py-1 font-['Space_Grotesk',sans-serif] text-lg font-medium text-[#efbd8a] backdrop-blur-md">
                        {item.price}
                      </div>
                    </div>

                    {/* Content */}
                    <div className="flex flex-1 flex-col p-6">
                      <h3 className="mb-2 font-['EB_Garamond',serif] text-[22px] leading-[1.4] font-medium tracking-[0.01em] text-[#d4e3ff]">
                        {item.name}
                      </h3>
                      <p className="mb-6 flex-1 font-['Space_Grotesk',sans-serif] text-base leading-[1.6] text-[#c5c6cd] opacity-70">
                        {item.description}
                      </p>

                      {/* Add to Cart */}
                      <button
                        onClick={() => handleAddToCart(item)}
                        disabled={isAdded}
                        aria-label={t('stitch.addToCartAria', { name: item.name })}
                        className={`flex w-full items-center justify-center gap-2 rounded-sm py-3 font-['Space_Grotesk',sans-serif] text-xs font-semibold uppercase tracking-[0.1em] transition-all duration-300 ${
                          isAdded
                            ? 'cursor-default bg-[#efbd8a] text-[#1e314b]'
                            : 'bg-gradient-to-r from-[#C6C6C7] to-[#8E9097] text-[#1e314b] hover:brightness-110 active:translate-y-[-1px]'
                        }`}
                      >
                        {isAdded ? (
                          <>
                            <span className="material-symbols-outlined text-sm" aria-hidden="true">check</span>
                            {t('stitch.added')}
                          </>
                        ) : (
                          t('stitch.addToCart')
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

      {/* ── Footer ── */}
      <footer
        className="w-full border-t border-[#44474d]/30 bg-[#000e23] py-8"
        aria-label={t('footer.connect')}
      >
        <div className="mx-auto flex max-w-7xl flex-col items-center gap-4 px-6 md:flex-row md:justify-between md:px-8">
          <div className="font-['EB_Garamond',serif] text-2xl font-semibold tracking-tight text-[#b8c7e2]">
            {brandName}
          </div>
          <p className="font-['Space_Grotesk',sans-serif] text-sm text-[#c5c6cd] text-center md:text-left">
            &copy; {new Date().getFullYear()} {brandName}. {t('stitch.allRightsReserved')}
          </p>
          <nav className="flex gap-6" aria-label={t('footer.connect')}>
            <a
              href="#"
              className="font-['Space_Grotesk',sans-serif] text-xs font-semibold uppercase tracking-[0.1em] text-[#c5c6cd] transition-colors hover:text-[#b8c7e2]"
              aria-label={t('stitch.footerContact')}
            >
              {t('stitch.footerContact')}
            </a>
            <a
              href="#"
              className="font-['Space_Grotesk',sans-serif] text-xs font-semibold uppercase tracking-[0.1em] text-[#c5c6cd] transition-colors hover:text-[#b8c7e2]"
              aria-label={t('stitch.footerPrivacy')}
            >
              {t('stitch.footerPrivacy')}
            </a>
            <a
              href="#"
              className="font-['Space_Grotesk',sans-serif] text-xs font-semibold uppercase tracking-[0.1em] text-[#c5c6cd] transition-colors hover:text-[#b8c7e2]"
              aria-label={t('stitch.footerTerms')}
            >
              {t('stitch.footerTerms')}
            </a>
          </nav>
        </div>
      </footer>

      {/* ── Cart FAB ── */}
      <div className="fixed bottom-6 right-6 z-40 md:bottom-8 md:right-8">
        <button
          onClick={onCartClick}
          className="relative flex h-14 w-14 items-center justify-center rounded-full bg-[#efbd8a] text-[#1e314b] shadow-xl transition-all duration-300 active:scale-95 hover:shadow-2xl hover:shadow-[#efbd8a]/20 md:h-16 md:w-16"
          aria-label={t('stitch.cartAriaLabel')}
        >
          <ShoppingBag className="h-6 w-6" aria-hidden="true" />
          {cartItemCount > 0 && (
            <span
              className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-white text-[10px] font-bold text-[#00142c]"
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
