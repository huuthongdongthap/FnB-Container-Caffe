/**
 * Catalog Route Security & Public Access Integration Tests
 * Verifies:
 * 1. Customer GET menu & catalog queries remain 100% public (no JWT auth required)
 * 2. Unauthenticated POST / PUT / PATCH / DELETE mutations return 401 Unauthorized
 * 3. Authenticated staff/manager/owner mutations succeed (200 / 201)
 */

import { describe, it, expect } from 'vitest';
import { app } from '../../index';
import { generateJWT } from '../../lib/jwt';
import { createMockEnv, createMockDB } from '../test-utils';

const TEST_SECRET = 'test-jwt-secret-at-least-16-chars';

function makeTestEnv() {
  const store = new Map<string, string>();
  const db = createMockDB();

  db.prepare = (_sql: string) => {
    const stmt = {
      bind: (..._args: unknown[]) => stmt,
      run: async () => ({ success: true, changes: 1, lastRowId: 1 }),
      first: async () => {
        if (_sql.includes('FROM categories WHERE id = ?')) {
          return { id: 'cat-1', name: 'Coffee', slug: 'coffee', sort_order: 1 };
        }
        if (_sql.includes('FROM products') && (_sql.includes('WHERE p.id = ?') || _sql.includes('WHERE id = ?'))) {
          return { id: 'prod-1', name: 'Espresso', price: 35000, category_id: 'cat-1', is_available: 1 };
        }
        if (_sql.includes('FROM modifier_groups WHERE id = ?')) {
          return { id: 'MG-1', name: 'Sugar', type: 'single', required: 0 };
        }
        if (_sql.includes('FROM modifier_choices WHERE id = ?')) {
          return { id: 'MC-1', group_id: 'MG-1', name: '50% Sugar', price_delta: 0 };
        }
        if (_sql.includes('FROM happy_hour_windows WHERE id = ?')) {
          return { id: 'HH-1', name: 'Afternoon Joy', day_of_week: 1, start_time: '14:00', end_time: '17:00', discount_rate: 0.2 };
        }
        return null;
      },
      all: async () => {
        if (_sql.includes('FROM categories')) {
          return { results: [{ id: 'cat-1', name: 'Coffee', slug: 'coffee', sort_order: 1 }], success: true };
        }
        if (_sql.includes('FROM products')) {
          return { results: [{ id: 'prod-1', name: 'Espresso', price: 35000, category_id: 'cat-1', is_available: 1 }], success: true };
        }
        if (_sql.includes('FROM modifier_groups')) {
          return { results: [{ id: 'MG-1', name: 'Sugar', type: 'single', required: 0 }], success: true };
        }
        if (_sql.includes('FROM modifier_choices')) {
          return { results: [{ id: 'MC-1', group_id: 'MG-1', name: '50%', price_delta: 0 }], success: true };
        }
        if (_sql.includes('FROM happy_hour_windows')) {
          return { results: [{ id: 'HH-1', name: 'Afternoon Joy', day_of_week: 1, start_time: '14:00', end_time: '17:00', discount_rate: 0.2, active: 1, priority: 1 }], success: true };
        }
        return { results: [], success: true };
      },
    };
    return stmt as any;
  };

  return {
    ...createMockEnv(),
    AURA_DB: db,
    AUTH_KV: {
      get: async (k: string) => store.get(k) ?? null,
      put: async (k: string, v: string) => { store.set(k, v); },
      delete: async (k: string) => { store.delete(k); },
    } as any,
    JWT_SECRET: TEST_SECRET,
  } as any;
}

describe('Catalog Routes Security and Public Access', () => {
  describe('Public GET endpoints (Customer Experience)', () => {
    it('allows unauthenticated GET /api/menu', async () => {
      const env = makeTestEnv();
      const res = await app.fetch(new Request('https://test.aura/api/menu'), env);
      expect(res.status).toBe(200);
      const data = (await res.json()) as any;
      expect(data.success).toBe(true);
    });

    it('allows unauthenticated GET /api/categories', async () => {
      const env = makeTestEnv();
      const res = await app.fetch(new Request('https://test.aura/api/categories'), env);
      expect(res.status).toBe(200);
      const data = (await res.json()) as any;
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);
    });

    it('allows unauthenticated GET /api/categories/:id', async () => {
      const env = makeTestEnv();
      const res = await app.fetch(new Request('https://test.aura/api/categories/cat-1'), env);
      expect(res.status).toBe(200);
      const data = (await res.json()) as any;
      expect(data.success).toBe(true);
      expect(data.data.id).toBe('cat-1');
    });

    it('allows unauthenticated GET /api/products', async () => {
      const env = makeTestEnv();
      const res = await app.fetch(new Request('https://test.aura/api/products'), env);
      expect(res.status).toBe(200);
      const data = (await res.json()) as any;
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);
    });

    it('allows unauthenticated GET /api/products/:id', async () => {
      const env = makeTestEnv();
      const res = await app.fetch(new Request('https://test.aura/api/products/prod-1'), env);
      expect(res.status).toBe(200);
      const data = (await res.json()) as any;
      expect(data.success).toBe(true);
      expect(data.data.id).toBe('prod-1');
    });

    it('allows unauthenticated GET /api/menu-modifiers/groups', async () => {
      const env = makeTestEnv();
      const res = await app.fetch(new Request('https://test.aura/api/menu-modifiers/groups'), env);
      expect(res.status).toBe(200);
      const data = (await res.json()) as any;
      expect(data.success).toBe(true);
    });

    it('allows unauthenticated GET /api/menu-modifiers/happy-hour/now', async () => {
      const env = makeTestEnv();
      const res = await app.fetch(new Request('https://test.aura/api/menu-modifiers/happy-hour/now'), env);
      expect(res.status).toBe(200);
      const data = (await res.json()) as any;
      expect(data.success).toBe(true);
    });
  });

  describe('Unauthenticated mutations are rejected (401 Unauthorized)', () => {
    it('rejects unauthenticated POST /api/categories', async () => {
      const env = makeTestEnv();
      const res = await app.fetch(
        new Request('https://test.aura/api/categories', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'Cold Brew', slug: 'cold-brew' }),
        }),
        env
      );
      expect(res.status).toBe(401);
    });

    it('rejects unauthenticated PUT /api/categories/:id', async () => {
      const env = makeTestEnv();
      const res = await app.fetch(
        new Request('https://test.aura/api/categories/cat-1', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'Specialty Coffee' }),
        }),
        env
      );
      expect(res.status).toBe(401);
    });

    it('rejects unauthenticated DELETE /api/categories/:id', async () => {
      const env = makeTestEnv();
      const res = await app.fetch(
        new Request('https://test.aura/api/categories/cat-1', {
          method: 'DELETE',
        }),
        env
      );
      expect(res.status).toBe(401);
    });

    it('rejects unauthenticated POST /api/products', async () => {
      const env = makeTestEnv();
      const res = await app.fetch(
        new Request('https://test.aura/api/products', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'Caramel Macchiato', price: 45000, category_id: 'cat-1' }),
        }),
        env
      );
      expect(res.status).toBe(401);
    });

    it('rejects unauthenticated PUT /api/products/:id', async () => {
      const env = makeTestEnv();
      const res = await app.fetch(
        new Request('https://test.aura/api/products/prod-1', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'Espresso Double', price: 40000 }),
        }),
        env
      );
      expect(res.status).toBe(401);
    });

    it('rejects unauthenticated DELETE /api/products/:id', async () => {
      const env = makeTestEnv();
      const res = await app.fetch(
        new Request('https://test.aura/api/products/prod-1', {
          method: 'DELETE',
        }),
        env
      );
      expect(res.status).toBe(401);
    });

    it('rejects unauthenticated POST /api/menu-modifiers/groups', async () => {
      const env = makeTestEnv();
      const res = await app.fetch(
        new Request('https://test.aura/api/menu-modifiers/groups', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'Ice Level' }),
        }),
        env
      );
      expect(res.status).toBe(401);
    });

    it('rejects unauthenticated POST /api/menu-modifiers/happy-hour', async () => {
      const env = makeTestEnv();
      const res = await app.fetch(
        new Request('https://test.aura/api/menu-modifiers/happy-hour', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: 'Late Night',
            day_of_week: 2,
            start_time: '20:00',
            end_time: '22:00',
            discount_rate: 0.15,
          }),
        }),
        env
      );
      expect(res.status).toBe(401);
    });
  });

  describe('Authenticated staff mutations succeed', () => {
    it('allows staff POST /api/categories', async () => {
      const env = makeTestEnv();
      const token = await generateJWT({ sub: 'staff-1', role: 'staff', name: 'Barista' }, TEST_SECRET);
      const res = await app.fetch(
        new Request('https://test.aura/api/categories', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ name: 'Cold Brew', slug: 'cold-brew' }),
        }),
        env
      );
      expect(res.status).toBe(201);
      const data = (await res.json()) as any;
      expect(data.success).toBe(true);
    });

    it('allows staff POST /api/products', async () => {
      const env = makeTestEnv();
      const token = await generateJWT({ sub: 'mgr-1', role: 'manager', name: 'Manager' }, TEST_SECRET);
      const res = await app.fetch(
        new Request('https://test.aura/api/products', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ name: 'Cold Brew Latte', price: 42000, category_id: 'cat-1' }),
        }),
        env
      );
      expect(res.status).toBe(201);
      const data = (await res.json()) as any;
      expect(data.success).toBe(true);
    });

    it('allows staff POST /api/menu-modifiers/groups', async () => {
      const env = makeTestEnv();
      const token = await generateJWT({ sub: 'owner-1', role: 'owner', name: 'Owner' }, TEST_SECRET);
      const res = await app.fetch(
        new Request('https://test.aura/api/menu-modifiers/groups', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ name: 'Ice Level', type: 'single' }),
        }),
        env
      );
      expect(res.status).toBe(201);
      const data = (await res.json()) as any;
      expect(data.success).toBe(true);
    });
  });
});
