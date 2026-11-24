import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderWithProviders, screen, fireEvent, waitFor } from '@/test-utils';
import { ApiClientError } from '@/lib/api-client';
import { ShiftHandoverModal } from '@/components/admin/ShiftHandoverModal';
import { ShiftsTab } from '@/pages/admin/staff-shifts-tab';

const mockApiFetch = vi.fn();

vi.mock('@/lib/api-client', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api-client')>('@/lib/api-client');
  return {
    ...actual,
    apiFetch: (...args: unknown[]) => mockApiFetch(...args),
  };
});

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key?: string, opts?: { defaultValue?: string }) => opts?.defaultValue ?? key ?? '',
  }),
  Trans: ({ children }: { children: React.ReactNode }) => children,
}));

let mockActor: { id: string; name: string; role: string; tenantId?: string } = {
  id: 'staff_1',
  name: 'Alice',
  role: 'cashier',
  tenantId: 'default',
};

const mockFetchMe = vi.fn().mockResolvedValue(undefined);
const mockFetchStaff = vi.fn();
const MOCK_STAFF_LIST = [
  { id: 'staff_1', name: 'Alice', role: 'cashier', isActive: true },
  { id: 'staff_2', name: 'Bob', role: 'barista', isActive: true },
];

vi.mock('@/hooks/stores/use-auth-store', () => ({
  useAuthStore: (
    selector?: (s: { user: typeof mockActor | null; sessionVersion: number; fetchMe: () => Promise<void> }) => unknown,
  ) => {
    const state = { user: mockActor, sessionVersion: 1, fetchMe: mockFetchMe };
    return selector ? selector(state) : state;
  },
}));

vi.mock('@/hooks/stores/admin/use-admin-staff-store', () => ({
  useAdminStaffStore: () => ({
    staff: MOCK_STAFF_LIST,
    fetchStaff: mockFetchStaff,
  }),
}));

describe('Shift Handover Flow (#102)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockActor = { id: 'staff_1', name: 'Alice', role: 'cashier', tenantId: 'default' };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('handles unopened shift by allowing clock-in with scheduled_shift_id and opening_cash', async () => {
    const scheduledShift = {
      id: '41',
      staff_id: 'staff_1',
      staff_name: 'Alice',
      clock_in: null,
      clock_out: null,
      hours_worked: null,
      date: '2026-11-21',
      notes: null,
      attendance_state: 'scheduled',
      start_time: '07:00',
    };
    const openedShift = {
      ...scheduledShift,
      clock_in: '2026-11-21T01:00:00.000Z',
      opening_cash: 300_000,
      attendance_state: 'active',
    };

    let clockedIn = false;
    mockApiFetch.mockImplementation(async (path: string, opts?: RequestInit) => {
      if (path === '/api/shifts/today') {
        return { success: true, data: [clockedIn ? openedShift : scheduledShift] };
      }
      if (path === '/api/shifts/clock-in' && opts?.method === 'POST') {
        clockedIn = true;
        return { success: true, data: openedShift };
      }
      if (path === '/api/shifts/41/reconciliation') {
        throw new ApiClientError({ status: 404, message: 'Shift reconciliation not found' });
      }
      return { success: true, data: [] };
    });

    renderWithProviders(<ShiftHandoverModal isOpen onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByTestId('handover-no-active-shift')).toBeTruthy();
    });

    const openingInput = screen.getByLabelText(/Opening Cash Float/i);
    fireEvent.change(openingInput, { target: { value: '300000' } });

    const clockInBtn = screen.getByRole('button', { name: /Clock In/i });
    fireEvent.click(clockInBtn);

    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledWith(
        '/api/shifts/clock-in',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            staff_id: 'staff_1',
            opening_cash: 300000,
            scheduled_shift_id: '41',
          }),
        }),
      );
    });

    await waitFor(() => {
      expect(screen.getByTestId('handover-opened')).toBeTruthy();
    });
  });

  it('surfaces overnight active shift and completes reconcile + clock-out end-to-end', async () => {
    const overnightShift = {
      id: '55',
      staff_id: 'staff_1',
      staff_name: 'Alice',
      clock_in: '2026-11-20T15:00:00.000Z',
      clock_out: null,
      hours_worked: null,
      date: '2026-11-20',
      opening_cash: 200_000,
      notes: null,
      attendance_state: 'active',
    };

    mockApiFetch.mockImplementation(async (path: string, opts?: RequestInit) => {
      if (path === '/api/shifts/today') {
        return { success: true, data: [overnightShift] };
      }
      if (path === '/api/shifts/55/reconciliation') {
        throw new ApiClientError({ status: 404, message: 'Not found' });
      }
      if (path === '/api/shifts/55/reconcile' && opts?.method === 'POST') {
        return {
          success: true,
          data: {
            id: 'rec_55',
            shift_id: '55',
            staff_id: 'staff_1',
            opening_float: 200_000,
            expected_cash: 500_000,
            actual_cash: 500_000,
            variance: 0,
            variance_status: 'balanced',
            cash_payment_total: 300_000,
            cash_payout_total: 0,
            notes: null,
            created_at: '2026-11-21T01:00:00.000Z',
          },
        };
      }
      if (path === '/api/shifts/clock-out' && opts?.method === 'POST') {
        return {
          success: true,
          data: {
            ...overnightShift,
            clock_out: '2026-11-21T01:00:05.000Z',
            hours_worked: 10,
            attendance_state: 'completed',
          },
        };
      }
      return { success: true, data: [] };
    });

    const onCompleted = vi.fn();
    renderWithProviders(<ShiftHandoverModal isOpen onClose={vi.fn()} onCompleted={onCompleted} />);

    await waitFor(() => {
      expect(screen.getByTestId('overnight-shift-badge')).toBeTruthy();
    });

    const denom500k = screen.getByLabelText('Denomination 500000');
    fireEvent.change(denom500k, { target: { value: '1' } });

    fireEvent.click(screen.getByTestId('submit-handover-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('handover-completed')).toBeTruthy();
    });

    expect(mockApiFetch).toHaveBeenCalledWith(
      '/api/shifts/55/reconcile',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          opening_float: 200000,
          denominations: { denominations: [{ denomination: 500000, count: 1 }] },
          remitted_cash: 0,
          closing_float: 500000,
        }),
      }),
    );
    expect(mockApiFetch).toHaveBeenCalledWith(
      '/api/shifts/clock-out',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ staff_id: 'staff_1', shift_id: '55' }),
      }),
    );
    expect(onCompleted).toHaveBeenCalledTimes(1);
  });

  it('blocks clock-out when cash reconciliation fails', async () => {
    const activeShift = {
      id: '60',
      staff_id: 'staff_1',
      staff_name: 'Alice',
      clock_in: '2026-11-21T01:00:00.000Z',
      clock_out: null,
      hours_worked: null,
      date: '2026-11-21',
      opening_cash: 200_000,
      notes: null,
      attendance_state: 'active',
    };

    mockApiFetch.mockImplementation(async (path: string, opts?: RequestInit) => {
      if (path === '/api/shifts/today') return { success: true, data: [activeShift] };
      if (path === '/api/shifts/60/reconciliation') {
        throw new ApiClientError({ status: 404, message: 'Not found' });
      }
      if (path === '/api/shifts/60/reconcile' && opts?.method === 'POST') {
        throw new ApiClientError({ status: 409, message: 'Shift cash ledger changed concurrently' });
      }
      return { success: true, data: null };
    });

    renderWithProviders(<ShiftHandoverModal isOpen onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByTestId('submit-handover-btn')).toBeTruthy();
    });

    fireEvent.click(screen.getByTestId('submit-handover-btn'));
    await waitFor(() => {
      expect(screen.getByTestId('confirm-zero-cash-btn')).toBeTruthy();
    });
    fireEvent.click(screen.getByTestId('confirm-zero-cash-btn'));

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toContain('Shift cash ledger changed concurrently');
    });

    const clockOutCalls = mockApiFetch.mock.calls.filter(([p]) => p === '/api/shifts/clock-out');
    expect(clockOutCalls).toHaveLength(0);
  });

  it('supports safe retry when reconcile succeeds but clock-out fails without double-reconciling', async () => {
    const activeShift = {
      id: '61',
      staff_id: 'staff_1',
      staff_name: 'Alice',
      clock_in: '2026-11-21T01:00:00.000Z',
      clock_out: null,
      hours_worked: null,
      date: '2026-11-21',
      opening_cash: 100_000,
      notes: null,
      attendance_state: 'active',
    };

    let clockOutAttempts = 0;
    mockApiFetch.mockImplementation(async (path: string, opts?: RequestInit) => {
      if (path === '/api/shifts/today') return { success: true, data: [activeShift] };
      if (path === '/api/shifts/61/reconciliation') {
        throw new ApiClientError({ status: 404, message: 'Not found' });
      }
      if (path === '/api/shifts/61/reconcile' && opts?.method === 'POST') {
        return {
          success: true,
          data: {
            id: 'rec_61',
            shift_id: '61',
            staff_id: 'staff_1',
            opening_float: 100_000,
            expected_cash: 100_000,
            actual_cash: 100_000,
            variance: 0,
            variance_status: 'balanced',
            cash_payment_total: 0,
            cash_payout_total: 0,
            notes: null,
            created_at: '2026-11-21T05:00:00.000Z',
          },
        };
      }
      if (path === '/api/shifts/clock-out' && opts?.method === 'POST') {
        clockOutAttempts += 1;
        if (clockOutAttempts === 1) {
          throw new ApiClientError({ status: 500, message: 'Temporary clock-out failure' });
        }
        return {
          success: true,
          data: { ...activeShift, clock_out: '2026-11-21T05:01:00.000Z', hours_worked: 4 },
        };
      }
      return { success: true, data: null };
    });

    renderWithProviders(<ShiftHandoverModal isOpen onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByTestId('submit-handover-btn')).toBeTruthy();
    });

    // First click: prompts 0đ confirmation, then confirm triggers reconcile (succeeds) + clock-out (fails)
    fireEvent.click(screen.getByTestId('submit-handover-btn'));
    await waitFor(() => {
      expect(screen.getByTestId('confirm-zero-cash-btn')).toBeTruthy();
    });
    fireEvent.click(screen.getByTestId('confirm-zero-cash-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('reconciliation-recorded')).toBeTruthy();
      expect(screen.getByRole('alert').textContent).toContain('Temporary clock-out failure');
    });

    // Retry click: must NOT call /reconcile again, only /clock-out
    fireEvent.click(screen.getByTestId('submit-handover-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('handover-completed')).toBeTruthy();
    });

    const reconcileCalls = mockApiFetch.mock.calls.filter(([p]) => p === '/api/shifts/61/reconcile');
    const clockOutCalls = mockApiFetch.mock.calls.filter(([p]) => p === '/api/shifts/clock-out');
    expect(reconcileCalls).toHaveLength(1);
    expect(clockOutCalls).toHaveLength(2);
  });

  it('surfaces 403 unauthorized error clearly without allowing handover', async () => {
    mockApiFetch.mockRejectedValueOnce(new ApiClientError({ status: 403, message: 'Forbidden tenant attendance' }));

    renderWithProviders(<ShiftHandoverModal isOpen onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toContain('Forbidden tenant attendance');
    });
    expect(screen.queryByTestId('submit-handover-btn')).toBeNull();
  });

  it('disables handover submit when cash reconciliation is 501 disabled', async () => {
    const activeShift = {
      id: '70',
      staff_id: 'staff_1',
      staff_name: 'Alice',
      clock_in: '2026-11-21T01:00:00.000Z',
      clock_out: null,
      hours_worked: null,
      date: '2026-11-21',
      opening_cash: 100_000,
      notes: null,
      attendance_state: 'active',
    };

    mockApiFetch.mockImplementation(async (path: string) => {
      if (path === '/api/shifts/today') return { success: true, data: [activeShift] };
      if (path === '/api/shifts/70/reconciliation') {
        throw new ApiClientError({
          status: 501,
          code: 'PILOT_CASH_RECONCILIATION_DISABLED',
          message: 'Cash reconciliation is unavailable for the attendance pilot',
        });
      }
      return { success: true, data: [] };
    });

    renderWithProviders(<ShiftHandoverModal isOpen onClose={vi.fn()} />);

    await waitFor(() => {
      const btn = screen.getByTestId('submit-handover-btn') as HTMLButtonElement;
      expect(btn.disabled).toBe(true);
    });
    expect(screen.getByRole('alert').textContent).toContain('Cash reconciliation is unavailable');
  });

  it('wires ShiftsTab clock-in with scheduled_shift_id and opening_cash and opens handover modal on End Shift', async () => {
    mockActor = { id: 'mgr_1', name: 'Manager', role: 'manager', tenantId: 'default' };
    const todayRows = [
      {
        id: '80',
        staff_id: 'staff_1',
        staff_name: 'Alice',
        clock_in: '2026-11-21T01:00:00.000Z',
        clock_out: null,
        hours_worked: null,
        date: '2026-11-21',
        opening_cash: 250_000,
        notes: null,
        attendance_state: 'active',
      },
      {
        id: '81',
        staff_id: 'staff_1',
        staff_name: 'Alice',
        clock_in: null,
        clock_out: null,
        hours_worked: null,
        date: '2026-11-21',
        opening_cash: 0,
        notes: null,
        attendance_state: 'scheduled',
        start_time: '14:00',
      },
    ];

    mockApiFetch.mockImplementation(async (path: string, opts?: RequestInit) => {
      if (path === '/api/shifts/today') return { success: true, data: todayRows };
      if (path.startsWith('/api/shifts?')) return { success: true, data: todayRows };
      if (path === '/api/shifts/clock-in' && opts?.method === 'POST') {
        return { success: true, data: { ...todayRows[1], clock_in: '2026-11-21T07:00:00.000Z', opening_cash: 150_000 } };
      }
      if (path === '/api/shifts/80/reconciliation') {
        throw new ApiClientError({ status: 404, message: 'Not found' });
      }
      return { success: true, data: [] };
    });

    renderWithProviders(<ShiftsTab />);

    await waitFor(() => {
      expect(screen.getByTestId('end-shift-btn-80')).toBeTruthy();
    });

    // Test clock-in form binds scheduled_shift_id + opening_cash
    fireEvent.change(screen.getByLabelText(/Scheduled Shift/i), { target: { value: '81' } });
    fireEvent.change(screen.getByLabelText(/Opening Cash/i), { target: { value: '150000' } });
    fireEvent.click(screen.getByTestId('shifts-tab-clock-in-btn'));

    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledWith(
        '/api/shifts/clock-in',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            staff_id: 'staff_1',
            opening_cash: 150000,
            scheduled_shift_id: '81',
          }),
        }),
      );
    });

    // Click End Shift on active shift #80 -> opens ShiftHandoverModal
    fireEvent.click(screen.getByTestId('end-shift-btn-80'));

    await waitFor(() => {
      expect(screen.getByTestId('shift-handover-modal')).toBeTruthy();
    });
  });

  it('syncs preset opening_cash and locks override for non-manager selecting a scheduled shift', async () => {
    mockActor = { id: 'staff_1', name: 'Alice', role: 'cashier', tenantId: 'default' };
    const scheduledRow = {
      id: '92',
      staff_id: 'staff_1',
      staff_name: 'Alice',
      clock_in: null,
      clock_out: null,
      hours_worked: null,
      date: '2026-11-21',
      opening_cash: 300_000,
      notes: null,
      attendance_state: 'scheduled',
      start_time: '08:00',
    };

    mockApiFetch.mockImplementation(async (path: string, opts?: RequestInit) => {
      if (path === '/api/shifts/today') return { success: true, data: [scheduledRow] };
      if (path.startsWith('/api/shifts?')) return { success: true, data: [scheduledRow] };
      if (path === '/api/shifts/clock-in' && opts?.method === 'POST') {
        return { success: true, data: { ...scheduledRow, clock_in: '2026-11-21T01:00:00.000Z' } };
      }
      return { success: true, data: [] };
    });

    renderWithProviders(<ShiftsTab />);

    await waitFor(() => {
      expect(screen.getByLabelText(/Scheduled Shift/i)).toBeTruthy();
    });

    fireEvent.change(screen.getByLabelText(/Scheduled Shift/i), { target: { value: '92' } });
    const openingInput = screen.getByLabelText(/Opening Cash/i) as HTMLInputElement;
    expect(openingInput.value).toBe('300000');
    expect(openingInput.disabled).toBe(true);

    fireEvent.click(screen.getByTestId('shifts-tab-clock-in-btn'));

    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledWith(
        '/api/shifts/clock-in',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            staff_id: 'staff_1',
            scheduled_shift_id: '92',
          }),
        }),
      );
    });
  });

  it('rejects out-of-range remittedCashInput without calling reconcile API', async () => {
    const activeShift = {
      id: '55',
      staff_id: 'staff_1',
      staff_name: 'Alice',
      clock_in: '2026-11-21T01:00:00.000Z',
      clock_out: null,
      hours_worked: null,
      date: '2026-11-21',
      opening_cash: 200_000,
      notes: null,
      attendance_state: 'active',
    };

    mockApiFetch.mockImplementation(async (path: string) => {
      if (path === '/api/shifts/today') return { success: true, data: [activeShift] };
      if (path === '/api/shifts/55/reconciliation') {
        throw new ApiClientError({ status: 404, message: 'Shift reconciliation not found' });
      }
      return { success: true, data: [] };
    });

    renderWithProviders(<ShiftHandoverModal isOpen onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByTestId('remitted-cash-input')).toBeTruthy();
    });

    // Count 200,000 VND (1 x 200,000)
    const denom200k = screen.getByLabelText('Denomination 200000');
    fireEvent.change(denom200k, { target: { value: '1' } });

    // Enter remitted cash > countedTotal (300,000 > 200,000)
    fireEvent.change(screen.getByTestId('remitted-cash-input'), { target: { value: '300000' } });
    expect(screen.getByTestId('closing-float-display').textContent).toContain('Invalid');

    fireEvent.click(screen.getByTestId('submit-handover-btn'));

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toContain('Remitted cash must be between 0');
    });

    // Enter negative remitted cash (-1000)
    fireEvent.change(screen.getByTestId('remitted-cash-input'), { target: { value: '-1000' } });
    fireEvent.click(screen.getByTestId('submit-handover-btn'));

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toContain('Remitted cash must be between 0');
    });

    expect(mockApiFetch).not.toHaveBeenCalledWith(
      '/api/shifts/55/reconcile',
      expect.anything(),
    );
  });

  it('recovers from 409 ambiguous cash payments by assigning them to the shift and retrying reconciliation', async () => {
    const activeShift = {
      id: '77',
      staff_id: 'staff_1',
      staff_name: 'Alice',
      clock_in: '2026-11-21T01:00:00.000Z',
      clock_out: null,
      hours_worked: null,
      date: '2026-11-21',
      opening_cash: 100_000,
      notes: null,
      attendance_state: 'active',
    };

    let reconcileAttempts = 0;
    mockApiFetch.mockImplementation(async (path: string, opts?: RequestInit) => {
      if (path === '/api/shifts/today') return { success: true, data: [activeShift] };
      if (path === '/api/shifts/77/reconciliation') {
        throw new ApiClientError({ status: 404, message: 'Not found' });
      }
      if (path === '/api/shifts/77/reconcile' && opts?.method === 'POST') {
        reconcileAttempts += 1;
        if (reconcileAttempts === 1) {
          throw new ApiClientError({
            status: 409,
            code: 'AMBIGUOUS_CASH_PAYMENTS',
            ambiguous_payment_ids: ['pay_amb_1', 'pay_amb_2'],
            message: 'Ambiguous cash payment responsibility; assign collecting shift before reconciliation',
          });
        }
        return {
          success: true,
          data: {
            id: 'rec_77',
            shift_id: '77',
            staff_id: 'staff_1',
            opening_float: 100_000,
            expected_cash: 150_000,
            actual_cash: 150_000,
            variance: 0,
            variance_status: 'balanced',
            cash_payment_total: 50_000,
            cash_payout_total: 0,
            notes: null,
            created_at: '2026-11-21T05:00:00.000Z',
          },
        };
      }
      if (path === '/api/shifts/77/assign-cash-payments' && opts?.method === 'POST') {
        return { success: true, data: { assigned: ['pay_amb_1', 'pay_amb_2'] } };
      }
      if (path === '/api/shifts/clock-out' && opts?.method === 'POST') {
        return {
          success: true,
          data: { ...activeShift, clock_out: '2026-11-21T05:01:00.000Z', hours_worked: 4 },
        };
      }
      return { success: true, data: [] };
    });

    renderWithProviders(<ShiftHandoverModal isOpen onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByTestId('submit-handover-btn')).toBeTruthy();
    });

    const denom100k = screen.getByLabelText('Denomination 100000');
    const denom50k = screen.getByLabelText('Denomination 50000');
    fireEvent.change(denom100k, { target: { value: '1' } });
    fireEvent.change(denom50k, { target: { value: '1' } });

    fireEvent.click(screen.getByTestId('submit-handover-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('ambiguous-cash-recovery')).toBeTruthy();
      expect(screen.getByTestId('ambiguous-cash-recovery').textContent).toContain('pay_amb_1');
    });

    fireEvent.click(screen.getByTestId('assign-ambiguous-cash-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('handover-completed')).toBeTruthy();
    });

    expect(mockApiFetch).toHaveBeenCalledWith(
      '/api/shifts/77/assign-cash-payments',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ payment_ids: ['pay_amb_1', 'pay_amb_2'] }),
      }),
    );
    expect(reconcileAttempts).toBe(2);
  });
});
