import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MD3Card } from '../md3-card';

describe('MD3Card', () => {
  it('renders with defaults (elevated variant)', () => {
    render(<MD3Card>Card body</MD3Card>);
    const card = screen.getByText('Card body');
    expect(card).toBeInTheDocument();
    expect(card.className).toContain('bg-md-surface-container-low');
    expect(card.className).toContain('rounded-md-md');
  });

  it('applies filled variant class', () => {
    render(<MD3Card variant="filled">Filled</MD3Card>);
    expect(screen.getByText('Filled').className).toContain('bg-md-surface-container-highest');
  });

  it('applies outlined variant class', () => {
    render(<MD3Card variant="outlined">Outlined</MD3Card>);
    const el = screen.getByText('Outlined');
    expect(el.className).toContain('bg-md-surface');
    expect(el.className).toContain('border-md-outline-variant');
  });

  it('becomes interactive with onClick — role button + cursor pointer', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<MD3Card onClick={onClick}>Clickable</MD3Card>);
    const card = screen.getByRole('button');
    expect(card.className).toContain('cursor-pointer');
    await user.click(card);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('non-interactive card has no button role', () => {
    render(<MD3Card>Plain</MD3Card>);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
