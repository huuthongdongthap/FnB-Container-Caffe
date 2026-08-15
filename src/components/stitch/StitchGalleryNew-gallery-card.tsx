/**
 * Individual gallery card component for StitchGalleryNew
 */

import { ArrowUpRight } from 'lucide-react';
import type { GalleryItem } from './StitchGalleryNew-types';

interface GalleryCardProps {
  item: GalleryItem;
  isSelected: boolean;
  onClick: (itemId: string) => void;
}

export function GalleryCard({ item, isSelected, onClick }: GalleryCardProps) {
  return (
    <div
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
      onClick={() => onClick(item.id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onClick(item.id);
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
}
