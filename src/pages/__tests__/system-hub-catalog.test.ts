import { describe, it, expect } from 'vitest';
import { buildSystemHubCategories } from '../system-hub-catalog';
import { filterSystemHubCategories, countSystemHubSections } from '../system-hub-queries';
import type { SectionCategory } from '../system-hub-types';

// The hub renders every card's live badge from these counters, so the assertions
// below pin the counter→badge mapping rather than the catalog's static wording.
const COUNTS = { cartItems: 3, kdsOrders: 2, adminOrders: 7, customers: 128 };

/** Reads one card's status label, failing loudly if the catalog shape drifted. */
function badgeOf(cats: SectionCategory[], categoryIndex: number, itemId: string): string {
  const category = cats[categoryIndex];
  expect(category).toBeDefined();
  const item = category!.items.find((i) => i.id === itemId);
  expect(item).toBeDefined();
  return item!.badge;
}

describe('system hub catalog', () => {
  it('produces 4 categories, 22 cards', () => {
    const cats = buildSystemHubCategories(COUNTS);
    expect(cats.map((c) => c.id)).toEqual(['operations', 'admin_crm', 'system_menu', 'customer_front']);
    expect(countSystemHubSections(cats)).toBe(22);
  });

  it('embeds live counters into badges', () => {
    const cats = buildSystemHubCategories(COUNTS);
    expect(badgeOf(cats, 0, 'kds')).toBe('2 vé đang làm');
    expect(badgeOf(cats, 0, 'orders')).toBe('7 đơn hàng');
    expect(badgeOf(cats, 1, 'crm-customers')).toBe('128 hội viên');
    expect(badgeOf(cats, 3, 'front-checkout')).toBe('3 món trong giỏ');
  });

  it('falls back to static badge labels when counters are zero', () => {
    const cats = buildSystemHubCategories({ cartItems: 0, kdsOrders: 0, adminOrders: 0, customers: 0 });
    expect(badgeOf(cats, 0, 'kds')).toBe('KDS Sẵn sàng');
    expect(badgeOf(cats, 3, 'front-checkout')).toBe('Giỏ hàng');
  });

  it('keeps every path stable', () => {
    const cats = buildSystemHubCategories(COUNTS);
    const paths = cats.flatMap((c) => c.items.map((i) => i.path));
    expect(paths).toEqual([
      '/kds', '/admin/pos', '/admin/table-management', '/admin/orders', '/tv-menu', '/mobile',
      '/admin', '/admin/customers', '/admin/campaigns', '/admin/promotions', '/admin/birthday-config', '/admin/checkin-approve',
      '/admin/manage-menu', '/admin/sales-reports', '/admin/erpnext-sync', '/admin/devices', '/admin/generate-qr', '/admin/audit-logs',
      '/', '/menu', '/checkout', '/table-reservation',
    ]);
  });

  describe('filtering', () => {
    const cats = buildSystemHubCategories(COUNTS);

    it('returns everything when no filter is active', () => {
      expect(filterSystemHubCategories(cats, '', 'all')).toHaveLength(4);
    });

    it('restricts to one category by chip', () => {
      const out = filterSystemHubCategories(cats, '', 'admin_crm');
      expect(out).toHaveLength(1);
      expect(out[0]?.id).toBe('admin_crm');
    });

    it('filters items by term across title/subtitle/description/badge/path', () => {
      const out = filterSystemHubCategories(cats, 'kds', 'all');
      const ids = out.flatMap((c) => c.items.map((i) => i.id));
      expect(ids).toContain('kds');
      expect(ids).not.toContain('pos');
    });

    it('drops a category when all of its items are filtered out', () => {
      const out = filterSystemHubCategories(cats, 'zzzznomatch', 'all');
      expect(out).toHaveLength(0);
    });

    it('treats whitespace-only term as no filter', () => {
      expect(filterSystemHubCategories(cats, '   ', 'all')).toHaveLength(4);
    });

    it('counts over the unfiltered catalog regardless of active filter', () => {
      const filtered = filterSystemHubCategories(cats, 'kds', 'all');
      expect(countSystemHubSections(filtered)).toBeLessThan(22);
      expect(countSystemHubSections(cats)).toBe(22);
    });
  });
});
