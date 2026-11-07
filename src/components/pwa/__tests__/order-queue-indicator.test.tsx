import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import OrderQueueIndicator from '../OrderQueueIndicator';
import { useOrderStore } from '@/hooks/stores/use-order-store';

vi.mock('@/hooks/stores/use-order-store', async () => {
  const { create } = await import('zustand');
  return { useOrderStore: create(() => ({ queuedOffline: true, error: null, flushQueuedOrders: vi.fn() })) };
});

const flush = vi.fn();
const advance = (ms: number) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });

beforeEach(() => {
  vi.useFakeTimers();
  flush.mockReset();
  useOrderStore.setState({ queuedOffline: true, error: null, flushQueuedOrders: flush });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('offline queue indicator lifecycle', () => {
  it('waits two seconds, then flushes automatically once', async () => {
    flush.mockReturnValue(new Promise(() => {}));
    render(<OrderQueueIndicator />);
    await advance(1999);
    expect(flush).not.toHaveBeenCalled();
    await advance(1);
    expect(flush).toHaveBeenCalledTimes(1);
    await advance(10000);
    expect(flush).toHaveBeenCalledTimes(1);
  });

  it('retains a failed queue for explicit retry instead of starting an endless retry loop', async () => {
    let rejectFlush!: (reason: Error) => void;
    flush.mockReturnValueOnce(new Promise((_resolve, reject) => { rejectFlush = reject; }));
    render(<OrderQueueIndicator />);
    await advance(2000);
    await act(async () => { rejectFlush(new Error('Queue still pending')); });
    expect(screen.getByRole('button', { name: /Đang thử đồng bộ lại|Thử lại/ })).toBeInTheDocument();
    await advance(10000);
    expect(flush).toHaveBeenCalledTimes(1);
    flush.mockImplementationOnce(async () => { useOrderStore.setState({ queuedOffline: false }); return null; });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Đang thử đồng bộ lại|Thử lại/ })); });
    expect(flush).toHaveBeenCalledTimes(2);
    expect(useOrderStore.getState().queuedOffline).toBe(false);
  });

  it('waits while offline and retries a failed attempt once after reconnecting', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    let rejectFlush!: (reason: Error) => void;
    flush.mockReturnValueOnce(new Promise((_resolve, reject) => { rejectFlush = reject; }));
    render(<OrderQueueIndicator />);
    await advance(2000);
    expect(flush).not.toHaveBeenCalled();
    act(() => { window.dispatchEvent(new Event('online')); });
    await advance(2000);
    expect(flush).toHaveBeenCalledTimes(1);
    await act(async () => { rejectFlush(new Error('Temporary outage')); });
    await advance(10000);
    expect(flush).toHaveBeenCalledTimes(1);
    flush.mockImplementationOnce(async () => { useOrderStore.setState({ queuedOffline: false }); return null; });
    act(() => { window.dispatchEvent(new Event('offline')); });
    act(() => { window.dispatchEvent(new Event('online')); });
    await advance(2000);
    expect(flush).toHaveBeenCalledTimes(2);
    expect(useOrderStore.getState().queuedOffline).toBe(false);
  });

  it('retries after an older request fails following a restored connection', async () => {
    let rejectFlush!: (reason: Error) => void;
    flush.mockReturnValueOnce(new Promise((_resolve, reject) => { rejectFlush = reject; }));
    render(<OrderQueueIndicator />);
    await advance(2000);
    act(() => { window.dispatchEvent(new Event('offline')); });
    act(() => { window.dispatchEvent(new Event('online')); });
    flush.mockImplementationOnce(async () => { useOrderStore.setState({ queuedOffline: false }); return null; });
    await act(async () => { rejectFlush(new Error('Old connection failed')); });
    await advance(2000);
    expect(flush).toHaveBeenCalledTimes(2);
    expect(useOrderStore.getState().queuedOffline).toBe(false);
  });

  it('leaves no dismissal timer after a completed queue unmounts', async () => {
    flush.mockImplementationOnce(async () => { useOrderStore.setState({ queuedOffline: false }); return null; });
    const view = render(<OrderQueueIndicator />);
    await advance(2000);
    view.unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('keeps a newer queue visible after an earlier queue completes', async () => {
    flush.mockImplementationOnce(async () => { useOrderStore.setState({ queuedOffline: false }); return null; });
    flush.mockReturnValueOnce(new Promise(() => {}));
    render(<OrderQueueIndicator />);
    await advance(2000);
    act(() => { useOrderStore.setState({ queuedOffline: true }); });
    await advance(3000);
    expect(flush).toHaveBeenCalledTimes(2);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('shows a newly queued order after a prior queue was dismissed', () => {
    render(<OrderQueueIndicator />);
    fireEvent.click(screen.getByRole('button', { name: 'Đóng' }));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    act(() => { useOrderStore.setState({ queuedOffline: false }); });
    act(() => { useOrderStore.setState({ queuedOffline: true }); });
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('ignores an async completion after unmount and creates no new timer', async () => {
    let resolveFlush!: (value: null) => void;
    flush.mockReturnValueOnce(new Promise<null>(resolve => { resolveFlush = resolve; }));
    const view = render(<OrderQueueIndicator />);
    await advance(2000);
    view.unmount();
    await act(async () => {
      useOrderStore.setState({ queuedOffline: false });
      resolveFlush(null);
    });
    expect(vi.getTimerCount()).toBe(0);
  });
});
