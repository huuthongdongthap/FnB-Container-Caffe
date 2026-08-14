import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen } from '@/test-utils';
import { RewardsGrid } from '../loyalty-rewards-grid';
import type { LoyaltyRewardItem } from '../stitch-loyalty-types';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key?: string) => {
      const map: Record<string, string> = {
        'loyalty.availableRewards': 'Available Rewards',
        'loyalty.viewAll': 'View All',
        'loyalty.noRewards': 'No rewards available',
        'loyalty.claimRewardAria': 'Claim {{title}} for {{points}} points',
        'loyalty.pointsLabel': '{{count}} pts',
        'loyalty.claimReward': 'Claim',
      };
      return map[key ?? ''] ?? key ?? '';
    },
  }),
}));

const REWARDS: LoyaltyRewardItem[] = [
  { id: 'r1', title: 'Free Espresso', pointsCost: 500, imageUrl: '/img1.jpg', imageAlt: 'Espresso' },
  { id: 'r2', title: 'Free Latte', pointsCost: 800, imageUrl: '/img2.jpg', imageAlt: 'Latte' },
];

describe('RewardsGrid', () => {
  it('renders section heading', () => {
    renderWithProviders(<RewardsGrid rewards={REWARDS} />);
    expect(screen.getByText('Available Rewards')).toBeTruthy();
  });

  it('renders view all link', () => {
    renderWithProviders(<RewardsGrid rewards={REWARDS} />);
    const link = screen.getByText('View All').closest('a');
    expect(link?.getAttribute('href')).toBe('/loyalty');
  });

  it('renders reward cards', () => {
    renderWithProviders(<RewardsGrid rewards={REWARDS} />);
    expect(screen.getByText('Free Espresso')).toBeTruthy();
    expect(screen.getByText('Free Latte')).toBeTruthy();
  });

  it('renders empty state when no rewards', () => {
    renderWithProviders(<RewardsGrid rewards={[]} />);
    expect(screen.getByText('No rewards available')).toBeTruthy();
  });

  it('calls onClaimReward when a reward is clicked', () => {
    const onClaim = vi.fn();
    renderWithProviders(<RewardsGrid rewards={REWARDS} onClaimReward={onClaim} />);
    screen.getByText('Free Espresso').click();
    expect(onClaim).toHaveBeenCalledWith('r1');
  });
});
