/**
 * StitchReferralNew2 — AURA CAFE Referral Rewards (Stitch design, version 2)
 *
 * Dark navy glassmorphism referral page with hero earnings card,
 * referral code input with copy + share buttons, progress tracker to next bonus,
 * member tier display, friend network list, and reward history table.
 * Mobile-first responsive. Named export.
 * Source: Stitch AI aura_cafe_referral_rewards_2/code.html export.
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
  nextBonusAmount: number;
  nextBonusLabel: string;
  memberTier: string;
  totalEarned: number;
  friends: ReferralFriendEntry[];
  rewardHistory: RewardHistoryRow[];
}

export type ReferralLoadingState = 'idle' | 'loading' | 'error';

export interface StitchReferralNew2Props {
  data?: ReferralPageData;
  loadingState?: ReferralLoadingState;
  errorMessage?: string;
  onCopyCode?: (code: string) => void;
  onShareVia?: (method: string) => void;
  onDownloadStatement?: () => void;
}

/* ─── SVG Icon Components ─────────────────────────────────────────── */

function ArrowBackIcon({ className = 'h-6 w-6' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path d="M19 12H5M12 19l-7-7 7-7" />
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

function AccountCircleIcon({ className = 'h-6 w-6' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
      <circle cx="12" cy="8" r="4" />
      <path d="M20 21a8 8 0 10-16 0" />
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

/* ─── Style Constants ─────────────────────────────────────────────── */

const BODY_FONT = "font-body";
const DISPLAY_FONT = "font-display";

/* ─── Loading Skeleton ─────────────────────────────────────────────── */

function ReferralSkeleton() {
  return (
    <div className="min-h-screen bg-[var(--aura-bg-page, #0A1A2E)]">
      <div className="mx-auto max-w-[600px] px-5 pt-20 pb-32">
        {/* Hero skeleton */}
        <div className="mb-8 rounded-xl bg-[#162a3d]/60 p-6 text-center backdrop-blur-xl">
          <div className="mx-auto mb-4 h-3 w-28 animate-pulse rounded bg-[#1e3550]" />
          <div className="mx-auto mb-2 h-6 w-36 animate-pulse rounded bg-[#1e3550]" />
          <div className="mx-auto mb-4 h-16 w-40 animate-pulse rounded bg-[#1e3550]" />
          <div className="mx-auto h-3 w-56 animate-pulse rounded bg-[#1e3550]" />
        </div>

        {/* Code skeleton */}
        <div className="mb-8 space-y-3">
          <div className="h-14 animate-pulse rounded-lg bg-[#162a3d]" />
          <div className="flex gap-3">
            <div className="h-12 flex-1 animate-pulse rounded-lg bg-[#162a3d]" />
            <div className="h-12 flex-1 animate-pulse rounded-lg bg-[#162a3d]" />
            <div className="h-12 flex-1 animate-pulse rounded-lg bg-[#162a3d]" />
          </div>
        </div>

        {/* Progress skeleton */}
        <div className="mb-8 space-y-3">
          <div className="h-4 w-32 animate-pulse rounded bg-[#162a3d]" />
          <div className="h-2 w-full animate-pulse rounded-full bg-[#162a3d]" />
        </div>

        {/* Member tier skeleton */}
        <div className="mb-8 rounded-xl bg-[#162a3d]/60 p-4 backdrop-blur-xl">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 animate-pulse rounded bg-[#1e3550]" />
            <div className="space-y-2">
              <div className="h-4 w-24 animate-pulse rounded bg-[#1e3550]" />
              <div className="h-3 w-32 animate-pulse rounded bg-[#1e3550]" />
            </div>
          </div>
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
      <h3 className={`${DISPLAY_FONT} text-xl font-semibold text-[var(--aura-text-primary, #e8e8e8)]`}>
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
      <h3 className={`${DISPLAY_FONT} text-xl font-semibold text-[var(--aura-text-primary, #e8e8e8)]`}>
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
      <div className="relative overflow-hidden rounded-xl bg-[#162a44]/60 p-6 text-center backdrop-blur-xl backdrop-filter md:p-10 md:pb-14"
        style={{ border: '1px solid rgba(255,255,255,0.12)' }}
      >
        {/* Background glow orbs */}
        <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full blur-[100px]"
          style={{ backgroundColor: 'rgba(212, 165, 116, 0.1)' }}
        />
        <div className="pointer-events-none absolute -bottom-16 -left-16 h-48 w-48 rounded-full blur-[100px]"
          style={{ backgroundColor: 'rgba(184, 199, 226, 0.08)' }}
        />

        {/* Tagline */}
        <span
          className={`mb-2 block ${BODY_FONT} text-xs font-semibold uppercase tracking-[0.3em] text-[var(--aura-text-secondary, #a0a8b0)]`}
        >
          {t('stitch.referral.heroTagline')}
        </span>

        {/* Title */}
        <h2
          className={`mb-4 ${DISPLAY_FONT} text-[36px] leading-tight tracking-[-0.02em] text-[#efbd8a] sm:text-[48px] sm:leading-[1.1]`}
        >
          {t('stitch.referral.heroTitle')}
        </h2>

        {/* Reward amount */}
        <div className="relative mt-4 px-8 py-6">
          <span
            className={`${DISPLAY_FONT} text-[72px] leading-none italic tracking-tight text-[#efbd8a] drop-shadow-2xl sm:text-[100px] md:text-[120px]`}
          >
            ${rewardAmount.toFixed(2)}
          </span>
          <p className={`mt-3 ${BODY_FONT} text-xs font-semibold uppercase tracking-[0.2em] text-[var(--aura-text-secondary, #a0a8b0)]`}>
            {t('stitch.referral.heroPerReferral')}
          </p>
        </div>

        {/* Description */}
        <p className={`mx-auto mt-6 max-w-xl ${BODY_FONT} text-base leading-relaxed text-[var(--aura-text-secondary, #a0a8b0)] md:text-lg`}>
          {t('stitch.referral.heroDescription')}
        </p>
      </div>
    </section>
  );
}

/* ─── Referral Code Block ──────────────────────────────────────────── */

function ReferralCodeBlock({
  code,
  onCopyCode,
  onShareVia,
}: {
  code: string;
  onCopyCode?: (code: string) => void;
  onShareVia?: (method: string) => void;
}) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  const SHARE_METHODS = [
    { key: 'zalo', icon: ShareIcon, label: 'Zalo' },
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
      <div className="flex flex-col gap-4">
        {/* Code display with copy button */}
        <div className="relative flex items-center rounded-lg bg-[#1e3550]/40 p-1 backdrop-blur-xl"
          style={{ border: '1px solid rgba(255,255,255,0.12)' }}
        >
          <input
            type="text"
            readOnly
            value={code}
            className={`w-full bg-transparent px-5 py-4 ${BODY_FONT} text-lg tracking-widest text-[#efbd8a] outline-none placeholder:text-[var(--aura-text-secondary, #a0a8b0)]/40`}
            aria-label={t('stitch.referral.referralCodeAria')}
            tabIndex={-1}
          />
          <button
            type="button"
            onClick={handleCopy}
            className={`mr-2 flex shrink-0 items-center gap-2 rounded-md px-5 py-2.5 ${BODY_FONT} text-xs font-semibold uppercase tracking-wider transition-all active:scale-95 ${
              copied
                ? 'bg-[#4CAF50]/20 text-[#4CAF50]'
                : 'bg-[#efbd8a] text-[#0a1628]'
            }`}
            style={copied ? {} : { boxShadow: '0 2px 12px rgba(239, 189, 138, 0.3)' }}
            aria-label={
              copied
                ? t('stitch.referral.copiedAria')
                : t('stitch.referral.copyAria')
            }
          >
            {copied ? (
              <>
                <CheckIcon className="h-4 w-4" />
                <span>{t('stitch.referral.codeCopied')}</span>
              </>
            ) : (
              <span>{t('stitch.referral.copyCode')}</span>
            )}
          </button>
        </div>

        {/* Share buttons */}
        <div className="flex flex-wrap gap-3">
          {SHARE_METHODS.map((method) => {
            const IconComp = method.icon;
            return (
              <button
                key={method.key}
                type="button"
                onClick={() => onShareVia?.(method.key)}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-white/[0.08] bg-[#162a44]/40 px-4 py-3 backdrop-blur-xl transition-all hover:bg-white/[0.05] active:scale-95"
                aria-label={t('stitch.referral.shareViaAria', { method: method.label })}
              >
                <IconComp className="h-4 w-4 text-[var(--aura-text-secondary, #a0a8b0)]" />
                <span className={`${BODY_FONT} text-xs font-semibold uppercase tracking-wider text-[var(--aura-text-primary, #e8e8e8)]`}>
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
  nextBonusAmount,
  nextBonusLabel,
}: {
  current: number;
  target: number;
  percent: number;
  nextBonusAmount: number;
  nextBonusLabel: string;
}) {
  const { t } = useTranslation();
  return (
    <section
      className="mb-8"
      aria-label={t('stitch.referral.progressAria')}
    >
      <div className="rounded-xl bg-[#162a44]/60 p-6 backdrop-blur-xl"
        style={{ border: '1px solid rgba(255,255,255,0.12)' }}
      >
        {/* Header */}
        <div className="mb-4 flex items-end justify-between">
          <div>
            <h3 className={`${DISPLAY_FONT} text-2xl text-[#efbd8a]`}>
              {t('stitch.referral.progressTitle')}
            </h3>
          </div>
          <div className="text-right">
            <span className={`${DISPLAY_FONT} text-2xl text-[var(--aura-text-secondary, #a0a8b0)]`}>
              {current}/{target}
            </span>
            <p className={`${BODY_FONT} text-xs uppercase tracking-widest text-[var(--aura-text-secondary, #a0a8b0)] opacity-60`}>
              {t('stitch.referral.referrals')}
            </p>
          </div>
        </div>

        {/* Next bonus description */}
        <p className={`mb-6 ${BODY_FONT} text-sm text-[var(--aura-text-secondary, #a0a8b0)] opacity-80`}>
          {nextBonusLabel}
        </p>

        {/* Progress bar */}
        <div className="relative h-2 w-full overflow-hidden rounded-full bg-[#1e3550]/60">
          <div
            className="h-full rounded-full transition-all duration-1000 ease-out"
            style={{
              width: `${percent}%`,
              background: 'linear-gradient(90deg, #D4A574 0%, #FFD700 100%)',
              boxShadow: '0 0 15px rgba(212, 165, 116, 0.5)',
            }}
          />
        </div>

        {/* Level labels */}
        <div className="mt-2 flex justify-between">
          <span className={`${BODY_FONT} text-[10px] font-semibold uppercase tracking-wider text-[var(--aura-text-secondary, #a0a8b0)] opacity-60`}>
            {t('stitch.referral.currentLevel')}
          </span>
          <span className={`${BODY_FONT} text-[10px] font-semibold uppercase tracking-wider text-[var(--aura-text-secondary, #a0a8b0)] opacity-60`}>
            {t('stitch.referral.premiumUnlock')}
          </span>
        </div>

        {/* Member tier section */}
        <div className="mt-6 pt-6"
          style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}
        >
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded bg-[#162a44]/60 backdrop-blur-xl"
              style={{
                border: '1px solid',
                borderImageSource: 'linear-gradient(135deg, #FFFFFF 0%, #A8B2BD 100%)',
                borderImageSlice: 1,
              }}
            >
              <MedalIcon className="h-5 w-5 text-[#efbd8a]" />
            </div>
            <div>
              <p className={`${BODY_FONT} text-xs font-semibold uppercase tracking-wider text-[var(--aura-text-primary, #e8e8e8)]`}>
                {t('stitch.referral.memberTier')}
              </p>
              <p className={`${BODY_FONT} text-sm text-[var(--aura-text-secondary, #a0a8b0)]`}>
                {t('stitch.referral.totalEarned', { amount: nextBonusAmount.toFixed(2) })}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── Friend Network ───────────────────────────────────────────────── */

function FriendNetwork({
  friends,
}: {
  friends: ReferralFriendEntry[];
}) {
  const { t } = useTranslation();

  if (friends.length === 0) {
    return (
      <section className="mb-8" aria-label={t('stitch.referral.networkTitle')}>
        <h3 className={`mb-4 ${BODY_FONT} text-xs font-semibold uppercase tracking-widest text-[var(--aura-text-secondary, #a0a8b0)]`}>
          {t('stitch.referral.networkTitle')}
        </h3>
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <p className={`${BODY_FONT} text-base text-[var(--aura-text-secondary, #a0a8b0)]`}>
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
      <h3 className={`mb-6 ${BODY_FONT} text-xs font-semibold uppercase tracking-widest text-[var(--aura-text-secondary, #a0a8b0)]`}>
        {t('stitch.referral.networkTitle')}
      </h3>
      <div className="space-y-4">
        {friends.map((friend) => (
          <div
            key={friend.id}
            className="flex items-center justify-between rounded-xl bg-[#162a44]/60 p-4 backdrop-blur-xl transition-all hover:border-[var(--aura-tertiary,#d4a574)]/30"
            style={{ border: '1px solid rgba(255,255,255,0.1)' }}
          >
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 shrink-0 overflow-hidden bg-[#1e3550]"
                style={{ borderRadius: '2px' }}
              >
                <img
                  className="h-full w-full object-cover transition-all duration-500 grayscale hover:grayscale-0"
                  src={friend.avatarUrl}
                  alt={friend.avatarAlt}
                  loading="lazy"
                />
              </div>
              <div>
                <p className={`${BODY_FONT} text-base font-medium text-[var(--aura-text-primary, #e8e8e8)]`}>
                  {friend.name}
                </p>
                <p className={`${BODY_FONT} text-xs text-[var(--aura-text-secondary, #a0a8b0)] opacity-60`}>
                  {t('stitch.referral.joinedAt', { date: friend.joinedDate })}
                </p>
              </div>
            </div>
            <span
              className={`shrink-0 rounded px-3 py-1 ${BODY_FONT} text-[10px] font-semibold uppercase tracking-widest ${
                friend.status === 'active'
                  ? 'border border-[var(--aura-tertiary,#d4a574)]/20 bg-[#efbd8a]/10 text-[#efbd8a]'
                  : 'border border-white/[0.1] bg-[#1e3550] text-[var(--aura-text-secondary, #a0a8b0)]'
              }`}
              aria-label={
                friend.status === 'active'
                  ? t('stitch.referral.statusActive')
                  : t('stitch.referral.statusJoined')
              }
            >
              {friend.status === 'active'
                ? t('stitch.referral.statusActive')
                : t('stitch.referral.statusJoined')}
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
  onDownloadStatement,
}: {
  history: RewardHistoryRow[];
  onDownloadStatement?: () => void;
}) {
  const { t } = useTranslation();

  if (history.length === 0) {
    return (
      <section className="mb-20" aria-label={t('stitch.referral.rewardsTitle')}>
        <h3 className={`mb-4 ${BODY_FONT} text-xs font-semibold uppercase tracking-widest text-[var(--aura-text-secondary, #a0a8b0)]`}>
          {t('stitch.referral.rewardsTitle')}
        </h3>
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <p className={`${BODY_FONT} text-base text-[var(--aura-text-secondary, #a0a8b0)]`}>
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
      {/* Header with download link */}
      <div className="mb-6 flex items-center justify-between px-2">
        <h3 className={`${BODY_FONT} text-xs font-semibold uppercase tracking-widest text-[var(--aura-text-secondary, #a0a8b0)]`}>
          {t('stitch.referral.rewardsTitle')}
        </h3>
        <button
          type="button"
          onClick={onDownloadStatement}
          className={`${BODY_FONT} text-[10px] font-semibold uppercase tracking-wider text-[var(--aura-text-secondary, #a0a8b0)] underline transition-colors hover:text-[#efbd8a]`}
          aria-label={t('stitch.referral.downloadStatementAria')}
        >
          {t('stitch.referral.downloadStatement')}
        </button>
      </div>

      {/* Table */}
      <div
        className="overflow-hidden rounded-xl"
        style={{
          border: '1px solid rgba(255,255,255,0.1)',
        }}
      >
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="bg-[#1e3550]/30">
                <th className={`p-4 ${BODY_FONT} text-xs font-bold uppercase tracking-wider text-[var(--aura-text-secondary, #a0a8b0)]`}>
                  {t('stitch.referral.colDate')}
                </th>
                <th className={`p-4 ${BODY_FONT} text-xs font-bold uppercase tracking-wider text-[var(--aura-text-secondary, #a0a8b0)]`}>
                  {t('stitch.referral.colSource')}
                </th>
                <th className={`p-4 text-right ${BODY_FONT} text-xs font-bold uppercase tracking-wider text-[var(--aura-text-secondary, #a0a8b0)]`}>
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
                  <td className={`p-4 ${BODY_FONT} text-sm text-[var(--aura-text-secondary, #a0a8b0)]`}>
                    {row.date}
                  </td>
                  <td className={`p-4 ${BODY_FONT} text-sm text-[var(--aura-text-primary, #e8e8e8)]`}>
                    {row.source}
                  </td>
                  <td className={`p-4 text-right ${BODY_FONT} text-sm font-semibold text-[#efbd8a]`}>
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

export function StitchReferralNew2({
  data: externalData,
  loadingState = 'idle',
  errorMessage: externalErrorMsg = '',
  onCopyCode,
  onShareVia,
  onDownloadStatement,
}: Readonly<StitchReferralNew2Props>) {
  const { t } = useTranslation();

  const errorMessage = externalErrorMsg || t('stitch.referral.defaultError');

  const DEFAULT_FRIENDS: ReferralFriendEntry[] = [
    {
      id: 'f1',
      name: 'Alex Nguyen',
      joinedDate: 'Oct 12, 2023',
      avatarUrl:
        'https://lh3.googleusercontent.com/aida-public/AB6AXuDUAdvlAWNMDxFLROoo1CYIy-fNMHTOCrFrXZrp5LVUXFykARu_Yq1VUqp65YM6pBUWllu1oBvL_NRQbkiybpp4-1yQIkVc6o7FrmSaykHB4yask-MRtfCmJcuF_GIhhqe2HSPraHgNmf-y5V8-HCboU02N7DK0xN6hp_d3A19Qop4pLEs5XidKnpofOEkDr8cExPpYVZJWad6MukJMbTXQ_6tbnW1FEOYAbKMh1NThPJz-xv1rKcWrvL6eE6j2MkwarWbeYzR9aD8',
      avatarAlt: 'Close up portrait of a sophisticated man with dark hair in professional attire',
      status: 'active',
    },
    {
      id: 'f2',
      name: 'Elena Sofia',
      joinedDate: 'Oct 08, 2023',
      avatarUrl:
        'https://lh3.googleusercontent.com/aida-public/AB6AXuAxAh0XJiOWCO32Cvuz--AYHCp_ESZWJjqbW0SyeZHUY1sTQlz_jZXr5eMMAb_NaoM-JqzAeq2UBsK9ImV8w8fO0OIZ10KT057a0wd-wRkDmPeteDvkRfl9O4KEl7TtcIxWM4uRJj7aNx81FE4lzXL8Tnne6xxeDu4WGrlixzhTgTWvswAlF_lYaovl2MRs1eNEr9w-foM1UnUdSdbE-dxPWkRB_9SAl7s-dNp-DUtLDbv9Jy05o_Ei1ijbnsWRgAAFwOThOB0MO8k',
      avatarAlt: 'Portrait of an elegant woman with a refined smile, warm professional lighting',
      status: 'joined',
    },
    {
      id: 'f3',
      name: 'Marcus Chen',
      joinedDate: 'Sept 24, 2023',
      avatarUrl:
        'https://lh3.googleusercontent.com/aida-public/AB6AXuBw3Oa90mcS2sGFr8mG4KMEQmaMoB6B7NNqAvjwQvOMKF5XePNRKZdmo8lwiScFIuHnQhCqjvovm56uCjg7eU_bfYKu6NustIfEuHKi0_-JBqS7PgQzunmhMXuM_MRIJrTu5JeKB203_0S59hPS2q8-fod-EaUwOuAnJWHYywjLxj40ASrEQ3wPVzQ947dz5UVeCc74bCfwDot-_9TaXSA4PUeKtTXGCk5kYHgV8CANNY4S1mLNAAdhJn0A663yAmYs9RTliuNAi0E',
      avatarAlt: 'A stylish young man wearing a modern tailored suit, soft atmospheric lighting',
      status: 'active',
    },
  ];

  const DEFAULT_HISTORY: RewardHistoryRow[] = [
    { id: 'h1', date: 'Oct 12, 2023', source: 'Referral Reward (Alex N.)', amount: 15.0 },
    { id: 'h2', date: 'Oct 01, 2023', source: 'Monthly Bonus Reward', amount: 10.0 },
    { id: 'h3', date: 'Sept 24, 2023', source: 'Referral Reward (Marcus C.)', amount: 15.0 },
    { id: 'h4', date: 'Aug 15, 2023', source: 'Account Verified', amount: 5.0 },
  ];

  const DEFAULT_REFERRAL_DATA: ReferralPageData = {
    rewardAmount: 15.0,
    referralCode: 'AURA-VIP-2024-X',
    currentReferrals: 3,
    targetReferrals: 5,
    progressPercent: 60,
    nextBonusAmount: 50.0,
    nextBonusLabel: 'Unlock a $50 Premium Reserve credit upon reaching 5 referrals.',
    memberTier: 'SILVER MEMBER',
    totalEarned: 45.0,
    friends: DEFAULT_FRIENDS,
    rewardHistory: DEFAULT_HISTORY,
  };

  const data = externalData ?? DEFAULT_REFERRAL_DATA;

  const NAV_LINKS = [
    { key: 'menu', href: '#menu', label: t('stitch.referral.navMenu'), icon: MenuIcon },
    { key: 'referrals', href: '#referrals', label: t('stitch.referral.navReferrals'), icon: GroupAddIcon, active: true },
    { key: 'rewards', href: '#rewards', label: t('stitch.referral.navRewards'), icon: MedalIcon },
    { key: 'profile', href: '#profile', label: t('stitch.referral.navProfile'), icon: PersonIcon },
  ];

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
        backgroundImage: 'radial-gradient(rgba(239, 189, 138, 0.04) 1px, transparent 1px)',
        backgroundSize: '24px 24px',
        WebkitFontSmoothing: 'antialiased',
      }}
    >
      {/* ── Top Navigation ────────────────────────────────────────── */}
      <header
        className="fixed top-0 z-50 flex h-16 w-full items-center justify-between border-b border-white/20 bg-[var(--aura-bg-page, #0A1A2E)]/60 px-5 backdrop-blur-xl md:px-6"
        role="banner"
        aria-label={t('stitch.referral.headerAria')}
      >
        {/* Left: back arrow + brand */}
        <div className="flex items-center gap-4">
          <button
            type="button"
            className="text-[#efbd8a] transition-transform active:scale-95"
            aria-label={t('stitch.referral.backAria')}
          >
            <ArrowBackIcon className="h-6 w-6" />
          </button>
          <span className={`${DISPLAY_FONT} text-2xl tracking-tight text-[#efbd8a]`}>
            AURA CAFE
          </span>
        </div>

        {/* Center: desktop nav links */}
        <nav className="hidden items-center gap-8 md:flex" role="navigation" aria-label={t('stitch.referral.desktopNavAria')}>
          <a href="#menu" className={`${BODY_FONT} text-xs font-semibold uppercase tracking-[0.1em] text-[var(--aura-text-secondary, #a0a8b0)] transition-colors hover:text-[#efbd8a]`}>
            {t('stitch.referral.navMenu')}
          </a>
          <a href="#referrals" className={`${BODY_FONT} text-xs font-semibold uppercase tracking-[0.1em] text-[#efbd8a]`}>
            {t('stitch.referral.navReferrals')}
          </a>
          <a href="#rewards" className={`${BODY_FONT} text-xs font-semibold uppercase tracking-[0.1em] text-[var(--aura-text-secondary, #a0a8b0)] transition-colors hover:text-[#efbd8a]`}>
            {t('stitch.referral.navRewards')}
          </a>
          <a href="#profile" className={`${BODY_FONT} text-xs font-semibold uppercase tracking-[0.1em] text-[var(--aura-text-secondary, #a0a8b0)] transition-colors hover:text-[#efbd8a]`}>
            {t('stitch.referral.navProfile')}
          </a>
        </nav>

        {/* Right: account icon */}
        <div className="flex items-center gap-4">
          <AccountCircleIcon className="h-6 w-6 text-[var(--aura-text-secondary, #a0a8b0)]" />
        </div>
      </header>

      {/* ── Main Content ────────────────────────────────────────── */}
      <main className="mx-auto max-w-[600px] px-5 pt-24 pb-36 md:px-6">
        {/* Section 1: Hero Earnings Card */}
        <HeroEarningsCard rewardAmount={data.rewardAmount} />

        {/* Section 2: Referral Code + Share */}
        <ReferralCodeBlock
          code={data.referralCode}
          onCopyCode={onCopyCode}
          onShareVia={onShareVia}
        />

        {/* Section 3: Progress Tracker */}
        <ProgressTracker
          current={data.currentReferrals}
          target={data.targetReferrals}
          percent={data.progressPercent}
          nextBonusAmount={data.nextBonusAmount}
          nextBonusLabel={data.nextBonusLabel}
        />

        {/* Section 4: Friend Network */}
        <FriendNetwork friends={data.friends} />

        {/* Section 5: Reward History */}
        <RewardHistory history={data.rewardHistory} onDownloadStatement={onDownloadStatement} />
      </main>

      {/* ── Bottom Navigation (Mobile Only) ──────────────────────── */}
      <nav
        className="fixed bottom-0 z-50 flex h-20 w-full items-center justify-around border-t border-white/10 bg-[#061c35]/60 px-2 pb-4 backdrop-blur-xl md:hidden"
        role="navigation"
        aria-label={t('stitch.referral.navAria')}
      >
        {NAV_LINKS.map((link) => {
          const IconComp = link.icon;
          const isActive = link.active;
          return (
            <a
              key={link.key}
              href={link.href}
              className={`flex flex-col items-center justify-center transition-all duration-200 active:scale-90 ${
                isActive
                  ? 'rounded-full bg-[#39475e]/40 px-4 py-1 text-[#efbd8a]'
                  : 'text-[var(--aura-text-secondary, #a0a8b0)]'
              }`}
              aria-label={link.label}
              aria-current={isActive ? 'page' : undefined}
            >
              <IconComp className="h-6 w-6" />
              <span className={`${BODY_FONT} mt-1 text-[10px] font-medium`}>{link.label}</span>
            </a>
          );
        })}
      </nav>
    </div>
  );
}
