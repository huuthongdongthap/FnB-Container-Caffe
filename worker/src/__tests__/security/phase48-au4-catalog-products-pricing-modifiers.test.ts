import { describe, it, expect, vi } from 'vitest';
import { productsRouter } from '../../../../packages/domain/catalog/commands/products';
import { validateProductModifiers } from '../../../../packages/domain/catalog/policies/modifier-validation';
import { resolveServerProductPrice } from '../../../../packages/domain/catalog/policies/pricing-resolver';
import { computeTier } from '../../../../packages/domain/crm/commands/compute-tier';
import type { LoyaltyPolicy } from '../../../../packages/domain/crm/commands/loyalty-policy';
import { generateJWT } from '../../lib/jwt';
import { createMockEnv, isStaffAccountLookup, staffSessionClaims } from '../test-utils';

const TEST_JWT_SECRET = 'test-jwt-secret-at-least-16-chars-long';

async function makeStaffRequest(
  method: string,
  path: string,
  role: string,
  tenantId: string,
  body?: unknown,
  extraHeaders?: Record<string, string>,
): Promise<Request> {
  const token = await generateJWT(
    {
      id: `user-${role}-${tenantId}`,
      sub: `user-${role}-${tenantId}`,
      role,
      name: `${role} (${tenantId})`,
      tenantId,
      ...staffSessionClaims(),
    },
    TEST_JWT_SECRET,
    3600,
  );
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    ...extraHeaders,
  };
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  return new Request(`https://api.test${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

describe('Phase 48 Slice AU4 — Catalog Products RBAC/Tenant Isolation, Modifier Validation & Pricing/Tier Invariants', () => {
  describe('Catalog Products CRUD RBAC & Multi-Tenant Isolation', () => {
    function buildCatalogMockEnv() {
      const categories = [
        { id: 'cat-a', name: 'Store A Coffee', slug: 'coffee', sort_order: 1, tenant_id: 'store-a' },
        { id: 'cat-b', name: 'Store B Secret Category', slug: 'secret', sort_order: 1, tenant_id: 'store-b' },
      ];
      const products: Array<Record<string, unknown>> = [
        {
          id: 'prod-a',
          name: 'Store A Espresso',
          slug: 'espresso',
          price: 35000,
          category_id: 'cat-b', // points to Store B category ID to test cross-tenant LEFT JOIN protection
          is_available: 1,
          sort_order: 1,
          tenant_id: 'store-a',
        },
        {
          id: 'prod-b',
          name: 'Store B Espresso',
          slug: 'espresso-b',
          price: 45000,
          category_id: 'cat-b',
          is_available: 1,
          sort_order: 1,
          tenant_id: 'store-b',
        },
      ];
      const orderItems: Array<{ product_id: string; tenant_id: string }> = [
        // Store B has an order item referencing prod-a's ID, but Store A has 0 order items
        { product_id: 'prod-a', tenant_id: 'store-b' },
      ];
      const executedSql: Array<{ sql: string; args: unknown[] }> = [];

      const makeStmt = (sql: string, args: unknown[] = []) => ({
        first: vi.fn(async () => {
          executedSql.push({ sql, args });
          if (isStaffAccountLookup(sql)) {
            const uid = String(args[0] ?? '');
            const parts = uid.split('-');
            const role = parts[1] || 'staff';
            const tenant = parts.slice(2).join('-') || 'default';
            return {
              id: uid,
              name: uid,
              role,
              tenant_id: tenant,
              is_active: 1,
              auth_version: 1,
            };
          }
          if (/FROM categories WHERE id = \?/i.test(sql)) {
            return categories.find((c) => c.id === args[0]) ?? null;
          }
          if (/FROM products p LEFT JOIN categories c/i.test(sql) && /WHERE p\.id = \?/i.test(sql)) {
            const pid = String(args[0] ?? '');
            const prod = products.find((p) => p.id === pid);
            if (!prod) return null;
            const cat = categories.find((c) => c.id === prod.category_id);
            const joinScopesTenant = /COALESCE\(NULLIF\(TRIM\(c\.tenant_id\)/i.test(sql);
            const sameTenant = cat && cat.tenant_id === prod.tenant_id;
            return {
              ...prod,
              category_name: joinScopesTenant ? (sameTenant ? cat?.name ?? null : null) : (cat?.name ?? null),
            };
          }
          if (/SELECT \* FROM products WHERE id = \?/i.test(sql)) {
            return products.find((p) => p.id === args[0]) ?? null;
          }
          if (/SELECT COUNT\(\*\) as count FROM order_items/i.test(sql)) {
            const pid = String(args[0] ?? '');
            if (sql.includes('tenant_id')) {
              const t = String(args[1] ?? 'default');
              const count = orderItems.filter((oi) => oi.product_id === pid && (t === '*' || oi.tenant_id === t)).length;
              return { count };
            }
            const count = orderItems.filter((oi) => oi.product_id === pid).length;
            return { count };
          }
          return null;
        }),
        all: vi.fn(async () => {
          executedSql.push({ sql, args });
          if (/FROM products p LEFT JOIN categories c/i.test(sql)) {
            const joinScopesTenant = /COALESCE\(NULLIF\(TRIM\(c\.tenant_id\)/i.test(sql);
            const rows = products.map((prod) => {
              const cat = categories.find((c) => c.id === prod.category_id);
              const sameTenant = cat && cat.tenant_id === prod.tenant_id;
              return {
                ...prod,
                category_name: joinScopesTenant ? (sameTenant ? cat?.name ?? null : null) : (cat?.name ?? null),
              };
            });
            return { results: rows };
          }
          return { results: [] };
        }),
        run: vi.fn(async () => {
          executedSql.push({ sql, args });
          if (/DELETE FROM products/i.test(sql)) {
            const pid = String(args[0] ?? '');
            const idx = products.findIndex((p) => p.id === pid);
            if (idx >= 0) products.splice(idx, 1);
          }
          if (/UPDATE products SET/i.test(sql) && /price=\?/i.test(sql)) {
            const price = Number(args[3]);
            const pid = String(args[args.length - 3] ?? '');
            const prod = products.find((p) => p.id === pid);
            if (prod) prod.price = price;
          }
          return { success: true, meta: { changes: 1 } };
        }),
      });

      const db = {
        prepare: vi.fn((sql: string) => ({
          ...makeStmt(sql, []),
          bind: vi.fn((...args: unknown[]) => makeStmt(sql, args)),
        })),
      };

      const env = createMockEnv({
        JWT_SECRET: TEST_JWT_SECRET,
        AURA_DB: db as any,
      });

      return { env, products, executedSql };
    }

    it('rejects floor staff role with 403 on POST, PUT, PATCH, and DELETE /api/products, and rejects supervisor on PUT/PATCH/DELETE', async () => {
      const { env } = buildCatalogMockEnv();

      const staffPost = await makeStaffRequest('POST', '/', 'staff', 'store-a', {
        name: 'Tampered Free Drink',
        price: 0,
        category_id: 'cat-a',
      });
      expect((await productsRouter.fetch(staffPost, env)).status).toBe(403);

      const staffPatch = await makeStaffRequest('PATCH', '/prod-a', 'staff', 'store-a', {
        price: 0,
      });
      expect((await productsRouter.fetch(staffPatch, env)).status).toBe(403);

      const staffPut = await makeStaffRequest('PUT', '/prod-a', 'staff', 'store-a', {
        name: 'Repriced Espresso',
        price: 0,
      });
      expect((await productsRouter.fetch(staffPut, env)).status).toBe(403);

      const staffDelete = await makeStaffRequest('DELETE', '/prod-a', 'staff', 'store-a');
      expect((await productsRouter.fetch(staffDelete, env)).status).toBe(403);

      // Supervisor cannot reprice or delete existing catalog products
      const supPatch = await makeStaffRequest('PATCH', '/prod-a', 'supervisor', 'store-a', {
        price: 1000,
      });
      expect((await productsRouter.fetch(supPatch, env)).status).toBe(403);

      const supDelete = await makeStaffRequest('DELETE', '/prod-a', 'supervisor', 'store-a');
      expect((await productsRouter.fetch(supDelete, env)).status).toBe(403);

      // Manager in store-a can update store-a product
      const mgrPatch = await makeStaffRequest('PATCH', '/prod-a', 'manager', 'store-a', {
        price: 39000,
      });
      expect((await productsRouter.fetch(mgrPatch, env)).status).toBe(200);
    });

    it('rejects cross-tenant header/query override on product mutations and scopes LEFT JOIN categories & order_items by tenant', async () => {
      const { env, products, executedSql } = buildCatalogMockEnv();

      // Store A manager attempting to mutate with X-Tenant-ID: store-b is rejected with 403
      const spoofedPatch = await makeStaffRequest(
        'PATCH',
        '/prod-a',
        'manager',
        'store-a',
        { price: 20000 },
        { 'X-Tenant-ID': 'store-b' },
      );
      expect((await productsRouter.fetch(spoofedPatch, env)).status).toBe(403);

      // GET /:id for prod-a (in store-a, whose category_id points to store-b's cat-b) must NOT leak store-b's category_name
      const getProdRes = await productsRouter.fetch(
        await makeStaffRequest('GET', '/prod-a', 'manager', 'store-a'),
        env,
      );
      expect(getProdRes.status).toBe(200);
      const getProdJson = (await getProdRes.json()) as { data: { id: string; category_name: string | null } };
      expect(getProdJson.data.id).toBe('prod-a');
      expect(getProdJson.data.category_name).toBeNull();

      // GET / pushes tenant_id filter and LIMIT 500 into SQL
      const listRes = await productsRouter.fetch(
        await makeStaffRequest('GET', '/', 'manager', 'store-a'),
        env,
      );
      expect(listRes.status).toBe(200);
      expect(
        executedSql.some(
          (q) =>
            /FROM products p LEFT JOIN categories c/i.test(q.sql) &&
            /COALESCE\(NULLIF\(TRIM\(p\.tenant_id\)/i.test(q.sql) &&
            /LIMIT 500/i.test(q.sql) &&
            q.args.includes('store-a'),
        ),
      ).toBe(true);

      // DELETE /prod-a scopes order_items count by store-a (ignoring store-b's order_items row) and hard-deletes prod-a
      const delRes = await productsRouter.fetch(
        await makeStaffRequest('DELETE', '/prod-a', 'manager', 'store-a'),
        env,
      );
      expect(delRes.status).toBe(200);
      expect(products.find((p) => p.id === 'prod-a')).toBeUndefined();
    });
  });

  describe('Modifier Validation Policy — Canonical Choice Deduplication, Required Groups & !db Delta Guard', () => {
    function buildModifierDb(options?: { requiredGroupActive?: boolean; requiredGroupTenant?: string; minSelections?: number }) {
      const reqActive = options?.requiredGroupActive ?? true;
      const reqTenant = options?.requiredGroupTenant ?? 'store-a';
      const minSelections = options?.minSelections ?? 1;

      const choices = [
        { id: 'mc_extra_shot', group_id: 'mg_addons', name: 'Extra Shot', price_delta: 10000, is_available: 1, tenant_id: 'store-a' },
        { id: 'mc_oat_milk', group_id: 'mg_addons', name: 'Oat Milk', price_delta: 12000, is_available: 1, tenant_id: 'store-a' },
        { id: 'mc_size_l', group_id: 'mg_size', name: 'Size L', price_delta: 8000, is_available: 1, tenant_id: 'store-a' },
        { id: 'mc_size_m', group_id: 'mg_size', name: 'Size M', price_delta: 0, is_available: 1, tenant_id: 'store-a' },
      ];
      const groups = [
        { id: 'mg_addons', name: 'Add-ons', type: 'multiple' as const, required: 0, is_active: 1, tenant_id: 'store-a' },
        {
          id: 'mg_size',
          name: 'Cup Size',
          type: (minSelections > 1 ? 'multiple' : 'single') as 'single' | 'multiple',
          required: 1,
          min_selections: minSelections,
          is_active: reqActive ? 1 : 0,
          tenant_id: reqTenant,
        },
      ];
      const links = [
        { product_id: 'prod-latte', group_id: 'mg_addons' },
        { product_id: 'prod-latte', group_id: 'mg_size' },
      ];

      return {
        prepare(sql: string) {
          return {
            bind(...args: unknown[]) {
              return {
                async first<T = unknown>(): Promise<T | null> {
                  if (sql.includes('FROM modifier_choices WHERE id = ?')) {
                    return (choices.find((c) => c.id === args[0]) as unknown as T) ?? null;
                  }
                  if (sql.includes('FROM modifier_choices WHERE name = ?')) {
                    return (choices.find((c) => c.name === args[0]) as unknown as T) ?? null;
                  }
                  if (sql.includes('SELECT tenant_id FROM modifier_choices WHERE id = ?')) {
                    const found = choices.find((c) => c.id === args[0]);
                    return found ? ({ tenant_id: found.tenant_id } as unknown as T) : null;
                  }
                  if (sql.includes('FROM modifier_groups WHERE id = ?')) {
                    return (groups.find((g) => g.id === args[0]) as unknown as T) ?? null;
                  }
                  if (sql.includes('SELECT tenant_id FROM modifier_groups WHERE id = ?')) {
                    const found = groups.find((g) => g.id === args[0]);
                    return found ? ({ tenant_id: found.tenant_id } as unknown as T) : null;
                  }
                  if (sql.includes('FROM product_modifier_groups WHERE product_id = ? AND group_id = ?')) {
                    return (links.find((l) => l.product_id === args[0] && l.group_id === args[1]) as unknown as T) ?? null;
                  }
                  return null;
                },
                async all<T = unknown>(): Promise<{ results?: T[] }> {
                  if (sql.includes('FROM product_modifier_groups pm') && sql.includes('JOIN modifier_groups mg')) {
                    const pid = String(args[0] ?? '');
                    const matched = links
                      .filter((l) => l.product_id === pid)
                      .map((l) => groups.find((g) => g.id === l.group_id))
                      .filter(Boolean) as unknown as T[];
                    return { results: matched };
                  }
                  return { results: [] };
                },
                async run() {
                  return { success: true };
                },
              };
            },
          };
        },
      };
    }

    it('rejects duplicate modifier choices submitted via id + name aliasing in either order', async () => {
      const db = buildModifierDb({ requiredGroupActive: false });

      const idThenName = await validateProductModifiers(
        db,
        'prod-latte',
        [{ id: 'mc_extra_shot' }, { name: 'Extra Shot' }],
        ['prod-latte'],
        'store-a',
      );
      expect(idThenName.valid).toBe(false);
      expect(idThenName.rejection?.code).toBe('duplicate_modifier');

      const nameThenId = await validateProductModifiers(
        db,
        'prod-latte',
        [{ name: 'Extra Shot' }, { id: 'mc_extra_shot' }],
        ['prod-latte'],
        'store-a',
      );
      expect(nameThenId.valid).toBe(false);
      expect(nameThenId.rejection?.code).toBe('duplicate_modifier');
    });

    it('enforces active required modifier groups when modifiers are empty or omit the required group, while ignoring inactive or foreign-tenant groups', async () => {
      const db = buildModifierDb({ requiredGroupActive: true, requiredGroupTenant: 'store-a', minSelections: 1 });

      // Empty modifiers array must fail when prod-latte has an active required group (mg_size)
      const emptyRes = await validateProductModifiers(db, 'prod-latte', [], ['prod-latte'], 'store-a');
      expect(emptyRes.valid).toBe(false);
      expect(emptyRes.rejection?.code).toBe('invalid_modifier');
      expect(emptyRes.rejection?.message).toContain('Cup Size');

      // Selecting only optional mg_addons while omitting required mg_size must fail
      const optionalOnlyRes = await validateProductModifiers(
        db,
        'prod-latte',
        [{ id: 'mc_extra_shot' }],
        ['prod-latte'],
        'store-a',
      );
      expect(optionalOnlyRes.valid).toBe(false);
      expect(optionalOnlyRes.rejection?.code).toBe('invalid_modifier');

      // Selecting required mg_size succeeds
      const satisfiedRes = await validateProductModifiers(
        db,
        'prod-latte',
        [{ id: 'mc_size_l' }, { id: 'mc_extra_shot' }],
        ['prod-latte'],
        'store-a',
      );
      expect(satisfiedRes.valid).toBe(true);
      expect(satisfiedRes.modifierDelta).toBe(18000);

      // Foreign-tenant required group (store-b) does not block store-a orders
      const foreignGroupDb = buildModifierDb({ requiredGroupActive: true, requiredGroupTenant: 'store-b' });
      const foreignRes = await validateProductModifiers(foreignGroupDb, 'prod-latte', [], ['prod-latte'], 'store-a');
      expect(foreignRes.valid).toBe(true);
    });

    it('rejects NaN or negative clientDelta when !db fallback is used', async () => {
      const nanRes = await validateProductModifiers(null, 'prod-1', [{ id: 'mc-1', name: 'Bad', price_delta: 'not-a-number' }]);
      expect(nanRes.valid).toBe(false);
      expect(nanRes.rejection?.code).toBe('invalid_modifier');

      const negRes = await validateProductModifiers(null, 'prod-1', [{ id: 'mc-1', name: 'Discount Hack', price_delta: -25000 }]);
      expect(negRes.valid).toBe(false);
      expect(negRes.rejection?.code).toBe('invalid_modifier');

      const validOfflineRes = await validateProductModifiers(null, 'prod-1', [{ id: 'mc-1', name: 'Extra Ice', price_delta: 5000 }]);
      expect(validOfflineRes.valid).toBe(true);
      expect(validOfflineRes.modifierDelta).toBe(5000);
    });
  });

  describe('Server Pricing Resolver & CRM Tier Computation Invariants', () => {
    it('clamps unitPriceCents to >= 0 and sanitizes non-finite channelDeltas and fallbackPrice in resolveServerProductPrice', async () => {
      const negChannelRes = await resolveServerProductPrice(null, {
        productId: 'prod-espresso',
        fallbackPrice: 30000,
        channel: 'delivery',
        channelDeltas: {
          dine_in: 0,
          takeaway: 0,
          delivery: -50000,
          online: 0,
        },
      });
      expect(negChannelRes.available).toBe(true);
      expect(negChannelRes.unitPriceCents).toBe(0);

      const nanChannelRes = await resolveServerProductPrice(null, {
        productId: 'prod-espresso',
        fallbackPrice: Number.NaN,
        channel: 'delivery',
        channelDeltas: {
          dine_in: 0,
          takeaway: 0,
          delivery: Number.NaN,
          online: Number.POSITIVE_INFINITY,
        },
      });
      expect(Number.isFinite(nanChannelRes.basePriceCents)).toBe(true);
      expect(nanChannelRes.basePriceCents).toBe(0);
      expect(Number.isFinite(nanChannelRes.channelDelta)).toBe(true);
      expect(nanChannelRes.channelDelta).toBe(0);
      expect(Number.isFinite(nanChannelRes.unitPriceCents)).toBe(true);
      expect(nanChannelRes.unitPriceCents).toBe(0);
    });

    it('sorts unsorted policy.tiers ascending by minPoints and normalizes negative/NaN lifetimePoints in computeTier', () => {
      const unsortedPolicy: LoyaltyPolicy = {
        pointsPerVnd: 1000,
        defaultTier: { tierName: 'bronze', minPoints: 0, multiplier: 1, discountPercent: 0 },
        tiers: [
          { tierName: 'platinum', minPoints: 2000, multiplier: 2.0, discountPercent: 15 },
          { tierName: 'bronze', minPoints: 0, multiplier: 1.0, discountPercent: 0 },
          { tierName: 'gold', minPoints: 1000, multiplier: 1.5, discountPercent: 10 },
          { tierName: 'silver', minPoints: 300, multiplier: 1.2, discountPercent: 5 },
        ],
      };

      const goldResult = computeTier(1200, 'silver', unsortedPolicy);
      expect(goldResult.tierName).toBe('gold');
      expect(goldResult.changed).toBe(true);
      expect(goldResult.nextTier).toEqual({
        name: 'platinum',
        minPoints: 2000,
        pointsNeeded: 800,
      });

      const negativeResult = computeTier(-500, 'bronze', unsortedPolicy);
      expect(negativeResult.tierName).toBe('bronze');
      expect(negativeResult.lifetimePoints).toBe(0);
      expect(negativeResult.nextTier).toEqual({
        name: 'silver',
        minPoints: 300,
        pointsNeeded: 300,
      });

      const nanResult = computeTier(Number.NaN, null, unsortedPolicy);
      expect(nanResult.tierName).toBe('bronze');
      expect(nanResult.lifetimePoints).toBe(0);
      expect(Number.isFinite(nanResult.nextTier?.pointsNeeded)).toBe(true);
      expect(nanResult.nextTier?.pointsNeeded).toBe(300);
    });
  });
});
