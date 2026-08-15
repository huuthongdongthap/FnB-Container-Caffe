import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen, fireEvent } from '@/test-utils';
import { StitchCheckinNew } from '../StitchCheckinNew';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key?: string) => key ?? '',
  }),
}));

vi.mock('@/components/seo/HelmetHead', () => ({
  HelmetHead: () => null,
}));

vi.mock('lucide-react', () => ({
  Menu: () => null,
  UserCircle: () => null,
  Smartphone: () => null,
  ChevronRight: () => null,
  Scan: () => null,
  Home: () => null,
  History: () => null,
}));

describe('stitch-checkin-new', () => {
  it('renders AURA CAFE header', () => {
    renderWithProviders(<StitchCheckinNew />);
    expect(screen.getByText('AURA CAFE')).toBeTruthy();
  });

  it('renders phone input field', () => {
    renderWithProviders(<StitchCheckinNew />);
    expect(screen.getByLabelText('Phone number')).toBeTruthy();
  });

  it('disables submit when phone has fewer than 10 digits', () => {
    renderWithProviders(<StitchCheckinNew />);
    const input = screen.getByLabelText('Phone number');
    fireEvent.change(input, { target: { value: '123' } });
    const submitBtn = screen.getByText('checkin.submit').closest('button')!;
    expect(submitBtn.hasAttribute('disabled')).toBe(true);
  });

  it('calls onCheckin with raw digits when phone is valid', () => {
    const onCheckin = vi.fn();
    renderWithProviders(<StitchCheckinNew onCheckin={onCheckin} />);
    const input = screen.getByLabelText('Phone number');
    fireEvent.change(input, { target: { value: '5551234567' } });
    const submitBtn = screen.getByText('checkin.submit').closest('button')!;
    fireEvent.click(submitBtn);
    expect(onCheckin).toHaveBeenCalledWith('5551234567');
  });

  it('does not call onCheckin when phone is incomplete', () => {
    const onCheckin = vi.fn();
    renderWithProviders(<StitchCheckinNew onCheckin={onCheckin} />);
    const input = screen.getByLabelText('Phone number');
    fireEvent.change(input, { target: { value: '555123' } });
    const submitBtn = screen.getByText('checkin.submit').closest('button')!;
    fireEvent.click(submitBtn);
    expect(onCheckin).not.toHaveBeenCalled();
  });

  it('shows loading spinner when isLoading is true', () => {
    renderWithProviders(<StitchCheckinNew isLoading={true} />);
    expect(screen.queryByText('checkin.submit')).toBeNull();
  });

  it('calls onMenu when menu button clicked', () => {
    const onMenu = vi.fn();
    renderWithProviders(<StitchCheckinNew onMenu={onMenu} />);
    const btn = screen.getByRole('button', { name: /menu/i });
    fireEvent.click(btn);
    expect(onMenu).toHaveBeenCalledTimes(1);
  });
});
