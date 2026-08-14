import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen, fireEvent } from '@/test-utils';
import { RewardCard } from '../loyalty-reward-card';
import type { LoyaltyRewardItem } from '../stitch-loyalty-types';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key?: string, opts?: Record<string, unknown>) => {
      const map: Record<string, string> = {
        'loyalty.claimReward': 'Claim Reward',
      }
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

const MOCK_REWARD: LoyaltyRewardItem = {
  id: 'r1',
  title: 'Free Latte',
  description: 'A free latte of your choice.',
  pointsCost: 500,
  imageUrl: '/latte.jpg',
  imageAlt: 'Latte',
  expiresAt: '2025-12-31',
};

describe('RewardCard', () => {
  it('renders reward title and description', () => {
    renderWithProviders(<RewardCard reward={MOCK_REWARD} />);
    expect(screen.getByText('Free Latte')).toBeTruthy();
    expect(screen.getByText('A free latte of your choice.')).toBeTruthy();
  });

  it('renders points cost', () => {
    renderWithProviders(<RewardCard reward={MOCK_REWARD} />);
    expect(screen.getByText('500 pts')).toBeTruthy();
  });

  it('calls onClaim when clicked', () => {
    const onClaim = vi.fn();
    renderWithProviders(<RewardCard reward={MOCK_REWARD} onClaim={onClaim} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onClaim).toHaveBeenCalledWith('r1');
  });

  it('has accessible aria-label', () => {
    renderWithProviders(<RewardCard reward={MOCK_REWARD} />);
    expect(screen.getByRole('button')).toHaveAttribute(
      'aria-label',
      'Claim Free Latte for 500 points',
    );
  });
});
