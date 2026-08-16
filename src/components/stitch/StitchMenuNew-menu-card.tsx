'use client';

import { useTranslation } from 'react-i18next';
import { Check, Heart } from 'lucide-react';
import type { MenuItemData } from './StitchMenuNew-types';

interface StitchMenuNewMenuCardProps {
  item: MenuItemData;
  index: number;
  totalDefaultItems: number;
  isDefaultDataset: boolean;
  isAdded: boolean;
  isFavorite: (id: string) => boolean;
  onToggleFavorite: (id: string) => void;
  onAddToCart: (item: MenuItemData) => void;
}

export function StitchMenuNewMenuCard({
  item,
  index,
  totalDefaultItems,
  isDefaultDataset,
  isAdded,
  isFavorite,
  onToggleFavorite,
  onAddToCart,
}: StitchMenuNewMenuCardProps) {
  const { t } = useTranslation();
  const shouldDim = isDefaultDataset && index >= totalDefaultItems - 2;

  return (
    <article
      className={`group flex h-full flex-col overflow-hidden rounded-xl aura-glass ${shouldDim ? 'opacity-90' : ''}`}
      aria-label={item.name}
    >
      <div className="relative h-64 overflow-hidden">
        <img
          src={item.imageSrc}
          alt={item.imageAlt}
          className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
          loading="lazy"
        />

        {item.badge && (
          <div
            className="absolute left-4 top-4 rounded-sm bg-[var(--aura-chrome-bright)] px-3 py-1 text-[10px] font-semibold tracking-[0.1em] text-[var(--aura-noir-deep)]"
            style={{ fontFamily: '"Space Grotesk", system-ui, sans-serif' }}
          >
            {item.badge}
          </div>
        )}

        <div
          className="absolute right-4 top-4 rounded-sm bg-[var(--aura-surface-dim)]/80 px-2 py-1 text-lg font-medium text-[var(--aura-chrome-bright)] backdrop-blur-md"
          style={{ fontFamily: '"Space Grotesk", system-ui, sans-serif' }}
        >
          {item.price}
        </div>
      </div>

      <div className="flex grow flex-col p-6">
        <div className="mb-2 flex items-center justify-between">
          <h3
            className="text-[22px] leading-[1.4] font-medium tracking-[0.01em] text-[var(--aura-chrome-bright)]"
            style={{ fontFamily: '"EB Garamond", Georgia, serif' }}
          >
            {item.name}
          </h3>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleFavorite(item.id);
            }}
            className="ml-2 flex-shrink-0 rounded-full p-1 transition-all active:scale-75 hover:opacity-80"
            aria-label={
              isFavorite(item.id)
                ? t('stitch.removeFavoriteAria', { name: item.name })
                : t('stitch.addFavoriteAria', { name: item.name })
            }
          >
            <Heart
              className="h-5 w-5 transition-colors"
              fill={isFavorite(item.id) ? 'var(--aura-chrome-bright)' : 'none'}
              stroke={isFavorite(item.id) ? 'var(--aura-chrome-bright)' : 'var(--aura-chrome-soft)'}
              aria-hidden="true"
            />
          </button>
        </div>

        <p
          className="mb-4 grow text-base font-light leading-[1.6] text-[var(--aura-chrome-soft)]/70"
          style={{ fontFamily: '"Space Grotesk", system-ui, sans-serif' }}
        >
          {item.description}
        </p>

        {item.prepTime && item.prepTime > 0 && (
          <p className="mb-4 text-xs text-[var(--aura-chrome-mid)] flex items-center gap-1.5">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            ~{item.prepTime} phút
          </p>
        )}

        <button
          onClick={() => onAddToCart(item)}
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
}
