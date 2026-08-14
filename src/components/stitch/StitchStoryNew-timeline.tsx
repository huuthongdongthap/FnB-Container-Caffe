/**
 * StitchStoryNew-timeline — Vertical timeline section.
 *
 * Displays the three-phase evolutionary cycle with alternating left/right
 * layout, glass card images, and an active-phase indicator dot on the
 * vertical line.
 */

'use client';

import { useTranslation } from 'react-i18next';
import { timelinePhases } from './stitch-story-default';

/* ─── Phase Defaults ────────────────────────────────────────────────── */

const phaseTitleDefaults: Record<string, string> = {
  'storyNew.phase01Title': 'The Concept Blueprint',
  'storyNew.phase02Title': 'Structural Assembly',
  'storyNew.phase03Title': 'Activation',
};

const phaseDescDefaults: Record<string, string> = {
  'storyNew.phase01Desc':
    'Initial visioning of a cafe that exists at the intersection of container architecture and technical brewing precision.',
  'storyNew.phase02Desc':
    'Salvaging three high-cube containers and re-engineering them with reinforced frames and panoramic glass panels.',
  'storyNew.phase03Desc':
    'Aura Cafe opens its doors, establishing a new standard for the nocturnal coffee experience in the city center.',
};

/* ─── Timeline Section ──────────────────────────────────────────────── */

export function TimelineSection() {
  const { t } = useTranslation();

  return (
    <section className="py-32 bg-[var(--aura-surface-dim)] relative">
      <div className="max-w-[1280px] mx-auto px-[64px]">
        <div className="text-center mb-24">
          <h2
            className="text-[var(--aura-noir-void)] mb-4"
            style={{ fontFamily: "'Libre Caslon Text', serif", fontSize: '45px' }}
          >
            {t('storyNew.timelineTitle', { defaultValue: 'Evolutionary Cycle' })}
          </h2>
          <p className="text-[var(--aura-chrome-soft)] text-xs tracking-[0.3em] uppercase" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            {t('storyNew.timelineSubtitle', { defaultValue: 'From Prototype to Perfection' })}
          </p>
        </div>

        <div className="relative max-w-4xl mx-auto">
          {/* Vertical Line */}
          <div
            className="absolute left-1/2 -translate-x-1/2 top-0 bottom-0 w-px"
            style={{
              background:
                'linear-gradient(to bottom, transparent, var(--aura-chrome-soft) 15%, var(--aura-chrome-soft) 85%, transparent)',
            }}
          />

          {timelinePhases.map((phase, idx) => {
            const isLeft = idx % 2 === 0;
            return (
              <div
                key={phase.phase}
                className={`relative grid grid-cols-1 md:grid-cols-2 gap-16 mb-32 items-center ${idx === timelinePhases.length - 1 ? 'mb-0' : ''}`}
                data-reveal
              >
                {/* Text side */}
                <div className={isLeft ? 'md:text-right' : 'order-2 md:order-1 md:text-left'}>
                  <span
                    className="text-[var(--aura-chrome-bright)] font-bold text-xs tracking-widest block mb-2"
                    style={{ fontFamily: "'Space Grotesk', sans-serif" }}
                  >
                    {`${phase.phase}: ${phase.year}`}
                  </span>
                  <h4 className="text-white text-2xl font-semibold mb-4" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                    {t(phase.title, { defaultValue: phaseTitleDefaults[phase.title] })}
                  </h4>
                  <p className="text-[var(--aura-chrome-soft)] text-sm" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                    {t(phase.description, { defaultValue: phaseDescDefaults[phase.description] })}
                  </p>
                </div>

                {/* Image side with dot */}
                <div
                  className={`flex items-center relative ${isLeft ? 'md:order-2 justify-start md:justify-center' : 'order-1 justify-start md:justify-center'}`}
                >
                  {/* Timeline dot */}
                  <div
                    className="w-4 h-4 absolute z-10 rounded-full border-4 border-[var(--aura-surface-container)] -left-[8.5px] md:left-auto md:right-auto"
                    style={{
                      backgroundColor: phase.isActive ? 'var(--aura-chrome-bright)' : 'var(--aura-surface-dim)',
                      boxShadow: phase.isActive ? '0 0 15px color-mix(in srgb, var(--aura-chrome-bright), transparent 50%)' : 'none',
                    }}
                    aria-hidden="true"
                  />
                  <div
                    className="p-6 w-full ml-8 md:ml-0"
                    style={{
                      background: 'rgba(255, 255, 255, 0.05)',
                      backdropFilter: 'blur(20px)',
                      border: phase.isActive
                        ? '1px solid color-mix(in srgb, var(--aura-chrome-bright), transparent 70%)'
                        : '1px solid color-mix(in srgb, var(--aura-chrome-dim), transparent 80%)',
                    }}
                  >
                    <img
                      className={`w-full h-32 object-cover ${!phase.isActive ? 'opacity-50 grayscale' : ''}`}
                      src={phase.imageUrl}
                      alt={phase.imageAlt}
                      loading="lazy"
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
