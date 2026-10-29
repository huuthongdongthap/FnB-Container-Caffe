// @vitest-environment node
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { writeFileSync } from 'node:fs';
import { app } from '/Users/mac/mekong-cli/FnB-Container-Caffe/worker/src/index';
import { orderCreationFixture } from '/Users/mac/mekong-cli/FnB-Container-Caffe/worker/src/__tests__/integrations/order-creation-fixture';

const observations: unknown[] = [];
let fixture: ReturnType<typeof orderCreationFixture>;
let deferred: Promise<unknown>[];
beforeEach(() => {
  fixture = orderCreationFixture();
  fixture.env.ENVIRONMENT = 'production';
  fixture.env.PILOT_TENANT_ID = 'default';
  deferred = [];
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Audit: outbound blocked')));
  fixture.sqlite.prepare('INSERT INTO customers(id,email,name,phone,tenant_id) VALUES (?,?,?,?,?)')
    .run('audit-customer', 'synthetic@audit.invalid', 'Synthetic audit member', '0900000088', 'default');
  fixture.sqlite.prepare('INSERT INTO cashback_wallets(id,customer_id,balance,total_earned,total_spent) VALUES (?,?,12345,12345,0)')
    .run('audit-wallet', 'audit-customer');
});
afterEach(async () => {
  await Promise.allSettled(deferred);
  fixture.sqlite.close();
  vi.unstubAllGlobals();
});
afterAll(() => writeFileSync(new URL('./backend-observations.json', import.meta.url), JSON.stringify(observations, null, 2)));
const request = (path: string, body?: unknown) => app.fetch(new Request(`https://audit.invalid${path}`, {
  method: body === undefined ? 'GET' : 'POST', headers: { 'Content-Type': 'application/json' },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
}), fixture.env, { waitUntil(p: Promise<unknown>) { deferred.push(p); }, passThroughOnException() {} } as never);

describe('Audit security acceptance: customer login', () => {
  it('LOGIN-01: never issues an existing customer token from an unproved public phone', async () => {
    const response = await request('/api/loyalty/phone-auth', { phone: '0900000088' });
    const body = await response.json() as Record<string, unknown>;
    const tokenIssued = typeof body.token === 'string' && body.token.length > 0;
    const customer = body.customer as { id?: string } | undefined;
    observations.push({ id: 'LOGIN-01', status: response.status, tokenIssued,
      matchesExistingSyntheticCustomer: customer?.id === 'audit-customer', credentialsProvided: ['phone'],
      expected: 'No account token without proof of ownership' });
    expect(tokenIssued, 'A public phone is contact input, not proof of customer ownership').toBe(false);
  });
  it('LOGIN-02: denies anonymous profile/wallet lookup by a known phone', async () => {
    const response = await request('/api/loyalty/lookup?phone=0900000088');
    const body = await response.json() as { member?: Record<string, unknown> };
    const privateProfileReturned = Boolean(body.member?.id || body.member?.name || body.member?.balance);
    observations.push({ id: 'LOGIN-02', status: response.status, privateProfileReturned,
      fieldsReturned: Object.keys(body.member || {}), expected: 'No private profile or balance for anonymous caller' });
    expect(privateProfileReturned, 'Anonymous phone lookup must not expose a customer profile or wallet').toBe(false);
  });
});
