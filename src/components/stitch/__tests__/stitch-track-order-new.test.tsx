import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen, fireEvent } from '@/test-utils';
import { StitchTrackOrderNew } from '../StitchTrackOrderNew';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key?: string) => key ?? '',
  }),
}));

vi.mock('@/components/seo/HelmetHead', () => ({
  HelmetHead: () => null,
}));

vi.mock('lucide-react', () => ({
  AlertTriangle: () => null,
  ArrowLeft: () => null,
  Coffee: () => null,
  Croissant: () => null,
  MapPin: () => null,
  Receipt: () => null,
  Search: () => null,
  UtensilsCrossed: () => null,
  User: () => null,
}));

describe('stitch-track-order-new', () => {
  it('renders default order reference', () => {
    renderWithProviders(<StitchTrackOrderNew />);
    expect(screen.getByText('#AC-8842')).toBeTruthy();
  });

  it('renders estimated minutes', () => {
    renderWithProviders(<StitchTrackOrderNew />);
    expect(screen.getByText('8')).toBeTruthy();
  });

  it('renders custom order items', () => {
    const items = [
      { id: 'a', name: 'Cappuccino', quantity: 2, price: 5.0 },
    ];
    renderWithProviders(<StitchTrackOrderNew items={items} />);
    expect(screen.getByText('Cappuccino')).toBeTruthy();
  });

  it('renders order total in VND', () => {
    renderWithProviders(<StitchTrackOrderNew total={45000} />);
    expect(screen.getByText('45.000₫')).toBeTruthy();
  });

  it('calls onSearchAnother when search-another button clicked', () => {
    const onSearchAnother = vi.fn();
    renderWithProviders(<StitchTrackOrderNew onSearchAnother={onSearchAnother} />);
    const btn = screen.getByText('trackOrder.searchAnother');
    fireEvent.click(btn.closest('button')!);
    expect(onSearchAnother).toHaveBeenCalledTimes(1);
  });

  it('calls onBack when back button clicked', () => {
    const onBack = vi.fn();
    renderWithProviders(<StitchTrackOrderNew onBack={onBack} />);
    const btn = screen.getByRole('button', { name: /go back/i });
    fireEvent.click(btn);
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('navigates bottom nav items', () => {
    const onNavigate = vi.fn();
    renderWithProviders(<StitchTrackOrderNew onNavigate={onNavigate} />);
    fireEvent.click(screen.getByText('nav.menu'));
    expect(onNavigate).toHaveBeenCalledWith('/menu');
    fireEvent.click(screen.getByText('nav.orders'));
    expect(onNavigate).toHaveBeenCalledWith('/track-order');
    fireEvent.click(screen.getByText('nav.profile'));
    expect(onNavigate).toHaveBeenCalledWith('/account');
  });
});
