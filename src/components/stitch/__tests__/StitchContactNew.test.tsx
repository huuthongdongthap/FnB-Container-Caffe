import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen, fireEvent } from '@/test-utils';
import { StitchContactNew } from '../StitchContactNew';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key?: string, optsOrFallback?: string | { defaultValue?: string }) => {
      const map: Record<string, string> = {
        'contact.address': 'ADDRESS',
        'contact.email': 'ELECTRONIC MAIL',
        'contact.footerPrivacy': 'Privacy Policy',
        'contact.footerSupport': 'Support',
        'contact.footerTerms': 'Terms of Service',
        'contact.formEmail': 'EMAIL',
        'contact.formMessage': 'MESSAGE',
        'contact.formMessagePlaceholder': 'Your enquiry here...',
        'contact.formName': 'NAME',
        'contact.heroLabel': 'LOCATION & ENQUIRIES',
        'contact.mapLabel': 'LIVE MAP NAVIGATION',
        'contact.mapLocation': 'Sa Dec Industrial Park Hub',
        'contact.phone': 'DIRECT LINE',
        'contact.submit': 'DISPATCH MESSAGE',
      }
      if (map[key ?? '']) return map[key ?? ''];
      if (typeof optsOrFallback === 'string') return optsOrFallback;
      if (optsOrFallback && typeof optsOrFallback === 'object' && 'defaultValue' in optsOrFallback) return optsOrFallback.defaultValue ?? key ?? '';
      return key ?? '';
    },
  }),
}));

vi.mock('lucide-react', () => ({
  MapPin: () => null,
  Phone: () => null,
  Mail: () => null,
  Clock: () => null,
  Send: () => null,
  Search: () => null,
  UserCircle: () => null,
  Share2: () => null,
  ThumbsUp: () => null,
  Camera: () => null,
  ArrowRight: () => null,
}));

describe('StitchContactNew', () => {
  it('renders the contact page', () => {
    renderWithProviders(<StitchContactNew />);
    expect(screen.getByText('Contact Us')).toBeTruthy();
  });

  it('renders the contact form', () => {
    renderWithProviders(<StitchContactNew />);
    expect(screen.getByLabelText(/name/i)).toBeTruthy();
    expect(screen.getByLabelText(/email/i)).toBeTruthy();
    expect(screen.getByLabelText(/message/i)).toBeTruthy();
  });

  it('renders send button', () => {
    renderWithProviders(<StitchContactNew />);
    expect(screen.getByText('Send Message')).toBeTruthy();
  });

  it('renders contact info', () => {
    renderWithProviders(<StitchContactNew />);
    expect(screen.getByText('Phone')).toBeTruthy();
    expect(screen.getByText('Address')).toBeTruthy();
  });

  it('submits the form', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    renderWithProviders(<StitchContactNew onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText(/name/i), { target: { value: 'Test User' } });
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'test@test.com' } });
    fireEvent.change(screen.getByLabelText(/message/i), { target: { value: 'Hello!' } });
    fireEvent.click(screen.getByText('Send Message'));

    expect(onSubmit).toHaveBeenCalledWith({
      name: 'Test User',
      email: 'test@test.com',
      message: 'Hello!',
    });
  });
});
