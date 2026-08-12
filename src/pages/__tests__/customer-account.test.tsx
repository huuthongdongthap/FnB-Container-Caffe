import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@/test-utils';
import CustomerAccountPage from '../stitch/customer-account';

describe('CustomerAccountPage', () => {
  it('renders page heading', () => {
    render(<CustomerAccountPage />);
    expect(screen.getByRole('heading', { name: /Tài khoản/ })).toBeInTheDocument();
  });

  it('shows mock order IDs', () => {
    render(<CustomerAccountPage />);
    expect(screen.getByText('ORD-0042')).toBeInTheDocument();
    expect(screen.getByText('ORD-0041')).toBeInTheDocument();
  });

  it('switches to reviews tab', () => {
    render(<CustomerAccountPage />);
    fireEvent.click(screen.getByRole('button', { name: /Đánh giá/i }));
    expect(screen.getByText(/tuyệt vời/)).toBeInTheDocument();
  });

  it('shows loyalty tiers after clicking loyalty', () => {
    render(<CustomerAccountPage />);
    fireEvent.click(screen.getByRole('button', { name: /Thành viên/i }));
    const golds = screen.getAllByText(/Vàng/);
    expect(golds.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Đồng/)).toBeInTheDocument();
  });

  it('renders tab buttons', () => {
    render(<CustomerAccountPage />);
    expect(screen.getByRole('button', { name: /Đơn hàng/i })).toBeInTheDocument();
  });
});