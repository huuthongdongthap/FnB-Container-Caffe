import { describe, it, expect } from 'vitest';
import {
  validateProductModifiers,
  resolveServerProductPrice,
} from '@aura/domain-catalog';
import { calculateOrderSnapshot } from '@aura/domain-order';

interface MockChoice {
  id: string;
  group_id: string;
  name: string;
  price_delta: number;
  is_available: number;
}

interface MockGroup {
  id: string;
  name: string;
  type: 'single' | 'multiple';
  required: number;
  is_active: number;
}

function createModifierTestDB() {
  const products = new Map([
    ['prod-coffee', { id: 'prod-coffee', name: 'Cà phê sữa đá', price: 29000, is_available: 1 }],
    ['prod-tea', { id: 'prod-tea', name: 'Trà đào cam sả', price: 35000, is_available: 1 }],
  ]);

  const groups = new Map<string, MockGroup>([
    ['grp-sugar', { id: 'grp-sugar', name: 'Đường', type: 'single', required: 1, is_active: 1 }],
    ['grp-topping', { id: 'grp-topping', name: 'Topping', type: 'multiple', required: 0, is_active: 1 }],
    ['grp-tea-only', { id: 'grp-tea-only', name: 'Topping Trà', type: 'multiple', required: 0, is_active: 1 }],
    ['grp-inactive', { id: 'grp-inactive', name: 'Nhóm Tạm Ngưng', type: 'single', required: 0, is_active: 0 }],
  ]);

  const choices = new Map<string, MockChoice>([
    ['choice-sugar-normal', { id: 'choice-sugar-normal', group_id: 'grp-sugar', name: 'Bình thường', price_delta: 0, is_available: 1 }],
    ['choice-sugar-less', { id: 'choice-sugar-less', group_id: 'grp-sugar', name: 'Ít đường', price_delta: 0, is_available: 1 }],
    ['choice-jelly', { id: 'choice-jelly', group_id: 'grp-topping', name: 'Thạch cà phê', price_delta: 6000, is_available: 1 }],
    ['choice-pudding', { id: 'choice-pudding', group_id: 'grp-topping', name: 'Pudding', price_delta: 8000, is_available: 1 }],
    ['choice-tea-peach', { id: 'choice-tea-peach', group_id: 'grp-tea-only', name: 'Đào miếng', price_delta: 10000, is_available: 1 }],
    ['choice-soldout', { id: 'choice-soldout', group_id: 'grp-topping', name: 'Trân châu trắng', price_delta: 7000, is_available: 0 }],
    ['choice-in-inactive-grp', { id: 'choice-in-inactive-grp', group_id: 'grp-inactive', name: 'Topping ngưng', price_delta: 5000, is_available: 1 }],
  ]);

  const productGroups = new Set([
    'prod-coffee:grp-sugar',
    'prod-coffee:grp-topping',
    'prod-tea:grp-tea-only',
  ]);

  const db = {
    prepare(sql: string) {
      let bound: any[] = [];
      const stmt = {
        bind(...args: any[]) {
          bound = args;
          return stmt;
        },
        async first<T = unknown>(): Promise<T | null> {
          if (sql.includes('FROM products WHERE id = ?')) {
            const p = products.get(bound[0]);
            return p ? ({ id: p.id, name: p.name, price: p.price, available: p.is_available } as T) : null;
          }
          if (sql.includes('FROM modifier_choices WHERE id = ?')) {
            return (choices.get(bound[0]) as T) || null;
          }
          if (sql.includes('FROM modifier_choices WHERE name = ?')) {
            for (const c of choices.values()) {
              if (c.name === bound[0]) return c as T;
            }
            return null;
          }
          if (sql.includes('FROM modifier_groups WHERE id = ?')) {
            return (groups.get(bound[0]) as T) || null;
          }
          if (sql.includes('FROM product_modifier_groups WHERE product_id = ? AND group_id = ?')) {
            const key = `${bound[0]}:${bound[1]}`;
            return productGroups.has(key) ? ({ product_id: bound[0], group_id: bound[1] } as T) : null;
          }
          return null;
        },
        async all<T = unknown>(): Promise<{ results?: T[] } | T[]> {
          return { results: [] };
        },
        async run() {
          return { success: true };
        },
      };
      return stmt;
    },
  };

  return { db };
}

describe('Catalog Modifier Contract Suite', () => {
  const { db } = createModifierTestDB();

  it('Rule 1 & 6: validates valid modifiers and discards tampered client price_delta', async () => {
    const res = await validateProductModifiers(db, 'prod-coffee', [
      { id: 'choice-sugar-less', price_delta: 999999 }, // tampered delta
      { id: 'choice-jelly', price_delta: -50000 },      // tampered delta
    ]);

    expect(res.valid).toBe(true);
    expect(res.rejection).toBeUndefined();
    expect(res.validatedModifiers).toHaveLength(2);
    // DB values: sugar-less = 0, jelly = 6000
    expect(res.validatedModifiers[0].price_delta).toBe(0);
    expect(res.validatedModifiers[1].price_delta).toBe(6000);
    expect(res.modifierDelta).toBe(6000);
  });

  it('Rule 2: rejects unknown modifier ID with invalid_modifier', async () => {
    const res = await validateProductModifiers(db, 'prod-coffee', ['choice-ghost-unknown']);
    expect(res.valid).toBe(false);
    expect(res.rejection?.code).toBe('invalid_modifier');
    expect(res.rejection?.message).toContain('Modifier choice not found: choice-ghost-unknown');

    const snap = await calculateOrderSnapshot(db, {
      items: [{ productId: 'prod-coffee', quantity: 1, modifiers: ['choice-ghost-unknown'] }],
    });
    expect(snap.rejected?.code).toBe('invalid_modifier');
  });

  it('Rule 3: rejects modifier belonging to another product with invalid_modifier', async () => {
    // choice-tea-peach belongs to grp-tea-only, linked to prod-tea, NOT prod-coffee
    const res = await validateProductModifiers(db, 'prod-coffee', ['choice-tea-peach']);
    expect(res.valid).toBe(false);
    expect(res.rejection?.code).toBe('invalid_modifier');
    expect(res.rejection?.message).toContain('does not belong to product prod-coffee');
  });

  it('Rule 4: rejects unavailable modifier choice with modifier_unavailable', async () => {
    const res = await validateProductModifiers(db, 'prod-coffee', ['choice-soldout']);
    expect(res.valid).toBe(false);
    expect(res.rejection?.code).toBe('modifier_unavailable');
    expect(res.rejection?.message).toContain('Modifier choice unavailable');
  });

  it('Rule 4 (Group): rejects choices from an inactive modifier group with modifier_unavailable', async () => {
    const res = await validateProductModifiers(db, 'prod-coffee', ['choice-in-inactive-grp']);
    expect(res.valid).toBe(false);
    expect(res.rejection?.code).toBe('modifier_unavailable');
    expect(res.rejection?.message).toContain('Modifier group inactive');
  });

  it('Rule 5 (Duplicate ID): rejects duplicate modifier choice selection with duplicate_modifier', async () => {
    const res = await validateProductModifiers(db, 'prod-coffee', ['choice-jelly', 'choice-jelly']);
    expect(res.valid).toBe(false);
    expect(res.rejection?.code).toBe('duplicate_modifier');
    expect(res.rejection?.message).toContain('Duplicate modifier selection');
  });

  it('Rule 5 (Single Group): rejects multiple choices selected for single-choice group with duplicate_modifier', async () => {
    // grp-sugar is type 'single'
    const res = await validateProductModifiers(db, 'prod-coffee', ['choice-sugar-normal', 'choice-sugar-less']);
    expect(res.valid).toBe(false);
    expect(res.rejection?.code).toBe('duplicate_modifier');
    expect(res.rejection?.message).toContain('single-choice group');
  });

  it('Rule 7: successfully resolves product without modifiers with zero delta', async () => {
    const res = await resolveServerProductPrice(db, { productId: 'prod-coffee', channel: 'dine_in', modifiers: [] });
    expect(res.available).toBe(true);
    expect(res.basePriceCents).toBe(29000);
    expect(res.modifierDelta).toBe(0);
    expect(res.unitPriceCents).toBe(29000);
    expect(res.validatedModifiers).toEqual([]);
  });

  it('Integrates with order snapshot rejecting invalid modifiers before line-item generation', async () => {
    const snap = await calculateOrderSnapshot(db, {
      items: [{ productId: 'prod-coffee', quantity: 2, modifiers: ['choice-tea-peach'] }],
      channel: 'dine_in',
    });
    expect(snap.rejected?.code).toBe('invalid_modifier');
    expect(snap.total).toBe(0);
    expect(snap.items).toHaveLength(0);
  });
});
