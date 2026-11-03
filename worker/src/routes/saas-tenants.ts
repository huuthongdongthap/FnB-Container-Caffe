import { Hono } from 'hono';
import type { Env } from '../types/env';
import { requireAuth, optionalAuth } from '../middleware/auth';
import { isHQSuperAdmin } from '../middleware/tenant';

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
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return cleaned || `store-${crypto.randomUUID().slice(0, 8)}`;
}

export function createTenantRoutes() {
  const router = new Hono<{
    Bindings: Env;
    Variables: { tenantId?: string; user?: { id: string; email: string; role: string; tenantId?: string } };
  }>();

  router.use('/*', async (c, next) => {
    if (!c.get('user') && (c.req.header('Authorization') || c.req.header('authorization'))) {
      return optionalAuth()(c as never, next);
    }
    return next();
  });

  router.get('/my', async (c) => {
    const currentUser = c.get('user');
    if (!currentUser) {
      return c.json({ ok: false, error: 'unauthenticated' } as const, 401);
    }

    const userTenantId = (currentUser.tenantId || '').trim();
    const headerOrQueryTenantId = (
      c.req.header('X-Tenant-ID') ||
      c.req.header('x-tenant-id') ||
      c.req.query('tenant_id') ||
      ''
    ).trim();
    const tenantId = (c.get('tenantId') || headerOrQueryTenantId || userTenantId || '').trim();
    if (!tenantId) {
      return c.json({ ok: false, error: 'no_tenant' } as const, 400);
    }

    try {
      const db = c.env.AURA_DB as unknown as { prepare(sql: string): { bind(...a: unknown[]): { run(): Promise<{ rowCount: number }>; first<T = Record<string, unknown>>(): Promise<T | null> } } };
      const row = await db.prepare('SELECT id, name, slug, owner_user_id, tier, status, trial_ends_at, current_period_end, created_at, updated_at FROM saas_tenants WHERE id = ?').bind(tenantId).first<Record<string, unknown>>();
      if (!row) {
        if (!isHQSuperAdmin(currentUser) && (!userTenantId || userTenantId !== tenantId)) {
          return c.json({ ok: false, error: 'forbidden' } as const, 403);
        }
        return c.json({ ok: false, error: 'not_found' } as const, 404);
      }
      const isAuthorized =
        isHQSuperAdmin(currentUser) ||
        (Boolean(userTenantId) && userTenantId === tenantId) ||
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
        prepare(sql: string): { bind(...a: unknown[]): { run(): Promise<{ rowCount: number }>; first<T = Record<string, unknown>>(): Promise<T | null> } };
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

      await db.prepare(
        'INSERT INTO saas_tenants (id, slug, name, tier, status, owner_user_id, trial_ends_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
      )
        .bind(id, finalSlug, rawName, 'BASIC', 'trial', ownerUserId, trialEnds, now, now)
        .run();

      const row = await db.prepare('SELECT * FROM saas_tenants WHERE id = ?').bind(id).first<Record<string, unknown>>();
      return c.json({ ok: true, data: row ? mapRow(row) : null } as const, 201);
    } catch (_err) {
      return c.json({ ok: false, error: 'server_error' } as const, 500);
    }
  });

  return router;
}

export default createTenantRoutes;
