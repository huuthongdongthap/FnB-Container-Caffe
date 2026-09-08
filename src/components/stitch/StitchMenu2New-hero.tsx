import { useTranslation } from 'react-i18next';
import { HeroProps } from './StitchMenu2New-types';
import { CATEGORIES } from './StitchMenu2New-data';

export function Hero({ activeCategory, onCategoryChange }: HeroProps) {
  const { t } = useTranslation();
  return (
    <section className="mb-16" aria-label={t('stitch.menu2.heroAriaLabel')}>
      <div className="mb-12 flex flex-col justify-between gap-8 md:flex-row md:items-end">
        <div>
          <span className="mb-4 block font-body text-[12px] font-semibold uppercase tracking-[0.4em] text-[var(--aura-chrome-mid,#CD7F32)]">
            {t('stitch.menu2.heroSubtitle')}
          </span>
          <h1 className="font-display text-[clamp(2.25rem,8vw,3rem)] leading-tight md:text-[48px] md:leading-[56px] md:tracking-[-0.02em]">
            {t('stitch.menu2.heroTitle')}
          </h1>
        </div>

        {/* Category Filters */}
        <div
          className="flex flex-wrap gap-3"
          role="tablist"
          aria-label={t('stitch.menu2.filterAriaLabel')}
        >
          {CATEGORIES.map((cat) => {
            const isActive = activeCategory === cat.key;
            return (
              <button
                key={cat.key}
                role="tab"
                aria-selected={isActive}
                onClick={() => onCategoryChange(cat.key)}
                className={`rounded-sm border px-6 py-2 font-body text-sm font-medium transition-all ${
                  isActive
                    ? 'border-[var(--aura-chrome-mid,#CD7F32)]/50 bg-[color-mix(in_srgb,var(--aura-glass-bg)_80%,transparent)] text-[var(--aura-chrome-mid,#CD7F32)] shadow-[0_0_8px_color-mix(in_srgb,var(--aura-chrome-mid,#CD7F32)_10%,transparent)] backdrop-blur-[16px]'
                    : 'border-[var(--aura-chrome-bright,#E5E4E2)]/30 bg-[color-mix(in_srgb,var(--aura-glass-bg)_80%,transparent)] text-[var(--aura-text-body,#c7c6c4)] backdrop-blur-[16px] hover:text-[var(--aura-text-primary,var(--aura-chrome-bright,#e8e8e8))]'
                }`}
              >
                {cat.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Divider */}
      <div className="mb-16 h-px w-full bg-[var(--aura-text-body,#c7c6c4)]/20" />
    </section>
  );
}
