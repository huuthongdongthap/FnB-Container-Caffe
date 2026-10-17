import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockDB, createMockEnv } from '../test-utils';
import { Hono } from 'hono';
import { birthdayRouter } from '../../routes/birthday';

function makeDB(): ReturnType<typeof createMockDB> {
  return createMockDB();
}

describe('birthday smoke', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('GET /check — missing params returns 400', async() => {
    const app = new Hono();
    app.route('/api/birthday', birthdayRouter);

    const req = new Request('https://test.aura/api/birthday/check', {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });

    const env = { ...createMockEnv(), AURA_DB: makeDB() };
    const res = await app.fetch(req, env);
    expect(res.status).toBe(400);
  });

  it('GET /check — no customer found returns eligible:false', async() => {
    const app = new Hono();
    app.route('/api/birthday', birthdayRouter);

    const req = new Request('https://test.aura/api/birthday/check?phone=0000000000', {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });

    const env = { ...createMockEnv(), AURA_DB: makeDB() };
    const res = await app.fetch(req, env);
    expect(res.status).toBe(200);
    const data = await res.json() as Record<string, unknown>;
    expect(data.success).toBe(true);
    expect(data.data.eligible).toBe(false);
  });

  it('POST /redeem — missing body returns 400', async() => {
    const app = new Hono();
    app.route('/api/birthday', birthdayRouter);

    const req = new Request('https://test.aura/api/birthday/redeem', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });

    const env = { ...createMockEnv(), AURA_DB: makeDB() };
    const res = await app.fetch(req, env);
    expect(res.status).toBe(400);
  });

  it('GET /check and POST /redeem support canonical D1 date_of_birth column', async() => {
    const app = new Hono();
    app.route('/api/birthday', birthdayRouter);

    const todayIso = new Date().toISOString().slice(0, 10);
    const dob = `1995-${todayIso.slice(5, 10)}`;
    const db = makeDB();
    db.prepare = vi.fn().mockImplementation((sql: string) => ({
      bind: vi.fn().mockReturnValue({
        first: vi.fn().mockImplementation(async () => {
          if (sql.includes('date_of_birth AS birthday')) {
            return { id: 'cust_bday', name: 'Lan', phone: '0909111222', birthday: dob };
          }
          if (sql.includes('birthday_redemptions')) {
            return null;
          }
          return null;
        }),
        run: vi.fn().mockResolvedValue({ success: true })
      })
    })) as any;

    const env = { ...createMockEnv(), AURA_DB: db };
    const checkRes = await app.fetch(
      new Request('https://test.aura/api/birthday/check?phone=0909111222', { method: 'GET' }),
      env
    );
    expect(checkRes.status).toBe(200);
    const checkBody = await checkRes.json() as any;
    expect(checkBody.success).toBe(true);
    expect(checkBody.data.eligible).toBe(true);
    expect(checkBody.data.birthday).toBe(dob);

    const redeemRes = await app.fetch(
      new Request('https://test.aura/api/birthday/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customer_id: 'cust_bday' })
      }),
      env
    );
    expect(redeemRes.status).toBe(201);
  });

  it('PUT /config requires authentication', async() => {
    const app = new Hono();
    app.route('/api/birthday', birthdayRouter);
    const env = { ...createMockEnv(), AURA_DB: makeDB() };

    const unauthRes = await app.fetch(
      new Request('https://test.aura/api/birthday/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ discountPercent: 25 })
      }),
      env
    );
    expect(unauthRes.status).toBe(401);
  });
});
