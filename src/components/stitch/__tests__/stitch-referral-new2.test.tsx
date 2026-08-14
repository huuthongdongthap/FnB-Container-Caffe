import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen } from '@/test-utils';
import { StitchReferralNew2 } from '../StitchReferralNew2';
import type { ReferralPageData } from '../StitchReferralNew2';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key?: string, optsOrFallback?: string | { defaultValue?: string }) => {
      const map: Record<string, string> = {};
      if (map[key ?? '']) return map[key ?? ''];
      if (typeof optsOrFallback === 'string') return optsOrFallback;
      if (optsOrFallback && typeof optsOrFallback === 'object' && 'defaultValue' in optsOrFallback) return optsOrFallback.defaultValue ?? key ?? '';
      return key ?? '';
    },
    i18n: { language: 'en', changeLanguage: vi.fn() },
  }),
  Trans: ({ children }: { children: React.ReactNode }) => children,
}));

const MOCK_DATA: ReferralPageData = {
  rewardAmount: 15,
  referralCode: 'AURA-TEST-2024',
  currentReferrals: 3,
  targetReferrals: 5,
  progressPercent: 60,
  nextBonusAmount: 50,
  nextBonusLabel: 'Reach 5 referrals for $50 credit.',
  memberTier: 'SILVER MEMBER',
  totalEarned: 45,
  friends: [
    { id: 'f1', name: 'Alex N.', joinedDate: 'Oct 12, 2023', avatarUrl: '', avatarAlt: 'Alex', status: 'active' },
    { id: 'f2', name: 'Elena S.', joinedDate: 'Oct 08, 2023', avatarUrl: '', avatarAlt: 'Elena', status: 'joined' },
  ],
  rewardHistory: [
    { id: 'h1', date: 'Oct 12, 2023', source: 'Referral Reward', amount: 15 },
    { id: 'h2', date: 'Oct 01, 2023', source: 'Monthly Bonus', amount: 10 },
  ],
};

describe('StitchReferralNew2', () => {
  beforeEach(() => {
    Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
  });

  it('renders referral code', () => {
    renderWithProviders(<StitchReferralNew2 data={MOCK_DATA} />);
    expect(screen.getByDisplayValue('AURA-TEST-2024')).toBeTruthy();
  });

  it('renders friend list', () => {
    renderWithProviders(<StitchReferralNew2 data={MOCK_DATA} />);
    expect(screen.getByText('Alex N.')).toBeTruthy();
    expect(screen.getByText('Elena S.')).toBeTruthy();
  });

  it('renders reward history', () => {
    renderWithProviders(<StitchReferralNew2 data={MOCK_DATA} />);
    expect(screen.getByText('Referral Reward')).toBeTruthy();
    expect(screen.getByText('Monthly Bonus')).toBeTruthy();
  });

  it('renders member tier label', () => {
    renderWithProviders(<StitchReferralNew2 data={MOCK_DATA} />);
    // memberTier is rendered via t() which returns the key in mock
    expect(screen.getByText('stitch.referral.memberTier')).toBeTruthy();
  });

  it('calls onCopyCode when copy button is clicked', () => {
    const onCopyCode = vi.fn();
    renderWithProviders(<StitchReferralNew2 data={MOCK_DATA} onCopyCode={onCopyCode} />);
    const copyBtn = screen.getByRole('button', { name: /copy/i });
    copyBtn.click();
    expect(onCopyCode).toHaveBeenCalledWith('AURA-TEST-2024');
  });

  it('renders loading skeleton when loading', () => {
    const { container } = renderWithProviders(<StitchReferralNew2 loadingState="loading" />);
    expect(container.innerHTML).toContain('animate-pulse');
  });

  it('renders error state', () => {
    renderWithProviders(<StitchReferralNew2 loadingState="error" errorMessage="Network error" />);
    expect(screen.getByText('Network error')).toBeTruthy();
  });
});
