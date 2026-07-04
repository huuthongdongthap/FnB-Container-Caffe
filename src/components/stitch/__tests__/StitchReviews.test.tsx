import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@/test-utils';
import StitchReviews from '@/components/stitch/StitchReviews';

describe('StitchReviews', () => {
  it('renders loading skeleton when loadingState is loading', () => {
    const { container } = render(<StitchReviews loadingState="loading" />);
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('renders error state', () => {
    render(<StitchReviews loadingState="error" errorMessage="Failed" />);
    expect(screen.getByText('Failed')).toBeInTheDocument();
  });

  it('renders with provided data', () => {
    const { container } = render(<StitchReviews data={{ aggregateRating: 4.5, totalReviews: 10, reviews: [] }} />);
    expect(container.firstChild).toBeTruthy();
  });
});
