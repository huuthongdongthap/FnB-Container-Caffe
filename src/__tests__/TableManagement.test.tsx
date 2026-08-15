import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderWithProviders, screen, waitFor } from '@/test-utils';
import TableManagementPage from '@/pages/admin/TableManagement';

/* ── Mocks ──────────────────────────────────────────────────────────── */

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key?: string) => key ?? '', i18n: { language: 'vi' } }),
}));

vi.mock('@/components/seo/HelmetHead', () => ({
  HelmetHead: () => null,
}));

const mockApiFetch = vi.fn();
vi.mock('@/lib/api-client', () => ({
  apiFetch: (...args: unknown[]) => mockApiFetch(...args),
}));

/* ── Helpers ────────────────────────────────────────────────────────── */

const MOCK_TABLES = [
  { id: 't-1', table_number: 1, zone: 'Indoor', capacity: 4, status: 'Available' },
  { id: 't-2', table_number: 2, zone: 'Indoor', capacity: 2, status: 'Occupied' },
  { id: 't-3', table_number: 3, zone: 'Terrace', capacity: 6, status: 'Reserved' },
];

/* ── Tests ──────────────────────────────────────────────────────────── */

describe('TableManagementPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApiFetch.mockImplementation(async (url: string) => {
      if (typeof url === 'string' && url.includes('/api/orders')) {
        return { success: true, data: [{ table_id: 't-2', status: 'preparing' }] };
      }
      return { success: true, data: MOCK_TABLES };
    });
  });

  it('shows loading text initially', () => {
    renderWithProviders(<TableManagementPage />);
    expect(screen.getByText(/loading/)).toBeTruthy();
  });

  it('renders table numbers after loading', async () => {
    renderWithProviders(<TableManagementPage />);
    await waitFor(() => {
      expect(screen.getByText('1')).toBeTruthy();
    });
    expect(screen.getByText('2')).toBeTruthy();
    expect(screen.getByText('3')).toBeTruthy();
  });

  it('renders zone section headers', async () => {
    renderWithProviders(<TableManagementPage />);
    await waitFor(() => {
      expect(screen.getAllByText(/Indoor/).length).toBeGreaterThanOrEqual(1);
    });
    expect(screen.getAllByText(/Terrace/).length).toBeGreaterThanOrEqual(1);
  });

  it('shows empty message when no tables', async () => {
    mockApiFetch.mockImplementation(async (url: string) => {
      if (typeof url === 'string' && url.includes('/api/orders')) {
        return { success: true, data: [] };
      }
      return { success: true, data: [] };
    });
    renderWithProviders(<TableManagementPage />);
    await waitFor(() => {
      expect(screen.getByText(/noTables/)).toBeTruthy();
    });
  });

  it('shows filter dropdowns', async () => {
    renderWithProviders(<TableManagementPage />);
    await waitFor(() => {
      expect(screen.getByText(/filtersLabel/)).toBeTruthy();
    });
  });

  it('shows quick stats after loading', async () => {
    renderWithProviders(<TableManagementPage />);
    await waitFor(() => {
      expect(screen.getByText(/availableShort/)).toBeTruthy();
    });
  });

  it('renders capacity text for each table', async () => {
    renderWithProviders(<TableManagementPage />);
    await waitFor(() => {
      expect(screen.getByText('1')).toBeTruthy();
    });
    const capacityElements = screen.getAllByText(/capacity/);
    expect(capacityElements.length).toBeGreaterThan(0);
  });

  it('shows open all and refresh buttons', async () => {
    renderWithProviders(<TableManagementPage />);
    await waitFor(() => {
      expect(screen.getByText('1')).toBeTruthy();
    });
    expect(screen.getByText(/openAll/)).toBeTruthy();
    expect(screen.getByText(/refresh/)).toBeTruthy();
  });
});
