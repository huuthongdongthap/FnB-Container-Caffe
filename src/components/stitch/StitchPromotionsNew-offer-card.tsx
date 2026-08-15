/**
 * Three offer card variants for the AURA CAFE promotions page:
 * - StandardOfferCard: image + badge + schedule + arrow
 * - ExclusiveOfferCard: image + glass badge + locked members-only
 * - FullWidthOfferCard: horizontal layout with tags and CTA
 */
import { ArrowRight, Lock } from 'lucide-react';
import type { PromoOffer } from './StitchPromotionsNew-types';
import { GlassCard } from './StitchPromotionsNew-glass-card';

/* ─── Standard Card ────────────────────────────────────────────── */

export function StandardOfferCard({ offer }: { offer: PromoOffer }) {
  return (
    <GlassCard className="group overflow-hidden">
      <div className="relative h-40 overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
          src={offer.imageUrl}
          alt={offer.imageAlt}
        />
        {offer.badge && (
          <div className="absolute left-4 top-4 bg-[var(--aura-bronze-shimmer)] px-2 py-1">
            <span className="font-[family-name:var(--aura-body-font)] text-xs uppercase text-[var(--aura-surface-dim)]">
              {offer.badge.label}
            </span>
          </div>
        )}
      </div>
      <div className="p-6">
        <h4 className="mb-1 font-[family-name:var(--aura-display-font)] text-2xl text-[var(--aura-chrome-bright)]">
          {offer.title}
        </h4>
        <p className="mb-6 font-[family-name:var(--aura-body-font)] text-sm text-[var(--aura-chrome-soft)]">
          {offer.description}
        </p>
        <div className="mb-6 h-px w-full bg-[var(--aura-chrome-soft)]/30" />
        <div className="flex items-center justify-between">
          {offer.schedule && (
            <span className="font-[family-name:var(--aura-body-font)] text-xs text-[var(--aura-bronze-shimmer)]">
              {offer.schedule}
            </span>
          )}
          <ArrowRight className="text-[var(--aura-chrome-bright)]" size={20} />
        </div>
      </div>
    </GlassCard>
  );
}

/* ─── Exclusive / Locked Card ──────────────────────────────────── */

export function ExclusiveOfferCard({ offer }: { offer: PromoOffer }) {
  return (
    <GlassCard className="group overflow-hidden">
      <div className="relative h-40 overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
          src={offer.imageUrl}
          alt={offer.imageAlt}
        />
        {offer.badge && (
          <div className="absolute right-4 top-4 border border-[var(--aura-chrome-soft)]/50 bg-[var(--aura-chrome-soft)]/20 px-2 py-1 backdrop-blur-md">
            <span className="font-[family-name:var(--aura-body-font)] text-xs uppercase text-[var(--aura-chrome-bright)]">
              {offer.badge.label}
            </span>
          </div>
        )}
      </div>
      <div className="p-6">
        <h4 className="mb-1 font-[family-name:var(--aura-display-font)] text-2xl text-[var(--aura-chrome-bright)]">
          {offer.title}
        </h4>
        <p className="mb-6 font-[family-name:var(--aura-body-font)] text-sm text-[var(--aura-chrome-soft)]">
          {offer.description}
        </p>
        <div className="mb-6 h-px w-full bg-[var(--aura-chrome-soft)]/30" />
        <div className="flex items-center justify-between">
          <span className="font-[family-name:var(--aura-body-font)] text-xs text-[var(--aura-bronze-shimmer)]">
            MEMBERS ONLY
          </span>
          <Lock className="text-[var(--aura-chrome-bright)]" size={20} />
        </div>
      </div>
    </GlassCard>
  );
}

/* ─── Full-Width Card (horizontal on md+) ──────────────────────── */

export function FullWidthOfferCard({ offer }: { offer: PromoOffer }) {
  return (
    <GlassCard className="group overflow-hidden md:col-span-2">
      <div className="flex flex-col md:flex-row">
        <div className="relative h-48 overflow-hidden md:h-auto md:w-1/3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
            src={offer.imageUrl}
            alt={offer.imageAlt}
          />
        </div>
        <div className="flex-1 p-6">
          <h4 className="mb-1 font-[family-name:var(--aura-display-font)] text-2xl text-[var(--aura-chrome-bright)]">
            {offer.title}
          </h4>
          <p className="mb-6 font-[family-name:var(--aura-body-font)] text-sm text-[var(--aura-chrome-soft)]">
            {offer.description}
          </p>
          {offer.tags && (
            <div className="mb-6 flex flex-wrap gap-2">
              {offer.tags.map((tag) => (
                <span
                  key={tag}
                  className="border border-[var(--aura-chrome-soft)]/50 bg-[var(--aura-surface-container)] px-3 py-1 font-[family-name:var(--aura-body-font)] text-[10px] text-[var(--aura-chrome-soft)]"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
          <button
            type="button"
            className="border border-[var(--aura-chrome-bright)] px-8 py-3 font-[family-name:var(--aura-body-font)] text-xs uppercase tracking-widest text-[var(--aura-chrome-bright)] transition-colors hover:bg-[var(--aura-chrome-bright)] hover:text-[var(--aura-surface-dim)]"
          >
            Details
          </button>
        </div>
      </div>
    </GlassCard>
  );
}
