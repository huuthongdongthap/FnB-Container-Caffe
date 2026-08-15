import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderWithProviders, screen, fireEvent } from '@/test-utils';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key?: string) => key ?? '',
  }),
  Trans: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('@/components/seo/HelmetHead', () => ({
  HelmetHead: () => null,
}));

vi.mock('@/hooks/stores/admin/use-admin-reservations-store', () => ({
  useAdminReservationsStore: vi.fn(),
}));

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children, className }: any) => <span className={className}>{children}</span>,
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, disabled, variant }: any) => (
    <button onClick={onClick} disabled={disabled} data-variant={variant}>
      {children}
    </button>
  ),
}));

vi.mock('@/components/ui/card', () => ({
  Card: ({ children, className }: any) => <div className={className}>{children}</div>,
  CardBody: ({ children, className }: any) => <div className={className}>{children}</div>,
}));

import { useAdminReservationsStore } from '@/hooks/stores/admin/use-admin-reservations-store';
import AdminReservationsPage from '@/pages/admin/Reservations';

const MOCK_RESERVATIONS = [
  {
    id: 'r1',
    customer_name: 'Alice',
    date: '2026-08-20',
    time: '18:00',
    guests: 4,
    table_number: 'T5',
    status: 'pending',
    note: 'Window seat',
  },
  {
    id: 'r2',
    customer_name: 'Bob',
    date: '2026-08-21',
    time: '12:00',
    guests: 2,
    table_number: 'T3',
    status: 'confirmed',
    note: '',
  },
  {
    id: 'r3',
    customer_name: 'Charlie',
    date: '2026-08-22',
    time: '19:30',
    guests: 6,
    table_number: '',
    status: 'cancelled',
    note: '',
  },
];

function setupStore(overrides: {
  reservations?: any[];
  loading?: boolean;
  error?: string | null;
} = {}) {
  vi.mocked(useAdminReservationsStore).mockReturnValue({
    reservations: overrides.reservations ?? MOCK_RESERVATIONS,
    loading: overrides.loading ?? false,
    error: overrides.error ?? null,
    fetchReservations: vi.fn(),
    approveReservation: vi.fn().mockResolvedValue(undefined),
    rejectReservation: vi.fn().mockResolvedValue(undefined),
  } as any);
}

describe('AdminReservationsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupStore();
  });

  afterEach(() => vi.restoreAllMocks());

  it('renders without crashing', () => {
    renderWithProviders(<AdminReservationsPage />);
    expect(screen.getAllByText('adminReservations.title').length).toBeGreaterThanOrEqual(1);
  });

  it('shows loading spinner when loading', () => {
    setupStore({ loading: true, reservations: [] });
    renderWithProviders(<AdminReservationsPage />);
    expect(screen.getByText('common.loading')).toBeTruthy();
  });

  it('renders reservation cards with data', () => {
    renderWithProviders(<AdminReservationsPage />);
    expect(screen.getByText('Alice')).toBeTruthy();
    expect(screen.getByText('Bob')).toBeTruthy();
    expect(screen.getByText('Charlie')).toBeTruthy();
  });

  it('shows approve/reject buttons for pending reservations', () => {
    renderWithProviders(<AdminReservationsPage />);
    const confirmBtns = screen.getAllByText('adminReservations.confirmBtn');
    expect(confirmBtns.length).toBeGreaterThanOrEqual(1);
  });

  it('shows error state with retry button', () => {
    setupStore({ error: 'Connection timeout', reservations: [] });
    renderWithProviders(<AdminReservationsPage />);
    expect(screen.getByText('Connection timeout')).toBeTruthy();
    expect(screen.getByText('common.retry')).toBeTruthy();
  });

  it('shows empty state when no reservations', () => {
    setupStore({ reservations: [] });
    renderWithProviders(<AdminReservationsPage />);
    expect(screen.getByText('adminReservations.emptyTitle')).toBeTruthy();
  });
});
