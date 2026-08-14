import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen } from '@/test-utils';
import { StitchOrderSuccessNew } from '../StitchOrderSuccessNew';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key?: string, optsOrFallback?: string | { defaultValue?: string }) => {
      const map: Record<string, string> = {
        'experimental-webgl': 'Experimental-Webgl',
        'footer.footerAriaLabel': 'Footer Aria Label',
        'footer.footerTerms': 'TERMS',
        'script': 'Script',
        'stitch.orderSuccessEmptyItems': 'Order Success Empty Items',
        'stitch.orderSuccessError': 'Order Success Error',
        'stitch.orderSuccessId': 'ORDER',
        'stitch.orderSuccessNewAccount': 'Order Success New Account',
        'stitch.orderSuccessNewBack': 'Order Success New Back',
        'stitch.orderSuccessNewLocation': 'Order Success New Location',
        'stitch.orderSuccessNewMin': 'min',
        'stitch.orderSuccessNotFound': 'Order Success Not Found',
        'stitch.orderSuccessNotFoundDesc': 'Order Success Not Found Desc',
        'stitch.orderSuccessRetry': 'Order Success Retry',
        'stitch.orderSuccessTotal': 'Order Success Total',
        'stitch.orderSummary': 'Order Summary',
        'stitch.selectedItems': 'Selected Items',
        'three': 'Three',
        'webgl': 'Webgl',
      }
      if (map[key ?? '']) return map[key ?? ''];
      if (typeof optsOrFallback === 'string') return optsOrFallback;
      if (optsOrFallback && typeof optsOrFallback === 'object' && 'defaultValue' in optsOrFallback) return optsOrFallback.defaultValue ?? key ?? '';
      return key ?? '';
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
