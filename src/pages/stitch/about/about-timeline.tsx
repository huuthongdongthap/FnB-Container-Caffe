import { TIMELINE_STEPS } from './about-constants';

export function AboutTimeline() {
  return (
    <section id="story" className="py-24 md:py-32 px-6 md:px-16 bg-[var(--aura-noir-deep)]">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-20">
          <span className="font-label-caps text-[var(--aura-chrome-dark)] tracking-[0.3em] uppercase block mb-4 text-xs">
            Process — Quy Trình
          </span>
          <h2 className="font-display text-display-lg text-[var(--aura-tertiary)]" style={{ fontStyle: 'italic' }}>
            Craftsmanship
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {TIMELINE_STEPS.map((step, index) => (
            <div
              key={step.titleEn}
              className="story-reveal opacity-0 translate-y-10 transition-all duration-700"
              style={{ transitionDelay: `${index * 150}ms` }}
            >
              <div className="glass-panel p-8 md:p-10 text-center h-full flex flex-col items-center">
                {/* Icon */}
                <span className="text-4xl md:text-5xl mb-6 block" aria-hidden="true">
                  {step.icon}
                </span>

                {/* Step number */}
                <span className="font-label-caps text-[var(--aura-chrome-dark)] tracking-[0.2em] text-[10px] uppercase block mb-4">
                  Step {String(index + 1).padStart(2, '0')}
                </span>

                {/* Titles */}
                <h3 className="font-display text-title-lg text-[var(--aura-chrome-bright)] mb-2">
                  {step.titleEn}
                </h3>
                <p className="font-body text-body-sm text-[var(--aura-tertiary)] uppercase tracking-wider mb-6">
                  {step.titleVi}
                </p>

                {/* Divider */}
                <div className="w-12 h-px bg-[var(--aura-tertiary)]/30 mb-6" aria-hidden="true" />

                {/* Description */}
                <p className="font-body text-body-sm text-[var(--aura-chrome-mid)] leading-relaxed font-light flex-1">
                  {step.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
