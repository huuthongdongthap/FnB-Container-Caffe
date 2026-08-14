import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen, fireEvent } from '@/test-utils';
import { StitchReferralNew2 } from '../StitchReferralNew2';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key?: string, optsOrFallback?: string | { defaultValue?: string }) => {
      const map: Record<string, string> = {
        'stitch.referral.backAria': 'Back Aria',
        'stitch.referral.codeCopied': 'Code Copied',
        'stitch.referral.colAmount': 'Col Amount',
        'stitch.referral.colDate': 'Col Date',
        'stitch.referral.colSource': 'Col Source',
        'stitch.referral.copiedAria': 'Copied Aria',
        'stitch.referral.copyAria': 'Copy Aria',
        'stitch.referral.copyCode': 'Copy Code',
        'stitch.referral.currentLevel': 'Current Level',
        'stitch.referral.defaultError': 'Default Error',
        'stitch.referral.desktopNavAria': 'Desktop Nav Aria',
        'stitch.referral.downloadStatement': 'Download Statement',
        'stitch.referral.downloadStatementAria': 'Download Statement Aria',
        'stitch.referral.emptyDesc': 'Empty Desc',
        'stitch.referral.emptyTitle': 'Empty Title',
        'stitch.referral.errorTitle': 'Error Title',
        'stitch.referral.friendsEmpty': 'Friends Empty',
        'stitch.referral.headerAria': 'Header Aria',
        'stitch.referral.heroAria': 'Hero Aria',
        'stitch.referral.heroDescription': 'Hero Description',
        'stitch.referral.heroPerReferral': 'Hero Per Referral',
        'stitch.referral.heroTagline': 'Hero Tagline',
        'stitch.referral.heroTitle': 'Hero Title',
        'stitch.referral.memberTier': 'Member Tier',
        'stitch.referral.navAria': 'Nav Aria',
        'stitch.referral.navMenu': 'Nav Menu',
        'stitch.referral.navProfile': 'Nav Profile',
        'stitch.referral.navReferrals': 'Nav Referrals',
        'stitch.referral.navRewards': 'Nav Rewards',
        'stitch.referral.networkTitle': 'Network Title',
        'stitch.referral.premiumUnlock': 'Premium Unlock',
        'stitch.referral.progressAria': 'Progress Aria',
        'stitch.referral.progressTitle': 'Progress Title',
        'stitch.referral.referralCodeAria': 'Referral Code Aria',
        'stitch.referral.referralCodeSectionAria': 'Referral Code Section Aria',
        'stitch.referral.referrals': 'Referrals',
        'stitch.referral.rewardsEmpty': 'Rewards Empty',
        'stitch.referral.rewardsTitle': 'Rewards Title',
        'stitch.referral.statusActive': 'Status Active',
        'stitch.referral.statusJoined': 'Status Joined',
      }
      if (map[key ?? '']) return map[key ?? ''];
      if (typeof optsOrFallback === 'string') return optsOrFallback;
      if (optsOrFallback && typeof optsOrFallback === 'object' && 'defaultValue' in optsOrFallback) return optsOrFallback.defaultValue ?? key ?? '';
      return key ?? '';
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
