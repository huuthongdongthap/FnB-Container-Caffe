import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MD3Button } from '../md3-button';

describe('MD3Button', () => {
  it('renders with defaults (filled variant)', () => {
    render(<MD3Button>Save</MD3Button>);
    const btn = screen.getByRole('button', { name: /save/i });
    expect(btn).toBeInTheDocument();
    expect(btn.className).toContain('bg-md-primary');
  });

  it.each([['outlined'], ['text'], ['elevated'], ['tonal']] as const)(
    'applies %s variant class',
    (variant) => {
      render(<MD3Button variant={variant}>Action</MD3Button>);
      const btn = screen.getByRole('button');
      expect(btn.className).toContain(
        {
          outlined: 'border-md-outline',
          text: 'bg-transparent',
          elevated: 'bg-md-surface-container-low',
          tonal: 'bg-md-secondary-container',
        }[variant as 'outlined' | 'text' | 'elevated' | 'tonal'],
      );
    },
  );

  it('handles click via user-event', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<MD3Button onClick={onClick}>Click</MD3Button>);
    await user.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('renders disabled state with no pointer events', () => {
    render(<MD3Button disabled>Off</MD3Button>);
    const btn = screen.getByRole('button');
    expect(btn).toBeDisabled();
    expect(btn.className).toContain('pointer-events-none');
    expect(btn.className).toContain('opacity-38');
  });

  it('renders start/end icons alongside label', () => {
    render(
      <MD3Button startIcon={<svg data-testid="start" />} endIcon={<svg data-testid="end" />}>
        Icon Button
      </MD3Button>,
    );
    expect(screen.getByTestId('start')).toBeInTheDocument();
    expect(screen.getByTestId('end')).toBeInTheDocument();
    expect(screen.getByText('Icon Button')).toBeInTheDocument();
  });
});
