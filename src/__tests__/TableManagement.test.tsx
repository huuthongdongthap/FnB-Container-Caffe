import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderWithProviders, screen, waitFor, fireEvent, within } from '@/test-utils';
import { saveClientSession } from '@/lib/client-session';
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
    localStorage.clear();
    sessionStorage.clear();
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
      expect(screen.getByText('1')).toBeTruthy();
    });
    expect(screen.getByText(/allZones|All zones/)).toBeTruthy();
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


describe('staff table transfer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();
    saveClientSession('staff-token', { id: 'staff-1', name: 'Staff', role: 'staff', tenantId: 'cafe-1' });
    mockApiFetch.mockImplementation(async (url: string) => {
      if (url.endsWith('/transfer')) return { success: true, data: { session_id: 'session-1', table_id: 't-1' } };
      if (url.startsWith('/api/table-sessions')) return { success: true, data: [{ id: 'session-1', table_id: 't-2', status: 'ordering' }] };
      if (url.startsWith('/api/orders')) return { success: true, data: [] };
      if (url.includes('status=Occupied')) return { success: true, data: [MOCK_TABLES[1]] };
      return { success: true, data: MOCK_TABLES };
    });
  });

  const openTransfer = async () => {
    fireEvent.click(await screen.findByRole('button', { name: 'Chuyển bàn' }));
    const modal = screen.getByRole('dialog');
    await within(modal).findByRole('option', { name: /1 · Indoor/ });
    return modal;
  };
  const confirm = (modal: HTMLElement) => {
    fireEvent.change(within(modal).getByRole('combobox'), { target: { value: 't-1' } });
    fireEvent.click(within(modal).getByLabelText(/Xác nhận chuyển bàn/));
    fireEvent.click(within(modal).getByRole('button', { name: 'Xác nhận chuyển' }));
  };

  it('loads unfiltered destinations, explains scope, and requires explicit confirmation', async () => {
    renderWithProviders(<TableManagementPage />);
    await screen.findByRole('button', { name: 'Chuyển bàn' });
    fireEvent.change(screen.getAllByRole('combobox')[1]!, { target: { value: 'Occupied' } });
    await waitFor(() => expect(mockApiFetch).toHaveBeenCalledWith('/api/tables?status=Occupied'));
    mockApiFetch.mockClear();
    const modal = await openTransfer();
    expect(mockApiFetch).toHaveBeenCalledWith('/api/tables');
    expect(within(modal).getByText(/Đây không phải chọn bàn cho đơn mới/)).toBeTruthy();
    expect(within(modal).queryByRole('option', { name: /3 · Terrace/ })).toBeNull();
    expect(within(modal).getByRole('button', { name: 'Xác nhận chuyển' })).toBeDisabled();
    fireEvent.change(within(modal).getByRole('combobox'), { target: { value: 't-1' } });
    expect(within(modal).getByRole('button', { name: 'Xác nhận chuyển' })).toBeDisabled();
    fireEvent.click(within(modal).getByRole('button', { name: 'Hủy' }));
    expect(mockApiFetch.mock.calls.some(([url]) => String(url).endsWith('/transfer'))).toBe(false);
  });

  it('posts the source, destination and reservation scope and refreshes both lists', async () => {
    renderWithProviders(<TableManagementPage />);
    const modal = await openTransfer();
    fireEvent.click(within(modal).getByLabelText(/Chuyển cả đặt bàn/));
    mockApiFetch.mockClear();
    confirm(modal);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(mockApiFetch).toHaveBeenCalledWith('/api/table-sessions/session-1/transfer', {
      method: 'POST', body: JSON.stringify({ source_table_id: 't-2', destination_table_id: 't-1', transfer_reservation: true }),
    });
    expect(mockApiFetch).toHaveBeenCalledWith('/api/tables');
    expect(mockApiFetch).toHaveBeenCalledWith('/api/orders?limit=200&order_type=dine_in');
    expect(screen.getByRole('status')).toHaveTextContent('Đã chuyển bàn 2 → 1');
  });

  it('persists success across remounts and isolates feedback by tenant and user', async () => {
    const view = renderWithProviders(<TableManagementPage />);
    confirm(await openTransfer());
    await screen.findByText(/Đã chuyển bàn 2 → 1/);
    view.unmount();
    const remount = renderWithProviders(<TableManagementPage />);
    expect(await screen.findByRole('status')).toHaveTextContent('Đã chuyển bàn 2 → 1');
    remount.unmount();
    saveClientSession('other-token', { id: 'staff-2', name: 'Other', role: 'staff', tenantId: 'cafe-1' });
    const other = renderWithProviders(<TableManagementPage />);
    await screen.findByText('2');
    expect(screen.queryByText(/Đã chuyển bàn/)).toBeNull();
    other.unmount();
    saveClientSession('tenant-token', { id: 'staff-1', name: 'Staff', role: 'staff', tenantId: 'cafe-2' });
    renderWithProviders(<TableManagementPage />);
    await screen.findByText('2');
    expect(screen.queryByText(/Đã chuyển bàn/)).toBeNull();
  });

  it('retains a readable server conflict without claiming success', async () => {
    const initial = mockApiFetch.getMockImplementation()!;
    mockApiFetch.mockImplementation((url: string, options: unknown) => url.endsWith('/transfer')
      ? Promise.reject(new Error('Destination table is not available')) : initial(url, options));
    const view = renderWithProviders(<TableManagementPage />);
    confirm(await openTransfer());
    await waitFor(() => expect(screen.getAllByRole('alert').some(el => el.textContent?.includes('Destination table is not available'))).toBe(true));
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.queryByText(/Đã chuyển bàn/)).toBeNull();
    expect(within(screen.getByRole('dialog')).getByRole('button', { name: 'Xác nhận chuyển' })).toBeDisabled();
    view.unmount();
    renderWithProviders(<TableManagementPage />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Destination table is not available');
  });

  it('blocks repeated submissions and keeps the dialog open while pending', async () => {
    let resolveTransfer: ((value: { success: boolean }) => void) | undefined;
    const initial = mockApiFetch.getMockImplementation()!;
    mockApiFetch.mockImplementation((url: string, options: unknown) => url.endsWith('/transfer')
      ? new Promise<{ success: boolean }>(resolve => { resolveTransfer = resolve; }) : initial(url, options));
    renderWithProviders(<TableManagementPage />);
    const modal = await openTransfer();
    confirm(modal);
    fireEvent.click(within(modal).getByRole('button', { name: 'Đang chuyển…' }));
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(within(modal).getByRole('button', { name: 'Hủy' })).toBeDisabled();
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(mockApiFetch.mock.calls.filter(([url]) => String(url).endsWith('/transfer'))).toHaveLength(1);
    resolveTransfer?.({ success: true });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    const request = mockApiFetch.mock.calls.find(([url]) => String(url).endsWith('/transfer'));
    expect(JSON.parse(request?.[1].body)).toEqual({ source_table_id: 't-2', destination_table_id: 't-1', transfer_reservation: false });
  });

  it('does not expose staff transfer actions to customer accounts', async () => {
    saveClientSession('customer-token', { id: 'customer-1', name: 'Guest', role: 'customer', tenantId: 'cafe-1' });
    renderWithProviders(<TableManagementPage />);
    await screen.findByText('2');
    expect(screen.queryByRole('button', { name: 'Chuyển bàn' })).toBeNull();
  });

  it('fails closed when there is no transferable source session', async () => {
    const initial = mockApiFetch.getMockImplementation()!;
    mockApiFetch.mockImplementation((url: string, options: unknown) => url.startsWith('/api/table-sessions')
      ? Promise.resolve({ success: true, data: [{ id: 'closed', table_id: 't-2', status: 'closed' }] }) : initial(url, options));
    renderWithProviders(<TableManagementPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Chuyển bàn' }));
    const modal = screen.getByRole('dialog');
    await within(modal).findByText(/Không tìm thấy một phiên phục vụ hợp lệ/);
    expect(within(modal).getByRole('button', { name: 'Xác nhận chuyển' })).toBeDisabled();
  });
});
