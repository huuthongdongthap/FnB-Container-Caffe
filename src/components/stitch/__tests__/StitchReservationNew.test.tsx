import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen, fireEvent } from '@/test-utils';
import { StitchReservationNew } from '../StitchReservationNew';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key?: string) => {
      const map: Record<string, string> = {
        'stitch.reservation': 'Reservations',
        'stitch.name': 'Name',
        'stitch.email': 'Email',
        'stitch.phone': 'Phone',
        'stitch.date': 'Date',
        'stitch.time': 'Time',
        'stitch.guests': 'Guests',
        'stitch.notes': 'Special Requests',
        'stitch.submit': 'Reserve Now',
        'stitch.submitting': 'Reserving...',
        'stitch.success': 'Reservation confirmed',
        'stitch.error': 'Reservation failed',
        'stitch.backToSite': 'Back to Site',
      };
      return map[key ?? ''] ?? key ?? '';
    },
  }),
}));

vi.mock('lucide-react', () => ({
  Calendar: () => null,
  Clock: () => null,
  Users: () => null,
  Phone: () => null,
  Mail: () => null,
  User: () => null,
  MapPin: () => null,
}));

describe('StitchReservationNew', () => {
  it('renders the reservation form', () => {
    renderWithProviders(<StitchReservationNew />);
    expect(screen.getByText('Reservations')).toBeTruthy();
  });

  it('renders form fields', () => {
    renderWithProviders(<StitchReservationNew />);
    expect(screen.getByLabelText(/name/i)).toBeTruthy();
    expect(screen.getByLabelText(/phone/i)).toBeTruthy();
    expect(screen.getByLabelText(/date/i)).toBeTruthy();
    expect(screen.getByLabelText(/time/i)).toBeTruthy();
    expect(screen.getByLabelText(/guests/i)).toBeTruthy();
  });

  it('renders reserve button', () => {
    renderWithProviders(<StitchReservationNew />);
    expect(screen.getByText('Reserve Now')).toBeTruthy();
  });

  it('submits the reservation form', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    renderWithProviders(<StitchReservationNew onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText(/name/i), { target: { value: 'John Doe' } });
    fireEvent.change(screen.getByLabelText(/phone/i), { target: { value: '0901234567' } });
    fireEvent.change(screen.getByLabelText(/date/i), { target: { value: '2024-12-25' } });
    fireEvent.change(screen.getByLabelText(/time/i), { target: { value: '19:00' } });
    fireEvent.change(screen.getByLabelText(/guests/i), { target: { value: '4' } });
    fireEvent.click(screen.getByText('Reserve Now'));

    expect(onSubmit).toHaveBeenCalled();
  });

  it('shows submitting state', () => {
    renderWithProviders(<StitchReservationNew submitting />);
    expect(screen.getByText('Reserving...')).toBeTruthy();
  });
});
