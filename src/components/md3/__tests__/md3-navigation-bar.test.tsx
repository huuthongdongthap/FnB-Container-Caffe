import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  MD3NavigationBar,
  MD3NavigationBarItem,
} from '@/components/md3/md3-navigation-bar';
import { Home, Search, User } from 'lucide-react';

function renderNav(active = 'home', onChange = vi.fn()) {
  return render(
    <MD3NavigationBar value={active} onChange={onChange}>
      <MD3NavigationBarItem icon={<Home data-testid="icon-home" />} label="Home" value="home" />
      <MD3NavigationBarItem icon={<Search data-testid="icon-search" />} label="Search" value="search" />
      <MD3NavigationBarItem icon={<User data-testid="icon-user" />} label="Profile" value="profile" />
    </MD3NavigationBar>,
  );
}

describe('MD3NavigationBar', () => {
  it('renders with default props and navigation role', () => {
    renderNav();
    expect(screen.getByRole('navigation')).toBeTruthy();
    expect(screen.getByText('Home')).toBeTruthy();
    expect(screen.getByText('Search')).toBeTruthy();
    expect(screen.getByText('Profile')).toBeTruthy();
  });

  it('applies active pill indicator on selected item', () => {
    renderNav('search');
    const searchTab = screen.getByRole('tab', { name: 'Search' });
    expect(searchTab.getAttribute('aria-selected')).toBe('true');
    // Active icon container should have bg-md-secondary-container class
    expect(searchTab.querySelector('.bg-md-secondary-container')).toBeTruthy();
  });

  it('inactive items have variant text color', () => {
    renderNav('home');
    const searchTab = screen.getByRole('tab', { name: 'Search' });
    expect(searchTab.getAttribute('aria-selected')).toBe('false');
    const label = searchTab.querySelector('span:last-child');
    expect(label?.className).toContain('text-md-on-surface-variant');
  });

  it('calls onChange when item clicked', () => {
    const onChange = vi.fn();
    renderNav('home', onChange);
    fireEvent.click(screen.getByRole('tab', { name: 'Search' }));
    expect(onChange).toHaveBeenCalledWith('search');
  });

  it('renders badge dot', () => {
    render(
      <MD3NavigationBar value="home" onChange={vi.fn()}>
        <MD3NavigationBarItem icon={<Home />} label="Home" value="home" badge="dot" />
      </MD3NavigationBar>,
    );
    expect(screen.getByLabelText('notification')).toBeTruthy();
  });

  it('renders numeric badge', () => {
    render(
      <MD3NavigationBar value="home" onChange={vi.fn()}>
        <MD3NavigationBarItem icon={<Home />} label="Home" value="home" badge={5} />
      </MD3NavigationBar>,
    );
    expect(screen.getByLabelText('5 notifications')).toBeTruthy();
    expect(screen.getByText('5')).toBeTruthy();
  });

  it('warns in dev when >5 items', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    render(
      <MD3NavigationBar value="a" onChange={vi.fn()}>
        <MD3NavigationBarItem icon={<Home />} label="A" value="a" />
        <MD3NavigationBarItem icon={<Home />} label="B" value="b" />
        <MD3NavigationBarItem icon={<Home />} label="C" value="c" />
        <MD3NavigationBarItem icon={<Home />} label="D" value="d" />
        <MD3NavigationBarItem icon={<Home />} label="E" value="e" />
        <MD3NavigationBarItem icon={<Home />} label="F" value="f" />
      </MD3NavigationBar>,
    );
    expect(warn).toHaveBeenCalledWith(
      '[MD3NavigationBar] M3 spec allows max 5 items, got',
      6,
    );
    warn.mockRestore();
  });
});
