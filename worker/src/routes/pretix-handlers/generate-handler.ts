import type { Hono } from 'hono';
import { PretixApiError } from '../../lib/pretix-client';
import { getPretixClient } from '../../tree/pretix/client-factory';
import { pretixGenerateSchema, zodErrorResponse } from '../../lib/validators';
import { resolveTenantOrganizer } from './event-handlers';
import type { PretixEnv, PretixEventResponse, PretixItem, PretixItemsResponse } from './types';

function resolveLocalizedEventName(rawName: unknown, fallbackSlug: string): string {
  if (typeof rawName === 'string' && rawName.trim()) {
    return rawName.trim();
  }
  if (rawName && typeof rawName === 'object' && !Array.isArray(rawName)) {
    const map = rawName as Record<string, unknown>;
    if (typeof map.vi === 'string' && map.vi.trim()) return map.vi.trim();
    if (typeof map.en === 'string' && map.en.trim()) return map.en.trim();
    for (const val of Object.values(map)) {
      if (typeof val === 'string' && val.trim()) {
        return val.trim();
      }
    }
  }
  return fallbackSlug;
}

async function resolveTenantBrand(
  db: import('@cloudflare/workers-types').D1Database | undefined,
  tenantKey: string
): Promise<{ brandName: string; brandTag: string }> {
  let brandName = '';
  if (db && typeof db.prepare === 'function' && tenantKey && tenantKey !== 'default' && tenantKey !== '*' && tenantKey !== 'aura-cafe') {
    try {
      const branding = await db
        .prepare('SELECT display_name FROM tenant_branding WHERE tenant_id = ? LIMIT 1')
        .bind(tenantKey)
        .first<{ display_name?: string | null }>();
      if (branding?.display_name && branding.display_name.trim()) {
        brandName = branding.display_name.trim();
      }
    } catch {
      // tenant_branding optional
    }
    if (!brandName) {
      try {
        const tenantRow = await db
          .prepare('SELECT name FROM saas_tenants WHERE id = ? OR slug = ? LIMIT 1')
          .bind(tenantKey, tenantKey)
          .first<{ name?: string | null }>();
        if (tenantRow?.name && tenantRow.name.trim()) {
          brandName = tenantRow.name.trim();
        }
      } catch {
        // saas_tenants optional
      }
    }
  }
  const finalBrand = brandName || 'Aura Cafe';
  const normalizedTag = finalBrand
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, 'd')
    .replace(/[^A-Za-z0-9]+/g, '');
  return {
    brandName: finalBrand,
    brandTag: normalizedTag || 'AuraCafe',
  };
}

export function registerGenerateHandler(router: Hono): void {
  // POST /generate — generate social post from event
  router.post('/generate', async (c) => {
    const env = c.env as unknown as PretixEnv;
    const client = getPretixClient(env);
    if (!client) {
      return c.json({ success: false, error: 'pretix not configured' }, 503);
    }

    const orgRes = resolveTenantOrganizer(c, env);
    if (!orgRes.ok) {
      return c.json({ success: false, error: orgRes.error }, orgRes.status);
    }

    let rawGenerate: Record<string, unknown>;
    try {
      rawGenerate = await c.req.json<Record<string, unknown>>();
    } catch {
      return c.json({ success: false, error: 'Invalid JSON' }, 400);
    }
    const parsed = pretixGenerateSchema.safeParse(rawGenerate);
    if (!parsed.success) {
      return zodErrorResponse(c, parsed.error);
    }
    const body = parsed.data;

    const organizer = orgRes.organizer;

    try {
      const event = (await client.getEvent(organizer, body.slug)) as PretixEventResponse;

      let _items: PretixItem[] = [];
      try {
        const itemsResult = (await client.listItems(organizer, body.slug)) as PretixItemsResponse;
        _items = itemsResult.results || [];
      } catch {
        // items optional
      }

      const eventName = resolveLocalizedEventName(event.name, body.slug);
      const user = c.get?.('user' as never) as { tenantId?: string; tenant_id?: string } | undefined;
      const tenantLookup = (
        c.req.query('tenant_id') ||
        c.req.query('tenantId') ||
        c.req.header('X-Tenant-ID') ||
        c.req.header('x-tenant-id') ||
        user?.tenantId ||
        user?.tenant_id ||
        organizer
      ).trim();
      const { brandName, brandTag } = await resolveTenantBrand(env.AURA_DB, tenantLookup);
      const content = `Su kien: ${eventName} — ${brandName}\n#${brandTag} #SuKien #Workshop`;

      return c.json({
        success: true,
        data: { content, hashtags: [brandTag, 'SuKien', 'Workshop'] }
      });
    } catch (e: unknown) {
      if (e instanceof PretixApiError && e.status === 404) {
        return c.json({ success: false, error: 'Event not found' }, 404);
      }
      return c.json({ success: false, error: 'Failed to generate content' }, 500);
    }
  });
}
