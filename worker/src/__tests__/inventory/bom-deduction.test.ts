import { describe, it, expect, vi } from 'vitest';
import { createMockDB } from '../test-utils';

function makeMockPrepare(firstResult: any, allResults: any[]) {
  return () => ({
    bind: () => ({
      first: async () => firstResult,
      all: async () => ({ results: allResults }),
      run: async () => ({ meta: { changes: 1 } }),
    }),
  });
}

describe('BOM deduction', () => {
  it('returns empty array when product has no recipe', async () => {
    const { getRecipeForProduct } = await import('@aura/domain-inventory');
    const db = createMockDB();
    db.prepare = makeMockPrepare(null, []) as any;

    const components = await getRecipeForProduct(db as any, 'prod_unknown');
    expect(components).toEqual([]);
  });

  it('returns recipe components when recipe exists', async () => {
    const { getRecipeForProduct } = await import('@aura/domain-inventory');
    const db = createMockDB();
    db.prepare = makeMockPrepare(
      { id: 'recipe_1' },
      [
        { ingredient_id: 'ing_coffee', quantity: 25 },
        { ingredient_id: 'ing_milk', quantity: 30 },
      ]
    ) as any;

    const components = await getRecipeForProduct(db as any, 'prod_cafe_sua');
    expect(components).toHaveLength(2);
    expect(components[0]).toEqual({ ingredient_id: 'ing_coffee', quantity: 25 });
  });

  it('calculates depletion correctly for multiple order items', async () => {
    const { calculateBomDepletion } = await import('@aura/domain-inventory');

    const orderItems = [
      { product_id: 'prod_cafe_sua', quantity: 2 },
      { product_id: 'prod_cafe_den', quantity: 1 },
    ];

    const recipeMap = new Map([
      ['prod_cafe_sua', [
        { ingredient_id: 'ing_coffee', quantity: 25 },
        { ingredient_id: 'ing_milk', quantity: 30 },
      ]],
      ['prod_cafe_den', [
        { ingredient_id: 'ing_coffee', quantity: 20 },
      ]],
    ]);

    const depletion = calculateBomDepletion(orderItems, recipeMap);

    expect(depletion.get('ing_coffee')).toBe(70); // 25*2 + 20*1
    expect(depletion.get('ing_milk')).toBe(60);   // 30*2
  });

  it('deducts ingredients and creates transactions', async () => {
    const { deductIngredientsForOrder } = await import('@aura/domain-inventory');

    const batchCalls: any[][] = [];
    const db = createMockDB();
    db.prepare = makeMockPrepare(
      { id: 'recipe_1' },
      [{ ingredient_id: 'ing_coffee', quantity: 25 }]
    ) as any;
    db.batch = vi.fn(async (ops: any[]) => {
      batchCalls.push(ops);
      return ops.map(() => ({ meta: { changes: 1 } }));
    }) as any;

    const env = { AURA_DB: db } as any;
    await deductIngredientsForOrder(env, 'order_1', [
      { product_id: 'prod_cafe_sua', quantity: 2 },
    ]);

    expect(batchCalls.length).toBe(1);
    expect(batchCalls[0].length).toBe(2); // UPDATE + INSERT
  });
});
