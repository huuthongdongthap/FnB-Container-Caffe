import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useOfflineSync } from '../use-offline-sync';
import { offlineDb } from '@/lib/offline-db';

vi.mock('@/lib/offline-db', () => ({
  offlineDb: {
    saveOrder: vi.fn(),
    getPendingOrders: vi.fn(),
    removeOrder: vi.fn(),
    clearOrders: vi.fn(),
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

describe('useOfflineSync', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    (offlineDb.getPendingOrders as any).mockResolvedValue([]);
    (offlineDb.saveOrder as any).mockResolvedValue('local_test_123');
    (offlineDb.removeOrder as any).mockResolvedValue(undefined);
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('initializes with default online state and pending count', async () => {
    (offlineDb.getPendingOrders as any).mockResolvedValue([
      { localId: 'local_1', orderData: {}, createdAt: Date.now(), synced: false },
    ]);

    const { result } = renderHook(() => useOfflineSync());

    await act(async () => {
      await result.current.refreshPendingCount();
    });

    expect(result.current.pendingCount).toBe(1);
    expect(result.current.isOnline).toBe(true);
  });

  it('queues a mutation and executes sync when online', async () => {
    const mockOrder = { items: [{ name: 'Coffee', qty: 1, price: 30000 }] };
    (offlineDb.saveOrder as any).mockResolvedValue('local_new_1');
    (offlineDb.getPendingOrders as any).mockResolvedValue([
      { localId: 'local_new_1', orderData: mockOrder, createdAt: Date.now(), synced: false },
    ]);

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({ success: true, ok: true, localId: 'local_new_1' }),
    });

    const { result } = renderHook(() => useOfflineSync());

    let assignedId: string | undefined;
    await act(async () => {
      assignedId = await result.current.queueMutation(mockOrder);
    });

    expect(assignedId).toBe('local_new_1');
    expect(offlineDb.saveOrder).toHaveBeenCalledWith(mockOrder);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/orders/sync'),
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
    );
    expect(offlineDb.removeOrder).toHaveBeenCalledWith('local_new_1');
  });

  it('keeps item in queue when server returns 409 conflict', async () => {
    (offlineDb.getPendingOrders as any).mockResolvedValue([
      { localId: 'local_conflict', orderData: { total: 50000 }, createdAt: Date.now(), synced: false },
    ]);

    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 409,
    });

    const { result } = renderHook(() => useOfflineSync());

    await act(async () => {
      await result.current.syncAll();
    });

    expect(offlineDb.removeOrder).not.toHaveBeenCalled();
    expect(result.current.pendingCount).toBe(1);
  });

  it('handles fetch exception without throwing and preserves queue', async () => {
    (offlineDb.getPendingOrders as any).mockResolvedValue([
      { localId: 'local_net_err', orderData: { total: 40000 }, createdAt: Date.now(), synced: false },
    ]);

    global.fetch = vi.fn().mockRejectedValue(new Error('Network offline'));

    const { result } = renderHook(() => useOfflineSync());

    await act(async () => {
      await result.current.syncAll();
    });

    expect(offlineDb.removeOrder).not.toHaveBeenCalled();
    expect(result.current.pendingCount).toBe(1);
  });
});
