'use client';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, Check, ShoppingBag } from 'lucide-react';

/* ── Type Definitions ─────────────────────────────────────────────── */

export interface MenuItem2Data {
  id: string;
  name: string;
  description: string;
  price: string;
  imageSrc: string;
  imageAlt: string;
  category: string;
  /** Optional badge text shown in top-left corner (e.g. "Featured") */
  badge?: string;
  /** Label for the gauge bar (e.g. "Intensity", "Sweetness") */
  gaugeLabel: string;
  /** Numeric value for the gauge bar (0-10) */
  gaugeValue: number;
}

export interface StitchMenu2NewProps {
  /** Menu items to display */
  items?: MenuItem2Data[];
  /** Brand name shown in the navigation and footer */
  brandName?: string;
  /** Callback when Add to Order is clicked */
  onAddToOrder?: (item: MenuItem2Data) => void;
  /** Callback when the cart FAB is clicked */
  onCartClick?: () => void;
  /** Number of items currently in the cart */
  cartItemCount?: number;
}

/* ── Default Menu Items ────────────────────────────────────────────── */

const DEFAULT_ITEMS: MenuItem2Data[] = [
  {
    id: '1',
    name: 'Midnight Espresso',
    description: 'Double-shot ristretto, obsidian blend with notes of dark chocolate and smoke.',
    price: '$6.50',
    imageSrc:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuAH_VFxx9-rRwx9wKNjbdcE9OuRiR9kDf1V2bTaWpz-_0fy20-jgs3SmIdl91KadKd7TElUeHnrtds6pHlCuoKWxTJ1qCY6KYsPQZewSIp5je_f7fQg4pSAjkq575Jd6KBZg5X0aapGoKI23yGGWVu1SsGSL_oKw50RhfstBdM5TUfjx964Bv1-3eZXzTE31Es9HTQJxg2t97iwic_fTRs3ymuAuLx_gOoznl0JPLigyw_JDQN-DrbTkDOsxMOpwr4DEE_kyUJwkTk',
    imageAlt:
      'A moody high-contrast photograph of a rich dark espresso shot being poured into a heavy obsidian ceramic cup with tiny golden crema bubbles on top',
    category: 'coffee',
    badge: 'Featured',
    gaugeLabel: 'Intensity',
    gaugeValue: 9,
  },
  {
    id: '2',
    name: 'Chrome Velvet Latte',
    description: 'Charcoal-infused micro-foam, Madagascar vanilla, and velvet-texture espresso.',
    price: '$8.00',
    imageSrc:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuBjmO2eXJjE_CpfiM0km0Psm-VRxYA53RVBLdx9qk4OUDkxbIb3VRdTkbf7NJlOTPWVSjp_rTYy8DzHDY__I-8XpoM-Q-6xVaWsxfkbYVPwKXc_qPrf7qWRg3ioNZhSDwVG-yFf3SsP_9O9qaFlLxf1GWxDaK7Lyr9MwE4v4znAvIEFya7LRoW9J38OL0rrRuJTQG_4cY57eiSpOn4VMIW-kPa-KgJv4c55tETRE4VtHTxmyJnyjdH7fbAfGjFcPWpHX9bUClOou8A',
    imageAlt:
      'A sophisticated latte in a clear glass cup showing distinct layers of charcoal-infused grey milk and rich espresso with a geometric foam pattern on top',
    category: 'coffee',
    gaugeLabel: 'Sweetness',
    gaugeValue: 4,
  },
  {
    id: '3',
    name: 'Industrial Cold Brew',
    description: '24-hour slow drip through stainless steel filtration. Served over a single crystal sphere.',
    price: '$7.50',
    imageSrc:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuDcW7CnosOOxUDF7437ZlimM-6RQJM-nD_RTJIikhjtT_roMitVCtmIYLSG4TGUsr-MiKrV7rje1xtFlBXt3EFKn6PE9iUnUMntjpewI7-MncuEa7UhqT-iYYc5tekYIHbbz_D1gwPoRXj_N8tCEW25FAHRMjErhqLnjunRe4eyq1Px0t-ZFdweX7kCOjA4TYuAEbGTaq4uKwJ-FYqO-KD5PHxR_T8uSWfcZdGrxqR_hHH6n1ZKzjCkCxTvBZ93GAqNfexmt9-MGV0',
    imageAlt:
      'A minimalist glass carafe filled with deep amber-colored cold brew coffee beside a glass with a single large clear ice sphere on brushed aluminum surface',
    category: 'cold-brew',
    gaugeLabel: 'Caffeine',
    gaugeValue: 10,
  },
  {
    id: '4',
    name: 'Bronze Chai',
    description: 'Hand-ground spices, local wild honey, and premium black tea steeped for 8 minutes.',
    price: '$7.00',
    imageSrc:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuDbcnOjmzq8ALq92TrWmO1IpO4-oztDnTnOizeMvgeS0U5O4Pr4NkLSMrzlTv-E-dAgD3JshDmPr3msUZeD6AttX_XHeP3Vjv6_Bk1FBEbVRZggvNEyHKrs3iTidEUa4LMYIzqIvQmTCd-ISxr-IUSrGE6D66VNINa9tQztBLhJ2RwT3xN_YAKcR9_rUzYUH9QyHexApzLN7NcGlUfHctM20sDs5q1h93P35z7i9NPD82Rvo85yjHuJ6BVrdG2S_v7feu6SqlNzxQc',
    imageAlt:
      'A warm creamy chai latte in a rustic bronze-colored mug with steam rising, cinnamon sticks and star anise scattered on a dark slate surface',
    category: 'tea',
    gaugeLabel: 'Spice Level',
    gaugeValue: 7,
  },
];

const CATEGORIES = [
  { key: 'all', label: 'All' },
  { key: 'coffee', label: 'Coffee' },
  { key: 'tea', label: 'Tea' },
  { key: 'signature', label: 'Signature' },
  { key: 'cold-brew', label: 'Cold Brew' },
] as const;

/* ── Sub-Components ────────────────────────────────────────────────── */

function GaugeBar({ label, value, max = 10 }: { label: string; value: number; max?: number }) {
  const percent = Math.min(Math.max((value / max) * 100, 0), 100);
  return (
    <div className="mb-6">
      <div className="mb-2 flex justify-between font-['Space_Grotesk',sans-serif] text-[10px] font-semibold uppercase tracking-widest text-[#8e9097]">
        <span>{label}</span>
        <span aria-label={`${label}: ${value} out of ${max}`}>
          {value}/{max}
        </span>
      </div>
      <div
        className="h-0.5 w-full bg-[rgba(229,228,226,0.1)]"
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-label={`${label}: ${value}/${max}`}
      >
        <div
          className="h-0.5 bg-[#CD7F32] shadow-[0_0_8px_#CD7F32] transition-all duration-700 ease-out"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

/* ── Component ─────────────────────────────────────────────────────── */

export function StitchMenu2New({
  items = DEFAULT_ITEMS,
  brandName = 'AURA CAFE',
  onAddToOrder,
  onCartClick,
  cartItemCount = 0,
}: Readonly<StitchMenu2NewProps>) {
  const { t } = useTranslation();
  const [activeCategory, setActiveCategory] = useState('all');
  const [addedItems, setAddedItems] = useState<Set<string>>(new Set());

  const filteredItems = items.filter((item) => {
    return activeCategory === 'all' || item.category === activeCategory;
  });

  const hasNoItemsInCategory = activeCategory !== 'all' && filteredItems.length === 0;
  const hasEmptyMenu = items.length === 0;

  const handleAddToOrder = (item: MenuItem2Data) => {
    onAddToOrder?.(item);
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

  /* ── Render ──────────────────────────────────────────────────────── */
  return (
    <div
      className="relative min-h-screen bg-[#021429] text-[#d4e3ff] overflow-x-hidden"
      aria-label={t('stitch.menu2.pageLabel')}
    >
      {/* ── Top Navigation Bar ── */}
      <header
        className="fixed top-0 z-50 w-full border-b border-[#c7c6c4]/30 bg-[#021429]/80 backdrop-blur-xl"
        aria-label={t('stitch.menu2.navAriaLabel')}
      >
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-4 md:px-16">
          {/* Brand */}
          <div className="font-['Libre_Caslon_Text',serif] text-2xl uppercase tracking-tighter text-[#d4e3ff] md:text-[32px]">
            {brandName}
          </div>

          {/* Desktop Nav */}
          <nav
            className="hidden items-center gap-8 md:flex"
            aria-label={t('stitch.menu2.navLabel')}
          >
            <a
              href="#"
              className="font-['Space_Grotesk',sans-serif] text-base uppercase tracking-wider text-[#c4c6ce] transition-colors hover:text-[#b5c8e7]"
              aria-label={t('stitch.menu2.navHome')}
            >
              {t('stitch.menu2.navHome')}
            </a>
            <a
              href="#"
              className="border-b-2 border-[#ffb779] pb-1 font-['Space_Grotesk',sans-serif] text-base uppercase tracking-wider text-[#b5c8e7]"
              aria-label={t('stitch.menu2.navMenu')}
            >
              {t('stitch.menu2.navMenu')}
            </a>
            <a
              href="#"
              className="font-['Space_Grotesk',sans-serif] text-base uppercase tracking-wider text-[#c4c6ce] transition-colors hover:text-[#b5c8e7]"
              aria-label={t('stitch.menu2.navLocation')}
            >
              {t('stitch.menu2.navLocation')}
            </a>
          </nav>

          {/* Search + Reservation */}
          <div className="flex items-center gap-6">
            {/* Desktop Search */}
            <div
              className="hidden items-center gap-2 border-b border-[#E5E4E2]/30 py-1 lg:flex"
              role="search"
              aria-label={t('stitch.menu2.searchAriaLabel')}
            >
              <Search className="h-4 w-4 text-[#8e9097]" aria-hidden="true" />
              <input
                type="text"
                placeholder={t('stitch.menu2.searchPlaceholder')}
                aria-label={t('stitch.menu2.searchAriaLabel')}
                className="w-48 border-none bg-transparent font-['Space_Grotesk',sans-serif] text-sm font-medium text-[#c4c6ce] placeholder-[#8e9097]/50 focus:outline-none focus:ring-0"
              />
            </div>

            {/* Reservation CTA */}
            <button
              className="bg-[#E5E4E2] px-6 py-2 font-['Space_Grotesk',sans-serif] text-[12px] font-semibold uppercase tracking-widest text-[#1e314a] transition-all active:scale-95 hover:bg-white"
              aria-label={t('stitch.menu2.reservationAriaLabel')}
            >
              {t('stitch.menu2.reservation')}
            </button>
          </div>
        </div>
      </header>

      {/* ── Main Content ── */}
      <main className="mx-auto min-h-screen max-w-7xl px-4 pt-32 pb-24 md:px-16">
        {/* ── Hero Section ── */}
        <section className="mb-16" aria-label={t('stitch.menu2.heroAriaLabel')}>
          <div className="mb-12 flex flex-col justify-between gap-8 md:flex-row md:items-end">
            <div>
              <span className="mb-4 block font-['Space_Grotesk',sans-serif] text-[12px] font-semibold uppercase tracking-[0.4em] text-[#CD7F32]">
                {t('stitch.menu2.heroSubtitle')}
              </span>
              <h1 className="font-['Libre_Caslon_Text',serif] text-[clamp(2.25rem,8vw,3rem)] leading-tight md:text-[48px] md:leading-[56px] md:tracking-[-0.02em]">
                {t('stitch.menu2.heroTitle')}
              </h1>
            </div>

            {/* Category Filters */}
            <div
              className="flex flex-wrap gap-3"
              role="tablist"
              aria-label={t('stitch.menu2.filterAriaLabel')}
            >
              {CATEGORIES.map((cat) => {
                const isActive = activeCategory === cat.key;
                return (
                  <button
                    key={cat.key}
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => setActiveCategory(cat.key)}
                    className={`rounded-sm border px-6 py-2 font-['Space_Grotesk',sans-serif] text-sm font-medium transition-all ${
                      isActive
                        ? 'border-[#CD7F32]/50 bg-[rgba(2,20,41,0.8)] text-[#CD7F32] shadow-[0_0_8px_rgba(205,127,50,0.1)] backdrop-blur-[16px]'
                        : 'border-[#E5E4E2]/30 bg-[rgba(2,20,41,0.8)] text-[#c7c6c4] backdrop-blur-[16px] hover:text-[#d4e3ff]'
                    }`}
                  >
                    {cat.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Divider */}
          <div className="mb-16 h-px w-full bg-[#c7c6c4]/20" />
        </section>

        {/* ── Menu Grid ── */}
        {hasEmptyMenu && (
          <div className="py-20 text-center" role="status">
            <p className="font-['Space_Grotesk',sans-serif] text-lg text-[#c4c6ce]">
              {t('stitch.menu2.emptyMenu')}
            </p>
          </div>
        )}

        {hasNoItemsInCategory && (
          <div className="py-20 text-center" role="status">
            <p className="font-['Space_Grotesk',sans-serif] text-lg text-[#c4c6ce]">
              {t('stitch.menu2.noItemsInCategory')}
            </p>
          </div>
        )}

        {!hasEmptyMenu && !hasNoItemsInCategory && (
          <div className="mb-32 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
            {filteredItems.map((item) => {
              const isAdded = addedItems.has(item.id);
              return (
                <article
                  key={item.id}
                  className="group relative flex h-full flex-col overflow-hidden border border-[#E5E4E2]/30 bg-[rgba(2,20,41,0.8)] backdrop-blur-[16px] transition-all duration-500 hover:shadow-[0_0_20px_rgba(229,228,226,0.05)]"
                  aria-label={item.name}
                >
                  {/* Badge */}
                  {item.badge && (
                    <div className="absolute left-4 top-4 z-10">
                      <span className="bg-[#CD7F32] px-3 py-1 font-['Space_Grotesk',sans-serif] text-[10px] font-semibold uppercase tracking-widest text-[#021429]">
                        {item.badge}
                      </span>
                    </div>
                  )}

                  {/* Image */}
                  <div className="aspect-[4/5] overflow-hidden">
                    <img
                      src={item.imageSrc}
                      alt={item.imageAlt}
                      className="h-full w-full object-cover grayscale-[0.3] transition-transform duration-700 group-hover:scale-105"
                      loading="lazy"
                    />
                  </div>

                  {/* Content */}
                  <div className="flex flex-grow flex-col p-8">
                    {/* Title + Price */}
                    <div className="mb-2 flex items-start justify-between">
                      <h3 className="font-['Libre_Caslon_Text',serif] text-[20px] leading-[28px] font-normal">
                        {item.name}
                      </h3>
                      <span className="font-['Space_Grotesk',sans-serif] text-sm font-medium text-[#c7c6c4]">
                        {item.price}
                      </span>
                    </div>

                    {/* Description */}
                    <p className="mb-6 flex-grow font-['Space_Grotesk',sans-serif] text-base leading-6 text-[#c4c6ce]/80">
                      {item.description}
                    </p>

                    {/* Gauge Bar */}
                    <GaugeBar label={item.gaugeLabel} value={item.gaugeValue} />

                    {/* Add to Order */}
                    <button
                      onClick={() => handleAddToOrder(item)}
                      disabled={isAdded}
                      aria-label={
                        isAdded
                          ? t('stitch.menu2.addedAria', { name: item.name })
                          : t('stitch.menu2.addToOrderAria', { name: item.name })
                      }
                      className={`w-full py-3 font-['Space_Grotesk',sans-serif] text-xs font-semibold uppercase tracking-widest transition-all active:scale-[0.98] ${
                        isAdded
                          ? 'cursor-default bg-gradient-to-r from-[#E5E4E2] to-[#BCC6CC] text-[#1e314a]'
                          : 'bg-gradient-to-r from-[#E5E4E2] to-[#BCC6CC] text-[#1e314a] hover:brightness-110'
                      }`}
                    >
                      {isAdded ? (
                        <span className="flex items-center justify-center gap-2">
                          <Check className="h-4 w-4" aria-hidden="true" />
                          {t('stitch.menu2.added')}
                        </span>
                      ) : (
                        t('stitch.menu2.addToOrder')
                      )}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {/* ── Specialty Section: The Craft ── */}
        <section
          className="relative overflow-hidden border border-[#E5E4E2]/30 bg-[rgba(2,20,41,0.8)] backdrop-blur-[16px] p-12 md:p-24"
          aria-label={t('stitch.menu2.craftSectionAriaLabel')}
        >
          <div className="relative z-10 max-w-2xl">
            <span className="mb-6 block font-['Space_Grotesk',sans-serif] text-[12px] font-semibold uppercase tracking-[0.5em] text-[#CD7F32]">
              {t('stitch.menu2.craftSubtitle')}
            </span>
            <h2 className="mb-8 font-['Libre_Caslon_Text',serif] text-[clamp(2rem,6vw,3rem)] italic leading-tight">
              {t('stitch.menu2.craftHeading')}
            </h2>
            <p className="mb-12 font-['Space_Grotesk',sans-serif] text-[18px] leading-[28px] font-light text-[#c4c6ce]">
              {t('stitch.menu2.craftDescription')}
            </p>

            {/* Stats */}
            <div className="flex gap-8">
              <div className="flex flex-col">
                <span className="font-['Libre_Caslon_Text',serif] text-[clamp(2rem,5vw,2.5rem)] text-[#CD7F32]">
                  {t('stitch.menu2.filterMicron')}
                </span>
                <span className="font-['Space_Grotesk',sans-serif] text-sm font-medium uppercase tracking-widest text-[#8e9097]">
                  {t('stitch.menu2.micronFilter')}
                </span>
              </div>
              <div className="flex flex-col">
                <span className="font-['Libre_Caslon_Text',serif] text-[clamp(2rem,5vw,2.5rem)] text-[#CD7F32]">
                  {t('stitch.menu2.brewTempValue')}
                </span>
                <span className="font-['Space_Grotesk',sans-serif] text-sm font-medium uppercase tracking-widest text-[#8e9097]">
                  {t('stitch.menu2.brewTempLabel')}
                </span>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* ── Footer ── */}
      <footer
        className="w-full border-t border-[#c7c6c4]/30 bg-[#021429] py-12"
        aria-label={t('stitch.menu2.footerAriaLabel')}
      >
        <div className="mx-auto flex max-w-7xl flex-col items-center gap-6 px-4 md:flex-row md:justify-between md:px-16">
          {/* Brand */}
          <div className="font-['Libre_Caslon_Text',serif] text-2xl uppercase text-[#c7c6c4]">
            {brandName}
          </div>

          {/* Footer Links */}
          <nav className="flex gap-8" aria-label={t('stitch.menu2.footerLinksLabel')}>
            <a
              href="#"
              className="font-['Space_Grotesk',sans-serif] text-sm font-medium text-[#8e9097] transition-colors hover:text-[#b5c8e7]"
              aria-label={t('stitch.menu2.footerPrivacy')}
            >
              {t('stitch.menu2.footerPrivacy')}
            </a>
            <a
              href="#"
              className="font-['Space_Grotesk',sans-serif] text-sm font-medium text-[#8e9097] transition-colors hover:text-[#b5c8e7]"
              aria-label={t('stitch.menu2.footerTerms')}
            >
              {t('stitch.menu2.footerTerms')}
            </a>
            <a
              href="#"
              className="font-['Space_Grotesk',sans-serif] text-sm font-medium text-[#8e9097] transition-colors hover:text-[#b5c8e7"
              aria-label={t('stitch.menu2.footerInstagram')}
            >
              {t('stitch.menu2.footerInstagram')}
            </a>
          </nav>

          {/* Copyright */}
          <div className="font-['Space_Grotesk',sans-serif] text-sm text-[#c7c6c4]/60">
            &copy; {new Date().getFullYear()} {brandName}. {t('stitch.menu2.allRightsReserved')}
          </div>
        </div>
      </footer>

      {/* ── Cart FAB ── */}
      {onCartClick && (
        <div className="fixed bottom-6 right-6 z-40 md:bottom-8 md:right-8">
          <button
            onClick={onCartClick}
            className="flex h-14 w-14 items-center justify-center rounded-full bg-[#E5E4E2] text-[#1e314a] shadow-xl transition-all active:scale-95 hover:shadow-2xl md:h-16 md:w-16"
            aria-label={t('stitch.menu2.cartAriaLabel')}
          >
            <ShoppingBag className="h-6 w-6" aria-hidden="true" />
            {cartItemCount > 0 && (
              <span
                className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-white text-[10px] font-bold text-[#021429]"
                aria-live="polite"
                aria-atomic="true"
              >
                {cartItemCount}
              </span>
            )}
          </button>
        </div>
      )}
    </div>
  );
}

export default StitchMenu2New;
