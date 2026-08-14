import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen } from '@/test-utils';
import { StitchReservationNew } from '../StitchReservationNew';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key?: string, optsOrFallback?: string | { defaultValue?: string }) => {
      const map: Record<string, string> = {};
      if (map[key ?? '']) return map[key ?? ''];
      if (typeof optsOrFallback === 'string') return optsOrFallback;
      if (optsOrFallback && typeof optsOrFallback === 'object' && 'defaultValue' in optsOrFallback) return optsOrFallback.defaultValue ?? key ?? '';
      return key ?? '';
    },
  }),
}));

vi.mock('lucide-react', () => ({
  ArrowLeft: () => null,
  X: () => null,
  ArrowRight: () => null,
  CheckCircle: () => null,
  ChevronLeft: () => null,
  ChevronRight: () => null,
}));

describe('StitchReservationNew', () => {
  it('renders the reservation page', () => {
    renderWithProviders(<StitchReservationNew />);
    expect(screen.getByText('Reserve Your Table')).toBeTruthy();
    expect(screen.getByText('AURA CAFE')).toBeTruthy();
  });

  it('renders party size selector', () => {
    renderWithProviders(<StitchReservationNew />);
    expect(screen.getByText('Guests')).toBeTruthy();
    expect(screen.getByText('1')).toBeTruthy();
  });

  it('renders date and time sections', () => {
    renderWithProviders(<StitchReservationNew />);
    expect(screen.getByText('Date')).toBeTruthy();
    expect(screen.getByText('Time')).toBeTruthy();
    expect(screen.getByText('September 2024')).toBeTruthy();
  });

  it('renders zone selection', () => {
    renderWithProviders(<StitchReservationNew />);
    expect(screen.getByText('Preferred Zone')).toBeTruthy();
    expect(screen.getByText('Indoor')).toBeTruthy();
    expect(screen.getByText('Rooftop')).toBeTruthy();
  });

  it('renders contact form and submit button', () => {
    renderWithProviders(<StitchReservationNew />);
    expect(screen.getByText('Contact Information')).toBeTruthy();
    expect(screen.getByText('Confirm Reservation')).toBeTruthy();
  });
});
