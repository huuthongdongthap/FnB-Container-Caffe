import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@/test-utils';
import { useKDS } from '@/hooks/use-kds';

vi.mock('@/lib/api-client', () => ({
  apiFetch: vi.fn(),
}));

import { apiFetch } from '@/lib/api-client';

describe('useKDS', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches orders on mount', () => {
    (apiFetch as ReturnType<typeof vi.fn>).mockResolvedValue({ orders: [] });
    renderHook(() => useKDS());
    expect(apiFetch).toHaveBeenCalledWith('/api/admin/orders?status=pending');
  });

  it('filters by station when provided', () => {
    (apiFetch as ReturnType<typeof vi.fn>).mockResolvedValue({ orders: [] });
    renderHook(() => useKDS('drinks'));
    expect(apiFetch).toHaveBeenCalledWith('/api/admin/orders?status=pending&station=drinks');
  });

  it('provides completion mutation function', async () => {
    (apiFetch as ReturnType<typeof vi.fn>).mockResolvedValue({ orders: [] });
    const { result } = renderHook(() => useKDS());
    await waitFor(() => {
      expect(result.current.completeOrder).toBeDefined();
      expect(typeof result.current.completeOrder).toBe('function');
    });
  });

  it('provides updateStatus function', async () => {
    (apiFetch as ReturnType<typeof vi.fn>).mockResolvedValue({ orders: [] });
    const { result } = renderHook(() => useKDS());
    await waitFor(() => {
      expect(result.current.updateStatus).toBeDefined();
      expect(typeof result.current.updateStatus).toBe('function');
    });
  });
});
