// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { staffSessionFixture, STAFF_PASSWORD } from '../helpers/staff-session-fixture';
import { staffMutationGuard } from '../../lib/staff-account-mutation';
import { requireStaffAccount } from '../../lib/staff-session';
import { paymentSqliteDB } from '../helpers/payment-sqlite-db';
import { createMockEnv, createMockKV } from '../test-utils';
import { app } from '../../index';

let f: ReturnType<typeof staffSessionFixture>;
beforeEach(() => { f = staffSessionFixture(); });
afterEach(() => { f.sqlite.close(); vi.useRealTimers(); });

describe('durable Staff revocation and scope', () => {
  it.each(['customer', 'staff', 'owner'])('cannot claim a legacy %s email during creation or rename', async role => {
    const owner = await f.token('owner');
    const email = 'legacy@local.test';
    const existing = JSON.stringify({ id: 'legacy-other-user', email, role, name: 'Preserved legacy account', password: 'preserved-hash' });
    await f.kv.put(`user:${email}`, existing);
    const count = f.sqlite.prepare('SELECT COUNT(*) AS count FROM users').get()!.count;
    const body = { email, name: 'Attempted replacement', password: STAFF_PASSWORD, role: 'staff' };
    for (const path of ['/api/staff', '/api/auth/register-staff']) {
      expect((await f.request(path, owner, 'POST', body)).status, path).toBe(409);
    }
    expect((await f.request('/api/staff/staff', owner, 'PATCH', { email })).status).toBe(409);
    expect(f.sqlite.prepare('SELECT COUNT(*) AS count FROM users').get()!.count).toBe(count);
    expect(f.sqlite.prepare('SELECT auth_version FROM users WHERE id = ?').get('staff')!.auth_version).toBe(1);
    expect(f.sqlite.prepare('SELECT staff_id FROM staff_login_identities WHERE email = ?').get(email)).toBeUndefined();
    expect(await f.kv.get(`user:${email}`)).toBe(existing);
  });
  it('rejects cross-tenant registration and enrolls a matching account with an atomic durable login identity', async () => {
    const owner = await f.token('owner');
    const body = { name: 'New Staff', email: 'new@local.test', phone: '0901234567', password: STAFF_PASSWORD, role: 'staff' };
    expect((await f.request('/api/auth/register-staff', owner, 'POST', { ...body, tenant_id: 'cafe-b' })).status).toBe(403);
    const put = vi.spyOn(f.kv, 'put').mockRejectedValue(new Error('KV write unavailable'));
    expect((await f.request('/api/auth/register-staff', owner, 'POST', body)).status).toBe(201);
    const lookup = f.sqlite.prepare('SELECT staff_id FROM staff_login_identities WHERE email = ?').get(body.email);
    expect(lookup).toBeTruthy();
    expect(f.sqlite.prepare('SELECT tenant_id FROM users WHERE id = ?').get(lookup!.staff_id)!.tenant_id).toBe('cafe-a');
    put.mockRestore();
    expect((await f.request('/api/auth/login', undefined, 'POST', { email: body.email, password: STAFF_PASSWORD })).status).toBe(200);
    expect((await f.request('/api/auth/register-staff', owner, 'POST', body)).status).toBe(409);
    expect(f.sqlite.prepare('SELECT COUNT(*) AS count FROM users WHERE id = ?').get(lookup!.staff_id)!.count).toBe(1);
  });
  it('keeps the first owner recoverable when every KV metadata write fails', async () => {
    const fresh = paymentSqliteDB({ canonicalStaff: true });
    try {
      const kv = createMockKV(); vi.spyOn(kv, 'put').mockRejectedValue(new Error('KV down'));
      const env = createMockEnv({ AURA_DB: fresh.db, AUTH_KV: kv });
      const request = (path: string, body: unknown) => app.fetch(new Request(`http://local.test${path}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      }), env, { waitUntil() {}, passThroughOnException() {} } as never);
      const body = { name: 'First Owner', email: 'first@local.test', password: STAFF_PASSWORD };
      const created = await request('/api/auth/bootstrap-owner', body);
      expect(created.status).toBe(201);
      expect((await request('/api/auth/login', body)).status).toBe(200);
      expect((await request('/api/auth/bootstrap-owner', body)).status).toBe(409);
    } finally { fresh.sqlite.close(); }
  });
  it('cannot enroll an account promoted after the management permission check', async () => {
    const manager = await f.token('manager');
    const batch = f.db.batch.bind(f.db);
    f.db.batch = async statements => {
      f.sqlite.prepare("UPDATE users SET role = 'owner', auth_version = auth_version + 1 WHERE id = 'staff'").run();
      return batch(statements);
    };
    const response = await f.request('/mobile/devices/register', manager, 'POST', {
      device_token: 'race-device', device_name: 'Local test', staff_id: 'staff', pin: '5678', role: 'staff',
    });
    expect(response.status).toBe(401);
    expect((await response.json()).code).toBe('SESSION_REVOKED');
    expect(f.sqlite.prepare("SELECT id FROM staff_devices WHERE device_token = 'race-device'").get()).toBeUndefined();
  });
  it('only enriches this tenant’s Staff rows and never globally enumerates KV', async () => {
    const list = vi.spyOn(f.kv, 'list'); const get = vi.spyOn(f.kv, 'get');
    const response = await f.request('/api/auth/staff', await f.token('owner'));
    expect(response.status).toBe(200);
    expect(list).not.toHaveBeenCalled();
    // Derived from the fixture's own roster rather than a hardcoded list, so
    // adding a member to the tenant cannot silently redden this suite. What is
    // being pinned is the shape of the claim: one KV read per account in the
    // actor's tenant, and none for any account outside it.
    const tenantAccounts = (f.sqlite.prepare('SELECT id FROM users WHERE tenant_id = ?').all('cafe-a') as { id: string }[])
      .map((row) => `user:${row.id}`).sort();
    const read = get.mock.calls.filter(([key]) => key.startsWith('user:')).map(([key]) => key).sort();
    expect(read).toEqual(tenantAccounts);
    expect(read).not.toContain('user:other');
    const canonical = await f.request('/api/staff', await f.token('owner'));
    expect(canonical.status).toBe(200);
    expect((await canonical.json()).data.staff.map((row: { id: string }) => row.id)).not.toContain('other');
  });
  it('disable/re-enable revokes old HTTP, mobile refresh and optional Staff sessions', async () => {
    const owner = await f.token('owner');
    const old = await f.token('staff', true);
    expect((await f.request('/api/staff/staff', owner, 'PATCH', { isActive: false })).status).toBe(200);
    expect(f.sqlite.prepare('SELECT is_active, auth_version FROM users WHERE id = ?').get('staff')).toMatchObject({ is_active: 0, auth_version: 2 });
    for (const path of ['/api/kds/orders', '/api/v1/kds/orders', '/mobile/me', '/api/auth/session', '/api/orders/test/track']) {
      const response = await f.request(path, old);
      expect(response.status, path).toBe(403);
      expect((await response.json()).code).toBe('STAFF_ACCOUNT_INACTIVE');
    }
    expect((await f.request('/api/staff/staff', owner, 'PATCH', { isActive: true })).status).toBe(200);
    expect((await f.request('/api/kds/orders', old)).status).toBe(401);
    expect((await f.request('/mobile/refresh', old, 'POST', { device_token: 'local-device-token' })).status).toBe(401);
    const list = await f.request('/api/auth/staff', owner);
    expect(list.status).toBe(200);
    const users = (await list.json()).users;
    expect(users.some((u: { id: string }) => u.id === 'other')).toBe(false);
    expect(users.find((u: { id: string }) => u.id === 'staff').isActive).toBe(true);
    expect((await f.request('/api/kds/orders', await f.token())).status).toBe(200);
  });
  it('retains tenant and role boundaries on account mutations', async () => {
    const owner = await f.token('owner');
    const manager = await f.token('manager');
    expect((await f.request('/api/staff/other', owner, 'PATCH', { isActive: false })).status).toBe(403);
    expect((await f.request('/api/staff/owner', manager, 'PATCH', { isActive: false })).status).toBe(403);
    expect((await f.request('/api/staff/staff', manager, 'PATCH', { role: 'admin' })).status).toBe(403);
    for (const role of ['owner', 'admin', 'manager']) {
      expect((await f.request('/api/staff', manager, 'POST', {
        name: 'Attempted escalation', email: `${role}@rejected.local`, password: STAFF_PASSWORD, role,
      })).status).toBe(403);
    }
    expect(f.sqlite.prepare('SELECT is_active FROM users WHERE id = ?').get('other')!.is_active).toBe(1);
  });
  it('renames durable Staff login identity and revokes the former session even when stale KV retains the old email', async () => {
    await f.credential('staff');
    f.sqlite.prepare('INSERT INTO staff_login_identities (email,staff_id) VALUES (?,?)').run('staff@local.test', 'staff');
    const old = await f.token();
    const response = await f.request('/api/staff/staff', await f.token('owner'), 'PATCH', { email: 'renamed@local.test' });
    expect(response.status).toBe(200);
    expect(f.sqlite.prepare('SELECT email FROM staff_login_identities WHERE staff_id = ?').get('staff')!.email).toBe('renamed@local.test');
    expect((await f.request('/api/kds/orders', old)).status).toBe(401);
    expect((await f.request('/api/auth/login', undefined, 'POST', { email: 'staff@local.test', password: STAFF_PASSWORD })).status).toBe(401);
    expect((await f.request('/api/auth/login', undefined, 'POST', { email: 'renamed@local.test', password: STAFF_PASSWORD })).status).toBe(200);
  });
  it('protects the last owner at SQL write time, including two competing demotions', async () => {
    const owner = await f.token('owner');
    expect((await f.request('/api/staff/owner', owner, 'PATCH', { isActive: false })).status).toBe(409);
    f.sqlite.prepare("INSERT INTO users (id, name, role, tenant_id) VALUES ('owner-2', 'Second', 'owner', 'cafe-a')").run();
    const first = staffMutationGuard(await requireStaffAccount(f.db, 'owner'), true);
    const second = staffMutationGuard(await requireStaffAccount(f.db, 'owner-2'), true);
    const results = await f.db.batch([first, second].map(guard => f.db.prepare(
      `UPDATE users SET is_active = 0, auth_version = auth_version + 1 WHERE ${guard.sql}`,
    ).bind(...guard.values)));
    expect(results.map(result => result.meta.changes)).toEqual([1, 0]);
    expect(f.sqlite.prepare("SELECT COUNT(*) AS count FROM users WHERE role = 'owner' AND is_active = 1").get()!.count).toBe(1);
  });
  it('changes Staff password and version atomically; stale KV cannot accept the old password', async () => {
    await f.credential('staff');
    const old = await f.token();
    const put = vi.spyOn(f.kv, 'put').mockRejectedValue(new Error('KV metadata unavailable'));
    const response = await f.request('/api/auth/change-password', old, 'POST', { currentPassword: STAFF_PASSWORD, newPassword: 'New-staff-local-only-456!' });
    expect(response.status).toBe(200);
    expect(f.sqlite.prepare('SELECT auth_version FROM users WHERE id = ?').get('staff')!.auth_version).toBe(2);
    expect((await f.request('/api/kds/orders', old)).status).toBe(401);
    put.mockRestore();
    const attempt = (password: string) => f.request('/api/auth/login', undefined, 'POST', { email: 'staff@local.test', password });
    expect((await attempt(STAFF_PASSWORD)).status).toBe(401);
    expect((await attempt('New-staff-local-only-456!')).status).toBe(200);
  });
  it('removes a device and bumps the account version in one batch', async () => {
    const old = await f.token('staff', true);
    const response = await f.request('/mobile/devices/device-1', await f.token('owner'), 'DELETE');
    expect(response.status).toBe(200);
    expect(f.sqlite.prepare('SELECT id FROM staff_devices WHERE id = ?').get('device-1')).toBeUndefined();
    expect(f.sqlite.prepare('SELECT auth_version FROM users WHERE id = ?').get('staff')!.auth_version).toBe(2);
    expect((await f.request('/api/kds/orders', old)).status).toBe(401);
  });
  it('rolls back the invalidation if device removal batch fails', async () => {
    const runBatch = f.db.batch.bind(f.db);
    f.db.batch = statements => runBatch([statements[0]!, f.db.prepare('INSERT INTO missing_fixture_table (id) VALUES (1)')]);
    const response = await f.request('/mobile/devices/device-1', await f.token('owner'), 'DELETE');
    expect(response.status).toBe(503);
    expect(f.sqlite.prepare('SELECT auth_version FROM users WHERE id = ?').get('staff')!.auth_version).toBe(1);
    expect(f.sqlite.prepare('SELECT id FROM staff_devices WHERE id = ?').get('device-1')).toBeTruthy();
  });
  it('a concurrent refresh cannot leave a usable token after account disable commits', async () => {
    const old = await f.token('staff', true);
    const owner = await f.token('owner');
    const [refresh, disable] = await Promise.all([
      f.request('/mobile/refresh', old, 'POST', { device_token: 'local-device-token' }),
      f.request('/api/staff/staff', owner, 'PATCH', { isActive: false }),
    ]);
    expect(disable.status).toBe(200);
    if (refresh.status === 200) expect((await f.request('/api/kds/orders', (await refresh.json()).token)).status).toBe(403);
    else expect([401, 403]).toContain(refresh.status);
  });
});

describe('open Staff SSE sessions', () => {
  it('does not stream another tenant’s order', async () => {
    f.sqlite.prepare("INSERT INTO orders (id, tenant_id, status) VALUES ('private-b','cafe-b','pending')").run();
    expect((await f.request('/api/orders/private-b/events', await f.token())).status).toBe(404);
  });
  it.each(['revoked', 'expired', 'unavailable'])('closes before another snapshot when auth becomes %s', async mode => {
    const now = Math.floor(Date.now() / 1000);
    const token = await f.token('staff', false, mode === 'expired' ? now - 28799 : undefined);
    vi.useFakeTimers();
    const response = await f.request('/api/kds/orders/stream', token);
    expect(response.status).toBe(200);
    const reader = response.body!.getReader();
    expect(new TextDecoder().decode((await reader.read()).value)).toContain('event: snapshot');
    if (mode === 'revoked') f.sqlite.prepare('UPDATE users SET auth_version = auth_version + 1 WHERE id = ?').run('staff');
    if (mode === 'unavailable') f.db.prepare = () => { throw new Error('D1 unavailable'); };
    await vi.advanceTimersByTimeAsync(3000);
    const message = new TextDecoder().decode((await reader.read()).value);
    expect(message).toContain('event: auth_error');
    expect(message).toContain(mode === 'revoked' ? 'SESSION_REVOKED' : mode === 'expired' ? 'SESSION_EXPIRED' : 'AUTH_STATE_UNAVAILABLE');
    expect((await reader.read()).done).toBe(true);
    await reader.cancel();
  });
});
