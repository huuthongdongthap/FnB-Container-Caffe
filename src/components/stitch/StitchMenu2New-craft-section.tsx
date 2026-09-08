import { useTranslation } from 'react-i18next';

export function CraftSection() {
  const { t } = useTranslation();
  return (
    <section
      className="relative overflow-hidden border border-[var(--aura-chrome-bright,#E5E4E2)]/30 bg-[color-mix(in srgb,var(--aura-glass-bg,rgba(var(--aura-glass-bg),1)) 80%,transparent)] backdrop-blur-[16px] p-12 md:p-24"
      aria-label={t('stitch.menu2.craftSectionAriaLabel')}
    >
      <div className="relative z-10 max-w-2xl">
        <span className="mb-6 block font-body text-[12px] font-semibold uppercase tracking-[0.5em] text-[var(--aura-chrome-mid,#CD7F32)]">
          {t('stitch.menu2.craftSubtitle')}
        </span>
        <h2 className="mb-8 font-display text-[clamp(2rem,6vw,3rem)] italic leading-tight">
          {t('stitch.menu2.craftHeading')}
        </h2>
        <p className="mb-12 font-body text-[18px] leading-[28px] font-light text-[var(--aura-text-body,#c4c6ce)]">
          {t('stitch.menu2.craftDescription')}
        </p>

        {/* Stats */}
        <div className="flex gap-8">
          <div className="flex flex-col">
            <span className="font-display text-[clamp(2rem,5vw,2.5rem)] text-[var(--aura-chrome-mid,#CD7F32)]">
              {t('stitch.menu2.filterMicron')}
            </span>
            <span className="font-body text-sm font-medium uppercase tracking-widest text-[var(--aura-text-muted,#8e9097)]">
              {t('stitch.menu2.micronFilter')}
            </span>
          </div>
          <div className="flex flex-col">
            <span className="font-display text-[clamp(2rem,5vw,2.5rem)] text-[var(--aura-chrome-mid,#CD7F32)]">
              {t('stitch.menu2.brewTempValue')}
            </span>
            <span className="font-body text-sm font-medium uppercase tracking-widest text-[var(--aura-text-muted,#8e9097)]">
              {t('stitch.menu2.brewTempLabel')}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
