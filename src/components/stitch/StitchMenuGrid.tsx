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
    <div className="group relative bg-[var(--aura-bg-surface)] overflow-hidden border border-[var(--aura-border-soft)]/20 animate-pulse">
      <div className="aspect-square bg-[var(--aura-bg-elevated)]" />
      <div className="p-6 space-y-3">
        <div className="h-6 bg-[var(--aura-bg-elevated)] rounded w-3/4" />
        <div className="h-4 bg-[var(--aura-bg-elevated)] rounded w-1/4" />
        <div className="h-4 bg-[var(--aura-bg-elevated)] rounded w-full" />
        <div className="h-4 bg-[var(--aura-bg-elevated)] rounded w-2/3" />
        <div className="h-[2px] bg-[var(--aura-bg-elevated)] mt-4" />
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
          <div className="h-4 bg-[var(--aura-bg-elevated)] rounded w-32 mx-auto mb-4 animate-pulse" />
          <div className="h-8 bg-[var(--aura-bg-elevated)] rounded w-64 mx-auto animate-pulse" />
          <div className="w-24 h-px bg-[var(--aura-chrome-light)]/20 mx-auto mt-6" />
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
        <span className="text-sm tracking-[0.1em] text-[var(--aura-chrome-light)] uppercase font-body font-semibold mb-4 block">
          {t('stitch.menu')}
        </span>
        <p className="text-[var(--aura-text-body)] text-lg mb-6">{error}</p>
        <button
          onClick={() => fetchMenu()}
          className="px-6 py-3 bg-[var(--aura-chrome-light)] text-[var(--aura-bg-surface)] font-body font-semibold text-sm tracking-wider uppercase hover:bg-[#d4dff0] transition-colors"
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
        <span className="text-sm tracking-[0.1em] text-[var(--aura-chrome-light)] uppercase font-body font-semibold mb-4 block">
          {t('stitch.menu')}
        </span>
        <p className="text-[var(--aura-text-body)] text-lg">
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
        <span className="text-sm tracking-[0.1em] text-[var(--aura-chrome-light)] uppercase font-body font-semibold mb-4 block">
          {t('stitch.featuredSelection')}
        </span>
        <h2 className="font-display text-[clamp(2.5rem,6vw,3rem)] text-[var(--aura-text-primary)] leading-[1.2] tracking-[-0.01em] font-medium">
          {t('stitch.specialtyDrinks')}
        </h2>
        <div className="w-24 h-px bg-[var(--aura-chrome-light)] mx-auto mt-6" />
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
        {items.slice(0, 8).map((item) => (
          <div
            key={item.id}
            className="group relative bg-[var(--aura-bg-surface)] overflow-hidden border border-[var(--aura-border-soft)]/20"
          >
            {/* Availability badge */}
            {!item.available && (
              <div className="absolute top-3 left-3 z-10 bg-[var(--aura-bg-surface)]/80 backdrop-blur-sm px-3 py-1 text-xs font-body font-semibold text-[var(--aura-text-body)] tracking-wider uppercase border border-[var(--aura-border-soft)]/40">
                {t('stitch.soldOut')}
              </div>
            )}

            {/* Image */}
            <div className="aspect-square overflow-hidden bg-[var(--aura-bg-elevated)]">
              {item.image ? (
                <AuraImage
                  src={item.image}
                  alt={item.name}
                  className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-700"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-[var(--aura-border-soft)]">
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
                <h3 className="font-display text-[clamp(1.5rem,3vw,2rem)] text-[var(--aura-text-primary)] leading-[1.3] font-medium">
                  {item.name}
                </h3>
                <span className="text-sm tracking-[0.1em] text-[var(--aura-chrome-light)] font-body font-semibold">
                  {formatVnd(item.price)}
                </span>
              </div>
              <p className="text-[var(--aura-text-body)] text-base leading-[1.6] mb-4 opacity-70 font-body">
                {item.description}
              </p>
              {/* Brew meter + Add to cart */}
              <div className="flex items-center gap-3">
                <div className="relative h-[2px] flex-1 bg-[var(--aura-chrome-light)]/10">
                  <div
                    className="absolute left-0 top-0 h-full w-[60%] bg-[var(--aura-chrome-light)]"
                    style={{ boxShadow: '0 0 10px var(--aura-chrome-light)' }}
                  />
                </div>
                <button
                  onClick={() => handleAddToCart(item)}
                  disabled={!item.available}
                  className="shrink-0 px-4 py-2 text-xs tracking-[0.1em] font-body font-semibold uppercase text-[var(--aura-bg-surface)] bg-[var(--aura-chrome-light)] hover:bg-[#d4dff0] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
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
