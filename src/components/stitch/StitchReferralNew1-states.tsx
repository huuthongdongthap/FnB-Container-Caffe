'use client';

import { useTranslation } from 'react-i18next';
import { AlertCircle, Gift } from 'lucide-react';

/* ─── Loading Skeleton ─────────────────────────────────────────────── */

export function ReferralSkeleton() {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen bg-[var(--aura-surface-container)]">
      <div className="px-5 pb-32 pt-20" role="status" aria-label={t('stitch.referral.loadingAria')}>
        <div className="mb-10 mt-2">
          <div className="relative overflow-hidden rounded-xl p-6 text-center backdrop-blur-[20px]" style={{background: 'color-mix(in srgb, var(--aura-surface-container) 40%, transparent)'}}>
            <div className="mx-auto mb-1 h-4 w-24 animate-pulse rounded bg-[rgba(255,255,255,0.08)]" />
            <div className="mx-auto mb-1 h-12 w-44 animate-pulse rounded bg-[rgba(255,255,255,0.08)]" />
            <div className="mx-auto h-4 w-56 animate-pulse rounded bg-[rgba(255,255,255,0.08)]" />
          </div>
        </div>

        <div className="mb-10">
          <div className="flex flex-col gap-3">
            <div className="h-14 animate-pulse rounded-lg bg-[var(--aura-surface-container)]" />
            <div className="h-12 animate-pulse rounded-lg bg-[var(--aura-surface-container)]" />
          </div>
        </div>

        <div className="mb-10">
          <div className="mb-3 h-4 w-36 animate-pulse rounded bg-[rgba(255,255,255,0.08)]" />
          <div className="h-2 w-full animate-pulse rounded-full bg-white/5" />
        </div>

        <div className="flex flex-col gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 rounded-xl p-3" style={{background: 'color-mix(in srgb, var(--aura-surface-container) 40%, transparent)'}}>
              <div className="h-10 w-10 animate-pulse rounded-lg bg-[rgba(255,255,255,0.08)]" />
              <div className="flex-1 space-y-1">
                <div className="h-4 w-24 animate-pulse rounded bg-[rgba(255,255,255,0.08)]" />
                <div className="h-3 w-32 animate-pulse rounded bg-[rgba(255,255,255,0.08)]" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── Error State ──────────────────────────────────────────────────── */

export function ReferralError({ message }: { message: string }) {
  const { t } = useTranslation();
  return (
    <div
      className="flex min-h-[400px] flex-col items-center justify-center gap-4 rounded-xl p-8 text-center backdrop-blur-[20px]"
      style={{ background: 'color-mix(in srgb, var(--aura-surface-container) 40%, transparent)' }}
      role="alert"
      aria-live="assertive"
    >
      <AlertCircle className="h-12 w-12 text-[var(--aura-error)]" />
      <h3 className="font-display text-xl font-semibold text-[#d9e3f6]">
        {t('stitch.referral.errorTitle', { defaultValue: 'Something went wrong' })}
      </h3>
      <p className="text-[var(--aura-chrome-soft)]">{message}</p>
    </div>
  );
}

/* ─── Empty State ──────────────────────────────────────────────────── */

export function ReferralEmpty() {
  const { t } = useTranslation();
  return (
    <div
      className="flex min-h-[400px] flex-col items-center justify-center gap-4 rounded-xl p-8 text-center backdrop-blur-[20px]"
      style={{ background: 'color-mix(in srgb, var(--aura-surface-container) 40%, transparent)' }}
      role="status"
    >
      <Gift className="h-12 w-12 text-[var(--aura-chrome-dim)]" />
      <h3 className="font-display text-xl font-semibold text-[#d9e3f6]">
        {t('stitch.referral.emptyTitle', { defaultValue: 'No referrals yet' })}
      </h3>
      <p className="text-[var(--aura-chrome-soft)]">
        {t('stitch.referral.emptyDesc', { defaultValue: 'Share your code and start earning rewards.' })}
      </p>
    </div>
  );
}
