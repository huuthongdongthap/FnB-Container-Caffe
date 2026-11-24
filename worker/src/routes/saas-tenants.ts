import { Hono } from 'hono';
import type { Env } from '../types/env';
import { requireAuth, optionalAuth } from '../middleware/auth';
import { isHQSuperAdmin } from '../middleware/tenant';
import { rateLimitMiddleware, type RateLimitConfig } from '../middleware/rate-limit';
import { RESERVED_SLUGS, sanitizeSlug, validateSlug } from '../lib/saas-provisioning';
import { isStaffRole, issueStaffSession, loadStaffAccount } from '../lib/staff-session';

const SELF_SERVE_RATE_LIMIT: RateLimitConfig = {
  max: 5,
  windowSec: 3600,
  keyPrefix: 'rl:saas:self-serve',
  errorMessage: 'Quá nhiều yêu cầu tạo workspace. Vui lòng thử lại sau.',
};

function extractAffectedRows(result: unknown): number | null {
  if (!result || typeof result !== 'object') return null;
  const r = result as { meta?: { changes?: number }; rowCount?: number };
  if (typeof r.meta?.changes === 'number') return r.meta.changes;
  if (typeof r.rowCount === 'number') return r.rowCount;
  return null;
}

export type SaasTenant = {
  id: string;
  slug: string;
  name: string | null;
  tier: string;
  status: string;
  ownerUserId: string | null;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  createdAt: string;
  updatedAt: string;
};

function mapRow(row: Record<string, unknown>): SaasTenant {
  return {
    id: String(row.id),
    slug: String(row.slug),
    name: row.name as string | null,
    tier: String(row.tier),
    status: String(row.status),
    ownerUserId: row.owner_user_id as string | null,
    trialEndsAt: row.trial_ends_at as string | null,
    currentPeriodEnd: row.current_period_end as string | null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function generateId(): string {
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  const rand = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `tenant_${Date.now()}_${rand}`;
}

export function generateSlug(name: string): string {
  const cleaned = name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, 'd')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/^-+|-+$/g, '');
  return cleaned || `store-${crypto.randomUUID().slice(0, 8)}`;
}

export function createTenantRoutes() {
  const router = new Hono<{
    Bindings: Env;
    Variables: { tenantId?: string; user?: { id: string; email: string; role: string; tenantId?: string } };
  }>();

  router.use('/*', async (c, next) => {
    if (
      !c.get('user') &&
      (c.req.header('Authorization') ||
        c.req.header('authorization') ||
        c.req.header('Cookie') ||
        c.req.header('cookie'))
    ) {
      return optionalAuth()(c as never, next);
    }
    return next();
  });

  router.get('/my', async (c) => {
    const currentUser = c.get('user');
    if (!currentUser) {
      return c.json({ ok: false, error: 'unauthenticated' } as const, 401);
    }

    const userTenantId = (
      currentUser.tenantId ||
      (currentUser as { tenant_id?: string }).tenant_id ||
      ''
    ).trim();
    const overrideCandidates = [
      c.req.query('tenant_id'),
      c.req.query('tenantId'),
      c.req.query('store_id'),
      c.req.query('storeId'),
      c.req.header('X-Tenant-ID'),
      c.req.header('x-tenant-id'),
      c.req.header('X-Store-ID'),
      c.req.header('x-store-id'),
    ]
      .map((v) => (typeof v === 'string' ? v.trim() : ''))
      .filter(Boolean);
    if (new Set(overrideCandidates).size > 1) {
      return c.json({ ok: false, error: 'forbidden' } as const, 403);
    }
    const headerOrQueryTenantId = overrideCandidates[0] || '';
    const ctxTenantId = (c.get('tenantId') || '').trim();
    const isHq = isHQSuperAdmin(currentUser);
    if (!isHq) {
      if (
        userTenantId === '*' ||
        userTenantId.toLowerCase() === 'hq' ||
        headerOrQueryTenantId === '*' ||
        headerOrQueryTenantId.toLowerCase() === 'hq' ||
        ctxTenantId === '*' ||
        ctxTenantId.toLowerCase() === 'hq' ||
        (headerOrQueryTenantId && (!userTenantId || headerOrQueryTenantId !== userTenantId)) ||
        (ctxTenantId && userTenantId && ctxTenantId !== userTenantId)
      ) {
        return c.json({ ok: false, error: 'forbidden' } as const, 403);
      }
    }
    const tenantId = (headerOrQueryTenantId || (isHq ? ctxTenantId : userTenantId || ctxTenantId) || '').trim();
    if (!tenantId) {
      return c.json({ ok: false, error: 'no_tenant' } as const, 400);
    }

    try {
      const db = c.env.AURA_DB as unknown as {
        prepare(sql: string): {
          bind(...a: unknown[]): {
            run(): Promise<{ rowCount: number }>;
            first<T = Record<string, unknown>>(): Promise<T | null>;
          };
        };
      };
      const row = await db
        .prepare(
          'SELECT id, name, slug, owner_user_id, tier, status, trial_ends_at, current_period_end, created_at, updated_at FROM saas_tenants WHERE id = ? OR slug = ?'
        )
        .bind(tenantId, tenantId)
        .first<Record<string, unknown>>();
      if (!row) {
        if (!isHQSuperAdmin(currentUser) && (!userTenantId || userTenantId !== tenantId)) {
          return c.json({ ok: false, error: 'forbidden' } as const, 403);
        }
        return c.json({ ok: false, error: 'not_found' } as const, 404);
      }
      const isAuthorized =
        isHQSuperAdmin(currentUser) ||
        (Boolean(userTenantId) &&
          (userTenantId === tenantId || row.id === userTenantId || row.slug === userTenantId)) ||
        row.owner_user_id === currentUser.id;
      if (!isAuthorized) {
        return c.json({ ok: false, error: 'forbidden' } as const, 403);
      }
      return c.json({ ok: true, data: mapRow(row) } as const);
    } catch (_err) {
      return c.json({ ok: false, error: 'server_error' } as const, 500);
    }
  });

  router.use('/create', requireAuth(['owner', 'admin']));

  router.post('/create', async (c) => {
    const currentUser = c.get('user');
    if (!currentUser) {
      return c.json({ ok: false, error: 'unauthenticated' } as const, 401);
    }
    if (currentUser.role !== 'owner' && currentUser.role !== 'admin') {
      return c.json({ ok: false, error: 'forbidden' } as const, 403);
    }

    const callerTenantId = (
      currentUser.tenantId ||
      (currentUser as { tenant_id?: string }).tenant_id ||
      ''
    ).trim();
    if (!isHQSuperAdmin(currentUser) && callerTenantId !== '') {
      return c.json({ ok: false, error: 'forbidden' } as const, 403);
    }
    if (!isHQSuperAdmin(currentUser) && !callerTenantId) {
      return c.json({ ok: false, error: 'forbidden' } as const, 403);
    }

    let body: { name?: string; slug?: string };
    try {
      body = (await c.req.json()) as { name?: string; slug?: string };
    } catch {
      return c.json({ ok: false, error: 'invalid_json' } as const, 400);
    }

    const rawName = typeof body.name === 'string' && body.name.trim().length ? body.name.trim() : `OPC ${new Date().toLocaleDateString('vi-VN')}`;
    const rawSlug = typeof body.slug === 'string' && body.slug.trim().length ? generateSlug(body.slug.trim()) : '';
    const slug = (rawSlug || generateSlug(rawName)).slice(0, 60);

    try {
      const db = c.env.AURA_DB as unknown as {
        prepare(sql: string): {
          bind(...a: unknown[]): {
            run(): Promise<{ rowCount: number }>;
            first<T = Record<string, unknown>>(): Promise<T | null>;
          };
        };
        batch?(statements: unknown[]): Promise<unknown[]>;
      };
      const cntRow = await db
        .prepare('SELECT COUNT(*) as cnt FROM saas_tenants WHERE owner_user_id = ?')
        .bind(currentUser.id)
        .first<{ cnt?: number | string }>()
        .catch(() => null);
      if (Number(cntRow?.cnt ?? 0) >= 10) {
        return c.json({ ok: false, error: 'tenant_limit_exceeded' } as const, 429);
      }

      const MAX_SLUG_ATTEMPTS = 10;
      let finalSlug = slug;
      const exists = await db.prepare('SELECT id FROM saas_tenants WHERE slug = ?').bind(slug).first<{ id: string }>();
      if (exists) {
        let counter = 1;
        let candidate = slug + '-' + counter;
        while (
          counter <= MAX_SLUG_ATTEMPTS &&
          (await db.prepare('SELECT id FROM saas_tenants WHERE slug = ?').bind(candidate).first<{ id: string }>())
        ) {
          counter += 1;
          candidate = slug + '-' + counter;
        }
        if (counter > MAX_SLUG_ATTEMPTS) {
          candidate = `${slug}-${crypto.randomUUID().slice(0, 6)}`;
        }
        finalSlug = candidate;
      }

      const id = generateId();
      const ownerUserId = currentUser.id;
      const now = new Date().toISOString();
      const trialEnds = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();

      const tenantStmt = db
        .prepare(
          'INSERT INTO saas_tenants (id, slug, name, tier, status, owner_user_id, trial_ends_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
        )
        .bind(id, finalSlug, rawName, 'BASIC', 'trial', ownerUserId, trialEnds, now, now);
      const subscriptionStmt = db
        .prepare(
          'INSERT INTO tenant_subscriptions (id, tenant_id, tier, status, trial_ends_at, current_period_end, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
        )
        .bind(`sub_${id}`, id, 'BASIC', 'trial', trialEnds, trialEnds, now, now);

      if (typeof db.batch === 'function') {
        await db.batch([tenantStmt, subscriptionStmt]);
      } else {
        await tenantStmt.run();
        await subscriptionStmt.run();
      }

      // Brand-new tenants have zero legacy refund history — mark refund ledger ready immediately.
      try {
        await db
          .prepare(
            'INSERT OR IGNORE INTO refund_tenant_readiness (tenant_id, reconciled_at, reconciled_by, evidence) VALUES (?, ?, ?, ?)'
          )
          .bind(id, now, ownerUserId, `new-tenant-provisioning:${id}`)
          .run();
      } catch {
        // Non-fatal in minimal test schemas without refund_tenant_readiness
      }

      const row = await db.prepare('SELECT * FROM saas_tenants WHERE id = ?').bind(id).first<Record<string, unknown>>();
      return c.json({ ok: true, data: row ? mapRow(row) : null } as const, 201);
    } catch (_err) {
      return c.json({ ok: false, error: 'server_error' } as const, 500);
    }
  });

  // Self-serve tenant onboarding: allows an authenticated user who does not yet
  // belong to a tenant (or is HQ admin) to provision their first BASIC trial workspace.
  router.post('/self-serve', rateLimitMiddleware(SELF_SERVE_RATE_LIMIT), async (c) => {
    const currentUser = c.get('user');
    if (!currentUser) {
      return c.json({ ok: false, error: 'unauthenticated' } as const, 401);
    }

    const isHq = isHQSuperAdmin(currentUser);
    const callerTenantId = (
      currentUser.tenantId ||
      (currentUser as { tenant_id?: string }).tenant_id ||
      ''
    ).trim();
    const callerRole = String(currentUser.role || '').trim().toLowerCase();
    const hasNonDefaultTenant = callerTenantId !== '' && callerTenantId !== 'default';
    const isAllowedSelfServeRole = callerRole === '' || callerRole === 'customer' || callerRole === 'user';
    if (!isHq) {
      if (hasNonDefaultTenant) {
        return c.json({ ok: false, error: 'already_has_tenant' } as const, 409);
      }
      if (isStaffRole(callerRole) || !isAllowedSelfServeRole) {
        return c.json({ ok: false, error: 'forbidden' } as const, 403);
      }
    }

    let body: { name?: string; slug?: string };
    try {
      body = (await c.req.json()) as { name?: string; slug?: string };
    } catch {
      return c.json({ ok: false, error: 'invalid_json' } as const, 400);
    }

    const rawName = typeof body.name === 'string' && body.name.trim().length ? body.name.trim() : '';
    if (!rawName) {
      return c.json({ ok: false, error: 'name_required' } as const, 400);
    }

    let slug: string;
    if (typeof body.slug === 'string' && body.slug.trim().length > 0) {
      const sanitized = sanitizeSlug(body.slug.trim());
      const check = validateSlug(sanitized);
      if (!check.valid) {
        return c.json({ ok: false, error: 'invalid_slug', message: check.reason } as const, 400);
      }
      slug = sanitized;
    } else {
      const derived = sanitizeSlug(generateSlug(rawName));
      const check = validateSlug(derived);
      slug = check.valid ? derived : `store-${crypto.randomUUID().slice(0, 8)}`;
    }

    if (!isHq && !c.env.JWT_SECRET) {
      return c.json({ ok: false, error: 'server_error' } as const, 500);
    }

    try {
      const db = c.env.AURA_DB as unknown as {
        prepare(sql: string): {
          bind(...a: unknown[]): {
            run(): Promise<{ rowCount?: number; meta?: { changes?: number } }>;
            first<T = Record<string, unknown>>(): Promise<T | null>;
          };
        };
        batch?(statements: unknown[]): Promise<unknown[]>;
      };

      if (!isHq) {
        const persistedUser = await db
          .prepare('SELECT id, role, tenant_id, is_active FROM users WHERE id = ? LIMIT 1')
          .bind(currentUser.id)
          .first<{ id: string; role?: string | null; tenant_id?: string | null; is_active?: number | null }>();
        if (persistedUser) {
          if (persistedUser.is_active === 0) {
            return c.json({ ok: false, error: 'forbidden' } as const, 403);
          }
          const dbTenant = String(persistedUser.tenant_id || '').trim();
          const dbRole = String(persistedUser.role || '').trim().toLowerCase();
          if (dbTenant !== '' && dbTenant !== 'default') {
            return c.json({ ok: false, error: 'already_has_tenant', tenantId: dbTenant } as const, 409);
          }
          if (isStaffRole(dbRole) || (dbRole !== '' && dbRole !== 'customer' && dbRole !== 'user')) {
            return c.json({ ok: false, error: 'forbidden' } as const, 403);
          }
        }
      }

      const existingOwned = await db
        .prepare('SELECT id FROM saas_tenants WHERE owner_user_id = ? LIMIT 1')
        .bind(currentUser.id)
        .first<{ id: string }>();
      if (existingOwned && !isHq) {
        return c.json({ ok: false, error: 'already_has_tenant', tenantId: existingOwned.id } as const, 409);
      }

      const MAX_SLUG_ATTEMPTS = 10;
      let finalSlug = slug;
      const exists = await db.prepare('SELECT id FROM saas_tenants WHERE slug = ?').bind(slug).first<{ id: string }>();
      if (exists) {
        let counter = 1;
        let candidate = `${slug.slice(0, 44)}-${counter}`;
        while (
          counter <= MAX_SLUG_ATTEMPTS &&
          (RESERVED_SLUGS.has(candidate) ||
            (await db.prepare('SELECT id FROM saas_tenants WHERE slug = ?').bind(candidate).first<{ id: string }>()))
        ) {
          counter += 1;
          candidate = `${slug.slice(0, 44)}-${counter}`;
        }
        if (counter > MAX_SLUG_ATTEMPTS) {
          candidate = `${slug.slice(0, 40)}-${crypto.randomUUID().slice(0, 6)}`;
        }
        finalSlug = candidate;
      }

      const id = generateId();
      const ownerUserId = currentUser.id;
      const now = new Date().toISOString();
      const trialEnds = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();

      let tenantInsertResult: unknown;
      if (isHq) {
        const tenantStmt = db
          .prepare(
            'INSERT INTO saas_tenants (id, slug, name, tier, status, owner_user_id, trial_ends_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
          )
          .bind(id, finalSlug, rawName, 'BASIC', 'trial', ownerUserId, trialEnds, now, now);
        const subscriptionStmt = db
          .prepare(
            'INSERT INTO tenant_subscriptions (id, tenant_id, tier, status, trial_ends_at, current_period_end, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
          )
          .bind(`sub_${id}`, id, 'BASIC', 'trial', trialEnds, trialEnds, now, now);

        if (typeof db.batch === 'function') {
          const batchRes = await db.batch([tenantStmt, subscriptionStmt]);
          tenantInsertResult = batchRes[0];
        } else {
          tenantInsertResult = await tenantStmt.run();
          await subscriptionStmt.run();
        }
      } else {
        const rawUserName = (currentUser as { name?: string }).name;
        const ownerName =
          (typeof rawUserName === 'string' && rawUserName.trim()) ||
          (typeof currentUser.email === 'string' && currentUser.email.trim()) ||
          ownerUserId;
        const rawUserPhone = (currentUser as { phone?: string | null }).phone;
        const ownerPhone = typeof rawUserPhone === 'string' && rawUserPhone.trim() ? rawUserPhone.trim() : null;

        const tenantStmt = db
          .prepare(
            `INSERT INTO saas_tenants (id, slug, name, tier, status, owner_user_id, trial_ends_at, created_at, updated_at)
             SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?
             WHERE NOT EXISTS (SELECT 1 FROM saas_tenants WHERE owner_user_id = ?)`
          )
          .bind(id, finalSlug, rawName, 'BASIC', 'trial', ownerUserId, trialEnds, now, now, ownerUserId);
        const subscriptionStmt = db
          .prepare(
            `INSERT INTO tenant_subscriptions (id, tenant_id, tier, status, trial_ends_at, current_period_end, created_at, updated_at)
             SELECT ?, ?, ?, ?, ?, ?, ?, ?
             WHERE EXISTS (SELECT 1 FROM saas_tenants WHERE id = ?)`
          )
          .bind(`sub_${id}`, id, 'BASIC', 'trial', trialEnds, trialEnds, now, now, id);
        const userUpsertStmt = db
          .prepare(
            `INSERT INTO users (id, name, phone, role, tenant_id, is_active, auth_version, updated_at)
             SELECT ?, ?, ?, 'owner', ?, 1, 1, ?
             WHERE EXISTS (SELECT 1 FROM saas_tenants WHERE id = ?)
             ON CONFLICT(id) DO UPDATE SET
               tenant_id = excluded.tenant_id,
               role = excluded.role,
               is_active = COALESCE(users.is_active, 1),
               auth_version = COALESCE(users.auth_version, 1) + 1,
               updated_at = excluded.updated_at`
          )
          .bind(ownerUserId, ownerName, ownerPhone, id, now, id);

        if (typeof db.batch === 'function') {
          const batchRes = await db.batch([tenantStmt, subscriptionStmt, userUpsertStmt]);
          tenantInsertResult = batchRes[0];
        } else {
          tenantInsertResult = await tenantStmt.run();
          await subscriptionStmt.run();
          await userUpsertStmt.run();
        }
      }

      const affected = extractAffectedRows(tenantInsertResult);
      const row = await db.prepare('SELECT * FROM saas_tenants WHERE id = ?').bind(id).first<Record<string, unknown>>();
      if (!isHq && (affected === 0 || !row)) {
        const conflictOwned = await db
          .prepare('SELECT id FROM saas_tenants WHERE owner_user_id = ? LIMIT 1')
          .bind(ownerUserId)
          .first<{ id: string }>();
        return c.json(
          { ok: false, error: 'already_has_tenant', ...(conflictOwned?.id ? { tenantId: conflictOwned.id } : {}) } as const,
          409
        );
      }

      try {
        await db
          .prepare(
            'INSERT OR IGNORE INTO refund_tenant_readiness (tenant_id, reconciled_at, reconciled_by, evidence) VALUES (?, ?, ?, ?)'
          )
          .bind(id, now, ownerUserId, `new-tenant-provisioning:${id}`)
          .run();
      } catch {
        // Non-fatal in minimal test schemas without refund_tenant_readiness
      }

      let token: string | null = null;
      let sessionUser: {
        id: string;
        name: string;
        email: string;
        phone: string;
        role: string;
        tenantId: string;
        device_id?: string;
      } | null = null;

      if (!isHq) {
        const accountRes = await loadStaffAccount(c.env.AURA_DB, ownerUserId);
        if (!accountRes.ok || accountRes.account.tenant_id !== id || accountRes.account.role !== 'owner') {
          return c.json({ ok: false, error: 'server_error' } as const, 500);
        }
        const issued = await issueStaffSession(c.env, accountRes.account, {
          email: currentUser.email,
          sessionType: 'staff-web',
        });
        token = issued.token;
        sessionUser = { ...issued.user, tenantId: issued.user.tenantId || id };
        c.header(
          'Set-Cookie',
          `access_token=${issued.token}; HttpOnly; Secure; SameSite=None; Path=/; Max-Age=${issued.expires_in}`
        );
      }

      const mapped = row ? mapRow(row) : { id, slug: finalSlug, name: rawName };
      return c.json({ ok: true, data: { ...mapped, token, user: sessionUser }, token, user: sessionUser } as const, 201);
    } catch (_err) {
      return c.json({ ok: false, error: 'server_error' } as const, 500);
    }
  });

  return router;
}

export default createTenantRoutes;
