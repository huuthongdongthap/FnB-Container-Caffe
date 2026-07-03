import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@/test-utils';
import StitchReferral from '@/components/stitch/StitchReferral';

describe('StitchReferral', () => {
  it('renders loading skeleton when loadingState is loading', () => {
    const { container } = render(<StitchReferral loadingState="loading" />);
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('renders error state when loadingState is error', () => {
    render(<StitchReferral loadingState="error" errorMessage="API unavailable" />);
    expect(screen.getByText('Failed to Load Referral Data')).toBeInTheDocument();
    expect(screen.getByText('API unavailable')).toBeInTheDocument();
  });

  it('renders hero earnings card', () => {
    render(<StitchReferral />);
    expect(screen.getByText('Refer & Earn')).toBeInTheDocument();
    expect(screen.getByText(/Receive/)).toBeInTheDocument();
  });

  it('renders referral code', () => {
    render(<StitchReferral />);
    expect(screen.getByText('AURA-LUXE-88')).toBeInTheDocument();
  });

  it('renders copy code and share buttons', () => {
    render(<StitchReferral />);
    expect(screen.getByText('Copy Code')).toBeInTheDocument();
    expect(screen.getByText('Zalo')).toBeInTheDocument();
    expect(screen.getByText('Messenger')).toBeInTheDocument();
    expect(screen.getByText('SMS')).toBeInTheDocument();
  });

  it('renders progress tracker', () => {
    render(<StitchReferral />);
    expect(screen.getByText('Path to Platinum')).toBeInTheDocument();
    expect(screen.getByText('Unlock $50 exclusive bonus')).toBeInTheDocument();
    expect(screen.getByText('3/5')).toBeInTheDocument();
    expect(screen.getByText('Referrals')).toBeInTheDocument();
  });

  it('renders friend network', () => {
    render(<StitchReferral />);
    expect(screen.getByText('Recent Network')).toBeInTheDocument();
    expect(screen.getByText('Julian Vane')).toBeInTheDocument();
    expect(screen.getByText('Elara Thorne')).toBeInTheDocument();
    expect(screen.getByText('Marcus Chen')).toBeInTheDocument();
  });

  it('renders reward history', () => {
    render(<StitchReferral />);
    expect(screen.getByText('Reward History')).toBeInTheDocument();
    expect(screen.getByText('24 Oct')).toBeInTheDocument();
    expect(screen.getByText('J. Vane')).toBeInTheDocument();
    expect(screen.getAllByText(/15\.00/).length).toBeGreaterThanOrEqual(1);
  });

  it('shows empty friend network when no friends', () => {
    render(<StitchReferral data={{
      rewardAmount: 15,
      referralCode: 'TEST',
      currentReferrals: 0,
      targetReferrals: 5,
      progressPercent: 0,
      friends: [],
      rewardHistory: [{ id: 'h1', date: '24 Oct', source: 'J. Vane', amount: 15.0 }],
    }} />);
    expect(screen.getByText('No referrals yet. Share your code to get started.')).toBeInTheDocument();
  });

  it('shows empty reward history when no history', () => {
    render(<StitchReferral data={{
      rewardAmount: 15,
      referralCode: 'TEST',
      currentReferrals: 3,
      targetReferrals: 5,
      progressPercent: 60,
      friends: [{ id: 'f1', name: 'Julian Vane', joinedDate: 'Oct 24', avatarUrl: '', avatarAlt: '', status: 'active' }],
      rewardHistory: [],
    }} />);
    expect(screen.getByText('No rewards yet. Start referring friends to earn.')).toBeInTheDocument();
  });
});
