import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@/test-utils';
import { useLoyalty } from '@/hooks/use-loyalty';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('useLoyalty', () => {
  it('fetches loyalty data and returns tier and points', async () => {
    const loyaltyData = {
      success: true,
      data: {
        tier: 'Vang',
        points: 320,
        lifetimePoints: 850,
        spentVnd: 2500000,
        cashbackRate: 7,
        birthdayBonus: 15,
      },
    };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(loyaltyData),
    });

    const { result } = renderHook(() => useLoyalty());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data?.tier).toBe('Vang');
    expect(result.current.data?.points).toBe(320);
  });

  it('handles 0 points gracefully', async () => {
    const zeroData = {
      success: true,
      data: {
        tier: 'Bronze',
        points: 0,
        lifetimePoints: 0,
        spentVnd: 0,
        cashbackRate: 3,
        birthdayBonus: 10,
      },
    };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(zeroData),
    });

    const { result } = renderHook(() => useLoyalty());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data?.points).toBe(0);
    expect(result.current.data?.tier).toBe('Bronze');
  });

  it('returns max tier correctly (Bach Kim)', async () => {
    const maxTierData = {
      success: true,
      data: {
        tier: 'Bach Kim',
        points: 1500,
        lifetimePoints: 5000,
        spentVnd: 15000000,
        cashbackRate: 10,
        birthdayBonus: 20,
      },
    };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(maxTierData),
    });

    const { result } = renderHook(() => useLoyalty());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data?.tier).toBe('Bach Kim');
    expect(result.current.data?.cashbackRate).toBe(10);
  });

  it('handles API error gracefully', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    const { result } = renderHook(() => useLoyalty());

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.data).toBeUndefined();
  });

  it('calls correct API endpoint', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ success: true, data: { tier: 'Bronze', points: 0 } }),
    });

    renderHook(() => useLoyalty());

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled();
    });

    const callUrl = mockFetch.mock.calls[0]?.[0] as string;
    expect(callUrl).toContain('/api/loyalty');
  });
});
