import type { TFunction } from 'i18next';
import type { LoyaltyDashboardData } from './stitch-loyalty-types';

export function getDefaultLoyaltyData(t: TFunction): LoyaltyDashboardData {
  return {
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
        imageUrl: '/photos/IMG_6566.webp',
        imageAlt: t('loyalty.defaultReward1Alt'),
      },
      {
        id: 'r2',
        title: t('loyalty.defaultReward2', 'Limited Edition Vessel'),
        pointsCost: 8000,
        imageUrl: '/photos/IMG_6699.webp',
        imageAlt: t('loyalty.defaultReward2Alt'),
      },
      {
        id: 'r3',
        title: t('loyalty.defaultReward3', 'Artisan Coffee Flight'),
        pointsCost: 2500,
        imageUrl: '/photos/IMG_6702.webp',
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
    tierLadder: [
      { tier_name: 'bronze', display_name_vi: 'Đồng', min_points: 0, point_multiplier: 1.0, cashback_rate: 0.03, is_current: true },
      { tier_name: 'silver', display_name_vi: 'Bạc', min_points: 50, point_multiplier: 1.1, cashback_rate: 0.05, is_current: false },
      { tier_name: 'gold', display_name_vi: 'Vàng', min_points: 200, point_multiplier: 1.3, cashback_rate: 0.07, is_current: false },
      { tier_name: 'platinum', display_name_vi: 'Bạch Kim', min_points: 500, point_multiplier: 1.5, cashback_rate: 0.10, is_current: false },
    ],
  };
}
