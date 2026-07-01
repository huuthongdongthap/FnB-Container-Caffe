import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@/test-utils';
import { RewardsGrid } from '@/components/loyalty/rewards-grid';

describe('RewardsGrid', () => {
  const rewards = [
    { id: '1', name: 'Ca Phe Thuong', cost: 100, icon: '☕', description: 'Doi 1 ly ca phe thuong' },
    { id: '2', name: 'Specialty Drink', cost: 150, icon: '🍷', description: 'Doi 1 ly specialty drink' },
    { id: '3', name: 'Banh Ngot', cost: 80, icon: '🍰', description: 'Doi 1 banh ngot handmade' },
  ];

  it('renders all available rewards', () => {
    render(<RewardsGrid rewards={rewards} userPoints={200} />);
    for (const r of rewards) {
      expect(screen.getByText(r.name)).toBeInTheDocument();
    }
  });

  it('shows points cost for each reward', () => {
    render(<RewardsGrid rewards={rewards} userPoints={200} />);
    expect(screen.getByText('100 diem')).toBeInTheDocument();
    expect(screen.getByText('150 diem')).toBeInTheDocument();
    expect(screen.getByText('80 diem')).toBeInTheDocument();
  });

  it('renders redeem buttons for affordable rewards', () => {
    render(<RewardsGrid rewards={rewards} userPoints={200} />);
    const redeemButtons = screen.getAllByRole('button');
    expect(redeemButtons.length).toBe(3);
  });

  it('disables redeem button when user lacks points', () => {
    render(<RewardsGrid rewards={rewards} userPoints={50} />);
    // With 50 points, all rewards cost > 50, so all 3 buttons are "Thieu diem" and disabled
    const allButtons = screen.getAllByRole('button');
    const disabledButtons = allButtons.filter((b) => b.hasAttribute('disabled'));
    expect(disabledButtons.length).toBe(3);
    expect(allButtons.length).toBe(3);
  });

  it('calls onRedeem with reward id when redeem clicked', () => {
    const onRedeem = vi.fn();
    render(<RewardsGrid rewards={rewards} userPoints={200} onRedeem={onRedeem} />);
    const firstButton = screen.getAllByRole('button', { name: /doi ngay/i })[0];
    if (firstButton) fireEvent.click(firstButton);
    expect(onRedeem).toHaveBeenCalledWith('1');
  });

  it('shows empty state when no rewards available', () => {
    render(<RewardsGrid rewards={[]} userPoints={0} />);
    expect(screen.getByText(/Chua co qua tang/i)).toBeInTheDocument();
  });

  it('displays user current points balance', () => {
    render(<RewardsGrid rewards={rewards} userPoints={200} />);
    expect(screen.getByText(/200/)).toBeInTheDocument();
  });
});
