'use client';

import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useMenuStore } from '@/hooks/stores/use-menu-store';
import { useCartStore } from '@/hooks/stores/use-cart-store';
import { formatVnd } from '@/lib/format';
import { AuraImage } from '@/components/ui/AuraImage';

export interface StitchMenuGridProps {
  className?: string;
}

function SkeletonCard() {
  return (
    <div className="group relative bg-[#1b1b1d] overflow-hidden border border-[#44474d]/20 animate-pulse">
      <div className="aspect-square bg-[#2a2a2d]" />
      <div className="p-6 space-y-3">
        <div className="h-6 bg-[#2a2a2d] rounded w-3/4" />
        <div className="h-4 bg-[#2a2a2d] rounded w-1/4" />
        <div className="h-4 bg-[#2a2a2d] rounded w-full" />
        <div className="h-4 bg-[#2a2a2d] rounded w-2/3" />
        <div className="h-[2px] bg-[#2a2a2d] mt-4" />
      </div>
    </div>
  );
}

export default function StitchMenuGrid({ className = '' }: Readonly<StitchMenuGridProps>) {
  const { items, loading, error, fetchMenu } = useMenuStore();
  const addItem = useCartStore((s) => s.addItem);
  const { t } = useTranslation();

  useEffect(() => {
    if (items.length === 0 && !loading && !error) {
      fetchMenu();
    }
  }, [fetchMenu, items.length, loading, error]);

  const handleAddToCart = (item: ReturnType<typeof useMenuStore.getState>['items'][number]) => {
    addItem({
      id: String(item.id),
      name: item.name,
      price: item.price,
      image: item.image,
    });
  };

  /* ── Loading state ─────────────────────────────────────────────── */
  if (loading) {
    return (
      <section className={'py-[120px] px-[24px] max-w-[1280px] mx-auto ' + className}>
        <div className="text-center mb-20">
          <div className="h-4 bg-[#2a2a2d] rounded w-32 mx-auto mb-4 animate-pulse" />
          <div className="h-8 bg-[#2a2a2d] rounded w-64 mx-auto animate-pulse" />
          <div className="w-24 h-px bg-[#b8c7e2]/20 mx-auto mt-6" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </section>
    );
  }

  /* ── Error state ───────────────────────────────────────────────── */
  if (error) {
    return (
      <section className={'py-[120px] px-[24px] max-w-[1280px] mx-auto text-center ' + className}>
        <span className="text-sm tracking-[0.1em] text-[#b8c7e2] uppercase font-['Space_Grotesk',sans-serif] font-semibold mb-4 block">
          {t('stitch.menu')}
        </span>
        <p className="text-[#c5c6cd] text-lg mb-6">{error}</p>
        <button
          onClick={() => fetchMenu()}
          className="px-6 py-3 bg-[#b8c7e2] text-[#1b1b1d] font-['Space_Grotesk',sans-serif] font-semibold text-sm tracking-wider uppercase hover:bg-[#d4dff0] transition-colors"
        >
          {t('common.retry')}
        </button>
      </section>
    );
  }

  /* ── Empty state ────────────────────────────────────────────────── */
  if (items.length === 0) {
    return (
      <section className={'py-[120px] px-[24px] max-w-[1280px] mx-auto text-center ' + className}>
        <span className="text-sm tracking-[0.1em] text-[#b8c7e2] uppercase font-['Space_Grotesk',sans-serif] font-semibold mb-4 block">
          {t('stitch.menu')}
        </span>
        <p className="text-[#c5c6cd] text-lg">
          {t('stitch.emptyMenu')}
        </p>
      </section>
    );
  }

  /* ── Content ────────────────────────────────────────────────────── */
  return (
    <section className={'py-[120px] px-[24px] max-w-[1280px] mx-auto ' + className}>
      {/* Section header */}
      <div className="text-center mb-20">
        <span className="text-sm tracking-[0.1em] text-[#b8c7e2] uppercase font-['Space_Grotesk',sans-serif] font-semibold mb-4 block">
          {t('stitch.featuredSelection')}
        </span>
        <h2 className="font-display text-[clamp(2.5rem,6vw,3rem)] text-[#e4e2e4] leading-[1.2] tracking-[-0.01em] font-medium">
          {t('stitch.specialtyDrinks')}
        </h2>
        <div className="w-24 h-px bg-[#b8c7e2] mx-auto mt-6" />
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
        {items.slice(0, 8).map((item) => (
          <div
            key={item.id}
            className="group relative bg-[#1b1b1d] overflow-hidden border border-[#44474d]/20"
          >
            {/* Availability badge */}
            {!item.available && (
              <div className="absolute top-3 left-3 z-10 bg-[#1b1b1d]/80 backdrop-blur-sm px-3 py-1 text-xs font-['Space_Grotesk',sans-serif] font-semibold text-[#c5c6cd] tracking-wider uppercase border border-[#44474d]/40">
                {t('stitch.soldOut')}
              </div>
            )}

            {/* Image */}
            <div className="aspect-square overflow-hidden bg-[#2a2a2d]">
              {item.image ? (
                <AuraImage
                  src={item.image}
                  alt={item.name}
                  className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-700"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-[#44474d]">
                  <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1}
                      d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                </div>
              )}
            </div>

            {/* Content */}
            <div className="p-6">
              <div className="flex justify-between items-end mb-2">
                <h3 className="font-display text-[clamp(1.5rem,3vw,2rem)] text-[#e4e2e4] leading-[1.3] font-medium">
                  {item.name}
                </h3>
                <span className="text-sm tracking-[0.1em] text-[#b8c7e2] font-['Space_Grotesk',sans-serif] font-semibold">
                  {formatVnd(item.price)}
                </span>
              </div>
              <p className="text-[#c5c6cd] text-base leading-[1.6] mb-4 opacity-70 font-['Space_Grotesk',sans-serif]">
                {item.description}
              </p>
              {/* Brew meter + Add to cart */}
              <div className="flex items-center gap-3">
                <div className="relative h-[2px] flex-1 bg-[#b8c7e2]/10">
                  <div
                    className="absolute left-0 top-0 h-full w-[60%] bg-[#b8c7e2]"
                    style={{ boxShadow: '0 0 10px #b8c7e2' }}
                  />
                </div>
                <button
                  onClick={() => handleAddToCart(item)}
                  disabled={!item.available}
                  className="shrink-0 px-4 py-2 text-xs tracking-[0.1em] font-['Space_Grotesk',sans-serif] font-semibold uppercase text-[#1b1b1d] bg-[#b8c7e2] hover:bg-[#d4dff0] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  {t('stitch.addToCart')}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
