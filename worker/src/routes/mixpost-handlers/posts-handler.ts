import type { Hono } from 'hono';
import type { MixpostEnv } from '../../types/env';
import { getTenantId, matchesTenantRow } from '../../middleware/tenant';
import { mixpostCreatePostSchema, zodErrorResponse } from '../../lib/validators';
import { createLogger } from '../../utils/logger.js';
import { getMixpostClient, type PostRecord } from './types';

const log = createLogger({ route: 'mixpost:posts' });

function isSafeMixpostMediaUrl(rawUrl: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return false;
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return false;
  }
  const hostname = parsed.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (
    !hostname ||
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '0.0.0.0' ||
    hostname === '::1' ||
    hostname === '169.254.169.254' ||
    hostname === 'metadata.google.internal' ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal')
  ) {
    return false;
  }
  if (/^127\./.test(hostname) || /^10\./.test(hostname) || /^192\.168\./.test(hostname) || /^169\.254\./.test(hostname)) {
    return false;
  }
  const octets = hostname.split('.');
  if (octets.length === 4 && octets.every((o) => /^\d+$/.test(o))) {
    const [a, b] = octets.map(Number);
    if (a === 172 && b >= 16 && b <= 31) {
      return false;
    }
  }
  return true;
}

export function registerPostsHandler(router: Hono<{ Bindings: MixpostEnv }>): void {
  // POST /posts — create and publish a post
  router.post('/posts', async (c) => {
    const env = c.env as unknown as MixpostEnv;
    const isProd =
      (env as unknown as Record<string, unknown>)?.ENVIRONMENT === 'production' ||
      (env as unknown as Record<string, unknown>)?.NODE_ENV === 'production';
    const hasAuthHeader = Boolean(c.req.header('Authorization') || c.req.header('authorization'));
    const user = c.get?.('user' as never) as { role?: string; tenantId?: string; tenant_id?: string } | undefined;
    if (!user && (isProd || hasAuthHeader)) {
      return c.json({ success: false, error: 'Authentication required' }, 401);
    }
    if (user?.role && !['owner', 'admin', 'manager', 'supervisor'].includes(String(user.role).toLowerCase())) {
      return c.json({ success: false, error: 'Insufficient permissions' }, 403);
    }
    const rawTenant = getTenantId(c as unknown as Parameters<typeof getTenantId>[0]).trim() || 'default';
    const rawTenantId = rawTenant.toLowerCase() === 'hq' ? '*' : rawTenant;
    if (user && rawTenantId === '*') {
      return c.json({ success: false, error: 'Concrete tenant context required to publish post' }, 400);
    }
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
          if (!isSafeMixpostMediaUrl(url)) {
            return c.json({ success: false, error: 'Invalid or restricted media URL' }, 400);
          }
        }
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
        const rawTenantId = getTenantId(c as unknown as Parameters<typeof getTenantId>[0]).trim() || 'default';
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
          if (tenantId === 'default') {
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
    const rawTenant = getTenantId(c as unknown as Parameters<typeof getTenantId>[0]).trim() || 'default';
    const tenantId = rawTenant.toLowerCase() === 'hq' ? '*' : rawTenant;
    const client = getMixpostClient(env);
    const rawLimit = parseInt(c.req.query('limit') || '20', 10);
    const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 100) : 20;
    if (env.AURA_DB) {
      try {
        let filtered: PostRecord[] = [];
        let scopedOk = false;
        if (tenantId !== '*') {
          try {
            const { results: scopedResults } = await env.AURA_DB.prepare(
              "SELECT * FROM mixpost_posts WHERE COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ? ORDER BY created_at DESC LIMIT ?"
            ).bind(tenantId, limit).all<PostRecord>();
            scopedOk = true;
            filtered = (scopedResults || [])
              .filter((r) => matchesTenantRow(r as unknown as Record<string, unknown>, tenantId))
              .slice(0, limit);
          } catch {
            filtered = [];
          }
        }
        if (filtered.length === 0 && (tenantId === '*' || (!scopedOk && tenantId === 'default'))) {
          const { results } = await env.AURA_DB.prepare(
            'SELECT * FROM mixpost_posts ORDER BY created_at DESC LIMIT ?'
          ).bind(Math.max(limit, 200)).all<PostRecord>();
          filtered = (results || [])
            .filter((r) => matchesTenantRow(r as unknown as Record<string, unknown>, tenantId))
            .slice(0, limit);
        }
        if (filtered.length > 0 || !client) {
          return c.json({ success: true, data: filtered });
        }
        if (tenantId !== 'default' && tenantId !== '*') {
          return c.json({ success: true, data: [], source: 'd1' });
        }
      } catch {
        if (!client || (tenantId !== 'default' && tenantId !== '*')) {
          return c.json({ success: true, data: [] });
        }
      }
    }
    if (!client || (tenantId !== 'default' && tenantId !== '*')) {
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
    const isProd =
      (env as unknown as Record<string, unknown>)?.ENVIRONMENT === 'production' ||
      (env as unknown as Record<string, unknown>)?.NODE_ENV === 'production';
    const hasAuthHeader = Boolean(c.req.header('Authorization') || c.req.header('authorization'));
    const user = c.get?.('user' as never) as { role?: string } | undefined;
    if (!user && (isProd || hasAuthHeader)) {
      return c.json({ success: false, error: 'Authentication required' }, 401);
    }
    if (user?.role && !['owner', 'admin', 'manager', 'supervisor', 'staff'].includes(String(user.role).toLowerCase())) {
      return c.json({ success: false, error: 'Insufficient permissions' }, 403);
    }
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
