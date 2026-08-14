import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen } from '@/test-utils';
import { StitchOrderSuccessNew } from '../StitchOrderSuccessNew';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key?: string, optsOrFallback?: string | { defaultValue?: string }) => {
      const map: Record<string, string> = {
        'stitch.orderSuccessId': 'ORDER',
        'stitch.orderSuccessTotal': 'TOTAL',
        'stitch.orderSuccessMin': 'min',
        'stitch.orderSuccessNewLocation': 'LOCATION',
        'stitch.orderSuccessNewBack': 'Back',
        'stitch.orderSuccessNewAccount': 'Account',
        'stitch.orderSuccessEmptyItems': 'No items',
        'stitch.orderSuccessNotFound': 'Order Not Found',
        'stitch.orderSuccessNotFoundDesc': 'This order could not be found.',
        'stitch.orderSuccessError': 'Something went wrong',
        'stitch.orderSuccessRetry': 'Retry',
        'footer.footerAriaLabel': 'Footer',
        'footer.footerTerms': 'Terms',
      };
      if (map[key ?? '']) return map[key ?? ''];
      if (typeof optsOrFallback === 'string') return optsOrFallback;
      if (optsOrFallback && typeof optsOrFallback === 'object' && 'defaultValue' in optsOrFallback) return optsOrFallback.defaultValue ?? key ?? '';
      return key ?? '';
    },
  }),
}));

vi.mock('lucide-react', () => ({
  ArrowLeft: () => null,
  UserCircle: () => null,
  Check: () => null,
  MapPin: () => null,
  AlertCircle: () => null,
  RefreshCw: () => null,
  Receipt: () => null,
}));

const mockOrder = {
  orderId: 'ORD-001',
  items: [
    { id: '1', name: 'Cortado', quantity: 2, price: 45000 },
    { id: '2', name: 'Croissant', quantity: 1, price: 35000 },
  ],
  total: 125000,
  estimatedMinutes: 12,
  locationName: 'Aura Cafe - District 1',
  customerName: 'Julian',
};

describe('StitchOrderSuccessNew', () => {
  it('renders order confirmation', () => {
    renderWithProviders(<StitchOrderSuccessNew order={mockOrder} />);
    expect(screen.getByText('Aura Cafe - District 1')).toBeTruthy();
    expect(screen.getByText(/ORD-001/)).toBeTruthy();
  });

  it('renders order items', () => {
    renderWithProviders(<StitchOrderSuccessNew order={mockOrder} />);
    expect(screen.getByText('Cortado')).toBeTruthy();
    expect(screen.getByText('Croissant')).toBeTruthy();
  });

  it('renders order ID', () => {
    renderWithProviders(<StitchOrderSuccessNew order={mockOrder} />);
    expect(screen.getByText(/ORD-001/)).toBeTruthy();
  });

  it('shows error state', () => {
    renderWithProviders(<StitchOrderSuccessNew order={null} error="Network error" />);
    expect(screen.getByText(/Network error/)).toBeTruthy();
  });

  it('shows not found state', () => {
    renderWithProviders(<StitchOrderSuccessNew order={null} />);
    expect(screen.getByText('Order Not Found')).toBeTruthy();
  });
});
