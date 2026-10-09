/**
 * Catalog Product -> Menu Projection Integration Tests
 * Verifies that:
 * 1. products is the single canonical product source of truth.
 * 2. menu_items is strictly a customer-facing read projection.
 * 3. Mutations (create, update, toggle availability, soft-delete, hard-delete)
 *    synchronize deterministically without drift.
 * 4. GET /api/menu preserves its public customer contract.
 */

import { describe, it, expect } from 'vitest';
import { app } from '../../index';
import { generateJWT } from '../../lib/jwt';
import { reconcileAllMenuProjections } from '@aura/domain-catalog';
import {
  createProjectionTestEnv,
  TEST_SECRET,
  TEST_CAT_ID,
} from './catalog-projection-test-helpers';

describe('Catalog Product -> Menu Projection Synchronization', () => {
  it('synchronizes creation: inserts canonical product and projects into menu_items', async () => {
    const { env, products, menuItems } = createProjectionTestEnv();
    const token = await generateJWT({ id: 'mgr-1', role: 'manager', name: 'Manager' }, TEST_SECRET, 3600);

    const res = await app.fetch(
      new Request('https://test.aura/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          name: 'Cà phê Muối AURA',
          slug: 'ca-phe-muoi-aura',
          price: 29000,
          compare_at_price: 35000,
          category_id: TEST_CAT_ID,
          description: 'Cà phê muối béo ngậy',
          image_url: 'https://test.aura/img/muoi.jpg',
          is_available: true,
        }),
      }),
      env
    );

    expect(res.status).toBe(201);
    const body = (await res.json()) as any;
    expect(body.success).toBe(true);

    const prodId = body.data.id;
    expect(products.has(prodId)).toBe(true);
    expect(products.get(prodId).compare_at_price).toBe(35000);

    const projected = menuItems.get(prodId);
    expect(projected).toBeDefined();
    expect(projected.name).toBe('Cà phê Muối AURA');
    expect(projected.price).toBe(29000);
    expect(projected.category).toBe('coffee-slug');
    expect(projected.available).toBe(1);
    expect((projected as any).compare_at_price).toBeUndefined();

    // Verify public GET /api/menu exposes the projected item
    const menuRes = await app.fetch(new Request('https://test.aura/api/menu'), env);
    expect(menuRes.status).toBe(200);
    const menuBody = (await menuRes.json()) as any;
    const cat = menuBody.data.categories.find((c: any) => c.name === 'coffee-slug');
    expect(cat).toBeDefined();
    const menuItem = cat.items.find((m: any) => m.id === prodId);
    expect(menuItem).toBeDefined();
    expect(menuItem.priceCents).toBe(29000);
  });

  it('synchronizes update: modifies master and re-projects customer fields', async () => {
    const { env, products, menuItems } = createProjectionTestEnv();
    const token = await generateJWT({ id: 'mgr-1', role: 'manager', name: 'Manager' }, TEST_SECRET, 3600);
    const prodId = 'prod-test-update';

    products.set(prodId, {
      id: prodId,
      name: 'Original Name',
      slug: 'orig-slug',
      price: 20000,
      category_id: TEST_CAT_ID,
      is_available: 1,
    });
    menuItems.set(prodId, {
      id: prodId,
      category: 'coffee-slug',
      name: 'Original Name',
      price: 20000,
      available: 1,
    });

    const res = await app.fetch(
      new Request(`https://test.aura/api/products/${prodId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          name: 'Updated Name',
          price: 26000,
          description: 'Fresh description',
        }),
      }),
      env
    );

    expect(res.status).toBe(200);
    expect(products.get(prodId).name).toBe('Updated Name');
    expect(products.get(prodId).price).toBe(26000);

    const projected = menuItems.get(prodId);
    expect(projected.name).toBe('Updated Name');
    expect(projected.price).toBe(26000);
  });

  it('synchronizes deletion: soft-delete hides from projection, hard-delete removes', async () => {
    const { env, products, menuItems, setOrderItemsCount } = createProjectionTestEnv();
    const token = await generateJWT({ id: 'mgr-1', role: 'manager', name: 'Manager' }, TEST_SECRET, 3600);
    const p1 = 'prod-soft-del';
    const p2 = 'prod-hard-del';

    products.set(p1, { id: p1, name: 'P1', is_available: 1, category_id: TEST_CAT_ID });
    menuItems.set(p1, { id: p1, name: 'P1', available: 1, category: 'coffee-slug' });
    products.set(p2, { id: p2, name: 'P2', is_available: 1, category_id: TEST_CAT_ID });
    menuItems.set(p2, { id: p2, name: 'P2', available: 1, category: 'coffee-slug' });

    // 1. Soft-delete when referenced in order_items
    setOrderItemsCount(5);
    const softRes = await app.fetch(
      new Request(`https://test.aura/api/products/${p1}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      }),
      env
    );
    expect(softRes.status).toBe(200);
    expect(products.has(p1)).toBe(true);
    expect(products.get(p1).is_available).toBe(0);
    expect(menuItems.get(p1).available).toBe(0);

    // 2. Hard-delete when not referenced
    setOrderItemsCount(0);
    const hardRes = await app.fetch(
      new Request(`https://test.aura/api/products/${p2}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      }),
      env
    );
    expect(hardRes.status).toBe(200);
    expect(products.has(p2)).toBe(false);
    expect(menuItems.has(p2)).toBe(false);
  });

  it('heals drift: reconcileAllMenuProjections projects all canonical products into menu_items', async () => {
    const { env, products, menuItems } = createProjectionTestEnv();
    products.set('p1', { id: 'p1', name: 'P1', price: 10000, is_available: 1, category_id: TEST_CAT_ID });
    products.set('p2', { id: 'p2', name: 'P2', price: 20000, is_available: 0, category_id: TEST_CAT_ID });
    menuItems.clear(); // Simulate drift / unpopulated projection

    const { count } = await reconcileAllMenuProjections(env.AURA_DB);
    expect(count).toBe(2);
    expect(menuItems.has('p1')).toBe(true);
    expect(menuItems.get('p1').available).toBe(1);
    expect(menuItems.has('p2')).toBe(true);
    expect(menuItems.get('p2').available).toBe(0);
  });
});
