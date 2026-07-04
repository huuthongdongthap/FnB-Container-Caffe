import { describe, it, expect } from 'vitest';
import { render, screen } from '@/test-utils';
import StitchReferral from '@/components/stitch/StitchReferral';

describe('StitchReferral', () => {
  it('renders loading skeleton when loadingState is loading', () => {
    const { container } = render(<StitchReferral loadingState="loading" />);
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('renders error state', () => {
    render(<StitchReferral loadingState="error" errorMessage="Failed" />);
    expect(screen.getByText('Failed')).toBeInTheDocument();
  });

  it('renders with data props', () => {
    const { container } = render(<StitchReferral data={{ referralCode: 'CODE-123', rewardAmount: 15, currentReferrals: 0, targetReferrals: 5, progressPercent: 0, friends: [], rewardHistory: [] }} />);
    expect(container.firstChild).toBeTruthy();
  });
});
