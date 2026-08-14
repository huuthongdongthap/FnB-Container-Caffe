import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen, fireEvent } from '@/test-utils';
import { StitchContactNew } from '../StitchContactNew';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key?: string, optsOrFallback?: string | { defaultValue?: string }) => {
      const map: Record<string, string> = {
        'contact.heroLabel': 'LOCATION & ENQUIRIES',
        'contact.heroTitle': 'Connect with the Aura',
        'contact.address': 'ADDRESS',
        'contact.phone': 'DIRECT LINE',
        'contact.email': 'ELECTRONIC MAIL',
        'contact.formTitle': 'Send a Message',
        'contact.formName': 'NAME',
        'contact.formEmail': 'EMAIL',
        'contact.formMessage': 'MESSAGE',
        'contact.formMessagePlaceholder': 'Your enquiry here...',
        'contact.submit': 'DISPATCH MESSAGE',
        'contact.mapLabel': 'LIVE MAP NAVIGATION',
        'contact.mapLocation': 'Sa Dec Industrial Park Hub',
        'contact.footerSupport': 'Support',
        'contact.footerPrivacy': 'Privacy Policy',
        'contact.footerTerms': 'Terms of Service',
      }
      if (map[key ?? '']) return map[key ?? ''];
      if (typeof optsOrFallback === 'string') return optsOrFallback;
      if (optsOrFallback && typeof optsOrFallback === 'object' && 'defaultValue' in optsOrFallback) return optsOrFallback.defaultValue ?? key ?? '';
      return key ?? '';
    },
  }),
}));

vi.mock('lucide-react', () => ({
  Search: () => null,
  UserCircle: () => null,
  Share2: () => null,
  ThumbsUp: () => null,
  Camera: () => null,
  ArrowRight: () => null,
  MapPin: () => null,
}));

describe('StitchContactNew', () => {
  it('renders the hero section', () => {
    renderWithProviders(<StitchContactNew />);
    expect(screen.getByText('LOCATION & ENQUIRIES')).toBeTruthy();
    expect(screen.getByText(/Connect with the Aura/)).toBeTruthy();
  });

  it('renders the contact form', () => {
    renderWithProviders(<StitchContactNew />);
    expect(screen.getByPlaceholderText('John Doe')).toBeTruthy();
    expect(screen.getByPlaceholderText('john@example.com')).toBeTruthy();
    expect(screen.getByPlaceholderText('Your enquiry here...')).toBeTruthy();
  });

  it('renders submit button', () => {
    renderWithProviders(<StitchContactNew />);
    expect(screen.getByText('DISPATCH MESSAGE')).toBeTruthy();
  });

  it('renders contact info', () => {
    renderWithProviders(<StitchContactNew />);
    expect(screen.getByText('DIRECT LINE')).toBeTruthy();
    expect(screen.getByText('ADDRESS')).toBeTruthy();
  });

  it('submits the form', async () => {
    const onSubmit = vi.fn();
    renderWithProviders(<StitchContactNew onSubmit={onSubmit} />);
    fireEvent.change(screen.getByPlaceholderText('John Doe'), { target: { value: 'Test User' } });
    fireEvent.change(screen.getByPlaceholderText('john@example.com'), { target: { value: 'test@test.com' } });
    fireEvent.change(screen.getByPlaceholderText('Your enquiry here...'), { target: { value: 'Hello!' } });
    fireEvent.click(screen.getByText('DISPATCH MESSAGE'));
    expect(onSubmit).toHaveBeenCalledWith({
      name: 'Test User',
      email: 'test@test.com',
      message: 'Hello!',
    });
  });
});
