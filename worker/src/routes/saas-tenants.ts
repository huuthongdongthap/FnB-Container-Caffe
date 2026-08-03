import { Hono } from 'hono';
import type { Env } from '../types/env';

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
  return `tenant_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

export function createTenantRoutes() {
  const router = new Hono<{
    Bindings: Env;
    Variables: { tenantId?: string; user?: { id: string; email: string; role: string; tenantId?: string } };
  }>();

  router.get('/my', async (c) => {
    const tenantId = c.get('tenantId');
    if (!tenantId) {
      return c.json({ ok: false, error: 'no_tenant' } as const, 400);
    }

    try {
      const { createServerClient } = await import('../db/client');
      const db = createServerClient(c.env);
      const row = await db.prepare('SELECT * FROM saas_tenants WHERE id = ?').bind(tenantId).first<Record<string, unknown>>();
      if (!row) {
        return c.json({ ok: false, error: 'not_found' } as const, 404);
      }
      return c.json({ ok: true, data: mapRow(row) } as const);
    } catch (err) {
      return c.json({ ok: false, error: 'server_error' } as const, 500);
    }
  });

  router.post('/create', async (c) => {
    const currentUser = c.get('user');
    if (!currentUser) {
      return c.json({ ok: false, error: 'unauthenticated' } as const, 401);
    }
    if (currentUser.role !== 'owner') {
      return c.json({ ok: false, error: 'forbidden' } as const, 403);
    }

    let body: { name?: string; slug?: string };
    try {
      body = (await c.req.json()) as { name?: string; slug?: string };
    } catch {
      return c.json({ ok: false, error: 'invalid_json' } as const, 400);
    }

    const rawName = typeof body.name === 'string' && body.name.trim().length ? body.name.trim() : `OPC ${new Date().toLocaleDateString('vi-VN')}`;
    const rawSlug = typeof body.slug === 'string' && body.slug.trim().length ? body.slug.trim() : '';
    const slug = (rawSlug || generateSlug(rawName)).slice(0, 60);

    try {
      const { createServerClient } = await import('../db/client');
      const db = createServerClient(c.env);

      let finalSlug = slug;
      const exists = await db.prepare('SELECT id FROM saas_tenants WHERE slug = ?').bind(slug).first<{ id: string }>();
      if (exists) {
        let counter = 1;
        let candidate = slug + '-' + counter;
        while (await db.prepare('SELECT id FROM saas_tenants WHERE slug = ?').bind(candidate).first<{ id: string }>()) {
          counter += 1;
          candidate = slug + '-' + counter;
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
      return c.json({ ok: true, data: mapRow(row) } as const, 201);
    } catch (err) {
      return c.json({ ok: false, error: 'server_error' } as const, 500);
    }
  });

  return router;
}

export default createTenantRoutes;
