import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { type ReactNode, createElement } from 'react';
import { useCheckout } from '@/hooks/use-checkout';

// Mock apiFetch
vi.mock('@/lib/api-client', () => ({
  apiFetch: vi.fn(),
}));

import { apiFetch } from '@/lib/api-client';

function createWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

describe('useCheckout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('submits order and returns success response', async () => {
    const mockResponse = {
      success: true,
      order: {
        id: 'ORD_123',
        status: 'pending',
        total: 73500,
        payment_method: 'cod',
        payment_status: 'unpaid',
        customer_name: 'Nguyễn Văn A',
        customer_phone: '0912345678',
        items: [{ id: '1', name: 'Cà phê sữa đá', price: 35000, quantity: 2 }],
        created_at: new Date().toISOString(),
      },
    };

    vi.mocked(apiFetch).mockResolvedValueOnce(mockResponse);

    const { result } = renderHook(() => useCheckout(), { wrapper: createWrapper() });

    const payload = {
      items: [{ id: '1', name: 'Cà phê sữa đá', price: 35000, quantity: 2, image: '' }],
      total: 73500,
      customer_name: 'Nguyễn Văn A',
      customer_phone: '0912345678',
      customer_email: '',
      customer_address: '39 Nguyễn Tất Thành',
      payment_method: 'cod' as const,
      notes: '',
      delivery_time: 'now' as const,
      shipping_fee: 0,
      discount: 0,
      tip: 0,
    };

    result.current.mutate(payload);

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(mockResponse);
    expect(apiFetch).toHaveBeenCalledWith('/api/orders', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  });

  it('handles API error', async () => {
    const mockError = new Error('Missing required field: customer_name');
    vi.mocked(apiFetch).mockRejectedValueOnce(mockError);

    const { result } = renderHook(() => useCheckout(), { wrapper: createWrapper() });

    result.current.mutate({
      items: [],
      total: 0,
      customer_name: '',
      customer_phone: '',
      customer_email: '',
      customer_address: '',
      payment_method: 'cod',
      notes: '',
      delivery_time: 'now',
      shipping_fee: 0,
      discount: 0,
      tip: 0,
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error?.message).toBe('Missing required field: customer_name');
  });

  it('returns payment_url for PayOS method', async () => {
    const mockResponse = {
      success: true,
      order: {
        id: 'ORD_456',
        status: 'pending',
        total: 73500,
        payment_method: 'payos',
        payment_status: 'unpaid',
        customer_name: 'Nguyễn Văn A',
        customer_phone: '0912345678',
        items: [{ id: '1', name: 'Cà phê sữa đá', price: 35000, quantity: 2 }],
        created_at: new Date().toISOString(),
      },
      payment_url: 'https://payos.com/checkout/abc123',
    };

    vi.mocked(apiFetch).mockResolvedValueOnce(mockResponse);

    const { result } = renderHook(() => useCheckout(), { wrapper: createWrapper() });

    result.current.mutate({
      items: [{ id: '1', name: 'Cà phê sữa đá', price: 35000, quantity: 2, image: '' }],
      total: 73500,
      customer_name: 'Nguyễn Văn A',
      customer_phone: '0912345678',
      customer_email: '',
      customer_address: '39 Nguyễn Tất Thành',
      payment_method: 'payos',
      notes: '',
      delivery_time: 'now',
      shipping_fee: 0,
      discount: 0,
      tip: 0,
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.payment_url).toBe('https://payos.com/checkout/abc123');
  });
});
