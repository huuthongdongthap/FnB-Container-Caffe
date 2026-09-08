'use client';

import { useTranslation } from 'react-i18next';
import { ChevronDown } from 'lucide-react';

/**
 * Hero section for StitchAbout page.
 */
export function HeroSection({
  subtitle,
  title,
}: {
  subtitle: string;
  title: string;
}) {
  const { t } = useTranslation();
  return (
    <section className="relative flex min-h-[70vh] items-center justify-center overflow-hidden">
      <div className="absolute inset-0 z-0">
        <div
          className="absolute inset-0 z-10"
          style={{ backgroundColor: 'var(--aura-overlay)' }}
        />
        <div
          className="h-full w-full bg-cover bg-center"
          style={{
            backgroundImage:
              'url(/photos/IMG_6699.webp)',
          }}
        />
      </div>
      <div className="relative z-20 px-6 text-center">
        <span
          className="mb-6 block animate-pulse font-label-sm uppercase tracking-[0.4em]"
          style={{ color: 'var(--aura-text-secondary, #a0a8b0)' }}
        >
          {subtitle}
        </span>
        <h1
          className="mx-auto mb-8 max-w-5xl text-5xl font-medium leading-tight text-white md:text-8xl lg:text-9xl"
          style={{ fontFamily: 'var(--aura-font-display-serif, var(--aura-font-display))' }}
        >
          AURA CAFE{' '}
          <span className="italic" style={{ color: 'var(--aura-tertiary, #C9D6DF)' }}>
            {t('about.address')}
          </span>
        </h1>
        <div
          className="mx-auto h-px w-24 opacity-50"
          style={{ backgroundColor: 'var(--aura-text-secondary, #a0a8b0)' }}
        />
      </div>
      <div className="absolute bottom-10 left-1/2 flex -translate-x-1/2 flex-col items-center gap-4">
        <span
          className="font-label-sm uppercase tracking-widest opacity-60"
          style={{ color: 'var(--aura-text-secondary, #a0a8b0)' }}
        >
          Scroll to Explore
        </span>
        <ChevronDown
          className="h-5 w-5 animate-bounce"
          style={{ color: 'var(--aura-text-secondary, #a0a8b0)' }}
        />
      </div>
    </section>
  );
}
