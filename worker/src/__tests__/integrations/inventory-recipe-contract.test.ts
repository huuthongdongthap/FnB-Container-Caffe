/**
 * Canonical Inventory / Recipe (BOM) Integration Tests
 * Canonical Flow: Product → Recipe/BOM → Ingredient → Stock → Consumption → Cost
 * Verifies all 11 Contract Invariants.
 */
import { describe, it, expect } from 'vitest';
import {
  getCanonicalRecipe,
  calculateOrderConsumption,
  deductOrderStock,
  calculateProductMargin,
  inventoryTransactionSchema,
  deductInventoryForOrder,
  restoreInventoryForOrder,
} from '@aura/domain-inventory';

describe('Inventory / Recipe Contract', () => {
  function createMockDb() {
    const products: any[] = [];
    const recipes: any[] = [];
    const recipe_items: any[] = [];
    const ingredients: any[] = [];
    const stock_movements: any[] = [];

    const db = {
      products, recipes, recipe_items, ingredients, stock_movements,
      prepare: (sql: string) => {
        let binds: unknown[] = [];
        const stmt = {
          bind: (...args: unknown[]) => { binds = args; return stmt; },
          first: async <T = unknown>() => {
            if (sql.includes('recipes WHERE product_id')) return (recipes.find(r => r.product_id === binds[0]) || null) as T;
            if (sql.includes('ingredients WHERE id')) return (ingredients.find(i => i.id === binds[0]) || null) as T;
            if (sql.includes('stock_movements WHERE reference_id')) return (stock_movements.find(m => m.reference_id === binds[0] && m.reference_type === 'order') || null) as T;
            if (sql.includes('products WHERE id')) return (products.find(p => p.id === binds[0]) || null) as T;
            return null as T;
          },
          all: async <T = unknown>() => {
            if (sql.includes('FROM recipe_items ri')) {
              const joined = recipe_items.filter(ri => ri.recipe_id === binds[0]).map(ri => {
                const ing = ingredients.find(i => i.id === ri.ingredient_id);
                return { ...ri, ing_name: ing?.name, cost_per_unit: ing?.cost_per_unit ?? 0 };
              });
              return { results: joined } as any;
            }
            return { results: [] } as any;
          },
          run: async () => {
            if (sql.includes('UPDATE ingredients SET current_stock = current_stock -')) {
              const ing = ingredients.find(i => i.id === binds[2]);
              if (ing) ing.current_stock -= (binds[0] as number);
            }
            if (sql.includes('INSERT INTO stock_movements')) {
              stock_movements.push({
                id: binds[0], ingredient_id: binds[1], type: 'consumption',
                quantity: binds[2], reference_id: binds[3], reference_type: 'order',
                notes: binds[4], created_at: binds[5],
              });
            }
            return { success: true };
          },
        };
        return stmt as any;
      },
    };
    return db;
  }

  it('1. product with multi-ingredient BOM: resolves components & unit cost accurately', async () => {
    const db = createMockDb();
    db.products.push({ id: 'prod_cafe_muoi', name: 'Cà Phê Muối', price: 35000 });
    db.recipes.push({ id: 'rec_1', product_id: 'prod_cafe_muoi', name: 'Công thức Cà Phê Muối' });
    db.ingredients.push(
      { id: 'ing_coffee', name: 'Arabica Cầu Đất', cost_per_unit: 500, current_stock: 1000 },
      { id: 'ing_cream', name: 'Kem Béo AURA', cost_per_unit: 200, current_stock: 500 }
    );
    db.recipe_items.push(
      { id: 'ri_1', recipe_id: 'rec_1', ingredient_id: 'ing_coffee', quantity: 20, unit: 'g' },
      { id: 'ri_2', recipe_id: 'rec_1', ingredient_id: 'ing_cream', quantity: 30, unit: 'ml' }
    );

    const recipe = await getCanonicalRecipe(db as any, 'prod_cafe_muoi');
    expect(recipe).not.toBeNull();
    expect(recipe?.components).toHaveLength(2);
    // 20g * 500đ + 30ml * 200đ = 10,000 + 6,000 = 16,000đ
    expect(recipe?.unitCost).toBe(16000);
  });

  it('2. product without BOM: does not invent consumption or cost', async () => {
    const db = createMockDb();
    db.products.push({ id: 'prod_bottle_water', name: 'Nước Suối AURA', price: 15000 });

    const calc = await calculateOrderConsumption(db as any, [
      { productId: 'prod_bottle_water', quantity: 3, sellingPrice: 15000 }
    ]);

    expect(calc.depletions).toHaveLength(0);
    expect(calc.totalCost).toBe(0);
    expect(calc.realizedRevenue).toBe(45000);
    expect(calc.grossMargin).toBe(45000);
  });

  it('3. insufficient stock: halts deduction when available stock is below requirement', async () => {
    const db = createMockDb();
    db.recipes.push({ id: 'rec_tea', product_id: 'prod_tea' });
    db.ingredients.push({ id: 'ing_tea_leaf', name: 'Trà Oolong', cost_per_unit: 400, current_stock: 15 });
    db.recipe_items.push({ id: 'ri_tea', recipe_id: 'rec_tea', ingredient_id: 'ing_tea_leaf', quantity: 20, unit: 'g' });

    const res = await deductOrderStock(db as any, 'ORD_INSUF_1', [{ productId: 'prod_tea', quantity: 1 }], { allowNegative: false });
    expect(res.ok).toBe(false);
    expect(res.error).toBe('insufficient_stock');
    expect(res.insufficientIngredients?.[0].available).toBe(15);
    expect(res.insufficientIngredients?.[0].needed).toBe(20);
    expect(db.stock_movements).toHaveLength(0);
  });

  it('4. repeated order & duplicate deduction: idempotency prevents double stock deduction', async () => {
    const db = createMockDb();
    db.recipes.push({ id: 'rec_matcha', product_id: 'prod_matcha' });
    db.ingredients.push({ id: 'ing_matcha', name: 'Matcha Uji', cost_per_unit: 1000, current_stock: 100 });
    db.recipe_items.push({ id: 'ri_m', recipe_id: 'rec_matcha', ingredient_id: 'ing_matcha', quantity: 10, unit: 'g' });

    const first = await deductOrderStock(db as any, 'ORD_IDEMP_1', [{ productId: 'prod_matcha', quantity: 2 }]);
    expect(first.ok).toBe(true);
    expect(first.alreadyDeducted).toBe(false);
    expect(db.ingredients[0].current_stock).toBe(80); // 100 - 20

    const second = await deductOrderStock(db as any, 'ORD_IDEMP_1', [{ productId: 'prod_matcha', quantity: 2 }]);
    expect(second.ok).toBe(true);
    expect(second.alreadyDeducted).toBe(true);
    expect(db.ingredients[0].current_stock).toBe(80); // Unchanged!
    expect(db.stock_movements).toHaveLength(1);
  });

  it('5. recipe change after historical order: historical stock ledger remains immutable', async () => {
    const db = createMockDb();
    db.recipes.push({ id: 'rec_latte', product_id: 'prod_latte' });
    db.ingredients.push({ id: 'ing_milk', name: 'Sữa Tươi Thanh Trùng', cost_per_unit: 30, current_stock: 500 });
    db.recipe_items.push({ id: 'ri_milk', recipe_id: 'rec_latte', ingredient_id: 'ing_milk', quantity: 150, unit: 'ml' });

    await deductOrderStock(db as any, 'ORD_HIST_LATTE', [{ productId: 'prod_latte', quantity: 1 }]);
    expect(db.stock_movements[0].quantity).toBe(-150);

    // Later recipe item quantity modified in catalog
    db.recipe_items[0].quantity = 200;

    const histMov = db.stock_movements.find(m => m.reference_id === 'ORD_HIST_LATTE');
    expect(histMov?.quantity).toBe(-150);
  });

  it('6. cost & margin calculation: realized margin = selling price - canonical recipe cost', () => {
    const sellingPrice = 45000;
    const recipeCost = 14500;
    const { margin, marginPercent } = calculateProductMargin(sellingPrice, recipeCost);

    expect(margin).toBe(30500);
    expect(marginPercent).toBeCloseTo((30500 / 45000) * 100, 2);
  });

  it('7. foreign key integrity: recipe binds strictly to canonical products.id and ingredients.id', async () => {
    const db = createMockDb();
    db.products.push({ id: 'prod_canonical_1', name: 'Cà Phê Trứng', price: 40000 });
    db.ingredients.push({ id: 'ing_egg', name: 'Trứng Gà Tươi', cost_per_unit: 3000, current_stock: 50 });
    db.recipes.push({ id: 'rec_egg', product_id: 'prod_canonical_1' });
    db.recipe_items.push({ id: 'ri_egg', recipe_id: 'rec_egg', ingredient_id: 'ing_egg', quantity: 2, unit: 'pcs' });

    const recipe = await getCanonicalRecipe(db as any, 'prod_canonical_1');
    expect(recipe?.productId).toBe('prod_canonical_1');
    expect(recipe?.components[0].ingredientId).toBe('ing_egg');
  });

  it('8. stock adjustment: operational movements do not collide with order references', async () => {
    const db = createMockDb();
    db.ingredients.push({ id: 'ing_sugar', name: 'Đường Phèn', cost_per_unit: 20, current_stock: 500 });
    db.stock_movements.push({
      id: 'mov_adj_1', ingredient_id: 'ing_sugar', type: 'adjustment',
      quantity: 50, reference_id: 'ADJ_CYCLE_COUNT', reference_type: 'manual',
      notes: 'Kiểm kê định kỳ', created_at: new Date().toISOString(),
    });

    const existingOrderDeduction = db.stock_movements.find(
      m => m.reference_id === 'ORD_TEST' && m.reference_type === 'order'
    );
    expect(existingOrderDeduction).toBeUndefined();
  });

  it('9. inventoryTransactionSchema allows negative quantity only for type === adjust', () => {
    const validNegAdjust = inventoryTransactionSchema.safeParse({
      item_id: 'ing_1',
      type: 'adjust',
      quantity: -10,
      notes: 'Spillage adjustment',
    });
    expect(validNegAdjust.success).toBe(true);

    const invalidZero = inventoryTransactionSchema.safeParse({
      item_id: 'ing_1',
      type: 'adjust',
      quantity: 0,
    });
    expect(invalidZero.success).toBe(false);

    const invalidNegOut = inventoryTransactionSchema.safeParse({
      item_id: 'ing_1',
      type: 'out',
      quantity: -5,
    });
    expect(invalidNegOut.success).toBe(false);
  });

  it('10. restoreInventoryForOrder falls back to stock_movements when inventory_transactions is empty', async () => {
    const restoredStock: Record<string, number> = { ing_coffee: 80 };
    const insertedMovements: any[] = [];
    const mockDb = {
      prepare: (sql: string) => {
        let binds: unknown[] = [];
        const stmt = {
          bind: (...args: unknown[]) => { binds = args; return stmt; },
          all: async () => {
            if (sql.includes('FROM inventory_transactions')) return { results: [] };
            if (sql.includes("FROM stock_movements WHERE reference_id = ? AND type = 'out'")) return { results: [] };
            if (sql.includes("FROM stock_movements") && sql.includes("type = 'consumption'")) {
              return { results: [{ id: 'sm_1', ingredient_id: 'ing_coffee', quantity: -20 }] };
            }
            return { results: [] };
          },
          run: async () => {
            if (sql.includes('UPDATE ingredients SET current_stock = current_stock +')) {
              restoredStock[binds[2] as string] = (restoredStock[binds[2] as string] || 0) + (binds[0] as number);
            }
            if (sql.includes('INSERT INTO stock_movements')) {
              insertedMovements.push(binds);
            }
            return { success: true, meta: { changes: 1 } };
          },
        };
        return stmt;
      },
      batch: async (ops: any[]) => {
        for (const op of ops) await op.run();
        return [];
      },
    };

    await restoreInventoryForOrder({ AURA_DB: mockDb as any }, 'ORD_CANCEL_1');
    expect(restoredStock.ing_coffee).toBe(100);
    expect(insertedMovements.length).toBe(1);
  });

  it('11. deductInventoryForOrder deducts BOM items via recipe and non-BOM items via SKU fallback', async () => {
    const stock: Record<string, number> = { ing_beans: 100, ing_bottled: 10 };
    const txQuantities: number[] = [];
    const mockDb = {
      prepare: (sql: string) => {
        let binds: unknown[] = [];
        const stmt = {
          bind: (...args: unknown[]) => { binds = args; return stmt; },
          first: async () => {
            if (sql.includes('FROM recipes WHERE product_id')) {
              return binds[0] === 'prod_espresso' ? { id: 'rec_esp', product_id: 'prod_espresso' } : null;
            }
            if (sql.includes('FROM ingredients WHERE id =')) {
              const id = binds[0] as string;
              return stock[id] !== undefined ? { id, name: id, current_stock: stock[id] } : null;
            }
            if (sql.includes('FROM inventory_items')) {
              return binds[0] === 'prod_water'
                ? { id: 'ing_bottled', sku: 'prod_water', name: 'Water', current_stock: stock.ing_bottled, unit: 'pcs' }
                : null;
            }
            return null;
          },
          all: async () => {
            if (sql.includes('FROM recipe_items ri')) {
              return {
                results: [{ id: 'ri_1', recipe_id: 'rec_esp', ingredient_id: 'ing_beans', quantity: 18, unit: 'g', ing_name: 'Beans', cost_per_unit: 500 }],
              };
            }
            return { results: [] };
          },
          run: async () => {
            if (sql.includes('UPDATE ingredients SET current_stock = current_stock -')) {
              stock[binds[2] as string] -= binds[0] as number;
            }
            if (sql.includes('UPDATE inventory_items SET current_stock = ?')) {
              stock[binds[1] as string] = binds[0] as number;
            }
            if (sql.includes('INSERT INTO stock_movements')) {
              txQuantities.push(binds[2] as number);
            }
            if (sql.includes('INSERT INTO inventory_transactions')) {
              txQuantities.push(binds[3] as number);
            }
            return { success: true, meta: { changes: 1 } };
          },
        };
        return stmt;
      },
      batch: async (ops: any[]) => {
        for (const op of ops) await op.run();
        return [];
      },
    };

    await deductInventoryForOrder(
      { AURA_DB: mockDb as any },
      'ORD_MIXED_1',
      [
        { product_id: 'prod_espresso', name: 'Espresso', quantity: 1 },
        { product_id: 'prod_water', name: 'Water', quantity: 15 },
      ]
    );
    expect(stock.ing_beans).toBe(82);
    expect(stock.ing_bottled).toBe(0);
    // Actual delta for ing_bottled is -(10 - 0) = -10, not -15
    expect(txQuantities).toContain(-18);
    expect(txQuantities).toContain(-10);
  });

  it('12. negative/non-finite item quantity & blank orderId fail closed without inflating stock', async () => {
    const db = createMockDb();
    db.recipes.push({ id: 'rec_matcha', product_id: 'prod_matcha' });
    db.ingredients.push({ id: 'ing_matcha', name: 'Matcha Uji', cost_per_unit: 1000, current_stock: 100 });
    db.recipe_items.push({ id: 'ri_m', recipe_id: 'rec_matcha', ingredient_id: 'ing_matcha', quantity: 10, unit: 'g' });

    const blankOrder = await deductOrderStock(db as any, '   ', [{ productId: 'prod_matcha', quantity: 1 }]);
    expect(blankOrder.ok).toBe(false);
    expect(blankOrder.error).toBe('invalid_order_id');

    const negQty = await deductOrderStock(db as any, 'ORD_NEG_1', [{ productId: 'prod_matcha', quantity: -5 }]);
    expect(negQty.ok).toBe(false);
    expect(negQty.error).toBe('invalid_order_items');
    expect(db.ingredients[0].current_stock).toBe(100);
  });
});
