/**
 * StitchLoyalty — AURA CAFE Loyalty Dashboard (Stitch design)
 *
 * Dark navy glassmorphism loyalty dashboard with tier card, points counter,
 * progress bar, rewards grid, referral code, points history, weekly streak,
 * and tier benefits. Mobile-first responsive.
 * Source: Stitch AI loyalty/design.html export.
 */
'use client';

import { useState, useCallback } from 'react';
import { clsx } from 'clsx';
import {
  Award,
  Copy,
  Check,
  Share2,
  MapPin,
  Filter,
  Gift,
  Medal,
  Users,
  Star,
  Sparkles,
  ArrowRight,
  ChevronRight,
  Loader2,
  AlertCircle,
  Ticket,
} from 'lucide-react';

/* ─── Types ────────────────────────────────────────────────────────── */

export interface RewardItem {
  id: string;
  title: string;
  pointsCost: number;
  imageUrl: string;
  imageAlt: string;
}

export interface PointsHistoryEntry {
  id: string;
  activity: string;
  date: string;
  status: 'completed' | 'pending' | 'expired';
  points: number;
}

export interface StreakDay {
  label: string;
  checked: boolean;
}

export interface TierBenefit {
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
  rewards: RewardItem[];
  pointsHistory: PointsHistoryEntry[];
  streakDays: StreakDay[];
  tierBenefits: TierBenefit[];
}

export type LoadingState = 'idle' | 'loading' | 'error';

export interface StitchLoyaltyProps {
  data?: LoyaltyDashboardData;
  loadingState?: LoadingState;
  errorMessage?: string;
  onRedeemPoints?: () => void;
  onClaimReward?: (rewardId: string) => void;
  onCheckIn?: () => void;
  onShareReferral?: () => void;
}

/* ─── Default Mock Data ────────────────────────────────────────────── */

const DEFAULT_REWARDS: RewardItem[] = [
  {
    id: 'r1',
    title: 'Private Cupping Session',
    pointsCost: 4500,
    imageUrl: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=400&q=80',
    imageAlt: 'Private coffee cupping session',
  },
  {
    id: 'r2',
    title: 'Limited Edition Vessel',
    pointsCost: 8000,
    imageUrl: 'https://images.unsplash.com/photo-1517668808822-9ebb02f2a0e6?w=400&q=80',
    imageAlt: 'Limited edition ceramic coffee vessel',
  },
  {
    id: 'r3',
    title: 'Artisan Coffee Flight',
    pointsCost: 2500,
    imageUrl: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=400&q=80',
    imageAlt: 'Artisan coffee flight tasting',
  },
];

const DEFAULT_HISTORY: PointsHistoryEntry[] = [
  { id: 'h1', activity: 'Kenya SL28 Purchase', date: 'OCT 24, 2024', status: 'completed', points: 450 },
  { id: 'h2', activity: 'Concierge Booking', date: 'OCT 20, 2024', status: 'completed', points: 1200 },
  { id: 'h3', activity: 'Referral Bonus', date: 'OCT 15, 2024', status: 'completed', points: 2000 },
];

const DEFAULT_STREAK: StreakDay[] = [
  { label: 'MON', checked: true },
  { label: 'TUE', checked: true },
  { label: 'WED', checked: true },
  { label: 'THU', checked: false },
  { label: 'FRI', checked: false },
  { label: 'SAT', checked: false },
];

const DEFAULT_BENEFITS: TierBenefit[] = [
  { label: 'Complementary valet parking' },
  { label: 'Priority reservation access' },
  { label: 'Invite-only tasting events' },
  { label: '15% Discount on retail gear' },
];

const DEFAULT_LOYALTY_DATA: LoyaltyDashboardData = {
  tierName: 'Platinum',
  memberSince: '2022',
  tierDescription:
    'You are in the top 2% of our community. Enjoy exclusive access to the Obsidian Lounge.',
  nextTier: 'Black Tier',
  pointsRemainingForNextTier: 2550,
  progressPercent: 78,
  pointsBalance: 12450,
  streakCount: 12,
  referralCode: 'AURA-PLAT-882',
  rewards: DEFAULT_REWARDS,
  pointsHistory: DEFAULT_HISTORY,
  streakDays: DEFAULT_STREAK,
  tierBenefits: DEFAULT_BENEFITS,
};

/* ─── Status Badge ─────────────────────────────────────────────────── */

function PointsStatusBadge({ status }: { status: PointsHistoryEntry['status'] }) {
  const config = {
    completed: { label: 'COMPLETED', class: 'border-[var(--aura-tertiary,#d4a574)]/40 text-[var(--aura-tertiary,#d4a574)]' },
    pending: { label: 'PENDING', class: 'border-[var(--aura-primary,#c6c6c7)]/30 text-[var(--aura-primary,#c6c6c7)]' },
    expired: { label: 'EXPIRED', class: 'border-[var(--aura-error,#ffb4ab)]/40 text-[var(--aura-error,#ffb4ab)]' },
  };
  const c = config[status];
  return (
    <span
      className={clsx(
        'inline-block px-2 py-0.5 rounded text-[10px] font-bold border leading-normal',
        c.class,
      )}
    >
      {c.label}
    </span>
  );
}

/* ─── Loading Skeleton ─────────────────────────────────────────────── */

function LoyaltySkeleton() {
  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--aura-bg-page, #0A1A2E)' }}>
      <div className="mx-auto max-w-[1440px] px-[var(--aura-container-padding,24px)] pt-8 pb-24">
        {/* Header skeleton */}
        <div className="mb-8 flex items-center justify-between">
          <div className="h-8 w-48 animate-pulse rounded" style={{ backgroundColor: 'var(--aura-bg-elevated, #162a3d)' }} />
          <div className="h-10 w-32 animate-pulse rounded-full" style={{ backgroundColor: 'var(--aura-bg-elevated, #162a3d)' }} />
        </div>

        {/* Hero skeleton */}
        <div className="mb-8 rounded-xl p-6" style={{ backgroundColor: 'var(--aura-bg-elevated, #162a3d)' }}>
          <div className="flex flex-col gap-6 md:flex-row">
            <div className="flex-1 space-y-4">
              <div className="h-6 w-32 animate-pulse rounded-full" style={{ backgroundColor: 'var(--aura-bg-high, #1e3550)' }} />
              <div className="h-10 w-64 animate-pulse rounded" style={{ backgroundColor: 'var(--aura-bg-high, #1e3550)' }} />
              <div className="h-4 w-80 animate-pulse rounded" style={{ backgroundColor: 'var(--aura-bg-high, #1e3550)' }} />
              <div className="h-2 w-full animate-pulse rounded-full" style={{ backgroundColor: 'var(--aura-bg-high, #1e3550)' }} />
            </div>
            <div className="h-32 w-48 animate-pulse rounded" style={{ backgroundColor: 'var(--aura-bg-high, #1e3550)' }} />
          </div>
        </div>

        {/* Grid skeleton */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-72 animate-pulse rounded-xl"
              style={{ backgroundColor: 'var(--aura-bg-elevated, #162a3d)' }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── Error State ─────────────────────────────────────────────────── */

function LoyaltyError({ message }: { message: string }) {
  return (
    <div
      className="flex min-h-[400px] flex-col items-center justify-center gap-4 rounded-xl p-8 text-center"
      style={{ backgroundColor: 'var(--aura-bg-surface, #0d1b2a)' }}
    >
      <AlertCircle className="h-12 w-12" style={{ color: 'var(--aura-error, #ffb4ab)' }} />
      <h3
        className="text-xl font-semibold"
        style={{
          fontFamily: 'var(--aura-font-display, "Cormorant Garamond", Georgia, serif)',
          color: 'var(--aura-text-primary, #e8e8e8)',
        }}
      >
        Failed to Load Loyalty Data
      </h3>
      <p style={{ color: 'var(--aura-text-secondary, #a0a8b0)' }}>{message}</p>
    </div>
  );
}

/* ─── Empty State ──────────────────────────────────────────────────── */

function LoyaltyEmpty() {
  return (
    <div
      className="flex min-h-[400px] flex-col items-center justify-center gap-4 rounded-xl p-8 text-center"
      style={{ backgroundColor: 'var(--aura-bg-surface, #0d1b2a)' }}
    >
      <Gift className="h-12 w-12" style={{ color: 'var(--aura-text-disabled, #5a6270)' }} />
      <h3
        className="text-xl font-semibold"
        style={{
          fontFamily: 'var(--aura-font-display, "Cormorant Garamond", Georgia, serif)',
          color: 'var(--aura-text-primary, #e8e8e8)',
        }}
      >
        No Loyalty Data Yet
      </h3>
      <p style={{ color: 'var(--aura-text-secondary, #a0a8b0)' }}>
        Start earning points with your first purchase.
      </p>
    </div>
  );
}

/* ─── Sub-Components ────────────────────────────────────────────── */

function TierCard({
  data,
  onRedeemPoints,
}: {
  data: LoyaltyDashboardData;
  onRedeemPoints?: () => void;
}) {
  return (
    <section className="stitch-loyalty-platinum-card rounded-xl p-[var(--aura-space-6,24px)] flex flex-col justify-between gap-[var(--aura-space-6,24px)] md:flex-row md:items-stretch">
      {/* Left: tier info + progress */}
      <div className="flex flex-col justify-between flex-1 min-w-0">
        <div>
          <div
            className="inline-block px-3 py-1 rounded-full text-[10px] font-bold tracking-[0.2em] uppercase mb-[var(--aura-space-3,12px)]"
            style={{
              backgroundColor: 'var(--aura-tertiary,#d4a574)/20',
              border: '1px solid var(--aura-tertiary,#d4a574)/40',
            }}
          >
            <span className="text-gradient-bronze">{data.tierName} Tier</span>
          </div>
          <h2
            className="text-[var(--aura-text-display-md,48px)] leading-[1.1] mb-2"
            style={{ fontFamily: 'var(--aura-font-display, "Cormorant Garamond", Georgia, serif)' }}
          >
            Member Since {data.memberSince}
          </h2>
          <p
            className="text-[var(--aura-text-secondary,#a0a8b0)] text-[var(--aura-text-body,16px)] leading-[var(--aura-lh-body,1.5)] opacity-80 max-w-xl"
            style={{ fontFamily: 'var(--aura-font-body, "Space Grotesk", system-ui, sans-serif)' }}
          >
            {data.tierDescription}
          </p>
        </div>

        <div className="mt-[var(--aura-space-10,40px)]">
          <div className="flex justify-between items-end mb-2">
            <span
              className="text-[var(--aura-text-label-sm,12px)] uppercase tracking-[0.1em] font-semibold"
              style={{
                color: 'var(--aura-text-secondary,#a0a8b0)',
                fontFamily: 'var(--aura-font-body, "Space Grotesk", system-ui, sans-serif)',
              }}
            >
              Next Level: {data.nextTier}
            </span>
            <span
              className="text-[var(--aura-text-label-sm,12px)] font-semibold"
              style={{
                color: 'var(--aura-tertiary,#d4a574)',
                fontFamily: 'var(--aura-font-body, "Space Grotesk", system-ui, sans-serif)',
              }}
            >
              {data.pointsRemainingForNextTier.toLocaleString()} pts remaining
            </span>
          </div>
          <div
            className="h-1.5 w-full rounded-full overflow-hidden"
            style={{ backgroundColor: 'var(--aura-bg-elevated, #162a3d)' }}
          >
            <div
              className="h-full rounded-full progress-bar-bronze"
              style={{ width: `${data.progressPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* Right: points balance */}
      <div className="flex flex-col items-end justify-between text-right min-w-[200px] flex-shrink-0">
        <span
          className="text-[var(--aura-text-label-sm,12px)] uppercase tracking-[0.1em] font-semibold"
          style={{
            color: 'var(--aura-text-secondary,#a0a8b0)',
            fontFamily: 'var(--aura-font-body, "Space Grotesk", system-ui, sans-serif)',
          }}
        >
          Balance
        </span>
        <div>
          <div
            className="text-[72px] leading-none font-light"
            style={{
              fontFamily: 'var(--aura-font-display, "Cormorant Garamond", Georgia, serif)',
              color: 'var(--aura-tertiary,#d4a574)',
            }}
          >
            {data.pointsBalance.toLocaleString()}
          </div>
          <div
            className="text-[var(--aura-text-label-sm,12px)] tracking-tight"
            style={{
              color: 'var(--aura-primary-container, #e2e2e2)',
              fontFamily: 'var(--aura-font-body, "Space Grotesk", system-ui, sans-serif)',
            }}
          >
            PREMIUM REWARD POINTS
          </div>
        </div>
        <button
          type="button"
          onClick={onRedeemPoints}
          className="mt-[var(--aura-space-5,20px)] w-full py-3 font-bold rounded-lg active:scale-95 transition-transform"
          style={{
            backgroundColor: 'var(--aura-tertiary,#d4a574)',
            color: 'var(--aura-on-tertiary,#1a1a2e)',
            fontFamily: 'var(--aura-font-body, "Space Grotesk", system-ui, sans-serif)',
          }}
        >
          Redeem Points
        </button>
      </div>
    </section>
  );
}

function RewardCard({
  reward,
  onClaim,
}: {
  reward: RewardItem;
  onClaim?: (id: string) => void;
}) {
  return (
    <div
      className="stitch-loyalty-reward-card rounded-xl overflow-hidden group cursor-pointer"
      onClick={() => onClaim?.(reward.id)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClaim?.(reward.id); }}
      role="button"
      tabIndex={0}
      aria-label={`Claim ${reward.title} for ${reward.pointsCost} points`}
    >
      <div className="h-40 relative overflow-hidden">
        <img
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
          src={reward.imageUrl}
          alt={reward.imageAlt}
          loading="lazy"
        />
        <div
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(to top, var(--aura-bg-page,#0A1A2E) 0%, transparent 100%)',
          }}
        />
      </div>
      <div className="p-[var(--aura-space-5,20px)]">
        <h4
          className="text-[var(--aura-text-body-lg,18px)] leading-[var(--aura-lh-body,1.5)] mb-1"
          style={{
            color: 'var(--aura-text-primary,#e8e8e8)',
            fontFamily: 'var(--aura-font-body, "Space Grotesk", system-ui, sans-serif)',
          }}
        >
          {reward.title}
        </h4>
        <p
          className="text-[var(--aura-text-label-sm,12px)] mb-4 font-semibold"
          style={{
            color: 'var(--aura-text-secondary,#a0a8b0)',
            fontFamily: 'var(--aura-font-body, "Space Grotesk", system-ui, sans-serif)',
          }}
        >
          {reward.pointsCost.toLocaleString()} POINTS
        </p>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onClaim?.(reward.id); }}
          className="w-full py-2 rounded text-[var(--aura-text-label-sm,12px)] font-bold transition-colors"
          style={{
            border: '1px solid var(--aura-border-card, rgba(255,255,255,0.08))',
            color: 'var(--aura-text-primary,#e8e8e8)',
            fontFamily: 'var(--aura-font-body, "Space Grotesk", system-ui, sans-serif)',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
        >
          Claim Reward
        </button>
      </div>
    </div>
  );
}

function PointsHistoryTable({ history }: { history: PointsHistoryEntry[] }) {
  if (history.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Ticket className="h-8 w-8 mb-3" style={{ color: 'var(--aura-text-disabled,#5a6270)' }} />
        <p
          className="text-[var(--aura-text-body,16px)]"
          style={{
            color: 'var(--aura-text-secondary,#a0a8b0)',
            fontFamily: 'var(--aura-font-body, "Space Grotesk", system-ui, sans-serif)',
          }}
        >
          No points history yet.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left">
        <thead>
          <tr className="border-b" style={{ borderColor: 'var(--aura-border-subtle, rgba(255,255,255,0.06))' }}>
            {['Activity', 'Date', 'Status', 'Points'].map((h) => (
              <th
                key={h}
                className="py-4 text-[var(--aura-text-label-sm,12px)] font-bold uppercase tracking-[0.1em] last:text-right"
                style={{
                  color: 'var(--aura-primary,#c6c6c7)',
                  fontFamily: 'var(--aura-font-body, "Space Grotesk", system-ui, sans-serif)',
                }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y" style={{ borderColor: 'var(--aura-border-subtle, rgba(255,255,255,0.06))' }}>
          {history.map((entry) => (
            <tr
              key={entry.id}
              className="transition-colors hover:bg-[rgba(255,255,255,0.03)]"
            >
              <td
                className="py-4"
                style={{
                  color: 'var(--aura-text-primary,#e8e8e8)',
                  fontFamily: 'var(--aura-font-body, "Space Grotesk", system-ui, sans-serif)',
                }}
              >
                {entry.activity}
              </td>
              <td
                className="py-4 text-[var(--aura-text-label-sm,12px)]"
                style={{
                  color: 'var(--aura-text-secondary,#a0a8b0)',
                  fontFamily: 'var(--aura-font-body, "Space Grotesk", system-ui, sans-serif)',
                }}
              >
                {entry.date}
              </td>
              <td className="py-4">
                <PointsStatusBadge status={entry.status} />
              </td>
              <td
                className="py-4 text-right font-bold"
                style={{
                  color: 'var(--aura-tertiary,#d4a574)',
                  fontFamily: 'var(--aura-font-body, "Space Grotesk", system-ui, sans-serif)',
                }}
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

function WeeklyStreak({
  days,
  streakCount,
  onCheckIn,
}: {
  days: StreakDay[];
  streakCount: number;
  onCheckIn?: () => void;
}) {
  return (
    <section
      className="rounded-xl p-[var(--aura-space-6,24px)]"
      style={{ backgroundColor: 'var(--aura-bg-glass, rgba(255,255,255,0.03))', backdropFilter: 'blur(var(--aura-glass-blur, 12px))', border: '1px solid var(--aura-glass-border, rgba(255,255,255,0.08))' }}
    >
      <h3
        className="mb-[var(--aura-space-6,24px)]"
        style={{
          fontFamily: 'var(--aura-font-display, "Cormorant Garamond", Georgia, serif)',
          fontSize: 'var(--aura-text-headline-md, 24px)',
          color: 'var(--aura-text-primary,#e8e8e8)',
        }}
      >
        Weekly Streak
      </h3>
      <div className="flex justify-between items-center gap-2">
        {days.map((day) => (
          <div key={day.label} className="flex flex-col items-center gap-2">
            <div
              className={clsx(
                'w-10 h-10 rounded-full flex items-center justify-center transition-colors',
                day.checked
                  ? 'border'
                  : 'border',
              )}
              style={{
                backgroundColor: day.checked ? 'var(--aura-tertiary,#d4a574)/10' : 'transparent',
                borderColor: day.checked
                  ? 'var(--aura-tertiary,#d4a574)/50'
                  : 'var(--aura-outline, #2a3f55)',
                color: day.checked
                  ? 'var(--aura-tertiary,#d4a574)'
                  : 'var(--aura-text-disabled,#5a6270)',
              }}
            >
              <Medal
                className={clsx('h-5 w-5', day.checked && 'fill-current')}
                style={{
                  fill: day.checked ? 'var(--aura-tertiary,#d4a574)' : 'none',
                }}
              />
            </div>
            <span
              className="text-[10px] font-bold"
              style={{
                color: day.checked ? 'var(--aura-tertiary,#d4a574)' : 'var(--aura-text-secondary,#a0a8b0)',
                fontFamily: 'var(--aura-font-body, "Space Grotesk", system-ui, sans-serif)',
              }}
            >
              {day.label}
            </span>
          </div>
        ))}
      </div>
      <p
        className="mt-[var(--aura-space-6,24px)] leading-relaxed"
        style={{
          color: 'var(--aura-text-secondary,#a0a8b0)',
          fontFamily: 'var(--aura-font-body, "Space Grotesk", system-ui, sans-serif)',
          fontSize: 'var(--aura-text-body, 16px)',
        }}
      >
        Check in today to maintain your{' '}
        <strong style={{ color: 'var(--aura-tertiary,#d4a574)' }}>
          {streakCount}-day streak
        </strong>{' '}
        and earn double points on your next pour.
      </p>
      <button
        type="button"
        onClick={onCheckIn}
        className="mt-4 w-full py-3 rounded-lg font-bold flex items-center justify-center gap-2 transition-all"
        style={{
          backgroundColor: 'var(--aura-bg-elevated, #162a3d)',
          border: '1px solid var(--aura-outline, #2a3f55)',
          color: 'var(--aura-text-primary,#e8e8e8)',
          fontFamily: 'var(--aura-font-body, "Space Grotesk", system-ui, sans-serif)',
          fontSize: 'var(--aura-text-body, 16px)',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--aura-tertiary,#d4a574)/40'; }}
        onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--aura-outline, #2a3f55)'; }}
      >
        <MapPin className="h-[20px] w-[20px]" />
        Check-in at Roastery
      </button>
    </section>
  );
}

function ReferralBlock({
  code,
  onShare,
}: {
  code: string;
  onShare?: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(code).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [code]);

  return (
    <section
      className="rounded-xl p-[var(--aura-space-6,24px)] relative overflow-hidden"
      style={{ backgroundColor: 'var(--aura-bg-glass, rgba(255,255,255,0.03))', backdropFilter: 'blur(var(--aura-glass-blur, 12px))', border: '1px solid var(--aura-glass-border, rgba(255,255,255,0.08))' }}
    >
      {/* Glow orb */}
      <div
        className="absolute -right-10 -top-10 w-32 h-32 blur-[64px] pointer-events-none"
        style={{ backgroundColor: 'var(--aura-tertiary,#d4a574)/10' }}
      />
      <h3
        className="mb-2"
        style={{
          fontFamily: 'var(--aura-font-display, "Cormorant Garamond", Georgia, serif)',
          fontSize: 'var(--aura-text-headline-md, 24px)',
          color: 'var(--aura-text-primary,#e8e8e8)',
        }}
      >
        Refer &amp; Earn
      </h3>
      <p
        className="mb-[var(--aura-space-5,20px)]"
        style={{
          color: 'var(--aura-text-secondary,#a0a8b0)',
          fontFamily: 'var(--aura-font-body, "Space Grotesk", system-ui, sans-serif)',
          fontSize: 'var(--aura-text-body, 16px)',
        }}
      >
        Invite another connoisseur. When they join, you both receive 2,000 premium points.
      </p>
      <div
        className="flex items-center justify-between p-[var(--aura-space-3,12px)] rounded border mb-4"
        style={{
          backgroundColor: 'var(--aura-bg-surface, #0d1b2a)',
          borderColor: 'var(--aura-border-subtle, rgba(255,255,255,0.06))',
        }}
      >
        <span
          className="text-[24px] tracking-widest font-light"
          style={{
            color: 'var(--aura-tertiary,#d4a574)',
            fontFamily: 'var(--aura-font-display, "Cormorant Garamond", Georgia, serif)',
          }}
        >
          {code}
        </span>
        <button
          type="button"
          onClick={handleCopy}
          className={clsx(
            'flex items-center gap-1 text-[var(--aura-text-label-sm,12px)] font-bold active:scale-90 transition-all',
            copied ? 'text-[var(--aura-success,#4CAF50)]' : 'text-[var(--aura-tertiary,#d4a574)] hover:text-white',
          )}
          style={{ fontFamily: 'var(--aura-font-body, "Space Grotesk", system-ui, sans-serif)' }}
          aria-label={copied ? 'Code copied' : 'Copy referral code'}
        >
          {copied ? (
            <Check className="h-[18px] w-[18px]" />
          ) : (
            <Copy className="h-[18px] w-[18px]" />
          )}
          {copied ? 'COPIED' : 'COPY'}
        </button>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          className="flex-1 py-2 rounded flex items-center justify-center transition-all"
          style={{
            backgroundColor: 'rgba(255,255,255,0.05)',
            border: '1px solid var(--aura-outline, #2a3f55)',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)'; }}
          aria-label="Share referral code"
        >
          <Share2 className="h-4 w-4" style={{ color: 'var(--aura-text-secondary,#a0a8b0)' }} />
        </button>
        <button
          type="button"
          onClick={onShare}
          className="flex-[3] py-2 rounded font-bold transition-all active:scale-95"
          style={{
            backgroundColor: 'var(--aura-tertiary,#d4a574)',
            color: 'var(--aura-on-tertiary,#1a1a2e)',
            fontFamily: 'var(--aura-font-body, "Space Grotesk", system-ui, sans-serif)',
          }}
        >
          Share Invite Link
        </button>
      </div>
    </section>
  );
}

function TierBenefits({ benefits }: { benefits: TierBenefit[] }) {
  return (
    <section
      className="rounded-xl p-[var(--aura-space-6,24px)]"
      style={{ backgroundColor: 'var(--aura-bg-glass, rgba(255,255,255,0.03))', backdropFilter: 'blur(var(--aura-glass-blur, 12px))', border: '1px solid var(--aura-glass-border, rgba(255,255,255,0.08))' }}
    >
      <h3
        className="mb-[var(--aura-space-6,24px)] text-[var(--aura-text-label-sm,12px)] uppercase tracking-[0.2em] font-semibold"
        style={{
          color: 'var(--aura-text-secondary,#a0a8b0)',
          fontFamily: 'var(--aura-font-body, "Space Grotesk", system-ui, sans-serif)',
        }}
      >
        Tier Benefits
      </h3>
      <ul className="flex flex-col gap-[var(--aura-space-3,12px)]">
        {benefits.map((benefit) => (
          <li key={benefit.label} className="flex items-center gap-[var(--aura-space-3,12px)] group">
            <span
              className="w-1.5 h-1.5 rounded-full transition-transform group-hover:scale-150"
              style={{ backgroundColor: 'var(--aura-tertiary,#d4a574)' }}
            />
            <span
              style={{
                color: 'var(--aura-text-primary,#e8e8e8)',
                fontFamily: 'var(--aura-font-body, "Space Grotesk", system-ui, sans-serif)',
                fontSize: 'var(--aura-text-body, 16px)',
              }}
            >
              {benefit.label}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ─── Main Component ─────────────────────────────────────────────── */

export default function StitchLoyalty({
  data = DEFAULT_LOYALTY_DATA,
  loadingState = 'idle',
  errorMessage = 'An unexpected error occurred. Please try again.',
  onRedeemPoints,
  onClaimReward,
  onCheckIn,
  onShareReferral,
}: Readonly<StitchLoyaltyProps>) {
  /* ─── Loading State ─────────────────────────────────────────── */
  if (loadingState === 'loading') {
    return <LoyaltySkeleton />;
  }

  /* ─── Error State ───────────────────────────────────────────── */
  if (loadingState === 'error') {
    return (
      <div
        className="min-h-screen flex items-center justify-center p-[var(--aura-container-padding,24px)]"
        style={{ backgroundColor: 'var(--aura-bg-page, #0A1A2E)' }}
      >
        <LoyaltyError message={errorMessage} />
      </div>
    );
  }

  /* ─── Empty State ───────────────────────────────────────────── */
  if (!data || data.pointsBalance === 0) {
    return (
      <div
        className="min-h-screen flex items-center justify-center p-[var(--aura-container-padding,24px)]"
        style={{ backgroundColor: 'var(--aura-bg-page, #0A1A2E)' }}
      >
        <LoyaltyEmpty />
      </div>
    );
  }

  return (
    <div
      className="min-h-screen"
      style={{ backgroundColor: 'var(--aura-bg-page, #0A1A2E)' }}
    >
      <div className="mx-auto max-w-[1440px] px-[var(--aura-container-padding,24px)]">

        {/* Tier Card */}
        <div className="pt-[var(--aura-space-12,48px)] pb-[var(--aura-space-8,32px)]">
          <TierCard data={data} onRedeemPoints={onRedeemPoints} />
        </div>

        {/* Two-column layout */}
        <div className="grid grid-cols-1 gap-[var(--aura-grid-gap,20px)] lg:grid-cols-12">

          {/* ─── Left Column: Rewards + History ──────────────────── */}
          <div className="flex flex-col gap-[var(--aura-section-margin,48px)] lg:col-span-8">

            {/* Rewards Grid */}
            <section>
              <div className="flex justify-between items-center mb-[var(--aura-space-6,24px)]">
                <h3
                  className="text-[var(--aura-text-headline-md,24px)]"
                  style={{
                    fontFamily: 'var(--aura-font-display, "Cormorant Garamond", Georgia, serif)',
                    color: 'var(--aura-text-primary,#e8e8e8)',
                  }}
                >
                  Available Rewards
                </h3>
                <button
                  type="button"
                  className="text-[var(--aura-text-label-sm,12px)] uppercase tracking-[0.1em] font-bold hover:underline"
                  style={{
                    color: 'var(--aura-tertiary,#d4a574)',
                    fontFamily: 'var(--aura-font-body, "Space Grotesk", system-ui, sans-serif)',
                  }}
                >
                  View All
                </button>
              </div>

              {data.rewards.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center rounded-xl" style={{ backgroundColor: 'var(--aura-bg-glass, rgba(255,255,255,0.03))' }}>
                  <Sparkles className="h-8 w-8 mb-3" style={{ color: 'var(--aura-text-disabled,#5a6270)' }} />
                  <p
                    style={{
                      color: 'var(--aura-text-secondary,#a0a8b0)',
                      fontFamily: 'var(--aura-font-body, "Space Grotesk", system-ui, sans-serif)',
                    }}
                  >
                    No rewards available right now.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-[var(--aura-grid-gap,20px)]">
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
              className="rounded-xl p-[var(--aura-space-6,24px)] overflow-hidden"
              style={{ backgroundColor: 'var(--aura-bg-glass, rgba(255,255,255,0.03))', backdropFilter: 'blur(var(--aura-glass-blur, 12px))', border: '1px solid var(--aura-glass-border, rgba(255,255,255,0.08))' }}
            >
              <div className="flex justify-between items-center mb-[var(--aura-space-6,24px)]">
                <h3
                  className="text-[var(--aura-text-headline-md,24px)]"
                  style={{
                    fontFamily: 'var(--aura-font-display, "Cormorant Garamond", Georgia, serif)',
                    color: 'var(--aura-text-primary,#e8e8e8)',
                  }}
                >
                  Points History
                </h3>
                <button
                  type="button"
                  className="transition-colors"
                  style={{ color: 'var(--aura-text-secondary,#a0a8b0)' }}
                  aria-label="Filter history"
                >
                  <Filter className="h-5 w-5" />
                </button>
              </div>
              <PointsHistoryTable history={data.pointsHistory} />
            </section>

          </div>

          {/* ─── Right Column: Streak, Referral, Benefits ─────── */}
          <div className="flex flex-col gap-[var(--aura-section-margin,48px)] lg:col-span-4">

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

      {/* Custom styles */}
      <style>{`
        .stitch-loyalty-platinum-card {
          background: linear-gradient(135deg, rgba(212,165,116,0.12) 0%, rgba(10,26,46,0.4) 100%);
          backdrop-filter: blur(32px);
          -webkit-backdrop-filter: blur(32px);
          border: 1px solid rgba(212,165,116,0.25);
          position: relative;
          overflow: hidden;
        }
        .stitch-loyalty-platinum-card::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: url('https://www.transparenttextures.com/patterns/brushed-alum.png');
          opacity: 0.04;
          pointer-events: none;
        }
        .stitch-loyalty-reward-card {
          background: rgba(13,27,42,0.4);
          backdrop-filter: blur(24px);
          -webkit-backdrop-filter: blur(24px);
          border: 1px solid rgba(255,255,255,0.05);
          transition: all 0.5s;
        }
        .stitch-loyalty-reward-card:hover {
          border-color: rgba(212,165,116,0.35);
        }
        .progress-bar-bronze {
          background: linear-gradient(90deg, #8e4e00 0%, #cd7f32 50%, #ffb779 100%);
          box-shadow: 0 0 20px rgba(205,127,50,0.25);
          transition: width 0.6s ease;
        }
        .text-gradient-bronze {
          background: linear-gradient(90deg, #cd7f32, #ffb779);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .nocturnal-vibe-bg {
          background: radial-gradient(circle at 50% -20%, rgba(212,165,116,0.08) 0%, transparent 70%);
        }
      `}</style>
    </div>
  );
}
