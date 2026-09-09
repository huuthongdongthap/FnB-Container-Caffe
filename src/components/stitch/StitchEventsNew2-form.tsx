/**
 * Past archives and footer section components for StitchEventsNew2.
 * Extracted from StitchEventsNew2.tsx to keep individual files under 200 LOC.
 */

'use client';

import { useTranslation } from 'react-i18next';
import type { ArchiveEvent2 } from './StitchEventsNew2-types';

/* ─── Past Archives ───────────────────────────────────────────── */

export function PastArchives({
  archives,
  onViewArchive,
}: {
  archives: ArchiveEvent2[];
  onViewArchive?: () => void;
}) {
  const { t } = useTranslation();
  return (
    <section
      className="border-t py-20"
      style={{ borderColor: 'color-mix(in srgb, var(--aura-border-chrome, #44474d) 10%, transparent)' }}
      aria-labelledby="past-archives-heading"
    >
      <div className="mx-auto max-w-[1280px] px-5 md:px-12">
        {/* Section heading */}
        <div className="mb-12 flex items-center gap-6">
          <h2
            id="past-archives-heading"
            className="text-[32px] leading-tight italic"
            style={{
              fontFamily: "var(--aura-font-display)",
              color: 'var(--aura-text-muted, #8e9097)',
            }}
          >
            {t('events.pastArchives')}
          </h2>
          <div className="h-px flex-grow" style={{ backgroundColor: 'color-mix(in srgb, var(--aura-border-chrome, #44474d) 30%, transparent)' }} />
        </div>

        {/* Archive items */}
        <div
          className="grid grid-cols-1 gap-6 transition-all duration-500 md:grid-cols-3"
          style={{ opacity: 0.6 }}
        >
          {archives.map((archive) => (
            <div
              key={archive.id}
              className="group flex items-center gap-4 rounded-lg p-4 transition-all duration-500 hover:opacity-100"
              style={{
                backgroundColor: 'color-mix(in srgb, var(--aura-glass-bg, #152031) 40%, transparent)',
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
                border: '0.5px solid color-mix(in srgb, var(--aura-glass-border, #c5c6cd) 15%, transparent)',
              }}
            >
              <div
                className="h-16 w-16 flex-shrink-0 rounded bg-cover grayscale transition-all duration-500"
                style={{ backgroundImage: `url(${archive.imageUrl})` }}
                role="img"
                aria-label={archive.imageAlt}
              />
              <div>
                <span
                  className="block font-label-caps text-[9px] uppercase tracking-wider"
                  style={{ color: 'var(--aura-text-muted, #8e9097)' }}
                >
                  {archive.monthLabel}
                </span>
                <h4
                  className="text-lg italic text-white"
                  style={{ fontFamily: "var(--aura-font-display)" }}
                >
                  {archive.title}
                </h4>
              </div>
            </div>
          ))}
        </div>

        {/* View all */}
        <div className="mt-12 text-center">
          <button
           type="button"
            onClick={onViewArchive}
            className="font-label-caps text-xs uppercase tracking-wider transition-all hover:underline"
            style={{ color: 'var(--aura-chrome-light, #efbd8a)' }}
            aria-label={t('events.viewFullArchive')}
          >
            {t('events.viewFullArchive')}
          </button>
        </div>
      </div>
    </section>
  );
}

/* ─── Footer ──────────────────────────────────────────────────── */

export function FooterSection({
  links,
  copyright,
}: {
  links: Array<{ key: string; label: string; href: string }>;
  copyright: string;
}) {
  const { t } = useTranslation();
  return (
    <footer
      className="w-full border-t py-12 md:py-16"
      style={{
        backgroundColor: 'var(--aura-bg-page, var(--aura-bg-surface))',
        borderColor: 'rgba(68,71,77,0.2)',
      }}
      aria-label={t('common.footer')}
    >
      <div className="mx-auto flex max-w-[1280px] flex-col items-center justify-between gap-6 px-5 md:flex-row md:px-12">
        {/* Brand */}
        <span
          className="text-[32px] italic tracking-tighter"
          style={{
            fontFamily: 'var(--aura-font-display-serif)',
            color: 'var(--aura-text-primary, #e8e8e8)',
          }}
        >
          AURA CAFE
        </span>

        {/* Links + copyright */}
        <div className="flex flex-col items-center gap-4 md:items-end">
          <div className="flex gap-6">
            {links.map((link) => (
              <a
                key={link.key}
                href={link.href}
                className="font-label-caps text-xs uppercase tracking-wider transition-colors hover:text-[var(--aura-chrome-light, #C9D6DF)]"
                style={{ color: 'var(--aura-text-secondary, #a0a8b0)' }}
                aria-label={link.label}
              >
                {link.label}
              </a>
            ))}
          </div>
          <p
            className="font-label-caps text-[10px] uppercase tracking-wider opacity-60"
            style={{ color: 'var(--aura-text-secondary, #a0a8b0)' }}
          >
            {copyright}
          </p>
        </div>
      </div>
    </footer>
  );
}
