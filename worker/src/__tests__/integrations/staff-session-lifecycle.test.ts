// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { generateJWT, verifyJWT } from '../../lib/jwt';
import { TEST_JWT_SECRET } from '../test-utils';
import { staffSessionFixture, STAFF_PASSWORD } from '../helpers/staff-session-fixture';

let f: ReturnType<typeof staffSessionFixture>;
beforeEach(() => { f = staffSessionFixture(); });
afterEach(() => { f.sqlite.close(); vi.useRealTimers(); });
const login = () => f.request('/mobile/login', undefined, 'POST', { device_token: 'local-device-token', pin: '1234' });

describe('canonical Staff authentication', () => {
  it('reads real profile and role from canonical D1 without KV or email/username/full_name columns', async () => {
    const response = await login();
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.user).toMatchObject({ id: 'staff', name: 'Name staff', email: '', role: 'staff', tenantId: 'cafe-a' });
    expect(data.expires_in).toBe(28800);
    expect(response.headers.get('Set-Cookie')).toContain('Max-Age=28800');
    const claims = await verifyJWT(data.token, TEST_JWT_SECRET);
    expect(claims!.exp! - claims!.iat!).toBe(28800);
    for (const path of ['/mobile/me', '/api/auth/me', '/api/auth/session', '/api/v1/auth/me']) {
      const me = await f.request(path, data.token);
      expect(me.status, path).toBe(200);
      expect((await me.json()).user).toMatchObject({ role: 'staff', tenantId: 'cafe-a', name: 'Name staff' });
    }
  });
  it('keeps customer TTL 7 days while web Staff uses 8 hours', async () => {
    await f.credential('owner');
    let response = await f.request('/api/auth/login', undefined, 'POST', { email: 'owner@local.test', password: STAFF_PASSWORD });
    expect(response.status).toBe(200);
    const owner = await response.json();
    expect(owner.user).toMatchObject({ role: 'owner', tenantId: 'cafe-a' });
    const ownerClaims = await verifyJWT(owner.token, TEST_JWT_SECRET);
    expect(ownerClaims!.exp! - ownerClaims!.iat!).toBe(28800);
    await f.credential('customer', 'customer');
    response = await f.request('/api/auth/login', undefined, 'POST', { email: 'customer@local.test', password: STAFF_PASSWORD });
    expect(response.status).toBe(200);
    const claims = await verifyJWT((await response.json()).token, TEST_JWT_SECRET);
    expect(claims!.exp! - claims!.iat!).toBe(604800);
  });
  it('refresh requires a live matching Bearer token and cannot extend the original deadline', async () => {
    const token = await f.token('staff', true, Math.floor(Date.now() / 1000) - 28000);
    const body = { device_token: 'local-device-token' };
    const response = await f.request('/mobile/refresh', token, 'POST', body);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.expires_in).toBeLessThanOrEqual(800);
    expect((await verifyJWT(data.token, TEST_JWT_SECRET))!.exp).toBe((await verifyJWT(token, TEST_JWT_SECRET))!.exp);
    for (const invalid of [undefined, await f.token('owner'), await generateJWT({ id: 'customer', role: 'customer', name: '', email: '' }, TEST_JWT_SECRET)]) {
      expect((await f.request('/mobile/refresh', invalid, 'POST', body)).status).toBe(401);
    }
    expect((await f.request('/mobile/refresh', undefined, 'POST', body, { Cookie: `access_token=${token}` })).status).toBe(401);
    expect((await f.request('/mobile/refresh', token, 'POST', { device_token: 'wrong-device' })).status).toBe(401);
  });
  it('fails closed on missing authority schema even if KV has a cached profile', async () => {
    f.sqlite.close(); f = staffSessionFixture(false);
    await f.kv.put('user:staff', JSON.stringify({ name: 'Cached', role: 'owner' }));
    const response = await login();
    expect(response.status).toBe(503);
    expect((await response.json()).code).toBe('AUTH_STATE_UNAVAILABLE');
  });
  it('locks repeated wrong PIN attempts and does not unlock refresh', async () => {
    const body = { device_token: 'local-device-token', pin: '9999' };
    for (let i = 0; i < 4; i++) expect((await f.request('/mobile/login', undefined, 'POST', body)).status).toBe(401);
    expect((await f.request('/mobile/login', undefined, 'POST', body)).status).toBe(429);
    expect((await login()).status).toBe(429);
    expect((await f.request('/mobile/refresh', await f.token('staff', true), 'POST', { device_token: 'local-device-token' })).status).toBe(429);
  });
  it('rejects legacy, overly long, expired and invalid Staff JWTs through HTTP and optional auth', async () => {
    const legacy = await generateJWT({ id: 'staff', name: '', email: '', role: 'staff', tenantId: 'cafe-a' }, TEST_JWT_SECRET);
    for (const path of ['/api/kds/orders', '/api/v1/kds/orders', '/mobile/kds/orders', '/api/orders/missing/track']) {
      expect((await f.request(path, legacy)).status, path).toBe(401);
    }
    const now = Math.floor(Date.now() / 1000);
    const claims = { id: 'staff', name: '', email: '', role: 'staff', tenantId: 'cafe-a', authVersion: 1, authTime: now, sessionType: 'staff-web' };
    expect((await f.request('/api/kds/orders', await generateJWT(claims, TEST_JWT_SECRET, 604800))).status).toBe(401);
    expect((await f.request('/api/kds/orders', await generateJWT({ ...claims, authTime: now - 28800 }, TEST_JWT_SECRET, 28800, now - 28800))).status).toBe(401);
    expect((await f.request('/api/kds/orders')).status).toBe(401);
  });
  it.each(['owner', 'admin', 'manager', 'staff', 'waiter', 'cashier', 'kitchen', 'barista', 'chef'])('keeps operational role %s usable', async role => {
    f.sqlite.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, 'staff');
    expect((await f.request('/api/kds/orders', await f.token())).status).toBe(200);
  });
  it('detects tenant and role changes even when an old updater forgot to bump the version', async () => {
    const token = await f.token();
    f.sqlite.prepare('UPDATE users SET tenant_id = ? WHERE id = ?').run('cafe-b', 'staff');
    expect((await f.request('/api/kds/orders', token)).status).toBe(401);
    f.sqlite.prepare('UPDATE users SET tenant_id = ?, role = ? WHERE id = ?').run('cafe-a', 'cashier', 'staff');
    expect((await f.request('/mobile/me', token)).status).toBe(401);
  });
  it('does not refresh a session after its exact 8h deadline', async () => {
    const now = Math.floor(Date.now() / 1000);
    const token = await f.token('staff', true, now - 28799);
    vi.useFakeTimers(); vi.setSystemTime((now + 1) * 1000);
    const response = await f.request('/mobile/refresh', token, 'POST', { device_token: 'local-device-token' });
    expect(response.status).toBe(401);
    expect((await response.json()).code).toBe('SESSION_EXPIRED');
  });
});
