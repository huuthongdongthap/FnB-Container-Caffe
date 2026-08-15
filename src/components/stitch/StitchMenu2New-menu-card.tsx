import { useTranslation } from 'react-i18next';
import { Check } from 'lucide-react';
import { MenuCardProps } from './StitchMenu2New-types';
import { GaugeBar } from './StitchMenu2New-gauge-bar';

export function MenuCard({ item, isAdded, onAddToOrder }: MenuCardProps) {
  const { t } = useTranslation();
  return (
    <article
      key={item.id}
      className="group relative flex h-full flex-col overflow-hidden border border-[#E5E4E2]/30 bg-[rgba(2,20,41,0.8)] backdrop-blur-[16px] transition-all duration-500 hover:shadow-[0_0_20px_rgba(229,228,226,0.05)]"
      aria-label={item.name}
    >
      {/* Badge */}
      {item.badge && (
        <div className="absolute left-4 top-4 z-10">
          <span className="bg-[#CD7F32] px-3 py-1 font-body text-[10px] font-semibold uppercase tracking-widest text-[var(--aura-bg-page, #0A1A2E)]">
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
          <h3 className="font-display text-[20px] leading-[28px] font-normal">
            {item.name}
          </h3>
          <span className="font-body text-sm font-medium text-[#c7c6c4]">
            {item.price}
          </span>
        </div>

        {/* Description */}
        <p className="mb-6 flex-grow font-body text-base leading-6 text-[#c4c6ce]/80">
          {item.description}
        </p>

        {/* Gauge Bar */}
        <GaugeBar label={item.gaugeLabel} value={item.gaugeValue} />

        {/* Add to Order */}
        <button
          onClick={() => onAddToOrder(item)}
          disabled={isAdded}
          aria-label={
            isAdded
              ? t('stitch.menu2.addedAria', { name: item.name })
              : t('stitch.menu2.addToOrderAria', { name: item.name })
          }
          className={`w-full py-3 font-body text-xs font-semibold uppercase tracking-widest transition-all active:scale-[0.98] ${
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
}
