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
}
