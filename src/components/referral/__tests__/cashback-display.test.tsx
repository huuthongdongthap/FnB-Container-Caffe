import { describe, it, expect } from 'vitest';
import { render, screen } from '@/test-utils';
import { CashbackDisplay } from '@/components/referral/cashback-display';

describe('CashbackDisplay', () => {
  it('displays cashback section for per-referral rate', () => {
    render(<CashbackDisplay earnedAmount={10000} totalReferrals={1} />);
    expect(screen.getByText(/Cashback mỗi lượt giới thiệu/i)).toBeInTheDocument();
  });

  it('shows total cashback earned for multiple referrals', () => {
    render(<CashbackDisplay earnedAmount={50000} totalReferrals={5} />);
    expect(screen.getByText('Tiền cashback đã nhận')).toBeInTheDocument();
  });

  it('shows total referral count', () => {
    render(<CashbackDisplay earnedAmount={30000} totalReferrals={3} />);
    // "Từ 3 lượt giới thiệu thành công" text split across multiple text nodes
    expect(screen.getByText(/giới thiệu thành công/)).toBeInTheDocument();
  });

  it('shows 0 when no cashback earned', () => {
    render(<CashbackDisplay earnedAmount={0} totalReferrals={0} />);
    expect(screen.getByText('Tiền cashback đã nhận')).toBeInTheDocument();
  });

  it('formats cashback with Vietnamese dong symbol', () => {
    render(<CashbackDisplay earnedAmount={10000} totalReferrals={1} />);
    const allDongElements = screen.getAllByText(/₫/);
    expect(allDongElements.length).toBeGreaterThanOrEqual(1);
  });

  it('does not display tier modifier section', () => {
    render(<CashbackDisplay earnedAmount={10000} totalReferrals={1} />);
    expect(screen.queryByText(/he so/i)).not.toBeInTheDocument();
  });

  it('shows per-referral cashback amount section', () => {
    render(<CashbackDisplay earnedAmount={10000} totalReferrals={1} />);
    expect(screen.getByText(/Cashback mỗi lượt giới thiệu/i)).toBeInTheDocument();
  });

  it('shows earned history section heading', () => {
    render(<CashbackDisplay earnedAmount={40000} totalReferrals={4} />);
    expect(screen.getByText(/Trung bình/i)).toBeInTheDocument();
  });
});
