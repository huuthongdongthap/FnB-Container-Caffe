import type { Hono } from 'hono';
import { PretixApiError } from '../../lib/pretix-client';
import { PRETIX_IDENTIFIER_RE } from '../../lib/validators/pretix';
import { isHQSuperAdmin } from '../../middleware/tenant';
import { getPretixClient } from '../../tree/pretix/client-factory';
import type { PretixEnv, PretixEventResponse, PretixItemsResponse } from './types';

function isValidPretixId(value: string): boolean {
  return PRETIX_IDENTIFIER_RE.test(value) && value !== '.' && value !== '..';
}

export function resolveTenantOrganizer(
  c: import('hono').Context,
  env: PretixEnv
): { ok: true; organizer: string } | { ok: false; status: 400 | 403; error: string } {
  const queryOrg = c.req.query('organizer');
  if (queryOrg !== undefined && !isValidPretixId(queryOrg)) {
    return { ok: false, status: 400, error: 'Invalid organizer slug' };
  }
  const requestedTenant = (
    c.req.query('tenant_id') ||
    c.req.query('tenantId') ||
    c.req.query('store_id') ||
    c.req.query('storeId') ||
    c.req.header('X-Tenant-ID') ||
    c.req.header('x-tenant-id') ||
    c.req.header('X-Store-ID') ||
    c.req.header('x-store-id') ||
    ''
  ).trim();
  if (requestedTenant && requestedTenant !== '*' && !isValidPretixId(requestedTenant)) {
    return { ok: false, status: 400, error: 'Invalid tenant identifier' };
  }
  const user = c.get?.('user' as never) as { id?: string; role?: string; tenantId?: string; tenant_id?: string } | undefined;
  const staffRoles = new Set(['owner', 'admin', 'manager', 'supervisor', 'staff']);
  const isStaffUser = Boolean(user?.role && staffRoles.has(String(user.role).toLowerCase()));
  const rawUserTenant = (user?.tenantId || user?.tenant_id || (c.get?.('tenantId' as never) as string | undefined) || '').trim();
  const userTenant = rawUserTenant || (isStaffUser ? 'default' : '');
  const isHq = isHQSuperAdmin(user);
  if (isStaffUser && !isHq) {
    if (
      rawUserTenant === '*' ||
      rawUserTenant.toLowerCase() === 'hq' ||
      requestedTenant === '*' ||
      requestedTenant.toLowerCase() === 'hq' ||
      (queryOrg && (queryOrg.toLowerCase() === 'hq' || queryOrg !== userTenant)) ||
      (requestedTenant && requestedTenant !== userTenant)
    ) {
      return { ok: false, status: 403, error: 'Cross-tenant organizer override denied' };
    }
  }
  const normalizedRequested = requestedTenant.toLowerCase() === 'hq' ? '*' : requestedTenant;
  const normalizedQueryOrg = queryOrg && queryOrg.toLowerCase() === 'hq' ? '' : queryOrg;
  const explicitOverride = normalizedQueryOrg || (normalizedRequested && normalizedRequested !== '*' ? normalizedRequested : '');
  const canOverrideOrganizer = Boolean(
    isStaffUser && (isHq || (explicitOverride && userTenant === explicitOverride))
  );
  if (canOverrideOrganizer && explicitOverride) {
    return { ok: true, organizer: explicitOverride };
  }
  if (isStaffUser && userTenant && userTenant !== '*' && userTenant.toLowerCase() !== 'hq' && userTenant !== 'default') {
    return { ok: true, organizer: userTenant };
  }
  const organizer =
    (env.PRETIX_ORGANIZER as string) ||
    (isStaffUser && userTenant && userTenant !== '*' && userTenant.toLowerCase() !== 'hq' ? userTenant : 'default');
  return { ok: true, organizer };
}

export function registerEventHandlers(router: Hono): void {
  // GET /events — list events
  router.get('/events', async (c) => {
    const env = c.env as unknown as PretixEnv;
    const client = getPretixClient(env);
    if (!client) {
      return c.json({ success: false, error: 'pretix not configured' }, 503);
    }

    const orgRes = resolveTenantOrganizer(c, env);
    if (!orgRes.ok) {
      return c.json({ success: false, error: orgRes.error }, orgRes.status);
    }
    const organizer = orgRes.organizer;

    try {
      const events = await client.listEvents(organizer);
      const results = Array.isArray(events)
        ? events
        : ((events as unknown as { results?: unknown[] })?.results ?? []);
      return c.json({ success: true, data: events, results });
    } catch {
      return c.json({ success: false, error: 'Failed to fetch events' }, 500);
    }
  });

  // GET /events/:slug — get event with items
  router.get('/events/:slug', async (c) => {
    const env = c.env as unknown as PretixEnv;
    const client = getPretixClient(env);
    if (!client) {
      return c.json({ success: false, error: 'pretix not configured' }, 503);
    }

    const orgRes = resolveTenantOrganizer(c, env);
    if (!orgRes.ok) {
      return c.json({ success: false, error: orgRes.error }, orgRes.status);
    }
    const organizer = orgRes.organizer;
    const slug = c.req.param('slug');
    if (!isValidPretixId(slug)) {
      return c.json({ success: false, error: 'Invalid event slug' }, 400);
    }

    try {
      const event = await client.getEvent(organizer, slug) as PretixEventResponse;
      try {
        const itemsResult = await client.listItems(organizer, slug) as PretixItemsResponse;
        event.items = itemsResult.results || [];
      } catch {
        event.items = [];
      }
      return c.json({ success: true, data: event });
    } catch (e: unknown) {
      if (e instanceof PretixApiError && e.status === 404) {
        return c.json({ success: false, error: 'Event not found' }, 404);
      }
      return c.json({ success: false, error: 'Failed to fetch event' }, 500);
    }
  });

  // GET /orders — list paginated orders
  router.get('/orders', async (c) => {
    const env = c.env as unknown as PretixEnv;
    const client = getPretixClient(env);
    if (!client) {
      return c.json({ success: false, error: 'pretix not configured' }, 503);
    }

    const orgRes = resolveTenantOrganizer(c, env);
    if (!orgRes.ok) {
      return c.json({ success: false, error: orgRes.error }, orgRes.status);
    }
    const organizer = orgRes.organizer;
    const eventSlug = c.req.query('event') || 'default';
    if (!isValidPretixId(eventSlug)) {
      return c.json({ success: false, error: 'Invalid event slug' }, 400);
    }

    try {
      const orders = await client.listOrders(organizer, eventSlug);
      return c.json({ success: true, data: orders });
    } catch {
      return c.json({ success: false, error: 'Failed to fetch orders' }, 500);
    }
  });
}
