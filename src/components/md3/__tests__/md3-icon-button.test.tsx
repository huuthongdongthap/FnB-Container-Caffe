import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MD3IconButton } from '@/components/md3/md3-icon-button';
import { Heart, Star } from 'lucide-react';

describe('MD3IconButton', () => {
  it('renders with required aria-label', () => {
    render(<MD3IconButton icon={<Heart />} aria-label="Like" />);
    expect(screen.getByRole('button', { name: 'Like' })).toBeTruthy();
  });

  it('applies standard variant (default)', () => {
    render(<MD3IconButton icon={<Heart />} aria-label="Standard" variant="standard" />);
    const btn = screen.getByRole('button', { name: 'Standard' });
    expect(btn.className).toContain('bg-transparent');
    expect(btn.className).toContain('text-md-on-surface-variant');
  });

  it('applies filled variant classes', () => {
    render(<MD3IconButton icon={<Heart />} aria-label="Filled" variant="filled" />);
    const btn = screen.getByRole('button', { name: 'Filled' });
    expect(btn.className).toContain('bg-md-primary-container');
  });

  it('applies tonal variant classes', () => {
    render(<MD3IconButton icon={<Heart />} aria-label="Tonal" variant="tonal" />);
    const btn = screen.getByRole('button', { name: 'Tonal' });
    expect(btn.className).toContain('bg-md-secondary-container');
  });

  it('applies outlined variant classes', () => {
    render(<MD3IconButton icon={<Heart />} aria-label="Outlined" variant="outlined" />);
    const btn = screen.getByRole('button', { name: 'Outlined' });
    expect(btn.className).toContain('border-md-outline');
  });

  it('size: default is 40px, small is 32px, large is 48px', () => {
    const { rerender } = render(<MD3IconButton icon={<Heart />} aria-label="S" size="default" />);
    let btn = screen.getByRole('button', { name: 'S' });
    expect(btn.className).toContain('w-10'); // 40px = w-10

    rerender(<MD3IconButton icon={<Heart />} aria-label="S" size="small" />);
    btn = screen.getByRole('button', { name: 'S' });
    expect(btn.className).toContain('w-8'); // 32px = w-8

    rerender(<MD3IconButton icon={<Heart />} aria-label="S" size="large" />);
    btn = screen.getByRole('button', { name: 'S' });
    expect(btn.className).toContain('w-12'); // 48px = w-12
  });

  it('fires onClick handler', () => {
    const onClick = vi.fn();
    render(<MD3IconButton icon={<Heart />} aria-label="Click" onClick={onClick} />);
    fireEvent.click(screen.getByRole('button', { name: 'Click' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('toggle mode: aria-pressed and icon swap', () => {
    const onToggle = vi.fn();
    render(
      <MD3IconButton
        icon={<Heart data-testid="off" />}
        aria-label="Fav"
        toggle={{ selected: false, selectedIcon: <Star data-testid="on" />, onToggle }}
      />,
    );
    const btn = screen.getByRole('button', { name: 'Fav' });
    expect(btn.getAttribute('aria-pressed')).toBe('false');
    expect(screen.getByTestId('off')).toBeTruthy();

    fireEvent.click(btn);
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('toggle selected state shows selectedIcon', () => {
    render(
      <MD3IconButton
        icon={<Heart data-testid="off" />}
        aria-label="Fav"
        toggle={{ selected: true, selectedIcon: <Star data-testid="on" />, onToggle: vi.fn() }}
      />,
    );
    expect(screen.getByTestId('on')).toBeTruthy();
    expect(screen.queryByTestId('off')).toBeNull();
  });

  it('rounded-md-full (circle shape)', () => {
    render(<MD3IconButton icon={<Heart />} aria-label="Circle" />);
    expect(screen.getByRole('button', { name: 'Circle' }).className).toContain('rounded-md-full');
  });
});
