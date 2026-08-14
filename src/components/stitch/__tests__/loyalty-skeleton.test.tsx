import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { LoyaltySkeleton } from '../loyalty-skeleton';

describe('LoyaltySkeleton', () => {
  it('renders skeleton with pulse animations', () => {
    const { container } = render(<LoyaltySkeleton />);
    const pulseElements = container.querySelectorAll('.animate-pulse');
    expect(pulseElements.length).toBeGreaterThan(0);
  });

  it('renders multiple skeleton cards', () => {
    const { container } = render(<LoyaltySkeleton />);
    const skeletonCards = container.querySelectorAll('.animate-pulse.rounded-xl');
    expect(skeletonCards.length).toBeGreaterThanOrEqual(3);
  });

  it('renders full-height container', () => {
    const { container } = render(<LoyaltySkeleton />);
    const outerDiv = container.querySelector('.min-h-screen');
    expect(outerDiv).toBeTruthy();
  });
});
