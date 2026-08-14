import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen } from '@/test-utils';
import { StitchGalleryNew } from '../StitchGalleryNew';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key?: string) => {
      const map: Record<string, string> = {
        'stitch.gallery': 'Gallery',
        'stitch.noImages': 'No images available',
        'stitch.loading': 'Loading...',
        'stitch.error': 'Failed to load gallery',
      };
      return map[key ?? ''] ?? key ?? '';
    },
  }),
}));

describe('StitchGalleryNew', () => {
  it('renders the gallery page', () => {
    renderWithProviders(<StitchGalleryNew />);
    expect(screen.getByText('Gallery')).toBeTruthy();
  });

  it('shows loading state', () => {
    renderWithProviders(<StitchGalleryNew loading />);
    expect(screen.getByText('Loading...')).toBeTruthy();
  });

  it('shows error state', () => {
    renderWithProviders(<StitchGalleryNew error="Network error" />);
    expect(screen.getByText('Network error')).toBeTruthy();
  });

  it('shows empty state when no images', () => {
    renderWithProviders(<StitchGalleryNew images={[]} />);
    expect(screen.getByText('No images available')).toBeTruthy();
  });

  it('renders gallery images', () => {
    renderWithProviders(
      <StitchGalleryNew
        images={[
          { id: '1', src: '/img1.jpg', alt: 'Interior shot', caption: 'The Space' },
          { id: '2', src: '/img2.jpg', alt: 'Coffee art', caption: 'Latte Art' },
        ]}
      />,
    );
    expect(screen.getByText('The Space')).toBeTruthy();
    expect(screen.getByText('Latte Art')).toBeTruthy();
  });
});
