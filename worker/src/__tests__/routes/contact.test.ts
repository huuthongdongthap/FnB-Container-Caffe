// @vitest-environment node
import { afterEach, describe, expect, it } from 'vitest';
import { privacyFixture } from '../helpers/privacy-sqlite-fixture';
const fixtures: ReturnType<typeof privacyFixture>[] = [];
const fixture = () => { const value = privacyFixture(); fixtures.push(value); return value; };
afterEach(() => { for (const f of fixtures.splice(0)) f.sqlite.close(); });
const contact = { name: 'Test User', phone: '0909123456', content: 'Support question' };
describe('Contact privacy persistence', () => {
  it('persists a real ID with server ownership and classification', async () => {
    const f = fixture();
    const response = await f.request('/api/contact', 'other', 'POST',
      { ...contact, tenant_id: 'cafe-b', classification: 'recruitment', category: 'service' }, { 'X-Tenant-Id': 'cafe-b' });
    expect(response.status).toBe(201);
    const { id } = await response.json();
    expect(id).toMatch(/^MSG_/);
    expect(f.sqlite.prepare('SELECT tenant_id,classification,category FROM contact_messages WHERE id=?').get(id))
      .toMatchObject({ tenant_id: 'cafe-a', classification: 'contact', category: 'service' });
  });
  it('body category cannot create a recruitment copy, validation remains visible', async () => {
    const f = fixture();
    expect((await f.request('/api/contact', undefined, 'POST', {})).status).toBe(400);
    expect((await f.request('/api/contact', undefined, 'POST', { ...contact, category: 'recruitment' })).status).toBe(400);
    expect(f.sqlite.prepare('SELECT COUNT(*) count FROM contact_messages').get()?.count).toBe(0);
  });
  it('missing production configuration and unknown topology fail closed', async () => {
    const f = fixture(); delete f.env.PILOT_TENANT_ID;
    expect((await f.request('/api/contact', undefined, 'POST', contact)).status).toBe(503);
    f.env.PILOT_TENANT_ID = 'cafe-a';
    f.sqlite.exec('ALTER TABLE contact_messages RENAME COLUMN classification TO unverified_classification');
    const failed = await f.request('/api/contact', undefined, 'POST', contact);
    expect(failed.status).toBe(503);
    expect(await failed.text()).not.toContain('classification');
  });
});
