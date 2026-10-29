import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAdminOrdersStore } from '@/hooks/stores/admin/use-admin-orders-store';
import { useAdminCustomersStore } from '@/hooks/stores/admin/use-admin-customers-store';
import { useAdminStaffStore } from '@/hooks/stores/admin/use-admin-staff-store';
import { apiFetch } from '@/lib/api-client';
import { invalidateClientSession, saveClientSession } from '@/lib/client-session';

vi.mock('@/lib/api-client', () => ({ apiFetch: vi.fn() }));
const staff = { id: 'a', role: 'owner', name: 'A', tenantId: 'cafe-a' };
const order = { id: 'private-a', customer: 'A private customer', items: 1, payment: 'payos', createdAt: '2026-10-23', total: 20_000, status: 'pending' };
beforeEach(() => { vi.clearAllMocks(); invalidateClientSession(); });

describe('private store session boundary', () => {
  it('clears Orders, Customers and Staff immediately on logout', () => {
    saveClientSession('token-a', staff);
    useAdminOrdersStore.setState({ orders: [order] });
    useAdminCustomersStore.setState({ error: 'Private A error' });
    useAdminStaffStore.setState({ error: 'Private staff error' });
    invalidateClientSession();
    expect(useAdminOrdersStore.getState().orders).toEqual([]);
    expect(useAdminCustomersStore.getState().error).toBeNull();
    expect(useAdminStaffStore.getState().error).toBeNull();
  });
  it('rejects A’s late response after B logs in and B’s request is forbidden', async () => {
    saveClientSession('token-a', staff);
    let resolve!: (value: unknown) => void;
    vi.mocked(apiFetch).mockImplementationOnce(() => new Promise(r => { resolve = r; }));
    const old = useAdminOrdersStore.getState().fetchOrders();
    invalidateClientSession();
    saveClientSession('token-b', { ...staff, id: 'b', tenantId: 'cafe-b' });
    vi.mocked(apiFetch).mockRejectedValueOnce(new Error('Forbidden B'));
    await useAdminOrdersStore.getState().fetchOrders();
    resolve({ orders: [order] }); await old;
    expect(useAdminOrdersStore.getState().orders).toEqual([]);
    expect(useAdminOrdersStore.getState().error).toBe('Forbidden B');
  });
  it('does not launch a follow-up fetch from a retired mutation', async () => {
    saveClientSession('token-a', staff);
    let resolve!: (value: unknown) => void;
    vi.mocked(apiFetch).mockImplementationOnce(() => new Promise(r => { resolve = r; }));
    const old = useAdminOrdersStore.getState().updateOrderStatus('private-a', 'ready');
    saveClientSession('token-b', { ...staff, id: 'b' });
    resolve({ success: true }); await old;
    expect(apiFetch).toHaveBeenCalledTimes(1);
  });
  it('does not retry an older failed write with the next operator’s credentials', async () => {
    saveClientSession('token-a', staff);
    let reject!: (reason: unknown) => void;
    vi.mocked(apiFetch).mockImplementationOnce(() => new Promise((_resolve, r) => { reject = r; }));
    const old = useAdminOrdersStore.getState().updateOrderStatus('private-a', 'ready');
    saveClientSession('token-b', { ...staff, id: 'b' });
    reject(new Error('Older write failed')); await old;
    expect(apiFetch).toHaveBeenCalledTimes(1);
    expect(useAdminOrdersStore.getState().error).toBeNull();
  });
  it('retires in-flight responses on a cross-tab session event', async () => {
    saveClientSession('token-a', staff);
    let resolve!: (value: unknown) => void;
    vi.mocked(apiFetch).mockImplementationOnce(() => new Promise(r => { resolve = r; }));
    const old = useAdminOrdersStore.getState().fetchOrders();
    localStorage.removeItem('aura_auth_token'); localStorage.removeItem('mobile_token');
    window.dispatchEvent(new StorageEvent('storage', { key: 'aura_auth_token', oldValue: 'token-a', newValue: null }));
    resolve({ orders: [order] }); await old;
    expect(useAdminOrdersStore.getState().orders).toEqual([]);
  });
});
