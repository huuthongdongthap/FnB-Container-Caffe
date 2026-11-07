// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { OpenAPIHono } from '@hono/zod-openapi';
import type { Context } from 'hono';
import type { Env } from '../../types/env';
import {
  getNotifications,
  markNotificationRead,
  subscribePush,
} from '../../routes/notifications-mobile';
import { runSopReminders } from '../../routes/cron-handlers/sop-reminders';
import { registerSopAdminWriteHandlers } from '../../routes/openapi-sop-handlers/sop-admin-write-handlers';
import { registerSopReminderHandlers } from '../../routes/openapi-sop-handlers/sop-reminder-handlers';
import { SopAdminRoutes } from '../../schemas/sop-routes';
import {
  acknowledgeReminder,
  countOpenReminders,
  findOpenShift,
  listReminders,
  sopScope,
  startRunForStaff,
  SopAccessError,
} from '@aura/domain-sop';
import { staffSessionFixture } from '../helpers/staff-session-fixture';
import { applySopMigrations } from '../helpers/sop-test-db';

function createSopFixture() {
  const fx = staffSessionFixture();
  applySopMigrations(fx.sqlite);
  fx.sqlite
    .prepare('UPDATE users SET tenant_id = ? WHERE id IN (?, ?, ?, ?)')
    .run('default', 'owner', 'staff', 'manager', 'other');
  return {
    ...fx,
    users: {
      owner: { id: 'owner', role: 'owner', tenantId: 'default' },
      manager: { id: 'manager', role: 'manager', tenantId: 'default' },
      staff: { id: 'staff', role: 'staff', tenantId: 'default' },
    },
    close: () => {
      try {
        fx.sqlite.close();
      } catch {
        // ignore
      }
    },
  };
}

function makeMobileContext(opts: {
  user?: { id?: string; role?: string; tenantId?: string };
  contextTenantId?: string;
  headerTenantId?: string;
  params?: Record<string, string>;
  body?: unknown;
  db: unknown;
}): Context<{ Bindings: Env }> {
  const store: Record<string, unknown> = {};
  if (opts.user !== undefined) store.user = opts.user;
  if (opts.contextTenantId !== undefined) store.tenantId = opts.contextTenantId;

  return {
    env: { AURA_DB: opts.db } as unknown as Env,
    get: (k: string) => store[k],
    set: (k: string, v: unknown) => {
      store[k] = v;
    },
    req: {
      param: (k: string) => opts.params?.[k],
      header: (name: string) => {
        if (name.toLowerCase() === 'x-tenant-id') return opts.headerTenantId;
        if (name.toLowerCase() === 'user-agent') return 'Vitest-UA/1.0';
        return undefined;
      },
      raw: {
        headers: new Headers(
          opts.headerTenantId ? { 'X-Tenant-ID': opts.headerTenantId } : {}
        ),
      },
      json: async () => opts.body,
    },
  } as unknown as Context<{ Bindings: Env }>;
}

describe('Phase 48 AU2 — Mobile Notifications & Push Subscription Isolation (AU2-1)', () => {
  it('prevents staff bound to cafe-a from spoofing context tenantId=cafe-b or wildcard * on getNotifications', async () => {
    const boundArgs: unknown[][] = [];
    const db = {
      prepare: (_sql: string) => ({
        bind: (...args: unknown[]) => {
          boundArgs.push(args);
          return {
            all: async () => ({
              results: [
                {
                  id: 'n-cafe-a',
                  type: 'order_ready',
                  title_vi: 'Đơn A',
                  title_en: 'Order A',
                  body_vi: null,
                  body_en: null,
                  data: '{}',
                  read_at: null,
                  created_at: '2026-11-03T08:00:00Z',
                  tenant_id: 'cafe-a',
                },
                {
                  id: 'n-cafe-b',
                  type: 'order_ready',
                  title_vi: 'Đơn B',
                  title_en: 'Order B',
                  body_vi: null,
                  body_en: null,
                  data: '{}',
                  read_at: null,
                  created_at: '2026-11-03T08:01:00Z',
                  tenant_id: 'cafe-b',
                },
              ],
            }),
          };
        },
      }),
    };

    const spoofOtherStore = makeMobileContext({
      user: { id: 'staff-1', role: 'staff', tenantId: 'cafe-a' },
      contextTenantId: 'cafe-b',
      headerTenantId: 'cafe-b',
      db,
    });
    const res1 = await getNotifications(spoofOtherStore);
    const body1 = (await res1.json()) as { notifications: Array<{ id: string }> };
    expect(res1.status).toBe(200);
    expect(boundArgs[0]).toEqual(['staff-1', 'cafe-a', 'cafe-a']);
    expect(body1.notifications.map((n) => n.id)).toEqual(['n-cafe-a']);

    const spoofWildcard = makeMobileContext({
      user: { id: 'staff-1', role: 'staff', tenantId: 'cafe-a' },
      contextTenantId: '*',
      headerTenantId: '*',
      db,
    });
    const res2 = await getNotifications(spoofWildcard);
    const body2 = (await res2.json()) as { notifications: Array<{ id: string }> };
    expect(res2.status).toBe(200);
    expect(boundArgs[1]).toEqual(['staff-1', 'cafe-a', 'cafe-a']);
    expect(body2.notifications.map((n) => n.id)).toEqual(['n-cafe-a']);
  });

  it('allows HQ owner with wildcard tenant to list across stores, while normalizing wildcard for non-HQ staff to default', async () => {
    const boundArgs: unknown[][] = [];
    const db = {
      prepare: (_sql: string) => ({
        bind: (...args: unknown[]) => {
          boundArgs.push(args);
          return {
            all: async () => ({
              results: [
                {
                  id: 'n-a',
                  type: 'system',
                  title_vi: 'A',
                  title_en: 'A',
                  body_vi: null,
                  body_en: null,
                  data: '{}',
                  read_at: null,
                  created_at: '2026-11-03T08:00:00Z',
                  tenant_id: 'cafe-a',
                },
                {
                  id: 'n-b',
                  type: 'system',
                  title_vi: 'B',
                  title_en: 'B',
                  body_vi: null,
                  body_en: null,
                  data: '{}',
                  read_at: null,
                  created_at: '2026-11-03T08:01:00Z',
                  tenant_id: 'cafe-b',
                },
              ],
            }),
          };
        },
      }),
    };

    const hqCtx = makeMobileContext({
      user: { id: 'hq-owner', role: 'owner', tenantId: '*' },
      contextTenantId: '*',
      db,
    });
    const hqRes = await getNotifications(hqCtx);
    const hqBody = (await hqRes.json()) as { notifications: Array<{ id: string }> };
    expect(hqRes.status).toBe(200);
    expect(boundArgs[0]).toEqual(['hq-owner', '*', '*']);
    expect(hqBody.notifications.map((n) => n.id)).toEqual(['n-a', 'n-b']);

    const nonHqWildcardCtx = makeMobileContext({
      user: { id: 'staff-unbound', role: 'staff' },
      contextTenantId: '*',
      db,
    });
    await getNotifications(nonHqWildcardCtx);
    expect(boundArgs[1]).toEqual(['staff-unbound', 'default', 'default']);
  });

  it('fails closed on markNotificationRead for non-default tenants instead of running un-tenanted fallback UPDATE', async () => {
    const queries: string[] = [];
    const db = {
      prepare: (sql: string) => {
        queries.push(sql);
        return {
          bind: () => ({
            run: async () => {
              throw new Error('SQLITE_ERROR: database error');
            },
          }),
        };
      },
    };

    const ctx = makeMobileContext({
      user: { id: 'staff-1', role: 'staff', tenantId: 'cafe-a' },
      contextTenantId: 'cafe-b',
      params: { id: 'notif-1' },
      db,
    });

    const res = await markNotificationRead(ctx);
    expect(res.status).toBe(500);
    // Only the tenant-scoped UPDATE should have been prepared; no un-tenanted fallback query.
    expect(queries).toHaveLength(1);
    expect(queries[0]).toContain('COALESCE(NULLIF(TRIM(tenant_id)');
  });

  it('rejects subscribePush with missing keys or SSRF IPv6/trailing-dot localhost endpoints', async () => {
    const noopDb = { prepare: () => ({ bind: () => ({ run: async () => ({ meta: { changes: 1 } }) }) }) };

    const missingKeysCtx = makeMobileContext({
      user: { id: 'staff-1', role: 'staff', tenantId: 'cafe-a' },
      body: {
        endpoint: 'https://fcm.googleapis.com/fcm/send/valid',
        keys: { p256dh: '   ', auth: 'valid-auth' },
      },
      db: noopDb,
    });
    const missingKeysRes = await subscribePush(missingKeysCtx);
    expect(missingKeysRes.status).toBe(400);

    const ssrfEndpoints = [
      'https://localhost./fcm/send/1',
      'https://[::]/fcm/send/1',
      'https://[fc00::1]/fcm/send/1',
      'https://[fd12:3456:789a::1]/fcm/send/1',
      'https://[fe80::1]/fcm/send/1',
      'https://[::ffff:127.0.0.1]/fcm/send/1',
    ];

    for (const badEndpoint of ssrfEndpoints) {
      const ctx = makeMobileContext({
        user: { id: 'staff-1', role: 'staff', tenantId: 'cafe-a' },
        body: {
          endpoint: badEndpoint,
          keys: { p256dh: 'p256dh-key', auth: 'auth-key' },
        },
        db: noopDb,
      });
      const res = await subscribePush(ctx);
      expect(res.status, `Expected 400 for ${badEndpoint}`).toBe(400);
    }
  });

  it('returns 409 when subscribing an endpoint already bound to another tenant or user', async () => {
    const dbConflict = {
      prepare: (sql: string) => ({
        bind: (..._args: unknown[]) => ({
          first: async () => {
            if (sql.includes('SELECT user_id, tenant_id')) {
              return { user_id: 'staff-a', tenant_id: 'cafe-a' };
            }
            return null;
          },
          run: async () => ({ meta: { changes: 0 } }),
        }),
      }),
    };

    const crossTenantCtx = makeMobileContext({
      user: { id: 'staff-a', role: 'staff', tenantId: 'cafe-b' },
      body: {
        endpoint: 'https://fcm.googleapis.com/fcm/send/shared-endpoint',
        keys: { p256dh: 'key-p256dh', auth: 'key-auth' },
      },
      db: dbConflict,
    });
    const crossTenantRes = await subscribePush(crossTenantCtx);
    expect(crossTenantRes.status).toBe(409);

    const crossUserCtx = makeMobileContext({
      user: { id: 'staff-b', role: 'staff', tenantId: 'cafe-a' },
      body: {
        endpoint: 'https://fcm.googleapis.com/fcm/send/shared-endpoint',
        keys: { p256dh: 'key-p256dh', auth: 'key-auth' },
      },
      db: dbConflict,
    });
    const crossUserRes = await subscribePush(crossUserCtx);
    expect(crossUserRes.status).toBe(409);
  });
});

describe('Phase 48 AU2 — SOP Cron Reminders Timezone & NULL run_id Deduplication (AU2-2)', () => {
  it('evaluates 08:00 gate in Asia/Ho_Chi_Minh timezone and deduplicates NULL run_id reminders across repeated cron passes', async () => {
    const fx = createSopFixture();
    try {
      const scope = sopScope(fx.env, fx.users.owner);

      // 3 days before the 15th: upcoming reminder for 2026-11-15 is created once even across repeated cron passes.
      const threeDaysAhead = new Date('2026-11-12T02:00:00.000Z');
      const upPass1 = await runSopReminders(fx.env as unknown as Record<string, unknown>, threeDaysAhead);
      const upPass2 = await runSopReminders(fx.env as unknown as Record<string, unknown>, threeDaysAhead);
      expect(upPass1.find((r) => r.tenantId === 'default')?.remindersCreated).toBe(1);
      expect(upPass2.find((r) => r.tenantId === 'default')?.remindersCreated).toBe(0);

      // 2026-11-15T00:30:00.000Z is 07:30 in Asia/Ho_Chi_Minh (< 08:00 local).
      // due_no_run must NOT fire before 08:00 local.
      const beforeEightLocal = new Date('2026-11-15T00:30:00.000Z');
      await runSopReminders(fx.env as unknown as Record<string, unknown>, beforeEightLocal);

      const earlyList = await listReminders(scope, { dayKey: '2026-11-15' });
      expect(earlyList.filter((r) => r.kind === 'upcoming')).toHaveLength(1);
      expect(earlyList.filter((r) => r.kind === 'due_no_run')).toHaveLength(0);

      // 2026-11-15T01:30:00.000Z is 08:30 in Asia/Ho_Chi_Minh (>= 08:00 local, even though UTC hour is 1).
      const afterEightLocal = new Date('2026-11-15T01:30:00.000Z');
      const pass1 = await runSopReminders(fx.env as unknown as Record<string, unknown>, afterEightLocal);
      const pass2 = await runSopReminders(fx.env as unknown as Record<string, unknown>, afterEightLocal);
      const pass3 = await runSopReminders(fx.env as unknown as Record<string, unknown>, afterEightLocal);

      const defaultPass1 = pass1.find((r) => r.tenantId === 'default');
      const defaultPass2 = pass2.find((r) => r.tenantId === 'default');
      const defaultPass3 = pass3.find((r) => r.tenantId === 'default');
      expect(defaultPass1?.remindersCreated).toBe(1); // due_no_run created once
      expect(defaultPass2?.remindersCreated).toBe(0); // deduplicated when run_id IS NULL
      expect(defaultPass3?.remindersCreated).toBe(0);

      const reminders = await listReminders(scope, { dayKey: '2026-11-15' });
      expect(reminders.filter((r) => r.kind === 'upcoming')).toHaveLength(1);
      expect(reminders.filter((r) => r.kind === 'due_no_run')).toHaveLength(1);

      const counts = await countOpenReminders(scope);
      expect(counts.byKind.upcoming).toBe(1);
      expect(counts.byKind.due_no_run).toBe(1);
      expect(counts.total).toBe(2);

      const acked = await acknowledgeReminder(scope, reminders[0].id);
      expect(acked).toBe(true);
    } finally {
      fx.close();
    }
  });
});

describe('Phase 48 AU2 — SOP Write Repository, Open Shift & Handler Error Boundaries (AU2-3)', () => {
  it('idempotently returns existing in_progress run instead of creating duplicate runs and enforces role restrictions', async () => {
    const fx = createSopFixture();
    try {
      const staffScope = sopScope(fx.env, fx.users.staff);
      const first = await startRunForStaff(staffScope, { templateId: 'tpl_open_shift_a' });
      const second = await startRunForStaff(staffScope, { templateId: 'tpl_open_shift_a' });
      expect(second.run.id).toBe(first.run.id);

      // Restrict template to barista role only and verify non-matching staff role is rejected with 403.
      await fx.env.AURA_DB.prepare(
        `UPDATE sop_templates SET applicable_roles = 'barista' WHERE id = 'tpl_close_shift'`
      ).run();

      await expect(
        startRunForStaff(staffScope, { templateId: 'tpl_close_shift' })
      ).rejects.toMatchObject({
        status: 403,
        message: 'Role is not permitted to execute this template',
      });

      // Manager/owner can still start the run.
      const managerScope = sopScope(fx.env, fx.users.manager);
      const managerRun = await startRunForStaff(managerScope, { templateId: 'tpl_close_shift' });
      expect(managerRun.run.templateId).toBe('tpl_close_shift');
    } finally {
      fx.close();
    }
  });

  it('normalizes legacy empty tenant_id in findOpenShift while preserving exact-SQL fallback for mock DBs', async () => {
    const fx = createSopFixture();
    try {
      fx.sqlite.exec(`
        CREATE TABLE IF NOT EXISTS staff_shifts (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          tenant_id TEXT DEFAULT 'default',
          staff_id TEXT NOT NULL,
          date TEXT NOT NULL,
          shift TEXT NOT NULL,
          clock_in TEXT,
          clock_out TEXT
        )
      `);
      await fx.env.AURA_DB.prepare(
        `INSERT INTO staff_shifts (id, tenant_id, staff_id, date, shift, clock_in, clock_out)
         VALUES (777, '', 'staff', '2026-11-03', 'attendance', '2026-11-03T07:00:00.000Z', NULL)`
      ).run();

      const defaultScope = sopScope(fx.env, fx.users.staff);
      const openDefault = await findOpenShift(defaultScope);
      expect(openDefault?.id).toBe('777');

      const otherTenantScope = sopScope(fx.env, {
        id: 'staff',
        role: 'staff',
        tenantId: 'cafe-b',
      });
      const openOther = await findOpenShift(otherTenantScope);
      expect(openOther).toBeNull();
    } finally {
      fx.close();
    }

    // Verify fallback when mock DB only responds to exact `WHERE tenant_id = ?` SQL.
    const mockEnv = {
      AURA_DB: {
        prepare: (sql: string) => ({
          bind: (..._args: unknown[]) => ({
            first: async () => {
              if (sql.includes('WHERE tenant_id = ?')) {
                return { id: 888, clock_in: '2026-11-03T08:00:00.000Z', shift: 'scheduled' };
              }
              return null;
            },
          }),
        }),
      },
    } as unknown as Env;
    const mockScope = sopScope(mockEnv, { id: 'staff-1', role: 'staff', tenantId: 'cafe-x' });
    const fromFallback = await findOpenShift(mockScope);
    expect(fromFallback?.id).toBe('888');
  });

  it('validates appealExplanation length (trimmed 1..2000) and maps SopAccessError to HTTP status on standalone OpenAPIHono', async () => {
    const fx = createSopFixture();
    try {
      const app = new OpenAPIHono<{ Bindings: Env }>();
      let currentUser: { id: string; role: string; tenantId?: string } | undefined = fx.users.staff;
      app.use('*', async (c, next) => {
        if (currentUser) c.set('user' as never, currentUser as never);
        await next();
      });
      registerSopAdminWriteHandlers(app, SopAdminRoutes);
      registerSopReminderHandlers(app, SopAdminRoutes);

      // Staff calling manager-only reminders endpoint gets 403 (mapped by handler try/catch, not 500).
      const remForbidden = await app.request(
        'http://localhost/api/sop/admin/reminders',
        { method: 'GET' },
        fx.env
      );
      expect(remForbidden.status).toBe(403);

      // Staff calling updateTemplate gets 403 instead of unhandled 500.
      const tplForbidden = await app.request(
        'http://localhost/api/sop/admin/templates/tpl_open_shift_a',
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: 'Unauthorized Edit',
          }),
        },
        fx.env
      );
      expect(tplForbidden.status).toBe(403);

      // Whitespace-only appealExplanation is rejected with 400.
      const whitespaceAppeal = await app.request(
        'http://localhost/api/sop/admin/violations/vio_123/appeal',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ appealExplanation: '     ' }),
        },
        fx.env
      );
      expect(whitespaceAppeal.status).toBe(400);

      // Appeal for non-existent violation as manager with valid explanation returns 404 via SopAccessError handler mapping.
      currentUser = fx.users.manager;
      const notFoundAppeal = await app.request(
        'http://localhost/api/sop/admin/violations/vio_missing/appeal',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ appealExplanation: 'Tôi đã thực hiện đúng quy trình vệ sinh ca sáng.' }),
        },
        fx.env
      );
      expect(notFoundAppeal.status).toBe(404);
      expect(SopAccessError).toBeDefined();
    } finally {
      fx.close();
    }
  });
});
