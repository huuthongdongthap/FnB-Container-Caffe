import { describe, it, expect } from 'vitest';
import { render, screen } from '@/test-utils';
import { Navbar } from '@/components/ui/navbar';

describe('Navbar', () => {
  it('renders nav links', () => {
    render(<Navbar />);
    // Desktop + mobile nav both render links; getAllByText handles duplicates
    expect(screen.getAllByText('Thực đơn').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Không gian').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Đặt bàn').length).toBeGreaterThanOrEqual(1);
  });

  it('renders logo with link to home', () => {
    render(<Navbar />);
    // Logo appears in both desktop nav and mobile drawer
    const logos = screen.getAllByRole('link', { name: /aura/i });
    logos.forEach((logo) => expect(logo).toHaveAttribute('href', '/'));
  });

  it('renders mobile menu toggle', () => {
    render(<Navbar />);
    const toggle = screen.getByLabelText('Mở menu');
    expect(toggle).toBeInTheDocument();
  });
});
