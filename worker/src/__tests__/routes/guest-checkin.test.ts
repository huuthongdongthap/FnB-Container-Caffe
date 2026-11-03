/**
 * Tests for POST /api/orders/guest-checkin  (no auth, for QR guests)
 */
import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { ordersRouter } from '../../routes/orders-hono';
import { matchesHaTenant } from '../../tree/homeassistant/devices';
import { matchesFrigateTenant } from '../../tree/integrations/frigate/sync';
import { matchesMauticTenant, getSyncStatus } from '../../tree/mautic/sync-state';
import { matchesCatalogTenant } from '../../routes/openapi-categories-handlers/helpers';
import { matchesLoyaltyTenant } from '../../routes/openapi-loyalty-handlers/loyalty-db-helpers';

function buildApp(
  tables: Array<{ id: string; table_number: string; status: string }> = [
    { id: 'tbl-001', table_number: 'T01', status: 'Available' }
  ]
) {
  const env = { AURA_DB: makeDB(tables), JWT_SECRET: 'test-secret', AUTH_KV: null } as any;
  const app = new Hono();
  app.route('/api/orders', ordersRouter);
  return { app, env };
}

function makeDB(tables: any[]) {
  const stmts: any[] = [];
  const db: any = {
    prepare: (_sql: string) => {
      const stmt: any = { _binds: [], idx: 0, _sql };
      stmts.push(stmt);
      stmt.bind = (...args: unknown[]) => {
        stmt._binds = args;
        return stmt;
      };
      stmt.first = async() => {
        if (_sql.includes('FROM cafe_tables WHERE table_number')) {
          return tables.find((t: any) => t.table_number === stmt._binds[0]) ?? null;
        }
        if (_sql.includes('FROM orders WHERE id')) {
          return { id: 'ORD-TEST' } as any;
        }
        return null;
      };
      stmt.all = async() => ({ results: tables });
      stmt.run = async() => ({ success: true, changes: 1 });
      return stmt;
    },
    batch: async(stmtsList: any[]) => {
      return stmtsList.map((s) => ({ success: true, changes: 1 }));
    }
  };
  return db;
}

describe('POST /api/orders/guest-checkin', () => {
  it('201 - creates check-in for valid input', async() => {
    const { app, env } = buildApp();
    const res = await app.fetch(
      new Request('http://localhost/api/orders/guest-checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customer_name: 'Nguyen Van A', customer_phone: '0912345678', table_id: 'T01' })
      }),
      env
    );
    expect(res.status).toBe(201);
    const body = await (res as any).json();
    expect(body.success).toBe(true);
    expect(body.data.id).toBeTruthy();
    expect(body.data.table_number).toBe('T01');
  });

  it('400 - missing customer_name', async() => {
    const { app, env } = buildApp();
    const res = await app.fetch(
      new Request('http://localhost/api/orders/guest-checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customer_phone: '0912345678', table_id: 'T01' })
      }),
      env
    );
    expect(res.status).toBe(400);
  });

  it('400 - missing customer_phone', async() => {
    const { app, env } = buildApp();
    const res = await app.fetch(
      new Request('http://localhost/api/orders/guest-checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customer_name: 'Test', table_id: 'T01' })
      }),
      env
    );
    expect(res.status).toBe(400);
  });

  it('404 - unknown table_id', async() => {
    const { app, env } = buildApp([]);
    const res = await app.fetch(
      new Request('http://localhost/api/orders/guest-checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customer_name: 'Test', customer_phone: '0912345678', table_id: 'X99' })
      }),
      env
    );
    expect(res.status).toBe(404);
  });

  it('400 - empty customer_name (Zod)', async() => {
    const { app, env } = buildApp();
    const res = await app.fetch(
      new Request('http://localhost/api/orders/guest-checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customer_name: '', customer_phone: '0912345678', table_id: 'T01' })
      }),
      env
    );
    expect(res.status).toBe(400);
  });

  it('201 - response shape correct', async() => {
    const { app, env } = buildApp();
    const res = await app.fetch(
      new Request('http://localhost/api/orders/guest-checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customer_name: 'Tran Thi B', customer_phone: '0988777666', table_id: 'T01' })
      }),
      env
    );
    expect(res.status).toBe(201);
    const body = await (res as any).json();
    expect(body.data.id).toBeTruthy();
    expect(body.data.customer_name).toBe('Tran Thi B');
    expect(body.data.customer_phone).toBe('0988777666');
    expect(body.data.status).toBe('pending');
  });

  it('normalizes whitespace-padded tenant_id in guest-checkin UPDATE cafe_tables and tree/catalog/loyalty matchers', async() => {
    let capturedBatchStmts: any[] = [];
    const { app, env } = buildApp([{ id: 'tbl-001', table_number: 'T01', status: 'Available' }]);
    const origBatch = env.AURA_DB.batch;
    env.AURA_DB.batch = async (stmtsList: any[]) => {
      capturedBatchStmts = stmtsList;
      return origBatch(stmtsList);
    };

    const res = await app.fetch(
      new Request('http://localhost/api/orders/guest-checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customer_name: 'Le Van C', customer_phone: '0909111222', table_id: 'T01' })
      }),
      env
    );
    expect(res.status).toBe(201);
    expect(capturedBatchStmts.length).toBe(2);
    expect(String(capturedBatchStmts[0]._sql)).toContain("TRIM(tenant_id) = ''");
    expect(capturedBatchStmts[0]._binds[1]).toBe('default');

    expect(matchesHaTenant({ tenant_id: '  store_02  ' }, ' store_02 ')).toBe(true);
    expect(matchesHaTenant({ tenant_id: '   ' }, ' default ')).toBe(true);
    expect(matchesHaTenant({ tenant_id: 'store_02' }, 'store_03')).toBe(false);

    expect(matchesFrigateTenant({ tenant_id: '  store_02  ' }, ' store_02 ')).toBe(true);
    expect(matchesFrigateTenant({ tenant_id: '   ' }, ' default ')).toBe(true);
    expect(matchesFrigateTenant({ tenant_id: 'store_02' }, 'store_03')).toBe(false);

    expect(matchesMauticTenant({ tenant_id: '  store_02  ' }, ' store_02 ')).toBe(true);
    expect(matchesMauticTenant({ tenant_id: '   ' }, '   ')).toBe(true);
    expect(getSyncStatus('  store_02  ')).toBe(getSyncStatus('store_02'));

    expect(matchesCatalogTenant({ tenant_id: '  store_02  ' }, ' store_02 ')).toBe(true);
    expect(matchesLoyaltyTenant({ tenant_id: '  store_02  ' }, ' store_02 ')).toBe(true);
    expect(matchesLoyaltyTenant({ tenant_id: '   ' }, ' default ')).toBe(true);
  });
});
