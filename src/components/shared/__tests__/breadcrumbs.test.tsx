import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@/test-utils';
import { Breadcrumbs } from '../Breadcrumbs';

describe('Breadcrumbs', () => {
  const crumbs = [
    { label: 'Trang chủ', to: '/' },
    { label: 'Về chúng tôi', to: '/about-us' },
    { label: 'Đội ngũ', to: '/about-us#team' },
  ];

  it('renders all breadcrumb items', () => {
    render(<Breadcrumbs items={crumbs} />);
    expect(screen.getByText('Trang chủ')).toBeInTheDocument();
    expect(screen.getByText('Về chúng tôi')).toBeInTheDocument();
    expect(screen.getByText('Đội ngũ')).toBeInTheDocument();
  });

  it('marks the last item as current page', () => {
    render(<Breadcrumbs items={crumbs} />);
    const nav = screen.getByRole('navigation', { name: /breadcrumb/i });
    const links = within(nav).getAllByRole('link');
    // The last crumb should not be a link (current page)
    const lastItem = within(nav).getByText('Đội ngũ');
    expect(lastItem.closest('a')).toBeNull();
    expect(lastItem).toHaveAttribute('aria-current', 'page');
  });

  it('renders correct links for non-current items', () => {
    render(<Breadcrumbs items={crumbs} />);
    const homeLink = screen.getByText('Trang chủ').closest('a');
    expect(homeLink).toHaveAttribute('href', '/');

    const aboutLink = screen.getByText('Về chúng tôi').closest('a');
    expect(aboutLink).toHaveAttribute('href', '/about-us');
  });

  it('includes JSON-LD structured data', () => {
    render(<Breadcrumbs items={crumbs} />);
    const scripts = document.querySelectorAll('script[type="application/ld+json"]');
    const breadcrumbScript = Array.from(scripts).find((s) =>
      s.textContent?.includes('BreadcrumbList'),
    );
    expect(breadcrumbScript).toBeInTheDocument();
    expect(breadcrumbScript?.textContent).toContain('Trang chủ');
    expect(breadcrumbScript?.textContent).toContain('Về chúng tôi');
  });

  it('renders with custom className', () => {
    render(
      <Breadcrumbs items={crumbs} className="my-crumbs" />,
    );
    const nav = screen.getByRole('navigation', { name: /breadcrumb/i });
    expect(nav).toHaveClass('my-crumbs');
  });
});
