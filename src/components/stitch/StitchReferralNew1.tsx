/**
 * StitchReferralNew1 -- AURA CAFE Referral Rewards (Stitch design, New version)
 *
 * Dark navy glassmorphism referral page with hero earnings card,
 * referral code + copy + share buttons, progress tracker to next tier,
 * friend network list, and reward history table.
 * Mobile-first responsive. Named export.
 * Source: Stitch AI aura_cafe_referral_rewards_1/code.html export.
 *
 * Pixel-perfect against original HTML -- every Tailwind class, hex color,
 * spacing unit, font size, and layout structure matches the source.
 */
'use client';

import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Copy, Check, MessageCircle, MessageSquare, MessagesSquare, UtensilsCrossed, UserPlus, Medal, User, AlertCircle, Gift } from 'lucide-react';

/* ─── Types ────────────────────────────────────────────────────────── */

export interface ReferralFriendEntry {
  id: string;
  name: string;
  joinedDate: string;
  avatarUrl: string;
  avatarAlt: string;
  status: 'active' | 'joined';
}

export interface RewardHistoryRow {
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
  friends: ReferralFriendEntry[];
  rewardHistory: RewardHistoryRow[];
}

export type ReferralLoadingState = 'idle' | 'loading' | 'error';

export interface StitchReferralNew1Props {
  data?: ReferralPageData;
  loadingState?: ReferralLoadingState;
  errorMessage?: string;
  onCopyCode?: (code: string) => void;
  onShareVia?: (method: string) => void;
  onViewProfile?: (friendId: string) => void;
}

/* ─── Loading Skeleton ─────────────────────────────────────────────── */

function ReferralSkeleton() {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen bg-[#0A1A2E]">
      <div className="px-5 pb-32 pt-20" role="status" aria-label={t('stitch.referral.loadingAria')}>
        {/* Hero skeleton */}
        <div className="mb-10 mt-2">
          <div className="relative overflow-hidden rounded-xl bg-[rgba(18,28,42,0.4)] p-6 text-center backdrop-blur-[20px]">
            <div className="mx-auto mb-1 h-4 w-24 animate-pulse rounded bg-[rgba(255,255,255,0.08)]" />
            <div className="mx-auto mb-1 h-12 w-44 animate-pulse rounded bg-[rgba(255,255,255,0.08)]" />
            <div className="mx-auto h-4 w-56 animate-pulse rounded bg-[rgba(255,255,255,0.08)]" />
          </div>
        </div>

        {/* Code skeleton */}
        <div className="mb-10">
          <div className="flex flex-col gap-3">
            <div className="h-14 animate-pulse rounded-lg bg-[#121c2a]" />
            <div className="h-12 animate-pulse rounded-lg bg-[#121c2a]" />
          </div>
        </div>

        {/* Progress skeleton */}
        <div className="mb-10">
          <div className="mb-3 h-4 w-36 animate-pulse rounded bg-[rgba(255,255,255,0.08)]" />
          <div className="h-2 w-full animate-pulse rounded-full bg-white/5" />
        </div>

        {/* List skeleton */}
        <div className="flex flex-col gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 rounded-xl bg-[rgba(18,28,42,0.4)] p-3">
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

function ReferralError({ message }: { message: string }) {
  const { t } = useTranslation();
  return (
    <div
      className="flex min-h-[400px] flex-col items-center justify-center gap-4 rounded-xl bg-[rgba(18,28,42,0.4)] p-8 text-center backdrop-blur-[20px]"
      role="alert"
      aria-live="assertive"
    >
      <AlertCircle className="h-12 w-12 text-[#ffb4ab]" />
      <h3 className="font-display text-xl font-semibold text-[#d9e3f6]">
        {t('stitch.referral.errorTitle', { defaultValue: 'Something went wrong' })}
      </h3>
      <p className="text-[#c5c6cd]">{message}</p>
    </div>
  );
}

/* ─── Empty State ──────────────────────────────────────────────────── */

function ReferralEmpty() {
  const { t } = useTranslation();
  return (
    <div
      className="flex min-h-[400px] flex-col items-center justify-center gap-4 rounded-xl bg-[rgba(18,28,42,0.4)] p-8 text-center backdrop-blur-[20px]"
      role="status"
    >
      <Gift className="h-12 w-12 text-[#8e9097]" />
      <h3 className="font-display text-xl font-semibold text-[#d9e3f6]">
        {t('stitch.referral.emptyTitle', { defaultValue: 'No referrals yet' })}
      </h3>
      <p className="text-[#c5c6cd]">
        {t('stitch.referral.emptyDesc', { defaultValue: 'Share your code and start earning rewards.' })}
      </p>
    </div>
  );
}

/* ─── Hero Earnings Card ───────────────────────────────────────────── */

function HeroEarningsCard({ rewardAmount }: { rewardAmount: number }) {
  const { t } = useTranslation();
  return (
    <section className="mt-2 mb-10" aria-label={t('stitch.referral.heroAria')}>
      <div className="relative overflow-hidden rounded-xl p-6 flex flex-col items-center text-center"
        style={{
          background: 'rgba(18, 28, 42, 0.4)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
        }}
      >
        {/* Atmospheric background element */}
        <div className="absolute -top-24 -right-24 w-48 h-48 rounded-full blur-[80px] pointer-events-none"
          style={{ backgroundColor: 'rgba(212, 165, 116, 0.1)' }}
        />
        <span className="font-body text-[14px] leading-[1.2] font-semibold uppercase tracking-[0.2em] text-[#c5c6cd] mb-1">
          {t('stitch.referral.heroTagline', { defaultValue: 'Refer & Earn' })}
        </span>
        <h1 className="font-display text-[48px] leading-[1.1] tracking-[-0.02em] font-medium text-[#efbd8a] mb-1">
          {t('stitch.referral.heroAmount', { defaultValue: `Receive $${rewardAmount.toFixed(2)}`, amount: rewardAmount.toFixed(2) })}
        </h1>
        <p className="font-body text-base leading-[1.5] text-[#c5c6cd] max-w-[280px]">
          {t('stitch.referral.heroDescription', { defaultValue: 'Share the Aura experience with your inner circle and earn rewards for every successful invitation.' })}
        </p>
        <div className="mt-6 w-full h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      </div>
    </section>
  );
}

/* ─── Referral Code Block ──────────────────────────────────────────── */

function ReferralCodeBlock({
  code,
  onCopyCode,
}: {
  code: string;
  onCopyCode?: (code: string) => void;
}) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  const SHARE_METHODS = [
    { key: 'zalo', icon: MessageCircle, label: 'Zalo' },
    { key: 'messenger', icon: MessageSquare, label: 'Messenger' },
    { key: 'sms', icon: MessagesSquare, label: 'SMS' },
  ];

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(code).catch(() => {});
    setCopied(true);
    onCopyCode?.(code);
    setTimeout(() => setCopied(false), 2000);
  }, [code, onCopyCode]);

  return (
    <section className="mb-10" aria-label={t('stitch.referral.referralCodeSectionAria')}>
      <div className="flex flex-col gap-3">
        {/* Code display -- chrome-border */}
        <div
          className="rounded-lg p-6 flex justify-between items-center bg-[#121c2a]"
          style={{
            border: '1px solid transparent',
            background: 'linear-gradient(#121c2a, #121c2a) padding-box, linear-gradient(135deg, #E5E7EB 0%, rgba(229, 231, 235, 0.2) 100%) border-box',
          }}
        >
          <span className="font-body text-[24px] leading-[1.2] font-medium font-mono tracking-widest text-[#d9e3f6]">
            {code}
          </span>
          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center gap-1 text-[#efbd8a] active:scale-95 transition-transform"
            aria-label={
              copied
                ? t('stitch.referral.copiedAria')
                : t('stitch.referral.copyAria')
            }
          >
            {copied ? (
              <Check className="h-5 w-5 text-green-400" />
            ) : (
              <Copy className="h-5 w-5" />
            )}
          </button>
        </div>

        {/* Copy Code -- bronze gradient button */}
        <button
          type="button"
          onClick={handleCopy}
          className="w-full py-4 rounded-lg font-body text-[14px] leading-[1.2] font-semibold uppercase tracking-widest text-[#050f1c] transition-all active:scale-[0.98]"
          style={{
            background: 'linear-gradient(180deg, #efbd8a 0%, #d4a574 100%)',
            boxShadow: '0 0 20px rgba(212, 165, 116, 0.15)',
          }}
        >
          {copied
            ? t('stitch.referral.codeCopied', { defaultValue: 'Copied!' })
            : t('stitch.referral.copyCode', { defaultValue: 'Copy Code' })
          }
        </button>

        {/* Share buttons -- scrollable row */}
        <div
          className="mt-3 flex justify-between items-center overflow-x-auto gap-3 py-2"
          style={{ msOverflowStyle: 'none', scrollbarWidth: 'none' }}
        >
          <style>{`.stitch-scroll-hide::-webkit-scrollbar { display: none; }`}</style>
          {SHARE_METHODS.map((method) => {
            const IconComp = method.icon;
            return (
              <button
                key={method.key}
                type="button"
                className="flex-shrink-0 flex items-center gap-1 px-6 py-2 rounded-full border border-white/[0.05] active:scale-95 transition-transform"
                style={{
                  background: 'rgba(18, 28, 42, 0.4)',
                  backdropFilter: 'blur(20px)',
                  WebkitBackdropFilter: 'blur(20px)',
                }}
                aria-label={t('stitch.referral.shareViaAria', { method: method.label })}
              >
                <IconComp className="h-[18px] w-[18px] text-[#efbd8a]" />
                <span className="font-body text-[12px] leading-[1.2] font-medium text-[#c5c6cd]">
                  {method.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ─── Progress Tracker ─────────────────────────────────────────────── */

function ProgressTracker({
  current,
  target,
  percent,
}: {
  current: number;
  target: number;
  percent: number;
}) {
  const { t } = useTranslation();
  return (
    <section className="mb-10" aria-label={t('stitch.referral.progressAria')}>
      <div className="flex justify-between items-end mb-3">
        <div>
          <h3 className="font-display text-[24px] leading-[1.2] font-medium text-[#efbd8a]">
            {t('stitch.referral.progressTitle', { defaultValue: 'Path to Platinum' })}
          </h3>
          <p className="font-body text-[12px] leading-[1.2] font-medium text-[#c5c6cd] opacity-60">
            {t('stitch.referral.progressDesc', { defaultValue: 'Unlock $50 exclusive bonus' })}
          </p>
        </div>
        <div className="text-right">
          <span className="font-display text-[24px] leading-[1.2] font-medium text-[#efbd8a]">
            {current}/{target}
          </span>
          <p className="font-body text-[12px] leading-[1.2] font-medium text-[#c5c6cd] opacity-60 uppercase">
            {t('stitch.referral.referrals', { defaultValue: 'Referrals' })}
          </p>
        </div>
      </div>

      {/* Progress bar -- bronze gradient */}
      <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-1000 ease-out"
          style={{
            width: `${percent}%`,
            background: 'linear-gradient(180deg, #efbd8a 0%, #d4a574 100%)',
            boxShadow: '0 0 20px rgba(212, 165, 116, 0.15)',
          }}
        />
      </div>

      {/* Progress dots -- milestone dot (4th) highlighted */}
      <div className="flex justify-between mt-1 px-1">
        {Array.from({ length: target }).map((_, i) => {
          // HTML: indices 0,1,2 = white/20, index 3 = secondary + glow, index 4 = white/20
          const isHighlighted = i === 3;
          return (
            <span
              key={i}
              className="w-1 h-1 rounded-full"
              style={{
                backgroundColor: isHighlighted ? '#efbd8a' : 'rgba(255,255,255,0.2)',
                boxShadow: isHighlighted ? '0 0 8px #d4a574' : 'none',
              }}
            />
          );
        })}
      </div>
    </section>
  );
}

/* ─── Friend Network ───────────────────────────────────────────────── */

function FriendNetwork({
  friends,
  onViewProfile,
}: {
  friends: ReferralFriendEntry[];
  onViewProfile?: (friendId: string) => void;
}) {
  const { t } = useTranslation();

  if (friends.length === 0) {
    return (
      <section className="mb-10" aria-label={t('stitch.referral.networkTitle')}>
        <h3 className="font-body text-[14px] leading-[1.2] font-semibold tracking-[0.05em] text-[#c5c6cd] uppercase tracking-widest mb-6 border-l-2 border-[#efbd8a] pl-3">
          {t('stitch.referral.networkTitle', { defaultValue: 'Recent Network' })}
        </h3>
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <p className="font-body text-base text-[#c5c6cd]">
            {t('stitch.referral.friendsEmpty', { defaultValue: 'No friends yet. Share your code!' })}
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="mb-10" aria-label={t('stitch.referral.networkTitle')}>
      <h3 className="font-body text-[14px] leading-[1.2] font-semibold tracking-[0.05em] text-[#c5c6cd] uppercase tracking-widest mb-6 border-l-2 border-[#efbd8a] pl-3">
        {t('stitch.referral.networkTitle', { defaultValue: 'Recent Network' })}
      </h3>
      <div className="space-y-3">
        {friends.map((friend) => (
          <div
            key={friend.id}
            className="p-3 rounded-xl flex items-center justify-between"
            style={{
              background: 'rgba(18, 28, 42, 0.4)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
            }}
          >
            <div
              className="flex items-center gap-3 flex-1 cursor-pointer"
              onClick={() => onViewProfile?.(friend.id)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onViewProfile?.(friend.id);
                }
              }}
            >
              <div className="w-10 h-10 rounded-lg overflow-hidden" style={{ border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                <img
                  className="w-full h-full object-cover"
                  src={friend.avatarUrl}
                  alt={friend.avatarAlt}
                  loading="lazy"
                />
              </div>
              <div>
                <p className="font-body text-base leading-[1.5] font-medium text-[#d9e3f6]">
                  {friend.name}
                </p>
                <p className="font-body text-[12px] leading-[1.2] font-medium text-[#c5c6cd] opacity-50">
                  {t('stitch.referral.joinedAt', { defaultValue: `Joined ${friend.joinedDate}`, date: friend.joinedDate })}
                </p>
              </div>
            </div>
            <span
              className="font-body text-[12px] leading-[1.2] font-medium py-1 px-3 rounded-full"
              style={
                friend.status === 'active'
                  ? {
                      backgroundColor: 'rgba(212, 165, 116, 0.1)',
                      color: '#efbd8a',
                      border: '1px solid rgba(212, 165, 116, 0.2)',
                      boxShadow: '0 0 20px rgba(212, 165, 116, 0.15)',
                    }
                  : {
                      backgroundColor: 'rgba(255, 255, 255, 0.05)',
                      color: '#c5c6cd',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                    }
              }
            >
              {friend.status === 'active'
                ? t('stitch.referral.statusActive', { defaultValue: 'Active' })
                : t('stitch.referral.statusJoined', { defaultValue: 'Joined' })
              }
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ─── Reward History ───────────────────────────────────────────────── */

function RewardHistory({
  history,
}: {
  history: RewardHistoryRow[];
}) {
  const { t } = useTranslation();

  if (history.length === 0) {
    return (
      <section className="mb-16" aria-label={t('stitch.referral.rewardsTitle')}>
        <h3 className="font-body text-[14px] leading-[1.2] font-semibold tracking-[0.05em] text-[#c5c6cd] uppercase tracking-widest mb-6 border-l-2 border-[#efbd8a] pl-3">
          {t('stitch.referral.rewardsTitle', { defaultValue: 'Reward History' })}
        </h3>
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <p className="font-body text-base text-[#c5c6cd]">
            {t('stitch.referral.rewardsEmpty', { defaultValue: 'No rewards yet.' })}
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="mb-16" aria-label={t('stitch.referral.rewardsTitle')}>
      <h3 className="font-body text-[14px] leading-[1.2] font-semibold tracking-[0.05em] text-[#c5c6cd] uppercase tracking-widest mb-6 border-l-2 border-[#efbd8a] pl-3">
        {t('stitch.referral.rewardsTitle', { defaultValue: 'Reward History' })}
      </h3>
      <div
        className="rounded-xl overflow-hidden"
        style={{
          border: '1px solid transparent',
          background: 'linear-gradient(rgba(18,28,42,0.5), rgba(18,28,42,0.5)) padding-box, linear-gradient(135deg, #E5E7EB 0%, rgba(229, 231, 235, 0.2) 100%) border-box',
        }}
      >
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-white/[0.1]">
              <th className="p-6 font-body text-[12px] leading-[1.2] font-medium uppercase tracking-wider text-[#c5c6cd] opacity-60">
                {t('stitch.referral.colDate', { defaultValue: 'Date' })}
              </th>
              <th className="p-6 font-body text-[12px] leading-[1.2] font-medium uppercase tracking-wider text-[#c5c6cd] opacity-60">
                {t('stitch.referral.colSource', { defaultValue: 'Source' })}
              </th>
              <th className="p-6 text-right font-body text-[12px] leading-[1.2] font-medium uppercase tracking-wider text-[#c5c6cd] opacity-60">
                {t('stitch.referral.colAmount', { defaultValue: 'Amount' })}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.05]">
            {history.map((row) => (
              <tr key={row.id} className="hover:bg-white/5 transition-colors">
                <td className="p-6 font-body text-base leading-[1.5] text-[#c5c6cd]">
                  {row.date}
                </td>
                <td className="p-6 font-body text-base leading-[1.5] text-[#d9e3f6]">
                  {row.source}
                </td>
                <td className="p-6 text-right font-body text-base leading-[1.5] font-medium text-[#efbd8a]">
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

export function StitchReferralNew1({
  data: externalData,
  loadingState = 'idle',
  errorMessage: externalErrorMsg = '',
  onCopyCode,
  onShareVia,
  onViewProfile,
}: Readonly<StitchReferralNew1Props>) {
  const { t } = useTranslation();

  const errorMessage = externalErrorMsg || t('stitch.referral.defaultError', { defaultValue: 'Failed to load referral data.' });

  const DEFAULT_FRIENDS: ReferralFriendEntry[] = [
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

  const DEFAULT_HISTORY: RewardHistoryRow[] = [
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

  const data = externalData ?? DEFAULT_REFERRAL_DATA;

  /* ─── Loading State ─────────────────────────────────────────── */
  if (loadingState === 'loading') {
    return <ReferralSkeleton />;
  }

  /* ─── Error State ───────────────────────────────────────────── */
  if (loadingState === 'error') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0A1A2E] px-5">
        <ReferralError message={errorMessage} />
      </div>
    );
  }

  /* ─── Empty State ───────────────────────────────────────────── */
  if (!data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0A1A2E] px-5">
        <ReferralEmpty />
      </div>
    );
  }

  return (
    <div
      className="min-h-screen bg-[#0A1A2E] font-body text-[#d9e3f6]"
      style={{
        WebkitFontSmoothing: 'antialiased',
      }}
    >
      {/* ── Header: TopAppBar ───────────────────────────────────── */}
      <header
        className="fixed top-0 w-full z-50 bg-[#091421]/80 backdrop-blur-xl border-b border-white/10 flex justify-between items-center px-5 h-16 shadow-none"
        role="banner"
        aria-label={t('stitch.referral.headerAria')}
      >
        <button
          type="button"
          className="text-[#efbd8a] hover:opacity-80 transition-opacity active:scale-95 transition-transform"
          aria-label={t('stitch.referral.closeAria')}
        >
          <X className="h-6 w-6" />
        </button>
        <span className="font-display text-[24px] leading-[1.2] font-medium tracking-widest text-[#efbd8a]">
          AURA CAFE
        </span>
        <div className="w-8 h-8 rounded-full overflow-hidden" style={{ border: '1px solid rgba(239, 189, 138, 0.3)' }}>
          <img
            className="w-full h-full object-cover"
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuBh-JKKrdKFObQU9h8Wnj2vKscgz4U9ak0LI7UIhXw18eDS0I6JPVZo-UPpwccmzw0tgUErqepBlzn43qBcDykg7E5WrkdatYzNJ2qtopegH_jBtchV2C1rQ7Kkp8pTkRGqpbshu_APsPuW51WiPlPjLAkoVg0Zzjm8JTaGzys_UzLAeaP2FpN6P8h3yaWvK70iK5dqfU1djDZMEwH8LZZ0vcAy7AkpOkRAlsfJpGhk035Js4uPSr_RlL69GNxbiZwHhKAV4pYaTd8"
            alt={t('stitch.referral.profileAvatarAlt')}
            loading="lazy"
          />
        </div>
      </header>

      {/* ── Main Content ───────────────────────────────────────── */}
      <main
        className="pt-20 px-5 pb-32"
        style={{
          backgroundImage: 'radial-gradient(rgba(212, 165, 116, 0.05) 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }}
      >
        {/* Section 1: Hero Earnings Card */}
        <HeroEarningsCard rewardAmount={data.rewardAmount} />

        {/* Section 2: Referral Code + Share */}
        <ReferralCodeBlock code={data.referralCode} onCopyCode={onCopyCode} />

        {/* Section 3: Progress Tracker */}
        <ProgressTracker
          current={data.currentReferrals}
          target={data.targetReferrals}
          percent={data.progressPercent}
        />

        {/* Section 4: Friend Network */}
        <FriendNetwork friends={data.friends} onViewProfile={onViewProfile} />

        {/* Section 5: Reward History */}
        <RewardHistory history={data.rewardHistory} />
      </main>

      {/* ── Navigation: BottomNavBar ─────────────────────────────── */}
      <nav
        className="fixed bottom-0 w-full z-50 rounded-t-xl bg-[#121c2a]/90 backdrop-blur-2xl border-t border-white/5 flex justify-around items-center h-20 px-2"
        style={{ boxShadow: '0 -4px 20px rgba(0,0,0,0.5)' }}
        role="navigation"
        aria-label={t('stitch.referral.navAria')}
      >
        {/* Menu */}
        <a
          href="/menu"
          className="flex flex-col items-center justify-center text-[#c5c6cd] opacity-60 hover:text-[#efbd8a] transition-colors active:scale-90 transition-transform"
          aria-label={t('stitch.referral.navMenuAria')}
        >
          <UtensilsCrossed className="h-6 w-6" />
          <span className="font-body text-[12px] leading-[1.2] font-medium">{t('stitch.referral.navMenu', { defaultValue: 'Menu' })}</span>
        </a>

        {/* Referrals (active) */}
        <a
          href="/referrals"
          className="flex flex-col items-center justify-center text-[#efbd8a] rounded-xl px-3 py-1 active:scale-90 transition-transform"
          style={{
            backgroundColor: 'rgba(100, 66, 26, 0.2)',
            boxShadow: '0 0 15px rgba(212, 165, 116, 0.15)',
          }}
          aria-current="page"
          aria-label={t('stitch.referral.navReferralsAria')}
        >
          <UserPlus className="h-6 w-6" />
          <span className="font-body text-[12px] leading-[1.2] font-medium">{t('stitch.referral.navReferrals', { defaultValue: 'Referrals' })}</span>
        </a>

        {/* Rewards */}
        <a
          href="/rewards"
          className="flex flex-col items-center justify-center text-[#c5c6cd] opacity-60 hover:text-[#efbd8a] transition-colors active:scale-90 transition-transform"
          aria-label={t('stitch.referral.navRewardsAria')}
        >
          <Medal className="h-6 w-6" />
          <span className="font-body text-[12px] leading-[1.2] font-medium">{t('stitch.referral.navRewards', { defaultValue: 'Rewards' })}</span>
        </a>

        {/* Profile */}
        <a
          href="/profile"
          className="flex flex-col items-center justify-center text-[#c5c6cd] opacity-60 hover:text-[#efbd8a] transition-colors active:scale-90 transition-transform"
          aria-label={t('stitch.referral.navProfileAria')}
        >
          <User className="h-6 w-6" />
          <span className="font-body text-[12px] leading-[1.2] font-medium">{t('stitch.referral.navProfile', { defaultValue: 'Profile' })}</span>
        </a>
      </nav>
    </div>
  );
}
