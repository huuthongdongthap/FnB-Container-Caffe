import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen, fireEvent } from '@/test-utils';
import { StitchReviewsNew } from '../StitchReviewsNew';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key?: string, optsOrFallback?: string | { defaultValue?: string }) => {
      const map: Record<string, string> = {
        'stitch.beFirstToShare': 'Be the first to share your experience',
        'stitch.bookATable': 'Book a Table',
        'stitch.failedToLoadReviews': 'Failed to load reviews',
        'stitch.filter5Star': '5 Star',
        'stitch.filterAll': 'All',
        'stitch.filterLatest': 'Latest',
        'stitch.filterPhoto': 'Photo',
        'stitch.footerContact': 'Contact Us',
        'stitch.footerCopyright': '© 2024 Aura Cafe. Precision. Darkness. Luxury.',
        'stitch.footerPressKit': 'Press Kit',
        'stitch.footerPrivacy': 'Privacy Policy',
        'stitch.footerTerms': 'Terms of Service',
        'stitch.guestExperiences': 'Guest Experiences',
        'stitch.loadingMoreExperiences': 'Loading more experiences',
        'stitch.navGallery': 'Gallery',
        'stitch.navMenu': 'Menu',
        'stitch.navReservations': 'Reservations',
        'stitch.navReviews': 'Reviews',
        'stitch.noReviewsYet': 'No reviews yet',
        'stitch.reviews': 'Reviews',
        'stitch.scrollToLoadMore': 'Scroll to load more',
        'stitch.unexpectedError': 'An unexpected error occurred',
        'stitch.writeAReview': 'Write a Review',
      }
      if (map[key ?? '']) return map[key ?? ''];
      if (typeof optsOrFallback === 'string') return optsOrFallback;
      if (optsOrFallback && typeof optsOrFallback === 'object' && 'defaultValue' in optsOrFallback) return optsOrFallback.defaultValue ?? key ?? '';
      return key ?? '';
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
