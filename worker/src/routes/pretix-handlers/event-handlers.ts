import type { Hono } from 'hono';
import { PretixApiError } from '../../lib/pretix-client';
import { getPretixClient } from '../../tree/pretix/client-factory';
import type { PretixEnv, PretixEventResponse, PretixItemsResponse } from './types';

export function registerEventHandlers(router: Hono): void {
  // GET /events — list events
  router.get('/events', async (c) => {
    const env = c.env as unknown as PretixEnv;
    const client = getPretixClient(env);
    if (!client) {
      return c.json({ success: false, error: 'pretix not configured' }, 503);
    }

    const organizer = (env.PRETIX_ORGANIZER as string) || (c.req.query('organizer') as string) || 'default';

    try {
      const events = await client.listEvents(organizer);
      return c.json({ success: true, data: events });
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

    const organizer = (env.PRETIX_ORGANIZER as string) || 'default';
    const slug = c.req.param('slug');

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

    const organizer = (env.PRETIX_ORGANIZER as string) || 'default';
    const eventSlug = c.req.query('event') || 'default';

    try {
      const orders = await client.listOrders(organizer, eventSlug);
      return c.json({ success: true, data: orders });
    } catch {
      return c.json({ success: false, error: 'Failed to fetch orders' }, 500);
    }
  });
}
