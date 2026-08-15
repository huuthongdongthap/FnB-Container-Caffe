/**
 * Product card for AURA CAFE mobile ordering — glassmorphism with quantity controls.
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Minus, Coffee, Star } from 'lucide-react';
import type { MenuItem } from './StitchMobileOrderNew-types';

export function ProductCard({
  item,
  quantity,
  onAdd,
  onRemove,
}: Readonly<{
  item: MenuItem;
  quantity: number;
  onAdd: () => void;
  onRemove: () => void;
}>) {
  const { t } = useTranslation();
  const [imgError, setImgError] = useState(false);

  return (
    <article
      className="glass-panel rounded-xl overflow-hidden flex flex-col relative active:scale-[0.98] transition-transform"
      aria-label={t('stitch.ordering.productCardLabel', {
        name: item.name,
        price: item.priceLabel,
        defaultValue: `${item.name} — ${item.priceLabel}`,
      })}
    >
      {/* Image Section */}
      <div className="h-48 w-full relative">
        {imgError || !item.imageSrc ? (
          <div className="w-full h-full flex items-center justify-center bg-[rgba(198,198,199,0.05)]">
            <Coffee className="w-10 h-10 text-[rgba(198,198,199,0.2)]" />
          </div>
        ) : (
          <img
            className="w-full h-full object-cover"
            src={item.imageSrc}
            alt={item.imageAlt}
            onError={() => setImgError(true)}
            loading="lazy"
          />
        )}
        {item.badge && (
          <span
            className="absolute top-4 left-4 bg-[var(--aura-chrome-mid)] text-white px-3 py-1 rounded-sm font-body text-[11px] font-semibold tracking-wider uppercase shadow-xl"
            aria-label={t('stitch.ordering.badgeLabel', {
              badge: item.badge,
              defaultValue: `${item.badge}`,
            })}
          >
            {item.badge}
          </span>
        )}
      </div>

      {/* Content Section */}
      <div className="p-4 flex justify-between items-start">
        <div className="flex-1 pr-4">
          <div className="flex items-center gap-2">
            <h3 className="font-display text-[17px] text-[var(--aura-text-primary, #e8e8e8)] font-semibold leading-tight">
              {item.name}
            </h3>
            {item.featured && (
              <Star className="w-3.5 h-3.5 fill-[var(--aura-chrome-light)] text-[var(--aura-chrome-light)] flex-shrink-0" />
            )}
          </div>
          <p className="font-body text-[13px] text-[var(--aura-text-secondary, #a0a8b0)] mt-1.5 leading-relaxed line-clamp-2">
            {item.description}
          </p>
          <p className="font-body text-[20px] text-[var(--aura-primary, #c6c6c7)] font-bold mt-3 tracking-tight">
            {item.priceLabel}
          </p>
        </div>

        {/* Add / Quantity Controls */}
        <div className="flex-shrink-0">
          {quantity > 0 ? (
            <div className="flex items-center gap-2 bg-[rgba(198,198,199,0.1)] rounded-lg px-2 py-1">
              <button
                type="button"
                onClick={onRemove}
                className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-md text-[var(--aura-text-secondary, #a0a8b0)] hover:text-[var(--aura-primary, #c6c6c7)] hover:bg-[rgba(198,198,199,0.1)] transition-all active:scale-90"
                aria-label={t('stitch.ordering.removeItem', {
                  name: item.name,
                  defaultValue: `Remove one ${item.name}`,
                })}
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <span className="font-body text-[13px] text-[var(--aura-text-primary, #e8e8e8)] font-medium w-5 text-center">
                {quantity}
              </span>
              <button
                type="button"
                onClick={onAdd}
                className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-md text-[var(--aura-primary, #c6c6c7)] hover:bg-[rgba(198,198,199,0.15)] transition-all active:scale-90"
                aria-label={t('stitch.ordering.addItem', {
                  name: item.name,
                  defaultValue: `Add one ${item.name}`,
                })}
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={onAdd}
              className="w-10 h-10 rounded-full bg-[rgba(205,127,50,0.2)] flex items-center justify-center text-[var(--aura-chrome-mid)] shadow-lg shadow-[rgba(205,127,50,0.15)] active:scale-90 transition-transform"
              aria-label={t('stitch.ordering.addToCart', {
                name: item.name,
                defaultValue: `Add ${item.name} to cart`,
              })}
            >
              <Plus className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
