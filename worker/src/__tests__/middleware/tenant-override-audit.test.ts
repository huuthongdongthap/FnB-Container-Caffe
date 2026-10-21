// @vitest-environment node
/**
 * Tenant override audit trail.
 *
 * An HQ super-admin reading another franchise's rows is a privileged
 * cross-tenant access, so it must be durably recorded with who switched, from
 * which tenant, and to which — otherwise a data leak leaves no trace.
 */
import { describe, expect, it } from 'vitest';
import { Hono } from 'hono';
import { tenantMiddleware, getTenantId } from '../../middleware/tenant';
import type { Env } from '../../types/env';

function collectWrites() {
  const writes: Array<{ sql: string; binds: unknown[] }> = [];
  const db = {
    prepare: (sql: string) => ({
      bind: (...binds: unknown[]) => {
        if (/INSERT INTO audit_logs/i.test(sql)) writes.push({ sql, binds });
        return { run: async () => ({ success: true }), first: async () => null, all: async () => ({ results: [] }) };
      },
    }),
  };
  return { db: db as any, writes };
}

/** HQ owner: tenantId 'default' is what isHQSuperAdmin treats as unbound-HQ. */
const hqOwner = { id: 'owner-1', role: 'owner', tenantId: 'default' };

function appFor(db: any) {
  const app = new Hono<{ Bindings: Env }>();
  app.use('*', async (c, next) => { c.set('user', hqOwner as any); await next(); });
  app.use('/admin/*', tenantMiddleware);
  app.get('/admin/orders', (c) => c.json({ tenantId: getTenantId(c) }));
  return app;
}

describe('tenant override audit', () => {
  it('records from/to/actor when an HQ admin overrides tenancy', async () => {
    const { db, writes } = collectWrites();
    const app = appFor(db);
    const res = await app.fetch(
      new Request('https://test.aura/admin/orders?tenant_id=tenant_sadec_02', {
        headers: { 'cf-connecting-ip': '203.0.113.5' },
      }),
      { AURA_DB: db } as any,
    );

    expect(res.status).toBe(200);
    expect((await res.json() as any).tenantId).toBe('tenant_sadec_02');

    // Best-effort write resolves on the next tick — let it land before asserting.
    await new Promise((r) => setTimeout(r, 0));

    expect(writes).toHaveLength(1);
    const joined = JSON.stringify(writes[0].binds);
    expect(joined).toContain('tenant_override');
    expect(joined).toContain('tenant_sadec_02');
    expect(joined).toContain('owner-1');
  });

  it('stays confined and writes nothing when the tenant is unchanged', async () => {
    const { db, writes } = collectWrites();
    const app = appFor(db);
    await app.fetch(
      new Request('https://test.aura/admin/orders?tenant_id=default'),
      { AURA_DB: db } as any,
    );
    await new Promise((r) => setTimeout(r, 0));
    expect(writes).toHaveLength(0);
  });

  it('audits the wildcard aggregate read as leaving the admin tenant', async () => {
    const { db, writes } = collectWrites();
    const app = appFor(db);
    await app.fetch(
      new Request('https://test.aura/admin/orders?tenant_id=*'),
      { AURA_DB: db } as any,
    );
    await new Promise((r) => setTimeout(r, 0));

    // '*' is still an escape from the admin's own tenant, so it is recorded —
    // with tenant_to distinguishable from a real cross-tenant switch.
    expect(writes).toHaveLength(1);
    expect(JSON.stringify(writes[0].binds)).toContain('"*"');
  });
});
