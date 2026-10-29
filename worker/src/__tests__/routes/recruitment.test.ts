// @vitest-environment node
import { afterEach, describe, expect, it } from 'vitest';
import { privacyFixture, candidate } from '../helpers/privacy-sqlite-fixture';

const fixtures: ReturnType<typeof privacyFixture>[] = [];
const fixture = () => { const value = privacyFixture(); fixtures.push(value); return value; };
afterEach(() => { for (const f of fixtures.splice(0)) f.sqlite.close(); });

describe('Store owned recruitment on real SQLite', () => {
  it('public aliases ignore tenant spoofing and incidental foreign sessions; no PII mirror', async () => {
    const f = fixture();
    const response = await f.request('/api/recruitment/apply', 'other', 'POST', { ...candidate, tenantId: 'cafe-b' },
      { 'X-Tenant-Id': 'cafe-b', 'Idempotency-Key': 'public-apply-0001' });
    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.id).toMatch(/^APP_/);
    expect(body.data.id).toBe(body.id);
    expect(f.sqlite.prepare('SELECT tenant_id FROM recruitment_applications WHERE id=?').get(body.id)?.tenant_id).toBe('cafe-a');
    expect(f.sqlite.prepare('SELECT COUNT(*) count FROM contact_messages').get()?.count).toBe(0);
    expect((await f.request('/api/recruitment', undefined, 'POST', candidate)).status).toBe(201);
  });
  it('same-store owner/manager can create, list, patch, and delete persisted records', async () => {
    const f = fixture();
    const response = await f.request('/api/recruitment/applications', 'manager', 'POST', candidate, { 'Idempotency-Key': 'admin-create-0001' });
    expect(response.status).toBe(201);
    const { id } = await response.json();
    const list = await (await f.request('/api/recruitment/applications', 'owner')).json();
    expect(list.data.map((row: any) => row.id)).toEqual([id]);
    expect((await f.request(`/api/recruitment/applications/${id}`, 'manager', 'PATCH', { status: 'hired' })).status).toBe(200);
    expect(f.sqlite.prepare('SELECT status FROM recruitment_applications WHERE id=?').get(id)?.status).toBe('hired');
    expect((await f.request(`/api/recruitment/applications/${id}`, 'owner', 'DELETE')).status).toBe(200);
    expect((await f.request(`/api/recruitment/applications/${id}`, 'owner', 'DELETE')).status).toBe(404);
  });
  it.each(['staff', 'admin', 'cashier', 'other', 'wildcard', 'hq'])('denies %s across every management operation', async (actor) => {
    const f = fixture();
    for (const [path, method, body] of [
      ['/api/recruitment/applications', 'GET', undefined], ['/api/recruitment/applications', 'POST', candidate],
      ['/api/recruitment/applications/foreign', 'PATCH', { status: 'hired' }], ['/api/recruitment/applications/foreign', 'DELETE', undefined],
    ] as const) expect((await f.request(path, actor, method, body)).status).toBe(403);
  });
  it('unauthenticated management gets 401; legacy unowned and foreign rows stay inaccessible', async () => {
    const f = fixture();
    for (const [id, tenant] of [['unowned', null], ['foreign', 'cafe-b']])
      f.sqlite.prepare('INSERT INTO recruitment_applications(id,full_name,phone,tenant_id) VALUES (?,?,?,?)').run(id, 'Hidden', '0901234567', tenant);
    expect((await f.request('/api/recruitment/applications')).status).toBe(401);
    expect((await (await f.request('/api/recruitment/applications', 'manager')).json()).data).toEqual([]);
    for (const id of ['unowned', 'foreign']) {
      expect((await f.request(`/api/recruitment/applications/${id}`, 'owner', 'PATCH', { status: 'hired' })).status).toBe(404);
      expect((await f.request(`/api/recruitment/applications/${id}`, 'owner', 'DELETE')).status).toBe(404);
    }
    expect(f.sqlite.prepare('SELECT COUNT(*) count FROM recruitment_applications').get()?.count).toBe(2);
  });
  it('durable retry returns the same ID; payload mismatch conflicts and deleted records do not resurrect', async () => {
    const f = fixture();
    const headers = { 'Idempotency-Key': 'durable-apply-0001' };
    const first = await (await f.request('/api/recruitment/apply', undefined, 'POST', candidate, headers)).json();
    const second = await (await f.request('/api/recruitment/apply', undefined, 'POST', candidate, headers)).json();
    expect(second.id).toBe(first.id);
    expect(f.sqlite.prepare('SELECT COUNT(*) count FROM recruitment_applications').get()?.count).toBe(1);
    expect((await f.request('/api/recruitment/apply', undefined, 'POST', { ...candidate, fullName: 'Changed' }, headers)).status).toBe(409);
    await f.request(`/api/recruitment/applications/${first.id}`, 'owner', 'DELETE');
    expect((await f.request('/api/recruitment/apply', undefined, 'POST', candidate, headers)).status).toBe(409);
  });
  it('missing production pilot config and failed SQL report failure without leaking schema', async () => {
    const f = fixture();
    delete f.env.PILOT_TENANT_ID;
    expect((await f.request('/api/recruitment/apply', undefined, 'POST', candidate)).status).toBe(503);
    f.env.PILOT_TENANT_ID = 'cafe-a';
    f.sqlite.exec('ALTER TABLE recruitment_applications RENAME TO unavailable_recruitment');
    const failed = await f.request('/api/recruitment/apply', undefined, 'POST', candidate);
    expect(failed.status).toBe(503);
    expect(await failed.text()).not.toContain('unavailable_recruitment');
  });
});
