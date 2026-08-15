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
  ArrowLeft: () => null,
  Coffee: () => null,
  Croissant: () => null,
  MapPin: () => null,
  Receipt: () => null,
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

  it('renders order total', () => {
    renderWithProviders(<StitchTrackOrderNew total={25.75} />);
    expect(screen.getByText('$25.75')).toBeTruthy();
  });

  it('calls onTrackMap when track button clicked', () => {
    const onTrackMap = vi.fn();
    renderWithProviders(<StitchTrackOrderNew onTrackMap={onTrackMap} />);
    const btn = screen.getByText('trackOrder.trackMap');
    fireEvent.click(btn.closest('button')!);
    expect(onTrackMap).toHaveBeenCalledTimes(1);
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
    expect(onNavigate).toHaveBeenCalledWith('/orders');
    fireEvent.click(screen.getByText('nav.profile'));
    expect(onNavigate).toHaveBeenCalledWith('/profile');
  });
});
