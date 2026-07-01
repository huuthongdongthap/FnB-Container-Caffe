import { describe, it, expect } from 'vitest';
import { render, screen } from '@/test-utils';
import { NotFound } from '../NotFound';

describe('NotFound', () => {
  it('displays 404 heading', () => {
    render(<NotFound />);
    expect(screen.getByText('404')).toBeInTheDocument();
  });

  it('shows not-found message in Vietnamese', () => {
    render(<NotFound />);
    expect(screen.getByText(/trang không tồn tại/i)).toBeInTheDocument();
    expect(screen.getByText(/có thể đã bị xóa hoặc thay đổi/i)).toBeInTheDocument();
  });

  it('has a link back to homepage', () => {
    render(<NotFound />);
    const homeLink = screen.getByText(/về trang chủ/i).closest('a');
    expect(homeLink).toHaveAttribute('href', '/');
  });

  it('has a link to menu', () => {
    render(<NotFound />);
    const menuLink = screen.getByText(/xem thực đơn/i).closest('a');
    expect(menuLink).toHaveAttribute('href', '/menu');
  });

  it('renders without crashing and matches design layout', () => {
    const { container } = render(<NotFound />);
    expect(container.querySelector('main')).toBeInTheDocument();
  });

  it('contains brand-aligned decorative element', () => {
    render(<NotFound />);
    expect(screen.getByTestId('not-found-decoration')).toBeInTheDocument();
  });
});
