// @vitest-environment node
import { afterEach, describe, expect, it } from 'vitest';
import { privacyFixture } from '../helpers/privacy-sqlite-fixture';
const fixtures: ReturnType<typeof privacyFixture>[] = [];
const fixture = () => { const value = privacyFixture(); fixtures.push(value); return value; };
afterEach(() => { for (const f of fixtures.splice(0)) f.sqlite.close(); });
const phone = '0901234567';
const message = { name: 'Customer', phone, message: 'Support request' };
function seedPrivacyRows(f: ReturnType<typeof privacyFixture>) {
  const insert = f.sqlite.prepare(`INSERT INTO contact_messages
    (id,name,phone,content,category,status,tenant_id,classification,created_at) VALUES (?,?,?,?,?,'unread',?,?,?)`);
  for (const [id, tenant, classification, category] of [
    ['visible', 'cafe-a', 'chat', 'chat'], ['candidate', 'cafe-a', null, 'recruitment'],
    ['wrong-classification', 'cafe-a', 'contact', 'recruitment'], ['foreign', 'cafe-b', 'chat', 'chat'],
    ['unknown-owner', null, 'chat', 'chat'], ['unknown-classification', 'cafe-a', null, 'chat'],
    ['legacy', null, null, null],
  ]) insert.run(id, id, phone, id, category, tenant, classification, id === 'visible' ? '2026-10-22' : '2026-10-23');
}
describe('Chat privacy with actual SQLite queries', () => {
  it('scopes latest/list/count/history/read-mark and both history aliases', async () => {
    const f = fixture(); seedPrivacyRows(f);
    const list = await (await f.request('/api/chat/conversations', 'staff')).json();
    expect(list.data).toHaveLength(1);
    expect(list.data[0]).toMatchObject({ last_message: 'visible', message_count: 1, unread_count: 1 });
    for (const path of [`/api/chat/messages/${phone}`, `/api/chat/conversations/${phone}/messages`]) {
      const history = await (await f.request(path, 'owner')).json();
      expect(history.data.map((row: any) => row.id)).toEqual(['visible']);
    }
    const hidden = f.sqlite.prepare("SELECT id,status FROM contact_messages WHERE id <> 'visible'").all();
    expect(hidden.every((row) => row.status === 'unread')).toBe(true);
    expect(f.sqlite.prepare("SELECT status FROM contact_messages WHERE id='visible'").get()?.status).toBe('read');
    expect((await (await f.request('/api/chat/conversations', 'owner')).json()).data[0].unread_count).toBe(0);
  });
  it('public writes set ownership/classification server side even with a foreign JWT and spoofed body', async () => {
    const f = fixture();
    const response = await f.request('/api/chat/messages', 'other', 'POST',
      { ...message, tenant_id: 'cafe-b', category: 'recruitment', classification: 'recruitment' }, { 'X-Tenant-Id': 'cafe-b' });
    expect(response.status).toBe(201);
    const { id } = await response.json();
    expect(f.sqlite.prepare('SELECT tenant_id,classification,category FROM contact_messages WHERE id=?').get(id))
      .toMatchObject({ tenant_id: 'cafe-a', classification: 'chat', category: 'chat' });
  });
  it('admin writes require a verified D1 staff account in the pilot; never downgrade rejection to customer', async () => {
    const f = fixture();
    expect((await f.request('/api/chat/messages', undefined, 'POST', { ...message, direction: 'admin' })).status).toBe(401);
    expect((await f.request('/api/chat/messages', 'other', 'POST', { ...message, direction: 'admin' })).status).toBe(403);
    expect((await f.request('/api/chat/messages', 'owner', 'POST', { ...message, direction: 'admin' })).status).toBe(201);
    expect(f.sqlite.prepare('SELECT COUNT(*) count FROM contact_messages').get()?.count).toBe(1);
    expect((await f.request('/api/chat/conversations', 'other')).status).toBe(403);
    expect((await f.request('/api/chat/conversations')).status).toBe(401);
  });
  it.each(['legacy', 'mixed'])('supports explicit %s topology while quarantining every unclassified row', async (shape) => {
    const f = fixture();
    f.sqlite.exec(`ALTER TABLE contact_messages RENAME TO canonical_contact_fixture;
      CREATE TABLE contact_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, phone TEXT, message TEXT NOT NULL,
      direction TEXT NOT NULL, read_at TEXT, created_at TEXT,
      tenant_id TEXT, classification TEXT ${shape === 'mixed' ? ', content TEXT, category TEXT, status TEXT' : ''});
      INSERT INTO contact_messages(name,phone,message,direction,created_at,tenant_id,classification)
      VALUES ('Legacy','${phone}','Private legacy','customer','2026-10-23','cafe-a',NULL);`);
    const sent = await f.request('/api/chat/messages', undefined, 'POST', message);
    expect(sent.status).toBe(201);
    expect((await sent.json()).id).toBe(2);
    const list = await (await f.request('/api/chat/conversations', 'owner')).json();
    expect(list.data).toHaveLength(1);
    expect(list.data[0]).toMatchObject({ message_count: 1, unread_count: 1, last_message: 'Support request' });
    const history = await (await f.request(`/api/chat/messages/${phone}`, 'owner')).json();
    expect(history.data.map((row: any) => row.id)).toEqual([2]);
    expect(f.sqlite.prepare('SELECT read_at FROM contact_messages WHERE id=1').get()?.read_at).toBeNull();
    expect(f.sqlite.prepare('SELECT read_at FROM contact_messages WHERE id=2').get()?.read_at).toBeTruthy();
  });
  it('a missing privacy column fails closed without fallback reads or writes', async () => {
    const f = fixture(); seedPrivacyRows(f);
    f.sqlite.exec('ALTER TABLE contact_messages RENAME COLUMN classification TO unverified_classification');
    expect((await f.request('/api/chat/conversations', 'owner')).status).toBe(503);
    expect((await f.request(`/api/chat/messages/${phone}`, 'owner')).status).toBe(503);
    expect((await f.request('/api/chat/messages', undefined, 'POST', message)).status).toBe(503);
    expect(f.sqlite.prepare("SELECT COUNT(*) count FROM contact_messages WHERE status='read'").get()?.count).toBe(0);
  });
  it('rate limits before persistence and missing pilot config is 503', async () => {
    const f = fixture();
    await f.env.AUTH_KV.put('rl:chat:ip:203.0.113.77', '20');
    expect((await f.request('/api/chat/messages', undefined, 'POST', message, { 'CF-Connecting-IP': '203.0.113.77' })).status).toBe(429);
    delete f.env.PILOT_TENANT_ID;
    expect((await f.request('/api/chat/messages', undefined, 'POST', message)).status).toBe(503);
  });
});
