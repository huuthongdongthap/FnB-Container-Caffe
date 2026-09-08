import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MD3Fab } from '../md3-fab';

const Icon = () => <svg data-testid="fab-icon" />;

describe('MD3Fab', () => {
  it('renders icon-only with aria-label fallback', () => {
    render(<MD3Fab icon={<Icon />} aria-label="Add item" />);
    const fab = screen.getByRole('button', { name: 'Add item' });
    expect(fab).toBeInTheDocument();
    expect(screen.getByTestId('fab-icon')).toBeInTheDocument();
  });

  it('applies secondary variant class', () => {
    render(<MD3Fab variant="secondary" icon={<Icon />} aria-label="Add" />);
    expect(screen.getByRole('button').className).toContain('bg-md-secondary-container');
  });

  it('applies large size + extra-large corner', () => {
    render(<MD3Fab size="large" icon={<Icon />} aria-label="Add" />);
    const fab = screen.getByRole('button');
    expect(fab.className).toContain('h-24');
    expect(fab.className).toContain('rounded-md-xl');
  });

  it('renders extended FAB with label (accessible name from label)', () => {
    render(<MD3Fab icon={<Icon />} label="Create" />);
    expect(screen.getByRole('button', { name: /create/i })).toBeInTheDocument();
    expect(screen.getByText('Create')).toBeInTheDocument();
  });

  it('handles click via user-event', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<MD3Fab icon={<Icon />} aria-label="Add" onClick={onClick} />);
    await user.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledOnce();
  });
});
