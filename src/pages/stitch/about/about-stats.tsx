import { STATS } from './about-constants';

export function AboutStats() {
  return (
    <section className="py-16 md:py-20 px-6 md:px-16 border-y border-[var(--aura-border-chrome)]/15">
      <div className="max-w-5xl mx-auto grid grid-cols-3 gap-8 md:gap-16">
        {STATS.map((stat) => (
          <div key={stat.value} className="text-center story-reveal opacity-0 translate-y-10 transition-all duration-700">
            <p className="font-display text-headline-md md:text-headline-lg text-[var(--aura-tertiary)]" style={{ fontStyle: 'italic' }}>
              {stat.value}
            </p>
            <p className="font-body text-body-sm text-[var(--aura-chrome-mid)] mt-2 uppercase tracking-wider">
              {stat.labelEn}
            </p>
            <p className="font-body text-body-sm text-[var(--aura-chrome-dark)] mt-1">
              {stat.labelVi}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
