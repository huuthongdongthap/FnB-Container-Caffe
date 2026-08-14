import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen, fireEvent } from '@/test-utils';
import { StitchReviewsNew } from '../StitchReviewsNew';
import type { ReviewsPageData } from '../StitchReviewsNew';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key?: string) => key ?? '',
    i18n: { language: 'en', changeLanguage: vi.fn() },
  }),
  Trans: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('lucide-react', () => ({
  Star: () => null,
  Heart: () => null,
  Pencil: () => null,
  Loader2: () => null,
  AlertCircle: () => null,
  MessageSquareQuote: () => null,
}));

const MOCK_DATA: ReviewsPageData = {
  aggregateRating: 4.9,
  totalReviews: 1248,
  reviews: [
    {
      id: 'r1',
      author: 'Isabella Vane',
      avatarUrl: '',
      avatarAlt: 'Avatar',
      rating: 5,
      content: 'Unparalleled espresso selection.',
      liked: true,
      likeCount: 42,
      date: 'Oct 14, 2023',
      isHighlighted: true,
    },
    {
      id: 'r2',
      author: 'Julian Thorne',
      avatarUrl: '',
      avatarAlt: 'Avatar',
      rating: 4,
      content: 'Masterclass in atmosphere.',
      liked: false,
      likeCount: 18,
      date: 'Oct 12, 2023',
    },
  ],
};

describe('StitchReviewsNew', () => {
  it('renders review cards with author names', () => {
    renderWithProviders(<StitchReviewsNew data={MOCK_DATA} />);
    expect(screen.getByText('Isabella Vane')).toBeTruthy();
    expect(screen.getByText('Julian Thorne')).toBeTruthy();
  });

  it('renders aggregate rating number', () => {
    renderWithProviders(<StitchReviewsNew data={MOCK_DATA} />);
    expect(screen.getByText(/4\.9/)).toBeTruthy();
  });

  it('renders review content with smart quotes', () => {
    renderWithProviders(<StitchReviewsNew data={MOCK_DATA} />);
    expect(screen.getByText(/Unparalleled espresso selection/)).toBeTruthy();
    expect(screen.getByText(/Masterclass in atmosphere/)).toBeTruthy();
  });

  it('calls onWriteReview when button is clicked', () => {
    const onWriteReview = vi.fn();
    renderWithProviders(<StitchReviewsNew data={MOCK_DATA} onWriteReview={onWriteReview} />);
    const btn = screen.getByRole('button', { name: /write/i });
    fireEvent.click(btn);
    expect(onWriteReview).toHaveBeenCalled();
  });

  it('calls onFilterChange when filter button is clicked', () => {
    const onFilterChange = vi.fn();
    renderWithProviders(<StitchReviewsNew data={MOCK_DATA} onFilterChange={onFilterChange} />);
    // Filter button aria-label contains the key: "Filter by stitch.filter5Star"
    const filterBtn = screen.getByRole('button', { name: /filter5Star/i });
    fireEvent.click(filterBtn);
    expect(onFilterChange).toHaveBeenCalledWith('5-star');
  });

  it('renders loading skeleton when loading', () => {
    const { container } = renderWithProviders(<StitchReviewsNew loadingState="loading" />);
    expect(container.innerHTML).toContain('animate-pulse');
  });

  it('renders error state', () => {
    renderWithProviders(<StitchReviewsNew loadingState="error" errorMessage="Something went wrong" />);
    expect(screen.getByText('Something went wrong')).toBeTruthy();
  });
});
