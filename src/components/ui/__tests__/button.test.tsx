import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@/test-utils';
import { Button } from '@/components/ui/button';

describe('Button', () => {
  it('renders children', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole('button', { name: /click me/i })).toBeInTheDocument();
  });

  // Variants render MD3 token surfaces, not the legacy raw-Tailwind palette.
  it.each([
    ['primary', 'bg-md-primary'],
    ['secondary', 'border-md-outline'],
    ['ghost', 'text-md-primary'],
    ['destructive', 'var(--md-sys-color-error)'],
  ] as const)('renders the %s variant with MD3 tokens', (variant, marker) => {
    render(<Button variant={variant}>Label</Button>);
    expect(screen.getByRole('button').className).toContain(marker);
  });

  it('shows spinner when loading', () => {
    render(<Button loading>Loading</Button>);
    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
    expect(button.querySelector('svg')).toBeInTheDocument();
  });

  it('calls onClick handler', () => {
    let clicked = false;
    render(<Button onClick={() => { clicked = true; }}>Click</Button>);
    fireEvent.click(screen.getByRole('button'));
    expect(clicked).toBe(true);
  });

  it('is disabled when disabled prop set', () => {
    render(<Button disabled>Disabled</Button>);
    expect(screen.getByRole('button')).toBeDisabled();
  });
});
