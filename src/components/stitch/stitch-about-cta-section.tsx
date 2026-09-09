'use client';

import { useTranslation } from 'react-i18next';
import { ArrowRight } from 'lucide-react';

/**
 * CTA banner section for StitchAbout page.
 */
export function CtaSection({ onCtaClick }: { onCtaClick?: () => void }) {
  const { t } = useTranslation();
  return (
    <section className="px-[var(--aura-container-padding,24px)] py-32 text-center md:py-40">
      <div
        className="glass-card-about relative mx-auto max-w-4xl overflow-hidden p-12 md:p-24"
      >
        {/* Glow orbs */}
        <div
          className="absolute -left-24 -top-24 h-64 w-64 rounded-full blur-[100px]"
          style={{ backgroundColor: 'color-mix(in srgb, var(--aura-glass-border, #6b9fb8) 10%, transparent)' }}
        />
        <div
          className="absolute -bottom-24 -right-24 h-64 w-64 rounded-full blur-[100px]"
          style={{ backgroundColor: 'color-mix(in srgb, var(--aura-glass-border, #c9d6df) 10%, transparent)' }}
        />

        <h2
          className="mb-8 text-4xl text-white md:text-6xl md:leading-tight"
          style={{ fontFamily: 'var(--aura-font-display-serif, var(--aura-font-display))' }}
        >
          {t('about.visitTitle')}
        </h2>
        <p
          className="mx-auto mb-12 max-w-xl font-light leading-relaxed"
          style={{ color: 'var(--aura-text-secondary, #a0a8b0)' }}
        >
          39 Nguyen Tat Thanh, Sa Dec, Dong Thap. Where industrial container style meets premium coffee experience.
        </p>
        <button
         type="button"
          onClick={onCtaClick}
          className="mx-auto flex items-center gap-3 px-12 py-4 font-label-sm font-bold uppercase tracking-[0.2em] text-[var(--aura-noir-void)] shadow-xl transition-all duration-300 hover:bg-[var(--aura-tertiary,var(--aura-chrome-light,#C9D6DF))]"
          style={{ backgroundColor: 'var(--aura-tertiary, var(--aura-chrome-light, #C9D6DF))' }}
        >
          {t('about.exploreNow')}
          <ArrowRight className="h-5 w-5" />
        </button>
      </div>
    </section>
  );
}
