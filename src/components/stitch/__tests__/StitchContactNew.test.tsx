import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen, fireEvent } from '@/test-utils';
import { StitchContactNew } from '../StitchContactNew';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key?: string) => {
      const map: Record<string, string> = {
        'stitch.contact': 'Contact Us',
        'stitch.name': 'Name',
        'stitch.email': 'Email',
        'stitch.message': 'Message',
        'stitch.send': 'Send Message',
        'stitch.sending': 'Sending...',
        'stitch.success': 'Message sent successfully',
        'stitch.error': 'Failed to send message',
        'stitch.phone': 'Phone',
        'stitch.address': 'Address',
      };
      return map[key ?? ''] ?? key ?? '';
    },
  }),
}));

vi.mock('lucide-react', () => ({
  MapPin: () => null,
  Phone: () => null,
  Mail: () => null,
  Clock: () => null,
  Send: () => null,
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
