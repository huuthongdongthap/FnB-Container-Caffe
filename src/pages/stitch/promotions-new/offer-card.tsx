import { CreditCard, Truck, Building2, Gift, Sparkles, ArrowRight } from 'lucide-react';
import type { CardOffer } from './types';

interface OfferCardProps {
  offer: CardOffer;
}

export function OfferCard({ offer }: OfferCardProps) {
  const getOfferIcon = (id: number) => {
    switch (id) {
      case 1:
        return <Gift className="w-5 h-5 text-[var(--aura-bronze-shimmer,#C9A96E)]" />;
      case 2:
        return <CreditCard className="w-5 h-5 text-[var(--aura-bronze-shimmer,#C9A96E)]" />;
      case 3:
        return <Truck className="w-5 h-5 text-[#4A7C59]" />;
      case 4:
      default:
        return <Building2 className="w-5 h-5 text-[var(--aura-chrome-bright,#E8EEF3)]" />;
    }
  };

  return (
    <article
      className={`rounded-2xl overflow-hidden group transition-all duration-500 hover:-translate-y-1 hover:shadow-[0_12px_32px_rgba(0,0,0,0.4)] flex flex-col justify-between ${
        offer.isFullWidth ? 'md:col-span-2' : ''
      }`}
      style={{
        background: 'rgba(11, 32, 56, 0.45)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: '1px solid rgba(201, 214, 223, 0.14)',
      }}
    >
      <div>
        {/* Visual area — High Definition Photography with Dark Glass Overlay */}
        <div className={`relative overflow-hidden ${offer.isFullWidth ? 'h-64 md:h-72' : 'h-52'}`}>
          <img
            src={offer.image}
            alt={offer.title}
            className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
            loading="lazy"
          />

          {/* Vignette & Gradient Overlay for Contrast */}
          <div
            className="absolute inset-0"
            style={{
              background:
                'linear-gradient(to top, rgba(10,26,46,0.92) 0%, rgba(10,26,46,0.3) 50%, rgba(10,26,46,0.15) 100%)',
            }}
            aria-hidden="true"
          />

          {/* Top-left Badge */}
          {offer.badge && (
            <div
              className="absolute top-4 left-4 px-3.5 py-1.5 rounded-full text-[11px] font-bold tracking-[0.14em] uppercase shadow-lg backdrop-blur-md flex items-center gap-1.5"
              style={{
                background: 'rgba(10, 26, 46, 0.85)',
                border: '1px solid var(--aura-bronze-shimmer, #C9A96E)',
                color: 'var(--aura-bronze-shimmer, #C9A96E)',
              }}
            >
              <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{offer.badge}</span>
            </div>
          )}

          {/* Top-right Icon Pill */}
          <div
            className="absolute top-4 right-4 w-10 h-10 rounded-full flex items-center justify-center backdrop-blur-md shadow-md"
            style={{
              background: 'rgba(10, 26, 46, 0.75)',
              border: '1px solid rgba(201, 214, 223, 0.2)',
            }}
          >
            {getOfferIcon(offer.id)}
          </div>
        </div>

        {/* Card Body */}
        <div className="p-6">
          <h4
            className="text-xl font-semibold mb-2.5 leading-snug tracking-tight"
            style={{
              color: 'var(--aura-chrome-bright, #E8EEF3)',
              fontFamily: 'var(--aura-font-display)',
            }}
          >
            {offer.title}
          </h4>
          <p
            className="text-sm leading-relaxed mb-6 font-light"
            style={{ color: 'var(--aura-chrome-soft, rgba(232,238,243,0.78))' }}
          >
            {offer.desc}
          </p>
        </div>
      </div>

      {/* Card Footer */}
      <div className="px-6 pb-6 pt-0">
        <div
          className="h-px w-full mb-4"
          style={{ background: 'rgba(201,214,223,0.1)' }}
          aria-hidden="true"
        />

        <div className="flex justify-between items-center">
          {offer.tag ? (
            <span
              className="text-xs font-bold uppercase tracking-[0.15em] flex items-center gap-1.5"
              style={{ color: 'var(--aura-bronze-shimmer, #C9A96E)' }}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--aura-bronze-shimmer,#C9A96E)] animate-pulse" />
              {offer.tag}
            </span>
          ) : (
            <span />
          )}

          <a
            href={offer.id === 4 ? '/gallery' : '/menu'}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-semibold uppercase tracking-[0.12em] transition-all active:scale-95 hover:brightness-110 shadow-md group/btn"
            style={{
              background: 'linear-gradient(135deg, #C9A96E 0%, #E2D4B7 50%, #C9A96E 100%)',
              color: '#0A1A2E',
            }}
          >
            <span>{offer.btnLabel ?? 'Khám phá ngay'}</span>
            <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover/btn:translate-x-0.5" />
          </a>
        </div>
      </div>
    </article>
  );
}
