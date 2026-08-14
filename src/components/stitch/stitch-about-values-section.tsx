'use client';

import { ICON_MAP } from './stitch-about-types';
import type { ValueCard } from './stitch-about-types';

/**
 * Values cards section for StitchAbout page.
 */
export function ValuesSection({ values }: { values: ValueCard[] }) {
  const getIcon = (key: keyof typeof ICON_MAP) => {
    const Icon = ICON_MAP[key];
    return Icon ? <Icon className="h-7 w-7" /> : null;
  };

  return (
    <section className="overflow-hidden px-[var(--aura-container-padding,24px)] py-24 md:py-32">
      <div className="mx-auto max-w-[1280px]">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {values.map((value) => (
            <div
              key={value.id}
              className="glass-card-about group flex flex-col items-center p-8 text-center md:p-12"
            >
              <div
                className="mb-8 flex h-16 w-16 items-center justify-center rounded-full border transition-colors duration-500 group-hover:border-[var(--aura-tertiary,#d4a574)]"
                style={{ borderColor: 'var(--aura-border-muted)' }}
              >
                <div
                  className="transition-colors duration-500 group-hover:text-[var(--aura-tertiary,#d4a574)]"
                  style={{ color: 'var(--aura-text-secondary, #a0a8b0)' }}
                >
                  {getIcon(value.icon)}
                </div>
              </div>
              <h3
                className="mb-4 uppercase tracking-widest text-white"
                style={{ fontFamily: 'var(--aura-font-display, "Libre Caslon Text", Georgia, serif)' }}
              >
                {value.title}
              </h3>
              <p
                className="text-sm font-light"
                style={{ color: 'var(--aura-text-secondary, #a0a8b0)' }}
              >
                {value.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
