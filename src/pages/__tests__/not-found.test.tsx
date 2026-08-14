import { describe, it, expect } from 'vitest';
import { render, screen } from '@/test-utils';
import NotFound from '../stitch/not-found';

describe('NotFound', () => {
  it('displays 404 heading', () => {
    render(<NotFound />);
    expect(screen.getByText('404')).toBeInTheDocument();
  });

  it('shows not-found message in English', () => {
    render(<NotFound />);
    expect(screen.getByText(/page not found/i)).toBeInTheDocument();
  });

  it('shows Vietnamese not-found message', () => {
    render(<NotFound />);
    expect(screen.getByText(/không tìm thấy trang/i)).toBeInTheDocument();
  });

  it('has a link back to homepage', () => {
    render(<NotFound />);
    const homeLink = screen.getByRole('link', { name: /return home|quay về/i });
    expect(homeLink).toHaveAttribute('href', '/');
  });

  it('renders without crashing and matches design layout', () => {
    const { container } = render(<NotFound />);
    expect(container.querySelector('main')).toBeInTheDocument();
  });

  it('contains decorative background element', () => {
    const { container } = render(<NotFound />);
    expect(container.querySelector('.noise-overlay')).toBeInTheDocument();
  });
});
