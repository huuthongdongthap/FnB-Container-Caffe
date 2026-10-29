/**
 * KDS new-order sound: the page must beep when a new order arrives while the
 * sound toggle is on, and stay silent when it is off.
 *
 * Guards a real regression: the page used to play /sounds/new-order.mp3, which
 * does not exist, and swallows the resulting play() rejection into
 * "audioUnavailable" — so new orders arrived silently with no error surfaced.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@/test-utils';

const mockUseKDS = vi.fn();
vi.mock('@/hooks/use-kds', () => ({
  useKDS: (...args: unknown[]) => mockUseKDS(...args),
}));

const playBeep = vi.fn();
vi.mock('@/hooks/use-kds-audio', () => ({
  useKdsAudio: (orderCount: number, enabled: boolean) => playBeep(orderCount, enabled),
}));

vi.mock('react-helmet-async', () => ({
  Helmet: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  HelmetProvider: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
}));

import KDSPage from '@/pages/KDS';
import { fireEvent } from '@testing-library/react';

function seedOrders(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: `order-${i + 1}`,
    shortId: `#000${i + 1}`,
    status: 'pending',
    items: [],
    tableId: null,
    total: 1000,
    createdAt: new Date(0).toISOString(),
    priority: 'normal',
    stationIds: [],
  }));
}

describe('KDS new-order sound', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseKDS.mockReturnValue({
      orders: seedOrders(2),
      isLoading: false,
      isError: false,
      error: null,
      updateStatus: vi.fn(),
    });
  });

  it('plays a sound for a new order when the sound toggle is on', () => {
    render(<KDSPage />);
    expect(playBeep).toHaveBeenCalled();
    const [orderCount, enabled] = playBeep.mock.calls.at(-1) ?? [];
    expect(orderCount).toBe(2);
    expect(enabled).toBe(true);
  });

  it('passes disabled sound to the hook when the toggle is off', () => {
    render(<KDSPage />);
    fireEvent.click(screen.getByRole('button', { name: /mute alerts|alerts/i }));
    expect(playBeep.mock.calls.at(-1)?.[1]).toBe(false);
  });

  it('does not render a reference to a missing audio asset', () => {
    const { container } = render(<KDSPage />);
    expect(container.querySelector('audio')).toBeNull();
    expect(container.innerHTML).not.toContain('/sounds/');
  });
});
