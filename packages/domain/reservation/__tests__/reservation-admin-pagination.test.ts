import { Hono } from 'hono';
import { describe, it, expect } from 'vitest';
import { reservationsRouter } from '../src/routes/reservations';

function fixture(role = 'staff', legacy = false) {
  const rows = Array.from({ length: 101 }, (_, index) => ({
    id: `r${index}`, tenant_id: 'default', status: index < 50 ? 'pending' : 'confirmed',
    date: '2026-12-01', customer_name: 'Guest', customer_phone: '0901234567',
  }));
  const queries: Array<{ sql: string; values: unknown[] }> = [];
  const db = { prepare(sql: string) {
    const entry = { sql, values: [] as unknown[] };
    queries.push(entry);
    return {
      bind(...values: unknown[]) { entry.values = values; return this; },
      async first() { return rows[0]; },
      async run() { return { success: true }; },
      async all() {
        if (legacy && sql.includes('TRIM(r.tenant_id)')) throw new Error('legacy schema');
        let filtered = rows;
        if (sql.includes('r.status = ?')) filtered = filtered.filter(row => row.status === 'confirmed');
        if (sql.includes('r.date = ?')) filtered = filtered.filter(row => row.date === '2026-12-01');
        const limit = Number(entry.values.at(-2));
        const offset = Number(entry.values.at(-1));
        return { results: filtered.slice(offset, offset + limit) };
      },
    };
  } };
  const app = new Hono();
  app.use('*', async (c, next) => {
    c.set('user' as never, { id: 'staff', role, tenantId: 'default' } as never);
    c.set('tenantId' as never, 'default' as never);
    await next();
  });
  app.route('/api/reservations', reservationsRouter);
  const env = { AURA_DB: db } as unknown as Parameters<typeof reservationsRouter.fetch>[1];
  return { app, env, queries };
}

describe('Reservation admin filters and pagination', () => {
  it.each([false, true])('filters before pagination with legacy=%s', async legacy => {
    const { app, env, queries } = fixture('staff', legacy);
    const response = await app.request('/api/reservations?date=2026-12-01&status=confirmed&limit=50&offset=50', {}, env);
    expect(response.status).toBe(200);
    const body = await response.json() as { data: Array<{ id: string }> };
    expect(body.data.map(row => row.id)).toEqual(['r100']);
    expect(queries.some(query => query.sql.includes('r.status = ?') && query.values.includes('confirmed'))).toBe(true);
  });
  it('rejects unknown status filters', async () => {
    const { app, env } = fixture();
    expect((await app.request('/api/reservations?status=unknown', {}, env)).status).toBe(400);
  });
  it('rejects insufficient permission to access reservations', async () => {
    const { app, env } = fixture('customer');
    expect((await app.request('/api/reservations', {}, env)).status).toBe(403);
  });
  it('validates customer edits before writing', async () => {
    const { app, env, queries } = fixture();
    const response = await app.request('/api/reservations/r0', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ customer_phone: 'x' }) }, env);
    expect(response.status).toBe(400);
    expect(queries.some(query => query.sql.startsWith('UPDATE'))).toBe(false);
  });
  it('persists validated customer edits using the reservation tenant scope', async () => {
    const { app, env, queries } = fixture();
    const response = await app.request('/api/reservations/r0', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ customer_name: 'Updated', customer_phone: '0987654321', notes: 'Window' }) }, env);
    expect(response.status).toBe(200);
    expect(queries.some(query => query.sql.includes('customer_name = ?, customer_phone = ?, notes = ?') && query.values.join('|') === 'Updated|0987654321|Window|r0|default')).toBe(true);
  });
});
