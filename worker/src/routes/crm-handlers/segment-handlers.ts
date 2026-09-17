import type { Hono } from 'hono';
import type { Env } from '../../types/env';
import { requireAuth } from '../../middleware/auth';
import { listSegments, buildSegment } from '@aura/domain-crm';

export function registerSegmentHandlers(router: Hono<{ Bindings: Env }>): void {
  /**
   * GET /api/crm/segments
   * List all segment definitions with counts (no member list).
   * Auth: owner or staff only.
   */
  router.get('/segments', requireAuth(['owner', 'staff']), async (c) => {
    const db = c.env.AURA_DB;
    const kv = c.env.AUTH_KV as import('@cloudflare/workers-types').KVNamespace | undefined;

    const segments = await listSegments(db, kv);

    return c.json({ success: true, data: segments });
  });

  /**
   * GET /api/crm/segments/:key/customers
   * Paginated member list for a segment.
   * Auth: owner or staff only.
   */
  router.get('/segments/:key/customers', requireAuth(['owner', 'staff']), async (c) => {
    const db = c.env.AURA_DB;
    const kv = c.env.AUTH_KV as import('@cloudflare/workers-types').KVNamespace | undefined;
    const key = c.req.param('key');

    if (!key) {
      return c.json({ success: false, error: 'segment key is required' }, 400);
    }

    const limitParam = c.req.query('limit');
    const offsetParam = c.req.query('offset');
    const limit = limitParam ? parseInt(limitParam, 10) : 50;
    const offset = offsetParam ? parseInt(offsetParam, 10) : 0;

    const result = await buildSegment(db, key, kv, { limit, offset });

    return c.json({ success: true, data: result });
  });
}
