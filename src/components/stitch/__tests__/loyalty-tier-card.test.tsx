import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen } from '@/test-utils';
import { TierCard } from '../loyalty-tier-card';
import type { LoyaltyDashboardData } from '../stitch-loyalty-types';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key?: string, opts?: Record<string, unknown>) => {
      const map: Record<string, string> = {
        'loyalty.tierCardAria': 'Tier card for {{tierName}}',
        'loyalty.tierBadge': '{{tierName}}',
        'loyalty.memberSince': 'Member since {{year}}',
        'loyalty.nextLevel': 'Next Level: {{tierName}}',
        'loyalty.ptsRemaining': '{{count}} pts remaining',
        'loyalty.balance': 'Balance',
        'loyalty.premiumRewardPoints': 'PREMIUM REWARD POINTS',
        'loyalty.redeemPointsAria': 'Redeem {{balance}} points',
        'loyalty.redeemPoints': 'Redeem Points',
      };
      let text = map[key ?? ''] ?? key ?? '';
      if (opts) {
        for (const [k, v] of Object.entries(opts)) {
          text = text.replaceAll(`{{${k}}}`, String(v));
        }
      }
      return text;
    },
  }),
}));

const MOCK_DATA: LoyaltyDashboardData = {
  tierName: 'Platinum',
  memberSince: '2023',
  tierDescription: 'Top-tier member.',
  nextTier: 'Diamond',
  pointsRemainingForNextTier: 500,
  progressPercent: 75,
  pointsBalance: 12500,
  streakCount: 7,
  referralCode: 'PLAT-XYZ',
  rewards: [],
  pointsHistory: [],
  streakDays: [],
  tierBenefits: [],
};

describe('TierCard', () => {
  it('renders tier badge and member since', () => {
    renderWithProviders(<TierCard data={MOCK_DATA} />);
    expect(screen.getByText('Platinum')).toBeTruthy();
    expect(screen.getByText('Member since 2023')).toBeTruthy();
  });

  it('renders tier description', () => {
    renderWithProviders(<TierCard data={MOCK_DATA} />);
    expect(screen.getByText('Top-tier member.')).toBeTruthy();
  });

  it('renders points balance', () => {
    renderWithProviders(<TierCard data={MOCK_DATA} />);
    expect(screen.getByText('12,500')).toBeTruthy();
    expect(screen.getByText('Balance')).toBeTruthy();
  });

  it('calls onRedeemPoints when redeem button clicked', () => {
    const onRedeem = vi.fn();
    renderWithProviders(<TierCard data={MOCK_DATA} onRedeemPoints={onRedeem} />);
    screen.getByText('Redeem Points').click();
    expect(onRedeem).toHaveBeenCalledOnce();
  });

  it('renders progress info', () => {
    renderWithProviders(<TierCard data={MOCK_DATA} />);
    expect(screen.getByText('Next Level: Diamond')).toBeTruthy();
    expect(screen.getByText('500 pts remaining')).toBeTruthy();
  });
});
