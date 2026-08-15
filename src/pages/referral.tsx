/**
 * ReferralPage — AURA CAFE Referral Program (Stitch AI design)
 *
 * Thin wrapper around StitchReferralNew1. Keeps store logic, auth gate,
 * and data mapping intact. All presentation handled by the Stitch component.
 */
'use client';

import { useEffect } from 'react';
import { HelmetHead } from '@/components/seo/HelmetHead';
import { useReferralStore } from '@/hooks/stores/use-referral-store';
import { useAuthStore } from '@/hooks/stores/use-auth-store';
import {
  StitchReferralNew1,
} from '@/components/stitch/StitchReferralNew1';
import type {
  ReferralFriendEntry,
  RewardHistoryRow,
  ReferralPageData,
  ReferralLoadingState,
} from '@/components/stitch/StitchReferralNew1';

/* ─── Constants ───────────────────────────────────────────────────── */

const SHARE_METHOD_KEYS = ['zalo', 'messenger', 'sms'] as const;
const TARGET_REFERRALS = 5;

/* ─── Helpers ─────────────────────────────────────────────────────── */

function isShareMethodKey(value: string): value is (typeof SHARE_METHOD_KEYS)[number] {
  return (SHARE_METHOD_KEYS as readonly string[]).includes(value);
}

function getInitialsAvatar(name: string): string {
  const initial = name.charAt(0).toUpperCase();
  return `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40">` +
    `<rect width="40" height="40" fill="#1e3550"/>` +
    `<text x="20" y="26" text-anchor="middle" fill="#a0a8b0" font-family="'Space Grotesk', sans-serif" font-size="16" font-weight="600">${initial}</text>` +
    `</svg>`
  )}`;
}

/* ─── Main Page Component ──────────────────────────────────────────── */

export function ReferralPage() {
  const store = useReferralStore();
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = !!user;

  useEffect(() => {
    if (isAuthenticated) {
      store.fetchReferralData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  /* ─── Map store state to Stitch component props ───────────────── */

  const loadingState: ReferralLoadingState =
    store.loading && !store.referralCode
      ? 'loading'
      : store.error && !store.referralCode
        ? 'error'
        : 'idle';

  const errorMessage = store.error ?? '';

  const friends: ReferralFriendEntry[] = store.recentReferrals.map((r) => ({
    id: r.id,
    name: r.referredName,
    joinedDate: new Date(r.createdAt).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }),
    status:
      r.status === 'active' || r.status === 'completed' ? 'active' : 'joined',
    avatarUrl: getInitialsAvatar(r.referredName),
    avatarAlt: `${r.referredName}`,
  }));

  const rewardHistory: RewardHistoryRow[] = store.recentReferrals
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

  const data: ReferralPageData | undefined = store.referralCode
    ? {
        rewardAmount,
        referralCode: store.referralCode,
        currentReferrals: store.referralCount,
        targetReferrals: TARGET_REFERRALS,
        progressPercent: Math.min(
          Math.round((store.referralCount / TARGET_REFERRALS) * 100),
          100
        ),
        friends,
        rewardHistory,
      }
    : undefined;

  /* ─── onCopyCode: differentiate share-method keys from code ──── */

  const handleCopyCode = (arg: string) => {
    if (isShareMethodKey(arg)) {
      const text = `Join me on AURA CAFE! Use my referral code: ${store.referralCode}`;
      const urls: Record<string, string> = {
        zalo: `https://zalo.me/share?text=${encodeURIComponent(text)}`,
        messenger: `https://m.me/share?url=${encodeURIComponent(window.location.origin)}&text=${encodeURIComponent(text)}`,
        sms: `sms:?body=${encodeURIComponent(text)}`,
      };
      const url = urls[arg];
      if (url) window.open(url, '_blank');
    }
    // When called with the actual code string, the Stitch component
    // handles clipboard copy internally — no wrapper action needed.
  };

  return (
    <>
      <HelmetHead
        title="Referral Program — AURA CAFE"
        description="Refer friends to AURA CAFE and earn rewards. Gioi thieu ban be den AURA CAFE va nhan qua."
      />
      <StitchReferralNew1
        data={data}
        loadingState={loadingState}
        errorMessage={errorMessage}
        onCopyCode={handleCopyCode}
        onViewProfile={() => {
          /* Placeholder: profile view pending implementation */
        }}
      />
    </>
  );
}

export default ReferralPage;
