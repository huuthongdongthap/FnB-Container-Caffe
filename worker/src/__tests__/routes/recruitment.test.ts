import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { createMockDB, createMockEnv } from '../test-utils';
import { recruitmentRouter } from '../../routes/recruitment';
import { generateJWT } from '../../lib/jwt';

describe('Recruitment Worker Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function makeApp() {
    const app = new Hono();
    app.route('/api/recruitment', recruitmentRouter);
    return app;
  }

  function makeEnv() {
    return {
      ...createMockEnv(),
      AURA_DB: createMockDB(),
    };
  }

  it('POST /apply — rejects invalid phone or empty fullName with 400', async () => {
    const app = makeApp();
    const req = new Request('https://test.aura/api/recruitment/apply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fullName: '', phone: '123' }),
    });

    const res = await app.fetch(req, makeEnv() as any);
    expect(res.status).toBe(400);
  });

  it('POST /apply — accepts valid candidate payload with 201', async () => {
    const app = makeApp();
    const req = new Request('https://test.aura/api/recruitment/apply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: 'Nguyễn Văn A',
        phone: '0986470981',
        birthYear: '2002',
        position: 'barista',
        shifts: ['morning', 'afternoon'],
        experience: 'under_1yr',
        note: 'Có kinh nghiệm pha chế cơ bản',
      }),
    });

    const res = await app.fetch(req, makeEnv() as any);
    expect(res.status).toBe(201);
    const body = (await res.json()) as { success: boolean; id: string };
    expect(body.success).toBe(true);
    expect(body.id).toMatch(/^APP_/);
  });

  it('POST /apply — sanitizes internal database errors on HTTP 500 without leaking SQL details', async () => {
    const app = makeApp();
    const env = makeEnv();
    env.AURA_DB.prepare = vi.fn().mockImplementation(() => ({
      bind: () => ({
        run: () => Promise.reject(new Error('SQLITE_ERROR: table recruitment_applications has no column named secret_col')),
      }),
    }));

    const req = new Request('https://test.aura/api/recruitment/apply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: 'Trần Thị B',
        phone: '0912345678',
        position: 'service',
      }),
    });

    const res = await app.fetch(req, env as any);
    expect(res.status).toBe(500);
    const bodyText = await res.text();
    expect(bodyText).not.toContain('SQLITE_ERROR');
    expect(bodyText).not.toContain('secret_col');
  });

  it('DELETE /applications/:id — enforces owner/manager RBAC and rejects staff role with 403', async () => {
    const app = makeApp();
    const env = makeEnv();
    const secret = env.JWT_SECRET;

    const staffToken = await generateJWT(
      { id: 'staff-1', email: 'staff@auraspace.cafe', name: 'Staff', role: 'staff' },
      secret
    );
    const managerToken = await generateJWT(
      { id: 'mgr-1', email: 'mgr@auraspace.cafe', name: 'Manager', role: 'manager' },
      secret
    );

    const staffReq = new Request('https://test.aura/api/recruitment/applications/APP_123', {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${staffToken}` },
    });
    const staffRes = await app.fetch(staffReq, env as any);
    expect(staffRes.status).toBe(403);

    const mgrReq = new Request('https://test.aura/api/recruitment/applications/APP_123', {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${managerToken}` },
    });
    const mgrRes = await app.fetch(mgrReq, env as any);
    expect(mgrRes.status).toBe(200);
  });
});

