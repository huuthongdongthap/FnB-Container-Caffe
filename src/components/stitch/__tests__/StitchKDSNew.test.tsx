import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen, fireEvent } from '@/test-utils';
import { StitchKDSNew } from '../StitchKDSNew';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key?: string) => {
      const map: Record<string, string> = {
        'stitch.kds': 'Kitchen Display',
        'stitch.all': 'All',
        'stitch.pending': 'Pending',
        'stitch.inProgress': 'In Progress',
        'stitch.ready': 'Ready',
        'stitch.noTickets': 'No tickets',
        'stitch.loading': 'Loading...',
        'stitch.error': 'Failed to load tickets',
        'stitch.bump': 'Bump',
        'stitch.start': 'Start',
        'stitch.done': 'Done',
      };
      return map[key ?? ''] ?? key ?? '';
    },
  }),
}));

vi.mock('lucide-react', () => ({
  Clock: () => null,
  AlertCircle: () => null,
  CheckCircle: () => null,
  Flame: () => null,
  Utensils: () => null,
}));

vi.mock('@/hooks/use-focus-trap', () => ({
  useFocusTrap: () => ({ current: null }),
}));

describe('StitchKDSNew', () => {
  it('renders the KDS page', () => {
    renderWithProviders(<StitchKDSNew />);
    expect(screen.getByText('Kitchen Display')).toBeTruthy();
  });

  it('shows loading state', () => {
    renderWithProviders(<StitchKDSNew loading />);
    expect(screen.getByText('Loading...')).toBeTruthy();
  });

  it('shows error state', () => {
    renderWithProviders(<StitchKDSNew error="Connection lost" />);
    expect(screen.getByText('Connection lost')).toBeTruthy();
  });

  it('shows empty state when no tickets', () => {
    renderWithProviders(<StitchKDSNew tickets={[]} />);
    expect(screen.getByText('No tickets')).toBeTruthy();
  });

  it('renders filter tabs', () => {
    renderWithProviders(<StitchKDSNew />);
    expect(screen.getByText('All')).toBeTruthy();
    expect(screen.getByText('Pending')).toBeTruthy();
    expect(screen.getByText('In Progress')).toBeTruthy();
    expect(screen.getByText('Ready')).toBeTruthy();
  });

  it('renders ticket cards with data', () => {
    renderWithProviders(
      <StitchKDSNew
        tickets={[
          { id: 'T1', orderNumber: '#201', table: 'T5', status: 'pending', items: [{ name: 'Espresso', quantity: 2 }], createdAt: new Date().toISOString() },
          { id: 'T2', orderNumber: '#202', table: 'T3', status: 'in-progress', items: [{ name: 'Latte', quantity: 1 }], createdAt: new Date().toISOString() },
        ]}
      />,
    );
    expect(screen.getByText('#201')).toBeTruthy();
    expect(screen.getByText('#202')).toBeTruthy();
    expect(screen.getByText('T5')).toBeTruthy();
    expect(screen.getByText('T3')).toBeTruthy();
  });

  it('filters tickets by status', () => {
    renderWithProviders(
      <StitchKDSNew
        tickets={[
          { id: 'T1', orderNumber: '#201', table: 'T5', status: 'pending', items: [{ name: 'Espresso', quantity: 2 }], createdAt: new Date().toISOString() },
          { id: 'T2', orderNumber: '#202', table: 'T3', status: 'ready', items: [{ name: 'Latte', quantity: 1 }], createdAt: new Date().toISOString() },
        ]}
      />,
    );
    fireEvent.click(screen.getByText('Ready'));
    expect(screen.getByText('#202')).toBeTruthy();
    expect(screen.queryByText('#201')).toBeNull();
  });

  it('calls onBump when bump button is clicked', () => {
    const onBump = vi.fn();
    renderWithProviders(
      <StitchKDSNew
        tickets={[
          { id: 'T1', orderNumber: '#201', table: 'T5', status: 'pending', items: [{ name: 'Espresso', quantity: 2 }], createdAt: new Date().toISOString() },
        ]}
        onBump={onBump}
      />,
    );
    const bumpBtn = screen.getByText('Done');
    fireEvent.click(bumpBtn);
    expect(onBump).toHaveBeenCalledWith('T1');
  });
});
