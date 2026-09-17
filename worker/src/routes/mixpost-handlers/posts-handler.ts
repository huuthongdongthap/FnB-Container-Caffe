import type { Hono } from 'hono';
import type { MixpostEnv } from '../../types/env';
import { mixpostCreatePostSchema, zodErrorResponse } from '../../lib/validators';
import { createLogger } from '../../utils/logger.js';
import { getMixpostClient, type PostRecord } from './types';

const log = createLogger({ route: 'mixpost:posts' });

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
      if (rawBody.mediaUrls && (rawBody.mediaUrls as unknown[]).length > 0) {
        for (const url of rawBody.mediaUrls as string[]) {
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

      const result = await client.createPost({
        content: data.content,
        accounts: data.accounts,
        scheduledAt: rawBody.scheduledAt as string | undefined,
        mediaIds
      });

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
    const client = getMixpostClient(env);
    if (!client) {
      if (env.AURA_DB) {
        const { results } = await env.AURA_DB.prepare(
          'SELECT * FROM mixpost_posts ORDER BY created_at DESC LIMIT 20'
        ).all<PostRecord>();
        return c.json({ success: true, data: results || [] });
      }
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