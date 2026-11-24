import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MD3TextField } from '@/components/md3/md3-text-field';
import { DateRangePicker } from '@/components/admin/DateRangePicker';
import { ThermalReceipt } from '@/components/receipt/ThermalReceipt';
import { stripSystemOrderNotes, normalizeAdminOrder } from '@/hooks/stores/admin/use-admin-orders-store';
import { OrderCard } from '@/components/stitch/StitchOrderMgmtNew-order-card';
import { StatusBadge } from '@/components/stitch/StitchOrderMgmtNew-status-badge';
import type { OrderData } from '@/components/stitch/StitchOrderMgmtNew-types';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: { defaultValue?: string }) => opts?.defaultValue ?? key,
    i18n: { language: 'vi' },
  }),
}));

describe('Cluster 6 UI & Store Regressions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('#184 Md3TextField & DateRangePicker', () => {
    it('always floats label for native date inputs and preserves caller onChange', () => {
      const onChange = vi.fn();
      const { container } = render(
        <MD3TextField
          id="test-date"
          label="Từ ngày"
          type="date"
          value=""
          onChange={onChange}
        />,
      );
      const label = container.querySelector('label');
      expect(label?.className).toContain('text-xs');
      const input = container.querySelector('input')!;
      fireEvent.change(input, { target: { value: '2026-11-24' } });
      expect(onChange).toHaveBeenCalledTimes(1);
    });

    it('derives floating state reactively from controlled value', () => {
      const { container, rerender } = render(
        <MD3TextField id="ctrl" label="Tên" value="" onChange={() => {}} />,
      );
      expect(container.querySelector('label')?.className).toContain('top-1/2');

      rerender(<MD3TextField id="ctrl" label="Tên" value="Minh" onChange={() => {}} />);
      expect(container.querySelector('label')?.className).toContain('text-xs');
    });

    it('DateRangePicker uses unique IDs per instance and enforces min/max cross-constraints', () => {
      const { container } = render(
        <>
          <DateRangePicker
            startDate="2026-11-01"
            endDate="2026-11-20"
            onStartDateChange={() => {}}
            onEndDateChange={() => {}}
          />
          <DateRangePicker
            startDate="2026-10-01"
            endDate="2026-10-15"
            onStartDateChange={() => {}}
            onEndDateChange={() => {}}
          />
        </>,
      );
      const inputs = Array.from(container.querySelectorAll('input[type="date"]'));
      expect(inputs).toHaveLength(4);
      const ids = new Set(inputs.map((el) => el.id));
      expect(ids.size).toBe(4);
      expect(inputs[0]?.getAttribute('max')).toBe('2026-11-20');
      expect(inputs[1]?.getAttribute('min')).toBe('2026-11-01');
    });
  });

  describe('#149 & #150 ThermalReceipt', () => {
    it('renders 80mm thermal receipt with itemized prices, fees, and pro-forma header', () => {
      render(
        <ThermalReceipt
          receipt={{
            orderId: 'ORD-2026-001',
            createdAt: '2026-11-24T10:00:00Z',
            customerName: 'Nguyễn Văn A',
            orderType: 'dine_in',
            tableName: 'Bàn 3',
            items: [
              { name: 'Cà Phê Sữa Đá', quantity: 2, price: 35000, modifiers: ['Ít đá'] },
            ],
            subtotal: 70000,
            serviceFee: 5000,
            discount: 10000,
            total: 65000,
            paymentMethod: 'cod',
            paymentStatus: 'paid',
            isProForma: true,
            receiptFooter: 'Cảm ơn quý khách!',
          }}
        />,
      );
      expect(document.getElementById('aura-thermal-receipt')).toBeTruthy();
      expect(screen.getByText('PHIẾU TẠM TÍNH')).toBeTruthy();
      expect(screen.getByText('Cà Phê Sữa Đá')).toBeTruthy();
      expect(screen.getByText('Cảm ơn quý khách!')).toBeTruthy();
    });

    it('renders nothing when receipt is null', () => {
      const { container } = render(<ThermalReceipt receipt={null} />);
      expect(container.firstChild).toBeNull();
    });
  });

  describe('#165 OrderCard & StatusBadge layout', () => {
    it('renders valid CSS variable classes without spaces and pins footer with flex-col', () => {
      const order: OrderData = {
        id: 'ORD-165',
        customer: 'Trần Thị B',
        table: 'Giao hàng',
        timeAgo: '10:15',
        status: 'pending',
        items: [{ name: 'Latte', quantity: 1, price: 45000 }],
        total: '45.000 ₫',
        shippingFee: 10000,
        serviceFee: 0,
        discount: 0,
        orderType: 'delivery',
      };
      const { container } = render(
        <OrderCard
          order={order}
          onViewDetails={() => {}}
          onPrint={() => {}}
        />,
      );
      const card = container.firstElementChild as HTMLElement;
      expect(card.className).toContain('flex-col');
      expect(card.className).toContain('h-full');
      expect(card.className).not.toContain(', #');
      expect(screen.getAllByText(/45\.000/).length).toBeGreaterThanOrEqual(2);
    });

    it('StatusBadge prevents wrapping with shrink-0 whitespace-nowrap', () => {
      const { container } = render(<StatusBadge status="preparing" />);
      const badge = container.firstElementChild as HTMLElement;
      expect(badge.className).toContain('shrink-0');
      expect(badge.className).toContain('whitespace-nowrap');
    });
  });

  describe('#182 & #183 Admin Order Normalization & Notes Sanitization', () => {
    it('strips legacy [OVERDUE] system prefix from customer notes', () => {
      expect(stripSystemOrderNotes('[OVERDUE] Ít đường')).toBe('Ít đường');
      expect(stripSystemOrderNotes('[OVERDUE]')).toBeUndefined();
      expect(stripSystemOrderNotes('Giao giờ hành chính')).toBe('Giao giờ hành chính');
    });

    it('preserves item unit price, fee breakdown, and pending loyalty reversal metadata', () => {
      const normalized = normalizeAdminOrder({
        id: 'ord-183',
        customer_name: 'Lê C',
        status: 'completed',
        total: 85000,
        subtotal: 70000,
        shipping_fee: 15000,
        service_fee: 5000,
        discount: 5000,
        cashback_used: 0,
        notes: '[OVERDUE] Không ống hút',
        pending_loyalty_reversal: true,
        pending_loyalty_transfer_ref: 'ref-tx-1',
        items: [{ name: 'Bạc Xỉu', quantity: 2, unit_price: 35000 }],
        created_at: '2026-11-24T09:00:00Z',
      });
      expect(normalized.notes).toBe('Không ống hút');
      expect(normalized.itemsList?.[0]?.price).toBe(35000);
      expect(normalized.shippingFee).toBe(15000);
      expect(normalized.serviceFee).toBe(5000);
      expect(normalized.discount).toBe(5000);
      expect(normalized.pendingLoyaltyReversal).toBe(true);
      expect(normalized.pendingLoyaltyTransferRef).toBe('ref-tx-1');
    });
  });
});
