// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { Hono } from 'hono';
import type { D1Database } from '@cloudflare/workers-types';
import type { Env } from '../../types/env';
import { resolveStaffPushRequestedRole, isStaffPushRole } from '../../tree/push/roles';
import { reviewsRouter } from '../../routes/reviews';
import { checkinRouter } from '../../routes/checkin';
import { pushRouter } from '../../routes/push';
import { registerSendHandler } from '../../routes/broadcast-handlers/send-handler';
import { customerAssistantRouter } from '../../routes/customer-assistant';
import { zaloWebhookRouter } from '../../routes/zalo-webhook';
import { generateJWT } from '../../lib/jwt';

function createSqliteD1(sqlite: DatabaseSync): D1Database {
  const prepare = (sql: string) => {
    let params: unknown[] = [];
    const stmt = {
      bind(...values: unknown[]) {
        params = values;
        return stmt;
      },
      async first<T = Record<string, unknown>>(colName?: string): Promise<T | null> {
        const s = sqlite.prepare(sql);
        const row = s.get(...(params as never[])) as Record<string, unknown> | undefined;
        if (!row) return null;
        if (colName) return ((row[colName] as T) ?? null);
        return row as unknown as T;
      },
      async all<T = Record<string, unknown>>(): Promise<{ results: T[]; success: boolean }> {
        const s = sqlite.prepare(sql);
        const rows = s.all(...(params as never[])) as unknown as T[];
        return { results: rows, success: true };
      },
      async run(): Promise<{ success: boolean; meta: { changes: number; last_row_id: number } }> {
        const s = sqlite.prepare(sql);
        const info = s.run(...(params as never[]));
        return {
          success: true,
          meta: {
            changes: Number(info.changes ?? 0),
            last_row_id: Number(info.lastInsertRowid ?? 0),
          },
        };
      },
    };
    return stmt;
  };

  return {
    prepare,
    async batch(statements: Array<{ run: () => Promise<unknown> }>) {
      const out = [];
      for (const st of statements) {
        out.push(await st.run());
      }
      return out;
    },
    async exec(script: string) {
      sqlite.exec(script);
      return { count: 0, duration: 0 };
    },
    dump() {
      throw new Error('Not implemented');
    },
  } as unknown as D1Database;
}

const JWT_SECRET = 'test-secret-at-least-32-chars-long-12345';

describe('Phase 54 — Slice BA3 Security Hardening', () => {
  describe('BA3-3: WebPush Role Privilege Escalation Prevention', () => {
    it('prevents a waiter from subscribing with elevated roles', () => {
      const resOwner = resolveStaffPushRequestedRole('owner', 'waiter');
      expect(resOwner.ok).toBe(false);
      if (!resOwner.ok) {
        expect(resOwner.error).toContain('Forbidden');
      }

      const resAdmin = resolveStaffPushRequestedRole('admin', 'waiter');
      expect(resAdmin.ok).toBe(false);

      const resManager = resolveStaffPushRequestedRole('manager', 'waiter');
      expect(resManager.ok).toBe(false);

      const resStaff = resolveStaffPushRequestedRole('staff', 'waiter');
      expect(resStaff.ok).toBe(true);
      if (resStaff.ok) {
        expect(resStaff.role).toBe('staff');
      }

      const resSelf = resolveStaffPushRequestedRole('waiter', 'waiter');
      expect(resSelf.ok).toBe(true);
      if (resSelf.ok) {
        expect(resSelf.role).toBe('waiter');
      }
    });

    it('allows owner or admin to self-assign any subordinate role', () => {
      const res = resolveStaffPushRequestedRole('waiter', 'owner');
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.role).toBe('waiter');
      }

      const resKitchen = resolveStaffPushRequestedRole('kitchen', 'admin');
      expect(resKitchen.ok).toBe(true);
      if (resKitchen.ok) {
        expect(resKitchen.role).toBe('kitchen');
      }
    });

    it('rejects push subscription requests from non-staff callers', () => {
      const res = resolveStaffPushRequestedRole('staff', 'customer');
      expect(res.ok).toBe(false);
      expect(isStaffPushRole('customer')).toBe(false);
    });
  });

  describe('BA3-1: Reviews Guest Phone Ownership & Rating Validation', () => {
    it('rejects guest order review when phone is missing or mismatched', async () => {
      const sqlite = new DatabaseSync(':memory:');
      sqlite.exec(`
        CREATE TABLE orders (
          id TEXT PRIMARY KEY,
          customer_id TEXT,
          customer_phone TEXT,
          status TEXT,
          tenant_id TEXT
        );
        CREATE TABLE reviews (
          id TEXT PRIMARY KEY,
          order_id TEXT,
          rating INTEGER,
          comment TEXT,
          customer_name TEXT,
          tenant_id TEXT,
          created_at TEXT
        );
      `);
      sqlite.prepare("INSERT INTO orders (id, customer_id, customer_phone, status, tenant_id) VALUES ('ord_guest_1', '', '0901234567', 'completed', 'default')").run();

      const db = createSqliteD1(sqlite);
      const app = new Hono<{ Bindings: Env }>();
      app.use('*', async (c, next) => {
        c.env = { AURA_DB: db, JWT_SECRET } as unknown as Env;
        await next();
      });
      app.route('/api/reviews', reviewsRouter);

      // 1. Missing phone
      const resMissing = await app.request('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order_id: 'ord_guest_1',
          rating: 5,
          comment: 'Great coffee!',
        }),
      });
      expect(resMissing.status).toBe(403);
      const dataMissing = await resMissing.json();
      expect(dataMissing.success).toBe(false);

      // 2. Mismatched phone
      const resMismatch = await app.request('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order_id: 'ord_guest_1',
          customer_phone: '0988888888',
          rating: 5,
          comment: 'Great coffee!',
        }),
      });
      expect(resMismatch.status).toBe(403);

      // 3. Matching phone with Vietnam prefix normalization (+84 -> 0)
      const resMatch = await app.request('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order_id: 'ord_guest_1',
          customer_phone: '+84 901 234 567',
          rating: 5,
          comment: 'Great coffee!',
        }),
      });
      expect(resMatch.status).toBe(201);
      const dataMatch = await resMatch.json();
      expect(dataMatch.success).toBe(true);
    });

    it('rejects invalid rating query filters outside 1..5', async () => {
      const sqlite = new DatabaseSync(':memory:');
      sqlite.exec(`
        CREATE TABLE reviews (
          id TEXT PRIMARY KEY,
          order_id TEXT,
          rating INTEGER,
          comment TEXT,
          customer_name TEXT,
          tenant_id TEXT,
          created_at TEXT
        );
      `);
      const db = createSqliteD1(sqlite);
      const app = new Hono<{ Bindings: Env }>();
      app.use('*', async (c, next) => {
        c.env = { AURA_DB: db, JWT_SECRET } as unknown as Env;
        await next();
      });
      app.route('/api/reviews', reviewsRouter);

      const resInvalid = await app.request('/api/reviews?rating=99');
      expect(resInvalid.status).toBe(400);
      const data = await resInvalid.json();
      expect(data.error).toContain('1 đến 5');
    });
  });

  describe('BA3-2: Check-in Authentication & Cashback Ledger Integrity', () => {
    it('requires authentication for check-in creation', async () => {
      const sqlite = new DatabaseSync(':memory:');
      const db = createSqliteD1(sqlite);
      const app = new Hono<{ Bindings: Env }>();
      app.use('*', async (c, next) => {
        c.env = { AURA_DB: db, JWT_SECRET } as unknown as Env;
        await next();
      });
      app.route('/api/checkin', checkinRouter);

      const res = await app.request('/api/checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_id: 'cust_123',
          table_id: 'tbl_1',
        }),
      });
      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.error).toContain('Authentication required');
    });
  });

  describe('BA3-4: Push SSRF Loopback & Private IP Blocking', () => {
    it('rejects IPv6 loopbacks and private addresses in push endpoint', async () => {
      const sqlite = new DatabaseSync(':memory:');
      const db = createSqliteD1(sqlite);
      const app = new Hono<{ Bindings: Env }>();
      app.use('*', async (c, next) => {
        c.env = { AURA_DB: db, JWT_SECRET } as unknown as Env;
        await next();
      });
      app.route('/api/push', pushRouter);

      const token = await generateJWT({ id: 'user_1', role: 'staff', tenantId: 'default' }, JWT_SECRET);

      const resLoopback6 = await app.request('/api/push/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          endpoint: 'https://[::1]:8080/push',
          keys: { p256dh: 'test', auth: 'test' },
        }),
      });
      expect(resLoopback6.status).toBe(400);

      const resMapped4 = await app.request('/api/push/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          endpoint: 'https://[::ffff:127.0.0.1]/push',
          keys: { p256dh: 'test', auth: 'test' },
        }),
      });
      expect(resMapped4.status).toBe(400);
    });
  });

  describe('BA3-5: Broadcast Send Authentication & Query Fallback Isolation', () => {
    it('requires authentication for broadcast send endpoint', async () => {
      const sqlite = new DatabaseSync(':memory:');
      const db = createSqliteD1(sqlite);
      const app = new Hono<{ Bindings: Env }>();
      app.use('*', async (c, next) => {
        c.env = { AURA_DB: db, JWT_SECRET } as unknown as Env;
        await next();
      });
      registerSendHandler(app as never);

      const res = await app.request('/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer invalid-token',
        },
        body: JSON.stringify({
          segment: 'vip',
          channel: 'sms',
          message: 'Hello VIP',
        }),
      });
      expect(res.status).toBe(401);
    });
  });

  describe('BA3-6: AI Assistant Ownership & Zalo Webhook Replay Protection', () => {
    it('requires authentication when querying customer assistant by phone', async () => {
      const sqlite = new DatabaseSync(':memory:');
      const db = createSqliteD1(sqlite);
      const app = new Hono<{ Bindings: Env }>();
      app.use('*', async (c, next) => {
        c.env = { AURA_DB: db, JWT_SECRET } as unknown as Env;
        await next();
      });
      app.route('/api/assistant', customerAssistantRouter);

      const res = await app.request('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: 'Kiểm tra điểm tích lũy',
          phone: '0901234567',
        }),
      });
      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.error).toContain('Authentication required');
    });

    it('prevents customer from querying another customer phone in assistant', async () => {
      const sqlite = new DatabaseSync(':memory:');
      sqlite.exec(`
        CREATE TABLE customers (
          id TEXT PRIMARY KEY,
          phone TEXT,
          name TEXT,
          loyalty_points INTEGER,
          loyalty_tier TEXT,
          tenant_id TEXT
        );
        CREATE TABLE orders (
          id TEXT PRIMARY KEY,
          customer_id TEXT,
          customer_phone TEXT,
          status TEXT,
          total_amount INTEGER,
          tenant_id TEXT,
          created_at TEXT
        );
      `);
      sqlite.prepare("INSERT INTO customers (id, phone, name, tenant_id) VALUES ('cust_1', '0901111111', 'User 1', 'default')").run();
      sqlite.prepare("INSERT INTO customers (id, phone, name, tenant_id) VALUES ('cust_2', '0902222222', 'User 2', 'default')").run();

      const db = createSqliteD1(sqlite);
      const app = new Hono<{ Bindings: Env }>();
      app.use('*', async (c, next) => {
        c.env = { AURA_DB: db, JWT_SECRET } as unknown as Env;
        await next();
      });
      app.route('/api/assistant', customerAssistantRouter);

      const tokenUser1 = await generateJWT({ id: 'cust_1', role: 'customer', phone: '0901111111', tenantId: 'default' }, JWT_SECRET);

      const resForbidden = await app.request('/api/assistant', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenUser1}`,
        },
        body: JSON.stringify({
          query: 'Kiểm tra điểm tích lũy',
          phone: '0902222222', // other customer phone
        }),
      });
      expect(resForbidden.status).toBe(403);
      const data = await resForbidden.json();
      expect(data.error).toContain('cannot query another customer');
    });
  });
});
