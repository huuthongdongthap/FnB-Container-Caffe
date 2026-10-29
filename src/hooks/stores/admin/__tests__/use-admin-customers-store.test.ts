import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useAdminCustomersStore } from '@/hooks/stores/admin/use-admin-customers-store';

const mockApiFetch = vi.fn();

vi.mock('@/lib/api-client', () => ({
  apiFetch: (...args: unknown[]) => mockApiFetch(...args),
}));

function mockSuccess(data: unknown) {
  mockApiFetch.mockResolvedValue(data);
}

function mockError(message: string) {
  mockApiFetch.mockRejectedValue(new Error(message));
}

describe('useAdminCustomersStore', () => {
  beforeEach(() => {
    useAdminCustomersStore.setState({ customers: [], totalCount: 0, loading: false, error: null });
    vi.restoreAllMocks();
    mockApiFetch.mockReset();
  });

  it('starts with empty customers, loading=false, error=null', () => {
    const s = useAdminCustomersStore.getState();
    expect(s.customers).toEqual([]);
    expect(s.loading).toBe(false);
    expect(s.error).toBeNull();
  });

  it('fetchCustomers(): populates customers on success', async () => {
    const fakeCustomers = [
      { id: 'C001', name: 'Nguyen Van A', phone: '0901234567', totalOrders: 5, totalSpent: 500000, tier: 'VIP', lastVisit: '2026-06-30' },
    ];
    mockSuccess({ customers: fakeCustomers, totalCount: 1 });

    await useAdminCustomersStore.getState().fetchCustomers();

    const s = useAdminCustomersStore.getState();
    expect(s.customers).toEqual(fakeCustomers);
    expect(s.totalCount).toBe(1);
    expect(s.loading).toBe(false);
    expect(s.error).toBeNull();
  });

  it('fetchCustomers(): normalizes D1 snake_case rows from /api/admin/customers', async () => {
    mockSuccess({
      success: true,
      data: [
        {
          id: 'CUST_1',
          name: 'Pham Minh D',
          phone: '0912345678',
          tier: 'VIP',
          visit_count: 8,
          total_spent: 920000,
          created_at: '2026-10-10T12:00:00Z',
        },
      ],
      pagination: { page: 1, limit: 50, total: 9 },
    });

    await useAdminCustomersStore.getState().fetchCustomers();

    const s = useAdminCustomersStore.getState();
    expect(s.totalCount).toBe(9);
    expect(s.customers[0]).toMatchObject({
      id: 'CUST_1',
      name: 'Pham Minh D',
      phone: '0912345678',
      tier: 'VIP',
      totalOrders: 8,
      totalSpent: 920000,
      lastVisit: '2026-10-10T12:00:00Z',
    });
  });

  it('fetchCustomers(): sets error on failure', async () => {
    mockError('Không thể tải danh sách khách hàng');

    await useAdminCustomersStore.getState().fetchCustomers();

    expect(useAdminCustomersStore.getState().error).toContain('Không thể tải danh sách khách hàng');
  });

  it('fetchCustomers(): passes search params', async () => {
    mockSuccess({ customers: [], totalCount: 0 });

    await useAdminCustomersStore.getState().fetchCustomers(2, 'test');

    expect(mockApiFetch).toHaveBeenCalled();
    const url = mockApiFetch.mock.calls[0]![0] as string;
    expect(url).toContain('page=2');
    expect(url).toContain('search=test');
  });
});

import { invalidateClientSession, saveClientSession } from '@/lib/client-session';
const customer = { id: 'persisted-1', name: 'A', phone: '0901234567', tier: 'bronze', totalOrders: 0, totalSpent: 0, lastVisit: '' };
const draft = { name: 'B', phone: '0901234568', tier: 'gold' };
const deferred = () => { let resolve!: (body: unknown) => void; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
describe('server-confirmed customer mutations', () => {
  beforeEach(() => {
    mockApiFetch.mockReset();
    invalidateClientSession();
    saveClientSession('owner-a', { id: 'a', role: 'owner', name: 'A' });
    useAdminCustomersStore.setState({ customers: [customer], totalCount: 1, pending: {}, loading: false, error: null });
  });
  it.each(['add', 'update', 'delete'])('keeps persisted state when %s returns 503', async operation => {
    mockApiFetch.mockRejectedValue(new Error('503 unavailable'));
    const store = useAdminCustomersStore.getState();
    const ok = operation === 'add' ? await store.addCustomer(draft) : operation === 'update'
      ? await store.updateCustomer(customer.id, draft) : await store.deleteCustomer(customer.id);
    expect(ok).toBe(false);
    expect(useAdminCustomersStore.getState().customers).toEqual([customer]);
    expect(useAdminCustomersStore.getState().error).toContain('Chưa xác nhận');
  });
  it('retries a lost response with the same key and uses a new key after payload changes', async () => {
    mockApiFetch.mockRejectedValue(new Error('Lost response'));
    await useAdminCustomersStore.getState().addCustomer(draft);
    await useAdminCustomersStore.getState().addCustomer(draft);
    await useAdminCustomersStore.getState().addCustomer({ ...draft, name: 'Changed' });
    const keys = mockApiFetch.mock.calls.map(call => call[1].headers['Idempotency-Key']);
    expect(keys[0]).toBeTruthy(); expect(keys[1]).toBe(keys[0]); expect(keys[2]).not.toBe(keys[0]);
    mockApiFetch.mockResolvedValue({ success: true, data: { ...customer, ...draft, id: 'persisted-2' } });
    expect(await useAdminCustomersStore.getState().addCustomer(draft)).toBe(true);
    expect(useAdminCustomersStore.getState().customers.map(row => row.id)).toEqual(['persisted-2', 'persisted-1']);
  });
  it('rejects missing server IDs and explicit failure bodies', async () => {
    for (const body of [{ success: true }, { success: false, data: { id: 'fake' } }]) {
      mockApiFetch.mockResolvedValueOnce(body);
      expect(await useAdminCustomersStore.getState().addCustomer(draft)).toBe(false);
    }
    expect(useAdminCustomersStore.getState().totalCount).toBe(1);
  });
  it('blocks duplicate writes while allowing another entity and ignores a late GET', async () => {
    const read = deferred(); const write = deferred();
    mockApiFetch.mockReturnValueOnce(read.promise).mockReturnValueOnce(write.promise);
    const oldRead = useAdminCustomersStore.getState().fetchCustomers();
    const update = useAdminCustomersStore.getState().updateCustomer(customer.id, draft);
    expect(await useAdminCustomersStore.getState().deleteCustomer(customer.id)).toBe(false);
    expect(mockApiFetch).toHaveBeenCalledTimes(2);
    write.resolve({ success: true, data: { ...customer, ...draft } }); await update;
    read.resolve({ success: true, data: [customer] }); await oldRead;
    expect(useAdminCustomersStore.getState().customers[0]?.name).toBe('B');
  });
  it('returns false from A’s late write without changing B’s state', async () => {
    const write = deferred(); mockApiFetch.mockReturnValueOnce(write.promise);
    const old = useAdminCustomersStore.getState().addCustomer(draft);
    saveClientSession('owner-b', { id: 'b', role: 'owner', name: 'B' });
    write.resolve({ success: true, data: { ...customer, id: 'from-a' } });
    expect(await old).toBe(false);
    expect(useAdminCustomersStore.getState().customers).toEqual([]);
    expect(useAdminCustomersStore.getState().pending).toEqual({});
  });
});
