import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen, fireEvent as _fireEvent } from '@/test-utils';
import { StitchKDSNew } from '../StitchKDSNew';

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
  Bell: () => null,
  BellOff: () => null,
  Settings: () => null,
  LayoutDashboard: () => null,
  History: () => null,
  Package: () => null,
  Users: () => null,
  AlertTriangle: () => null,
  RefreshCw: () => null,
  ChevronLeft: () => null,
  ChevronRight: () => null,
  ChefHat: () => null,
  CheckCircle2: () => null,
  Maximize2: () => null,
  Minimize2: () => null,
  Volume2: () => null,
  VolumeX: () => null,
  Monitor: () => null,
  CreditCard: () => null,
}));

vi.mock('@/hooks/use-focus-trap', () => ({
  useFocusTrap: () => {},
}));

describe('StitchKDSNew', () => {
  it('renders the KDS title', () => {
    renderWithProviders(<StitchKDSNew />);
    expect(screen.getByText('AURA CAFE KDS')).toBeTruthy();
  });

  it('shows loading state', () => {
    renderWithProviders(<StitchKDSNew isLoading />);
    expect(screen.getByText('AURA CAFE KDS')).toBeTruthy();
  });

  it('shows error state', () => {
    renderWithProviders(<StitchKDSNew error="Connection lost" />);
    expect(screen.getByText('AURA CAFE KDS')).toBeTruthy();
  });

  it('renders non-overlapping filter buttons visible on small screens', () => {
    renderWithProviders(<StitchKDSNew />);
    const filterNav = screen.getByRole('navigation', { name: 'Filter tickets' });
    expect(filterNav.className).not.toContain('hidden');
    expect(filterNav.className).toContain('flex');
    expect(screen.getByRole('button', { name: 'ALL' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'OVERDUE' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'PRIORITY' })).toBeNull();
    expect(screen.getByRole('button', { name: 'PENDING' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'PREPARING' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'READY' })).toBeTruthy();
  });

  it('keeps overdue preparing tickets in PREPARING with active counts and correct action', () => {
    const complete = vi.fn();
    renderWithProviders(<StitchKDSNew activeFilter="preparing" onCompleteTicket={complete} tickets={[{
      id: '#LATE', table: '01', type: 'DINE IN', status: 'overdue', rawStatus: 'preparing',
      items: [{ name: 'Coffee', quantity: 1 }], elapsedSeconds: 1000,
    }]} />);
    expect(screen.getByText('#LATE')).toBeInTheDocument();
    expect(screen.getByText(/ACTIVE ORDERS.*1/)).toBeInTheDocument();
    _fireEvent.click(screen.getByRole('button', { name: 'PRIORITY COMPLETE' }));
    expect(complete).toHaveBeenCalledWith('#LATE');
  });

  it('shows ticket-specific mutation errors with retry and disables its pending action', () => {
    const startPrep = vi.fn();
    renderWithProviders(<StitchKDSNew onStartPrep={startPrep} pendingOrders={{ '#9843': true }} mutationErrors={{ '#9843': '409 conflict' }} />);
    expect(screen.getByRole('alert')).toHaveTextContent('409 conflict');
    expect(screen.getByRole('status')).toHaveTextContent('Đang cập nhật');
    expect(screen.getAllByRole('button', { name: 'START PREP' }).some(button => button.hasAttribute('disabled'))).toBe(true);
    expect(screen.getByRole('button', { name: 'Thử lại' })).toBeDisabled();
  });

  it('invokes retry action when clicking retry on a failed ticket', () => {
    const complete = vi.fn();
    renderWithProviders(
      <StitchKDSNew
        activeFilter="preparing"
        onCompleteTicket={complete}
        mutationErrors={{ '#LATE': '409 conflict' }}
        tickets={[{
          id: '#LATE', table: '01', type: 'DINE IN', status: 'overdue', rawStatus: 'preparing', isOverdue: true,
          items: [{ name: 'Coffee', quantity: 1 }], elapsedSeconds: 1000,
        }]}
      />,
    );
    _fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
    expect(complete).toHaveBeenCalledWith('#LATE');
  });

  it('renders default tickets', () => {
    renderWithProviders(<StitchKDSNew />);
    expect(screen.getByText('#9842')).toBeTruthy();
  });
});
