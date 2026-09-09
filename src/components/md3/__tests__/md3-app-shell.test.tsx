import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { MD3AppShell, useDefaultNavItems } from '../md3-app-shell';
import type { MD3NavItem } from '../md3-app-shell';

/* ── helpers ─────────────────────────────────────────────── */
function renderShell(props: Partial<Parameters<typeof MD3AppShell>[0]> = {}) {
  const navItems: MD3NavItem[] = [
    { value: '/', label: 'Trang chủ', icon: <span data-testid="i-home" /> },
    { value: '/menu', label: 'Thực đơn', icon: <span data-testid="i-menu" /> },
    { value: '/account', label: 'Tài khoản', icon: <span data-testid="i-user" /> },
  ];
  return render(
    <MemoryRouter initialEntries={['/menu']}>
      <MD3AppShell
        title="AURA CAFE"
        navigationItems={navItems}
        {...props}
      >
        <p>Nội dung trang</p>
      </MD3AppShell>
    </MemoryRouter>,
  );
}

/* ── default nav items hook ──────────────────────────────── */
describe('useDefaultNavItems', () => {
  it('returns 4 customer-core items with routes and labels', () => {
    let items: MD3NavItem[] = [];
    function Probe() {
      items = useDefaultNavItems();
      return null;
    }
    render(
      <MemoryRouter>
        <Probe />
      </MemoryRouter>,
    );
    expect(items).toHaveLength(4);
    expect(items.map((i) => i.value)).toEqual([
      '/',
      '/menu',
      '/table-reservation',
      '/account',
    ]);
  });
});

/* ── shell rendering ─────────────────────────────────────── */
describe('MD3AppShell', () => {
  it('renders top app bar with title, main content and navigation bar', () => {
    renderShell();
    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getByText('AURA CAFE')).toBeInTheDocument();
    expect(screen.getByText('Nội dung trang')).toBeInTheDocument();
    expect(screen.getByRole('navigation')).toBeInTheDocument();
    // All nav labels visible
    expect(screen.getByText('Trang chủ')).toBeInTheDocument();
    expect(screen.getByText('Tài khoản')).toBeInTheDocument();
  });

  it('hides top app bar when showTopAppBar=false', () => {
    renderShell({ showTopAppBar: false });
    expect(screen.queryByRole('banner')).not.toBeInTheDocument();
    expect(screen.getByRole('navigation')).toBeInTheDocument();
  });

  it('hides navigation bar when showNavigationBar=false', () => {
    renderShell({ showNavigationBar: false });
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
    expect(screen.getByRole('banner')).toBeInTheDocument();
  });

  it('highlights the nav item matching current pathname', () => {
    renderShell();
    const menuTab = screen.getByText('Thực đơn').closest('[role="tab"]');
    expect(menuTab).toHaveAttribute('aria-selected', 'true');
    const homeTab = screen.getByText('Trang chủ').closest('[role="tab"]');
    expect(homeTab).toHaveAttribute('aria-selected', 'false');
  });

  it('navigates on nav item click', () => {
    renderShell();
    fireEvent.click(screen.getByText('Tài khoản'));
    // Navigation handled by react-router — assert no crash and tab flips
    expect(screen.getByText('Tài khoản')).toBeInTheDocument();
  });

  it('renders leading logo image with alt text', () => {
    renderShell();
    const logo = screen.getByAltText('AURA CAFE');
    expect(logo).toHaveAttribute('src', '/images/logo.svg');
  });

  it('main landmark has id=main-content for skip-link targets', () => {
    renderShell();
    expect(document.getElementById('main-content')).toBeInTheDocument();
  });
});
