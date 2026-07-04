import { describe, it, expect } from 'vitest';
import { render, screen } from '@/test-utils';
import StitchLoyalty from '@/components/stitch/StitchLoyalty';
import type { LoyaltyDashboardData } from '@/components/stitch/StitchLoyalty';

const MOCK_DATA: LoyaltyDashboardData = {
  tierName: 'Platinum',
  memberSince: '2022',
  tierDescription: 'You are in the top 2% of our community.',
  nextTier: 'Black Tier',
  pointsRemainingForNextTier: 2550,
  progressPercent: 78,
  pointsBalance: 12450,
  streakCount: 12,
  referralCode: 'AURA-PLAT-882',
  rewards: [
    { id: 'r1', title: 'Private Cupping Session', pointsCost: 4500, imageUrl: '', imageAlt: '' },
    { id: 'r2', title: 'Limited Edition Vessel', pointsCost: 8000, imageUrl: '', imageAlt: '' },
  ],
  pointsHistory: [
    { id: 'h1', activity: 'Kenya SL28 Purchase', date: 'OCT 24, 2024', status: 'completed', points: 450 },
  ],
  streakDays: [
    { label: 'MON', checked: true },
    { label: 'TUE', checked: false },
  ],
  tierBenefits: [
    { label: 'Complementary valet parking' },
    { label: 'Priority reservation access' },
  ],
};

describe('StitchLoyalty', () => {
  it('renders loading skeleton when loadingState is loading', () => {
    const { container } = render(<StitchLoyalty loadingState="loading" />);
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('renders error state when loadingState is error', () => {
    render(<StitchLoyalty loadingState="error" errorMessage="Server timeout" />);
    expect(screen.getByText('Server timeout')).toBeInTheDocument();
  });

  it('renders with mock data', () => {
    const { container } = render(<StitchLoyalty data={MOCK_DATA} />);
    expect(container.firstChild).toBeTruthy();
  });
});
