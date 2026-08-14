import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen, fireEvent } from '@/test-utils';
import StitchReferralNew2 from '../StitchReferralNew2';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key?: string) => {
      const map: Record<string, string> = {
        'stitch.referral': 'Refer & Earn',
        'stitch.referralCode': 'Your Referral Code',
        'stitch.copy': 'Copy',
        'stitch.copied': 'Copied',
        'stitch.share': 'Share',
        'stitch.friends': 'Friends Referred',
        'stitch.rewards': 'Reward History',
        'stitch.noFriends': 'No friends referred yet',
        'stitch.loading': 'Loading...',
        'stitch.error': 'Failed to load referral data',
        'stitch.howItWorks': 'How It Works',
      };
      return map[key ?? ''] ?? key ?? '';
    },
  }),
}));

vi.mock('lucide-react', () => ({
  Copy: () => null,
  Share2: () => null,
  Check: () => null,
  Users: () => null,
  Gift: () => null,
  Loader2: () => null,
}));

describe('StitchReferralNew2', () => {
  it('renders the referral page', () => {
    renderWithProviders(<StitchReferralNew2 />);
    expect(screen.getByText('Refer & Earn')).toBeTruthy();
  });

  it('shows loading state', () => {
    renderWithProviders(<StitchReferralNew2 loadingState="loading" />);
    expect(screen.getByText('Loading...')).toBeTruthy();
  });

  it('shows error state', () => {
    renderWithProviders(<StitchReferralNew2 loadingState="error" />);
    expect(screen.getByText('Failed to load referral data')).toBeTruthy();
  });

  it('renders referral code', () => {
    renderWithProviders(
      <StitchReferralNew2
        data={{
          referralCode: 'AURA-XYZ',
          friendsReferred: 3,
          totalRewards: 150,
          rewardHistory: [],
        }}
      />,
    );
    expect(screen.getByText('AURA-XYZ')).toBeTruthy();
  });

  it('renders friends referred count', () => {
    renderWithProviders(
      <StitchReferralNew2
        data={{
          referralCode: 'AURA-XYZ',
          friendsReferred: 5,
          totalRewards: 200,
          rewardHistory: [],
        }}
      />,
    );
    expect(screen.getByText('5')).toBeTruthy();
  });

  it('renders how it works section', () => {
    renderWithProviders(<StitchReferralNew2 />);
    expect(screen.getByText('How It Works')).toBeTruthy();
  });

  it('renders reward history', () => {
    renderWithProviders(
      <StitchReferralNew2
        data={{
          referralCode: 'AURA-XYZ',
          friendsReferred: 1,
          totalRewards: 50,
          rewardHistory: [
            { id: '1', description: 'Friend signed up', date: '2024-01-01', points: 50 },
          ],
        }}
      />,
    );
    expect(screen.getByText('Friend signed up')).toBeTruthy();
  });
});
