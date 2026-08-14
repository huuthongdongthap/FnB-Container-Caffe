'use client';

import { useTranslation } from 'react-i18next';
import { clsx } from 'clsx';
import type { TimelinePhase } from './stitch-about-types';

/**
 * Vertical timeline section for StitchAbout page.
 */
export function TimelineSection({ phases }: { phases: TimelinePhase[] }) {
  const { t } = useTranslation();
  return (
    <section
      className="relative py-24 md:py-32"
      style={{ backgroundColor: 'var(--aura-bg-surface, #0d1b2a)' }}
    >
      <div className="mx-auto max-w-[1280px] px-[var(--aura-container-padding,24px)]">
        <div className="mb-16 text-center md:mb-24">
          <h2
            className="mb-4 text-4xl md:text-5xl"
            style={{
              color: 'var(--aura-text-primary, #e8e8e8)',
              fontFamily: 'var(--aura-font-display, "Libre Caslon Text", Georgia, serif)',
            }}
          >
            {t('about.timelineTitle')}
          </h2>
          <p
            className="font-label-sm uppercase tracking-[0.3em]"
            style={{ color: 'var(--aura-text-secondary, #a0a8b0)' }}
          >
            {t('about.timelineDesc')}
          </p>
        </div>

        <div className="relative mx-auto max-w-4xl">
          {/* Vertical line */}
          <div
            className="timeline-line-about absolute left-1/2 top-0 -translate-x-1/2 bottom-0 w-px"
          />

          {phases.map((phase, idx) => {
            const isLeft = idx % 2 === 0;
            return (
              <div
                key={phase.id}
                className={clsx(
                  'relative mb-20 grid grid-cols-1 items-center gap-8 md:mb-32 md:grid-cols-2 md:gap-16',
                  idx === phases.length - 1 && 'mb-0',
                )}
              >
                {/* Text side */}
                <div className={clsx(!isLeft && 'md:order-2', isLeft ? 'md:text-right' : 'md:text-left')}>
                  <span
                    className="mb-2 block font-label-sm font-bold tracking-widest"
                    style={{ color: 'var(--aura-tertiary, #d4a574)' }}
                  >
                    {phase.phase}: {phase.year}
                  </span>
                  <h4
                    className="mb-4 text-2xl font-semibold text-white"
                    style={{ fontFamily: 'var(--aura-font-display, "Libre Caslon Text", Georgia, serif)' }}
                  >
                    {phase.title}
                  </h4>
                  <p
                    className="text-sm"
                    style={{ color: 'var(--aura-text-secondary, #a0a8b0)' }}
                  >
                    {phase.description}
                  </p>
                </div>

                {/* Image side */}
                <div
                  className={clsx(
                    'relative flex items-center',
                    isLeft ? 'justify-start md:justify-center' : 'justify-end md:justify-center',
                  )}
                >
                  {/* Dot */}
                  <div
                    className={clsx(
                      'absolute z-10 h-4 w-4 rounded-full border-4',
                      isLeft ? '-left-[8.5px] md:left-auto' : '-left-[8.5px] md:right-auto',
                      phase.isActive
                        ? 'border-[var(--aura-tertiary,#d4a574)]'
                        : 'border-[var(--aura-bg-page,#0A1A2E)]',
                    )}
                    style={{
                      backgroundColor: phase.isActive ? 'var(--aura-tertiary, #d4a574)' : 'var(--aura-bg-page, #0A1A2E)',
                      boxShadow: phase.isActive ? '0 0 15px rgba(107, 159, 184, 0.5)' : 'none',
                    }}
                  />
                  <div
                    className={clsx(
                      'glass-card-about w-full p-4 md:p-6',
                      isLeft ? 'ml-8 md:ml-0' : 'ml-8 md:ml-0',
                      phase.isActive && 'border-tertiary/30',
                    )}
                  >
                    <img
                      className={clsx(
                        'h-28 w-full object-cover md:h-32',
                        !phase.isActive && 'opacity-50 grayscale',
                      )}
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
