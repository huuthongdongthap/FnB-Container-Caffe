import { describe, it, expect, beforeEach } from 'vitest';
import { reservationsRouter } from '../src/routes/reservations';
import { createMockEnv, mockRequestWithRole, mockRequest } from 'worker/src/__tests__/test-utils';

function createReservationMockEnv(overrides: Record<string, unknown> = {}) {
  const baseEnv = createMockEnv();
  const db = {
    prepare: (sql: string) => {
      const stmt = {
        _sql: sql,
        _binds: [] as unknown[],
        bind(...args: unknown[]) {
          stmt._binds = args;
          return stmt;
        },
        first: async <T = unknown>() => {
          if (sql.includes('FROM cafe_tables WHERE id = ?')) {
            return { id: 'tbl_b02', table_number: 'B02', zone: 'Zone B', status: 'Available' } as T;
          }
          if (sql.includes('FROM reservations WHERE id = ?')) {
            return { id: 'rsv_123', table_id: 'tbl_b02', status: 'pending' } as T;
          }
          if (sql.includes('FROM reservations WHERE table_id = ?')) {
            return null as T; // No conflicting reservation
          }
          return null as T;
        },
        all: async <T = unknown>() => {
          if (sql.includes('FROM cafe_tables')) {
            return { results: [{ id: 'tbl_b02', table_number: 'B02', zone: 'Zone B' }], success: true } as unknown as import('@cloudflare/workers-types').D1Result<T>;
          }
          if (sql.includes('FROM reservations')) {
            return { results: [{ id: 'rsv_123', customer_name: 'Guest A', customer_phone: '0901234567' }], success: true } as unknown as import('@cloudflare/workers-types').D1Result<T>;
          }
          return { results: [], success: true } as unknown as import('@cloudflare/workers-types').D1Result<T>;
        },
        run: async () => ({ success: true, changes: 1 }),
        raw: async () => [],
      };
      return stmt;
    },
    batch: async () => [{ success: true, changes: 1 }],
    exec: async () => ({ count: 0, duration: 0 }),
    dump: async () => new Uint8Array(),
  };

  return {
    ...baseEnv,
    AURA_DB: db,
    ...overrides,
  };
}

describe('Reservation Routes — RBAC and PII Boundary Security', () => {
  let env: ReturnType<typeof createReservationMockEnv>;

  beforeEach(() => {
    env = createReservationMockEnv();
  });

  describe('Public Endpoints (Guests)', () => {
    it('allows unauthenticated access to GET /availability', async () => {
      const req = mockRequest('GET', '/availability?date=2026-10-15&time=18:00');
      const res = await reservationsRouter.fetch(req, env as any);
      expect(res.status).toBe(200);
      const body = await res.json() as Record<string, unknown>;
      expect(body.success).toBe(true);
    });

    it('allows unauthenticated guest to create reservation via POST /', async () => {
      const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
      const req = mockRequest('POST', '/', {
        table_id: 'tbl_b02',
        customer_name: 'Diner Guest',
        customer_phone: '0901234567',
        date: tomorrow,
        time: '19:00',
        guest_count: 4,
      });

      const res = await reservationsRouter.fetch(req, env as any);
      expect(res.status).toBe(201);
      const body = await res.json() as Record<string, unknown>;
      expect(body.success).toBe(true);
    });
  });

  describe('Secured Management Endpoints (Staff/Owner RBAC)', () => {
    it('rejects GET / without authentication (401)', async () => {
      const req = mockRequest('GET', '/');
      const res = await reservationsRouter.fetch(req, env as any);
      expect(res.status).toBe(401);
      const body = await res.json() as Record<string, unknown>;
      expect(body.success).toBe(false);
    });

    it('rejects GET / when caller has role=customer (403)', async () => {
      const req = await mockRequestWithRole('GET', '/', 'customer');
      const res = await reservationsRouter.fetch(req, env as any);
      expect(res.status).toBe(403);
      const body = await res.json() as Record<string, unknown>;
      expect(body.success).toBe(false);
    });

    it('allows GET / when caller has role=staff (200)', async () => {
      const req = await mockRequestWithRole('GET', '/', 'staff');
      const res = await reservationsRouter.fetch(req, env as any);
      expect(res.status).toBe(200);
      const body = await res.json() as Record<string, unknown>;
      expect(body.success).toBe(true);
    });

    it('allows GET / when caller has role=owner (200)', async () => {
      const req = await mockRequestWithRole('GET', '/', 'owner');
      const res = await reservationsRouter.fetch(req, env as any);
      expect(res.status).toBe(200);
      const body = await res.json() as Record<string, unknown>;
      expect(body.success).toBe(true);
    });

    it('rejects PATCH /:id/approve without auth (401) and as customer (403)', async () => {
      const unauthReq = mockRequest('PATCH', '/rsv_123/approve');
      const unauthRes = await reservationsRouter.fetch(unauthReq, env as any);
      expect(unauthRes.status).toBe(401);

      const custReq = await mockRequestWithRole('PATCH', '/rsv_123/approve', 'customer');
      const custRes = await reservationsRouter.fetch(custReq, env as any);
      expect(custRes.status).toBe(403);

      const staffReq = await mockRequestWithRole('PATCH', '/rsv_123/approve', 'staff');
      const staffRes = await reservationsRouter.fetch(staffReq, env as any);
      expect(staffRes.status).toBe(200);
    });

    it('rejects PATCH /:id/reject without auth (401) and as customer (403)', async () => {
      const unauthReq = mockRequest('PATCH', '/rsv_123/reject');
      const unauthRes = await reservationsRouter.fetch(unauthReq, env as any);
      expect(unauthRes.status).toBe(401);

      const custReq = await mockRequestWithRole('PATCH', '/rsv_123/reject', 'customer');
      const custRes = await reservationsRouter.fetch(custReq, env as any);
      expect(custRes.status).toBe(403);

      const staffReq = await mockRequestWithRole('PATCH', '/rsv_123/reject', 'staff');
      const staffRes = await reservationsRouter.fetch(staffReq, env as any);
      expect(staffRes.status).toBe(200);
    });

    it('rejects DELETE /:id without auth (401) and as customer (403)', async () => {
      const unauthReq = mockRequest('DELETE', '/rsv_123');
      const unauthRes = await reservationsRouter.fetch(unauthReq, env as any);
      expect(unauthRes.status).toBe(401);

      const custReq = await mockRequestWithRole('DELETE', '/rsv_123', 'customer');
      const custRes = await reservationsRouter.fetch(custReq, env as any);
      expect(custRes.status).toBe(403);

      const staffReq = await mockRequestWithRole('DELETE', '/rsv_123', 'staff');
      const staffRes = await reservationsRouter.fetch(staffReq, env as any);
      expect(staffRes.status).toBe(200);
    });
  });
});
