import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen, fireEvent } from '@/test-utils';
import { StitchGalleryNew } from '../StitchGalleryNew';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key?: string) => key ?? '',
  }),
}));

vi.mock('lucide-react', () => ({
  Menu: () => null,
  ShoppingBag: () => null,
  Home: () => null,
  Grid3x3: () => null,
  UtensilsCrossed: () => null,
  ArmchairIcon: () => null,
  ArrowUpRight: () => null,
}));

describe('stitch-gallery-new', () => {
  it('renders gallery heading and subheading', () => {
    renderWithProviders(<StitchGalleryNew />);
    expect(screen.getByText('Design Showcase')).toBeTruthy();
  });

  it('renders AURA CAFE brand', () => {
    renderWithProviders(<StitchGalleryNew />);
    expect(screen.getByText('AURA CAFE')).toBeTruthy();
  });

  it('renders all four gallery item titles', () => {
    renderWithProviders(<StitchGalleryNew />);
    expect(screen.getByText('PRECISION POS')).toBeTruthy();
    expect(screen.getByText('KINETIC KITCHEN')).toBeTruthy();
    expect(screen.getByText('NOCTURNAL LOYALTY')).toBeTruthy();
    expect(screen.getByText('ATMOSPHERIC GRID')).toBeTruthy();
  });

  it('renders all four filter options', () => {
    renderWithProviders(<StitchGalleryNew />);
    expect(screen.getByText('ALL')).toBeTruthy();
    expect(screen.getByText('INDUSTRIAL')).toBeTruthy();
    expect(screen.getByText('LUXURY')).toBeTruthy();
    expect(screen.getByText('TECH')).toBeTruthy();
  });

  it('calls onItemClick when gallery card clicked', () => {
    const onItemClick = vi.fn();
    renderWithProviders(<StitchGalleryNew onItemClick={onItemClick} />);
    const card = screen.getByRole('button', { name: /PRECISION POS/i });
    fireEvent.click(card);
    expect(onItemClick).toHaveBeenCalledWith('precision-pos');
  });

  it('calls onLoadMore when load more button clicked', () => {
    const onLoadMore = vi.fn();
    renderWithProviders(<StitchGalleryNew onLoadMore={onLoadMore} />);
    fireEvent.click(screen.getByText('LOAD MORE ARCHIVES'));
    expect(onLoadMore).toHaveBeenCalledTimes(1);
  });

  it('renders bottom navigation labels', () => {
    renderWithProviders(<StitchGalleryNew />);
    expect(screen.getByText('HOME')).toBeTruthy();
    expect(screen.getByText('GALLERY')).toBeTruthy();
    expect(screen.getByText('MENU')).toBeTruthy();
    expect(screen.getByText('RESERVE')).toBeTruthy();
  });
});
