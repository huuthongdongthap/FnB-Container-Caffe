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
              'url(https://lh3.googleusercontent.com/aida-public/AB6AXuACV1Udt-Hrc1M1LgOPzS7v8AzKj9LY37FvF84qcsl1xnhN5UpzbjAL7YECy1F2462ZGEk_OP-7A8hik2pOP99Nojnf51y7Mb9IXjGQlTQSBeym9fR_cxzw_ny6yQEcG98L50URyngya9UOMRkc7u4sVMPyLbRdY_AX2IBE_yf7BLinia4L9wIYd3OwmyUkxasutf0d7CdGedJ3TmOVNoAzkuqjCqp37ucfYgkbSivwlE_Pm9uErwenNM_ZOMrcNHe0Ix1egPArFyo)',
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
          style={{ fontFamily: 'var(--aura-font-display-serif, "EB Garamond", Georgia, serif)' }}
        >
          AURA CAFE{' '}
          <span className="italic" style={{ color: 'var(--aura-tertiary, #d4a574)' }}>
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
