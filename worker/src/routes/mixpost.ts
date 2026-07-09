/**
 * Mixpost Routes — /api/mixpost
 * Social media publishing + cron auto-post functions.
 *
 * Endpoints:
 *   POST /posts      — Publish a post to social media
 *   POST /generate   — Generate social content from promotions/menu
 *   POST /auto-post  — Cron-triggered auto-posting
 *   GET  /posts      — List recent posts
 *   GET  /accounts   — List connected social accounts
 */

import { Hono } from 'hono';
import { mixpostCreatePostSchema, mixpostGenerateSchema } from '../lib/validators';
import { createMixpostClient } from '../lib/mixpost-client';
import { createLogger } from '../utils/logger.js';
import type { D1Database } from '@cloudflare/workers-types';
import type { MixpostEnv, PromotionRow, ProductRow, PostRecord } from '../tree/mixpost/types';

const log = createLogger({ route: 'mixpost' });

function getMixpostClient(env: MixpostEnv) {
  if (!env.MIXPOST_API_URL || !env.MIXPOST_API_TOKEN) {
    return null;
  }
  return createMixpostClient(env.MIXPOST_API_URL, env.MIXPOST_API_TOKEN);
}

// ── Hono Router ──
export const mixpostRouter = new Hono();

// POST /posts — create and publish a post
mixpostRouter.post('/posts', async(c) => {
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
    return c.json({ success: false, error: parsed.error.issues[0].message }, 400);
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

// POST /generate — generate social content from source
mixpostRouter.post('/generate', async(c) => {
  const env = c.env as unknown as MixpostEnv;
  const db = env.AURA_DB;

  let rawBody: Record<string, unknown>;
  try {
    rawBody = await c.req.json<Record<string, unknown>>();
  } catch {
    return c.json({ success: false, error: 'Invalid JSON' }, 400);
  }
  const parsed = mixpostGenerateSchema.safeParse(rawBody);
  if (!parsed.success) {
    return c.json({ success: false, error: parsed.error.issues[0].message }, 400);
  }
  const data = parsed.data;
  const source = data.source;

  if (source === 'promotion') {
    if (!db) {
      return c.json({ success: false, error: 'Database not available' }, 503);
    }

    const promoId = data.id as string;
    const { results } = await db.prepare(
      'SELECT * FROM promotions WHERE code = ?'
    ).bind(promoId).all<PromotionRow>();

    const promos = results || [];
    if (promos.length === 0) {
      return c.json({ success: false, error: 'Promotion not found' }, 404);
    }

    const promo = promos[0];
    const content = `🔥 ${promo.code}: Giảm ${promo.percent}% — Aura Cafe\n#AuraCafe #KhuyenMai`;
    return c.json({
      success: true,
      data: { content, hashtags: ['AuraCafe', 'KhuyenMai'] }
    });
  }

  if (source === 'menu') {
    if (!db) {
      return c.json({ success: false, error: 'Database not available' }, 503);
    }

    const categoryId = data.category as number | undefined;
    let query = 'SELECT * FROM products WHERE is_available = 1';
    const params: unknown[] = [];
    if (categoryId) {
      query += ' AND category_id = ?';
      params.push(categoryId);
    }
    query += ' LIMIT 5';

    const { results } = await db.prepare(query).bind(...params).all<ProductRow>();
    const products = results || [];

    if (products.length === 0) {
      const content = '☕ Aura Cafe — Hien chua co mon nao hom nay\n#AuraCafe #MenuHangNgay';
      return c.json({
        success: true,
        data: { content, hashtags: ['AuraCafe', 'MenuHangNgay'] }
      });
    }

    const names = products.map((p: ProductRow) => p.name).join(', ');
    const content = `☕ Aura Cafe Menu Hom Nay: ${names}\n#AuraCafe #MenuHangNgay`;
    return c.json({
      success: true,
      data: { content, hashtags: ['AuraCafe', 'MenuHangNgay'] }
    });
  }

  return c.json({ success: false, error: 'Unknown source' }, 400);
});

// GET /posts — list recent posts
mixpostRouter.get('/posts', async(c) => {
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
    return c.json({ success: false, error: 'Failed to fetch posts' }, 500);
  }
});

// GET /accounts — list connected accounts
mixpostRouter.get('/accounts', async(c) => {
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
    return c.json({ success: false, error: 'Failed to fetch accounts' }, 500);
  }
});

// ── Re-exports for index.ts contract ──
export { handleMixpostRequest } from '../tree/mixpost/legacy-handler';
export { autoPostDailySpecials } from '../tree/mixpost/auto-post-daily-specials';
export { autoPostNewPromotions } from '../tree/mixpost/auto-post-new-promotions';
export { autoPostWeeklyHighlights } from '../tree/mixpost/auto-post-weekly-highlights';
