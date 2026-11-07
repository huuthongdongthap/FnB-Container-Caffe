import { describe, it, expect } from 'vitest';
import { happyHourRouter } from '../../../../packages/domain/catalog/commands/happy-hour';
import { menuModifiersRouter } from '../../../../packages/domain/catalog/commands/menu-modifiers';
import {
  getCustomerMenu,
  getCustomerMenuItem,
} from '../../../../packages/domain/catalog/commands/get-customer-menu';
import {
  mapModifierChoiceToProjection,
  syncModifierGroupAvailabilityToMenuProjection,
} from '../../../../packages/domain/catalog/policies/menu-projection';
import { resolveItemPrice } from '../../../../packages/domain/catalog/policies/pricing';
import { generateJWT } from '../../lib/jwt';
import type { Env } from '../../types/env';

const TEST_SECRET = 'phase47-at4-jwt-secret-minimum-32-chars!!';

async function makeToken(
  role: string,
  tenantId: string = 'default',
  id: string = `user-${role}-${tenantId}`,
): Promise<string> {
  return generateJWT(
    {
      id,
      sub: id,
      role,
      email: `${id}@aura.test`,
      name: `Actor ${id}`,
      tenantId,
      ...(role === 'customer'
        ? {}
        : { authVersion: 1, authTime: Math.floor(Date.now() / 1000), sessionType: 'staff-web' }),
    } as any,
    TEST_SECRET,
    3600,
  );
}

function normTenant(t: unknown): string {
  const s = typeof t === 'string' ? t.trim() : '';
  return s || 'default';
}

function createInMemoryCatalogD1() {
  const users: Array<Record<string, any>> = [
    {
      id: 'user-manager-default',
      name: 'Default Manager',
      phone: '0900000001',
      role: 'manager',
      tenant_id: 'default',
      is_active: 1,
      auth_version: 1,
    },
    {
      id: 'user-manager-store-b',
      name: 'Store B Manager',
      phone: '0900000002',
      role: 'manager',
      tenant_id: 'store-b',
      is_active: 1,
      auth_version: 1,
    },
  ];
  const happyHourWindows: Array<Record<string, any>> = [];
  const menuItems: Array<Record<string, any>> = [];
  const modifierGroups: Array<Record<string, any>> = [];
  const modifierChoices: Array<Record<string, any>> = [];
  const productModifierGroups: Array<Record<string, any>> = [];
  const menuModifiers: Array<Record<string, any>> = [];

  const execute = (sql: string, args: unknown[]) => {
    const s = sql.replace(/\s+/g, ' ').trim();

    if (/SELECT .* FROM users WHERE id = \?/i.test(s)) {
      return users.filter((u) => u.id === args[0]);
    }

    if (/INSERT INTO happy_hour_windows/i.test(s)) {
      const [
        id,
        name,
        day_of_week,
        start_time,
        end_time,
        discount_rate,
        apply_to,
        apply_ids,
        priority,
        active,
        tenant_id,
        created_at,
        updated_at,
      ] = args;
      happyHourWindows.push({
        id,
        name,
        day_of_week,
        start_time,
        end_time,
        discount_rate,
        apply_to,
        apply_ids,
        priority,
        active,
        tenant_id: tenant_id ?? 'default',
        created_at,
        updated_at,
      });
      return [];
    }

    if (/SELECT \* FROM happy_hour_windows WHERE id = \?/i.test(s)) {
      return happyHourWindows.filter((w) => w.id === args[0]);
    }

    if (/SELECT \* FROM happy_hour_windows WHERE active = 1/i.test(s)) {
      return happyHourWindows.filter((w) => w.active === 1);
    }

    if (/UPDATE happy_hour_windows/i.test(s)) {
      const [
        name,
        day_of_week,
        start_time,
        end_time,
        discount_rate,
        apply_to,
        apply_ids,
        priority,
        active,
        updated_at,
        id,
        tenantId,
      ] = args;
      for (const w of happyHourWindows) {
        if (w.id === id && (!tenantId || normTenant(w.tenant_id) === normTenant(tenantId))) {
          if (name != null) w.name = name;
          if (day_of_week != null) w.day_of_week = day_of_week;
          if (start_time != null) w.start_time = start_time;
          if (end_time != null) w.end_time = end_time;
          if (discount_rate != null) w.discount_rate = discount_rate;
          if (apply_to != null) w.apply_to = apply_to;
          if (apply_ids != null) w.apply_ids = apply_ids;
          if (priority != null) w.priority = priority;
          if (active != null) w.active = active;
          w.updated_at = updated_at;
        }
      }
      return [];
    }

    if (/DELETE FROM happy_hour_windows/i.test(s)) {
      const [id, tenantId] = args;
      for (let i = happyHourWindows.length - 1; i >= 0; i--) {
        if (
          happyHourWindows[i].id === id &&
          (!tenantId || normTenant(happyHourWindows[i].tenant_id) === normTenant(tenantId))
        ) {
          happyHourWindows.splice(i, 1);
        }
      }
      return [];
    }

    if (/FROM menu_items/i.test(s)) {
      let list = [...menuItems];
      if (/available = 1/i.test(s)) {
        list = list.filter((m) => m.available === 1);
      }
      if (/WHERE id = \?/i.test(s)) {
        list = list.filter((m) => m.id === args[0]);
      } else if (/COALESCE\(NULLIF\(TRIM\(tenant_id\)/i.test(s)) {
        list = list.filter((m) => normTenant(m.tenant_id) === normTenant(args[0]));
      }
      list.sort(
        (a, b) =>
          String(a.category).localeCompare(String(b.category)) ||
          String(a.name).localeCompare(String(b.name)),
      );
      return list;
    }

    if (/SELECT \* FROM modifier_groups WHERE id IN/i.test(s)) {
      const idSet = new Set(args.map(String));
      return modifierGroups.filter((g) => idSet.has(String(g.id)));
    }

    if (/SELECT \* FROM modifier_groups WHERE id = \?/i.test(s)) {
      return modifierGroups.filter((g) => g.id === args[0]);
    }

    if (/UPDATE modifier_groups/i.test(s)) {
      const [name, type, required, sort_order, is_active, updated_at, id, tenantId] = args;
      for (const g of modifierGroups) {
        if (g.id === id && (!tenantId || normTenant(g.tenant_id) === normTenant(tenantId))) {
          if (name != null) g.name = name;
          if (type != null) g.type = type;
          if (required != null) g.required = required;
          if (sort_order != null) g.sort_order = sort_order;
          if (is_active != null) g.is_active = is_active;
          g.updated_at = updated_at;
        }
      }
      return [];
    }

    if (/INSERT INTO modifier_choices/i.test(s)) {
      const [id, group_id, name, price_delta, is_default, sort_order, is_available] = args;
      modifierChoices.push({
        id,
        group_id,
        name,
        price_delta,
        is_default: is_default ?? 0,
        sort_order: sort_order ?? 0,
        is_available: is_available ?? 1,
      });
      return [];
    }

    if (/FROM modifier_choices WHERE id = \? AND group_id = \?/i.test(s)) {
      return modifierChoices.filter((c) => c.id === args[0] && c.group_id === args[1]);
    }

    if (/SELECT \* FROM modifier_choices WHERE id = \?/i.test(s)) {
      return modifierChoices.filter((c) => c.id === args[0]);
    }

    if (/UPDATE modifier_choices/i.test(s)) {
      const [name, price_delta, is_available, id, group_id] = args;
      for (const c of modifierChoices) {
        if (c.id === id && c.group_id === group_id) {
          c.name = name;
          c.price_delta = price_delta;
          c.is_available = is_available;
        }
      }
      return [];
    }

    if (/INSERT INTO menu_modifiers/i.test(s)) {
      const [id, group_id, option_name, price_delta, available] = args;
      const existing = menuModifiers.find((m) => m.id === id);
      if (existing) {
        existing.group_id = group_id;
        existing.option_name = option_name;
        existing.price_delta = price_delta;
        existing.available = available;
      } else {
        menuModifiers.push({ id, group_id, option_name, price_delta, available });
      }
      return [];
    }

    if (/UPDATE menu_modifiers/i.test(s)) {
      if (/available = 0/i.test(s)) {
        const [groupId] = args;
        for (const m of menuModifiers) {
          if (m.group_id === groupId) m.available = 0;
        }
      } else if (/SELECT mc\.is_available/i.test(s) || /available = 1/i.test(s)) {
        const [groupId] = args;
        for (const m of menuModifiers) {
          if (m.group_id === groupId) {
            const mc = modifierChoices.find((c) => c.id === m.id);
            m.available = mc ? (mc.is_available ?? 1) : 1;
          }
        }
      }
      return [];
    }

    if (/FROM product_modifier_groups pm JOIN menu_modifiers mm/i.test(s)) {
      const pidSet = new Set(args.map(String));
      const joined: Array<Record<string, any>> = [];
      for (const pm of productModifierGroups) {
        if (!pidSet.has(String(pm.product_id))) continue;
        for (const mm of menuModifiers) {
          if (mm.group_id === pm.group_id && mm.available === 1) {
            joined.push({
              product_id: pm.product_id,
              id: mm.id,
              group_id: mm.group_id,
              option_name: mm.option_name,
              price_delta: mm.price_delta,
            });
          }
        }
      }
      joined.sort((a, b) => String(a.option_name).localeCompare(String(b.option_name)));
      return joined;
    }

    return [];
  };

  return {
    prepare(sql: string) {
      const buildBound = (args: unknown[]) => ({
        bind: (...nextArgs: unknown[]) => buildBound(nextArgs),
        first: async <T = unknown>(): Promise<T | null> => {
          const rows = execute(sql, args);
          return (rows[0] as T) ?? null;
        },
        all: async <T = unknown>(): Promise<{ results: T[] }> => {
          const rows = execute(sql, args);
          return { results: rows as T[] };
        },
        run: async () => {
          execute(sql, args);
          return { success: true, meta: { changes: 1 } };
        },
      });
      return buildBound([]);
    },
    tables: {
      happyHourWindows,
      menuItems,
      modifierGroups,
      modifierChoices,
      productModifierGroups,
      menuModifiers,
    },
  };
}

describe('Domain Catalog Happy-Hour Tenant/Window Resolution & Menu Modifier Projection/Price-Delta Invariants', () => {
  describe('1. Happy-Hour Window Validation, Fail-Closed Tenant Writes & /happy-hour/now Evaluation', () => {
    it('rejects invalid apply_to, missing apply_ids for scoped windows, non-finite priority, and blank name on PATCH', async () => {
      const db = createInMemoryCatalogD1();
      const env = { AURA_DB: db as unknown as D1Database, JWT_SECRET: TEST_SECRET } as Env;
      const managerToken = await makeToken('manager', 'default');
      const nowDay = new Date().getDay();

      // 1. Invalid apply_to on POST
      const badApplyToRes = await happyHourRouter.fetch(
        new Request('http://localhost/happy-hour', {
          method: 'POST',
          headers: { Authorization: `Bearer ${managerToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: 'Bad Scope',
            day_of_week: nowDay,
            start_time: '08:00',
            end_time: '12:00',
            discount_rate: 0.2,
            apply_to: 'arbitrary_scope',
          }),
        }),
        env,
      );
      expect(badApplyToRes.status).toBe(400);

      // 2. Scoped apply_to ('category') without non-empty apply_ids on POST
      const missingApplyIdsRes = await happyHourRouter.fetch(
        new Request('http://localhost/happy-hour', {
          method: 'POST',
          headers: { Authorization: `Bearer ${managerToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: 'Category Without IDs',
            day_of_week: nowDay,
            start_time: '08:00',
            end_time: '12:00',
            discount_rate: 0.2,
            apply_to: 'category',
            apply_ids: [],
          }),
        }),
        env,
      );
      expect(missingApplyIdsRes.status).toBe(400);

      // 3. Valid POST for category-scoped window
      const createRes = await happyHourRouter.fetch(
        new Request('http://localhost/happy-hour', {
          method: 'POST',
          headers: { Authorization: `Bearer ${managerToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: 'Coffee Happy Hour',
            day_of_week: nowDay,
            start_time: '00:00',
            end_time: '23:59',
            discount_rate: 0.1,
            apply_to: 'category',
            apply_ids: ['coffee'],
            priority: 5,
          }),
        }),
        env,
      );
      expect(createRes.status).toBe(201);
      const createdBody = (await createRes.json()) as { data: { id: string; apply_ids: string } };
      const winId = createdBody.data.id;
      expect(createdBody.data.apply_ids).toBe('["coffee"]');

      // 4. PATCH with whitespace-only name rejected
      const blankNamePatch = await happyHourRouter.fetch(
        new Request(`http://localhost/happy-hour/${winId}`, {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${managerToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: '   ' }),
        }),
        env,
      );
      expect(blankNamePatch.status).toBe(400);

      // 5. PATCH clearing apply_ids while effective apply_to remains 'category' rejected
      const emptyIdsPatch = await happyHourRouter.fetch(
        new Request(`http://localhost/happy-hour/${winId}`, {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${managerToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ apply_ids: '[]' }),
        }),
        env,
      );
      expect(emptyIdsPatch.status).toBe(400);

      // 6. PATCH with non-finite priority string rejected
      const badPriorityPatch = await happyHourRouter.fetch(
        new Request(`http://localhost/happy-hour/${winId}`, {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${managerToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ priority: 'not-a-number' }),
        }),
        env,
      );
      expect(badPriorityPatch.status).toBe(400);

      // 7. PATCH trims valid name
      const validPatch = await happyHourRouter.fetch(
        new Request(`http://localhost/happy-hour/${winId}`, {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${managerToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: '  Trimmed Morning Deal  ' }),
        }),
        env,
      );
      expect(validPatch.status).toBe(200);
      const patchedBody = (await validPatch.json()) as { data: { name: string } };
      expect(patchedBody.data.name).toBe('Trimmed Morning Deal');
    });

    it('evaluates GET /happy-hour/now with tenant-filtered menu_items before LIMIT 6, category/product scoping, and Math.floor price parity', async () => {
      const db = createInMemoryCatalogD1();
      const env = { AURA_DB: db as unknown as D1Database, JWT_SECRET: TEST_SECRET } as Env;
      const now = new Date();
      const todayDow = now.getDay();

      // Seed 8 default-tenant items so an unscoped LIMIT 6 query would starve store-b
      for (let i = 1; i <= 8; i++) {
        db.tables.menuItems.push({
          id: `def-item-${i}`,
          name: `Default Coffee ${i}`,
          price: 40000,
          category: 'coffee',
          available: 1,
          tenant_id: 'default',
        });
      }

      // Seed store-b items: 2 in 'coffee' (including 3333 VND to test Math.floor rounding) and 1 in 'tea'
      db.tables.menuItems.push(
        {
          id: 'sb-coffee-1',
          name: 'Store B Espresso',
          price: 3333,
          category: 'coffee',
          available: 1,
          tenant_id: 'store-b',
        },
        {
          id: 'sb-coffee-2',
          name: 'Store B Latte',
          price: 50000,
          category: 'coffee',
          available: 1,
          tenant_id: 'store-b',
        },
        {
          id: 'sb-tea-1',
          name: 'Store B Peach Tea',
          price: 45000,
          category: 'tea',
          available: 1,
          tenant_id: 'store-b',
        },
      );

      // Seed active category-scoped happy hour window for store-b (10% discount on 'coffee')
      db.tables.happyHourWindows.push({
        id: 'hh-sb-coffee',
        name: 'Store B Coffee 10%',
        day_of_week: todayDow,
        start_time: '00:00',
        end_time: '23:59',
        discount_rate: 0.1,
        apply_to: 'category',
        apply_ids: '["coffee"]',
        priority: 10,
        active: 1,
        tenant_id: 'store-b',
      });

      const res = await happyHourRouter.fetch(
        new Request('http://localhost/happy-hour/now?tenant_id=store-b'),
        env,
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        success: boolean;
        active: boolean;
        window: { id: string } | null;
        data: { id: string } | null;
        featured_items: Array<{
          id: string;
          price: number;
          happy_hour_price: number;
          discount_percent: number;
          tenant_id: string;
        }>;
      };

      expect(body.success).toBe(true);
      expect(body.active).toBe(true);
      expect(body.window?.id).toBe('hh-sb-coffee');
      expect(body.data?.id).toBe('hh-sb-coffee');

      // Only store-b 'coffee' items are featured (not default-tenant items and not store-b 'tea')
      expect(body.featured_items.map((i) => i.id)).toEqual(['sb-coffee-1', 'sb-coffee-2']);

      const item1 = body.featured_items.find((i) => i.id === 'sb-coffee-1')!;
      const expectedCanonicalPrice = resolveItemPrice({
        basePriceCents: 3333,
        channel: 'dine_in',
        modifierChoices: [],
        happyHourWindows: [
          {
            id: 'hh-sb-coffee',
            name: 'Store B Coffee 10%',
            day_of_week: todayDow,
            start_time: '00:00',
            end_time: '23:59',
            discount_rate: 0.1,
            apply_to: 'category',
            apply_ids: '["coffee"]',
            priority: 10,
            active: 1,
          },
        ],
        now,
        productId: 'sb-coffee-1',
        categoryId: 'coffee',
      });
      expect(expectedCanonicalPrice).toBe(3000);
      expect(item1.happy_hour_price).toBe(expectedCanonicalPrice);
      expect(item1.discount_percent).toBe(10);
    });

    it('fails closed on PATCH and DELETE /happy-hour/:id for non-default tenant when tenant-scoped query throws', async () => {
      const storeBToken = await makeToken('manager', 'store-b');
      let unscopedWriteAttempted = false;

      const failingTenantDb = {
        prepare(sql: string) {
          const buildBound = (args: unknown[]) => ({
            bind: (...nextArgs: unknown[]) => buildBound(nextArgs),
            first: async () => {
              if (/FROM users WHERE id/i.test(sql)) {
                return {
                  id: 'user-manager-store-b',
                  name: 'Store B Manager',
                  phone: '0900000002',
                  role: 'manager',
                  tenant_id: 'store-b',
                  is_active: 1,
                  auth_version: 1,
                };
              }
              if (/FROM happy_hour_windows WHERE id = \?/i.test(sql)) {
                return {
                  id: 'hh-sb-1',
                  name: 'SB Window',
                  day_of_week: 1,
                  start_time: '08:00',
                  end_time: '11:00',
                  discount_rate: 0.15,
                  apply_to: 'all',
                  apply_ids: null,
                  priority: 1,
                  active: 1,
                  tenant_id: 'store-b',
                };
              }
              return null;
            },
            all: async () => ({ results: [] }),
            run: async () => {
              if (/UPDATE happy_hour_windows|DELETE FROM happy_hour_windows/i.test(sql)) {
                if (/tenant_id/i.test(sql)) {
                  throw new Error('simulated D1 tenant_id column failure');
                }
                unscopedWriteAttempted = true;
              }
              return { success: true };
            },
          });
          return buildBound([]);
        },
      };

      const env = { AURA_DB: failingTenantDb as unknown as D1Database, JWT_SECRET: TEST_SECRET } as Env;

      const patchRes = await happyHourRouter.fetch(
        new Request('http://localhost/happy-hour/hh-sb-1', {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${storeBToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'Updated SB Window' }),
        }),
        env,
      );
      expect(patchRes.status).toBe(500);
      expect(unscopedWriteAttempted).toBe(false);

      const deleteRes = await happyHourRouter.fetch(
        new Request('http://localhost/happy-hour/hh-sb-1', {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${storeBToken}` },
        }),
        env,
      );
      expect(deleteRes.status).toBe(500);
      expect(unscopedWriteAttempted).toBe(false);
    });
  });

  describe('2. Menu Modifier Non-Negative Integer price_delta, Group Deactivation Sync & Customer Menu Isolation', () => {
    it('rejects negative or non-integer price_delta on POST and PATCH modifier choices', async () => {
      const db = createInMemoryCatalogD1();
      const env = { AURA_DB: db as unknown as D1Database, JWT_SECRET: TEST_SECRET } as Env;
      const managerToken = await makeToken('manager', 'default');

      db.tables.modifierGroups.push({
        id: 'mg-def-1',
        name: 'Toppings',
        type: 'multiple',
        required: 0,
        sort_order: 1,
        is_active: 1,
        tenant_id: 'default',
      });

      // 1. Negative price_delta on POST choice rejected with 400
      const negPostRes = await menuModifiersRouter.fetch(
        new Request('http://localhost/groups/mg-def-1/choices', {
          method: 'POST',
          headers: { Authorization: `Bearer ${managerToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'Discount Hack', price_delta: -5000 }),
        }),
        env,
      );
      expect(negPostRes.status).toBe(400);
      const negPostBody = (await negPostRes.json()) as { error: string };
      expect(negPostBody.error).toContain('integer');

      // 2. Fractional price_delta on POST choice rejected with 400
      const fracPostRes = await menuModifiersRouter.fetch(
        new Request('http://localhost/groups/mg-def-1/choices', {
          method: 'POST',
          headers: { Authorization: `Bearer ${managerToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'Fractional Topping', price_delta: 2500.5 }),
        }),
        env,
      );
      expect(fracPostRes.status).toBe(400);

      // 3. Valid POST choice creates both canonical and projection rows
      const validPostRes = await menuModifiersRouter.fetch(
        new Request('http://localhost/groups/mg-def-1/choices', {
          method: 'POST',
          headers: { Authorization: `Bearer ${managerToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'Trân châu trắng', price_delta: 5000 }),
        }),
        env,
      );
      expect(validPostRes.status).toBe(201);
      const createdChoice = ((await validPostRes.json()) as { data: { id: string } }).data;

      // 4. Negative price_delta on PATCH choice rejected with 400
      const negPatchRes = await menuModifiersRouter.fetch(
        new Request(`http://localhost/groups/mg-def-1/choices/${createdChoice.id}`, {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${managerToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'Trân châu trắng', price_delta: -1000 }),
        }),
        env,
      );
      expect(negPatchRes.status).toBe(400);
      const negPatchBody = (await negPatchRes.json()) as { error: string };
      expect(negPatchBody.error).toContain('integer');

      // 5. Partial PATCH choice (updating only price_delta) updates both modifier_choices and menu_modifiers
      const partialPatchRes = await menuModifiersRouter.fetch(
        new Request(`http://localhost/groups/mg-def-1/choices/${createdChoice.id}`, {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${managerToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ price_delta: 8000 }),
        }),
        env,
      );
      expect(partialPatchRes.status).toBe(200);
      const projRow = db.tables.menuModifiers.find((m) => m.id === createdChoice.id);
      expect(projRow).toEqual({
        id: createdChoice.id,
        group_id: 'mg-def-1',
        option_name: 'Trân châu trắng',
        price_delta: 8000,
        available: 1,
      });
    });

    it('synchronizes group deactivation via PATCH /groups/:id and filters inactive or cross-tenant modifier groups from getCustomerMenu', async () => {
      const db = createInMemoryCatalogD1();
      const env = { AURA_DB: db as unknown as D1Database, JWT_SECRET: TEST_SECRET } as Env;
      const defaultManagerToken = await makeToken('manager', 'default');

      // Seed product and menu_items row for default tenant
      db.tables.menuItems.push({
        id: 'prod-milk-tea',
        name: 'Trà sữa truyền thống',
        price: 35000,
        category: 'milk_tea',
        available: 1,
        tenant_id: 'default',
      });

      // Seed active default-tenant modifier group + choice + projection
      db.tables.modifierGroups.push({
        id: 'mg-sugar',
        name: 'Mức đường',
        type: 'single',
        required: 0,
        sort_order: 1,
        is_active: 1,
        tenant_id: 'default',
      });
      db.tables.modifierChoices.push({
        id: 'mc-sugar-50',
        group_id: 'mg-sugar',
        name: '50% đường',
        price_delta: 0,
        is_available: 1,
      });
      db.tables.menuModifiers.push({
        id: 'mc-sugar-50',
        group_id: 'mg-sugar',
        option_name: '50% đường',
        price_delta: 0,
        available: 1,
      });
      db.tables.productModifierGroups.push({
        product_id: 'prod-milk-tea',
        group_id: 'mg-sugar',
        sort_order: 1,
      });

      // Seed cross-tenant modifier group (store-b) linked in product_modifier_groups
      db.tables.modifierGroups.push({
        id: 'mg-store-b',
        name: 'Store B Secret Topping',
        type: 'multiple',
        required: 0,
        sort_order: 2,
        is_active: 1,
        tenant_id: 'store-b',
      });
      db.tables.menuModifiers.push({
        id: 'mc-store-b-1',
        group_id: 'mg-store-b',
        option_name: 'Kem trứng Store B',
        price_delta: 10000,
        available: 1,
      });
      db.tables.productModifierGroups.push({
        product_id: 'prod-milk-tea',
        group_id: 'mg-store-b',
        sort_order: 2,
      });

      // 1. Before deactivating mg-sugar, customer menu for 'default' includes mg-sugar choice and excludes store-b group
      const initialMenu = await getCustomerMenu(db as unknown as D1Database, { tenantId: 'default' });
      const initialItem = initialMenu.categories[0]?.items[0];
      expect(initialItem?.modifierChoices?.map((m) => m.id)).toEqual(['mc-sugar-50']);

      // 2. Deactivate mg-sugar via PATCH /groups/mg-sugar
      const deactivateRes = await menuModifiersRouter.fetch(
        new Request('http://localhost/groups/mg-sugar', {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${defaultManagerToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ is_active: false }),
        }),
        env,
      );
      expect(deactivateRes.status).toBe(200);

      // Verify menu_modifiers.available was synchronized to 0
      const syncedMod = db.tables.menuModifiers.find((m) => m.id === 'mc-sugar-50')!;
      expect(syncedMod.available).toBe(0);

      // 3. Even if menu_modifiers.available were 1, attachProductModifiers also checks modifier_groups.is_active
      syncedMod.available = 1;
      const menuAfterDeactivate = await getCustomerMenu(db as unknown as D1Database, { tenantId: 'default' });
      expect(menuAfterDeactivate.categories[0]?.items[0]?.modifierChoices).toEqual([]);

      const singleItemAfterDeactivate = await getCustomerMenuItem(
        db as unknown as D1Database,
        'prod-milk-tea',
        { tenantId: 'default' },
      );
      expect(singleItemAfterDeactivate?.modifierChoices).toEqual([]);

      // 4. Reactivate mg-sugar and verify choice returns
      await syncModifierGroupAvailabilityToMenuProjection(db as unknown as D1Database, 'mg-sugar', 1);
      const sugarGroup = db.tables.modifierGroups.find((g) => g.id === 'mg-sugar')!;
      sugarGroup.is_active = 1;
      const menuAfterReactivate = await getCustomerMenu(db as unknown as D1Database, { tenantId: 'default' });
      expect(menuAfterReactivate.categories[0]?.items[0]?.modifierChoices?.map((m) => m.id)).toEqual([
        'mc-sugar-50',
      ]);

      // 5. Verify mapModifierChoiceToProjection clamps negative price_delta to 0
      const clampedProj = mapModifierChoiceToProjection({
        id: 'mc-neg',
        group_id: 'mg-sugar',
        name: 'Negative Input',
        price_delta: -3000,
        is_available: 1,
      });
      expect(clampedProj.price_delta).toBe(0);
    });
  });
});
