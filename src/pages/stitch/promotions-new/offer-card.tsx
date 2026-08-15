import type { CardOffer } from './types';

interface OfferCardProps {
  offer: CardOffer;
}

export function OfferCard({ offer }: OfferCardProps) {
  return (
    <div className={`glass-panel overflow-hidden group ${offer.isFullWidth ? 'md:col-span-2' : ''}`}>
      <div className="h-40 relative overflow-hidden">
        <img
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
          alt={offer.desc}
          src={offer.image}
        />
        {offer.badge ? (
          <div className="absolute top-4 left-4 bg-[var(--aura-tertiary)] text-primary-container px-2 py-1">
            <span className="font-label-caps text-label-caps uppercase">{offer.badge}</span>
          </div>
        ) : null}
      </div>
      <div className="p-4">
        <h4 className="font-headline-md text-headline-md text-on-background mb-1">{offer.title}</h4>
        <p className="font-body-sm text-body-sm text-on-surface-variant mb-3">{offer.desc}</p>
        <div className="h-[1px] bg-outline-variant/30 w-full mb-3" aria-hidden="true" />
        <div className="flex justify-between items-center">
          {offer.tag ? (
            <span className="font-label-caps text-label-caps text-[var(--aura-tertiary)]">{offer.tag}</span>
          ) : (
            <button type="button" className="px-8 py-3 border border-secondary text-secondary font-label-caps text-label-caps uppercase tracking-widest hover:bg-secondary hover:text-primary-container transition-colors">
              {offer.btnLabel ?? 'Details'}
            </button>
          )}
          {offer.iconAfter && (
            <span className="material-symbols-outlined text-[var(--aura-tertiary)]">{offer.iconAfter}</span>
          )}
        </div>
      </div>
    </div>
  );
}
