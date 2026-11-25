import { describe, it, expect } from 'vitest';
import { formatTime, sortKdsTickets } from '@/components/stitch/stitch-kds-utils';
import { stripInternalOrderTags, mapStreamOrders, normalizeKdsOrder } from '@/hooks/kds-order';
import { calcDurationSeconds } from '@/pages/kds-types';
import { isHeldOutOfKds } from '../../../packages/domain/kitchen/policies/kds-hold-policy';
import type { Ticket } from '@/components/stitch/stitch-kds-types';

describe('KDS priority sorting, formatting, and order normalization (#158, #159, #160)', () => {
  it('formats elapsed time safely across minutes, hours, and localized multi-day spans', () => {
    expect(formatTime(125)).toBe('02:05');
    expect(formatTime(3661)).toBe('01:01:01');
    expect(formatTime(90_000, 'en')).toBe('1d 1h');
    expect(formatTime(90_000, 'vi')).toBe('1ng 1g');
    expect(formatTime(-5)).toBe('00:00');
  });

  it('sorts tickets by SLA priority: overdue+pending -> overdue+preparing -> isWarning -> FIFO created_at -> ready (FIFO ready_at)', () => {
    const tickets: Ticket[] = [
      { id: '#RDY_NEW', table: 'B01', type: 'DINE IN', status: 'ready', rawStatus: 'ready', items: [], elapsedSeconds: 99999, readyWaitSeconds: 60 },
      { id: '#RDY_OLD', table: 'B06', type: 'DINE IN', status: 'ready', rawStatus: 'ready', items: [], elapsedSeconds: 300, readyWaitSeconds: 420 },
      { id: '#PRP_NEW', table: 'B03', type: 'DINE IN', status: 'preparing', rawStatus: 'preparing', items: [], elapsedSeconds: 120 },
      { id: '#PND_FIFO', table: 'B02', type: 'DINE IN', status: 'pending', rawStatus: 'pending', items: [], elapsedSeconds: 480 },
      { id: '#WARN', table: 'B07', type: 'DINE IN', status: 'pending', rawStatus: 'pending', isWarning: true, items: [], elapsedSeconds: 720 },
      { id: '#OVD_PRP', table: 'B05', type: 'DINE IN', status: 'overdue', rawStatus: 'preparing', isOverdue: true, items: [], elapsedSeconds: 1800 },
      { id: '#OVD_PND', table: 'B04', type: 'DINE IN', status: 'overdue', rawStatus: 'pending', isOverdue: true, items: [], elapsedSeconds: 1200 },
    ];
    const sorted = sortKdsTickets(tickets);
    expect(sorted.map((tk) => tk.id)).toEqual([
      '#OVD_PND',
      '#OVD_PRP',
      '#WARN',
      '#PND_FIFO',
      '#PRP_NEW',
      '#RDY_OLD',
      '#RDY_NEW',
    ]);
  });

  it('strips internal [OVERDUE] tags from customer-facing order notes', () => {
    expect(stripInternalOrderTags('[OVERDUE]')).toBeUndefined();
    expect(stripInternalOrderTags('Ít đá | [OVERDUE]')).toBe('Ít đá');
    expect(stripInternalOrderTags('  | [OVERDUE] | Không đường ')).toBe('Không đường');
  });

  it('maps table_name, order_number, customer_name, and timestamps from stream and REST payloads', () => {
    const streamMapped = mapStreamOrders([
      {
        id: 'ord-1234',
        order_number: 'ORD-042',
        customer_name: 'Minh',
        table_id: 'tbl-uuid-1',
        table_name: '05',
        order_type: 'dine_in',
        items: [{ product_name: 'Latte', quantity: 1 }],
        notes: 'Ít đường | [OVERDUE]',
        status: 'ready',
        elapsed_minutes: 10,
        created_at: '2026-11-24T01:00:00Z',
        updated_at: '2026-11-24T01:08:00Z',
      },
    ]);
    expect(streamMapped[0]).toMatchObject({
      id: 'ord-1234',
      orderNumber: 'ORD-042',
      customerName: 'Minh',
      table: '05',
      notes: 'Ít đường',
      updatedAt: '2026-11-24T01:08:00Z',
    });

    const restMapped = normalizeKdsOrder({
      id: 'ord-5678',
      order_number: 'ORD-043',
      customer_name: 'Lan',
      table_id: 'tbl-uuid-2',
      table_name: '12',
      items: [{ name: 'Matcha', quantity: 2 }],
      notes: '[OVERDUE]',
      status: 'preparing',
      created_at: '2026-11-24T01:00:00Z',
      started_at: '2026-11-24T01:01:00Z',
    });
    expect(restMapped).toMatchObject({
      orderNumber: 'ORD-043',
      customerName: 'Lan',
      table: '12',
      startedAt: '2026-11-24T01:01:00Z',
    });
    expect(restMapped.notes).toBeUndefined();
  });

  it('computes frozen duration between created_at and ready/updated timestamps', () => {
    expect(calcDurationSeconds('2026-11-24 01:00:00', '2026-11-24 01:07:30')).toBe(450);
    expect(calcDurationSeconds('2026-11-24T01:00:00Z', undefined)).toBeNull();
  });

  it('keeps empty QR check-in placeholders held out of KDS even if notes have appended tags', () => {
    expect(
      isHeldOutOfKds({
        notes: 'Khách QR - cho don mon | [OVERDUE]',
        items: '[]',
        status: 'pending',
      }),
    ).toBe(true);
    expect(
      isHeldOutOfKds({
        notes: 'Khách QR - cho don mon',
        items: '[{"name":"Latte","quantity":1}]',
        status: 'pending',
      }),
    ).toBe(false);
  });
});
