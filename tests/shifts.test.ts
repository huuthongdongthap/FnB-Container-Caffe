// @vitest-environment node
/** Real SQLite, canonical worker schema and signed D1-authoritative Staff sessions. */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { shiftsRouter } from '../packages/domain/shift/commands/shifts';
import { paymentSqliteDB } from '../worker/src/__tests__/helpers/payment-sqlite-db';
import { createMockEnv, TEST_JWT_SECRET } from '../worker/src/__tests__/test-utils';
import { issueStaffSession, requireStaffAccount } from '../worker/src/lib/staff-session';
import { openApiStaffRouter } from '../worker/src/routes/openapi-staff-handlers/routes';
import { businessDate } from '../packages/domain/shift/commands/shift-access';

const databases: ReturnType<typeof paymentSqliteDB>['sqlite'][] = [];
afterEach(() => { vi.useRealTimers(); databases.splice(0).forEach(db => db.close()); });
function fixture(canonical = true) {
  const { db, sqlite } = paymentSqliteDB(); databases.push(sqlite);
  if (canonical) {
    const schema = readFileSync(new URL('../worker/schema.sql', import.meta.url), 'utf8');
    sqlite.exec(schema.match(/CREATE TABLE IF NOT EXISTS staff_shifts \([\s\S]*?\);/)![0]);
    for (const index of schema.matchAll(/CREATE (?:UNIQUE )?INDEX idx_staff_shifts[^;]*;/g)) sqlite.exec(index[0]);
  }
  for (const [id, role, tenant] of [['staff','staff','cafe-a'], ['peer','barista','cafe-a'], ['manager','manager','cafe-a'],
    ['owner','owner','cafe-a'], ['admin','admin','cafe-a'], ['other','staff','cafe-b'], ['foreign-manager','manager','cafe-b']]) {
    sqlite.prepare('INSERT INTO users (id,name,role,tenant_id) VALUES (?,?,?,?)').run(id, `D1 ${id}`, role, tenant);
  }
  const env = createMockEnv({ AURA_DB: db, ENVIRONMENT: 'production', PILOT_TENANT_ID: 'cafe-a' });
  const token = async (id = 'staff') => (await issueStaffSession({ JWT_SECRET: TEST_JWT_SECRET },
    await requireStaffAccount(db, id), { sessionType: 'staff-web' })).token;
  const request = async (path = '/', actor = 'staff', body?: unknown, method = body ? 'POST' : 'GET', openapi = false, suppliedToken?: string) => {
    const authorization = suppliedToken ?? (actor ? await token(actor) : '');
    return (openapi ? openApiStaffRouter : shiftsRouter).request(path, { method, headers: {
      'Content-Type': 'application/json', ...(authorization ? { Authorization: `Bearer ${authorization}` } : {}),
    }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) }, env);
  };
  const seed = (staff: string | null, tenant: string | null, input: Record<string, unknown> = {}) => {
    const row = { staff_id: staff, tenant_id: tenant, staff_name: 'Historical', role: 'staff', date: businessDate(), shift: 'scheduled',
      attendance_state: 'scheduled', ...input };
    const fields = Object.keys(row);
    return String(sqlite.prepare(`INSERT INTO staff_shifts (${fields.join(',')}) VALUES (${fields.map(() => '?').join(',')})`).run(...Object.values(row)).lastInsertRowid);
  };
  return { db, sqlite, env, token, request, seed };
}

describe('canonical attendance access and persistence', () => {
  it('requires login, validates input and persists D1 identity with integer ID', async () => {
    const f = fixture();
    expect((await f.request('/', '')).status).toBe(401);
    expect((await f.request('/clock-in', 'staff', {})).status).toBe(400);
    const response = await f.request('/clock-in', 'staff', { staff_id: 'staff', staff_name: 'Spoofed', tenant_id: 'cafe-b' });
    expect(response.status).toBe(201);
    const row = (await response.json()).data;
    expect(row).toMatchObject({ id: '1', staff_name: 'D1 staff', role: 'staff', tenant_id: 'cafe-a', attendance_state: 'active' });
    expect(f.sqlite.prepare('SELECT typeof(id) AS type FROM staff_shifts').get()?.type).toBe('integer');
    expect((await f.request('/')).status).toBe(200);
    expect((await f.request('/clock-out', 'staff', { staff_id: 'staff' })).status).toBe(200);
    expect((await f.request('/clock-out', 'staff', { staff_id: 'staff' })).status).toBe(404);
  });
  it('allows schedules without counting them active and prevents concurrent duplicate clock-ins', async () => {
    const f = fixture(); f.seed('staff', 'cafe-a');
    const results = await Promise.all([f.request('/clock-in', 'staff', { staff_id: 'staff' }), f.request('/clock-in', 'staff', { staff_id: 'staff' })]);
    expect(results.map(r => r.status).sort()).toEqual([201, 409]);
    expect(f.sqlite.prepare('SELECT COUNT(*) AS n FROM staff_shifts WHERE clock_in IS NOT NULL AND clock_out IS NULL').get()?.n).toBe(1);
  });
  it('computes the business date in Vietnam and closes an active shift across midnight', async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-23T17:30:00Z'));
    const f = fixture();
    expect(businessDate()).toBe('2026-10-24');
    f.seed('staff', 'cafe-a', { clock_in: '2026-10-23T15:30:00Z', date: '2026-10-23', attendance_state: 'active' });
    expect((await (await f.request('/today')).json()).data).toHaveLength(1);
    const closed = await f.request('/clock-out', 'staff', { staff_id: 'staff' });
    expect(closed.status).toBe(200);
    expect((await closed.json()).data).toMatchObject({ hours_worked: 2, date: '2026-10-23', attendance_state: 'completed' });
  });
  it('enforces self reads/writes and owner/manager same-store delegation', async () => {
    const f = fixture(); f.seed('staff','cafe-a'); f.seed('peer','cafe-a'); f.seed('other','cafe-b'); f.seed(null,null);
    expect((await (await f.request('/')).json()).data).toHaveLength(1);
    expect((await f.request('/?staff_id=peer')).status).toBe(403);
    expect((await f.request('/?staff_id=*', 'owner')).status).toBe(403);
    expect((await (await f.request('/', 'manager')).json()).data).toHaveLength(2);
    expect((await f.request('/clock-in','staff',{ staff_id:'peer' })).status).toBe(403);
    expect((await f.request('/clock-in','admin',{ staff_id:'peer' })).status).toBe(403);
    expect((await f.request('/clock-in','owner',{ staff_id:'peer' })).status).toBe(201);
    expect((await f.request('/clock-out','manager',{ staff_id:'peer' })).status).toBe(200);
    expect((await f.request('/clock-in','manager',{ staff_id:'other' })).status).toBe(404);
    expect((await f.request('/','foreign-manager')).status).toBe(403);
  });
  it('blocks inactive/revoked sessions, inactive targets and missing pilot configuration', async () => {
    const f = fixture(), token = await f.token();
    f.sqlite.exec("UPDATE users SET is_active = 0 WHERE id = 'staff'");
    expect((await f.request('/', 'staff', undefined, 'GET', false, token)).status).toBe(403);
    expect((await f.request('/clock-in','manager',{ staff_id:'staff' })).status).toBe(403);
    f.sqlite.exec("UPDATE users SET is_active = 1, auth_version = 2 WHERE id = 'staff'");
    expect((await f.request('/', 'staff', undefined, 'GET', false, token)).status).toBe(401);
    f.env.PILOT_TENANT_ID = undefined;
    expect((await f.request('/', 'manager')).status).toBe(503);
  });
  it('fails closed when the canonical table is unavailable without querying legacy shifts', async () => {
    const f = fixture(false); f.sqlite.exec('CREATE TABLE shifts (id TEXT)');
    expect((await f.request('/')).status).toBe(500);
  });
});

describe('OpenAPI schedule and attendance contract', () => {
  it('shares scoped schedule/detail/attendance rows and cancels without deleting', async () => {
    const f = fixture();
    const created = await f.request('/api/staff/shifts','manager',{ staffId:'peer', date:businessDate(), startTime:'08:00', endTime:'17:00' },'POST',true);
    expect(created.status).toBe(201); const id = (await created.json()).data.id;
    expect((await f.request(`/api/staff/shifts/${id}`,'staff',undefined,'GET',true)).status).toBe(404);
    expect((await f.request(`/api/staff/shifts/${id}`,'peer',undefined,'GET',true)).status).toBe(200);
    expect((await f.request('/api/staff/shifts','staff',{staffId:'staff',date:businessDate(),startTime:'08:00',endTime:'17:00'},'POST',true)).status).toBe(403);
    const checked = await f.request('/api/staff/attendance/check-in','peer',{ shiftId:id },'POST',true);
    expect(checked.status).toBe(201); expect((await checked.json()).data.id).toBe(id);
    expect((await f.request(`/api/staff/shifts/${id}`,'manager',{},'PATCH',true)).status).toBe(409);
    const checkedOut = await f.request('/api/staff/attendance/check-out','manager',{ attendanceId:id },'POST',true);
    expect(checkedOut.status).toBe(200);
    const listed = await f.request('/api/staff/attendance','peer',undefined,'GET',true);
    expect(listed.status).toBe(200);
    expect((await listed.json()).data.attendance).toHaveLength(1);
    const cancelledId = f.seed('staff','cafe-a');
    expect((await f.request(`/api/staff/shifts/${cancelledId}`,'owner',undefined,'DELETE',true)).status).toBe(200);
    expect(f.sqlite.prepare('SELECT attendance_state FROM staff_shifts WHERE id = ?').get(cancelledId)?.attendance_state).toBe('cancelled');
  });
  it('resolves static collection routes before staff detail and keeps tenant scope', async () => {
    const f = fixture();
    f.seed('peer', 'cafe-a', { clock_in: '2026-10-23T01:00:00Z', attendance_state: 'active' });
    f.seed('other', 'cafe-b', { clock_in: '2026-10-23T01:00:00Z', attendance_state: 'active' });
    for (const [path, field] of [['shifts', 'shifts'], ['attendance', 'attendance']]) {
      const response = await f.request(`/api/staff/${path}`, 'peer', undefined, 'GET', true);
      expect(response.status).toBe(200);
      const payload = await response.json();
      expect(payload.data[field]).toHaveLength(1);
      expect(payload.data[field][0].staffId).toBe('peer');
      expect((await f.request(`/api/staff/${path}`, '', undefined, 'GET', true)).status).toBe(401);
    }
    expect((await f.request('/api/staff/peer', 'manager', undefined, 'GET', true)).status).toBe(200);
    expect((await f.request('/api/staff/other', 'manager', undefined, 'GET', true)).status).toBe(404);
  });
  it('rejects foreign/unowned IDs and location spoofing across OpenAPI routes', async () => {
    const f = fixture(), foreign = f.seed('other','cafe-b'), unowned = f.seed(null,null);
    for (const id of [foreign, unowned]) {
      expect((await f.request(`/api/staff/shifts/${id}`,'manager',undefined,'GET',true)).status).toBe(404);
      expect((await f.request(`/api/staff/shifts/${id}`,'manager',{notes:'x'},'PATCH',true)).status).toBe(404);
      expect((await f.request(`/api/staff/shifts/${id}`,'manager',undefined,'DELETE',true)).status).toBe(404);
    }
    expect((await f.request('/api/staff/attendance/check-in','staff',{ locationId:'cafe-b' },'POST',true)).status).toBe(403);
  });
});
