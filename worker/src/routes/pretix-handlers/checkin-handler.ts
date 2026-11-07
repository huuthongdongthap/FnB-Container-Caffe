import type { Hono } from 'hono';
import { PretixApiError } from '../../lib/pretix-client';
import { getPretixClient } from '../../tree/pretix/client-factory';
import { pretixCheckinSchema, zodErrorResponse } from '../../lib/validators';
import { resolveTenantOrganizer } from './event-handlers';
import type { PretixEnv } from './types';

export function registerCheckinHandler(router: Hono): void {
  // POST /checkin — verify ticket at door
  router.post('/checkin', async (c) => {
    const env = c.env as unknown as PretixEnv;
    const client = getPretixClient(env);
    if (!client) {
      return c.json({ success: false, error: 'pretix not configured' }, 503);
    }

    const orgRes = resolveTenantOrganizer(c, env);
    if (!orgRes.ok) {
      return c.json({ success: false, error: orgRes.error }, orgRes.status);
    }

    let rawCheckin: Record<string, unknown>;
    try {
      rawCheckin = await c.req.json<Record<string, unknown>>();
    } catch {
      return c.json({ success: false, error: 'Invalid JSON' }, 400);
    }
    const parsed = pretixCheckinSchema.safeParse(rawCheckin);
    if (!parsed.success) {
      return zodErrorResponse(c, parsed.error);
    }
    const body = parsed.data;

    const organizer = orgRes.organizer;
    const eventSlug = body.event || 'default';
    const listId = body.listId || 1;

    try {
      const result = await client.redeemCheckin(organizer, eventSlug, listId, body.secret);
      return c.json({ success: true, data: result });
    } catch (e: unknown) {
      if (e instanceof PretixApiError && e.status === 404) {
        return c.json({ success: false, error: 'Ticket not found' }, 404);
      }
      return c.json({ success: false, error: 'Checkin failed' }, 500);
    }
  });
}
