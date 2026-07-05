/**
 * StitchGalleryNew — AURA CAFE Design Gallery (Stitch design, regenerated to exact HTML match)
 *
 * Dark navy design gallery with filter bar (All/Industrial/Luxury/Tech),
 * 4 gallery cards (grid 2 cols), load more button, and bottom nav.
 * Supports scroll-reveal animation and active item selection.
 * Mobile-first responsive. Named export.
 * Source: stitch-exports/new-screens/design-gallery.html
 */
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Menu, ShoppingBag, Home, Grid3x3, UtensilsCrossed, ArmchairIcon as Seat, ArrowUpRight } from 'lucide-react';

/* ─── Types ────────────────────────────────────────────────────────── */

export type FilterId = 'all' | 'industrial' | 'luxury' | 'tech';

export interface GalleryItem {
  id: string;
  label: string;
  title: string;
  imageUrl: string;
  imageAlt: string;
  filter: FilterId;
}

export interface StitchGalleryNewProps {
  items?: GalleryItem[];
  onItemClick?: (itemId: string) => void;
  onLoadMore?: () => void;
}

/* ─── Default gallery items ────────────────────────────────────────── */

const defaultItems: GalleryItem[] = [
  {
    id: 'precision-pos',
    label: 'MODULE 01',
    title: 'PRECISION POS',
    filter: 'tech',
    imageUrl:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuAEiV-QAGkavYocOjVe1OiC9HYLEpUnS0hSnLtZbMFXjgvWa6u5eiGCHFJJaye-088uZG7LRRU-VkmqQWcV235vxTA1dWAvxGqDZwB9tiqBI3X7ZpgE9tr1A9cxvTnZ6NmXXZlOGq2pJVMrHwwty_fZ2ZbASVwt9MzFrKf2eMIHvRVEQ-CHRGS6HtlXatduxF9KLZ3cD6nsFvFpEnY5tAfyD3PmJiBqWuh8XnYftXlveecAFs3i26x98_2vGIJEsnWyYVg5er6h6QI',
    imageAlt: 'A moody architectural detail shot of a modular industrial cafe POS terminal system',
  },
  {
    id: 'kinetic-kitchen',
    label: 'MODULE 02',
    title: 'KINETIC KITCHEN',
    filter: 'industrial',
    imageUrl:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuBnUMUlDrK3em7MDLGcWVEJHE4Anrrf5ChGIZrUB1W12deXrNKzyW1PhN429aEFKkeBDY4WwURMNWG5H1smPIZbPHZ1LYlrmo9ZgztN442qNawaYIomsr3YZXEtZrFBeJxG_B3CFIq79ZMEIg154EtM1EXzPCSQ7nviuDoh4DgkRCzwMAlB8rVzu_0NNXqV8LHgJgYf7Xv_6Q-9OFWCA7U64Bj73gxVZ4hbWZx8FS4G_-PvzS7ECq2XlagiTGso0GXATKzGaqocCM4',
    imageAlt: 'A dramatic wide shot of a kinetic open kitchen layout with brushed chrome surfaces and warm bronze hood lighting',
  },
  {
    id: 'nocturnal-loyalty',
    label: 'MODULE 03',
    title: 'NOCTURNAL LOYALTY',
    filter: 'luxury',
    imageUrl:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuCEnI_-206HaL0xOKv9qDtOdHOg-O9423VqXdO_DElBPLmV76Ehu_GObW1TinmAr-7wbOqnY73qypOaYI1PWClhDNSNFXZ7RoyXmvLqcLvDB3HmXIKJGeeN36-vWAZTpEWNzYuNOHW8563HIMo4HxvEDnFS5wjzefau9HWPKSHskH4DgUU_7PKRUZ4nMahxhChoej4z7gGoW3aIBMfO_EifWn-6UHcLo-T7xViZTm-BqjJPR32K2tf2ExAyqQyoniO1VMvUtBJxh4w',
    imageAlt: 'An elegant nocturnal loyalty program interface displayed on a sleek tablet surrounded by dark navy velvet textures',
  },
  {
    id: 'atmospheric-grid',
    label: 'MODULE 04',
    title: 'ATMOSPHERIC GRID',
    filter: 'tech',
    imageUrl:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuDfhArIIay07cNLaryaJFYmvycJddJwvti9hFfFCneAC6OvU6JzjVcUSCdKaE1nkVicGJhyh7fyRX8hOgMdk1BFF_-hPBrCGDDpu-FC-i4vhfeQC3JNuG-EuJTbDP_mzqHkLK28CHbcex10kYg8mJi68L4UdvnWb4UxLpwqGPq7hZP2QDLBO0yL_4EiIPX5SsxFhuzC5hOAOmgv7crYbYO7_mv51auc8j9BI4Aqw2TchwXyWJNtKKepfK98I7EQWAuctJPgtv6hJpY',
    imageAlt: 'An abstract atmospheric grid visualization showing ambient cafe sensor data rendered in bronze and navy tones',
  },
];

const filterOptions: { id: FilterId; label: string }[] = [
  { id: 'all', label: 'ALL' },
  { id: 'industrial', label: 'INDUSTRIAL' },
  { id: 'luxury', label: 'LUXURY' },
  { id: 'tech', label: 'TECH' },
];

/* ─── Component ────────────────────────────────────────────────────── */

export function StitchGalleryNew({
  items = defaultItems,
  onItemClick,
  onLoadMore,
}: Readonly<StitchGalleryNewProps>) {
  const { t } = useTranslation();
  const [activeFilter, setActiveFilter] = useState<FilterId>('all');
  const [activeItem, setActiveItem] = useState<string | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  const filteredItems = useCallback(() => {
    if (activeFilter === 'all') return items;
    return items.filter((item) => item.filter === activeFilter);
  }, [activeFilter, items]);

  useEffect(() => {
    const handleScroll = () => {
      const cards = gridRef.current?.querySelectorAll('[data-gallery-card]');
      if (!cards) return;
      cards.forEach((card) => {
        const rect = card.getBoundingClientRect();
        if (rect.top < window.innerHeight - 100) {
          (card as HTMLElement).style.opacity = '1';
          (card as HTMLElement).style.transform = 'translateY(0)';
        }
      });
    };
    window.addEventListener('scroll', handleScroll);
    handleScroll(); // Initial check
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    // Re-trigger scroll reveal when filter changes
    const timer = setTimeout(() => {
      const cards = gridRef.current?.querySelectorAll('[data-gallery-card]');
      if (!cards) return;
      cards.forEach((card, index) => {
        const el = card as HTMLElement;
        el.style.opacity = '0';
        el.style.transform = 'translateY(20px)';
        el.style.transition = `all 0.6s cubic-bezier(0.23, 1, 0.32, 1) ${index * 0.1}s`;
        setTimeout(() => {
          el.style.opacity = '1';
          el.style.transform = 'translateY(0)';
        }, 50);
      });
    }, 100);
    return () => clearTimeout(timer);
  }, [activeFilter]);

  const handleItemClick = (itemId: string) => {
    setActiveItem(itemId === activeItem ? null : itemId);
    onItemClick?.(itemId);
    if (window.navigator.vibrate) {
      window.navigator.vibrate(5);
    }
  };

  const currentItems = filteredItems();

  return (
    <>
      {/* Top App Bar */}
      <header className="fixed top-0 z-50 flex h-20 w-full items-center justify-between border-b border-[var(--aura-chrome-soft)]/30 bg-[var(--aura-surface-dim)]/90 px-6 backdrop-blur-xl md:px-20">
        <div className="flex items-center">
          <button type="button" className="text-[var(--aura-chrome-bright)]" aria-label="Menu">
            <Menu size={24} />
          </button>
        </div>
        <h1 className="font-[family-name:var(--aura-display-font)] text-3xl uppercase tracking-tighter text-[var(--aura-chrome-bright)] md:text-5xl">
          AURA CAFE
        </h1>
        <div className="flex items-center">
          <button type="button" className="text-[var(--aura-chrome-bright)]" aria-label="Shopping Bag">
            <ShoppingBag size={24} />
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 pb-32 pt-32">
        {/* Section Header */}
        <div className="mb-12">
          <h2 className="border-l-4 pl-4 font-[family-name:var(--aura-display-font)] text-4xl uppercase tracking-widest text-[var(--aura-chrome-bright)] md:text-5xl"
            style={{ borderLeftColor: 'var(--aura-bronze-shimmer)' }}
          >
            Design Showcase
          </h2>
          <p className="mt-4 font-[family-name:var(--aura-body-font)] text-xl text-[var(--aura-chrome-soft)] opacity-70">
            Exploring the industrial luxury and visual language of AURA.
          </p>
        </div>

        {/* Filter Bar */}
        <nav className="scrollbar-hide mb-12 flex gap-8 overflow-x-auto border-b border-[var(--aura-chrome-soft)]/20 pb-4">
          {filterOptions.map((filter) => {
            const isActive = activeFilter === filter.id;
            return (
              <button
                key={filter.id}
                type="button"
                onClick={() => setActiveFilter(filter.id)}
                className={`relative flex flex-col items-start transition-opacity focus:outline-none ${
                  isActive ? 'opacity-100' : 'opacity-50 hover:opacity-100'
                }`}
              >
                <span
                  className={`mb-2 font-[family-name:var(--aura-body-font)] text-base uppercase tracking-widest ${
                    isActive ? 'text-[var(--aura-bronze-shimmer)]' : 'text-[var(--aura-chrome-bright)]'
                  }`}
                >
                  {filter.label}
                </span>
                <div
                  className="filter-underline"
                  style={{
                    height: '2px',
                    width: '100%',
                    background: isActive ? 'var(--aura-bronze-shimmer)' : 'transparent',
                    transition: 'background 0.2s',
                  }}
                />
              </button>
            );
          })}
        </nav>

        {/* Grid Gallery */}
        <div ref={gridRef} className="grid grid-cols-1 gap-10 md:grid-cols-2">
          {currentItems.map((item) => {
            const isSelected = activeItem === item.id;
            return (
              <div
                key={item.id}
                data-gallery-card
                className="group cursor-pointer transition-all duration-500"
                style={{
                  border: isSelected
                    ? '1px solid var(--aura-bronze-shimmer)'
                    : '1px solid var(--aura-chrome-soft)/20',
                  boxShadow: isSelected ? '0 0 15px rgba(212, 165, 116, 0.1)' : 'none',
                  opacity: '0',
                  transform: 'translateY(20px)',
                }}
                onClick={() => handleItemClick(item.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') handleItemClick(item.id);
                }}
                role="button"
                tabIndex={0}
                aria-label={item.title}
              >
                <div className="relative aspect-[4/3] overflow-hidden bg-[var(--aura-surface-container-high)]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    className="h-full w-full scale-105 object-cover grayscale transition-all duration-700 group-hover:scale-100 group-hover:grayscale-0"
                    src={item.imageUrl}
                    alt={item.imageAlt}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[var(--aura-surface-dim)] via-transparent to-transparent opacity-60" />
                  <div className="absolute bottom-4 left-4">
                    <span
                      className="border bg-[var(--aura-surface-dim)]/80 px-2 py-1 font-[family-name:var(--aura-body-font)] text-xs"
                      style={{
                        color: 'var(--aura-bronze-shimmer)',
                        borderColor: 'rgba(212, 165, 116, 0.3)',
                      }}
                    >
                      {item.label}
                    </span>
                  </div>
                </div>
                <div className="flex items-center justify-between border-t border-[var(--aura-chrome-soft)]/20 bg-[var(--aura-surface-dim)] p-6">
                  <h3 className="font-[family-name:var(--aura-body-font)] text-base tracking-widest text-[var(--aura-chrome-bright)]">
                    {item.title}
                  </h3>
                  <ArrowUpRight className="text-sm text-[var(--aura-chrome-soft)]" size={16} />
                </div>
              </div>
            );
          })}
        </div>

        {/* Load More */}
        {currentItems.length > 0 && (
          <div className="mt-20 flex justify-center">
            <button
              type="button"
              onClick={onLoadMore}
              className="border border-[var(--aura-chrome-soft)]/50 px-12 py-4 font-[family-name:var(--aura-body-font)] text-base tracking-widest text-[var(--aura-chrome-bright)] transition-all duration-300 hover:bg-[var(--aura-chrome-bright)] hover:text-[var(--aura-surface-dim)]"
            >
              LOAD MORE ARCHIVES
            </button>
          </div>
        )}
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 z-50 flex w-full items-center justify-around border-t border-[var(--aura-chrome-bright)]/20 bg-[var(--aura-surface-dim)]/95 backdrop-blur-lg">
        <button
          type="button"
          className="flex flex-col items-center justify-center pb-4 pt-2 text-[var(--aura-chrome-soft)]/60 transition-all hover:text-[var(--aura-chrome-bright)]"
        >
          <Home size={20} className="mb-1" />
          <span className="font-[family-name:var(--aura-body-font)] text-[10px] uppercase tracking-widest">
            HOME
          </span>
        </button>
        <button
          type="button"
          className="flex scale-95 flex-col items-center justify-center border-t-2 pb-4 pt-2 text-[var(--aura-chrome-bright)] transition-all"
          style={{
            borderTopColor: 'var(--aura-chrome-bright)',
          }}
        >
          <Grid3x3 size={20} className="mb-1" style={{ fontVariationSettings: "'FILL' 1" }} />
          <span className="font-[family-name:var(--aura-body-font)] text-[10px] uppercase tracking-widest">
            GALLERY
          </span>
        </button>
        <button
          type="button"
          className="flex flex-col items-center justify-center pb-4 pt-2 text-[var(--aura-chrome-soft)]/60 transition-all hover:text-[var(--aura-chrome-bright)]"
        >
          <UtensilsCrossed size={20} className="mb-1" />
          <span className="font-[family-name:var(--aura-body-font)] text-[10px] uppercase tracking-widest">
            MENU
          </span>
        </button>
        <button
          type="button"
          className="flex flex-col items-center justify-center pb-4 pt-2 text-[var(--aura-chrome-soft)]/60 transition-all hover:text-[var(--aura-chrome-bright)]"
        >
          <Seat size={20} className="mb-1" />
          <span className="font-[family-name:var(--aura-body-font)] text-[10px] uppercase tracking-widest">
            RESERVE
          </span>
        </button>
      </nav>
    </>
  );
}
