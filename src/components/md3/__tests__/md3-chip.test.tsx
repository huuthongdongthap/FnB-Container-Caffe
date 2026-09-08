import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MD3Chip } from '../md3-chip';

describe('MD3Chip', () => {
  it('renders with defaults (suggestion variant, option role)', () => {
    render(<MD3Chip>Coffee</MD3Chip>);
    const chip = screen.getByRole('option', { name: /coffee/i });
    expect(chip).toBeInTheDocument();
    expect(chip.className).toContain('bg-md-surface-container-low');
    expect(chip.className).toContain('h-8');
  });

  it('applies filter variant class', () => {
    render(<MD3Chip variant="filter">Vegan</MD3Chip>);
    expect(screen.getByRole('option').className).toContain('text-md-on-surface-variant');
  });

  it('selected filter chip uses secondary-container + checkmark', () => {
    render(
      <MD3Chip variant="filter" selected>
        Hot
      </MD3Chip>,
    );
    const chip = screen.getByRole('option');
    expect(chip.className).toContain('bg-md-secondary-container');
    expect(chip).toHaveAttribute('aria-selected', 'true');
    expect(chip.querySelector('svg')).toBeInTheDocument();
  });

  it('renders trailing dismiss icon when provided (input variant)', () => {
    render(
      <MD3Chip variant="input" trailingIcon={<svg data-testid="dismiss" />}>
        latte
      </MD3Chip>,
    );
    expect(screen.getByTestId('dismiss')).toBeInTheDocument();
  });

  it('handles click via user-event', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<MD3Chip onClick={onClick}>Pick me</MD3Chip>);
    await user.click(screen.getByRole('option'));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('elevated chip applies shadow class', () => {
    render(<MD3Chip elevated>Raised</MD3Chip>);
    expect(screen.getByRole('option').className).toContain('shadow-[');
  });
});
