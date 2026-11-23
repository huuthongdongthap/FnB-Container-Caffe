import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@/test-utils';
import { renderHook } from '@testing-library/react';
import { calcElapsedSeconds } from '@/pages/kds-types';
import { useKdsAudio } from '@/hooks/use-kds-audio';
import {
  normalizeHappyHourDiscountPercent,
  resolveTvCategoryLabel,
} from '@/hooks/use-tv-menu';
import KitchenOrderCard from '@/pages/mobile/kitchen-display-order-card';
import { OrderTimeline } from '@/components/stitch/StitchTrackOrderNew-order-timeline';
import { OrderHero } from '@/components/stitch/StitchTrackOrderNew-order-hero';
import { OrderSummary } from '@/components/stitch/StitchTrackOrderNew-order-summary';
import { getShellConfig } from '@/components/stitch/shell-config';
import { MenuSlideshow } from '@/components/tv-menu/MenuSlideshow';
import { Sidebar } from '@/components/stitch/stitch-kds-sidebar';

describe('UAT #128-#131 Regressions', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('#128 KDS UTC timestamp & audio ID tracking', () => {
    it('normalizes SQLite UTC timestamps without Z in calcElapsedSeconds', () => {
      const fiveMinAgoUtc = new Date(Date.now() - 5 * 60_000)
        .toISOString()
        .replace('T', ' ')
        .slice(0, 19);
      const elapsed = calcElapsedSeconds(fiveMinAgoUtc);
      expect(elapsed).toBeGreaterThanOrEqual(295);
      expect(elapsed).toBeLessThanOrEqual(305);
    });

    it('suppresses beep on initial load and beeps on 1-out-1-in new order swap', () => {
      const startSpy = vi.fn();
      const closeSpy = vi.fn().mockResolvedValue(undefined);
      class MockAudioContext {
        currentTime = 0;
        destination = {};
        createOscillator() {
          return {
            type: 'sine',
            frequency: { setValueAtTime: vi.fn() },
            connect: vi.fn(),
            start: startSpy,
            stop: vi.fn(),
            onended: null,
          };
        }
        createGain() {
          return {
            gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
            connect: vi.fn(),
          };
        }
        close = closeSpy;
      }
      vi.stubGlobal('AudioContext', MockAudioContext);

      const { rerender } = renderHook(
        ({ ids, enabled, loading }) => useKdsAudio(ids, enabled, loading),
        { initialProps: { ids: ['o1', 'o2'], enabled: true, loading: false } },
      );

      // Initial load must NOT beep
      expect(startSpy).not.toHaveBeenCalled();

      // 1-out-1-in swap: same length (2), but 'o3' is genuinely new
      rerender({ ids: ['o2', 'o3'], enabled: true, loading: false });
      expect(startSpy).toHaveBeenCalledTimes(1);

      vi.unstubAllGlobals();
    });
  });

  describe('#129 KDS Sidebar & Mobile KDS null table', () => {
    it('renders SPA Links including POS and KDS in KDS Sidebar', () => {
      render(
        <Sidebar
          isOpen={true}
          onToggle={vi.fn()}
          stationLabel="TẤT CẢ TRẠM"
          stationName="QUẦY PHA CHẾ"
          stationLoad={40}
        />,
      );
      const posLink = screen.getByRole('link', { name: /POS/i });
      const kdsLink = screen.getByRole('link', { name: /KDS/i });
      expect(posLink.getAttribute('href')).toBe('/admin/pos');
      expect(kdsLink.getAttribute('href')).toBe('/kds');
    });

    it('renders Mang đi and Giao hàng instead of Bàn null on Mobile KDS card', () => {
      const { rerender } = render(
        <KitchenOrderCard
          order={{
            id: 'ord-1',
            table_name: null,
            order_type: 'takeaway',
            items: [{ name: 'Cà phê sữa', quantity: 1 }],
            status: 'pending',
            created_at: new Date().toISOString(),
          }}
          updatingId={null}
          onStatusChange={vi.fn()}
        />,
      );
      expect(screen.getByText('Mang đi')).toBeTruthy();
      expect(screen.queryByText(/Bàn null/i)).toBeNull();

      rerender(
        <KitchenOrderCard
          order={{
            id: 'ord-2',
            table_name: null,
            order_type: 'delivery',
            items: [{ name: 'Trà đào', quantity: 1 }],
            status: 'preparing',
            created_at: new Date().toISOString(),
          }}
          updatingId={null}
          onStatusChange={vi.fn()}
        />,
      );
      expect(screen.getByText('Giao hàng')).toBeTruthy();
    });
  });

  describe('#130 Track Order timeline, ETA, VND summary, and shell header', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('renders cancelled alert banner instead of raw i18n keys', () => {
      render(<OrderTimeline status="cancelled" />);
      expect(screen.getByRole('alert')).toBeTruthy();
      expect(screen.queryByText(/trackOrder\.step/i)).toBeNull();
    });

    it('uses dine-in flow for served orders without showing delivery step', () => {
      render(<OrderTimeline status="served" />);
      expect(screen.getByText('Đã phục vụ')).toBeTruthy();
      expect(screen.queryByText('Đang giao hàng')).toBeNull();
    });

    it('normalizes decimal discount_rate and resolves Vietnamese TV category labels', () => {
      expect(normalizeHappyHourDiscountPercent({ discount_rate: 0.2 })).toBe(20);
      expect(normalizeHappyHourDiscountPercent({ discount_percent: 15 })).toBe(15);
      expect(
        resolveTvCategoryLabel({
          id: '1',
          name: 'Latte',
          price: 45000,
          category: 'coffee',
          available: true,
        }),
      ).toBe('Cà phê');
    });

    it('resets audio seen set on station switch without false beep', () => {
      const startSpy = vi.fn();
      class MockAudioContext {
        currentTime = 0;
        destination = {};
        createOscillator() {
          return {
            type: 'sine',
            frequency: { setValueAtTime: vi.fn() },
            connect: vi.fn(),
            start: startSpy,
            stop: vi.fn(),
            onended: null as null | (() => void),
          };
        }
        createGain() {
          return {
            gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
            connect: vi.fn(),
          };
        }
        close() {
          return Promise.resolve();
        }
      }
      vi.stubGlobal('AudioContext', MockAudioContext);

      const { rerender } = renderHook(
        ({ ids, station }: { ids: string[]; station: string }) =>
          useKdsAudio(ids, true, false, station),
        { initialProps: { ids: ['o1'], station: 'all' } },
      );
      expect(startSpy).toHaveBeenCalledTimes(0);

      // Station switch introduces different IDs — must not false-beep
      rerender({ ids: ['o2', 'o3'], station: 'barista' });
      expect(startSpy).toHaveBeenCalledTimes(0);

      // Genuine new order on the same station triggers beep
      rerender({ ids: ['o2', 'o3', 'o4'], station: 'barista' });
      expect(startSpy).toHaveBeenCalledTimes(1);
    });

    it('hides ETA on terminal/ready statuses and shows it on preparing', () => {
      const { rerender } = render(
        <OrderHero orderId="#AC-100" estimatedMinutes={8} status="cancelled" />,
      );
      expect(screen.queryByText('8')).toBeNull();

      rerender(<OrderHero orderId="#AC-100" estimatedMinutes={8} status="preparing" />);
      expect(screen.getByText('8')).toBeTruthy();
    });

    it('formats 0 VND as 0₫ (never $0.00) and multiplies unit price by quantity', () => {
      render(
        <OrderSummary
          items={[
            { id: '1', name: 'Latte', quantity: 2, price: 45000 },
            { id: '2', name: 'Nước lọc', quantity: 1, price: 0 },
          ]}
          total={90000}
        />,
      );
      expect(screen.getAllByText('90.000₫').length).toBeGreaterThanOrEqual(2);
      expect(screen.getByText('0₫')).toBeTruthy();
      expect(screen.queryByText(/\$0\.00/)).toBeNull();
    });

    it('disables duplicate CustomerShell top bar on /track-order', () => {
      expect(getShellConfig('/track-order')?.showTop).toBe(false);
    });
  });

  describe('#131 TV Menu dynamic Happy Hour & offline banner', () => {
    it('renders dynamic Happy Hour window and non-blocking offline warning', () => {
      render(
        <MenuSlideshow
          menuGroups={[
            {
              category: 'Cà phê',
              items: [{ id: 'p1', name: 'Bạc xỉu', price: 35000, category: 'Cà phê', available: true }],
            },
          ]}
          isHappyHour={true}
          happyHour={{
            active: true,
            name: 'GIỜ VÀNG CHIỀU',
            discountPercent: 15,
            startTime: '15:00',
            endTime: '17:00',
          }}
          isError={true}
          lastUpdated={new Date('2026-11-23T08:00:00Z')}
          totalItems={1}
        />,
      );
      expect(screen.getByText(/GIỜ VÀNG CHIỀU/)).toBeTruthy();
      expect(screen.getByText('15%')).toBeTruthy();
      expect(screen.getByText(/15:00\s*–\s*17:00/)).toBeTruthy();
      expect(screen.queryByText('20%')).toBeNull();
      expect(screen.getByRole('alert').textContent).toContain('Mất kết nối máy chủ');
    });
  });
});
