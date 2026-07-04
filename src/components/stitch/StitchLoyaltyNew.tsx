/**
 * StitchLoyaltyNew — AURA CAFE Loyalty & Rewards Dashboard (Stitch design, New version)
 *
 * Dark navy glassmorphism loyalty dashboard with platinum tier hero card,
 * points balance, bronze-gradient progress bar, rewards grid, points history
 * table, weekly check-in streak, referral block, and tier benefits list.
 * Mobile-first responsive. Named export.
 * Source: Stitch AI aura_cafe_loyalty_rewards_dashboard/code.html export.
 *
 * Pixel-perfect alignment with the original Stitch HTML:
 * - Colors: #051424 bg, #d5e4fa text, #d8c2b2 secondary, #ffb779 gold
 * - Glass panels: rgba(40,54,71,0.4) + blur(24px) + full border
 * - Platinum card: blur(32px) border + bronze glow
 * - Parallax tilt on glass cards
 */
'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useTranslation, Trans } from 'react-i18next';

/* ─── Types ────────────────────────────────────────────────────────── */

export interface LoyaltyRewardItem {
  id: string;
  title: string;
  pointsCost: number;
  imageUrl: string;
  imageAlt: string;
}

export interface LoyaltyHistoryEntry {
  id: string;
  activity: string;
  date: string;
  status: 'completed' | 'pending' | 'expired';
  points: number;
}

export interface LoyaltyStreakDay {
  label: string;
  checked: boolean;
}

export interface LoyaltyTierBenefit {
  label: string;
}

export interface LoyaltyDashboardData {
  tierName: string;
  memberSince: string;
  tierDescription: string;
  nextTier: string;
  pointsRemainingForNextTier: number;
  progressPercent: number;
  pointsBalance: number;
  streakCount: number;
  referralCode: string;
  rewards: LoyaltyRewardItem[];
  pointsHistory: LoyaltyHistoryEntry[];
  streakDays: LoyaltyStreakDay[];
  tierBenefits: LoyaltyTierBenefit[];
}

export type LoyaltyLoadingState = 'idle' | 'loading' | 'error';

export interface StitchLoyaltyNewProps {
  data?: LoyaltyDashboardData;
  loadingState?: LoyaltyLoadingState;
  errorMessage?: string;
  onRedeemPoints?: () => void;
  onClaimReward?: (rewardId: string) => void;
  onCheckIn?: () => void;
  onShareReferral?: () => void;
}

/* ─── SVG Icon Components ─────────────────────────────────────────── */

function MedalIcon({ filled = false }: { filled?: boolean }) {
  return (
    <svg
      className={filled ? 'h-5 w-5 fill-current' : 'h-5 w-5'}
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={filled ? 0 : 1.5}
      aria-hidden="true"
    >
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
  );
}

function CopyIcon({ className = 'h-[18px] w-[18px]' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
    </svg>
  );
}

function CheckIcon({ className = 'h-[18px] w-[18px]' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function ShareIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
    </svg>
  );
}

function MapPinIcon({ className = 'h-[20px] w-[20px]' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

function FilterIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
      <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
    </svg>
  );
}

function AlertCircleIcon({ className = 'h-12 w-12', style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg className={className} style={style} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}

function GiftIcon({ className = 'h-12 w-12', style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg className={className} style={style} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
      <polyline points="20 12 20 22 4 22 4 12" />
      <rect x="2" y="7" width="20" height="5" />
      <line x1="12" y1="22" x2="12" y2="7" />
      <path d="M12 7H7.5a2.5 2.5 0 010-5C11 2 12 7 12 7z" />
      <path d="M12 7h4.5a2.5 2.5 0 000-5C13 2 12 7 12 7z" />
    </svg>
  );
}

function SparklesIcon({ className = 'h-8 w-8', style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg className={className} style={style} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
      <path d="M12 3l1.5 5L18 8l-4 3.5L15.5 17 12 13.5 8.5 17 10 11.5 6 8l4.5-.5L12 3z" />
    </svg>
  );
}

/* ─── Status Badge ─────────────────────────────────────────────────── */

function StatusBadge({ status }: { status: LoyaltyHistoryEntry['status'] }) {
  const { t } = useTranslation();

  const config: Record<string, { label: string; classes: string }> = {
    completed: {
      label: t('loyalty.completed'),
      classes: 'border-[#ffb779]/40 text-[#ffb779]',
    },
    pending: {
      label: t('loyalty.pending'),
      classes: 'border-[#a18d7f]/30 text-[#a18d7f]',
    },
    expired: {
      label: t('loyalty.expired'),
      classes: 'border-[#ffb4ab]/40 text-[#ffb4ab]',
    },
  };

  const c = config[status];
  return (
    <span
      className={`inline-block rounded border px-2 py-0.5 text-[10px] font-bold leading-normal ${c?.classes ?? ''}`}
    >
      {c?.label ?? status}
    </span>
  );
}

/* ─── Loading Skeleton ─────────────────────────────────────────────── */

function LoyaltySkeleton() {
  return (
    <div className="min-h-screen" style={{ backgroundColor: '#051424' }}>
      <div className="mx-auto max-w-[1440px] px-5 md:px-16 pt-32 pb-24">
        {/* Header skeleton */}
        <div className="mb-8 flex items-center justify-between">
          <div className="h-8 w-48 animate-pulse rounded" style={{ backgroundColor: '#1e3550' }} />
          <div className="h-10 w-32 animate-pulse rounded-full" style={{ backgroundColor: '#1e3550' }} />
        </div>

        {/* Hero skeleton */}
        <div
          className="mb-8 rounded-xl p-6 backdrop-blur-xl"
          style={{ backgroundColor: 'rgba(40,54,71,0.4)', border: '1px solid rgba(205,127,50,0.3)' }}
        >
          <div className="flex flex-col gap-6 md:flex-row">
            <div className="flex-1 space-y-4">
              <div className="h-6 w-32 animate-pulse rounded-full" style={{ backgroundColor: '#1e3550' }} />
              <div className="h-10 w-64 animate-pulse rounded" style={{ backgroundColor: '#1e3550' }} />
              <div className="h-4 w-80 animate-pulse rounded" style={{ backgroundColor: '#1e3550' }} />
              <div className="h-2 w-full animate-pulse rounded-full" style={{ backgroundColor: '#1e3550' }} />
            </div>
            <div className="h-32 w-48 animate-pulse rounded" style={{ backgroundColor: '#1e3550' }} />
          </div>
        </div>

        {/* Grid skeleton */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-72 animate-pulse rounded-xl" style={{ backgroundColor: 'rgba(40,54,71,0.4)' }} />
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── Error State ──────────────────────────────────────────────────── */

function LoyaltyError({ message }: { message: string }) {
  const { t } = useTranslation();

  return (
    <div
      className="flex min-h-[400px] flex-col items-center justify-center gap-4 rounded-xl p-8 text-center"
      role="alert"
      aria-live="assertive"
      style={{
        backgroundColor: 'rgba(40,54,71,0.4)',
        backdropFilter: 'blur(24px)',
        border: '1px solid rgba(255,255,255,0.05)',
      }}
    >
      <AlertCircleIcon className="h-12 w-12 text-[#ffb4ab]" />
      <h3 className="text-xl font-semibold" style={{ fontFamily: "'Libre Caslon Text', serif", color: '#d5e4fa' }}>
        {t('loyalty.errorTitle')}
      </h3>
      <p style={{ color: '#d8c2b2' }}>{message}</p>
    </div>
  );
}

/* ─── Empty State ──────────────────────────────────────────────────── */

function LoyaltyEmpty() {
  const { t } = useTranslation();

  return (
    <div
      className="flex min-h-[400px] flex-col items-center justify-center gap-4 rounded-xl p-8 text-center"
      role="status"
      style={{
        backgroundColor: 'rgba(40,54,71,0.4)',
        backdropFilter: 'blur(24px)',
        border: '1px solid rgba(255,255,255,0.05)',
      }}
    >
      <GiftIcon className="h-12 w-12" style={{ color: '#a18d7f' }} />
      <h3 className="text-xl font-semibold" style={{ fontFamily: "'Libre Caslon Text', serif", color: '#d5e4fa' }}>
        {t('loyalty.emptyTitle')}
      </h3>
      <p style={{ color: '#d8c2b2' }}>{t('loyalty.emptyDescription')}</p>
    </div>
  );
}

/* ─── Tier Card (Platinum Hero) ────────────────────────────────────── */

function TierCard({
  data,
  onRedeemPoints,
}: {
  data: LoyaltyDashboardData;
  onRedeemPoints?: () => void;
}) {
  const { t } = useTranslation();

  return (
    <section
      className="relative overflow-hidden rounded-xl p-6 md:p-8"
      aria-label={t('loyalty.tierCardAria', { tierName: data.tierName })}
      data-glass="platinum"
      style={{
        position: 'relative',
        background: 'linear-gradient(135deg, rgba(205,127,50,0.15) 0%, rgba(5,20,36,0.4) 100%)',
        backdropFilter: 'blur(32px)',
        WebkitBackdropFilter: 'blur(32px)',
        border: '1px solid rgba(205,127,50,0.3)',
        boxShadow: '0 0 20px rgba(205,127,50,0.2)',
      }}
    >
      {/* Brushed-alum texture */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.05]"
        style={{
          backgroundImage: 'url("https://www.transparenttextures.com/patterns/brushed-alum.png")',
        }}
      />

      <div className="relative z-10 flex flex-col justify-between gap-6 md:flex-row md:items-stretch">
        {/* Left: tier info + progress */}
        <div className="flex min-w-0 flex-1 flex-col justify-between">
          <div>
            <div
              className="mb-3 inline-block rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em]"
              style={{
                backgroundColor: 'rgba(255,183,121,0.2)',
                border: '1px solid rgba(255,183,121,0.4)',
                color: '#ffb779',
              }}
            >
              {t('loyalty.tierBadge', { tierName: data.tierName })}
            </div>
            <h2
              className="mb-2 text-4xl leading-tight tracking-[-0.02em] md:text-5xl md:leading-tight"
              style={{ fontFamily: "'Libre Caslon Text', serif", color: '#d5e4fa' }}
            >
              {t('loyalty.memberSince', { year: data.memberSince })}
            </h2>
            <p
              className="max-w-xl text-base leading-relaxed"
              style={{
                fontFamily: "'Space Grotesk', sans-serif",
                color: '#d8c2b2',
                fontSize: '16px',
                lineHeight: '1.5',
                fontWeight: '400',
                opacity: 0.8,
              }}
            >
              {data.tierDescription}
            </p>
          </div>

          {/* Progress bar */}
          <div className="mt-10">
            <div className="mb-2 flex items-end justify-between">
              <span
                className="text-xs font-semibold uppercase tracking-[0.1em]"
                style={{ fontFamily: "'Space Grotesk', sans-serif", color: '#a18d7f', fontSize: '12px', lineHeight: '1' }}
              >
                {t('loyalty.nextLevel', { tierName: data.nextTier })}
              </span>
              <span
                className="text-xs font-semibold"
                style={{ fontFamily: "'Space Grotesk', sans-serif", color: '#ffb779' }}
              >
                {t('loyalty.ptsRemaining', { count: data.pointsRemainingForNextTier })}
              </span>
            </div>
            <div
              className="h-1.5 w-full overflow-hidden rounded-full"
              style={{ backgroundColor: '#122031' }}
            >
              <div
                className="h-full rounded-full"
                style={{
                  width: `${data.progressPercent}%`,
                  background: 'linear-gradient(90deg, #8e4e00 0%, #cd7f32 50%, #ffb779 100%)',
                  boxShadow: '0 0 20px rgba(205,127,50,0.2)',
                  transition: 'width 0.6s ease',
                }}
              />
            </div>
          </div>
        </div>

        {/* Right: points balance */}
        <div className="flex min-w-[200px] shrink-0 flex-col items-end justify-between text-right">
          <span
            className="text-xs font-semibold uppercase tracking-widest"
            style={{ fontFamily: "'Space Grotesk', sans-serif", color: '#a18d7f' }}
          >
            {t('loyalty.balance')}
          </span>
          <div>
            <div
              className="text-[72px] leading-none font-light"
              style={{
                fontFamily: "'Cormorant Garamond', serif",
                color: '#ffb779',
              }}
            >
              {data.pointsBalance.toLocaleString()}
            </div>
            <div
              className="text-xs tracking-tighter"
              style={{ fontFamily: "'Space Grotesk', sans-serif", color: '#e2e2e2' }}
            >
              {t('loyalty.premiumRewardPoints')}
            </div>
          </div>
          <button
            type="button"
            onClick={onRedeemPoints}
            className="mt-5 w-full rounded-lg py-3 font-bold transition-transform active:scale-95"
            style={{
              backgroundColor: '#ffb779',
              color: '#4c2700',
              fontFamily: "'Space Grotesk', sans-serif",
            }}
            aria-label={t('loyalty.redeemPointsAria', { balance: data.pointsBalance.toLocaleString() })}
          >
            {t('loyalty.redeemPoints')}
          </button>
        </div>
      </div>
    </section>
  );
}

/* ─── Reward Card ──────────────────────────────────────────────────── */

function RewardCard({
  reward,
  onClaim,
}: {
  reward: LoyaltyRewardItem;
  onClaim?: (id: string) => void;
}) {
  const { t } = useTranslation();

  return (
    <div
      className="group cursor-pointer overflow-hidden rounded-xl transition-all duration-500 hover:border-[#ffb779]/40"
      onClick={() => onClaim?.(reward.id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClaim?.(reward.id);
        }
      }}
      role="button"
      tabIndex={0}
      aria-label={t('loyalty.claimRewardAria', { title: reward.title, points: reward.pointsCost })}
      data-glass="card"
      style={{
        backgroundColor: 'rgba(40,54,71,0.4)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        border: '1px solid rgba(255,255,255,0.05)',
      }}
    >
      <div className="relative h-40 overflow-hidden">
        <img
          className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
          src={reward.imageUrl}
          alt={reward.imageAlt}
          loading="lazy"
        />
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background: 'linear-gradient(to top, rgba(5,20,36,1) 0%, transparent 100%)',
          }}
        />
      </div>
      <div className="p-6">
        <h4
          className="mb-1 text-lg leading-relaxed"
          style={{ fontFamily: "'Space Grotesk', sans-serif", color: '#d5e4fa', fontWeight: '400', lineHeight: '1.6' }}
        >
          {reward.title}
        </h4>
        <p
          className="mb-4 text-xs font-bold"
          style={{ fontFamily: "'Space Grotesk', sans-serif", color: '#a18d7f' }}
        >
          {t('loyalty.pointsLabel', { count: reward.pointsCost })}
        </p>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onClaim?.(reward.id);
          }}
          className="w-full rounded py-2 text-xs font-bold transition-colors hover:bg-white/[0.05]"
          style={{
            fontFamily: "'Space Grotesk', sans-serif",
            color: '#d5e4fa',
            border: '1px solid rgba(161,141,127,0.3)',
          }}
        >
          {t('loyalty.claimReward')}
        </button>
      </div>
    </div>
  );
}

/* ─── Points History Table ─────────────────────────────────────────── */

function PointsHistoryTable({ history }: { history: LoyaltyHistoryEntry[] }) {
  const { t } = useTranslation();

  if (history.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <SparklesIcon className="mb-3 h-8 w-8" style={{ color: '#5a6270' }} />
        <p className="text-base" style={{ fontFamily: "'Space Grotesk', sans-serif", color: '#d8c2b2' }}>
          {t('loyalty.noHistory')}
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left">
        <thead>
          <tr className="border-b" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
            {[
              { key: 'activity', label: t('loyalty.activity') },
              { key: 'date', label: t('loyalty.date') },
              { key: 'status', label: t('loyalty.status') },
              { key: 'points', label: t('loyalty.points') },
            ].map((h) => (
              <th
                key={h.key}
                className={`py-4 text-xs font-bold uppercase tracking-widest ${
                  h.key === 'points' ? 'text-right' : ''
                }`}
                style={{
                  fontFamily: "'Space Grotesk', sans-serif",
                  color: '#c6c6c6',
                }}
              >
                {h.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y" style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
          {history.map((entry) => (
            <tr
              key={entry.id}
              className="transition-colors hover:bg-white/[0.03]"
            >
              <td
                className="py-4 text-base"
                style={{ fontFamily: "'Space Grotesk', sans-serif", color: '#d5e4fa' }}
              >
                {entry.activity}
              </td>
              <td
                className="py-4 text-xs"
                style={{ fontFamily: "'Space Grotesk', sans-serif", color: '#a18d7f' }}
              >
                {entry.date}
              </td>
              <td className="py-4">
                <StatusBadge status={entry.status} />
              </td>
              <td
                className="py-4 text-right font-bold"
                style={{ fontFamily: "'Space Grotesk', sans-serif", color: '#ffb779' }}
              >
                {entry.points > 0 ? '+' : ''}
                {entry.points.toLocaleString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ─── Weekly Streak ────────────────────────────────────────────────── */

function WeeklyStreak({
  days,
  streakCount,
  onCheckIn,
}: {
  days: LoyaltyStreakDay[];
  streakCount: number;
  onCheckIn?: () => void;
}) {
  const { t } = useTranslation();

  return (
    <section
      className="rounded-xl p-6 backdrop-blur-xl"
      aria-label={t('loyalty.weeklyStreakAria')}
      data-glass="card"
      style={{
        backgroundColor: 'rgba(40,54,71,0.4)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        border: '1px solid rgba(255,255,255,0.05)',
      }}
    >
      <h3
        className="mb-6 text-2xl"
        style={{ fontFamily: "'Libre Caslon Text', serif", color: '#d5e4fa' }}
      >
        {t('loyalty.weeklyStreak')}
      </h3>
      <div className="flex items-center justify-between gap-2">
        {days.map((day) => (
          <div key={day.label} className="flex flex-col items-center gap-2">
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-full border transition-colors ${
                day.checked
                  ? 'text-[#ffb779]'
                  : 'text-[rgba(161,141,127,0.3)]'
              }`}
              style={{
                borderColor: day.checked ? '#ffb779' : 'rgba(161,141,127,0.2)',
                backgroundColor: day.checked ? 'rgba(255,183,121,0.1)' : 'transparent',
              }}
            >
              <MedalIcon filled={day.checked} />
            </div>
            <span
              className="text-[10px] font-bold"
              style={{
                color: day.checked ? '#ffb779' : '#a18d7f',
              }}
            >
              {day.label}
            </span>
          </div>
        ))}
      </div>
      <p
        className="mt-6 text-base leading-relaxed"
        style={{ fontFamily: "'Space Grotesk', sans-serif", color: '#d8c2b2' }}
      >
        <Trans
          i18nKey="loyalty.streakDescription"
          values={{ count: streakCount }}
          components={{ strong: <strong style={{ color: '#ffb779' }} /> }}
        />
      </p>
      <button
        type="button"
        onClick={onCheckIn}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg py-3 font-bold transition-all"
        style={{
          fontFamily: "'Space Grotesk', sans-serif",
          color: '#d5e4fa',
          backgroundColor: '#122031',
          border: '1px solid rgba(161,141,127,0.2)',
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,183,121,0.4)';
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.borderColor = 'rgba(161,141,127,0.2)';
        }}
        aria-label={t('loyalty.checkinAria')}
      >
        <MapPinIcon />
        {t('loyalty.checkinRoastery')}
      </button>
    </section>
  );
}

/* ─── Referral Block ────────────────────────────────────────────────── */

function ReferralBlock({
  code,
  onShare,
}: {
  code: string;
  onShare?: () => void;
}) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(code).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [code]);

  return (
    <section
      className="relative overflow-hidden rounded-xl p-6 backdrop-blur-xl"
      aria-label={t('loyalty.referralSectionAria')}
      data-glass="card"
      style={{
        backgroundColor: 'rgba(40,54,71,0.4)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        border: '1px solid rgba(255,255,255,0.05)',
      }}
    >
      {/* Glow orb */}
      <div
        className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 blur-[64px]"
        style={{ backgroundColor: 'rgba(255,183,121,0.1)' }}
      />

      <h3
        className="mb-2 text-2xl"
        style={{ fontFamily: "'Libre Caslon Text', serif", color: '#d5e4fa' }}
      >
        {t('loyalty.referEarn')}
      </h3>
      <p
        className="mb-5 text-base"
        style={{ fontFamily: "'Space Grotesk', sans-serif", color: '#a18d7f' }}
      >
        {t('loyalty.referDescription')}
      </p>

      {/* Code display */}
      <div
        className="mb-4 flex items-center justify-between rounded p-3"
        style={{
          backgroundColor: '#010f1f',
          border: '1px solid rgba(255,255,255,0.05)',
        }}
      >
        <span
          className="text-[24px] font-light tracking-widest"
          style={{ fontFamily: "'Libre Caslon Text', serif", color: '#ffb779' }}
        >
          {code}
        </span>
        <button
          type="button"
          onClick={handleCopy}
          className={`flex items-center gap-1 text-xs font-bold active:scale-90 transition-all ${
            copied ? 'text-[#4CAF50]' : ''
          }`}
          style={{
            fontFamily: "'Space Grotesk', sans-serif",
            color: copied ? '#4CAF50' : '#ffb779',
          }}
          onMouseEnter={(e) => {
            if (!copied) (e.currentTarget as HTMLElement).style.color = '#ffffff';
          }}
          onMouseLeave={(e) => {
            if (!copied) (e.currentTarget as HTMLElement).style.color = '#ffb779';
          }}
          aria-label={copied ? t('loyalty.codeCopiedAria') : t('loyalty.copyCodeAria')}
        >
          {copied ? (
            <CheckIcon />
          ) : (
            <CopyIcon />
          )}
          {copied ? t('loyalty.copied') : t('loyalty.copy')}
        </button>
      </div>

      {/* Share buttons */}
      <div className="flex gap-2">
        <button
          type="button"
          className="flex flex-1 items-center justify-center rounded py-2 transition-all"
          style={{
            backgroundColor: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(161,141,127,0.2)',
            color: '#d8c2b2',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(255,255,255,0.1)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(255,255,255,0.05)';
          }}
          aria-label={t('loyalty.shareCodeAria')}
        >
          <ShareIcon />
        </button>
        <button
          type="button"
          onClick={onShare}
          className="flex-[3] rounded py-2 font-bold transition-transform active:scale-95"
          style={{
            backgroundColor: '#ffb779',
            color: '#4c2700',
            fontFamily: "'Space Grotesk', sans-serif",
          }}
        >
          {t('loyalty.shareInviteLink')}
        </button>
      </div>
    </section>
  );
}

/* ─── Tier Benefits ────────────────────────────────────────────────── */

function TierBenefits({ benefits }: { benefits: LoyaltyTierBenefit[] }) {
  const { t } = useTranslation();

  return (
    <section
      className="rounded-xl p-6 backdrop-blur-xl"
      aria-label={t('loyalty.tierBenefitsAria')}
      data-glass="card"
      style={{
        backgroundColor: 'rgba(40,54,71,0.4)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        border: '1px solid rgba(255,255,255,0.05)',
      }}
    >
      <h3
        className="mb-6 text-xs font-semibold uppercase tracking-[0.2em]"
        style={{ fontFamily: "'Space Grotesk', sans-serif", color: '#a18d7f' }}
      >
        {t('loyalty.tierBenefits')}
      </h3>
      <ul className="flex flex-col gap-3">
        {benefits.map((benefit) => (
          <li key={benefit.label} className="group flex items-center gap-3">
            <span
              className="h-1.5 w-1.5 rounded-full transition-transform group-hover:scale-150"
              style={{ backgroundColor: '#ffb779' }}
            />
            <span
              className="text-base"
              style={{ fontFamily: "'Space Grotesk', sans-serif", color: '#d5e4fa' }}
            >
              {benefit.label}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ─── Parallax Glass Effect ────────────────────────────────────────── */

function useParallaxGlass() {
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    const cards = document.querySelectorAll('[data-glass]');
    if (cards.length === 0) return;

    const moveHandler = (card: Element) => (e: Event) => {
      const rect = card.getBoundingClientRect();
      const me = e as MouseEvent;
      const x = me.clientX - rect.left;
      const y = me.clientY - rect.top;
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      const rotateX = (y - centerY) / 25;
      const rotateY = (centerX - x) / 25;
      (card as HTMLElement).style.transform =
        `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
    };

    const leaveHandler = (card: Element) => () => {
      (card as HTMLElement).style.transform =
        'perspective(1000px) rotateX(0) rotateY(0)';
    };

    const handlers = new Map<Element, [EventListenerOrEventListenerObject, EventListenerOrEventListenerObject]>();

    cards.forEach((card) => {
      const move = moveHandler(card);
      const leave = leaveHandler(card);
      handlers.set(card, [move, leave]);
      card.addEventListener('mousemove', move);
      card.addEventListener('mouseleave', leave);
    });

    return () => {
      handlers.forEach(([move, leave], card) => {
        card.removeEventListener('mousemove', move);
        card.removeEventListener('mouseleave', leave);
      });
      handlers.clear();
    };
  }, []);
}

/* ─── Scrollbar Styles ─────────────────────────────────────────────── */

function ScrollbarStyles() {
  return (
    <style>{`
      #stitch-loyalty-scroll::-webkit-scrollbar { width: 6px; }
      #stitch-loyalty-scroll::-webkit-scrollbar-track { background: #051424; }
      #stitch-loyalty-scroll::-webkit-scrollbar-thumb { background: #283647; border-radius: 10px; }
    `}</style>
  );
}

/* ─── Main Component ───────────────────────────────────────────────── */

export function StitchLoyaltyNew({
  data: externalData,
  loadingState = 'idle',
  errorMessage: externalErrorMessage,
  onRedeemPoints,
  onClaimReward,
  onCheckIn,
  onShareReferral,
}: Readonly<StitchLoyaltyNewProps>) {
  const { t } = useTranslation();

  useParallaxGlass();

  /* ─── Default data ──────────────────────────────────────────────── */
  const data: LoyaltyDashboardData = externalData ?? {
    tierName: 'Platinum',
    memberSince: '2022',
    tierDescription: t('loyalty.heroDescription'),
    nextTier: 'Black Tier',
    pointsRemainingForNextTier: 2550,
    progressPercent: 78,
    pointsBalance: 12450,
    streakCount: 12,
    referralCode: 'AURA-PLAT-882',
    rewards: [
      {
        id: 'r1',
        title: t('loyalty.defaultReward1'),
        pointsCost: 4500,
        imageUrl: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=400&q=80',
        imageAlt: t('loyalty.defaultReward1Alt'),
      },
      {
        id: 'r2',
        title: t('loyalty.defaultReward2'),
        pointsCost: 8000,
        imageUrl: 'https://images.unsplash.com/photo-1517668808822-9ebb02f2a0e6?w=400&q=80',
        imageAlt: t('loyalty.defaultReward2Alt'),
      },
      {
        id: 'r3',
        title: t('loyalty.defaultReward3'),
        pointsCost: 2500,
        imageUrl: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=400&q=80',
        imageAlt: t('loyalty.defaultReward3Alt'),
      },
    ],
    pointsHistory: [
      { id: 'h1', activity: t('loyalty.defaultHistory1'), date: 'OCT 24, 2024', status: 'completed' as const, points: 450 },
      { id: 'h2', activity: t('loyalty.defaultHistory2'), date: 'OCT 20, 2024', status: 'completed' as const, points: 1200 },
      { id: 'h3', activity: t('loyalty.defaultHistory3'), date: 'OCT 15, 2024', status: 'completed' as const, points: 2000 },
    ],
    streakDays: [
      { label: t('loyalty.days.MON'), checked: true },
      { label: t('loyalty.days.TUE'), checked: true },
      { label: t('loyalty.days.WED'), checked: true },
      { label: t('loyalty.days.THU'), checked: false },
      { label: t('loyalty.days.FRI'), checked: false },
      { label: t('loyalty.days.SAT'), checked: false },
    ],
    tierBenefits: [
      { label: t('loyalty.benefit1') },
      { label: t('loyalty.benefit2') },
      { label: t('loyalty.benefit3') },
      { label: t('loyalty.benefit4') },
    ],
  };

  const resolvedErrorMessage = externalErrorMessage ?? t('loyalty.errorDescription');

  /* ─── Loading State ─────────────────────────────────────────────── */
  if (loadingState === 'loading') {
    return <LoyaltySkeleton />;
  }

  /* ─── Error State ───────────────────────────────────────────────── */
  if (loadingState === 'error') {
    return (
      <div className="flex min-h-screen items-center justify-center p-6" style={{ backgroundColor: '#051424' }}>
        <LoyaltyError message={resolvedErrorMessage} />
      </div>
    );
  }

  /* ─── Empty State ───────────────────────────────────────────────── */
  if (!data || data.pointsBalance === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6" style={{ backgroundColor: '#051424' }}>
        <LoyaltyEmpty />
      </div>
    );
  }

  return (
    <div
      id="stitch-loyalty-scroll"
      className="min-h-screen overflow-x-hidden"
      style={{
        backgroundColor: '#051424',
        color: '#d5e4fa',
        fontFamily: "'Space Grotesk', sans-serif",
      }}
    >
      <ScrollbarStyles />

      {/* Nocturnal-vibe background gradient */}
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          background: 'radial-gradient(circle at 50% -20%, rgba(205,127,50,0.1) 0%, rgba(5,20,36,0) 70%)',
        }}
      />

      <div className="relative mx-auto max-w-[1440px] px-5 md:px-16 pt-32 pb-24">
        {/* Tier Card */}
        <div className="mb-stack-lg">
          <TierCard data={data} onRedeemPoints={onRedeemPoints} />
        </div>

        {/* Two-column layout */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* ─── Left Column: Rewards + History ──────────────────────── */}
          <div className="flex flex-col gap-12 lg:col-span-8">
            {/* Rewards Grid */}
            <section aria-label={t('loyalty.availableRewards')}>
              <div className="mb-6 flex items-center justify-between">
                <h3
                  className="text-2xl"
                  style={{ fontFamily: "'Libre Caslon Text', serif", color: '#d5e4fa' }}
                >
                  {t('loyalty.availableRewards')}
                </h3>
                <button
                  type="button"
                  className="text-xs font-bold uppercase tracking-widest hover:underline"
                  style={{ fontFamily: "'Space Grotesk', sans-serif", color: '#ffb779' }}
                >
                  {t('loyalty.viewAll')}
                </button>
              </div>

              {data.rewards.length === 0 ? (
                <div
                  className="flex flex-col items-center justify-center rounded-xl py-12 text-center backdrop-blur-xl"
                  style={{
                    backgroundColor: 'rgba(40,54,71,0.4)',
                    border: '1px solid rgba(255,255,255,0.05)',
                  }}
                >
                  <SparklesIcon className="mb-3 h-8 w-8" style={{ color: '#5a6270' }} />
                  <p className="text-base" style={{ fontFamily: "'Space Grotesk', sans-serif", color: '#d8c2b2' }}>
                    {t('loyalty.noRewards')}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                  {data.rewards.map((reward) => (
                    <RewardCard
                      key={reward.id}
                      reward={reward}
                      onClaim={onClaimReward}
                    />
                  ))}
                </div>
              )}
            </section>

            {/* Points History */}
            <section
              className="overflow-hidden rounded-xl p-6 backdrop-blur-xl"
              aria-label={t('loyalty.pointsHistory')}
              data-glass="card"
              style={{
                backgroundColor: 'rgba(40,54,71,0.4)',
                backdropFilter: 'blur(24px)',
                WebkitBackdropFilter: 'blur(24px)',
                border: '1px solid rgba(255,255,255,0.05)',
              }}
            >
              <div className="mb-6 flex items-center justify-between">
                <h3
                  className="text-2xl"
                  style={{ fontFamily: "'Libre Caslon Text', serif", color: '#d5e4fa' }}
                >
                  {t('loyalty.pointsHistory')}
                </h3>
                <button
                  type="button"
                  className="transition-colors hover:text-[#d5e4fa]"
                  style={{ color: '#a18d7f' }}
                  aria-label={t('loyalty.filterHistoryAria')}
                >
                  <FilterIcon />
                </button>
              </div>
              <PointsHistoryTable history={data.pointsHistory} />
            </section>
          </div>

          {/* ─── Right Column: Streak, Referral, Benefits ─────────────── */}
          <div className="flex flex-col gap-6 lg:col-span-4">
            <WeeklyStreak
              days={data.streakDays}
              streakCount={data.streakCount}
              onCheckIn={onCheckIn}
            />
            <ReferralBlock
              code={data.referralCode}
              onShare={onShareReferral}
            />
            <TierBenefits benefits={data.tierBenefits} />
          </div>
        </div>
      </div>
    </div>
  );
}
