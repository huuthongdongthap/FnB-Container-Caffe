import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen, fireEvent } from '@/test-utils';
import { StitchReservationNew } from '../StitchReservationNew';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key?: string) => key ?? '',
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

describe('stitch-reservation-new', () => {
  it('renders reserve heading and brand', () => {
    renderWithProviders(<StitchReservationNew />);
    expect(screen.getByText('Reserve Your Table')).toBeTruthy();
    expect(screen.getByText('AURA CAFE')).toBeTruthy();
  });

  it('renders party size buttons 1 through 8', () => {
    renderWithProviders(<StitchReservationNew />);
    for (let i = 1; i <= 8; i++) {
      expect(screen.getByText(String(i))).toBeTruthy();
    }
  });

  it('renders all four zones', () => {
    renderWithProviders(<StitchReservationNew />);
    expect(screen.getByText('Indoor')).toBeTruthy();
    expect(screen.getByText('Outdoor')).toBeTruthy();
    expect(screen.getByText('Rooftop')).toBeTruthy();
    expect(screen.getByText('VIP Lounge')).toBeTruthy();
  });

  it('renders time slots', () => {
    renderWithProviders(<StitchReservationNew />);
    expect(screen.getByText('6:00 PM')).toBeTruthy();
    expect(screen.getByText('7:30 PM')).toBeTruthy();
    expect(screen.getByText('11:30 PM')).toBeTruthy();
  });

  it('renders contact inputs for name, phone, email', () => {
    renderWithProviders(<StitchReservationNew />);
    expect(screen.getByPlaceholderText('John Doe')).toBeTruthy();
    expect(screen.getByPlaceholderText('+1 (555) 000-0000')).toBeTruthy();
    expect(screen.getByPlaceholderText('john@example.com')).toBeTruthy();
  });

  it('calls onBack when back button clicked', () => {
    const onBack = vi.fn();
    renderWithProviders(<StitchReservationNew onBack={onBack} />);
    const btns = screen.getAllByRole('button');
    fireEvent.click(btns[0]!);
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when close button clicked', () => {
    const onClose = vi.fn();
    renderWithProviders(<StitchReservationNew onClose={onClose} />);
    const btns = screen.getAllByRole('button');
    // Close is the second button (after back)
    fireEvent.click(btns[1]!);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
