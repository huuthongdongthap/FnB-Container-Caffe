import type { Hono } from 'hono';
import type { MixpostEnv } from '../../types/env';
import { getTenantId } from '../../middleware/tenant';
import { mixpostCreatePostSchema, zodErrorResponse } from '../../lib/validators';
import { createLogger } from '../../utils/logger.js';
import { getMixpostClient, type PostRecord } from './types';

const log = createLogger({ route: 'mixpost:posts' });

function matchesTenantRow(row: Record<string, unknown>, tenantId: string): boolean {
  if (tenantId === '*') return true;
  if ('tenant_id' in row && row.tenant_id !== undefined && row.tenant_id !== null && String(row.tenant_id).trim() !== '') {
    return String(row.tenant_id).trim() === tenantId;
  }
  return tenantId === 'default';
}

export function registerPostsHandler(router: Hono<{ Bindings: MixpostEnv }>): void {
  // POST /posts — create and publish a post
  router.post('/posts', async (c) => {
    const env = c.env as unknown as MixpostEnv;
    const client = getMixpostClient(env);
    if (!client) {
      return c.json({ success: false, error: 'Mixpost not configured' }, 503);
    }

    let rawBody: Record<string, unknown>;
    try {
      rawBody = await c.req.json() as Record<string, unknown>;
    } catch {
      return c.json({ success: false, error: 'Invalid JSON' }, 400);
    }
    const parsed = mixpostCreatePostSchema.safeParse(rawBody);
    if (!parsed.success) {
      return zodErrorResponse(c, parsed.error);
    }
    const data = parsed.data;

    try {
      const mediaIds: Array<string | number> = [];
      const mediaUrls = data.media_urls ?? data.mediaUrls ?? [];
      if (mediaUrls.length > 0) {
        for (const url of mediaUrls) {
          try {
            const media = await client.uploadMediaFromUrl(url);
            if (media.id) {
              mediaIds.push(media.id as string | number);
            }
          } catch {
            // media upload fails silently
          }
        }
      }

      const scheduledAt = data.scheduled_at ?? data.scheduledAt;
      const result = await client.createPost({
        content: data.content,
        accounts: data.accounts,
        scheduledAt,
        mediaIds
      });

      if (env.AURA_DB) {
        const rawTenantId = getTenantId(c as unknown as Parameters<typeof getTenantId>[0]);
        const tenantId = rawTenantId === '*' ? 'default' : rawTenantId;
        const now = new Date().toISOString();
        try {
          await env.AURA_DB.prepare(
            'INSERT INTO mixpost_posts (content, status, platforms, media_urls, scheduled_at, published_at, created_at, tenant_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
          ).bind(
            data.content,
            scheduledAt ? 'scheduled' : 'published',
            JSON.stringify(data.accounts),
            JSON.stringify(mediaUrls),
            scheduledAt || null,
            scheduledAt ? null : now,
            now,
            tenantId
          ).run();
        } catch {
          try {
            await env.AURA_DB.prepare(
              'INSERT INTO mixpost_posts (content, status, platforms, media_urls, scheduled_at, published_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
            ).bind(
              data.content,
              scheduledAt ? 'scheduled' : 'published',
              JSON.stringify(data.accounts),
              JSON.stringify(mediaUrls),
              scheduledAt || null,
              scheduledAt ? null : now,
              now
            ).run();
          } catch {
            // optional persistence table in test mocks
          }
        }
      }

      return c.json({ success: true, postId: result.id });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      log.error('mixpost_publish_failed', { error: msg });
      return c.json({ success: false, error: 'Failed to publish post' }, 500);
    }
  });

  // GET /posts — list recent posts
  router.get('/posts', async (c) => {
    const env = c.env as unknown as MixpostEnv;
    const tenantId = getTenantId(c as unknown as Parameters<typeof getTenantId>[0]);
    const client = getMixpostClient(env);
    const rawLimit = parseInt(c.req.query('limit') || '20', 10);
    const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 100) : 20;
    if (env.AURA_DB) {
      try {
        const { results } = await env.AURA_DB.prepare(
          'SELECT * FROM mixpost_posts ORDER BY created_at DESC LIMIT ?'
        ).bind(Math.max(limit, 200)).all<PostRecord>();
        const filtered = (results || [])
          .filter((r) => matchesTenantRow(r as unknown as Record<string, unknown>, tenantId))
          .slice(0, limit);
        if (filtered.length > 0 || !client) {
          return c.json({ success: true, data: filtered });
        }
      } catch {
        if (!client) {
          return c.json({ success: true, data: [] });
        }
      }
    }
    if (!client) {
      return c.json({ success: true, data: [] });
    }

    try {
      const posts = await client.listPosts();
      return c.json({ success: true, data: posts });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      log.error('mixpost_fetch_posts_failed', { error: msg });
      return c.json({ success: false, error: 'Failed to fetch posts' }, 500);
    }
  });

  // GET /accounts — list connected accounts
  router.get('/accounts', async (c) => {
    const env = c.env as unknown as MixpostEnv;
    const client = getMixpostClient(env);
    if (!client) {
      return c.json({ success: false, error: 'Mixpost not configured' }, 503);
    }

    try {
      const accounts = await client.listAccounts();
      return c.json({ success: true, data: accounts });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      log.error('mixpost_fetch_accounts_failed', { error: msg });
      return c.json({ success: false, error: 'Failed to fetch accounts' }, 500);
    }
  });
}
