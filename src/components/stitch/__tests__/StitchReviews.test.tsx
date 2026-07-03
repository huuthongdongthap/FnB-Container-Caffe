import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@/test-utils';
import StitchReviews from '@/components/stitch/StitchReviews';

describe('StitchReviews', () => {
  it('renders loading skeleton when loadingState is loading', () => {
    const { container } = render(<StitchReviews loadingState="loading" />);
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('renders error state when loadingState is error', () => {
    render(<StitchReviews loadingState="error" errorMessage="Network timeout" />);
    expect(screen.getByText('Failed to Load Reviews')).toBeInTheDocument();
    expect(screen.getByText('Network timeout')).toBeInTheDocument();
  });

  it('renders empty state when reviews array is empty', () => {
    render(<StitchReviews data={{ aggregateRating: 4.5, totalReviews: 0, reviews: [] }} />);
    expect(screen.getByText('No Reviews Yet')).toBeInTheDocument();
    expect(screen.getByText('Be the first to share your Aura Cafe experience.')).toBeInTheDocument();
  });

  it('renders review header with aggregate rating', () => {
    render(<StitchReviews />);
    expect(screen.getByText('Guest Experiences')).toBeInTheDocument();
    expect(screen.getByText('4.9/5')).toBeInTheDocument();
    expect(screen.getByText('1,248 Reviews')).toBeInTheDocument();
  });

  it('renders filter chips', () => {
    render(<StitchReviews />);
    expect(screen.getByText('All')).toBeInTheDocument();
    expect(screen.getByText('5 Star')).toBeInTheDocument();
    expect(screen.getByText('Photo')).toBeInTheDocument();
    expect(screen.getByText('Latest')).toBeInTheDocument();
  });

  it('renders write review button', () => {
    render(<StitchReviews />);
    expect(screen.getByText('Write a Review')).toBeInTheDocument();
  });

  it('renders review cards with author, content, and ratings', () => {
    render(<StitchReviews />);
    expect(screen.getByText('Isabella Vane')).toBeInTheDocument();
    expect(screen.getByText('Julian Thorne')).toBeInTheDocument();
    expect(screen.getByText('Sienna Ray')).toBeInTheDocument();
  });

  it('renders review badge for highlighted reviews', () => {
    render(<StitchReviews />);
    expect(screen.getByText("Chef's Choice")).toBeInTheDocument();
  });

  it('renders like count for reviews', () => {
    render(<StitchReviews />);
    expect(screen.getByText('42')).toBeInTheDocument();
    expect(screen.getByText('18')).toBeInTheDocument();
  });

  it('calls onWriteReview when write review button clicked', () => {
    const onWriteReview = vi.fn();
    render(<StitchReviews onWriteReview={onWriteReview} />);
    screen.getByText('Write a Review').click();
    expect(onWriteReview).toHaveBeenCalledOnce();
  });
});
