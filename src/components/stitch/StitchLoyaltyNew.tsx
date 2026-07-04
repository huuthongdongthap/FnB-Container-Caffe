/**
 * StitchLoyaltyNew — AURA CAFE Loyalty & Rewards Dashboard
 *
 * Recreation of the original Stitch HTML export, using Stitch design tokens.
 * All colors use --st-* CSS variables for theme consistency.
 * Source: /tmp/stitch_original/stitch_aura_cafe/aura_cafe_loyalty_rewards_dashboard/code.html
 */
'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation, Trans } from 'react-i18next';
import {
  Award,
  Copy,
  Check,
  Share2,
  MapPin,
  Filter,
  Gift,
  Sparkles,
  AlertCircle,
} from 'lucide-react';

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

/* ─── Status Badge ─────────────────────────────────────────────────── */

function StatusBadge({ status }: { status: LoyaltyHistoryEntry['status'] }) {
  const { t } = useTranslation();

  const config: Record<string, { label: string; classes: string }> = {
    completed: {
      label: t('loyalty.completed'),
      classes: 'border-[var(--st-secondary)]/40 text-[var(--st-secondary)]',
    },
    pending: {
      label: t('loyalty.pending'),
      classes: 'border-[var(--st-on-surface-variant)]/30 text-[var(--st-on-surface-variant)]',
    },
    expired: {
      label: t('loyalty.expired'),
      classes: 'border-[var(--st-error)]/40 text-[var(--st-error)]',
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
    <div className="min-h-screen" style={{ backgroundColor: 'var(--st-surface)' }}>
      <div className="mx-auto max-w-[1440px] px-[64px] pt-32 pb-24">
        <div className="mb-8 flex items-center justify-between">
          <div className="h-8 w-48 animate-pulse rounded" style={{ backgroundColor: 'var(--st-surface-container-highest)' }} />
          <div className="h-10 w-32 animate-pulse rounded-full" style={{ backgroundColor: 'var(--st-surface-container-highest)' }} />
        </div>
        <div
          className="mb-8 rounded-xl p-[24px] backdrop-blur-xl"
          style={{ backgroundColor: 'color-mix(in srgb, var(--st-surface-container-highest) 40%, transparent)', border: '1px solid color-mix(in srgb, var(--st-secondary) 30%, transparent)' }}
        >
          <div className="flex flex-col gap-[24px] md:flex-row">
            <div className="flex-1 space-y-4">
              <div className="h-6 w-32 animate-pulse rounded-full" style={{ backgroundColor: 'var(--st-surface-container-highest)' }} />
              <div className="h-10 w-64 animate-pulse rounded" style={{ backgroundColor: 'var(--st-surface-container-highest)' }} />
              <div className="h-4 w-80 animate-pulse rounded" style={{ backgroundColor: 'var(--st-surface-container-highest)' }} />
              <div className="h-2 w-full animate-pulse rounded-full" style={{ backgroundColor: 'var(--st-surface-container-highest)' }} />
            </div>
            <div className="h-32 w-48 animate-pulse rounded" style={{ backgroundColor: 'var(--st-surface-container-highest)' }} />
          </div>
        </div>
        <div className="grid grid-cols-1 gap-[24px] lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-72 animate-pulse rounded-xl" style={{ backgroundColor: 'color-mix(in srgb, var(--st-surface-container-highest) 40%, transparent)' }} />
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
        backgroundColor: 'color-mix(in srgb, var(--st-surface-container-highest) 40%, transparent)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        border: '1px solid rgba(255,255,255,0.05)',
      }}
    >
      <AlertCircle className="h-12 w-12" style={{ color: 'var(--st-error)' }} />
      <h3 className="text-xl font-semibold" style={{ fontFamily: "'Libre Caslon Text', serif", color: 'var(--st-on-surface)' }}>
        {t('loyalty.errorTitle')}
      </h3>
      <p style={{ color: 'var(--st-on-surface-variant)', fontFamily: "'Space Grotesk', sans-serif" }}>{message}</p>
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
        backgroundColor: 'color-mix(in srgb, var(--st-surface-container-highest) 40%, transparent)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        border: '1px solid rgba(255,255,255,0.05)',
      }}
    >
      <Gift className="h-12 w-12" style={{ color: 'var(--st-on-surface-variant)' }} />
      <h3 className="text-xl font-semibold" style={{ fontFamily: "'Libre Caslon Text', serif", color: 'var(--st-on-surface)' }}>
        {t('loyalty.emptyTitle')}
      </h3>
      <p style={{ color: 'var(--st-on-surface-variant)', fontFamily: "'Space Grotesk', sans-serif" }}>
        {t('loyalty.emptyDescription')}
      </p>
    </div>
  );
}

/* ─── Header (embedded, matching original HTML) ──────────────────── */

function LoyaltyHeader() {
  const { t } = useTranslation();

  return (
    <header
      className="fixed top-0 w-full z-50 bg-[var(--st-surface)]/80 backdrop-blur-xl border-b border-[var(--st-on-surface-variant)]/10 flex justify-between items-center px-[64px] py-[8px] max-w-full mx-auto"
    >
      <Link
        to="/"
        className="text-[40px] leading-none tracking-widest uppercase"
        style={{ fontFamily: "'Libre Caslon Text', serif", color: 'var(--st-secondary)', fontWeight: '400' }}
      >
        AURA CAFE
      </Link>
      <nav className="hidden md:flex gap-[24px] items-center">
        <Link
          to="/loyalty"
          className="hover:text-[var(--st-secondary)] transition-colors duration-300"
          style={{ fontFamily: "'Space Grotesk', sans-serif", color: 'var(--st-on-surface-variant)', fontWeight: '500' }}
        >
          {t('loyalty.navTiers', 'Tiers')}
        </Link>
        <Link
          to="/loyalty"
          className="font-bold border-b-2 pb-1"
          style={{ color: 'var(--st-secondary)', borderColor: 'var(--st-secondary)', fontFamily: "'Space Grotesk', sans-serif" }}
        >
          {t('loyalty.navRewards', 'Rewards')}
        </Link>
        <Link
          to="/about"
          className="hover:text-[var(--st-secondary)] transition-colors duration-300"
          style={{ fontFamily: "'Space Grotesk', sans-serif", color: 'var(--st-on-surface-variant)', fontWeight: '500' }}
        >
          {t('loyalty.navLounge', 'Lounge')}
        </Link>
        <Link
          to="/contact"
          className="hover:text-[var(--st-secondary)] transition-colors duration-300"
          style={{ fontFamily: "'Space Grotesk', sans-serif", color: 'var(--st-on-surface-variant)', fontWeight: '500' }}
        >
          {t('loyalty.navConcierge', 'Concierge')}
        </Link>
      </nav>
      <div className="flex items-center gap-[12px]">
        <button
          type="button"
          className="px-[24px] py-2 border border-[var(--st-secondary)]/30 rounded-full hover:bg-[var(--st-secondary)]/10 transition-all"
          style={{
            fontFamily: "'Space Grotesk', sans-serif",
            fontSize: '12px',
            lineHeight: '1',
            letterSpacing: '0.1em',
            fontWeight: '600',
            color: 'var(--st-on-surface)',
          }}
        >
          {t('loyalty.membership', 'Membership')}
        </button>
        <div className="w-10 h-10 rounded-full border border-[var(--st-secondary)]/20 p-0.5 overflow-hidden">
          <img
            className="w-full h-full object-cover rounded-full"
            alt={t('loyalty.profileAvatar', 'Profile')}
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuC_Oxyq1zrTrXQ-uyuJYfLRy8IFFqmzEHbnEXxIUveRL23mJRBnSxK-c9OIOkxZSfOmXN0c8G4GRUaYb_NMLeRoySWCtvjIx62nk_KpJRdKtUCsX6Dc0Kg754MPsYj9fEGkFuVRngOx9w4M5ncO5c_wLbsdcH_ee8NxAasSgQdHynopzhjGsB0yBRttQ4JfDGRNZRzZcgIDEVbU52i2F__EDsJzIegpEIenyZKYmrQCb-e14odxLXJ8H5Y6cHD4Vj_6aPENmx-OThk"
          />
        </div>
      </div>
    </header>
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
      className="relative overflow-hidden rounded-xl p-[24px] flex flex-col md:flex-row justify-between items-end md:items-stretch gap-[24px]"
      aria-label={t('loyalty.tierCardAria', { tierName: data.tierName })}
      data-glass="platinum"
      style={{
        background: 'linear-gradient(135deg, color-mix(in srgb, var(--st-secondary) 15%, transparent) 0%, color-mix(in srgb, var(--st-surface) 40%, transparent) 100%)',
        backdropFilter: 'blur(32px)',
        WebkitBackdropFilter: 'blur(32px)',
        border: '1px solid color-mix(in srgb, var(--st-secondary) 30%, transparent)',
        boxShadow: '0 0 20px color-mix(in srgb, var(--st-secondary) 20%, transparent)',
      }}
    >
      {/* Brushed-alum texture overlay */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.05]"
        style={{
          backgroundImage: 'url("https://www.transparenttextures.com/patterns/brushed-alum.png")',
        }}
      />

      {/* Left: tier info + progress */}
      <div className="flex flex-col justify-between flex-1">
        <div>
          <div
            className="inline-block px-3 py-1 border border-[var(--st-secondary)]/40 rounded-full text-[10px] font-bold tracking-[0.2em] uppercase mb-[12px]"
            style={{
              backgroundColor: 'color-mix(in srgb, var(--st-secondary) 20%, transparent)',
              color: 'var(--st-secondary)',
              fontFamily: "'Space Grotesk', sans-serif",
            }}
          >
            {t('loyalty.tierBadge', { tierName: data.tierName })}
          </div>
          <h2
            className="mb-2 text-[48px] leading-[1.1] tracking-[-0.02em] font-normal"
            style={{ fontFamily: "'Libre Caslon Text', serif", color: 'var(--st-on-surface)' }}
          >
            {t('loyalty.memberSince', { year: data.memberSince })}
          </h2>
          <p
            className="max-w-xl text-[16px] leading-[1.5] font-normal opacity-80"
            style={{
              fontFamily: "'Space Grotesk', sans-serif",
              color: 'var(--st-on-surface-variant)',
            }}
          >
            {data.tierDescription}
          </p>
        </div>

        {/* Progress bar */}
        <div className="mt-[48px]">
          <div className="flex justify-between items-end mb-2">
            <span
              className="text-[12px] leading-none font-semibold uppercase tracking-[0.1em]"
              style={{
                fontFamily: "'Space Grotesk', sans-serif",
                color: 'var(--st-on-surface-variant)',
              }}
            >
              {t('loyalty.nextLevel', { tierName: data.nextTier })}
            </span>
            <span
              className="text-[12px] leading-none font-semibold"
              style={{
                fontFamily: "'Space Grotesk', sans-serif",
                color: 'var(--st-secondary)',
              }}
            >
              {t('loyalty.ptsRemaining', { count: data.pointsRemainingForNextTier })}
            </span>
          </div>
          <div
            className="h-1.5 w-full rounded-full overflow-hidden"
            style={{ backgroundColor: 'var(--st-surface-container)' }}
          >
            <div
              className="h-full rounded-full"
              style={{
                width: `${data.progressPercent}%`,
                background: 'linear-gradient(90deg, color-mix(in srgb, var(--st-secondary) 100%, black 40%) 0%, var(--st-secondary) 50%, color-mix(in srgb, var(--st-secondary) 100%, white 40%) 100%)',
                boxShadow: '0 0 20px color-mix(in srgb, var(--st-secondary) 20%, transparent)',
                transition: 'width 0.6s ease',
              }}
            />
          </div>
        </div>
      </div>

      {/* Right: points balance */}
      <div className="flex flex-col items-end justify-between text-right min-w-[200px]">
        <span
          className="text-[12px] leading-none tracking-widest font-semibold uppercase"
          style={{
            fontFamily: "'Space Grotesk', sans-serif",
            color: 'var(--st-on-surface-variant)',
          }}
        >
          {t('loyalty.balance')}
        </span>
        <div>
          <div
            className="text-[72px] leading-none font-light"
            style={{
              fontFamily: "var(--aura-font-display, 'EB Garamond', serif)",
              color: 'var(--st-secondary)',
            }}
          >
            {data.pointsBalance.toLocaleString()}
          </div>
          <div
            className="text-[12px] leading-none tracking-tighter font-semibold"
            style={{
              fontFamily: "'Space Grotesk', sans-serif",
              color: 'var(--st-on-surface)',
            }}
          >
            {t('loyalty.premiumRewardPoints')}
          </div>
        </div>
        <button
          type="button"
          onClick={onRedeemPoints}
          className="mt-[24px] w-full py-3 font-bold rounded-lg active:scale-95 transition-transform"
          style={{
            backgroundColor: 'var(--st-secondary)',
            color: 'var(--st-on-secondary)',
            fontFamily: "'Space Grotesk', sans-serif",
            fontSize: '16px',
            lineHeight: '1.5',
          }}
          aria-label={t('loyalty.redeemPointsAria', { balance: data.pointsBalance.toLocaleString() })}
        >
          {t('loyalty.redeemPoints')}
        </button>
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
      className="group cursor-pointer overflow-hidden rounded-xl transition-all duration-500 hover:border-[var(--st-secondary)]/40"
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
        backgroundColor: 'color-mix(in srgb, var(--st-surface-container-highest) 40%, transparent)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        border: '1px solid rgba(255,255,255,0.05)',
      }}
    >
      <div className="h-40 relative overflow-hidden">
        <img
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
          src={reward.imageUrl}
          alt={reward.imageAlt}
          loading="lazy"
        />
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background: 'linear-gradient(to top, var(--st-surface) 0%, transparent 100%)',
          }}
        />
      </div>
      <div className="p-[24px]">
        <h4
          className="mb-1 text-[18px] leading-[1.6] font-normal"
          style={{ fontFamily: "'Space Grotesk', sans-serif", color: 'var(--st-on-surface)' }}
        >
          {reward.title}
        </h4>
        <p
          className="mb-4 text-[12px] leading-none font-semibold"
          style={{ fontFamily: "'Space Grotesk', sans-serif", color: 'var(--st-on-surface-variant)' }}
        >
          {t('loyalty.pointsLabel', { count: reward.pointsCost })}
        </p>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onClaim?.(reward.id);
          }}
          className="w-full py-2 text-[12px] leading-none font-bold rounded hover:bg-white/[0.05] transition-colors"
          style={{
            fontFamily: "'Space Grotesk', sans-serif",
            border: '1px solid color-mix(in srgb, var(--st-on-surface-variant) 30%, transparent)',
            color: 'var(--st-on-surface)',
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
        <Sparkles className="h-8 w-8 mb-3" style={{ color: 'var(--st-outline)' }} />
        <p className="text-[16px] leading-[1.5] font-normal" style={{ fontFamily: "'Space Grotesk', sans-serif", color: 'var(--st-on-surface-variant)' }}>
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
            <th
              className="py-4 text-[12px] leading-none tracking-widest uppercase font-bold"
              style={{
                fontFamily: "'Space Grotesk', sans-serif",
                color: 'var(--st-on-surface-variant)',
              }}
            >
              {t('loyalty.activity')}
            </th>
            <th
              className="py-4 text-[12px] leading-none tracking-widest uppercase font-bold"
              style={{
                fontFamily: "'Space Grotesk', sans-serif",
                color: 'var(--st-on-surface-variant)',
              }}
            >
              {t('loyalty.date')}
            </th>
            <th
              className="py-4 text-[12px] leading-none tracking-widest uppercase font-bold"
              style={{
                fontFamily: "'Space Grotesk', sans-serif",
                color: 'var(--st-on-surface-variant)',
              }}
            >
              {t('loyalty.status')}
            </th>
            <th
              className="py-4 text-[12px] leading-none tracking-widest uppercase font-bold text-right"
              style={{
                fontFamily: "'Space Grotesk', sans-serif",
                color: 'var(--st-on-surface-variant)',
              }}
            >
              {t('loyalty.points')}
            </th>
          </tr>
        </thead>
        <tbody className="divide-y" style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
          {history.map((entry) => (
            <tr
              key={entry.id}
              className="group transition-colors hover:bg-white/[0.03]"
            >
              <td
                className="py-4 text-[16px] leading-[1.5] font-normal"
                style={{ fontFamily: "'Space Grotesk', sans-serif", color: 'var(--st-on-surface)' }}
              >
                {entry.activity}
              </td>
              <td
                className="py-4 text-[12px] leading-none font-semibold"
                style={{ fontFamily: "'Space Grotesk', sans-serif", color: 'var(--st-on-surface-variant)' }}
              >
                {entry.date}
              </td>
              <td className="py-4">
                <StatusBadge status={entry.status} />
              </td>
              <td
                className="py-4 text-right font-bold text-[16px] leading-[1.5]"
                style={{ fontFamily: "'Space Grotesk', sans-serif", color: 'var(--st-secondary)' }}
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
      className="rounded-xl p-[24px]"
      aria-label={t('loyalty.weeklyStreakAria')}
      data-glass="card"
      style={{
        backgroundColor: 'color-mix(in srgb, var(--st-surface-container-highest) 40%, transparent)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        border: '1px solid rgba(255,255,255,0.05)',
      }}
    >
      <h3
        className="mb-[24px] text-[24px] leading-[1.4] font-normal"
        style={{ fontFamily: "'Libre Caslon Text', serif", color: 'var(--st-on-surface)' }}
      >
        {t('loyalty.weeklyStreak')}
      </h3>
      <div className="flex justify-between items-center gap-2">
        {days.map((day) => (
          <div key={day.label} className="flex flex-col items-center gap-2">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center"
              style={{
                border: day.checked
                  ? '1px solid var(--st-secondary)'
                  : '1px solid color-mix(in srgb, var(--st-on-surface-variant) 20%, transparent)',
                backgroundColor: day.checked
                  ? 'color-mix(in srgb, var(--st-secondary) 10%, transparent)'
                  : 'transparent',
                color: day.checked ? 'var(--st-secondary)' : 'color-mix(in srgb, var(--st-on-surface-variant) 30%, transparent)',
              }}
            >
              <Award
                className="h-5 w-5"
                style={{
                  fill: day.checked ? 'var(--st-secondary)' : 'none',
                }}
              />
            </div>
            <span
              className="text-[10px] font-bold"
              style={{
                color: day.checked ? 'var(--st-secondary)' : 'var(--st-on-surface-variant)',
                fontFamily: "'Space Grotesk', sans-serif",
              }}
            >
              {day.label}
            </span>
          </div>
        ))}
      </div>
      <p
        className="mt-[24px] text-[16px] leading-relaxed font-normal"
        style={{ fontFamily: "'Space Grotesk', sans-serif", color: 'var(--st-on-surface-variant)' }}
      >
        <Trans
          i18nKey="loyalty.streakDescription"
          values={{ count: streakCount }}
          components={{ strong: <strong style={{ color: 'var(--st-secondary)' }} /> }}
        />
      </p>
      <button
        type="button"
        onClick={onCheckIn}
        className="mt-4 w-full py-3 rounded-lg font-bold flex items-center justify-center gap-2 transition-all"
        style={{
          fontFamily: "'Space Grotesk', sans-serif",
          backgroundColor: 'var(--st-surface-container)',
          border: '1px solid color-mix(in srgb, var(--st-on-surface-variant) 20%, transparent)',
          color: 'var(--st-on-surface)',
          fontSize: '16px',
          lineHeight: '1.5',
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLElement).style.borderColor = 'color-mix(in srgb, var(--st-secondary) 40%, transparent)';
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.borderColor = 'color-mix(in srgb, var(--st-on-surface-variant) 20%, transparent)';
        }}
        aria-label={t('loyalty.checkinAria')}
      >
        <MapPin className="h-[20px] w-[20px]" />
        {t('loyalty.checkinRoastery')}
      </button>
    </section>
  );
}

/* ─── Referral Block ───────────────────────────────────────────────── */

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
      className="relative overflow-hidden rounded-xl p-[24px]"
      aria-label={t('loyalty.referralSectionAria')}
      data-glass="card"
      style={{
        backgroundColor: 'color-mix(in srgb, var(--st-surface-container-highest) 40%, transparent)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        border: '1px solid rgba(255,255,255,0.05)',
      }}
    >
      {/* Glow orb */}
      <div
        className="pointer-events-none absolute -right-10 -top-10 w-32 h-32 blur-[64px]"
        style={{ backgroundColor: 'color-mix(in srgb, var(--st-secondary) 10%, transparent)' }}
      />

      <h3
        className="mb-2 text-[24px] leading-[1.4] font-normal"
        style={{ fontFamily: "'Libre Caslon Text', serif", color: 'var(--st-on-surface)' }}
      >
        {t('loyalty.referEarn')}
      </h3>
      <p
        className="mb-[24px] text-[16px] leading-[1.5] font-normal"
        style={{ fontFamily: "'Space Grotesk', sans-serif", color: 'var(--st-on-surface-variant)' }}
      >
        {t('loyalty.referDescription')}
      </p>

      {/* Code display */}
      <div
        className="p-[12px] bg-[var(--st-surface-container-lowest)] rounded border border-[rgba(255,255,255,0.05)] flex items-center justify-between mb-4"
      >
        <span
          className="text-[24px] leading-none tracking-widest"
          style={{
            fontFamily: "'Libre Caslon Text', serif",
            color: 'var(--st-secondary)',
            fontWeight: '400',
          }}
        >
          {code}
        </span>
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1 text-[12px] leading-none font-bold active:scale-90 transition-all"
          style={{
            fontFamily: "'Space Grotesk', sans-serif",
            color: copied ? '#4CAF50' : 'var(--st-secondary)',
          }}
          onMouseEnter={(e) => {
            if (!copied) (e.currentTarget as HTMLElement).style.color = '#ffffff';
          }}
          onMouseLeave={(e) => {
            if (!copied) (e.currentTarget as HTMLElement).style.color = 'var(--st-secondary)';
          }}
          aria-label={copied ? t('loyalty.codeCopiedAria') : t('loyalty.copyCodeAria')}
        >
          {copied ? (
            <Check className="h-[18px] w-[18px]" />
          ) : (
            <Copy className="h-[18px] w-[18px]" />
          )}
          {copied ? t('loyalty.copied') : t('loyalty.copy')}
        </button>
      </div>

      {/* Share buttons */}
      <div className="flex gap-2">
        <button
          type="button"
          className="flex-1 py-2 bg-white/5 border border-[var(--st-on-surface-variant)]/20 rounded flex items-center justify-center hover:bg-white/10 transition-all"
          aria-label={t('loyalty.shareCodeAria')}
        >
          <Share2 className="h-4 w-4" style={{ color: 'var(--st-on-surface-variant)' }} />
        </button>
        <button
          type="button"
          onClick={onShare}
          className="flex-[3] py-2 rounded font-bold active:scale-95 transition-transform"
          style={{
            backgroundColor: 'var(--st-secondary)',
            color: 'var(--st-on-secondary)',
            fontFamily: "'Space Grotesk', sans-serif",
            fontSize: '12px',
            lineHeight: '1',
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
      className="rounded-xl p-[24px]"
      aria-label={t('loyalty.tierBenefitsAria')}
      data-glass="card"
      style={{
        backgroundColor: 'color-mix(in srgb, var(--st-surface-container-highest) 40%, transparent)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        border: '1px solid rgba(255,255,255,0.05)',
      }}
    >
      <h3
        className="text-[12px] leading-none uppercase tracking-[0.2em] font-semibold mb-[24px]"
        style={{ fontFamily: "'Space Grotesk', sans-serif", color: 'var(--st-on-surface-variant)' }}
      >
        {t('loyalty.tierBenefits')}
      </h3>
      <ul className="space-y-[12px]">
        {benefits.map((benefit) => (
          <li key={benefit.label} className="flex items-center gap-[12px] group">
            <span
              className="w-1.5 h-1.5 bg-[var(--st-secondary)] rounded-full group-hover:scale-150 transition-transform"
            />
            <span
              className="text-[16px] leading-[1.5] font-normal"
              style={{ fontFamily: "'Space Grotesk', sans-serif", color: 'var(--st-on-surface)' }}
            >
              {benefit.label}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ─── Footer (embedded, matching original HTML) ─────────────────────── */

function LoyaltyFooter() {
  const { t } = useTranslation();

  return (
    <footer
      className="w-full bg-[var(--st-surface-container-lowest)] border-t border-[rgba(255,255,255,0.05)] flex flex-col items-center gap-[24px] px-[64px] py-[48px]"
    >
      <div
        className="text-[48px] leading-[1.1] tracking-[-0.02em] font-normal"
        style={{ fontFamily: "'Libre Caslon Text', serif", color: 'var(--st-secondary)' }}
      >
        AURA CAFE
      </div>
      <div
        className="flex flex-wrap justify-center gap-[24px] text-[12px] leading-none uppercase tracking-widest font-semibold"
        style={{ color: 'var(--st-on-surface)', fontFamily: "'Space Grotesk', sans-serif" }}
      >
        <Link
          to="/privacy"
          className="hover:text-[var(--st-secondary)] transition-colors duration-300"
        >
          {t('loyalty.footerPrivacy', 'Privacy Policy')}
        </Link>
        <Link
          to="/terms"
          className="hover:text-[var(--st-secondary)] transition-colors duration-300"
        >
          {t('loyalty.footerTerms', 'Terms of Service')}
        </Link>
        <Link
          to="/loyalty"
          className="hover:text-[var(--st-secondary)] transition-colors duration-300"
        >
          {t('loyalty.footerBlackTier', 'Black Tier Benefits')}
        </Link>
        <Link
          to="/contact"
          className="hover:text-[var(--st-secondary)] transition-colors duration-300"
        >
          {t('loyalty.footerContact', 'Contact Concierge')}
        </Link>
      </div>
      <p
        className="mt-4 text-[12px] leading-none font-semibold opacity-50"
        style={{ fontFamily: "'Space Grotesk', sans-serif", color: 'var(--st-on-surface-variant)' }}
      >
        {t('loyalty.footerCopyright', { year: 2024, defaultValue: '© 2024 AURA CAFE. ALL RIGHTS RESERVED.' })}
      </p>
    </footer>
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
      #stitch-loyalty-scroll::-webkit-scrollbar-track { background: var(--st-surface); }
      #stitch-loyalty-scroll::-webkit-scrollbar-thumb { background: var(--st-surface-container-highest); border-radius: 10px; }
      .font-cormorant { font-family: var(--aura-font-display, 'EB Garamond', serif); }
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
        title: t('loyalty.defaultReward1', 'Private Cupping Session'),
        pointsCost: 4500,
        imageUrl: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=400&q=80',
        imageAlt: t('loyalty.defaultReward1Alt'),
      },
      {
        id: 'r2',
        title: t('loyalty.defaultReward2', 'Limited Edition Vessel'),
        pointsCost: 8000,
        imageUrl: 'https://images.unsplash.com/photo-1517668808822-9ebb02f2a0e6?w=400&q=80',
        imageAlt: t('loyalty.defaultReward2Alt'),
      },
      {
        id: 'r3',
        title: t('loyalty.defaultReward3', 'Artisan Coffee Flight'),
        pointsCost: 2500,
        imageUrl: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=400&q=80',
        imageAlt: t('loyalty.defaultReward3Alt'),
      },
    ],
    pointsHistory: [
      { id: 'h1', activity: t('loyalty.defaultHistory1', 'Kenya SL28 Purchase'), date: 'OCT 24, 2024', status: 'completed' as const, points: 450 },
      { id: 'h2', activity: t('loyalty.defaultHistory2', 'Concierge Booking'), date: 'OCT 20, 2024', status: 'completed' as const, points: 1200 },
      { id: 'h3', activity: t('loyalty.defaultHistory3', 'Referral Bonus'), date: 'OCT 15, 2024', status: 'completed' as const, points: 2000 },
    ],
    streakDays: [
      { label: 'MON', checked: true },
      { label: 'TUE', checked: true },
      { label: 'WED', checked: true },
      { label: 'THU', checked: false },
      { label: 'FRI', checked: false },
      { label: 'SAT', checked: false },
    ],
    tierBenefits: [
      { label: t('loyalty.benefit1', 'Complementary valet parking') },
      { label: t('loyalty.benefit2', 'Priority reservation access') },
      { label: t('loyalty.benefit3', 'Invite-only tasting events') },
      { label: t('loyalty.benefit4', '15% Discount on retail gear') },
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
      <div className="flex min-h-screen items-center justify-center p-6" style={{ backgroundColor: 'var(--st-surface)' }}>
        <LoyaltyError message={resolvedErrorMessage} />
      </div>
    );
  }

  /* ─── Empty State ───────────────────────────────────────────────── */
  if (!data || data.pointsBalance === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6" style={{ backgroundColor: 'var(--st-surface)' }}>
        <LoyaltyEmpty />
      </div>
    );
  }

  return (
    <div
      id="stitch-loyalty-scroll"
      className="min-h-screen overflow-x-hidden"
      style={{
        backgroundColor: 'var(--st-surface)',
        color: 'var(--st-on-surface)',
        fontFamily: "'Space Grotesk', sans-serif",
      }}
    >
      <ScrollbarStyles />

      {/* Nocturnal-vibe background gradient (matches HTML .nocturnal-vibe) */}
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          background: 'radial-gradient(circle at 50% -20%, color-mix(in srgb, var(--st-secondary) 10%, transparent) 0%, transparent 70%)',
        }}
      />

      {/* ─── Header ─────────────────────────────────────────────────── */}
      <LoyaltyHeader />

      {/* ─── Main Content ───────────────────────────────────────────── */}
      <main className="pt-32 pb-24 px-[64px] max-w-[1440px] mx-auto grid grid-cols-12 gap-[24px]">
        {/* Left Column: Hero & Rewards */}
        <div className="col-span-12 lg:col-span-8 flex flex-col gap-[48px]">
          {/* Hero Section: Platinum Card */}
          <TierCard data={data} onRedeemPoints={onRedeemPoints} />

          {/* Rewards Grid */}
          <section>
            <div className="flex justify-between items-center mb-[24px]">
              <h3
                className="text-[24px] leading-[1.4] font-normal"
                style={{ fontFamily: "'Libre Caslon Text', serif", color: 'var(--st-on-surface)' }}
              >
                {t('loyalty.availableRewards')}
              </h3>
              <Link
                to="/loyalty"
                className="text-[12px] leading-none hover:underline uppercase tracking-widest font-bold"
                style={{ fontFamily: "'Space Grotesk', sans-serif", color: 'var(--st-secondary)' }}
              >
                {t('loyalty.viewAll')}
              </Link>
            </div>

            {data.rewards.length === 0 ? (
              <div
                className="flex flex-col items-center justify-center rounded-xl py-12 text-center"
                style={{
                  backgroundColor: 'color-mix(in srgb, var(--st-surface-container-highest) 40%, transparent)',
                  backdropFilter: 'blur(24px)',
                  WebkitBackdropFilter: 'blur(24px)',
                  border: '1px solid rgba(255,255,255,0.05)',
                }}
              >
                <Sparkles className="h-8 w-8 mb-3" style={{ color: 'var(--st-outline)' }} />
                <p className="text-[16px] leading-[1.5] font-normal" style={{ fontFamily: "'Space Grotesk', sans-serif", color: 'var(--st-on-surface-variant)' }}>
                  {t('loyalty.noRewards')}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-[24px]">
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
            className="rounded-xl p-[24px] overflow-hidden"
            data-glass="card"
            style={{
              backgroundColor: 'color-mix(in srgb, var(--st-surface-container-highest) 40%, transparent)',
              backdropFilter: 'blur(24px)',
              WebkitBackdropFilter: 'blur(24px)',
              border: '1px solid rgba(255,255,255,0.05)',
            }}
          >
            <div className="flex justify-between items-center mb-[24px]">
              <h3
                className="text-[24px] leading-[1.4] font-normal"
                style={{ fontFamily: "'Libre Caslon Text', serif", color: 'var(--st-on-surface)' }}
              >
                {t('loyalty.pointsHistory')}
              </h3>
              <button
                type="button"
                className="cursor-pointer hover:text-[var(--st-on-surface)] transition-colors"
                style={{ color: 'var(--st-on-surface-variant)' }}
                aria-label={t('loyalty.filterHistoryAria')}
              >
                <Filter className="h-5 w-5" />
              </button>
            </div>
            <PointsHistoryTable history={data.pointsHistory} />
          </section>
        </div>

        {/* Right Column: Stats & Social */}
        <div className="col-span-12 lg:col-span-4 flex flex-col gap-[48px]">
          {/* Check-in Tracker */}
          <WeeklyStreak
            days={data.streakDays}
            streakCount={data.streakCount}
            onCheckIn={onCheckIn}
          />

          {/* Referral Block */}
          <ReferralBlock
            code={data.referralCode}
            onShare={onShareReferral}
          />

          {/* Tier Benefits */}
          <TierBenefits benefits={data.tierBenefits} />
        </div>
      </main>

      {/* ─── Footer ─────────────────────────────────────────────────── */}
      <LoyaltyFooter />
    </div>
  );
}
