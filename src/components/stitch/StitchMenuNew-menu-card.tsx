'use client';

import { useTranslation } from 'react-i18next';
import { Check, Heart } from 'lucide-react';
import type { MenuItemData } from './StitchMenuNew-types';

/* ── Category placeholder maps ─────────────────────────────────── */
const CATEGORY_GRADIENT: Record<string, string> = {
  'traditional-coffee': 'linear-gradient(135deg, #1a0a00 0%, #3d1a00 50%, #5c2d00 100%)',
  'hot-coffee':         'linear-gradient(135deg, #0d0a00 0%, #2a1f00 50%, #4a3800 100%)',
  'iced-coffee':        'linear-gradient(135deg, #001020 0%, #002040 50%, #003060 100%)',
  'frappuccino':        'linear-gradient(135deg, #0a0020 0%, #1a0040 50%, #2d0060 100%)',
  'tea':                'linear-gradient(135deg, #001a10 0%, #003020 50%, #004a30 100%)',
  'smoothies':          'linear-gradient(135deg, #1a0a20 0%, #2d1040 50%, #401a50 100%)',
  'soda':               'linear-gradient(135deg, #001a2e 0%, #00294a 50%, #003860 100%)',
  'juice':              'linear-gradient(135deg, #1a0f00 0%, #3a2000 50%, #5a3500 100%)',
  'yogurt':             'linear-gradient(135deg, #1a0010 0%, #360020 50%, #500030 100%)',
  'other-drinks':       'linear-gradient(135deg, #001010 0%, #002020 50%, #003030 100%)',
  'bottled':            'linear-gradient(135deg, #0a0a1a 0%, #151530 50%, #0a0a1a 100%)',
  'default':            'linear-gradient(135deg, #0a1a2e 0%, #112236 50%, #1a2e42 100%)',
};

const CATEGORY_ICON: Record<string, string> = {
  'traditional-coffee': '☕',
  'hot-coffee':         '☕',
  'iced-coffee':        '🧊',
  'frappuccino':        '🥤',
  'tea':                '🍵',
  'smoothies':          '🥑',
  'soda':               '💧',
  'juice':              '🍊',
  'yogurt':             '🥛',
  'other-drinks':       '🫖',
  'bottled':            '🧴',
  'default':            '🫖',
};

const CATEGORY_LABEL: Record<string, string> = {
  'traditional-coffee': 'Cà phê truyền thống',
  'hot-coffee':         'Cà phê nóng',
  'iced-coffee':        'Cà phê đá',
  'frappuccino':        'Đá xay',
  'tea':                'Trà',
  'smoothies':          'Sinh tố',
  'soda':               'Soda Ý',
  'juice':              'Nước ép',
  'yogurt':             'Yaourt',
  'other-drinks':       'Thức uống khác',
  'bottled':            'Đóng chai',
  'default':            'Đồ uống',
};

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
      {/* ── Image / Placeholder ─────────────────────────── */}
      <div className="relative h-64 overflow-hidden">
        {item.imageSrc ? (
          <img
            src={item.imageSrc}
            alt={item.imageAlt}
            className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
            loading="lazy"
            onError={(e) => {
              // Hide broken image → show placeholder
              (e.currentTarget as HTMLImageElement).style.display = 'none';
              const placeholder = e.currentTarget.nextElementSibling as HTMLElement | null;
              if (placeholder) placeholder.style.display = 'flex';
            }}
          />
        ) : null}

        {/* Placeholder shown when no imageSrc or image fails */}
        <div
          className="h-full w-full flex-col items-center justify-center gap-3"
          style={{
            display: item.imageSrc ? 'none' : 'flex',
            background: CATEGORY_GRADIENT[item.category] ?? CATEGORY_GRADIENT['default'],
          }}
          aria-hidden="true"
        >
          <span className="text-5xl select-none" role="img" aria-hidden="true">
            {CATEGORY_ICON[item.category] ?? CATEGORY_ICON['default']}
          </span>
          <span
            className="text-[10px] uppercase tracking-[0.2em] font-semibold opacity-60"
            style={{ color: 'var(--aura-chrome-bright)' }}
          >
            {CATEGORY_LABEL[item.category] ?? 'Đồ uống'}
          </span>
        </div>

        {item.badge && (
          <div
            className="absolute left-4 top-4 rounded-sm bg-[var(--aura-chrome-bright)] px-3 py-1 text-[10px] font-semibold tracking-[0.1em] text-[var(--aura-noir-deep)]"
            style={{ fontFamily: 'var(--aura-font-body)' }}
          >
            {item.badge}
          </div>
        )}

        <div
          className="absolute right-4 top-4 rounded-sm bg-[var(--aura-surface-dim)]/80 px-2 py-1 text-lg font-medium text-[var(--aura-chrome-bright)] backdrop-blur-md"
          style={{ fontFamily: 'var(--aura-font-body)' }}
        >
          {item.price}
        </div>
      </div>

      <div className="flex grow flex-col p-6">
        <div className="mb-2 flex items-center justify-between">
          <h3
            className="text-[22px] leading-[1.4] font-medium tracking-[0.01em] text-[var(--aura-chrome-bright)]"
            style={{ fontFamily: 'var(--aura-font-display)' }}
          >
            {item.name}
          </h3>
          <button type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleFavorite(item.id);
            }}
            className="ml-2 flex-shrink-0 rounded-full p-2 min-h-[44px] min-w-[44px] flex items-center justify-center transition-all active:scale-75 hover:opacity-80"
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
          style={{ fontFamily: 'var(--aura-font-body)' }}
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

        <button type="button"
          onClick={() => onAddToCart(item)}
          disabled={isAdded}
          aria-label={t('stitch.addToCartAria', { name: item.name })}
          className={`flex w-full items-center justify-center gap-2 rounded-sm py-3 min-h-[44px] text-xs font-semibold uppercase tracking-[0.1em] transition-all duration-300 ${
            isAdded
              ? 'cursor-default bg-[var(--aura-chrome-bright)] text-[var(--aura-noir-deep)]'
              : 'bg-gradient-to-r from-[var(--aura-chrome-light)] to-[var(--aura-chrome-bright)] text-[var(--aura-noir-deep)] hover:brightness-110'
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
