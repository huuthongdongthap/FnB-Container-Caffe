/**
 * ReferralPage — AURA CAFE Referral Program (Stitch AI design)
 *
 * Dark navy glassmorphism referral page. Source: stitch-exports/referral/design.html.
 * Pixel-matched to the Stitch design with glass cards, chrome borders,
 * bronze gradients, and the industrial-luxury aesthetic.
 *
 * Handles: loading (glass skeleton), error (glass card + retry), empty states.
 */
'use client';

import { useState, useCallback, useEffect } from 'react';
import {
  X,
  Copy,
  Check,
  MessageCircle,
  MessageSquare,
  Smartphone,
  Utensils,
  UserPlus,
  Award,
  User,
  AlertCircle,
  Users,
  Gift,
  RefreshCw,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useReferralStore } from '@/hooks/stores/use-referral-store';
import { useAuthStore } from '@/hooks/stores/use-auth-store';
import { Skeleton } from '@/components/ui/skeleton';

/* ─── Types ────────────────────────────────────────────────────────── */

export interface ReferralFriend {
  id: string;
  name: string;
  avatarAlt?: string;
  avatarUrl?: string;
  joinedAt: string;
  isActive: boolean;
}

export interface RewardEntry {
  id: string;
  date: string;
  source: string;
  amount: number;
}

/* ─── Constants ────────────────────────────────────────────────────── */

const SHARE_BUTTONS: Array<{
  key: string;
  icon: typeof MessageCircle;
  label: string;
}> = [
  { key: 'zalo', icon: MessageCircle, label: 'Zalo' },
  { key: 'messenger', icon: MessageSquare, label: 'Messenger' },
  { key: 'sms', icon: Smartphone, label: 'SMS' },
];

/* ─── Loading Skeleton ─────────────────────────────────────────────── */

function ReferralSkeleton() {
  return (
    <div style={{ backgroundColor: 'var(--aura-bg-page, #0A1A2E)' }} className="min-h-screen">
      <div className="mx-auto max-w-[600px] px-[var(--aura-container-padding,20px)] pt-20 pb-32">
        {/* Hero skeleton */}
        <div
          className="mb-8 rounded-xl p-6 text-center"
          style={{
            background: 'rgba(18, 28, 42, 0.4)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
          }}
        >
          <Skeleton className="mx-auto mb-4 h-4 w-24 rounded" />
          <Skeleton className="mx-auto mb-2 h-10 w-44 rounded" />
          <Skeleton className="mx-auto h-4 w-56 rounded" />
        </div>

        {/* Code skeleton */}
        <div className="mb-8 space-y-3">
          <Skeleton className="h-14 w-full rounded-lg" />
          <Skeleton className="h-12 w-full rounded-lg" />
        </div>

        {/* Progress skeleton */}
        <div className="mb-8 space-y-3">
          <Skeleton className="h-4 w-40 rounded" />
          <Skeleton className="h-2 w-full rounded-full" />
        </div>

        {/* Friends list skeleton */}
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton variant="rectangular" className="h-10 w-10 shrink-0 rounded-lg" />
              <div className="flex-1 space-y-1">
                <Skeleton className="h-4 w-24 rounded" />
                <Skeleton className="h-3 w-32 rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── Error State ──────────────────────────────────────────────────── */

function ReferralError({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  const { t } = useTranslation('referral');
  return (
    <div
      className="flex min-h-[400px] flex-col items-center justify-center gap-4 rounded-xl p-8 text-center"
      style={{
        background: 'rgba(18, 28, 42, 0.4)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
      }}
    >
      <AlertCircle
        className="h-12 w-12"
        style={{ color: 'var(--aura-error, #ffb4ab)' }}
      />
      <h3
        className="text-xl font-semibold"
        style={{
          fontFamily: 'var(--aura-font-display, "Cormorant Garamond", Georgia, serif)',
          color: 'var(--aura-text-primary, #e8e8e8)',
        }}
      >
        {t('errorTitle')}
      </h3>
      <p style={{ color: 'var(--aura-text-secondary, #a0a8b0)' }}>{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-2 flex items-center gap-2 rounded-full px-6 py-2 text-sm font-semibold uppercase tracking-widest transition-all active:scale-[0.98]"
        style={{
          background: 'linear-gradient(180deg, #efbd8a 0%, #d4a574 100%)',
          color: 'var(--aura-bg-page, #0A1A2E)',
          boxShadow: '0 0 20px rgba(212, 165, 116, 0.15)',
        }}
      >
        <RefreshCw className="h-4 w-4" />
        {t('retry')}
      </button>
    </div>
  );
}

/* ─── Empty State ──────────────────────────────────────────────────── */

function ReferralEmpty() {
  const { t } = useTranslation('referral');
  return (
    <div
      className="flex min-h-[400px] flex-col items-center justify-center gap-4 rounded-xl p-8 text-center"
      style={{
        background: 'rgba(18, 28, 42, 0.4)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
      }}
    >
      <UserPlus
        className="h-12 w-12"
        style={{ color: 'var(--aura-text-disabled, #5a6270)' }}
      />
      <h3
        className="text-xl font-semibold"
        style={{
          fontFamily: 'var(--aura-font-display, "Cormorant Garamond", Georgia, serif)',
          color: 'var(--aura-text-primary, #e8e8e8)',
        }}
      >
        {t('emptyTitle')}
      </h3>
      <p style={{ color: 'var(--aura-text-secondary, #a0a8b0)' }}>
        {t('emptyDescription')}
      </p>
    </div>
  );
}

/* ─── Fixed Header ─────────────────────────────────────────────────── */

function ReferralHeader() {
  return (
    <header
      className="fixed top-0 z-50 flex h-16 w-full items-center justify-between border-b px-container-padding shadow-none"
      style={{
        backgroundColor: 'rgba(9, 20, 33, 0.8)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderColor: 'rgba(255, 255, 255, 0.1)',
      }}
    >
      <button
        type="button"
        className="flex items-center justify-center transition-opacity hover:opacity-80 active:scale-95"
        aria-label="Close"
        style={{ color: 'var(--aura-tertiary, #d4a574)' }}
      >
        <X className="h-6 w-6" />
      </button>

      <span
        className="text-lg font-semibold tracking-widest"
        style={{
          fontFamily: 'var(--aura-font-display, "Cormorant Garamond", Georgia, serif)',
          color: 'var(--aura-tertiary, #d4a574)',
        }}
      >
        AURA CAFE
      </span>

      <div
        className="h-8 w-8 overflow-hidden rounded-full"
        style={{ border: '1px solid rgba(239, 189, 138, 0.3)' }}
      >
        <img
          className="h-full w-full object-cover"
          src="https://lh3.googleusercontent.com/aida-public/AB6AXuBh-JKKrdKFObQU9h8Wnj2vKscgz4U9ak0LI7UIhXw18eDS0I6JPVZo-UPpwccmzw0tgUErqepBlzn43qBcDykg7E5WrkdatYzNJ2qtopegH_jBtchV2C1rQ7Kkp8pTkRGqpbshu_APsPuW51WiPlPjLAkoVg0Zzjm8JTaGzys_UzLAeaP2FpN6P8h3yaWvK70iK5dqfU1djDZMEwH8LZZ0vcAy7AkpOkRAlsfJpGhk035Js4uPSr_RlL69GNxbiZwHhKAV4pYaTd8"
          alt="Avatar"
        />
      </div>
    </header>
  );
}

/* ─── Hero Earnings Card ───────────────────────────────────────────── */

function HeroEarningsCard({ rewardAmount }: { rewardAmount: number }) {
  return (
    <section className="mb-8">
      <div
        className="relative overflow-hidden rounded-xl p-6 text-center"
        style={{
          background: 'rgba(18, 28, 42, 0.4)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
        }}
      >
        {/* Glow orb */}
        <div
          className="absolute -right-24 -top-24 h-48 w-48 rounded-full"
          style={{
            background: 'rgba(212, 165, 116, 0.1)',
            filter: 'blur(80px)',
          }}
        />

        <span
          className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em]"
          style={{ color: 'var(--aura-text-secondary, #a0a8b0)' }}
        >
          Refer &amp; Earn
        </span>

        <h1
          className="mb-2"
          style={{
            fontFamily: 'var(--aura-font-display, "Cormorant Garamond", Georgia, serif)',
            fontSize: 'var(--aura-text-display-lg, 48px)',
            lineHeight: '1.1',
            letterSpacing: '-0.02em',
            fontWeight: 500,
            color: 'var(--aura-tertiary, #d4a574)',
          }}
        >
          ${rewardAmount.toFixed(2)}
        </h1>

        <p
          className="mx-auto max-w-[280px] text-sm"
          style={{
            fontFamily: 'var(--aura-font-body, "Space Grotesk", system-ui, sans-serif)',
            color: 'var(--aura-text-secondary, #a0a8b0)',
          }}
        >
          Share the Aura experience with your inner circle and earn rewards for
          every successful invitation.
        </p>

        <div
          className="mt-6 h-px w-full"
          style={{
            background:
              'linear-gradient(to right, transparent, rgba(255,255,255,0.1), transparent)',
          }}
        />
      </div>
    </section>
  );
}

/* ─── Referral Code Block ──────────────────────────────────────────── */

function ReferralCodeBlock({
  referralCode,
  onShare,
}: {
  referralCode: string;
  onShare?: (method: string) => void;
}) {
  const [copied, setCopied] = useState(false);
  const { t } = useTranslation('referral');

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(referralCode).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [referralCode]);

  return (
    <section className="mb-8">
      <div className="flex flex-col gap-3">
        {/* Code display with chrome border */}
        <div
          className="flex items-center justify-between rounded-lg p-4"
          style={{
            backgroundColor: 'var(--aura-bg-surface, #121c2a)',
            border: '1px solid transparent',
            backgroundImage:
              'linear-gradient(#121c2a, #121c2a) padding-box, linear-gradient(135deg, #E5E7EB 0%, rgba(229, 231, 235, 0.2) 100%) border-box',
          }}
        >
          <span
            className="text-xl tracking-widest"
            style={{
              fontFamily: 'var(--aura-font-display, "Cormorant Garamond", Georgia, serif)',
              color: 'var(--aura-text-primary, #e8e8e8)',
            }}
          >
            {referralCode}
          </span>

          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center gap-1 transition-transform active:scale-95"
            style={{ color: 'var(--aura-tertiary, #d4a574)' }}
            aria-label={copied ? 'Code copied' : 'Copy referral code'}
          >
            {copied ? (
              <Check className="h-5 w-5" style={{ color: 'var(--aura-success, #4CAF50)' }} />
            ) : (
              <Copy className="h-5 w-5" />
            )}
          </button>
        </div>

        {/* Copy Code button (bronze gradient) */}
        <button
          type="button"
          onClick={handleCopy}
          className="w-full rounded-lg py-4 text-sm font-bold uppercase tracking-widest transition-all active:scale-[0.98]"
          style={{
            background: 'linear-gradient(180deg, #efbd8a 0%, #d4a574 100%)',
            color: '#050f1c',
            boxShadow: '0 0 20px rgba(212, 165, 116, 0.15)',
          }}
        >
          {copied ? t('copied') : t('copyCode')}
        </button>

        {/* Share buttons */}
        <div
          className="mt-2 flex gap-3 overflow-x-auto py-2"
          style={{
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
          }}
        >
          <style>{'.share-scroll-hide::-webkit-scrollbar { display: none; }'}</style>
          {SHARE_BUTTONS.map((btn) => {
            const Icon = btn.icon;
            return (
              <button
                key={btn.key}
                type="button"
                onClick={() => onShare?.(btn.key)}
                className="share-scroll-hide flex shrink-0 items-center gap-2 rounded-full border px-5 py-2 text-sm transition-transform active:scale-95"
                style={{
                  background: 'rgba(18, 28, 42, 0.4)',
                  backdropFilter: 'blur(20px)',
                  WebkitBackdropFilter: 'blur(20px)',
                  border: '1px solid rgba(255, 255, 255, 0.05)',
                  color: 'var(--aura-text-primary, #e8e8e8)',
                  fontFamily: 'var(--aura-font-body, "Space Grotesk", system-ui, sans-serif)',
                }}
              >
                <Icon className="h-[18px] w-[18px]" />
                <span className="text-xs font-medium">{btn.label}</span>
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
}: {
  current: number;
  target: number;
}) {
  const percent = target > 0 ? Math.round((current / target) * 100) : 0;

  return (
    <section className="mb-8">
      <div className="mb-3 flex items-end justify-between">
        <div>
          <h3
            className="text-xl"
            style={{
              fontFamily: 'var(--aura-font-display, "Cormorant Garamond", Georgia, serif)',
              color: 'var(--aura-tertiary, #d4a574)',
            }}
          >
            Path to Platinum
          </h3>
          <p
            className="text-xs opacity-60"
            style={{
              fontFamily: 'var(--aura-font-body, "Space Grotesk", system-ui, sans-serif)',
              color: 'var(--aura-text-secondary, #a0a8b0)',
            }}
          >
            Unlock $50 exclusive bonus
          </p>
        </div>
        <div className="text-right">
          <span
            className="text-xl"
            style={{
              fontFamily: 'var(--aura-font-display, "Cormorant Garamond", Georgia, serif)',
              color: 'var(--aura-tertiary, #d4a574)',
            }}
          >
            {current}/{target}
          </span>
          <p
            className="text-[10px] font-semibold uppercase tracking-wider opacity-60"
            style={{
              fontFamily: 'var(--aura-font-body, "Space Grotesk", system-ui, sans-serif)',
              color: 'var(--aura-text-secondary, #a0a8b0)',
            }}
          >
            Referrals
          </p>
        </div>
      </div>

      {/* Progress bar */}
      <div
        className="relative h-2 w-full overflow-hidden rounded-full"
        style={{ backgroundColor: 'rgba(255, 255, 255, 0.05)' }}
      >
        <div
          className="h-full rounded-full transition-all duration-1000 ease-out"
          style={{
            width: `${Math.min(percent, 100)}%`,
            background: 'linear-gradient(180deg, #efbd8a 0%, #d4a574 100%)',
            boxShadow: '0 0 20px rgba(212, 165, 116, 0.15)',
          }}
        />
      </div>

      {/* Progress dots */}
      <div className="mt-1 flex justify-between px-1">
        {Array.from({ length: target }).map((_, i) => (
          <span
            key={i}
            className="h-1 w-1 rounded-full"
            style={{
              backgroundColor:
                i < current
                  ? 'var(--aura-tertiary, #d4a574)'
                  : 'rgba(255, 255, 255, 0.2)',
              boxShadow:
                i === current - 1 ? '0 0 8px rgba(212, 165, 116, 0.8)' : 'none',
            }}
          />
        ))}
      </div>
    </section>
  );
}

/* ─── Friend Network ────────────────────────────────────────────────── */

function FriendNetwork({
  friends,
}: {
  friends: ReferralFriend[];
}) {
  const { t } = useTranslation('referral');
  return (
    <section className="mb-8">
      <h3
        className="mb-4 border-l-2 pl-3 text-xs font-semibold uppercase tracking-widest"
        style={{
          color: 'var(--aura-text-secondary, #a0a8b0)',
          borderColor: 'var(--aura-tertiary, #d4a574)',
        }}
      >
        Recent Network
      </h3>

      {friends.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <Users
            className="mb-3 h-8 w-8"
            style={{ color: 'var(--aura-text-disabled, #5a6270)' }}
          />
          <p style={{ color: 'var(--aura-text-secondary, #a0a8b0)' }}>
            {t('friendsEmpty')}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {friends.map((friend) => (
            <div
              key={friend.id}
              className="flex items-center justify-between rounded-xl p-3"
              style={{
                background: 'rgba(18, 28, 42, 0.4)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
              }}
            >
              <div className="flex items-center gap-3">
                {/* Avatar */}
                <div
                  className="h-10 w-10 shrink-0 overflow-hidden rounded-lg"
                  style={{ border: '1px solid rgba(255, 255, 255, 0.05)' }}
                >
                  {friend.avatarUrl ? (
                    <img
                      className="h-full w-full object-cover"
                      src={friend.avatarUrl}
                      alt={friend.avatarAlt ?? ''}
                      loading="lazy"
                    />
                  ) : (
                    <div
                      className="flex h-full w-full items-center justify-center text-sm font-semibold"
                      style={{
                        backgroundColor: 'rgba(255, 255, 255, 0.05)',
                        color: 'var(--aura-text-secondary, #a0a8b0)',
                      }}
                    >
                      {friend.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>

                {/* Name + date */}
                <div>
                  <p
                    className="text-sm font-medium"
                    style={{
                      color: 'var(--aura-text-primary, #e8e8e8)',
                      fontFamily: 'var(--aura-font-body, "Space Grotesk", system-ui, sans-serif)',
                    }}
                  >
                    {friend.name}
                  </p>
                  <p
                    className="text-[11px] opacity-50"
                    style={{
                      color: 'var(--aura-text-secondary, #a0a8b0)',
                    }}
                  >
                    Joined {friend.joinedAt}
                  </p>
                </div>
              </div>

              {/* Status badge */}
              <span
                className="rounded-full border px-3 py-1 text-[11px] font-medium"
                style={
                  friend.isActive
                    ? {
                        backgroundColor: 'rgba(212, 165, 116, 0.1)',
                        color: 'var(--aura-tertiary, #d4a574)',
                        borderColor: 'rgba(212, 165, 116, 0.2)',
                        boxShadow: '0 0 20px rgba(212, 165, 116, 0.15)',
                      }
                    : {
                        backgroundColor: 'rgba(255, 255, 255, 0.05)',
                        color: 'var(--aura-text-secondary, #a0a8b0)',
                        borderColor: 'rgba(255, 255, 255, 0.1)',
                      }
                }
              >
                {friend.isActive ? 'Active' : 'Joined'}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

/* ─── Reward History ─────────────────────────────────────────────────── */

function RewardHistory({ rewards }: { rewards: RewardEntry[] }) {
  const { t } = useTranslation('referral');
  return (
    <section className="mb-20">
      <h3
        className="mb-4 border-l-2 pl-3 text-xs font-semibold uppercase tracking-widest"
        style={{
          color: 'var(--aura-text-secondary, #a0a8b0)',
          borderColor: 'var(--aura-tertiary, #d4a574)',
        }}
      >
        Reward History
      </h3>

      {rewards.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <Gift
            className="mb-3 h-8 w-8"
            style={{ color: 'var(--aura-text-disabled, #5a6270)' }}
          />
          <p style={{ color: 'var(--aura-text-secondary, #a0a8b0)' }}>
            {t('rewardsEmpty')}
          </p>
        </div>
      ) : (
        <div
          className="overflow-hidden rounded-xl"
          style={{
            backgroundColor: 'rgba(18, 28, 42, 0.5)',
            border: '1px solid transparent',
            backgroundImage:
              'linear-gradient(rgba(18,28,42,0.5), rgba(18,28,42,0.5)) padding-box, linear-gradient(135deg, #E5E7EB 0%, rgba(229, 231, 235, 0.2) 100%) border-box',
          }}
        >
          <table className="w-full border-collapse text-left">
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>
                {['Date', 'Source', 'Amount'].map((heading) => (
                  <th
                    key={heading}
                    className="p-4 text-[11px] font-bold uppercase tracking-wider opacity-60"
                    style={{
                      color: 'var(--aura-text-secondary, #a0a8b0)',
                      fontFamily: 'var(--aura-font-body, "Space Grotesk", system-ui, sans-serif)',
                    }}
                  >
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody style={{ borderColor: 'rgba(255, 255, 255, 0.05)' }}>
              {rewards.map((row) => (
                <tr
                  key={row.id}
                  className="transition-colors"
                  style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}
                >
                  <td
                    className="p-4 text-sm"
                    style={{ color: 'var(--aura-text-secondary, #a0a8b0)' }}
                  >
                    {row.date}
                  </td>
                  <td
                    className="p-4 text-sm"
                    style={{
                      color: 'var(--aura-text-primary, #e8e8e8)',
                      fontFamily: 'var(--aura-font-body, "Space Grotesk", system-ui, sans-serif)',
                    }}
                  >
                    {row.source}
                  </td>
                  <td
                    className="p-4 text-right text-sm font-medium"
                    style={{
                      color: 'var(--aura-tertiary, #d4a574)',
                      fontFamily: 'var(--aura-font-body, "Space Grotesk", system-ui, sans-serif)',
                    }}
                  >
                    +${row.amount.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

/* ─── Bottom Navigation ────────────────────────────────────────────── */

function BottomNav() {
  const navItems: Array<{
    key: string;
    label: string;
    icon: typeof Utensils;
    active: boolean;
  }> = [
    { key: 'menu', label: 'Menu', icon: Utensils, active: false },
    { key: 'referrals', label: 'Referrals', icon: UserPlus, active: true },
    { key: 'rewards', label: 'Rewards', icon: Award, active: false },
    { key: 'profile', label: 'Profile', icon: User, active: false },
  ];

  return (
    <nav
      className="fixed bottom-0 z-50 flex h-20 w-full items-center justify-around rounded-t-xl border-t px-2 shadow-[0_-4px_20px_rgba(0,0,0,0.5)]"
      style={{
        backgroundColor: 'rgba(18, 28, 42, 0.9)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        borderColor: 'rgba(255, 255, 255, 0.05)',
      }}
    >
      {navItems.map((item) => {
        const Icon = item.icon;
        return (
          <button
            key={item.key}
            type="button"
            className="flex flex-col items-center justify-center transition-all active:scale-90"
            style={
              item.active
                ? {
                    padding: '4px 12px',
                    borderRadius: '12px',
                    backgroundColor: 'rgba(212, 165, 116, 0.1)',
                    color: 'var(--aura-tertiary, #d4a574)',
                    boxShadow: '0 0 15px rgba(212, 165, 116, 0.15)',
                  }
                : {
                    color: 'var(--aura-text-secondary, #a0a8b0)',
                    opacity: 0.6,
                  }
            }
          >
            <Icon className="h-6 w-6" />
            <span className="mt-1 text-[10px] font-medium">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

/* ─── Main Page Component ──────────────────────────────────────────── */

export function ReferralPage() {
  const store = useReferralStore();
  const token = useAuthStore((s) => s.token);
  const isAuthenticated = !!token;

  useEffect(() => {
    if (isAuthenticated) {
      store.fetchReferralData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  /* ─── Loading State ──────────────────────────────────────────── */
  if (store.loading && !store.referralCode) {
    return <ReferralSkeleton />;
  }

  /* ─── Error State (no data at all) ────────────────────────────── */
  if (store.error && !store.referralCode) {
    return (
      <div
        className="flex min-h-screen items-start justify-center px-container-padding pt-20"
        style={{ backgroundColor: 'var(--aura-bg-page, #0A1A2E)' }}
      >
        <div className="mt-16 w-full max-w-[600px]">
          <ReferralError
            message={store.error}
            onRetry={() => store.fetchReferralData()}
          />
        </div>
      </div>
    );
  }

  /* ─── Empty State ─────────────────────────────────────────────── */
  if (!store.referralCode && !store.loading) {
    return (
      <div
        className="flex min-h-screen items-start justify-center px-container-padding pt-20"
        style={{ backgroundColor: 'var(--aura-bg-page, #0A1A2E)' }}
      >
        <div className="mt-16 w-full max-w-[600px]">
          <ReferralEmpty />
        </div>
      </div>
    );
  }

  /* ─── Map store data to friend/reward types ──────────────────── */
  const friends: ReferralFriend[] = store.recentReferrals.map((r) => ({
    id: r.id,
    name: r.referredName,
    joinedAt: new Date(r.createdAt).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }),
    isActive: r.status === 'active' || r.status === 'completed',
  }));

  const rewards: RewardEntry[] = store.recentReferrals
    .filter((r) => r.cashbackAwarded > 0)
    .map((r) => ({
      id: r.id,
      date: new Date(r.createdAt).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      }),
      source: r.referredName
        .split(' ')
        .map((n) => n.charAt(0))
        .join('. ')
        .concat('.'),
      amount: r.cashbackAwarded,
    }));

  const rewardAmount = store.referralCount > 0 ? 15.0 : 0;

  /* ─── Data State: Full Design ────────────────────────────────── */
  return (
    <div
      className="min-h-screen"
      style={{
        backgroundColor: 'var(--aura-bg-page, #091421)',
        color: 'var(--aura-text-primary, #e8e8e8)',
        fontFamily: 'var(--aura-font-body, "Space Grotesk", system-ui, sans-serif)',
      }}
    >
      {/* Fixed Header */}
      <ReferralHeader />

      {/* Main Content */}
      <main
        className="mx-auto max-w-[600px] px-[var(--aura-container-padding,20px)] pt-20 pb-32"
        style={{
          backgroundImage:
            'radial-gradient(rgba(212, 165, 116, 0.05) 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }}
      >
        {/* ── Section 1: Hero Earnings Card ──────────────────────── */}
        <HeroEarningsCard rewardAmount={rewardAmount} />

        {/* ── Section 2: Referral Code + Share ───────────────────── */}
        {store.referralCode && (
          <ReferralCodeBlock
            referralCode={store.referralCode}
            onShare={(method) => {
              const text = `Join me on AURA CAFE! Use my referral code: ${store.referralCode}`;
              const urls: Record<string, string> = {
                zalo: `https://zalo.me/share?text=${encodeURIComponent(text)}`,
                messenger: `https://m.me/share?url=${encodeURIComponent(window.location.origin)}&text=${encodeURIComponent(text)}`,
                sms: `sms:?body=${encodeURIComponent(text)}`,
              };
              const url = urls[method];
              if (url) window.open(url, '_blank');
            }}
          />
        )}

        {/* ── Section 3: Progress Tracker ────────────────────────── */}
        <ProgressTracker
          current={store.referralCount}
          target={5}
        />

        {/* ── Section 4: Friend Network ────────────────────────── */}
        <FriendNetwork friends={friends} />

        {/* ── Section 5: Reward History ─────────────────────────── */}
        <RewardHistory rewards={rewards} />
      </main>

      {/* Fixed Bottom Navigation */}
      <BottomNav />
    </div>
  );
}

export default ReferralPage;
