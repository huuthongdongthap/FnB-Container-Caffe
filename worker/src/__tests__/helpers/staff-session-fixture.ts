import { pbkdf2Sync } from 'node:crypto';
import { app } from '../../index';
import { createMockEnv, createMockKV, TEST_JWT_SECRET } from '../test-utils';
import { paymentSqliteDB } from './payment-sqlite-db';
import { issueStaffSession, requireStaffAccount } from '../../lib/staff-session';

export const STAFF_PASSWORD = 'Staff-local-only-123!';
const salt = Buffer.from('local-staff-test');
export const STAFF_HASH = `pbkdf2$100000$${salt.toString('hex')}$${pbkdf2Sync(STAFF_PASSWORD, salt, 100000, 32, 'sha256').toString('hex')}`;
const pinSalt = Buffer.from('staff-pin');
const pinHash = `pin$pbkdf2$100000$${pinSalt.toString('base64')}$${pbkdf2Sync('1234', pinSalt, 100000, 32, 'sha256').toString('base64')}`;

export function staffSessionFixture(authVersion = true) {
  const { db, sqlite } = paymentSqliteDB({ canonicalStaff: true, authVersion });
  sqlite.exec(`CREATE TABLE staff_devices (id TEXT PRIMARY KEY, staff_id TEXT, device_token TEXT UNIQUE, pin_hash TEXT,
    role TEXT, device_name TEXT, last_login_at TEXT, created_at TEXT, updated_at TEXT);`);
  for (const [id, role, tenant] of [
    ['owner', 'owner', 'cafe-a'],
    ['staff', 'staff', 'cafe-a'],
    // A second member of the same store, so an ownership check can be proven
    // with a 403 rather than inferred from the 404 a foreign tenant produces.
    ['staff2', 'staff', 'cafe-a'],
    ['other', 'staff', 'cafe-b'],
    ['manager', 'manager', 'cafe-a'],
  ]) {
    sqlite.prepare('INSERT INTO users (id,name,role,tenant_id,password_hash) VALUES (?,?,?,?,?)').run(id, `Name ${id}`, role, tenant, STAFF_HASH);
  }
  sqlite.prepare('INSERT INTO staff_devices (id,staff_id,device_token,pin_hash,role) VALUES (?,?,?,?,?)')
    .run('device-1', 'staff', 'local-device-token', pinHash, 'owner');
  const kv = createMockKV();
  const env = createMockEnv({ AURA_DB: db, AUTH_KV: kv, ENVIRONMENT: 'production', JWT_EXPIRY_SECONDS: '604800' });
  const ctx = { waitUntil(p: Promise<unknown>) { void p.catch(() => {}); }, passThroughOnException() {} };
  const request = (path: string, token?: string, method = 'GET', body?: unknown, extra: Record<string, string> = {}) => app.fetch(
    new Request(`http://local.test${path}`, { method, headers: { 'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}), ...extra }, ...(body ? { body: JSON.stringify(body) } : {}) }),
    env, ctx as never,
  );
  const token = async (id = 'staff', mobile = false, authTime?: number) => (await issueStaffSession(
    { JWT_SECRET: TEST_JWT_SECRET }, await requireStaffAccount(db, id),
    { sessionType: mobile ? 'staff-mobile' : 'staff-web', ...(mobile ? { deviceId: 'device-1' } : {}), ...(authTime ? { authTime } : {}) },
  )).token;
  const credential = async (id = 'staff', role = id === 'owner' ? 'owner' : 'staff') => {
    await kv.put(`user:${id}@local.test`, JSON.stringify({ id, email: `${id}@local.test`, name: 'Stale KV', role, password: STAFF_HASH }));
  };
  return { db, sqlite, kv, env, request, token, credential };
}
