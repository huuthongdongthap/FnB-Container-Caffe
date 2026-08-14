import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen } from '@/test-utils';
import { StitchOrderSuccessNew } from '../StitchOrderSuccessNew';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key?: string) => {
      const map: Record<string, string> = {
        'stitch.orderSuccess': 'Order Confirmed',
        'stitch.thankYou': 'Thank you for your order',
        'stitch.orderNumber': 'Order Number',
        'stitch.estimatedTime': 'Estimated Time',
        'stitch.trackOrder': 'Track Order',
        'stitch.backToMenu': 'Back to Menu',
        'stitch.viewReceipt': 'View Receipt',
      };
      return map[key ?? ''] ?? key ?? '';
    },
  }),
}));

vi.mock('lucide-react', () => ({
  CheckCircle: () => null,
  Clock: () => null,
  ArrowRight: () => null,
  FileText: () => null,
}));

describe('StitchOrderSuccessNew', () => {
  it('renders the success page', () => {
    renderWithProviders(<StitchOrderSuccessNew />);
    expect(screen.getByText('Order Confirmed')).toBeTruthy();
  });

  it('renders thank you message', () => {
    renderWithProviders(<StitchOrderSuccessNew />);
    expect(screen.getByText('Thank you for your order')).toBeTruthy();
  });

  it('renders order number when provided', () => {
    renderWithProviders(<StitchOrderSuccessNew orderNumber="#1234" />);
    expect(screen.getByText('#1234')).toBeTruthy();
  });

  it('renders estimated time when provided', () => {
    renderWithProviders(<StitchOrderSuccessNew estimatedMinutes={15} />);
    expect(screen.getByText('15')).toBeTruthy();
  });

  it('renders track order button', () => {
    renderWithProviders(<StitchOrderSuccessNew />);
    expect(screen.getByText('Track Order')).toBeTruthy();
  });

  it('renders back to menu link', () => {
    renderWithProviders(<StitchOrderSuccessNew />);
    const menuLink = screen.getByText('Back to Menu').closest('a');
    expect(menuLink?.getAttribute('href')).toBe('/');
  });
});
