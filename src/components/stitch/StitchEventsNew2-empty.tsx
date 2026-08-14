/**
 * Loading skeleton, error, and empty state components for StitchEventsNew2.
 * Extracted from StitchEventsNew2.tsx to keep individual files under 200 LOC.
 */

'use client';

import { useTranslation } from 'react-i18next';

/* ─── Loading Skeleton ─────────────────────────────────────────── */

export function EventsNew2Skeleton() {
  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--aura-bg-page, #0A1A2E)' }}>
      {/* Nav skeleton */}
      <div className="fixed top-0 z-50 flex h-20 w-full items-center border-b px-6" style={{ backgroundColor: 'rgba(8,20,37,0.8)', borderColor: 'rgba(68,71,77,0.2)' }}>
        <div className="mx-auto flex w-full max-w-[1280px] items-center justify-between">
          <div className="h-8 w-32 animate-pulse rounded" style={{ backgroundColor: '#2a3548' }} />
          <div className="hidden h-12 w-28 animate-pulse rounded-lg md:block" style={{ backgroundColor: '#2a3548' }} />
        </div>
      </div>

      {/* Hero skeleton */}
      <div className="mx-auto max-w-[1280px] px-6 pt-24">
        <div className="mb-16 min-h-[500px] rounded-xl p-12" style={{ backgroundColor: '#152031' }}>
          <div className="mx-auto max-w-lg space-y-4">
            <div className="h-4 w-24 animate-pulse rounded" style={{ backgroundColor: '#2a3548' }} />
            <div className="h-12 w-3/4 animate-pulse rounded" style={{ backgroundColor: '#2a3548' }} />
            <div className="h-4 w-full animate-pulse rounded" style={{ backgroundColor: '#2a3548' }} />
            <div className="h-4 w-1/2 animate-pulse rounded" style={{ backgroundColor: '#2a3548' }} />
            <div className="flex gap-4">
              <div className="h-12 w-36 animate-pulse rounded-lg" style={{ backgroundColor: '#2a3548' }} />
              <div className="h-12 w-36 animate-pulse rounded-lg" style={{ backgroundColor: '#2a3548' }} />
            </div>
          </div>
        </div>

        {/* Grid skeleton */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-96 animate-pulse rounded-xl" style={{ backgroundColor: '#152031' }} />
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── Error State ──────────────────────────────────────────────── */

export function EventsNew2Error({ message }: { message: string }) {
  const { t } = useTranslation();
  return (
    <div
      className="flex min-h-[400px] flex-col items-center justify-center gap-4 rounded-xl p-8 text-center"
      style={{ backgroundColor: 'var(--aura-bg-surface, #071c33)' }}
    >
      <svg className="h-12 w-12" viewBox="0 0 24 24" fill="none" stroke="#ffb4ab" strokeWidth={1.5} aria-hidden="true">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 8v4M12 16h.01" />
      </svg>
      <h3
        className="text-xl font-semibold italic"
        style={{
          fontFamily: "var(--aura-font-display)",
          color: 'var(--aura-text-primary, #e8e8e8)',
        }}
      >
        {t('events.unableToLoad')}
      </h3>
      <p style={{ color: 'var(--aura-text-secondary, #a0a8b0)' }}>{message}</p>
      <button
        type="button"
        className="mt-2 rounded-lg border px-6 py-2 font-label-caps text-xs uppercase tracking-wider transition-all hover:bg-white/10"
        style={{ borderColor: 'var(--aura-primary, #c6c6c7)', color: 'var(--aura-primary, #c6c6c7)' }}
        aria-label={t('events.retry')}
      >
        {t('events.retry')}
      </button>
    </div>
  );
}

/* ─── Empty State ──────────────────────────────────────────────── */

export function EventsNew2Empty() {
  const { t } = useTranslation();
  return (
    <div
      className="flex min-h-[400px] flex-col items-center justify-center gap-4 rounded-xl p-8 text-center"
      style={{ backgroundColor: 'var(--aura-bg-surface, #071c33)' }}
    >
      <svg className="h-12 w-12" viewBox="0 0 24 24" fill="none" stroke="#5a6270" strokeWidth={1.5} aria-hidden="true">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
        <path d="M16 2v4M8 2v4M3 10h18" />
      </svg>
      <h3
        className="text-xl font-semibold italic"
        style={{
          fontFamily: "var(--aura-font-display)",
          color: 'var(--aura-text-primary, #e8e8e8)',
        }}
      >
        {t('events.noUpcomingEvents')}
      </h3>
      <p style={{ color: 'var(--aura-text-secondary, #a0a8b0)' }}>{t('events.checkBackSoon')}</p>
    </div>
  );
}
