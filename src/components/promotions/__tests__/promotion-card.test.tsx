import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@/test-utils';
import { PromotionCard } from '@/components/promotions/promotion-card';

describe('PromotionCard', () => {
  const activePromo = {
    id: '1',
    code: 'AURA20',
    percent: 20,
    maxDiscount: 50000,
    minOrder: 50000,
    expiresAt: '2026-12-31T23:59:59.000Z',
    usageCount: 10,
    usageLimit: 100,
    icon: '🎉',
    isFeatured: true,
  };

  const expiredPromo = {
    id: '2',
    code: 'OLD50',
    percent: 50,
    maxDiscount: 100000,
    minOrder: 0,
    expiresAt: '2026-06-01T00:00:00.000Z',
    usageCount: 100,
    usageLimit: 100,
    icon: '🎫',
    isFeatured: false,
  };

  it('renders discount percentage', () => {
    render(<PromotionCard {...activePromo} />);
    expect(screen.getByText(/20%/)).toBeInTheDocument();
  });

  it('renders voucher code', () => {
    render(<PromotionCard {...activePromo} />);
    expect(screen.getByText('AURA20')).toBeInTheDocument();
  });

  it('shows validity dates', () => {
    render(<PromotionCard {...activePromo} />);
    // The expiry section includes formatted date with year
    expect(screen.getByText(/tháng|thang|ngay|2026/i)).toBeInTheDocument();
  });

  it('shows days remaining for active promo', () => {
    render(<PromotionCard {...activePromo} />);
    // The expiry text includes ⏳ con and ngay - check the whole section
    expect(screen.getByText(/ngay/)).toBeInTheDocument();
  });

  it('shows expired badge for expired promo', () => {
    render(<PromotionCard {...expiredPromo} />);
    // The expiry badge section shows "Het han" at the bottom
    const hetHanElements = screen.getAllByText(/Het han/i);
    expect(hetHanElements.length).toBeGreaterThanOrEqual(1);
  });

  it('copies voucher code to clipboard when copy button clicked', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });

    render(<PromotionCard {...activePromo} />);
    const copyBtn = screen.getByRole('button', { name: /sao chep/i });
    fireEvent.click(copyBtn);

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith('AURA20');
    });
  });

  it('displays max discount info when present', () => {
    render(<PromotionCard {...activePromo} />);
    expect(screen.getByText(/Giam toi da/i)).toBeInTheDocument();
  });

  it('displays usage count when present', () => {
    render(<PromotionCard {...activePromo} />);
    // Usage shows as "10/100 luot dung"
    expect(screen.getByText(/10/)).toBeInTheDocument();
    expect(screen.getByText(/100/)).toBeInTheDocument();
  });

  it('shows featured styling when isFeatured is true', () => {
    const { container } = render(<PromotionCard {...activePromo} />);
    expect(container.firstElementChild).toHaveClass('promo-card--featured');
  });

  it('shows expired styling when promo is expired', () => {
    const { container } = render(<PromotionCard {...expiredPromo} />);
    expect(container.firstElementChild).toHaveClass('promo-card--expired');
  });
});
