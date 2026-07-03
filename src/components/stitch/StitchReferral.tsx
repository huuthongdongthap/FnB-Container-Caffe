/**
 * StitchReferral — AURA CAFE Referral Program (Stitch design)
 *
 * Dark navy glassmorphism referral page with hero earnings card,
 * referral code + copy + share buttons, progress tracker to next tier,
 * friend network list, and reward history table.
 * Source: Stitch AI referral/design.html export.
 * Mobile-first responsive.
 */
'use client';

import { useState, useCallback } from 'react';
import { clsx } from 'clsx';
import {
  Gift,
  Copy,
  Check,
  Share2,
  Users,
  MessageSquare,
  MessageCircle,
  Smartphone,
  ChevronRight,
  Loader2,
  AlertCircle,
  UserPlus,
  Medal,
} from 'lucide-react';

/* ─── Types ────────────────────────────────────────────────────────── */

export interface ReferralFriend {
  id: string;
  name: string;
  joinedDate: string;
  avatarUrl: string;
  avatarAlt: string;
  status: 'active' | 'joined';
}

export interface RewardRow {
  id: string;
  date: string;
  source: string;
  amount: number;
}

export interface ReferralPageData {
  rewardAmount: number;
  referralCode: string;
  currentReferrals: number;
  targetReferrals: number;
  progressPercent: number;
  friends: ReferralFriend[];
  rewardHistory: RewardRow[];
}

export type LoadingState = 'idle' | 'loading' | 'error';

export interface StitchReferralProps {
  data?: ReferralPageData;
  loadingState?: LoadingState;
  errorMessage?: string;
  onCopyCode?: (code: string) => void;
  onShareVia?: (method: string) => void;
  onViewProfile?: (friendId: string) => void;
}

/* ─── Default Mock Data ────────────────────────────────────────────── */

const DEFAULT_FRIENDS: ReferralFriend[] = [
  {
    id: 'f1',
    name: 'Julian Vane',
    joinedDate: 'Oct 24, 2023',
    avatarUrl:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuCCsMYxIHtob9JKtxjb7suRYqr5__2Hw9P7CA4URv5UGE_A5lVWKHmdY8gvm_L4ONs_Xgk6m4dgUVPPDtp2wJ38gq5zZYyOXOz-VzUXB2Fc9yiYdQ5emWHdpNxpKO9qOZ90tGzbxNb3KySLjgHYoHOxPmZnfiCxEiasd4DALpMfRMKrlYENasQqBLAXM3yvVzQ6lrAMD_Q0nZR-OP74kJaoeqxgnJ3PyqCxv5lArGeN3OyG9a_JaCtK6C35GZXg1a8ZcZ8Ke02kfVA',
    avatarAlt: 'Close-up professional headshot with low-key lighting',
    status: 'active',
  },
  {
    id: 'f2',
    name: 'Elara Thorne',
    joinedDate: 'Oct 21, 2023',
    avatarUrl:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuCnw47a61SI7BhBWRqukVEuJa8EHBcJ10d5YxwdW8Hj75pcZD5MZ94QcnctDwJr_8gu52kZDmC787bnx5moad2McEjvwfRMFAzgOorFjpQCRg8gXEzRrTUrI686eGHgkQVl6qEu0SDUzRugW3cvUfbQ9bAT3Iv9t6bbxmTAoQWNngMqL4-9XUMPM7fm2bWuvVS4ASKQ_6p2R5C9vtBYeTq4MClEMUgy9gnUqCO41i-l-okHBVIT8hgzDuHn46X0GhZn1mtKK4Y3TSU',
    avatarAlt: 'Chic young professional in dark luxury interior',
    status: 'joined',
  },
  {
    id: 'f3',
    name: 'Marcus Chen',
    joinedDate: 'Oct 15, 2023',
    avatarUrl:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuBJ8QWOurR1Uxm8azubKFd7S_F9-B-s9G9KZneCjhJZRIVTcHSWebDFRyEHZx8BhafXKS5KXWWGzeVKn9sgkYLS0VBlRYpIHoAWr8ySSNRYbV4Me5q17j9L1rH8EVVWxPd4Xj252gDehlC1MVdfSTkK31_EMLzlvhz3FaNOZjVqQXL0CRjXKjWIH0sXP5bGPFkMzD34SsKknuo_emLP7dqsxqpo9AoXL4q05vmF7wMgDUD8VI0K2aDb3pvuWugqrQD0xDPOXql8ixU',
    avatarAlt: 'Distinguished individual with sharp modern haircut in neon glow',
    status: 'active',
  },
];

const DEFAULT_HISTORY: RewardRow[] = [
  { id: 'h1', date: '24 Oct', source: 'J. Vane', amount: 15.0 },
  { id: 'h2', date: '21 Oct', source: 'E. Thorne', amount: 15.0 },
  { id: 'h3', date: '15 Oct', source: 'M. Chen', amount: 15.0 },
];

const DEFAULT_REFERRAL_DATA: ReferralPageData = {
  rewardAmount: 15.0,
  referralCode: 'AURA-LUXE-88',
  currentReferrals: 3,
  targetReferrals: 5,
  progressPercent: 60,
  friends: DEFAULT_FRIENDS,
  rewardHistory: DEFAULT_HISTORY,
};

/* ─── Share methods ────────────────────────────────────────────────── */

const SHARE_METHODS = [
  { key: 'zalo', icon: MessageSquare, label: 'Zalo' },
  { key: 'messenger', icon: MessageCircle, label: 'Messenger' },
  { key: 'sms', icon: Smartphone, label: 'SMS' },
];

/* ─── Loading Skeleton ─────────────────────────────────────────────── */

function ReferralSkeleton() {
  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--aura-bg-page, #0A1A2E)' }}>
      <div className="mx-auto max-w-[600px] px-[var(--aura-container-padding,20px)] pt-20 pb-32">
        {/* Hero skeleton */}
        <div className="mb-8 rounded-xl p-6 text-center" style={{ backgroundColor: 'var(--aura-bg-elevated, #162a3d)' }}>
          <div className="mx-auto mb-4 h-4 w-24 animate-pulse rounded" style={{ backgroundColor: 'var(--aura-bg-high, #1e3550)' }} />
          <div className="mx-auto mb-2 h-10 w-40 animate-pulse rounded" style={{ backgroundColor: 'var(--aura-bg-high, #1e3550)' }} />
          <div className="mx-auto h-4 w-56 animate-pulse rounded" style={{ backgroundColor: 'var(--aura-bg-high, #1e3550)' }} />
        </div>

        {/* Code skeleton */}
        <div className="mb-8 space-y-3">
          <div className="h-14 animate-pulse rounded-lg" style={{ backgroundColor: 'var(--aura-bg-elevated, #162a3d)' }} />
          <div className="h-12 animate-pulse rounded-lg" style={{ backgroundColor: 'var(--aura-bg-elevated, #162a3d)' }} />
        </div>

        {/* Progress skeleton */}
        <div className="mb-8 space-y-3">
          <div className="h-4 w-40 animate-pulse rounded" style={{ backgroundColor: 'var(--aura-bg-elevated, #162a3d)' }} />
          <div className="h-2 w-full animate-pulse rounded-full" style={{ backgroundColor: 'var(--aura-bg-elevated, #162a3d)' }} />
        </div>

        {/* List skeleton */}
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 rounded-xl p-3" style={{ backgroundColor: 'var(--aura-bg-elevated, #162a3d)' }}>
              <div className="h-10 w-10 animate-pulse rounded-lg" style={{ backgroundColor: 'var(--aura-bg-high, #1e3550)' }} />
              <div className="flex-1 space-y-1">
                <div className="h-4 w-24 animate-pulse rounded" style={{ backgroundColor: 'var(--aura-bg-high, #1e3550)' }} />
                <div className="h-3 w-32 animate-pulse rounded" style={{ backgroundColor: 'var(--aura-bg-high, #1e3550)' }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── Error State ──────────────────────────────────────────────────── */

function ReferralError({ message }: { message: string }) {
  return (
    <div
      className="flex min-h-[400px] flex-col items-center justify-center gap-4 rounded-xl p-8 text-center"
      style={{ backgroundColor: 'var(--aura-bg-surface, #0d1b2a)' }}
    >
      <AlertCircle className="h-12 w-12" style={{ color: 'var(--aura-error, #ffb4ab)' }} />
      <h3
        className="text-xl font-semibold"
        style={{
          fontFamily: 'var(--aura-font-display, "EB Garamond", Georgia, serif)',
          color: 'var(--aura-text-primary, #e8e8e8)',
        }}
      >
        Failed to Load Referral Data
      </h3>
      <p style={{ color: 'var(--aura-text-secondary, #a0a8b0)' }}>{message}</p>
    </div>
  );
}

/* ─── Empty State ──────────────────────────────────────────────────── */

function ReferralEmpty() {
  return (
    <div
      className="flex min-h-[400px] flex-col items-center justify-center gap-4 rounded-xl p-8 text-center"
      style={{ backgroundColor: 'var(--aura-bg-surface, #0d1b2a)' }}
    >
      <UserPlus className="h-12 w-12" style={{ color: 'var(--aura-text-disabled, #5a6270)' }} />
      <h3
        className="text-xl font-semibold"
        style={{
          fontFamily: 'var(--aura-font-display, "EB Garamond", Georgia, serif)',
          color: 'var(--aura-text-primary, #e8e8e8)',
        }}
      >
        No Referral Activity
      </h3>
      <p style={{ color: 'var(--aura-text-secondary, #a0a8b0)' }}>
        Share your code to start earning rewards.
      </p>
    </div>
  );
}

/* ─── Sub-Components ───────────────────────────────────────────────── */

function HeroEarningsCard({ rewardAmount }: { rewardAmount: number }) {
  return (
    <section className="mb-8">
      <div className="glass-card-referral relative overflow-hidden rounded-xl p-6 text-center">
        {/* Glow orb */}
        <div
          className="absolute -right-24 -top-24 h-48 w-48 rounded-full blur-[80px]"
          style={{ backgroundColor: 'rgba(212, 165, 116, 0.1)' }}
        />

        <span
          className="mb-2 block font-label-md text-xs uppercase tracking-[0.2em]"
          style={{ color: 'var(--aura-text-secondary, #a0a8b0)' }}
        >
          Refer &amp; Earn
        </span>
        <h1
          className="mb-2"
          style={{
            fontFamily: 'var(--aura-font-display, "EB Garamond", Georgia, serif)',
            fontSize: 'var(--aura-text-display-lg, 48px)',
            lineHeight: '1.1',
            letterSpacing: '-0.02em',
            color: 'var(--aura-secondary, #efbd8a)',
          }}
        >
          Receive ${rewardAmount.toFixed(2)}
        </h1>
        <p
          className="mx-auto max-w-[280px]"
          style={{
            color: 'var(--aura-text-secondary, #a0a8b0)',
            fontFamily: 'var(--aura-font-body, "Hanken Grotesk", system-ui, sans-serif)',
          }}
        >
          Share the Aura experience with your inner circle and earn rewards for every successful invitation.
        </p>

        <div
          className="mt-6 h-px w-full"
          style={{
            background: 'linear-gradient(to right, transparent, rgba(255,255,255,0.1), transparent)',
          }}
        />
      </div>
    </section>
  );
}

function ReferralCodeBlock({
  code,
  onCopyCode,
}: {
  code: string;
  onCopyCode?: (code: string) => void;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(code).catch(() => {});
    setCopied(true);
    onCopyCode?.(code);
    setTimeout(() => setCopied(false), 2000);
  }, [code, onCopyCode]);

  return (
    <section className="mb-8">
      <div className="flex flex-col gap-3">
        {/* Code display */}
        <div
          className="chrome-border-referral flex items-center justify-between rounded-lg p-4"
          style={{ backgroundColor: 'var(--aura-bg-surface, #121c2a)' }}
        >
          <span
            className="font-mono text-xl tracking-widest"
            style={{
              color: 'var(--aura-text-primary, #e8e8e8)',
              fontFamily: 'var(--aura-font-display, "EB Garamond", Georgia, serif)',
            }}
          >
            {code}
          </span>
          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center gap-1 active:scale-95"
            style={{ color: 'var(--aura-secondary, #efbd8a)' }}
            aria-label={copied ? 'Code copied' : 'Copy referral code'}
          >
            {copied ? (
              <Check className="h-5 w-5" style={{ color: 'var(--aura-success, #4CAF50)' }} />
            ) : (
              <Copy className="h-5 w-5" />
            )}
          </button>
        </div>

        {/* Copy button */}
        <button
          type="button"
          onClick={handleCopy}
          className="bronze-gradient-referral w-full rounded-lg py-4 font-label-md font-bold uppercase tracking-widest active:scale-[0.98]"
          style={{
            boxShadow: '0 0 20px rgba(212, 165, 116, 0.15)',
            color: 'var(--aura-surface-container-lowest, #050f1c)',
          }}
        >
          {copied ? 'Code Copied!' : 'Copy Code'}
        </button>

        {/* Share buttons */}
        <div className="scroll-hide-referral mt-2 flex gap-3 overflow-x-auto py-2">
          {SHARE_METHODS.map((method) => {
            const Icon = method.icon;
            return (
              <button
                key={method.key}
                type="button"
                onClick={() => onCopyCode?.(method.key)}
                className="glass-card-referral flex shrink-0 items-center gap-2 rounded-full border px-5 py-2 active:scale-95"
                style={{ borderColor: 'rgba(255,255,255,0.05)' }}
              >
                <Icon className="h-[18px] w-[18px]" />
                <span className="font-label-sm text-sm">{method.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function ProgressTracker({
  current,
  target,
  percent,
}: {
  current: number;
  target: number;
  percent: number;
}) {
  return (
    <section className="mb-8">
      <div className="mb-3 flex items-end justify-between">
        <div>
          <h3
            className="text-xl"
            style={{
              color: 'var(--aura-secondary, #efbd8a)',
              fontFamily: 'var(--aura-font-display, "EB Garamond", Georgia, serif)',
            }}
          >
            Path to Platinum
          </h3>
          <p
            className="font-label-sm text-xs opacity-60"
            style={{ color: 'var(--aura-text-secondary, #a0a8b0)' }}
          >
            Unlock $50 exclusive bonus
          </p>
        </div>
        <div className="text-right">
          <span
            className="text-xl"
            style={{
              color: 'var(--aura-secondary, #efbd8a)',
              fontFamily: 'var(--aura-font-display, "EB Garamond", Georgia, serif)',
            }}
          >
            {current}/{target}
          </span>
          <p
            className="font-label-sm text-xs uppercase opacity-60"
            style={{ color: 'var(--aura-text-secondary, #a0a8b0)' }}
          >
            Referrals
          </p>
        </div>
      </div>

      <div className="relative h-2 w-full overflow-hidden rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.05)' }}>
        <div
          className="bronze-gradient-referral h-full rounded-full transition-all duration-1000 ease-out"
          style={{ width: `${percent}%`, boxShadow: '0 0 20px rgba(212, 165, 116, 0.15)' }}
        />
      </div>

      <div className="mt-1 flex justify-between px-1">
        {Array.from({ length: target }).map((_, i) => (
          <span
            key={i}
            className="h-1 w-1 rounded-full"
            style={{
              backgroundColor: i < current
                ? 'var(--aura-secondary, #efbd8a)'
                : 'rgba(255,255,255,0.2)',
              boxShadow: i === current - 1 ? '0 0 8px #d4a574' : 'none',
            }}
          />
        ))}
      </div>
    </section>
  );
}

function FriendNetwork({ friends }: { friends: ReferralFriend[] }) {
  if (friends.length === 0) {
    return (
      <section className="mb-8">
        <h3
          className="mb-4 border-l-2 pl-3 font-label-md text-xs uppercase tracking-widest"
          style={{
            color: 'var(--aura-text-secondary, #a0a8b0)',
            borderColor: 'var(--aura-secondary, #efbd8a)',
          }}
        >
          Recent Network
        </h3>
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <Users className="mb-3 h-8 w-8" style={{ color: 'var(--aura-text-disabled, #5a6270)' }} />
          <p style={{ color: 'var(--aura-text-secondary, #a0a8b0)' }}>
            No referrals yet. Share your code to get started.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="mb-8">
      <h3
        className="mb-4 border-l-2 pl-3 font-label-md text-xs uppercase tracking-widest"
        style={{
          color: 'var(--aura-text-secondary, #a0a8b0)',
          borderColor: 'var(--aura-secondary, #efbd8a)',
        }}
      >
        Recent Network
      </h3>
      <div className="space-y-3">
        {friends.map((friend) => (
          <div
            key={friend.id}
            className="glass-card-referral flex items-center justify-between rounded-xl p-3"
          >
            <div className="flex items-center gap-3">
              <div
                className="h-10 w-10 shrink-0 overflow-hidden rounded-lg"
                style={{ border: '1px solid rgba(255,255,255,0.05)' }}
              >
                <img
                  className="h-full w-full object-cover"
                  src={friend.avatarUrl}
                  alt={friend.avatarAlt}
                  loading="lazy"
                />
              </div>
              <div>
                <p
                  className="font-medium"
                  style={{
                    color: 'var(--aura-text-primary, #e8e8e8)',
                    fontFamily: 'var(--aura-font-body, "Hanken Grotesk", system-ui, sans-serif)',
                  }}
                >
                  {friend.name}
                </p>
                <p
                  className="font-label-sm text-xs opacity-50"
                  style={{ color: 'var(--aura-text-secondary, #a0a8b0)' }}
                >
                  Joined {friend.joinedDate}
                </p>
              </div>
            </div>
            <span
              className={clsx(
                'rounded-full border px-3 py-1 font-label-sm text-xs',
                friend.status === 'active'
                  ? 'border-[rgba(212,165,116,0.2)]'
                  : 'border-[rgba(255,255,255,0.1)]',
              )}
              style={{
                backgroundColor:
                  friend.status === 'active'
                    ? 'rgba(212, 165, 116, 0.1)'
                    : 'rgba(255,255,255,0.05)',
                color:
                  friend.status === 'active'
                    ? 'var(--aura-secondary, #efbd8a)'
                    : 'var(--aura-text-secondary, #a0a8b0)',
                boxShadow:
                  friend.status === 'active' ? '0 0 20px rgba(212, 165, 116, 0.15)' : 'none',
              }}
            >
              {friend.status === 'active' ? 'Active' : 'Joined'}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

function RewardHistory({
  history,
}: {
  history: RewardRow[];
}) {
  if (history.length === 0) {
    return (
      <section className="mb-20">
        <h3
          className="mb-4 border-l-2 pl-3 font-label-md text-xs uppercase tracking-widest"
          style={{
            color: 'var(--aura-text-secondary, #a0a8b0)',
            borderColor: 'var(--aura-secondary, #efbd8a)',
          }}
        >
          Reward History
        </h3>
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <Gift className="mb-3 h-8 w-8" style={{ color: 'var(--aura-text-disabled, #5a6270)' }} />
          <p style={{ color: 'var(--aura-text-secondary, #a0a8b0)' }}>
            No rewards yet. Start referring friends to earn.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="mb-20">
      <h3
        className="mb-4 border-l-2 pl-3 font-label-md text-xs uppercase tracking-widest"
        style={{
          color: 'var(--aura-text-secondary, #a0a8b0)',
          borderColor: 'var(--aura-secondary, #efbd8a)',
        }}
      >
        Reward History
      </h3>
      <div
        className="chrome-border-referral overflow-hidden rounded-xl"
        style={{ backgroundColor: 'rgba(18, 28, 42, 0.5)' }}
      >
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b" style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
              {['Date', 'Source', 'Amount'].map((h) => (
                <th
                  key={h}
                  className="p-4 font-label-sm text-xs font-bold uppercase tracking-wider opacity-60"
                  style={{
                    color: 'var(--aura-text-secondary, #a0a8b0)',
                    fontFamily: 'var(--aura-font-body, "Hanken Grotesk", system-ui, sans-serif)',
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
            {history.map((row) => (
              <tr
                key={row.id}
                className="transition-colors hover:bg-[rgba(255,255,255,0.03)]"
              >
                <td
                  className="p-4"
                  style={{ color: 'var(--aura-text-secondary, #a0a8b0)' }}
                >
                  {row.date}
                </td>
                <td
                  className="p-4"
                  style={{
                    color: 'var(--aura-text-primary, #e8e8e8)',
                    fontFamily: 'var(--aura-font-body, "Hanken Grotesk", system-ui, sans-serif)',
                  }}
                >
                  {row.source}
                </td>
                <td
                  className="p-4 text-right font-medium"
                  style={{
                    color: 'var(--aura-secondary, #efbd8a)',
                    fontFamily: 'var(--aura-font-body, "Hanken Grotesk", system-ui, sans-serif)',
                  }}
                >
                  +${row.amount.toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/* ─── Main Component ───────────────────────────────────────────────── */

export default function StitchReferral({
  data = DEFAULT_REFERRAL_DATA,
  loadingState = 'idle',
  errorMessage = 'An unexpected error occurred. Please try again.',
  onCopyCode,
  onShareVia,
  onViewProfile,
}: Readonly<StitchReferralProps>) {
  /* ─── Loading State ─────────────────────────────────────────── */
  if (loadingState === 'loading') {
    return <ReferralSkeleton />;
  }

  /* ─── Error State ───────────────────────────────────────────── */
  if (loadingState === 'error') {
    return (
      <div
        className="flex min-h-screen items-center justify-center p-[var(--aura-container-padding,20px)]"
        style={{ backgroundColor: 'var(--aura-bg-page, #0A1A2E)' }}
      >
        <ReferralError message={errorMessage} />
      </div>
    );
  }

  /* ─── Empty State ───────────────────────────────────────────── */
  if (!data) {
    return (
      <div
        className="flex min-h-screen items-center justify-center p-[var(--aura-container-padding,20px)]"
        style={{ backgroundColor: 'var(--aura-bg-page, #0A1A2E)' }}
      >
        <ReferralEmpty />
      </div>
    );
  }

  return (
    <div
      className="min-h-screen pb-32"
      style={{
        backgroundColor: 'var(--aura-bg-page, #091421)',
        color: 'var(--aura-text-primary, #e8e8e8)',
        fontFamily: 'var(--aura-font-body, "Hanken Grotesk", system-ui, sans-serif)',
      }}
    >
      <main
        className="mx-auto max-w-[600px] px-[var(--aura-container-padding,20px)] pt-20"
        style={{
          backgroundImage: 'radial-gradient(rgba(212, 165, 116, 0.05) 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }}
      >
        {/* ── Section 1: Hero Earnings Card ───────────────────────── */}
        <HeroEarningsCard rewardAmount={data.rewardAmount} />

        {/* ── Section 2: Referral Code + Share ────────────────────── */}
        <ReferralCodeBlock code={data.referralCode} onCopyCode={onCopyCode} />

        {/* ── Section 3: Progress Tracker ─────────────────────────── */}
        <ProgressTracker
          current={data.currentReferrals}
          target={data.targetReferrals}
          percent={data.progressPercent}
        />

        {/* ── Section 4: Friend Network ───────────────────────────── */}
        <FriendNetwork friends={data.friends} />

        {/* ── Section 5: Reward History ──────────────────────────── */}
        <RewardHistory history={data.rewardHistory} />
      </main>

      {/* Custom styles */}
      <style>{`
        .glass-card-referral {
          background: rgba(18, 28, 42, 0.4);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.08);
        }
        .chrome-border-referral {
          border: 1px solid transparent;
          background: linear-gradient(#121c2a, #121c2a) padding-box,
                      linear-gradient(135deg, #E5E7EB 0%, rgba(229, 231, 235, 0.2) 100%) border-box;
        }
        .bronze-gradient-referral {
          background: linear-gradient(180deg, #efbd8a 0%, #d4a574 100%);
        }
        .scroll-hide-referral::-webkit-scrollbar {
          display: none;
        }
        .scroll-hide-referral {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  );
}
