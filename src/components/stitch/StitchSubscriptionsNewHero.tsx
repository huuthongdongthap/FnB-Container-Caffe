import { useTranslation } from 'react-i18next';

export function StitchSubscriptionsNewHero() {
  const { t } = useTranslation();

  return (
    <section className="mb-12 text-center">
      <span className="mb-4 block font-[family-name:var(--aura-body-font)] text-xs uppercase tracking-[0.1em] text-[var(--aura-bronze-shimmer)]">
        MEMBERSHIP PROGRAMS
      </span>
      <h2 className="mb-6 font-[family-name:var(--aura-display-font)] text-4xl text-[var(--aura-chrome-bright)] md:text-[64px] md:leading-[1.1] md:tracking-[-0.02em]">
        Precision Craft. <br />
        Exclusive Access.
      </h2>
      <p className="mx-auto max-w-xl font-[family-name:var(--aura-body-font)] text-lg text-[var(--aura-bronze-shimmer)] opacity-70">
        Experience the intersection of industrial grit and luxury hospitality with our curated subscription tiers.
      </p>
    </section>
  );
}
