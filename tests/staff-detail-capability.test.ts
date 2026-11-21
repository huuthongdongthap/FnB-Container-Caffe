// @vitest-environment node
import { afterEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { paymentSqliteDB } from '../worker/src/__tests__/helpers/payment-sqlite-db';
import { createMockEnv, TEST_JWT_SECRET } from '../worker/src/__tests__/test-utils';
import { issueStaffSession, requireStaffAccount } from '../worker/src/lib/staff-session';
import { openApiStaffRouter } from '../worker/src/routes/openapi-staff-handlers/routes';

const databases: ReturnType<typeof paymentSqliteDB>['sqlite'][] = [];
afterEach(() => databases.splice(0).forEach(db => db.close()));
function fixture(pilot: string | undefined = 'cafe-a', tenant = 'cafe-a') {
  const { db, sqlite, executedStatements } = paymentSqliteDB();
  databases.push(sqlite);
  const schema = readFileSync(new URL('../worker/schema.sql', import.meta.url), 'utf8');
  sqlite.exec(schema.match(/CREATE TABLE IF NOT EXISTS staff_shifts \([\s\S]*?\);/)![0]);
  for (const [id, role, store] of [['manager', 'manager', tenant], ['peer', 'staff', tenant], ['foreign', 'staff', 'foreign-store']]) {
    sqlite.prepare('INSERT INTO users (id,name,role,tenant_id) VALUES (?,?,?,?)').run(id, id, role, store);
  }
  sqlite.prepare("INSERT INTO staff_shifts (staff_id, tenant_id, staff_name, role, date, shift, attendance_state, clock_in) VALUES (?, ?, 'peer', 'staff', '2026-11-21', 'scheduled', 'active', '2026-11-21T01:00:00Z')").run('peer', tenant);
  const env = createMockEnv({ AURA_DB: db, ENVIRONMENT: 'production', PILOT_TENANT_ID: pilot });
  const request = async (id = 'peer', query = '') => {
    const { token } = await issueStaffSession({ JWT_SECRET: TEST_JWT_SECRET }, await requireStaffAccount(db, 'manager'), { sessionType: 'staff-web' });
    return openApiStaffRouter.request(`/api/staff/${id}${query}`, { headers: { Authorization: `Bearer ${token}` } }, env);
  };
  return { request, sqlite, executedStatements, env };
}

describe('production staff detail attendance capability', () => {
  it('preserves pilot shift and attendance data', async () => {
    const f = fixture();
    const response = await f.request();
    expect(response.status).toBe(200);
    const { data } = await response.json();
    expect(data).toMatchObject({ id: 'peer', shifts_availability: { available: true } });
    expect(data.recentShifts).toHaveLength(1);
    expect(data.recentAttendance).toHaveLength(1);
  });
  it.each(['manager', 'owner'])('returns non-pilot profiles for a same-store %s', async role => {
    const f = fixture('default', 'saas-store');
    f.sqlite.prepare("UPDATE users SET role = ? WHERE id = 'manager'").run(role);
    const response = await f.request();
    expect(response.status).toBe(200);
    expect((await response.json()).data).toMatchObject({ id: 'peer', shifts_availability: { available: false, reason: 'pilot_restricted' }, recentShifts: [], recentAttendance: [] });
    expect(f.executedStatements.some(row => /FROM staff_shifts/i.test(row.sql))).toBe(false);
  });
  it('returns profiles when the production pilot is unconfigured', async () => {
    const f = fixture(); f.env.PILOT_TENANT_ID = undefined;
    const response = await f.request();
    expect(response.status).toBe(200);
    expect((await response.json()).data).toMatchObject({ shifts_availability: { available: false, reason: 'pilot_unconfigured' }, recentShifts: [], recentAttendance: [] });
  });
  it.each(['default', undefined])('rejects foreign profiles and tenant spoofing with pilot %s', async pilot => {
    const f = fixture(); f.env.PILOT_TENANT_ID = pilot;
    expect((await f.request('foreign')).status).toBe(404);
    expect((await f.request('peer', '?tenant_id=foreign-store')).status).toBe(403);
  });
  it('does not conceal database failures for an available pilot', async () => {
    const f = fixture(); f.sqlite.exec('DROP TABLE staff_shifts');
    expect((await f.request()).status).toBe(500);
  });
});
