'use client';

import { useTranslation } from 'react-i18next';
import type { Zone } from './stitch-about-types';

/**
 * Zones/spaces grid section for StitchAbout page.
 */
export function ZonesSection({
  zones,
  onZoneClick,
}: {
  zones: Zone[];
  onZoneClick?: (id: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <section
      className="px-[var(--aura-container-padding,24px)] py-24 md:py-32"
      style={{ backgroundColor: 'var(--aura-bg-surface, #0d1b2a)' }}
    >
      <div className="mx-auto max-w-[1280px]">
        <div className="mb-16 flex flex-col items-end justify-between gap-8 md:flex-row md:mb-24">
          <div>
            <h2
              className="mb-4 text-4xl md:text-5xl"
              style={{
                color: 'var(--aura-text-primary, #e8e8e8)',
                fontFamily: 'var(--aura-font-display, "Libre Caslon Text", Georgia, serif)',
              }}
            >
              {t('about.spacesTitle')}
            </h2>
            <p
              className="max-w-md"
              style={{ color: 'var(--aura-text-secondary, #a0a8b0)' }}
            >
              {t('about.spacesDesc')}
            </p>
          </div>
          <div
            className="hidden h-px w-64 md:block"
            style={{ backgroundColor: 'var(--aura-border-muted)' }}
          />
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
          {zones.map((zone) => (
            <div
              key={zone.id}
              className="group cursor-pointer"
              onClick={() => onZoneClick?.(zone.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') onZoneClick?.(zone.id);
              }}
              role="button"
              tabIndex={0}
              aria-label={`Explore ${zone.name}`}
            >
              <div className="glass-card-about relative mb-6 aspect-fable-5 overflow-hidden">
                <img
                  className="h-full w-full object-cover grayscale transition-all duration-500 group-hover:scale-105 group-hover:grayscale-0"
                  src={zone.imageUrl}
                  alt={zone.imageAlt}
                  loading="lazy"
                />
              </div>
              <h4
                className="mb-1 text-lg font-bold tracking-tight text-white"
                style={{ fontFamily: 'var(--aura-font-body, "Space Grotesk", system-ui, sans-serif)' }}
              >
                {zone.name}
              </h4>
              <p
                className="font-label-sm font-bold uppercase tracking-widest"
                style={{ color: 'var(--aura-tertiary, #d4a574)' }}
              >
                {zone.role}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
