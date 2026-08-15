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
  it('renders the referral page with hero title', () => {
    renderWithProviders(<StitchReferralNew2 />);
    // t('stitch.referral.heroTitle') → mock returns 'Hero Title'
    expect(screen.getByText('Hero Title')).toBeTruthy();
  });

  it('shows loading skeleton', () => {
    const { container } = renderWithProviders(<StitchReferralNew2 loadingState="loading" />);
    // Loading renders a skeleton with animate-pulse divs
    expect(container.querySelector('.animate-pulse')).toBeTruthy();
  });

  it('shows error state', () => {
    renderWithProviders(<StitchReferralNew2 loadingState="error" />);
    // t('stitch.referral.errorTitle') → mock returns 'Error Title'
    expect(screen.getByText('Error Title')).toBeTruthy();
  });

  it('renders referral code in input', () => {
    renderWithProviders(
      <StitchReferralNew2
        data={{
          rewardAmount: 150,
          totalEarned: 150,
          referralCode: 'AURA-XYZ',
          currentReferrals: 3,
          targetReferrals: 10,
          progressPercent: 30,
          nextBonusAmount: 50,
          nextBonusLabel: 'Gold',
          memberTier: 'Silver',
          friends: [],
          rewardHistory: [],
        }}
      />,
    );
    // Code is in an <input value=...>
    expect(screen.getByDisplayValue('AURA-XYZ')).toBeTruthy();
  });

  it('renders member tier', () => {
    renderWithProviders(
      <StitchReferralNew2
        data={{
          rewardAmount: 200,
          totalEarned: 200,
          referralCode: 'AURA-XYZ',
          currentReferrals: 5,
          targetReferrals: 10,
          progressPercent: 50,
          nextBonusAmount: 100,
          nextBonusLabel: 'Gold',
          memberTier: 'Silver',
          friends: [],
          rewardHistory: [],
        }}
      />,
    );
    // t('stitch.referral.memberTier') returns key; renders 'Member Tier'
    expect(screen.getByText('Member Tier')).toBeTruthy();
  });

  it('renders empty friends section', () => {
    renderWithProviders(
      <StitchReferralNew2
        data={{
          rewardAmount: 200,
          totalEarned: 200,
          referralCode: 'AURA-XYZ',
          currentReferrals: 5,
          targetReferrals: 10,
          progressPercent: 50,
          nextBonusAmount: 100,
          nextBonusLabel: 'Gold',
          memberTier: 'Silver',
          friends: [],
          rewardHistory: [],
        }}
      />,
    );
    // t('stitch.referral.friendsEmpty') returns key
    expect(screen.getByText('Friends Empty')).toBeTruthy();
  });

  it('renders reward history', () => {
    renderWithProviders(
      <StitchReferralNew2
        data={{
          rewardAmount: 50,
          totalEarned: 50,
          referralCode: 'AURA-XYZ',
          currentReferrals: 1,
          targetReferrals: 10,
          progressPercent: 10,
          nextBonusAmount: 25,
          nextBonusLabel: 'Silver',
          memberTier: 'Bronze',
          friends: [],
          rewardHistory: [
            { id: '1', date: '2024-01-01', source: 'Friend signed up', amount: 50 },
          ],
        }}
      />,
    );
    expect(screen.getByText('Friend signed up')).toBeTruthy();
  });
});
