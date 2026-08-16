/**
 * StitchAccountDashNew — AURA CAFE Account Dashboard
 *
 * Mobile-first, dark navy theme with glassmorphism cards, bronze gradients,
 * and chrome/silver accents.
 *
 * Source: Stitch AI account dashboard export (new variant).
 */
'use client';

import { useTranslation } from 'react-i18next';
import { useAccount } from '@/hooks/use-account';
import { useAuthStore } from '@/hooks/stores/use-auth-store';
import { StitchAccountDashNew } from '@/components/stitch';
import type { DashAccountProfile, DashLoyaltyData, DashOrderItem } from '@/components/stitch';

import { getTierProgress, formatTimeAgo, mapOrderItemIcon, mapOrderStatus } from './account-constants';
import { AccountNotLoggedIn } from './account-not-logged-in';
import { AccountLoading } from './account-loading';
import { AccountError } from './account-error';
import { AccountEmpty } from './account-empty';
import { NotificationPreferences } from '@/components/account/notification-preferences';

/* ─── Re-exports for backward compatibility ──────────────────────── */
export { AccountNotLoggedIn } from './account-not-logged-in';
export { AccountLoading } from './account-loading';
export { AccountError } from './account-error';
export { AccountEmpty } from './account-empty';
export {
  TIER_ORDER,
  TIER_POINTS,
  getNextTier,
  getTierProgress,
  formatTimeAgo,
  mapOrderItemIcon,
  mapOrderStatus,
} from './account-constants';

/* ─── Main Component ─────────────────────────────────────────────── */

export default function AccountPage() {
  const user = useAuthStore((s) => s.user);
  const { profile, orders, loading, error, refetchProfile } = useAccount();
  const { t } = useTranslation('account');

  if (!user) return <AccountNotLoggedIn />;
  if (loading) return <AccountLoading />;
  if (error && !profile) return <AccountError error={error} onRetry={refetchProfile} />;

  /* ─── Profile loaded with data ──────────────────────────────────── */
  if (profile) {
    const points = profile.loyalty_points ?? profile.cashback_balance ?? 0;
    const lifetimePoints = profile.lifetime_points ?? points;
    const progress = getTierProgress(profile.loyalty_tier, lifetimePoints);

    const dashProfile: DashAccountProfile = {
      name: profile.name,
      avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.name)}&background=1e3550&color=c6c6c7&size=80`,
      tier: profile.loyalty_tier.charAt(0).toUpperCase() + profile.loyalty_tier.slice(1),
      memberSince: new Date(profile.created_at).getFullYear().toString(),
    };

    const dashLoyalty: DashLoyaltyData = {
      points,
      nextTier: progress.nextTier
        ? progress.nextTier.charAt(0).toUpperCase() + progress.nextTier.slice(1)
        : profile.loyalty_tier.charAt(0).toUpperCase() + profile.loyalty_tier.slice(1),
      pointsToNext: progress.remaining,
      progressPercent: progress.percent,
    };

    const dashOrders: DashOrderItem[] = orders.map((order) => {
      let items: { product_name: string; quantity: number }[] = [];
      try { items = JSON.parse(order.items) as { product_name: string; quantity: number }[]; } catch { items = []; }
      const productName = items.length > 0 ? items[0]!.product_name : 'Order';

      return {
        id: order.id,
        itemName: productName,
        icon: mapOrderItemIcon(productName),
        time: formatTimeAgo(order.created_at, t),
        status: mapOrderStatus(order.status),
        rawItems: order.items,
      };
    });

    return (
      <>
        <StitchAccountDashNew
          profile={dashProfile}
          loyalty={dashLoyalty}
          orders={dashOrders}
        />
        <div className="max-w-md mx-auto px-4 pb-8 -mt-4">
          <NotificationPreferences customerId={user.id} />
        </div>
      </>
    );
  }

  return <AccountEmpty />;
}
