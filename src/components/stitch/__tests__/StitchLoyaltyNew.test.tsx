import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderWithProviders, screen } from '@/test-utils';
import { StitchLoyaltyNew } from '../StitchLoyaltyNew';
import type { LoyaltyDashboardData } from '../stitch-loyalty-types';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key?: string, opts?: Record<string, unknown>) => {
      const map: Record<string, string> = {
        'loyalty.errorDescription': 'Failed to load loyalty data',
        'loyalty.emptyDescription': 'No loyalty data yet',
        'loyalty.tierCardAria': 'Tier card for {{tierName}}',
        'loyalty.tierBadge': '{{tierName}}',
        'loyalty.memberSince': 'Member since {{year}}',
        'loyalty.nextLevel': 'Next Level: {{tierName}}',
        'loyalty.ptsRemaining': '{{count}} pts remaining',
        'loyalty.balance': 'Balance',
        'loyalty.premiumRewardPoints': 'PREMIUM REWARD POINTS',
        'loyalty.redeemPointsAria': 'Redeem {{balance}} points',
        'loyalty.redeemPoints': 'Redeem Points',
        'loyalty.availableRewards': 'Available Rewards',
        'loyalty.viewAll': 'View All',
        'loyalty.noRewards': 'No rewards available',
        'loyalty.weeklyStreakAria': 'Weekly Streak',
        'loyalty.weeklyStreak': 'Weekly Streak',
        'loyalty.streakDescription': 'You have a {{count}} day streak!',
        'loyalty.checkinAria': 'Check in at Roastery',
        'loyalty.checkinRoastery': 'Check in at Roastery',
        'loyalty.referEarn': 'Refer & Earn',
        'loyalty.referDescription': 'Invite friends.',
        'loyalty.copy': 'Copy',
        'loyalty.copied': 'Copied',
        'loyalty.copyCodeAria': 'Copy code',
        'loyalty.codeCopiedAria': 'Code copied',
        'loyalty.shareCodeAria': 'Share code',
        'loyalty.shareInviteLink': 'Share Invite Link',
        'loyalty.referralSectionAria': 'Referral',
        'loyalty.tierBenefitsAria': 'Tier Benefits',
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
  Trans: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('lucide-react', () => ({
  Sparkles: () => null,
  Award: () => null,
  MapPin: () => null,
  Copy: () => null,
  Check: () => null,
  Share2: () => null,
  AlertCircle: () => null,
  Gift: () => null,
  Filter: () => null,
}));

const MOCK_DATA: LoyaltyDashboardData = {
  tierName: 'Platinum',
  memberSince: '2023',
  tierDescription: 'Top tier.',
  nextTier: 'Diamond',
  pointsRemainingForNextTier: 500,
  progressPercent: 75,
  pointsBalance: 12500,
  streakCount: 5,
  referralCode: 'PLAT-XYZ',
  rewards: [{ id: 'r1', title: 'Free Espresso', pointsCost: 500, imageUrl: '/e.jpg', imageAlt: 'E' }],
  pointsHistory: [{ id: 'h1', activity: 'Purchase', date: '2024-01-01', status: 'completed', points: 100 }],
  streakDays: [
    { label: 'M', checked: true },
    { label: 'T', checked: true },
  ],
  tierBenefits: [{ label: 'Free coffee' }],
};

describe('StitchLoyaltyNew', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders loading skeleton when loadingState is loading', () => {
    const { container } = renderWithProviders(
      <StitchLoyaltyNew loadingState="loading" />,
    );
    expect(container.querySelector('.animate-pulse')).toBeTruthy();
  });

  it('renders error state when loadingState is error', () => {
    renderWithProviders(
      <StitchLoyaltyNew loadingState="error" errorMessage="Network error" />,
    );
    expect(screen.getByText('Network error')).toBeTruthy();
  });

  it('renders empty state when pointsBalance is 0', () => {
    const emptyData = { ...MOCK_DATA, pointsBalance: 0, rewards: [], pointsHistory: [] };
    renderWithProviders(<StitchLoyaltyNew data={emptyData} />);
    // Empty state renders a status role div
    expect(screen.getByRole('status')).toBeTruthy();
  });

  it('renders tier card with balance when data provided', () => {
    renderWithProviders(<StitchLoyaltyNew data={MOCK_DATA} />);
    expect(screen.getByText('12,500')).toBeTruthy();
    expect(screen.getByText('Platinum')).toBeTruthy();
  });

  it('renders rewards section', () => {
    renderWithProviders(<StitchLoyaltyNew data={MOCK_DATA} />);
    expect(screen.getByText('Available Rewards')).toBeTruthy();
    expect(screen.getByText('Free Espresso')).toBeTruthy();
  });
});
