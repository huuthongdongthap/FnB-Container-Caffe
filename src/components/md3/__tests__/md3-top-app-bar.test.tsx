import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MD3TopAppBar } from '@/components/md3/md3-top-app-bar';
import { Menu, Search, Settings } from 'lucide-react';

describe('MD3TopAppBar', () => {
  it('renders title with default small variant', () => {
    render(<MD3TopAppBar title="Menu" />);
    expect(screen.getByRole('banner')).toBeTruthy();
    expect(screen.getByText('Menu')).toBeTruthy();
  });

  it('applies h-16 for small variant', () => {
    render(<MD3TopAppBar title="Small" variant="small" />);
    const header = screen.getByRole('banner');
    expect(header.className).toContain('h-16');
  });

  it('applies h-32 for medium variant', () => {
    render(<MD3TopAppBar title="Medium" variant="medium" />);
    const header = screen.getByRole('banner');
    expect(header.className).toContain('h-32');
  });

  it('calls onLeadingClick when leading icon clicked', () => {
    const onClick = vi.fn();
    render(
      <MD3TopAppBar
        title="With Menu"
        leadingIcon={<Menu />}
        onLeadingClick={onClick}
      />,
    );
    fireEvent.click(screen.getByLabelText('Navigation menu'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('renders action buttons on right side', () => {
    render(
      <MD3TopAppBar
        title="Actions"
        actions={[
          <button key="s" aria-label="Search"><Search /></button>,
          <button key="c" aria-label="Settings"><Settings /></button>,
        ]}
      />,
    );
    expect(screen.getByLabelText('Search')).toBeTruthy();
    expect(screen.getByLabelText('Settings')).toBeTruthy();
  });

  it('scrolls: bg-md-surface-container when scrollY > 0', () => {
    const { rerender } = render(<MD3TopAppBar title="Scroll" scrollY={0} />);
    const header = screen.getByRole('banner');
    expect(header.className).toContain('bg-md-surface');
    expect(header.className).not.toContain('bg-md-surface-container');

    rerender(<MD3TopAppBar title="Scroll" scrollY={10} />);
    expect(header.className).toContain('bg-md-surface-container');
  });

  it('center-aligned variant centers the title', () => {
    render(<MD3TopAppBar title="Centered" variant="center-aligned" />);
    const title = screen.getByText('Centered');
    expect(title.className).toContain('text-center');
  });

  it('medium variant shows expanded title below row', () => {
    render(<MD3TopAppBar title="Expanded" variant="medium" />);
    // Should have both a header and a title in the expanded area
    expect(screen.getByText('Expanded')).toBeTruthy();
  });
});
