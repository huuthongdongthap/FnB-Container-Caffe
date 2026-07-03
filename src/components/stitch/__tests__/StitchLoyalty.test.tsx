import { describe, it, expect, vi } from 'vitest';
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
    { id: 'r1', title: 'Private Cupping Session', pointsCost: 4500, imageUrl: 'https://example.com/img1.jpg', imageAlt: 'Private coffee cupping session' },
    { id: 'r2', title: 'Limited Edition Vessel', pointsCost: 8000, imageUrl: 'https://example.com/img2.jpg', imageAlt: 'Limited edition ceramic vessel' },
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

const MINIMAL_DATA: LoyaltyDashboardData = {
  ...MOCK_DATA,
  rewards: [],
  pointsHistory: [],
};

describe('StitchLoyalty', () => {
  it('renders loading skeleton when loadingState is loading', () => {
    const { container } = render(<StitchLoyalty loadingState="loading" />);
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('renders error state when loadingState is error', () => {
    render(<StitchLoyalty loadingState="error" errorMessage="Server timeout" />);
    expect(screen.getByText('Failed to Load Loyalty Data')).toBeInTheDocument();
    expect(screen.getByText('Server timeout')).toBeInTheDocument();
  });

  it('renders empty state when pointsBalance is 0', () => {
    render(<StitchLoyalty data={{ ...MOCK_DATA, pointsBalance: 0 }} />);
    expect(screen.getByText('No Loyalty Data Yet')).toBeInTheDocument();
  });

  it('renders full loyalty dashboard with tier card, rewards, and history', () => {
    render(<StitchLoyalty data={MOCK_DATA} />);
    expect(screen.getByText('Platinum Tier')).toBeInTheDocument();
    expect(screen.getByText('Member Since 2022')).toBeInTheDocument();
    expect(screen.getByText(/Black Tier/)).toBeInTheDocument();
    expect(screen.getByText('2,550 pts remaining')).toBeInTheDocument();
    expect(screen.getByText('12,450')).toBeInTheDocument();
    expect(screen.getByText('PREMIUM REWARD POINTS')).toBeInTheDocument();
  });

  it('renders rewards section', () => {
    render(<StitchLoyalty data={MOCK_DATA} />);
    expect(screen.getByText('Available Rewards')).toBeInTheDocument();
    expect(screen.getByText('Private Cupping Session')).toBeInTheDocument();
    expect(screen.getByText('Limited Edition Vessel')).toBeInTheDocument();
  });

  it('renders points history', () => {
    render(<StitchLoyalty data={MOCK_DATA} />);
    expect(screen.getByText('Points History')).toBeInTheDocument();
    expect(screen.getByText('Kenya SL28 Purchase')).toBeInTheDocument();
    expect(screen.getByText('+450')).toBeInTheDocument();
  });

  it('renders weekly streak section', () => {
    render(<StitchLoyalty data={MOCK_DATA} />);
    expect(screen.getByText('Weekly Streak')).toBeInTheDocument();
    expect(screen.getByText('MON')).toBeInTheDocument();
    expect(screen.getByText('TUE')).toBeInTheDocument();
    expect(screen.getByText('12-day streak')).toBeInTheDocument();
  });

  it('renders referral section', () => {
    render(<StitchLoyalty data={MOCK_DATA} />);
    expect(screen.getByText('Refer & Earn')).toBeInTheDocument();
    expect(screen.getByText('AURA-PLAT-882')).toBeInTheDocument();
  });

  it('renders tier benefits', () => {
    render(<StitchLoyalty data={MOCK_DATA} />);
    expect(screen.getByText('Tier Benefits')).toBeInTheDocument();
    expect(screen.getByText('Complementary valet parking')).toBeInTheDocument();
    expect(screen.getByText('Priority reservation access')).toBeInTheDocument();
  });

  it('renders empty rewards message when no rewards', () => {
    render(<StitchLoyalty data={MINIMAL_DATA} />);
    expect(screen.getByText('No rewards available right now.')).toBeInTheDocument();
  });

  it('renders empty points history message', () => {
    render(<StitchLoyalty data={MINIMAL_DATA} />);
    expect(screen.getByText('No points history yet.')).toBeInTheDocument();
  });

  it('calls onRedeemPoints when Redeem Points is clicked', () => {
    const onRedeemPoints = vi.fn();
    render(<StitchLoyalty data={MOCK_DATA} onRedeemPoints={onRedeemPoints} />);
    screen.getByText('Redeem Points').click();
    expect(onRedeemPoints).toHaveBeenCalledOnce();
  });
});
