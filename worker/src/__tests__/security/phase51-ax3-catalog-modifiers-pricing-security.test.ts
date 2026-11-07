/**
 * Phase 51 (AX3) — Catalog, Modifiers, Menu Projections & Dynamic Pricing Tenant Isolation Tests
 *
 * Covers:
 * - AX3-F1: Menu Modifiers & Customer Menu Modifier Projection Isolation
 *   - Caller-vs-header tenant verification in menuModifiersRouter (403 on cross-tenant override, 400 on '*' create)
 *   - Tenant-scoped syncModifierGroupAvailabilityToMenuProjection (with body.available / body.is_active)
 *   - Customer menu attachProductModifiers filtering by menu_modifiers.tenant_id even when modifier_groups is empty
 *   - Fail-closed matchesRowTenantIfPresent when tenant_id probe fails for non-'default' tenant
 * - AX3-F2: Categories Command & OpenAPI Category Handlers Tenant Isolation & Audit Attribution
 *   - Caller-vs-header tenant verification (403 on cross-tenant override, 400 on '*' create)
 *   - Blocking unscoped SQL .catch() fallbacks for non-'default' tenants
 *   - Direct tenant_id inclusion in audit_logs INSERT
 * - AX3-F3: OpenAPI Product Handlers & Menu Projection Category Join & Fallback Isolation
 *   - Caller-vs-header tenant verification (403 on cross-tenant override, 400 on '*' create)
 *   - Tenant-scoped LEFT JOIN categories c ON p.category_id = c.id AND tenant match
 *   - Blocking unscoped menu_items / menu_modifiers projection .catch() fallbacks for non-'default' tenants
 * - AX3-F4: Dynamic Pricing Rule Tenant Verification & Category Ownership Validation
 *   - Caller-vs-header tenant verification on GET/POST/DELETE /rules (403 on cross-tenant override)
 *   - Validating target_category against categories table tenant ownership (403 on foreign category)
 */

import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { OpenAPIHono } from '@hono/zod-openapi';
import { menuModifiersRouter } from '../../../../packages/domain/catalog/commands/menu-modifiers';
import { categoriesRouter } from '../../../../packages/domain/catalog/commands/categories';
import { getCustomerMenu } from '../../../../packages/domain/catalog/commands/get-customer-menu';
import {
  syncModifierGroupAvailabilityToMenuProjection,
  syncProductToMenuProjection,
  deleteProductProjection,
} from '../../../../packages/domain/catalog/policies/menu-projection';
import { fetchModifierChoice } from '../../../../packages/domain/catalog/policies/modifier-validation-queries';
import { registerCategoryMutationHandlers } from '../../routes/openapi-categories-handlers/mutation-handlers';
import { registerCategoryReadHandlers } from '../../routes/openapi-categories-handlers/read-handlers';
import { registerProductMutationHandlers } from '../../routes/openapi-products-handlers/mutation-handlers';
import { registerProductReadHandlers } from '../../routes/openapi-products-handlers/read-handlers';
import { dynamicPricingRouter } from '../../routes/dynamic-pricing';
import { issueStaffSession, type StaffAccount } from '../../lib/staff-session';
import type { Env } from '../../types/env';

const TEST_JWT_SECRET = 'phase51_ax3_test_jwt_secret_minimum_32_chars_ok';

const STAFF_ACCOUNTS: Record<string, StaffAccount> = {
  mgr_store_a: {
    id: 'mgr_store_a',
    name: 'Manager Store A',
    phone: null,
    role: 'manager',
    tenant_id: 'store_a',
    is_active: 1,
    auth_version: 1,
  },
  hq_admin_1: {
    id: 'hq_admin_1',
    name: 'HQ Super Admin',
    phone: null,
    role: 'owner',
    tenant_id: 'hq',
    is_active: 1,
    auth_version: 1,
  },
};

async function makeStaffToken(staffId: keyof typeof STAFF_ACCOUNTS): Promise<string> {
  const session = await issueStaffSession(
    { JWT_SECRET: TEST_JWT_SECRET },
    STAFF_ACCOUNTS[staffId],
    { sessionType: 'staff-web', email: `${staffId}@aura.cafe` }
  );
  return session.token;
}

describe('Phase 51 (AX3) — Catalog, Modifiers, Menu Projections & Dynamic Pricing Security', () => {
  describe('AX3-F1: Menu Modifiers, Projection Sync & Customer Menu Isolation', () => {
    it('rejects non-HQ staff cross-tenant X-Tenant-ID override on GET/POST /groups with 403 and HQ wildcard POST with 400', async () => {
      const app = new Hono<{ Bindings: Env }>();
      app.route('/api/modifiers', menuModifiersRouter);

      const storeAToken = await makeStaffToken('mgr_store_a');
      const hqToken = await makeStaffToken('hq_admin_1');

      const env = {
        JWT_SECRET: TEST_JWT_SECRET,
        AURA_DB: {
          prepare: (sql: string) => ({
            bind: (...args: unknown[]) => ({
              all: async () => ({ results: [] }),
              first: async () => {
                if (sql.includes('FROM users WHERE id = ?')) {
                  return STAFF_ACCOUNTS[String(args[0])] ?? null;
                }
                return null;
              },
              run: async () => ({ success: true }),
            }),
            all: async () => ({ results: [] }),
          }),
        },
      } as unknown as Env;

      // Non-HQ manager of store_a attempting to read store_b modifier groups via X-Tenant-ID
      const readRes = await app.request(
        '/api/modifiers/groups',
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${storeAToken}`,
            'X-Tenant-ID': 'store_b',
          },
        },
        env
      );
      expect(readRes.status).toBe(403);

      // Non-HQ manager of store_a attempting to create modifier group in store_b via X-Tenant-ID
      const writeRes = await app.request(
        '/api/modifiers/groups',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${storeAToken}`,
            'X-Tenant-ID': 'store_b',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ name: 'Topping', type: 'multiple' }),
        },
        env
      );
      expect(writeRes.status).toBe(403);

      // HQ admin attempting to create modifier group with wildcard '*' tenant
      const hqWildcardRes = await app.request(
        '/api/modifiers/groups',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${hqToken}`,
            'X-Tenant-ID': '*',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ name: 'Topping', type: 'multiple' }),
        },
        env
      );
      expect(hqWildcardRes.status).toBe(400);
    });

    it('scopes syncModifierGroupAvailabilityToMenuProjection by tenant_id and resolves group tenant when omitted', async () => {
      const executedSql: Array<{ sql: string; args: unknown[] }> = [];
      const db = {
        prepare(sql: string) {
          return {
            bind(...args: unknown[]) {
              return {
                first: async () => {
                  if (sql.includes('FROM modifier_groups')) {
                    return { tenant_id: 'store_b' };
                  }
                  return null;
                },
                run: async () => {
                  executedSql.push({ sql, args });
                  return { success: true };
                },
              };
            },
          };
        },
      };

      await syncModifierGroupAvailabilityToMenuProjection(db as any, 'grp_b1', 0);
      expect(executedSql.length).toBe(1);
      expect(executedSql[0].sql).toContain("COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?");
      expect(executedSql[0].args).toEqual(['grp_b1', 'store_b']);
    });

    it('filters customer menu modifierChoices by menu_modifiers.tenant_id even when modifier_groups is empty', async () => {
      const db = {
        prepare(sql: string) {
          const runQuery = async () => {
            if (sql.includes('FROM menu_items')) {
              return {
                results: [
                  {
                    id: 'prod_a1',
                    name: 'Latte A',
                    description: 'Rich espresso',
                    price: 45000,
                    category: 'coffee',
                    image_url: '',
                    tags: '[]',
                    available: 1,
                    tenant_id: 'store_a',
                  },
                ],
              };
            }
            if (sql.includes('FROM product_modifier_groups pm')) {
              return {
                results: [
                  {
                    product_id: 'prod_a1',
                    id: 'mod_a1',
                    group_id: 'grp_shared',
                    option_name: 'Extra Shot (Store A)',
                    price_delta: 10000,
                    tenant_id: 'store_a',
                  },
                  {
                    product_id: 'prod_a1',
                    id: 'mod_b1',
                    group_id: 'grp_shared',
                    option_name: 'Secret Topping (Store B)',
                    price_delta: 15000,
                    tenant_id: 'store_b',
                  },
                ],
              };
            }
            if (sql.includes('FROM modifier_groups')) {
              return { results: [] };
            }
            return { results: [] };
          };
          return {
            bind() {
              return {
                all: runQuery,
              };
            },
            all: runQuery,
          };
        },
      };

      const menu = await getCustomerMenu(db as any, { tenantId: 'store_a' });
      expect(menu.totalItems).toBe(1);
      expect(menu.categories).toHaveLength(1);
      expect(menu.categories[0].items[0].modifierChoices).toEqual([
        {
          id: 'mod_a1',
          group_id: 'grp_shared',
          option_name: 'Extra Shot (Store A)',
          price_delta: 10000,
        },
      ]);
    });

    it('fails closed in fetchModifierChoice when tenant_id probe fails for non-default tenant', async () => {
      const db = {
        prepare(sql: string) {
          return {
            bind() {
              return {
                first: async () => {
                  if (sql.includes('SELECT tenant_id')) {
                    throw new Error('no such column: tenant_id');
                  }
                  return {
                    id: 'choice_1',
                    group_id: 'grp_1',
                    name: 'Oat Milk',
                    price_delta: 10000,
                    is_available: 1,
                  };
                },
                all: async () => ({ results: [] }),
                run: async () => ({}),
              };
            },
          };
        },
      };

      // Non-default tenant must fail closed when tenant_id cannot be verified
      const nonDefaultChoice = await fetchModifierChoice(db, 'choice_1', null, 'store_b');
      expect(nonDefaultChoice).toBeNull();

      // Default tenant continues to resolve legacy unmigrated rows
      const defaultChoice = await fetchModifierChoice(db, 'choice_1', null, 'default');
      expect(defaultChoice).not.toBeNull();
      expect(defaultChoice?.id).toBe('choice_1');
    });
  });

  describe('AX3-F2: Categories Command & OpenAPI Category Handlers Isolation & Audit Attribution', () => {
    it('rejects cross-tenant X-Tenant-ID override in categoriesRouter and blocks unscoped SQL fallback for non-default tenant', async () => {
      const app = new Hono<{ Bindings: Env }>();
      app.route('/api/categories', categoriesRouter);

      const storeAToken = await makeStaffToken('mgr_store_a');

      let unscopedDeleteExecuted = false;
      const env = {
        JWT_SECRET: TEST_JWT_SECRET,
        AURA_DB: {
          prepare(sql: string) {
            return {
              bind(...args: unknown[]) {
                return {
                  first: async () => {
                    if (sql.includes('FROM users WHERE id = ?')) {
                      return STAFF_ACCOUNTS[String(args[0])] ?? null;
                    }
                    if (sql.includes('FROM categories WHERE id = ?')) {
                      return { id: 'cat_a1', name: 'Coffee', slug: 'coffee', tenant_id: 'store_a' };
                    }
                    if (sql.includes('COUNT(*)')) {
                      return { count: 0 };
                    }
                    return null;
                  },
                  all: async () => ({ results: [] }),
                  run: async () => {
                    if (sql.includes('DELETE FROM categories') && sql.includes('tenant_id')) {
                      throw new Error('simulated D1 tenant_id column failure');
                    }
                    if (sql === 'DELETE FROM categories WHERE id = ?') {
                      unscopedDeleteExecuted = true;
                    }
                    return { success: true };
                  },
                };
              },
            };
          },
        },
      } as unknown as Env;

      // Cross-tenant header override on GET /api/categories must return 403
      const crossReadRes = await app.request(
        '/api/categories',
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${storeAToken}`,
            'X-Tenant-ID': 'store_b',
          },
        },
        env
      );
      expect(crossReadRes.status).toBe(403);

      // Same-tenant DELETE when scoped DELETE throws must NOT fall back to unscoped DELETE for 'store_a'
      const deleteRes = await app.request(
        '/api/categories/cat_a1',
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${storeAToken}`,
            'X-Tenant-ID': 'store_a',
          },
        },
        env
      );
      expect(deleteRes.status).toBe(500);
      expect(unscopedDeleteExecuted).toBe(false);
    });

    it('includes tenant_id directly in audit_logs INSERT and enforces caller tenant on OpenAPI category handlers', async () => {
      const router = new OpenAPIHono<{ Bindings: Env }>();
      router.use('*', async (c, next) => {
        const authUser = c.req.header('x-test-user');
        if (authUser) {
          c.set('user' as never, JSON.parse(authUser) as never);
        }
        const ctxTenant = c.req.header('x-test-ctx-tenant');
        if (ctxTenant) {
          c.set('tenantId' as never, ctxTenant as never);
        }
        await next();
      });
      registerCategoryReadHandlers(router);
      registerCategoryMutationHandlers(router);

      const auditInserts: Array<{ sql: string; args: unknown[] }> = [];
      const env = {
        AURA_DB: {
          prepare(sql: string) {
            return {
              bind(...args: unknown[]) {
                return {
                  first: async () => {
                    if (sql.includes('SELECT c.* FROM categories c WHERE c.id = ?')) {
                      return {
                        id: args[0],
                        name: 'Matcha',
                        slug: 'matcha',
                        sort_order: 1,
                        tenant_id: 'store_a',
                      };
                    }
                    return null;
                  },
                  all: async () => ({ results: [] }),
                  run: async () => {
                    if (sql.includes('INSERT INTO audit_logs')) {
                      auditInserts.push({ sql, args });
                    }
                    return { success: true };
                  },
                };
              },
              all: async () => ({ results: [] }),
            };
          },
        },
      } as unknown as Env;

      const validCategoryPayload = {
        slug: 'matcha',
        type: 'drink',
        translations: [{ locale: 'vi', name: 'Matcha' }],
      };

      // Cross-tenant X-Tenant-ID override by store_a manager must return 403
      const forbiddenRes = await router.request(
        '/api/categories',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-test-user': JSON.stringify({ id: 'u_mgr_a', role: 'manager', tenant_id: 'store_a' }),
            'x-test-ctx-tenant': 'store_a',
            'X-Tenant-ID': 'store_b',
          },
          body: JSON.stringify(validCategoryPayload),
        },
        env
      );
      expect(forbiddenRes.status).toBe(403);

      // Valid store_a category creation writes tenant_id directly into audit_logs INSERT
      const createRes = await router.request(
        '/api/categories',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-test-user': JSON.stringify({ id: 'u_mgr_a', role: 'manager', tenant_id: 'store_a' }),
            'x-test-ctx-tenant': 'store_a',
            'X-Tenant-ID': 'store_a',
          },
          body: JSON.stringify(validCategoryPayload),
        },
        env
      );
      expect(createRes.status).toBe(201);
      expect(auditInserts.length).toBe(1);
      expect(auditInserts[0].sql).toContain('tenant_id');
      expect(auditInserts[0].args).toContain('store_a');
    });
  });

  describe('AX3-F3: OpenAPI Product Handlers & Menu Projection Category Join & Fallback Isolation', () => {
    it('scopes LEFT JOIN categories by tenant_id in syncProductToMenuProjection and blocks unscoped deleteProductProjection fallback for non-default tenant', async () => {
      const executedQueries: Array<{ sql: string; args: unknown[] }> = [];
      let unscopedMenuItemsDelete = false;

      const db = {
        prepare(sql: string) {
          return {
            bind(...args: unknown[]) {
              return {
                first: async () => {
                  executedQueries.push({ sql, args });
                  if (sql.includes('FROM products p') && sql.includes('LEFT JOIN categories c')) {
                    return {
                      id: 'prod_a1',
                      name: 'Cold Brew',
                      price: 55000,
                      category_id: 'cat_foreign',
                      category_slug: null,
                      is_available: 1,
                      tenant_id: 'store_a',
                    };
                  }
                  return null;
                },
                run: async () => {
                  executedQueries.push({ sql, args });
                  if (sql.includes('DELETE FROM menu_items WHERE id = ? AND')) {
                    throw new Error('simulated D1 error');
                  }
                  if (sql === 'DELETE FROM menu_items WHERE id = ?') {
                    unscopedMenuItemsDelete = true;
                  }
                  return { success: true };
                },
              };
            },
          };
        },
      };

      await syncProductToMenuProjection(db as any, 'prod_a1', 'store_a');
      expect(executedQueries[0].sql).toContain(
        "COALESCE(NULLIF(TRIM(c.tenant_id), ''), 'default') = COALESCE(NULLIF(TRIM(p.tenant_id), ''), 'default')"
      );

      await deleteProductProjection(db as any, 'prod_a1', 'store_a');
      expect(unscopedMenuItemsDelete).toBe(false);
    });

    it('enforces caller-vs-header tenant check and tenant-scoped category join on OpenAPI product handlers', async () => {
      const router = new OpenAPIHono<{ Bindings: Env }>();
      router.use('*', async (c, next) => {
        const authUser = c.req.header('x-test-user');
        if (authUser) {
          c.set('user' as never, JSON.parse(authUser) as never);
        }
        const ctxTenant = c.req.header('x-test-ctx-tenant');
        if (ctxTenant) {
          c.set('tenantId' as never, ctxTenant as never);
        }
        await next();
      });
      registerProductReadHandlers(router);
      registerProductMutationHandlers(router);

      const joinQueries: string[] = [];
      const env = {
        AURA_DB: {
          prepare(sql: string) {
            if (sql.includes('LEFT JOIN categories c')) {
              joinQueries.push(sql);
            }
            return {
              bind() {
                return {
                  first: async () => ({
                    id: 'prod_a1',
                    name: 'Espresso',
                    slug: 'espresso',
                    price: 35000,
                    category_id: 'cat_b',
                    category_name: null,
                    is_available: 1,
                    tenant_id: 'store_a',
                  }),
                  all: async () => ({ results: [] }),
                  run: async () => ({ success: true }),
                };
              },
            };
          },
        },
      } as unknown as Env;

      // Cross-tenant read by store_a staff requesting store_b must return 403
      const crossRead = await router.request(
        '/api/products/prod_a1',
        {
          method: 'GET',
          headers: {
            'x-test-user': JSON.stringify({ id: 'u_mgr_a', role: 'manager', tenant_id: 'store_a' }),
            'x-test-ctx-tenant': 'store_a',
            'X-Tenant-ID': 'store_b',
          },
        },
        env
      );
      expect(crossRead.status).toBe(403);

      // Same-tenant read uses tenant-scoped LEFT JOIN categories
      const validRead = await router.request(
        '/api/products/prod_a1',
        {
          method: 'GET',
          headers: {
            'x-test-user': JSON.stringify({ id: 'u_mgr_a', role: 'manager', tenant_id: 'store_a' }),
            'x-test-ctx-tenant': 'store_a',
            'X-Tenant-ID': 'store_a',
          },
        },
        env
      );
      expect(validRead.status).toBe(200);
      expect(joinQueries.some((q) => q.includes("COALESCE(NULLIF(TRIM(c.tenant_id), ''), 'default') = COALESCE(NULLIF(TRIM(p.tenant_id), ''), 'default')"))).toBe(true);
    });
  });

  describe('AX3-F4: Dynamic Pricing Rule Tenant Verification & Category Ownership Validation', () => {
    it('rejects cross-tenant X-Tenant-ID override on GET/POST/DELETE /rules and rejects foreign target_category', async () => {
      const app = new Hono<{ Bindings: Env }>();
      app.route('/api/pricing/dynamic', dynamicPricingRouter);

      const storeAToken = await makeStaffToken('mgr_store_a');

      const env = {
        JWT_SECRET: TEST_JWT_SECRET,
        AURA_DB: {
          prepare(sql: string) {
            return {
              bind(...args: unknown[]) {
                return {
                  first: async () => {
                    if (sql.includes('FROM users WHERE id = ?')) {
                      return STAFF_ACCOUNTS[String(args[0])] ?? null;
                    }
                    if (sql.includes('FROM dynamic_pricing_rules WHERE id = ?')) {
                      return { id: 'rule_b1', name: 'Store B Rule', tenant_id: 'store_b' };
                    }
                    return null;
                  },
                  all: async () => {
                    if (sql.includes('FROM categories WHERE id = ? OR slug = ?')) {
                      return {
                        results: [
                          { id: 'cat_b_only', slug: 'cat-b-only', tenant_id: 'store_b' },
                        ],
                      };
                    }
                    return { results: [] };
                  },
                  run: async () => ({ success: true }),
                };
              },
            };
          },
        },
      } as unknown as Env;

      // Cross-tenant GET /rules with X-Tenant-ID: store_b must return 403
      const getCrossRes = await app.request(
        '/api/pricing/dynamic/rules',
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${storeAToken}`,
            'X-Tenant-ID': 'store_b',
          },
        },
        env
      );
      expect(getCrossRes.status).toBe(403);

      // Cross-tenant POST /rules with X-Tenant-ID: store_b must return 403
      const postCrossRes = await app.request(
        '/api/pricing/dynamic/rules',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${storeAToken}`,
            'X-Tenant-ID': 'store_b',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: 'Happy Hour',
            rule_type: 'happy_hour',
            discount_percent: 15,
            start_time: '14:00',
            end_time: '17:00',
          }),
        },
        env
      );
      expect(postCrossRes.status).toBe(403);

      // Same-tenant POST /rules targeting a category owned by store_b must return 403
      const foreignCatRes = await app.request(
        '/api/pricing/dynamic/rules',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${storeAToken}`,
            'X-Tenant-ID': 'store_a',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: 'Category Flash',
            rule_type: 'category_flash',
            discount_percent: 20,
            target_category: 'cat-b-only',
            start_time: '14:00',
            end_time: '17:00',
          }),
        },
        env
      );
      expect(foreignCatRes.status).toBe(403);

      // DELETE /rules/:id on a foreign tenant rule must return 404
      const deleteForeignRes = await app.request(
        '/api/pricing/dynamic/rules/rule_b1',
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${storeAToken}`,
            'X-Tenant-ID': 'store_a',
          },
        },
        env
      );
      expect(deleteForeignRes.status).toBe(404);
    });
  });
});
