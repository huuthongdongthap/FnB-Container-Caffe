import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen, fireEvent } from '@/test-utils';
import { StitchReviewsNew } from '../StitchReviewsNew';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key?: string) => {
      const map: Record<string, string> = {
        'stitch.reviews': 'Guest Reviews',
        'stitch.aggregateRating': 'Aggregate Rating',
        'stitch.totalReviews': 'Total Reviews',
        'stitch.filter': 'Filter',
        'stitch.all': 'All',
        'stitch.fiveStar': '5 Star',
        'stitch.photo': 'Photo',
        'stitch.latest': 'Latest',
        'stitch.noReviews': 'No reviews yet',
        'stitch.loading': 'Loading...',
        'stitch.error': 'Failed to load reviews',
      };
      return map[key ?? ''] ?? key ?? '';
    },
  }),
}));

vi.mock('lucide-react', () => ({
  Star: () => null,
  Heart: () => null,
  Pencil: () => null,
  Loader2: () => null,
  AlertCircle: () => null,
  MessageSquareQuote: () => null,
}));

describe('StitchReviewsNew', () => {
  it('renders the reviews page', () => {
    renderWithProviders(<StitchReviewsNew />);
    expect(screen.getByText('Guest Reviews')).toBeTruthy();
  });

  it('shows loading state', () => {
    renderWithProviders(<StitchReviewsNew loadingState="loading" />);
    expect(screen.getByText('Loading...')).toBeTruthy();
  });

  it('shows error state', () => {
    renderWithProviders(<StitchReviewsNew loadingState="error" />);
    expect(screen.getByText('Failed to load reviews')).toBeTruthy();
  });

  it('shows empty state when no reviews', () => {
    renderWithProviders(
      <StitchReviewsNew data={{ aggregateRating: 0, totalReviews: 0, reviews: [] }} />,
    );
    expect(screen.getByText('No reviews yet')).toBeTruthy();
  });

  it('renders filter chips', () => {
    renderWithProviders(<StitchReviewsNew />);
    expect(screen.getByText('All')).toBeTruthy();
    expect(screen.getByText('5 Star')).toBeTruthy();
    expect(screen.getByText('Photo')).toBeTruthy();
    expect(screen.getByText('Latest')).toBeTruthy();
  });

  it('renders review cards with data', () => {
    renderWithProviders(
      <StitchReviewsNew
        data={{
          aggregateRating: 4.5,
          totalReviews: 2,
          reviews: [
            { id: '1', author: 'John', avatarUrl: '/a.jpg', avatarAlt: 'A', rating: 5, content: 'Great coffee!', liked: false, likeCount: 3, date: '2024-01-01' },
            { id: '2', author: 'Jane', avatarUrl: '/b.jpg', avatarAlt: 'B', rating: 4, content: 'Nice ambiance.', liked: true, likeCount: 5, date: '2024-01-02' },
          ],
        }}
      />,
    );
    expect(screen.getByText('John')).toBeTruthy();
    expect(screen.getByText('Jane')).toBeTruthy();
    expect(screen.getByText('Great coffee!')).toBeTruthy();
    expect(screen.getByText('Nice ambiance.')).toBeTruthy();
  });

  it('renders aggregate rating', () => {
    renderWithProviders(
      <StitchReviewsNew
        data={{ aggregateRating: 4.5, totalReviews: 10, reviews: [] }}
      />,
    );
    expect(screen.getByText('4.5')).toBeTruthy();
    expect(screen.getByText('10')).toBeTruthy();
  });
});
