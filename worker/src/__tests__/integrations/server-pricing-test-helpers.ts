import { createMockDB } from '../test-utils';
import type { HappyHourWindow } from '@aura/domain-catalog';

export interface TestProductRow {
  id: string;
  name: string;
  price: number;
  is_available: number;
}

export function createPricingMockDB() {
  const products = new Map<string, TestProductRow>([
    ['prod-coffee', { id: 'prod-coffee', name: 'Cà phê sữa', price: 30000, is_available: 1 }],
    ['prod-tea', { id: 'prod-tea', name: 'Trà đào', price: 25000, is_available: 1 }],
    ['prod-soldout', { id: 'prod-soldout', name: 'Bánh sừng bò', price: 40000, is_available: 0 }],
  ]);

  const modifierGroups = new Map<string, { id: string; name: string; type: 'single' | 'multiple'; required: number; is_active: number }>([
    ['grp-1', { id: 'grp-1', name: 'Đường', type: 'single', required: 0, is_active: 1 }],
    ['grp-2', { id: 'grp-2', name: 'Topping', type: 'multiple', required: 0, is_active: 1 }],
  ]);

  const modifierChoices = new Map<string, { id: string; group_id: string; name: string; price_delta: number; is_available: number }>([
    ['mod-sugar', { id: 'mod-sugar', group_id: 'grp-1', name: 'Ít đường', price_delta: 0, is_available: 1 }],
    ['mod-jelly', { id: 'mod-jelly', group_id: 'grp-2', name: 'Thạch cà phê', price_delta: 5000, is_available: 1 }],
    ['mod-pudding', { id: 'mod-pudding', group_id: 'grp-2', name: 'Pudding trứng', price_delta: 7000, is_available: 1 }],
  ]);

  const productModifierGroups = new Set<string>([
    'prod-coffee:grp-1',
    'prod-coffee:grp-2',
    'prod-tea:grp-1',
  ]);

  const happyHourWindows: HappyHourWindow[] = [
    {
      id: 'hh-wed-afternoon',
      name: 'Happy Hour Giờ Vàng',
      day_of_week: 3, // Wednesday
      start_time: '14:00',
      end_time: '16:00',
      discount_rate: 20, // 20%
      active: 1,
      priority: 1,
    },
  ];

  const db = createMockDB();
  db.prepare = (sql: string) => {
    let boundParams: any[] = [];
    const stmt = {
      bind: (...args: any[]) => {
        boundParams = args;
        return stmt;
      },
      first: async <T = unknown>(): Promise<T | null> => {
        if (sql.includes('FROM products WHERE id = ?')) {
          const row = products.get(boundParams[0]);
          if (!row) return null;
          return { id: row.id, name: row.name, price: row.price, available: row.is_available } as T;
        }
        if (sql.includes('FROM modifier_choices WHERE id = ?')) {
          return (modifierChoices.get(boundParams[0]) || null) as T;
        }
        if (sql.includes('FROM modifier_choices WHERE name = ?')) {
          for (const m of modifierChoices.values()) {
            if (m.name === boundParams[0]) return m as T;
          }
          return null;
        }
        if (sql.includes('FROM modifier_groups WHERE id = ?')) {
          return (modifierGroups.get(boundParams[0]) || null) as T;
        }
        if (sql.includes('FROM product_modifier_groups WHERE product_id = ? AND group_id = ?')) {
          const key = `${boundParams[0]}:${boundParams[1]}`;
          if (productModifierGroups.has(key)) {
            return { product_id: boundParams[0], group_id: boundParams[1] } as T;
          }
          return null;
        }
        return null;
      },
      all: async <T = unknown>(): Promise<{ results?: T[] } | T[]> => {
        if (sql.includes('FROM happy_hour_windows WHERE active = 1')) {
          return { results: happyHourWindows as T[] };
        }
        return { results: [] };
      },
      run: async () => ({ success: true }),
    };
    return stmt as any;
  };

  return { db, products, modifierGroups, modifierChoices, productModifierGroups, happyHourWindows };
}
