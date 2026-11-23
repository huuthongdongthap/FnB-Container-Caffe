'use client';

import { useTranslation } from 'react-i18next';
import { Plus, Minus } from 'lucide-react';
import { formatPosPrice, type POSNewMenuItem } from './StitchPOSNew-types';

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
  const formattedPrice = formatPosPrice(item.price);
  return (
    <div
      className="relative overflow-hidden rounded-xl flex flex-col cursor-pointer active:scale-[0.98] transition-transform border border-[rgba(var(--aura-chrome-light),0.12)] bg-[rgba(var(--aura-noir-void),0.75)]"
      onClick={onAdd}
    >
      {/* Clean top image area — no dark gradient or controls obscuring the drink photo (#111) */}
      <div className="relative w-full aspect-[4/3] overflow-hidden bg-[rgba(var(--aura-noir-void),0.5)] shrink-0">
        {item.image ? (
          <img
            src={item.image}
            alt={item.name}
            loading="lazy"
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-[color-mix(in srgb,var(--aura-chrome-light,rgba(var(--aura-chrome-light),1)) 8%,transparent)] to-[rgba(0,0,0,0.25)]" />
        )}
      </div>

      {/* Dedicated info & quantity controls panel below image */}
      <div className="p-3 flex flex-col justify-between gap-2 flex-1">
        <h3
          role="button"
          tabIndex={0}
          aria-label={`${item.name} — ${formattedPrice}`}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); onAdd(); } }}
          className="text-[14px] text-[var(--aura-text-primary,var(--aura-chrome-bright,#eae1db))] font-medium leading-snug line-clamp-2 font-body"
        >
          {item.name}
        </h3>
        <div className="flex items-center justify-between gap-1 mt-auto">
          <p className="text-[14px] text-[var(--aura-primary,var(--aura-chrome-light,#f2c08d))] font-semibold font-body">
            {formattedPrice}
          </p>
          {quantity > 0 ? (
            <div
              className="flex items-center gap-1 bg-[color-mix(in srgb,var(--aura-chrome-light,rgba(var(--aura-chrome-light),1)) 10%,transparent)] rounded-lg px-1 py-0.5"
              onClick={(e) => e.stopPropagation()}
            >
              <button
               type="button"
                onClick={(e) => { e.stopPropagation(); onRemove(); }}
                className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-md text-[var(--aura-text-primary,var(--aura-chrome-bright,#eae1db))] hover:bg-[color-mix(in srgb,var(--aura-chrome-light,rgba(var(--aura-chrome-light),1)) 15%,transparent)] transition-all active:scale-90"
                aria-label={t('posNew.decrementQuantity')}
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <span className="w-5 text-center text-[13px] text-[var(--aura-text-primary,var(--aura-chrome-bright,#eae1db))] font-medium font-body">
                {quantity}
              </span>
              <button
               type="button"
                onClick={(e) => { e.stopPropagation(); onAdd(); }}
                className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-md bg-[color-mix(in srgb,var(--aura-chrome-light,rgba(var(--aura-chrome-light),1)) 15%,transparent)] text-[var(--aura-primary,var(--aura-chrome-light,#f2c08d))] transition-all active:scale-90"
                aria-label={t('posNew.incrementQuantity')}
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
             type="button"
              onClick={(e) => { e.stopPropagation(); onAdd(); }}
              className="min-w-[36px] min-h-[36px] w-9 h-9 flex items-center justify-center rounded-lg bg-[color-mix(in srgb,var(--aura-chrome-light,rgba(var(--aura-chrome-light),1)) 8%,transparent)] text-[var(--aura-primary,var(--aura-chrome-light,#f2c08d))] hover:bg-[color-mix(in srgb,var(--aura-chrome-light,rgba(var(--aura-chrome-light),1)) 15%,transparent)] transition-all active:scale-90"
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
