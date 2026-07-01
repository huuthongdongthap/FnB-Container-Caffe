import { describe, it, expect } from 'vitest';
import { render, screen } from '@/test-utils';
import { TierCard } from '@/components/loyalty/tier-card';

describe('TierCard', () => {
  const bronzeTier = {
    rank: 'Bronze',
    tier: 'bronze',
    minPoints: 0,
    cashbackRate: 3,
    pointsMultiplier: 1.0,
    benefits: ['Tich diem x1.0', 'Hoan tien 3%', 'Sinh nhat 10%', 'Uu tien order'],
    isCurrent: true,
  };

  const platinumTier = {
    rank: 'Bach Kim',
    tier: 'platinum',
    minPoints: 500,
    cashbackRate: 10,
    pointsMultiplier: 1.5,
    benefits: ['Tich diem x1.5', 'Hoan tien 10%', 'Sinh nhat 20% + Qua', 'Qua hang thang', 'Uu tien VIP'],
    isCurrent: false,
    pointsToNext: 200,
    currentPoints: 300,
  };

  it('renders tier rank name', () => {
    render(<TierCard {...bronzeTier} />);
    expect(screen.getByText('Bronze')).toBeInTheDocument();
  });

  it('renders cashback percentage', () => {
    render(<TierCard {...bronzeTier} />);
    // 3% is rendered as <div>3<span>%</span></div> - split across nodes
    const cashbackContainer = screen.getByText('Cashback moi don').previousElementSibling;
    expect(cashbackContainer).toBeInTheDocument();
    expect(cashbackContainer?.textContent).toContain('3');
    expect(cashbackContainer?.textContent).toContain('%');
  });

  it('renders all benefits as list items', () => {
    render(<TierCard {...bronzeTier} />);
    for (const b of bronzeTier.benefits) {
      expect(screen.getByText(b)).toBeInTheDocument();
    }
  });

  it('shows "Hien tai" badge when isCurrent is true', () => {
    render(<TierCard {...bronzeTier} />);
    expect(screen.getByText(/Hien tai/i)).toBeInTheDocument();
  });

  it('does not show current badge when isCurrent is false', () => {
    render(<TierCard {...platinumTier} />);
    expect(screen.queryByText(/Hien tai/i)).not.toBeInTheDocument();
  });

  it('shows progress toward next tier when pointsToNext is provided', () => {
    render(<TierCard {...platinumTier} />);
    expect(screen.getByText(/Con/i)).toBeInTheDocument();
    expect(screen.getByText(/200/)).toBeInTheDocument();
  });

  it('shows featured badge for Gold tier', () => {
    const goldTier = { ...bronzeTier, rank: 'Vang', tier: 'gold', isCurrent: false };
    render(<TierCard {...goldTier} />);
    expect(screen.getByText(/Pho bien nhat/i)).toBeInTheDocument();
  });

  it('applies featured styling for Gold tier', () => {
    const goldTier = { ...bronzeTier, rank: 'Vang', tier: 'gold', isCurrent: false };
    const { container } = render(<TierCard {...goldTier} />);
    expect(container.firstElementChild).toHaveClass('tier-card--featured');
  });

  it('renders points multiplier info', () => {
    render(<TierCard {...platinumTier} />);
    // x1.5 diem is rendered as split nodes: x, 1.5, diem in the multiplier div
    // The benefit list also contains "Tich diem x1.5" — use getAllByText to handle multiple matches
    const multElements = screen.getAllByText((content, element) => {
      return !!(content.includes('x') && content.includes('1.5') && element?.className?.includes('text-accent'));
    });
    expect(multElements.length).toBeGreaterThanOrEqual(1);
  });
});
