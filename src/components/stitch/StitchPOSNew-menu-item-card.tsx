'use client';

import { useTranslation } from 'react-i18next';
import { Plus, Minus } from 'lucide-react';
import type { POSNewMenuItem } from './StitchPOSNew-types';

export function MenuItemCard({
  item,
  quantity,
  onAdd,
  onRemove,
}: {
  item: POSNewMenuItem;
  quantity: number;
  onAdd: () => void;
  onRemove: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div
      className="relative overflow-hidden rounded-xl aspect-[4/5] flex flex-col cursor-pointer active:scale-[0.98] transition-transform glass-card"
      role="button"
      tabIndex={0}
      aria-label={`${item.name} — $${item.price.toFixed(2)}`}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onAdd(); } }}
    >
      {/* Background image (if provided) */}
      {item.image && (
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${item.image})` }}
        />
      )}
      {/* Image gradient placeholder */}
      <div className="absolute inset-0 bg-gradient-to-br from-[rgba(242,192,141,0.05)] to-[rgba(0,0,0,0.35)]" />
      <div className="absolute inset-0 bg-gradient-to-t from-[#1a1008]/95 via-transparent to-transparent" />
      <div className="mt-auto p-4 relative z-10">
        <h3 className="text-[16px] text-[var(--aura-text-primary, #eae1db)] font-medium leading-tight font-body">
          {item.name}
        </h3>
        <div className="flex items-center justify-between mt-2">
          <p className="text-[14px] text-[var(--aura-primary, #f2c08d)] font-semibold font-body">
            ${item.price.toFixed(2)}
          </p>
          {quantity > 0 ? (
            <div className="flex items-center gap-1 bg-[rgba(242,192,141,0.1)] rounded-lg px-1.5 py-1">
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onRemove(); }}
                className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-md text-[var(--aura-text-primary, #eae1db)] hover:bg-[rgba(242,192,141,0.15)] transition-all active:scale-90"
                aria-label={t('posNew.decrementQuantity')}
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <span className="w-6 text-center text-[13px] text-[var(--aura-text-primary, #eae1db)] font-medium font-body">
                {quantity}
              </span>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onAdd(); }}
                className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-md bg-[rgba(242,192,141,0.15)] text-[var(--aura-primary, #f2c08d)] transition-all active:scale-90"
                aria-label={t('posNew.incrementQuantity')}
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onAdd(); }}
              className="w-8 h-8 flex items-center justify-center rounded-lg bg-[rgba(242,192,141,0.08)] text-[var(--aura-primary, #f2c08d)] hover:bg-[rgba(242,192,141,0.15)] transition-all active:scale-90"
              aria-label={t('posNew.addToCart')}
            >
              <Plus className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
