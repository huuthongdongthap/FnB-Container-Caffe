import type { Hono } from 'hono';
import type { MixpostEnv } from '../../types/env';
import { getTenantId, matchesTenantRow } from '../../middleware/tenant';
import { isSafeMixpostMediaUrl, mixpostCreatePostSchema, zodErrorResponse } from '../../lib/validators';
import { resolveTenantMixpostAccountPolicy } from '../../tree/mixpost/account-policy';
import { createLogger } from '../../utils/logger.js';
import { getMixpostClient, type PostRecord } from './types';

const log = createLogger({ route: 'mixpost:posts' });

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
    const effectiveTenantId = rawTenantId === '*' ? 'default' : rawTenantId;
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

    const accountPolicy = await resolveTenantMixpostAccountPolicy(env, effectiveTenantId);
    const allAccountsAllowed = data.accounts.every((id) => accountPolicy.isAccountAllowed(Number(id)));
    if (!allAccountsAllowed) {
      return c.json({ success: false, error: 'Account not authorized for this tenant' }, 403);
    }

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
            const mediaId =
              media?.id ??
              (media && typeof media === 'object' && 'data' in media && media.data && typeof media.data === 'object'
                ? (media.data as Record<string, unknown>).id
                : undefined);
            if (mediaId === undefined || mediaId === null || String(mediaId).trim() === '') {
              log.error('mixpost_media_upload_missing_id', { url });
              return c.json({ success: false, error: 'Failed to upload media to Mixpost' }, 502);
            }
            mediaIds.push(mediaId as string | number);
          } catch (uploadErr: unknown) {
            const msg = uploadErr instanceof Error ? uploadErr.message : String(uploadErr);
            log.error('mixpost_media_upload_failed', { url, error: msg });
            return c.json({ success: false, error: 'Failed to upload media to Mixpost' }, 502);
          }
        }
      }

      const scheduledAt = data.scheduled_at ?? data.scheduledAt;
      if (scheduledAt && Number.isNaN(new Date(scheduledAt).getTime())) {
        return c.json({ success: false, error: 'Invalid scheduled_at datetime' }, 400);
      }

      const result = await client.createPost({
        content: data.content,
        accounts: data.accounts,
        scheduledAt,
        mediaIds
      });

      const nestedData =
        result && typeof result === 'object' && 'data' in result && result.data && typeof result.data === 'object'
          ? (result.data as Record<string, unknown>)
          : undefined;
      const postId = result?.id ?? nestedData?.id;
      if (postId === undefined || postId === null || String(postId).trim() === '') {
        log.error('mixpost_publish_missing_id', { hasResult: Boolean(result) });
        return c.json({ success: false, error: 'Failed to publish post' }, 502);
      }

      if (env.AURA_DB) {
        const tenantId = effectiveTenantId;
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

      return c.json({ success: true, postId });
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
          if (scopedOk) {
            return c.json({ success: true, data: filtered, source: 'd1' });
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
    const rawTenant = getTenantId(c as unknown as Parameters<typeof getTenantId>[0]).trim() || 'default';
    const tenantId = rawTenant.toLowerCase() === 'hq' ? '*' : rawTenant;
    const client = getMixpostClient(env);
    if (!client) {
      return c.json({ success: false, error: 'Mixpost not configured' }, 503);
    }

    const accountPolicy = await resolveTenantMixpostAccountPolicy(env, tenantId);

    try {
      const rawAccounts = await client.listAccounts();
      const accountList = Array.isArray(rawAccounts)
        ? rawAccounts
        : Array.isArray((rawAccounts as { data?: unknown })?.data)
          ? (rawAccounts as { data: Array<Record<string, unknown>> }).data
          : [];
      const tenantScopedAccounts = accountList.filter((acc) =>
        accountPolicy.isAccountAllowed(Number(acc?.id))
      );
      const providerFilter = (c.req.query('provider') || '').trim().toLowerCase();
      const filteredAccounts = providerFilter
        ? tenantScopedAccounts.filter((acc) =>
            String(acc?.provider || '').toLowerCase().includes(providerFilter)
          )
        : tenantScopedAccounts;
      return c.json({ success: true, data: filteredAccounts });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      log.error('mixpost_fetch_accounts_failed', { error: msg });
      return c.json({ success: false, error: 'Failed to fetch accounts' }, 500);
    }
  });
}
