// @vitest-environment node
import { afterEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { app } from '../../index';
import { generateJWT } from '../../lib/jwt';
import { createOrderSchema } from '../../lib/validators/order';
import { orderCreationFixture } from '../integrations/order-creation-fixture';
import { TEST_JWT_SECRET } from '../test-utils';

const fixtures: ReturnType<typeof orderCreationFixture>[] = [];
const requestId = 'local-security-regression';

function fixture() {
  const value = orderCreationFixture();
  fixtures.push(value);
  value.sqlite.exec(`
    INSERT INTO users(id,name,role,tenant_id,is_active,auth_version) VALUES
      ('guard-cashier','Local Cashier','cashier','cafe-a',1,1),
      ('guard-staff','Local Staff','staff','cafe-a',1,1);
    INSERT INTO orders(id,items,total,status,payment_status,payment_method,customer_name,customer_phone,tenant_id) VALUES
      ('GUARD_A','[]',20000,'served','unpaid','cod','Local A','0900000010','cafe-a'),
      ('GUARD_B','[]',20000,'served','unpaid','cod','Local B','0900000020','cafe-b');
    INSERT INTO payments(id,order_id,method,amount,status,tenant_id) VALUES
      ('PAY_GUARD_A','GUARD_A','cod',20000,'pending','cafe-a'),
      ('PAY_GUARD_B','GUARD_B','cod',20000,'pending','cafe-b');
  `);
  return value;
}

async function headers(role?: 'cashier' | 'staff', extra: Record<string, string> = {}) {
  const result: Record<string, string> = { 'X-Request-ID': requestId, ...extra };
  if (role) {
    const issuedAt = Math.floor(Date.now() / 1000);
    const token = await generateJWT({
      id: `guard-${role}`, role, tenantId: 'cafe-a', authVersion: 1,
      authTime: issuedAt, sessionType: 'staff-web',
    }, TEST_JWT_SECRET, 28800, issuedAt);
    result.Authorization = `Bearer ${token}`;
  }
  return result;
}

function expectGlobalGuards(response: Response) {
  expect(response.headers.get('X-Request-ID')).toBe(requestId);
  expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
  expect(response.headers.get('X-Frame-Options')).toBe('DENY');
}

function expectUnpaid(value: ReturnType<typeof orderCreationFixture>, id = 'GUARD_B') {
  expect(value.sqlite.prepare('SELECT status,payment_status FROM orders WHERE id = ?').get(id))
    .toMatchObject({ status: 'served', payment_status: 'unpaid' });
  expect(value.sqlite.prepare('SELECT status FROM payments WHERE order_id = ?').get(id)?.status)
    .toBe('pending');
}

afterEach(() => { for (const value of fixtures.splice(0)) value.sqlite.close(); });

describe('actual application router dependency guards', () => {
  it.each(['', '%0A', '%0D', '%E2%80%A8', '%E2%80%A9'])('keeps global guards on unmatched paths containing %s', async (suffix) => {
    const value = fixture();
    const response = await app.fetch(new Request(`https://test.aura/api/unknown-security-path${suffix}`, {
      headers: await headers(),
    }), value.env);
    expect(response.status).toBe(404);
    expectGlobalGuards(response);
    expectUnpaid(value);
  });

  it.each(['/api/orders/kds', '/api/kds/orders'])('rejects anonymous and invalid sessions on %s', async (path) => {
    const value = fixture();
    for (const Authorization of ['', 'Bearer invalid-local-token']) {
      const response = await app.fetch(new Request(`https://test.aura${path}`, {
        headers: await headers(undefined, { Authorization }),
      }), value.env);
      expect(response.status).toBe(401);
      expectGlobalGuards(response);
    }
    expectUnpaid(value);
  });

  it.each(['%0A', '%0D', '%E2%80%A8', '%E2%80%A9'])('does not dispatch protected mutations through encoded %s', async (suffix) => {
    const value = fixture();
    for (const path of [`/api/orders/GUARD_B${suffix}/mark-cod-paid`, `/api/orders/GUARD_B/mark-cod-paid/${suffix}`]) {
      const response = await app.fetch(new Request(`https://test.aura${path}`, {
        method: 'PATCH', headers: await headers(),
      }), value.env);
      expect([401, 404]).toContain(response.status);
      expectGlobalGuards(response);
      expectUnpaid(value);
    }
  });

  it('preserves cashier-only collection and signed-tenant isolation', async () => {
    const value = fixture();
    const request = async (id: string, role?: 'cashier' | 'staff', forgedTenant = false) => app.fetch(new Request(
      `https://test.aura/api/orders/${id}/mark-cod-paid${forgedTenant ? '?tenant_id=cafe-b' : ''}`, {
        method: 'PATCH', headers: await headers(role, forgedTenant ? { 'X-Tenant-ID': 'cafe-b' } : {}),
      },
    ), value.env);
    expect((await request('GUARD_A')).status).toBe(401);
    expect((await request('GUARD_A', 'staff')).status).toBe(403);
    expect((await request('GUARD_B', 'cashier', true)).status).toBe(403);
    expect((await request('GUARD_B', 'cashier')).status).toBe(404);
    expectUnpaid(value);
    expectUnpaid(value, 'GUARD_A');

    const collected = await request('GUARD_A', 'cashier');
    expect(collected.status).toBe(200);
    expectGlobalGuards(collected);
    expect(value.sqlite.prepare("SELECT payment_status FROM orders WHERE id='GUARD_A'").get()?.payment_status).toBe('paid');
    expect(value.sqlite.prepare("SELECT status FROM payments WHERE order_id='GUARD_A'").get()?.status).toBe('completed');
    expectUnpaid(value);
  });
});

describe('bounded collection validation dependency guards', () => {
  it('rejects oversized collections before visiting invalid elements', () => {
    let visits = 0;
    const schema = z.array(z.preprocess((value) => { visits++; return value; }, z.string())).max(2);
    const result = schema.safeParse(Array(32).fill(null));
    expect(result.success).toBe(false);
    if (result.success) throw new Error('Oversized collection unexpectedly accepted');
    expect(result.error.issues).toHaveLength(1);
    expect(result.error.issues[0].code).toBe('too_big');
    expect(visits).toBe(0);
    expect(schema.safeParse(['a', 'b']).success).toBe(true);
    expect(schema.safeParse([null]).success).toBe(false);
  });

  it('bounds errors for the actual order-items schema while preserving valid input', () => {
    const items = createOrderSchema.shape.items;
    const result = items.safeParse(Array(101).fill(null));
    expect(result.success).toBe(false);
    if (result.success) throw new Error('Oversized order unexpectedly accepted');
    expect(result.error.issues).toHaveLength(1);
    expect(result.error.issues[0].code).toBe('too_big');
    expect(items.safeParse([{ name: 'Local coffee', quantity: 1, price: 20000 }]).success).toBe(true);
    expect(items.safeParse([{ name: '', quantity: 0 }]).success).toBe(false);
  });
});
