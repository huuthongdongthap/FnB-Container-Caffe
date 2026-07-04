/**
 * StitchReferralNew1 — AURA CAFE Referral Rewards (Stitch design, New version)
 *
 * Dark navy glassmorphism referral page with hero earnings card,
 * referral code + copy + share buttons, progress tracker to next tier,
 * friend network list, and reward history table.
 * Mobile-first responsive. Named export.
 * Source: Stitch AI aura_cafe_referral_rewards_1/code.html export.
 */
'use client';

import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';

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

/* ─── SVG Icon Components ─────────────────────────────────────────── */

function CloseIcon({ className = 'h-6 w-6' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  );
}

function CopyIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
    </svg>
  );
}

function CheckIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function ChatIcon({ className = 'h-[18px] w-[18px]' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
    </svg>
  );
}

function ForumIcon({ className = 'h-[18px] w-[18px]' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
      <path d="M8 10h.01M12 10h.01M16 10h.01" strokeWidth={2} />
    </svg>
  );
}

function SmsIcon({ className = 'h-[18px] w-[18px]' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
      <path d="M10 8h3" />
      <path d="M10 12h6" />
    </svg>
  );
}

function MenuIcon({ className = 'h-6 w-6' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
      <path d="M4 12h16M4 6h16M4 18h16" />
    </svg>
  );
}

function GroupAddIcon({ className = 'h-6 w-6' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
      <path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
      <circle cx="8.5" cy="7" r="4" />
      <line x1="20" y1="8" x2="20" y2="14" />
      <line x1="23" y1="11" x2="17" y2="11" />
    </svg>
  );
}

function MedalIcon({ className = 'h-6 w-6' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
  );
}

function PersonIcon({ className = 'h-6 w-6' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
      <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function AlertCircleIcon({ className = 'h-12 w-12' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}

function GiftIcon({ className = 'h-12 w-12' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
      <polyline points="20 12 20 22 4 22 4 12" />
      <rect x="2" y="7" width="20" height="5" />
      <line x1="12" y1="22" x2="12" y2="7" />
      <path d="M12 7H7.5a2.5 2.5 0 010-5C11 2 12 7 12 7z" />
      <path d="M12 7h4.5a2.5 2.5 0 000-5C13 2 12 7 12 7z" />
    </svg>
  );
}

/* ─── Loading Skeleton ─────────────────────────────────────────────── */

function ReferralSkeleton() {
  return (
    <div className="min-h-screen bg-[var(--aura-bg-page, #0A1A2E)]">
      <div className="mx-auto max-w-[600px] px-5 pt-20 pb-32">
        {/* Hero skeleton */}
        <div className="mb-8 rounded-xl bg-[#162a3d]/60 p-6 text-center backdrop-blur-xl">
          <div className="mx-auto mb-4 h-4 w-24 animate-pulse rounded bg-[#1e3550]" />
          <div className="mx-auto mb-2 h-10 w-40 animate-pulse rounded bg-[#1e3550]" />
          <div className="mx-auto h-4 w-56 animate-pulse rounded bg-[#1e3550]" />
        </div>

        {/* Code skeleton */}
        <div className="mb-8 space-y-3">
          <div className="h-14 animate-pulse rounded-lg bg-[#162a3d]" />
          <div className="h-12 animate-pulse rounded-lg bg-[#162a3d]" />
        </div>

        {/* Progress skeleton */}
        <div className="mb-8 space-y-3">
          <div className="h-4 w-40 animate-pulse rounded bg-[#162a3d]" />
          <div className="h-2 w-full animate-pulse rounded-full bg-[#162a3d]" />
        </div>

        {/* List skeleton */}
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 rounded-xl bg-[#162a3d] p-3">
              <div className="h-10 w-10 animate-pulse rounded-lg bg-[#1e3550]" />
              <div className="flex-1 space-y-1">
                <div className="h-4 w-24 animate-pulse rounded bg-[#1e3550]" />
                <div className="h-3 w-32 animate-pulse rounded bg-[#1e3550]" />
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
      className="flex min-h-[400px] flex-col items-center justify-center gap-4 rounded-xl bg-[var(--aura-bg-surface, #071c33)]/80 p-8 text-center"
      role="alert"
      aria-live="assertive"
    >
      <AlertCircleIcon className="h-12 w-12 text-[#ffb4ab]" />
      <h3 className="font-display text-xl font-semibold text-[var(--aura-text-primary, #e8e8e8)]">
        {t('stitch.referral.errorTitle')}
      </h3>
      <p className="text-[var(--aura-text-secondary, #a0a8b0)]">{message}</p>
    </div>
  );
}

/* ─── Empty State ──────────────────────────────────────────────────── */

function ReferralEmpty() {
  const { t } = useTranslation();
  return (
    <div
      className="flex min-h-[400px] flex-col items-center justify-center gap-4 rounded-xl bg-[var(--aura-bg-surface, #071c33)]/80 p-8 text-center"
      role="status"
    >
      <GiftIcon className="h-12 w-12 text-[#5a6270]" />
      <h3 className="font-display text-xl font-semibold text-[var(--aura-text-primary, #e8e8e8)]">
        {t('stitch.referral.emptyTitle')}
      </h3>
      <p className="text-[var(--aura-text-secondary, #a0a8b0)]">{t('stitch.referral.emptyDesc')}</p>
    </div>
  );
}

/* ─── Hero Earnings Card ───────────────────────────────────────────── */

function HeroEarningsCard({ rewardAmount }: { rewardAmount: number }) {
  const { t } = useTranslation();
  return (
    <section
      className="mb-8"
      aria-label={t('stitch.referral.heroAria')}
    >
      <div className="relative overflow-hidden rounded-xl bg-[#121c2a]/40 p-6 text-center backdrop-blur-xl backdrop-filter"
        style={{ border: '1px solid rgba(255,255,255,0.08)' }}
      >
        {/* Glow orb */}
        <div
          className="pointer-events-none absolute -right-24 -top-24 h-48 w-48 rounded-full blur-[80px]"
          style={{ backgroundColor: 'rgba(212, 165, 116, 0.1)' }}
        />

        <span
          className="mb-2 block font-body text-xs font-semibold uppercase tracking-[0.2em] text-[var(--aura-text-secondary, #a0a8b0)]"
        >
          {t('stitch.referral.heroTagline')}
        </span>
        <h1
          className="mb-2 font-display text-[40px] leading-tight tracking-[-0.02em] sm:text-[48px] sm:leading-[1.1] text-[#efbd8a]"
        >
          {t('stitch.referral.heroAmount', { amount: rewardAmount.toFixed(2) })}
        </h1>
        <p className="mx-auto max-w-[280px] font-body text-base leading-relaxed text-[var(--aura-text-secondary, #a0a8b0)]">
          {t('stitch.referral.heroDescription')}
        </p>

        <div className="mx-auto mt-6 h-px w-full bg-gradient-to-r from-transparent via-white/10 to-transparent" />
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
    { key: 'zalo', icon: ChatIcon, label: 'Zalo' },
    { key: 'messenger', icon: ForumIcon, label: 'Messenger' },
    { key: 'sms', icon: SmsIcon, label: 'SMS' },
  ];

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(code).catch(() => {});
    setCopied(true);
    onCopyCode?.(code);
    setTimeout(() => setCopied(false), 2000);
  }, [code, onCopyCode]);

  return (
    <section
      className="mb-8"
      aria-label={t('stitch.referral.referralCodeSectionAria')}
    >
      <div className="flex flex-col gap-3">
        {/* Code display */}
        <div
          className="flex items-center justify-between rounded-lg bg-[#121c2a] p-4"
          style={{
            border: '1px solid transparent',
            backgroundClip: 'padding-box',
            backgroundImage: 'linear-gradient(#121c2a, #121c2a), linear-gradient(135deg, #E5E7EB 0%, rgba(229, 231, 235, 0.2) 100%)',
            backgroundOrigin: 'padding-box, border-box',
            backgroundRepeat: 'no-repeat',
          }}
        >
          <span
            className="font-display text-xl tracking-widest text-[var(--aura-text-primary, #e8e8e8)]"
          >
            {code}
          </span>
          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center gap-1 text-[#efbd8a] transition-transform active:scale-95"
            aria-label={
              copied
                ? t('stitch.referral.copiedAria')
                : t('stitch.referral.copyAria')
            }
          >
            {copied ? (
              <CheckIcon className="h-5 w-5 text-[#4CAF50]" />
            ) : (
              <CopyIcon className="h-5 w-5" />
            )}
          </button>
        </div>

        {/* Copy button */}
        <button
          type="button"
          onClick={handleCopy}
          className="w-full rounded-lg py-4 font-body text-sm font-semibold uppercase tracking-widest text-[#050f1c] transition-all active:scale-[0.98]"
          style={{
            background: 'linear-gradient(180deg, #efbd8a 0%, #d4a574 100%)',
            boxShadow: '0 0 20px rgba(212, 165, 116, 0.15)',
          }}
        >
          {copied ? t('stitch.referral.codeCopied') : t('stitch.referral.copyCode')}
        </button>

        {/* Share buttons */}
        <div
          className="mt-2 flex gap-3 overflow-x-auto py-2"
          style={{ msOverflowStyle: 'none', scrollbarWidth: 'none' }}
        >
          <style>{`.scroll-hide-referral::-webkit-scrollbar { display: none; }`}</style>
          {SHARE_METHODS.map((method) => {
            const Icon = method.icon;
            return (
              <button
                key={method.key}
                type="button"
                onClick={() => onCopyCode?.(method.key)}
                className="flex shrink-0 items-center gap-2 rounded-full border border-white/[0.05] bg-[#121c2a]/40 px-5 py-2 backdrop-blur-xl transition-transform active:scale-95"
                aria-label={t('stitch.referral.shareViaAria', { method: method.label })}
              >
                <Icon />
                <span className="font-body text-xs font-medium text-[var(--aura-text-primary, #e8e8e8)]">{method.label}</span>
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
    <section
      className="mb-8"
      aria-label={t('stitch.referral.progressAria')}
    >
      <div className="mb-3 flex items-end justify-between">
        <div>
          <h3 className="font-display text-2xl text-[#efbd8a]">
            {t('stitch.referral.progressTitle')}
          </h3>
          <p className="font-body text-xs text-[var(--aura-text-secondary, #a0a8b0)] opacity-60">
            {t('stitch.referral.progressDesc')}
          </p>
        </div>
        <div className="text-right">
          <span className="font-display text-2xl text-[#efbd8a]">
            {current}/{target}
          </span>
          <p className="font-body text-xs uppercase text-[var(--aura-text-secondary, #a0a8b0)] opacity-60">
            {t('stitch.referral.referrals')}
          </p>
        </div>
      </div>

      <div className="relative h-2 w-full overflow-hidden rounded-full bg-white/[0.05]">
        <div
          className="h-full rounded-full transition-all duration-1000 ease-out"
          style={{
            width: `${percent}%`,
            background: 'linear-gradient(180deg, #efbd8a 0%, #d4a574 100%)',
            boxShadow: '0 0 20px rgba(212, 165, 116, 0.15)',
          }}
        />
      </div>

      <div className="mt-1 flex justify-between px-1">
        {Array.from({ length: target }).map((_, i) => (
          <span
            key={i}
            className="h-1 w-1 rounded-full"
            style={{
              backgroundColor: i < current ? '#efbd8a' : 'rgba(255,255,255,0.2)',
              boxShadow: i === current - 1 ? '0 0 8px #d4a574' : 'none',
            }}
          />
        ))}
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
      <section className="mb-8" aria-label={t('stitch.referral.networkTitle')}>
        <h3 className="mb-4 border-l-2 border-[var(--aura-tertiary,#d4a574)] pl-3 font-body text-xs font-semibold uppercase tracking-widest text-[var(--aura-text-secondary, #a0a8b0)]">
          {t('stitch.referral.networkTitle')}
        </h3>
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <p className="font-body text-base text-[var(--aura-text-secondary, #a0a8b0)]">
            {t('stitch.referral.friendsEmpty')}
          </p>
        </div>
      </section>
    );
  }

  return (
    <section
      className="mb-8"
      aria-label={t('stitch.referral.networkTitle')}
    >
      <h3 className="mb-4 border-l-2 border-[var(--aura-tertiary,#d4a574)] pl-3 font-body text-xs font-semibold uppercase tracking-widest text-[var(--aura-text-secondary, #a0a8b0)]">
        {t('stitch.referral.networkTitle')}
      </h3>
      <div className="space-y-3">
        {friends.map((friend) => (
          <div
            key={friend.id}
            className="flex items-center justify-between rounded-xl bg-[#121c2a]/40 p-3 backdrop-blur-xl"
            style={{ border: '1px solid rgba(255,255,255,0.08)' }}
          >
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg"
                style={{ border: '1px solid rgba(255,255,255,0.05)' }}>
                <img
                  className="h-full w-full object-cover"
                  src={friend.avatarUrl}
                  alt={friend.avatarAlt}
                  loading="lazy"
                />
              </div>
              <div>
                <p className="font-body text-base font-medium text-[var(--aura-text-primary, #e8e8e8)]">
                  {friend.name}
                </p>
                <p className="font-body text-xs text-[var(--aura-text-secondary, #a0a8b0)] opacity-50">
                  {t('stitch.referral.joinedAt', { date: friend.joinedDate })}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onViewProfile?.(friend.id)}
              className={`rounded-full border px-3 py-1 font-body text-xs font-medium transition-transform active:scale-95 ${
                friend.status === 'active'
                  ? 'text-[#efbd8a]'
                  : 'text-[var(--aura-text-secondary, #a0a8b0)]'
              }`}
              style={{
                backgroundColor: friend.status === 'active'
                  ? 'rgba(212, 165, 116, 0.1)'
                  : 'rgba(255,255,255,0.05)',
                borderColor: friend.status === 'active'
                  ? 'rgba(212, 165, 116, 0.2)'
                  : 'rgba(255,255,255,0.1)',
                boxShadow: friend.status === 'active'
                  ? '0 0 20px rgba(212, 165, 116, 0.15)'
                  : 'none',
              }}
              aria-label={t('stitch.referral.viewProfileAria', { name: friend.name })}
            >
              {friend.status === 'active'
                ? t('stitch.referral.statusActive')
                : t('stitch.referral.statusJoined')}
            </button>
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
      <section className="mb-20" aria-label={t('stitch.referral.rewardsTitle')}>
        <h3 className="mb-4 border-l-2 border-[var(--aura-tertiary,#d4a574)] pl-3 font-body text-xs font-semibold uppercase tracking-widest text-[var(--aura-text-secondary, #a0a8b0)]">
          {t('stitch.referral.rewardsTitle')}
        </h3>
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <p className="font-body text-base text-[var(--aura-text-secondary, #a0a8b0)]">
            {t('stitch.referral.rewardsEmpty')}
          </p>
        </div>
      </section>
    );
  }

  return (
    <section
      className="mb-20"
      aria-label={t('stitch.referral.rewardsTitle')}
    >
      <h3 className="mb-4 border-l-2 border-[var(--aura-tertiary,#d4a574)] pl-3 font-body text-xs font-semibold uppercase tracking-widest text-[var(--aura-text-secondary, #a0a8b0)]">
        {t('stitch.referral.rewardsTitle')}
      </h3>
      <div
        className="overflow-hidden rounded-xl"
        style={{
          border: '1px solid transparent',
          backgroundClip: 'padding-box',
          backgroundImage: 'linear-gradient(rgba(18, 28, 42, 0.5), rgba(18, 28, 42, 0.5)), linear-gradient(135deg, #E5E7EB 0%, rgba(229, 231, 235, 0.2) 100%)',
          backgroundOrigin: 'padding-box, border-box',
          backgroundRepeat: 'no-repeat',
        }}
      >
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-white/[0.1]">
                <th className="p-4 font-body text-xs font-bold uppercase tracking-wider text-[var(--aura-text-secondary, #a0a8b0)] opacity-60">
                  {t('stitch.referral.colDate')}
                </th>
                <th className="p-4 font-body text-xs font-bold uppercase tracking-wider text-[var(--aura-text-secondary, #a0a8b0)] opacity-60">
                  {t('stitch.referral.colSource')}
                </th>
                <th className="p-4 text-right font-body text-xs font-bold uppercase tracking-wider text-[var(--aura-text-secondary, #a0a8b0)] opacity-60">
                  {t('stitch.referral.colAmount')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.05]">
              {history.map((row) => (
                <tr
                  key={row.id}
                  className="transition-colors hover:bg-white/[0.03]"
                >
                  <td className="p-4 font-body text-base text-[var(--aura-text-secondary, #a0a8b0)]">
                    {row.date}
                  </td>
                  <td className="p-4 font-body text-base text-[var(--aura-text-primary, #e8e8e8)]">
                    {row.source}
                  </td>
                  <td className="p-4 text-right font-body text-base font-medium text-[#efbd8a]">
                    +${row.amount.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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

  const errorMessage = externalErrorMsg || t('stitch.referral.defaultError');

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
      <div className="flex min-h-screen items-center justify-center bg-[var(--aura-bg-page, #0A1A2E)] p-5">
        <ReferralError message={errorMessage} />
      </div>
    );
  }

  /* ─── Empty State ───────────────────────────────────────────── */
  if (!data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--aura-bg-page, #0A1A2E)] p-5">
        <ReferralEmpty />
      </div>
    );
  }

  return (
    <div
      className="min-h-screen bg-[var(--aura-bg-page, #0A1A2E)] font-body text-[var(--aura-text-primary, #e8e8e8)]"
      style={{
        backgroundImage: 'radial-gradient(rgba(212, 165, 116, 0.05) 1px, transparent 1px)',
        backgroundSize: '24px 24px',
        WebkitFontSmoothing: 'antialiased',
      }}
    >
      {/* ── Header ─────────────────────────────────────────────── */}
      <header
        className="fixed top-0 z-50 flex h-16 w-full items-center justify-between border-b border-white/10 bg-[#16202e]/80 px-5 backdrop-blur-xl"
        role="banner"
        aria-label={t('stitch.referral.headerAria')}
      >
        <button
          type="button"
          className="text-[#efbd8a] transition-opacity hover:opacity-80 active:scale-95"
          aria-label={t('stitch.referral.closeAria')}
        >
          <CloseIcon className="h-6 w-6" />
        </button>
        <span className="font-display text-2xl tracking-widest text-[#efbd8a]">
          AURA CAFE
        </span>
        <div className="h-8 w-8 overflow-hidden rounded-full border border-[var(--aura-tertiary,#d4a574)]/30">
          <img
            className="h-full w-full object-cover"
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuBh-JKKrdKFObQU9h8Wnj2vKscgz4U9ak0LI7UIhXw18eDS0I6JPVZo-UPpwccmzw0tgUErqepBlzn43qBcDykg7E5WrkdatYzNJ2qtopegH_jBtchV2C1rQ7Kkp8pTkRGqpbshu_APsPuW51WiPlPjLAkoVg0Zzjm8JTaGzys_UzLAeaP2FpN6P8h3yaWvK70iK5dqfU1djDZMEwH8LZZ0vcAy7AkpOkRAlsfJpGhk035Js4uPSr_RlL69GNxbiZwHhKAV4pYaTd8"
            alt={t('stitch.referral.profileAvatarAlt')}
            loading="lazy"
          />
        </div>
      </header>

      {/* ── Main Content ───────────────────────────────────────── */}
      <main className="mx-auto max-w-[600px] px-5 pt-20 pb-32">
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

      {/* ── Bottom Navigation ──────────────────────────────────── */}
      <nav
        className="fixed bottom-0 z-50 flex h-20 w-full items-center justify-around rounded-t-xl border-t border-white/5 bg-[#121c2a]/90 px-2 backdrop-blur-2xl"
        style={{ boxShadow: '0 -4px 20px rgba(0,0,0,0.5)' }}
        role="navigation"
        aria-label={t('stitch.referral.navAria')}
      >
        {/* Menu */}
        <a
          href="#menu"
          className="flex flex-col items-center justify-center text-[var(--aura-text-secondary, #a0a8b0)] opacity-60 transition-colors hover:text-[#efbd8a] active:scale-90"
          aria-label={t('stitch.referral.navMenuAria')}
        >
          <MenuIcon className="h-6 w-6" />
          <span className="font-body text-xs font-medium">{t('stitch.referral.navMenu')}</span>
        </a>

        {/* Referrals (active) */}
        <a
          href="#referrals"
          className="flex flex-col items-center justify-center rounded-xl bg-[#efbd8a]/20 px-3 py-1 text-[#efbd8a] active:scale-90"
          style={{ boxShadow: '0 0 15px rgba(212, 165, 116, 0.15)' }}
          aria-current="page"
          aria-label={t('stitch.referral.navReferralsAria')}
        >
          <GroupAddIcon className="h-6 w-6" />
          <span className="font-body text-xs font-medium">{t('stitch.referral.navReferrals')}</span>
        </a>

        {/* Rewards */}
        <a
          href="#rewards"
          className="flex flex-col items-center justify-center text-[var(--aura-text-secondary, #a0a8b0)] opacity-60 transition-colors hover:text-[#efbd8a] active:scale-90"
          aria-label={t('stitch.referral.navRewardsAria')}
        >
          <MedalIcon className="h-6 w-6" />
          <span className="font-body text-xs font-medium">{t('stitch.referral.navRewards')}</span>
        </a>

        {/* Profile */}
        <a
          href="#profile"
          className="flex flex-col items-center justify-center text-[var(--aura-text-secondary, #a0a8b0)] opacity-60 transition-colors hover:text-[#efbd8a] active:scale-90"
          aria-label={t('stitch.referral.navProfileAria')}
        >
          <PersonIcon className="h-6 w-6" />
          <span className="font-body text-xs font-medium">{t('stitch.referral.navProfile')}</span>
        </a>
      </nav>
    </div>
  );
}
