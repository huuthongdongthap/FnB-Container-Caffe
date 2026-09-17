import type { Hono } from 'hono';
import { PretixApiError } from '../../lib/pretix-client';
import { getPretixClient } from '../../tree/pretix/client-factory';
import { pretixGenerateSchema, zodErrorResponse } from '../../lib/validators';
import type { PretixEnv, PretixEventResponse, PretixItem, PretixItemsResponse } from './types';

export function registerGenerateHandler(router: Hono): void {
  // POST /generate — generate social post from event
  router.post('/generate', async (c) => {
    const env = c.env as unknown as PretixEnv;
    const client = getPretixClient(env);
    if (!client) {
      return c.json({ success: false, error: 'pretix not configured' }, 503);
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

    const organizer = (env.PRETIX_ORGANIZER as string) || 'default';

    try {
      const event = (await client.getEvent(organizer, body.slug)) as PretixEventResponse;

      let items: PretixItem[] = [];
      try {
        const itemsResult = (await client.listItems(organizer, body.slug)) as PretixItemsResponse;
        items = itemsResult.results || [];
      } catch {
        // items optional
      }

      const eventName = event.name?.vi || event.name || body.slug;
      const content = `🎉 Su kien: ${eventName} — Aura Cafe\n#AuraCafe #SuKien #Workshop`;

      return c.json({
        success: true,
        data: { content, hashtags: ['AuraCafe', 'SuKien', 'Workshop'] }
      });
    } catch (e: unknown) {
      if (e instanceof PretixApiError && e.status === 404) {
        return c.json({ success: false, error: 'Event not found' }, 404);
      }
      return c.json({ success: false, error: 'Failed to generate content' }, 500);
    }
  });
}
