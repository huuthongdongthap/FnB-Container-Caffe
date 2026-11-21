// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { app } from '../../index';
import { generateJWT } from '../../lib/jwt';
import { TEST_JWT_SECRET } from '../test-utils';
import { STAFF_HASH, staffSessionFixture } from '../helpers/staff-session-fixture';

function seedLoyaltyRewardsSchema(sqlite: ReturnType<typeof staffSessionFixture>['sqlite']) {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS loyalty_rewards (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      points_cost INTEGER NOT NULL,
      type TEXT NOT NULL,
      value REAL NOT NULL,
      min_tier TEXT,
      max_redemptions INTEGER,
      current_redemptions INTEGER DEFAULT 0,
      valid_from TEXT,
      valid_until TEXT,
      is_active INTEGER DEFAULT 1,
      image_url TEXT,
      product_id TEXT,
      terms TEXT,
      valid_to TEXT,
      tenant_id TEXT DEFAULT 'default',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS rewards (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      point_cost INTEGER NOT NULL,
      discount_type TEXT,
      discount_value REAL,
      is_active INTEGER DEFAULT 1,
      tenant_id TEXT DEFAULT 'default'
    );
    CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY,
      name TEXT,
      phone TEXT,
      email TEXT,
      loyalty_points INTEGER DEFAULT 0,
      loyalty_tier TEXT DEFAULT 'bronze',
      auth_version INTEGER DEFAULT 1,
      tenant_id TEXT DEFAULT 'default'
    );
  `);

  sqlite.prepare(
    `INSERT INTO loyalty_rewards (id, name, description, points_cost, type, value, is_active, tenant_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run('rw-a-active', 'Cafe A Free Espresso', 'Active reward', 100, 'free_item', 35000, 1, 'cafe-a');

  sqlite.prepare(
    `INSERT INTO loyalty_rewards (id, name, description, points_cost, type, value, is_active, tenant_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run('rw-a-inactive', 'Cafe A Archived Voucher', 'Inactive reward', 250, 'voucher', 50000, 0, 'cafe-a');

  sqlite.prepare(
    `INSERT INTO loyalty_rewards (id, name, description, points_cost, type, value, is_active, tenant_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run('rw-b-active', 'Cafe B Secret Reward', 'Foreign tenant reward', 150, 'discount', 20000, 1, 'cafe-b');

  sqlite.prepare(
    `INSERT INTO rewards (id, title, description, point_cost, discount_type, discount_value, is_active, tenant_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run('legacy-rw-a', 'Cafe A Legacy Drink', 'Legacy active', 100, 'free_item', 35000, 1, 'cafe-a');

  sqlite.prepare(
    `INSERT INTO rewards (id, title, description, point_cost, discount_type, discount_value, is_active, tenant_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run('legacy-rw-a-off', 'Cafe A Legacy Off', 'Legacy inactive', 50, 'discount', 10000, 0, 'cafe-a');

  sqlite.prepare(
    `INSERT INTO rewards (id, title, description, point_cost, discount_type, discount_value, is_active, tenant_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run('legacy-rw-b', 'Cafe B Legacy Drink', 'Foreign legacy', 80, 'free_item', 30000, 1, 'cafe-b');

  sqlite.prepare(
    `INSERT INTO customers (id, name, phone, email, loyalty_points, loyalty_tier, auth_version, tenant_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run('cust-a-1', 'Alice Cafe A', '0901000001', 'alice@cafe-a.test', 120, 'silver', 1, 'cafe-a');
}

describe('Mounted app GET /api/loyalty/rewards compatibility (#91)', () => {
  it('allows authorized staff (Bearer and cookie) to list tenant-scoped rewards in RewardsManager data.rewards shape', async () => {
    const fx = staffSessionFixture();
    seedLoyaltyRewardsSchema(fx.sqlite);

    const managerToken = await fx.token('manager');
    const bearerRes = await fx.request('/api/loyalty/rewards?limit=100', managerToken);
    expect(bearerRes.status).toBe(200);
    const bearerBody = (await bearerRes.json()) as {
      success: boolean;
      data: {
        rewards: Array<{ id: string; name: string; pointsCost: number; type: string; value: number; isActive: number | boolean }>;
        meta: { page: number; limit: number; total: number; totalPages: number };
      };
    };
    expect(bearerBody.success).toBe(true);
    expect(Array.isArray(bearerBody.data.rewards)).toBe(true);
    expect(bearerBody.data.rewards.map((r) => r.id)).toEqual(['rw-a-active', 'rw-a-inactive']);
    expect(bearerBody.data.rewards[0]).toMatchObject({
      id: 'rw-a-active',
      name: 'Cafe A Free Espresso',
      pointsCost: 100,
      type: 'free_item',
      value: 35000,
      isActive: 1,
    });
    expect(bearerBody.data.meta).toMatchObject({ page: 1, limit: 100, total: 2 });

    // Also works when staff authenticates via httpOnly session cookie (browser admin panel)
    const ownerToken = await fx.token('owner');
    const cookieRes = await app.fetch(
      new Request('http://local.test/api/loyalty/rewards?limit=100', {
        method: 'GET',
        headers: { Cookie: `access_token=${ownerToken}` },
      }),
      fx.env,
      { waitUntil(p: Promise<unknown>) { void p.catch(() => {}); }, passThroughOnException() {} } as never,
    );
    expect(cookieRes.status).toBe(200);
    const cookieBody = (await cookieRes.json()) as {
      success: boolean;
      data: { rewards: Array<{ id: string }> };
    };
    expect(cookieBody.success).toBe(true);
    expect(cookieBody.data.rewards.map((r) => r.id)).toEqual(['rw-a-active', 'rw-a-inactive']);
  });

  it('enforces tenant isolation for staff list and rejects cross-tenant spoofing', async () => {
    const fx = staffSessionFixture();
    seedLoyaltyRewardsSchema(fx.sqlite);

    const cafeBToken = await fx.token('other');
    const ownTenantRes = await fx.request('/api/loyalty/rewards?limit=100', cafeBToken);
    expect(ownTenantRes.status).toBe(200);
    const ownTenantBody = (await ownTenantRes.json()) as {
      success: boolean;
      data: { rewards: Array<{ id: string }> };
    };
    expect(ownTenantBody.data.rewards.map((r) => r.id)).toEqual(['rw-b-active']);

    const spoofHeaderRes = await fx.request('/api/loyalty/rewards?limit=100', cafeBToken, 'GET', undefined, {
      'X-Tenant-ID': 'cafe-a',
    });
    expect(spoofHeaderRes.status).toBe(403);

    const spoofQueryRes = await fx.request('/api/loyalty/rewards?limit=100&tenant_id=cafe-a', cafeBToken);
    expect(spoofQueryRes.status).toBe(403);
  });

  it('preserves legacy customer GET /api/loyalty/rewards array response and tenant filtering unchanged', async () => {
    const fx = staffSessionFixture();
    fx.env.PILOT_TENANT_ID = 'cafe-a';
    seedLoyaltyRewardsSchema(fx.sqlite);

    const customerToken = await generateJWT(
      { id: 'cust-a-1', sub: 'cust-a-1', role: 'customer', tenantId: 'cafe-a', authVersion: 1 },
      TEST_JWT_SECRET,
    );
    const customerRes = await fx.request('/api/loyalty/rewards', customerToken);
    expect(customerRes.status).toBe(200);
    const customerBody = (await customerRes.json()) as {
      success: boolean;
      data: Array<{ id: string; title: string; point_cost: number; can_redeem: boolean }>;
    };
    expect(customerBody.success).toBe(true);
    expect(Array.isArray(customerBody.data)).toBe(true);
    expect(customerBody.data.map((r) => r.id)).toEqual(['legacy-rw-a']);
    expect(customerBody.data[0]?.can_redeem).toBe(true);

    // Legacy customer JWT omitting role claim must still hit customer handler
    const legacyCustomerToken = await generateJWT(
      { id: 'cust-a-1', sub: 'cust-a-1', tenantId: 'cafe-a', authVersion: 1 },
      TEST_JWT_SECRET,
    );
    const legacyRes = await fx.request('/api/loyalty/rewards', legacyCustomerToken);
    expect(legacyRes.status).toBe(200);
    const legacyBody = (await legacyRes.json()) as {
      success: boolean;
      data: Array<{ id: string; can_redeem: boolean }>;
    };
    expect(Array.isArray(legacyBody.data)).toBe(true);
    expect(legacyBody.data.map((r) => r.id)).toEqual(['legacy-rw-a']);
  });

  it('denies unauthorized staff roles, unauthenticated requests, invalid tokens, and revoked staff tokens', async () => {
    const fx = staffSessionFixture();
    seedLoyaltyRewardsSchema(fx.sqlite);

    fx.sqlite
      .prepare('INSERT INTO users (id, name, role, tenant_id, password_hash) VALUES (?, ?, ?, ?, ?)')
      .run('kitchen-1', 'Kitchen User', 'kitchen', 'cafe-a', STAFF_HASH);

    const kitchenToken = await fx.token('kitchen-1');
    const kitchenRes = await fx.request('/api/loyalty/rewards?limit=100', kitchenToken);
    expect(kitchenRes.status).toBe(403);

    const vendorToken = await generateJWT(
      { id: 'vendor-1', sub: 'vendor-1', role: 'vendor', tenantId: 'cafe-a' },
      TEST_JWT_SECRET,
    );
    const vendorRes = await fx.request('/api/loyalty/rewards?limit=100', vendorToken);
    expect([401, 403]).toContain(vendorRes.status);

    const unauthRes = await fx.request('/api/loyalty/rewards?limit=100');
    expect(unauthRes.status).toBe(401);

    const invalidTokenRes = await fx.request('/api/loyalty/rewards?limit=100', 'not-a-valid-jwt');
    expect(invalidTokenRes.status).toBe(401);

    const managerToken = await fx.token('manager');
    await fx.kv.put(`revoked:${managerToken}`, '1');
    const revokedRes = await fx.request('/api/loyalty/rewards?limit=100', managerToken);
    expect(revokedRes.status).toBe(401);
  });

  it('supports full RewardsManager create -> list -> toggle -> list lifecycle on mounted app', async () => {
    const fx = staffSessionFixture();
    seedLoyaltyRewardsSchema(fx.sqlite);

    const managerToken = await fx.token('manager');
    const createRes = await fx.request('/api/loyalty/rewards', managerToken, 'POST', {
      name: 'Matcha Latte Free',
      pointsCost: 180,
      type: 'free_drink',
      value: 45000,
      isActive: true,
    });
    expect(createRes.status).toBe(201);
    const created = (await createRes.json()) as { success: boolean; data: { id: string } };
    expect(created.success).toBe(true);

    const listRes1 = await fx.request('/api/loyalty/rewards?limit=100', managerToken);
    expect(listRes1.status).toBe(200);
    const list1 = (await listRes1.json()) as {
      data: { rewards: Array<{ id: string; name: string; isActive: number | boolean }> };
    };
    const createdItem = list1.data.rewards.find((r) => r.id === created.data.id);
    expect(createdItem).toMatchObject({ name: 'Matcha Latte Free' });
    expect(Boolean(createdItem?.isActive)).toBe(true);

    const toggleRes = await fx.request(`/api/loyalty/rewards/${encodeURIComponent(created.data.id)}`, managerToken, 'PATCH', {
      isActive: false,
    });
    expect(toggleRes.status).toBe(200);

    const listRes2 = await fx.request('/api/loyalty/rewards?limit=100', managerToken);
    expect(listRes2.status).toBe(200);
    const list2 = (await listRes2.json()) as {
      data: { rewards: Array<{ id: string; isActive: number | boolean }> };
    };
    expect(Boolean(list2.data.rewards.find((r) => r.id === created.data.id)?.isActive)).toBe(false);
  });
});
