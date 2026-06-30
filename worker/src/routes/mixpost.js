/**
 * Mixpost Bridge Routes — Hono router for social media publishing
 *
 * Bridges Aura D1 data to the self-hosted Mixpost API.
 * Internal network only (no auth middleware).
 *
 * POST /api/mixpost/posts     — Create a scheduled post (with optional media upload)
 * POST /api/mixpost/generate  — Generate branded post content from D1 data
 * GET  /api/mixpost/accounts  — List Mixpost-connected social accounts
 * GET  /api/mixpost/posts     — List Mixpost posts
 */

import { Hono } from 'hono';
import { createLogger } from '../utils/logger.js';
import { createMixpostClient, MixpostApiError } from '../lib/mixpost-client.js';

const log = createLogger({ route: 'mixpost' });

export const mixpostRouter = new Hono();

// ── Helpers ──────────────────────────────────────────────────────

/**
 * Validate and parse request body for POST /posts.
 * Returns parsed data or throws a 400 response.
 */
async function parseCreatePostBody(c) {
  let body;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ success: false, error: 'Invalid JSON body' }, 400);
  }

  if (!body.content || typeof body.content !== 'string' || body.content.trim().length === 0) {
    return c.json({ success: false, error: 'content is required and must be a non-empty string' }, 400);
  }
  if (!Array.isArray(body.accounts) || body.accounts.length === 0) {
    return c.json({ success: false, error: 'accounts is required and must be a non-empty array of numbers' }, 400);
  }
  if (body.scheduledAt && typeof body.scheduledAt !== 'string') {
    return c.json({ success: false, error: 'scheduledAt must be a string if provided' }, 400);
  }
  if (body.mediaUrls && (!Array.isArray(body.mediaUrls) || body.mediaUrls.some((u) => typeof u !== 'string'))) {
    return c.json({ success: false, error: 'mediaUrls must be an array of strings if provided' }, 400);
  }
  return body;
}

/**
 * Validate and parse request body for POST /generate.
 */
async function parseGenerateBody(c) {
  let body;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ success: false, error: 'Invalid JSON body' }, 400);
  }
  if (!body.source || !['promotion', 'menu'].includes(body.source)) {
    return c.json({ success: false, error: 'source must be either "promotion" or "menu"' }, 400);
  }
  if (body.source === 'promotion' && (!body.id || typeof body.id !== 'string')) {
    return c.json({ success: false, error: 'id is required for promotion source' }, 400);
  }
  return body;
}

/**
 * Get Mixpost client from env.
 */
function getMixpost(c) {
  return createMixpostClient(c.env.MIXPOST_API_URL, c.env.MIXPOST_API_TOKEN);
}

// ── Content Templates ────────────────────────────────────────────

/**
 * Generate post content for a promotion.
 *
 * @param {{ code: string, percent: number }} promo
 * @returns {{ content: string, mediaUrls: string[], hashtags: string[] }}
 */
function promoToPostContent(promo) {
  return {
    content: `🎉 ${promo.code}: Giảm ${promo.percent}% đơn hàng!\n\n${promo.percent >= 20 ? '🔥 Siêu hot! ' : ''}Áp dụng tại Aura Cafe.\n\n#AuraCafe #KhuyenMai #CaPhe`,
    mediaUrls: [],
    hashtags: ['AuraCafe', 'KhuyenMai', 'CaPhe'],
  };
}

/**
 * Generate post content for daily menu specials.
 *
 * @param {Array<{ name: string, price: number, image_url?: string }>} products
 * @returns {{ content: string, mediaUrls: string[], hashtags: string[] }}
 */
function specialsToPostContent(products) {
  if (products.length === 0) {
    return {
      content: '📋 Hien chua co mon dac biet nao hom nay. Hay ghe Aura Cafe de kham pha!\n\n#AuraCafe #MenuHangNgay',
      mediaUrls: [],
      hashtags: ['AuraCafe', 'MenuHangNgay'],
    };
  }
  const items = products
    .map((p) => `☕ ${p.name} — ${Number(p.price).toLocaleString('vi-VN')}đ`)
    .join('\n');
  const content = `📋 Món đặc biệt hôm nay tại Aura Cafe:\n\n${items}\n\nGọi ngay: 1900 1234\n\n#AuraCafe #MenuHangNgay`;
  return {
    content,
    mediaUrls: products.filter((p) => p.image_url).slice(0, 4).map((p) => p.image_url),
    hashtags: ['AuraCafe', 'MenuHangNgay'],
  };
}

/**
 * Generate post content for weekly highlights.
 *
 * @param {Array<{ name: string, price: number, image_url?: string }>} products
 * @returns {{ content: string, mediaUrls: string[], hashtags: string[] }}
 */
function weeklyHighlightsToPostContent(products) {
  if (products.length === 0) {
    return {
      content: '🌟 Chua co san pham noi bat tuan nay. Ghe Aura Cafe de kham pha!\n\n#AuraCafe #BestSeller #CaPhe',
      mediaUrls: [],
      hashtags: ['AuraCafe', 'BestSeller', 'CaPhe'],
    };
  }
  const items = products
    .map((p, i) => `${i + 1}. ☕ ${p.name} — ${Number(p.price).toLocaleString('vi-VN')}đ`)
    .join('\n');
  return {
    content: `🌟 Best Seller tuần này tại Aura Cafe:\n\n${items}\n\nGhé ngay để thưởng thức!\n\n#AuraCafe #BestSeller #CaPhe`,
    mediaUrls: products.filter((p) => p.image_url).slice(0, 1).map((p) => p.image_url),
    hashtags: ['AuraCafe', 'BestSeller', 'CaPhe'],
  };
}

// ── POST /api/mixpost/posts ──────────────────────────────────────

mixpostRouter.post('/posts', async (c) => {
  log.info('create_post_start');
  try {
    const parsed = await parseCreatePostBody(c);
    // If parsed returns a Response (validation failure), return it
    if (parsed.status) { return parsed; }

    const mixpost = getMixpost(c);
    const { content, accounts, scheduledAt, mediaUrls } = parsed;

    // Upload media if URLs provided
    const mediaIds = [];
    if (mediaUrls && mediaUrls.length > 0) {
      for (const url of mediaUrls) {
        try {
          const media = await mixpost.uploadMediaFromUrl(url);
          if (media && media.id) { mediaIds.push(media.id); }
        } catch (mediaErr) {
          log.warn('media_upload_failed', { url, error: mediaErr.message });
          // Continue with other media uploads — don't fail the whole post
        }
      }
    }

    const result = await mixpost.createPost({
      accounts,
      content,
      scheduledAt,
      mediaIds,
    });

    if (mediaIds.length > 0) {
      log.info('media_attached', { postId: result.id, mediaCount: mediaIds.length });
    }

    log.info('create_post_success', { postId: result.id });
    return c.json({ success: true, postId: result.id });
  } catch (err) {
    if (err instanceof MixpostApiError) {
      if (err.status === 401) {
        log.warn('mixpost_token_expired', { endpoint: err.endpoint });
      }
      log.error('mixpost_api_failed', { status: err.status, endpoint: err.endpoint });
      return c.json({ success: false, error: 'Mixpost API error' }, 500);
    }
    log.error('create_post_failed', { error: err.message });
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
});

// ── POST /api/mixpost/generate ───────────────────────────────────

mixpostRouter.post('/generate', async (c) => {
  log.info('generate_post_start');
  try {
    const parsed = await parseGenerateBody(c);
    if (parsed.status) { return parsed; }

    const db = c.env.AURA_DB;
    const { source, id, category } = parsed;

    if (source === 'promotion') {
      // Query D1 for the specific promotion
      const promo = await db
        .prepare('SELECT code, percent, max_discount, min_order FROM promotions WHERE code = ? AND is_active = 1')
        .bind(id)
        .first();

      if (!promo) {
        return c.json({ success: false, error: 'Promotion not found or inactive' }, 404);
      }

      const data = promoToPostContent(promo);
      log.info('generate_promo_success', { code: promo.code });
      return c.json({ success: true, data });
    }

    if (source === 'menu') {
      // Query top available products
      let query = 'SELECT name, price, image_url FROM products WHERE is_available = 1';
      const binds = [];
      if (category) {
        query += ' AND category_id = ?';
        binds.push(category);
      }
      query += ' ORDER BY name ASC LIMIT 5';

      const { results } = await db.prepare(query).bind(...binds).all();

      const data = specialsToPostContent(results || []);
      log.info('generate_menu_success', { productCount: (results || []).length });
      return c.json({ success: true, data });
    }

    return c.json({ success: false, error: 'Invalid source type' }, 400);
  } catch (err) {
    log.error('generate_post_failed', { error: err.message });
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
});

// ── GET /api/mixpost/accounts ────────────────────────────────────

mixpostRouter.get('/accounts', async (c) => {
  log.info('list_accounts');
  try {
    const mixpost = getMixpost(c);
    const data = await mixpost.listAccounts();
    return c.json({ success: true, data });
  } catch (err) {
    if (err instanceof MixpostApiError) {
      log.error('mixpost_accounts_failed', { status: err.status });
      return c.json({ success: false, error: 'Failed to fetch accounts from Mixpost' }, 500);
    }
    log.error('list_accounts_failed', { error: err.message });
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
});

// ── GET /api/mixpost/posts ───────────────────────────────────────

mixpostRouter.get('/posts', async (c) => {
  log.info('list_posts');
  try {
    const mixpost = getMixpost(c);
    const data = await mixpost.listPosts();
    return c.json({ success: true, data });
  } catch (err) {
    if (err instanceof MixpostApiError) {
      log.error('mixpost_posts_failed', { status: err.status });
      return c.json({ success: false, error: 'Failed to fetch posts from Mixpost' }, 500);
    }
    log.error('list_posts_failed', { error: err.message });
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
});

// ── Cron Auto-Post Functions ─────────────────────────────────────

/**
 * Parse MIXPOST_ACCOUNTS env var into an array of account IDs.
 * Accepts comma-separated numeric IDs.
 *
 * @param {Object} env — CF Worker env
 * @returns {number[]}
 */
function getAccountIds(env) {
  if (!env.MIXPOST_ACCOUNTS) { return []; }
  return env.MIXPOST_ACCOUNTS.split(',').map(Number).filter((n) => Number.isFinite(n));
}

/**
 * Auto-post daily menu specials to Mixpost, scheduled for 07:00.
 *
 * Queries top 5 available products by price, generates branded content,
 * and schedules the post. If before 07:00 today, schedules for today 07:00;
 * otherwise schedules for next day 07:00.
 *
 * Never throws — logs errors and returns silently.
 *
 * @param {Object} env — CF Worker env (AURA_DB, MIXPOST_API_URL, MIXPOST_API_TOKEN, MIXPOST_ACCOUNTS)
 */
export async function autoPostDailySpecials(env) {
  if (!env.MIXPOST_API_URL || !env.MIXPOST_API_TOKEN) {
    log.info('mixpost_cron_skip', { type: 'daily_specials', reason: 'not_configured' });
    return;
  }

  try {
    const db = env.AURA_DB;
    const { results: products } = await db.prepare(
      'SELECT name, price, image_url FROM products WHERE is_available = 1 ORDER BY price DESC LIMIT 5'
    ).all();

    if (!products || products.length === 0) {
      log.info('mixpost_cron_skip', { type: 'daily_specials', reason: 'no_products' });
      return;
    }

    const accounts = getAccountIds(env);
    if (accounts.length === 0) {
      log.info('mixpost_cron_skip', { type: 'daily_specials', reason: 'no_accounts' });
      return;
    }

    const data = specialsToPostContent(products);
    const mixpost = createMixpostClient(env.MIXPOST_API_URL, env.MIXPOST_API_TOKEN);

    // Schedule for 07:00 — if before 07:00 today, use today; otherwise next day
    const now = new Date();
    const today0700 = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 7, 0, 0, 0);
    let date;
    let time;
    if (now < today0700) {
      date = now.toISOString().split('T')[0];
      time = '07:00';
    } else {
      const tomorrow = new Date(now.getTime() + 86400000);
      date = tomorrow.toISOString().split('T')[0];
      time = '07:00';
    }

    await mixpost.createPost({ accounts, content: data.content, date, time });
    log.info('mixpost_cron_done', { type: 'daily_specials', products: products.length });
  } catch (e) {
    log.error('mixpost_cron_failed', { type: 'daily_specials', error: e.message });
  }
}

/**
 * Auto-post active promotions to Mixpost.
 *
 * Queries promotions with is_active = 1, filters by date in application code
 * (belt-and-suspenders with D1), and posts one per active promotion.
 *
 * Never throws — logs errors and returns silently.
 *
 * @param {Object} env — CF Worker env (AURA_DB, MIXPOST_API_URL, MIXPOST_API_TOKEN, MIXPOST_ACCOUNTS)
 */
export async function autoPostNewPromotions(env) {
  if (!env.MIXPOST_API_URL || !env.MIXPOST_API_TOKEN) {
    log.info('mixpost_cron_skip', { type: 'new_promotions', reason: 'not_configured' });
    return;
  }

  try {
    const db = env.AURA_DB;
    const { results: promotions } = await db.prepare(
      'SELECT code, percent, max_discount, min_order, starts_at, expires_at FROM promotions WHERE is_active = 1'
    ).all();

    if (!promotions || promotions.length === 0) {
      log.info('mixpost_cron_skip', { type: 'new_promotions', reason: 'no_promotions' });
      return;
    }

    // Filter by date in application code for testability and portability
    const now = new Date();
    const activeNow = promotions.filter((p) => {
      const startsAt = p.starts_at ? new Date(p.starts_at) : null;
      const expiresAt = p.expires_at ? new Date(p.expires_at) : null;
      return (!startsAt || startsAt <= now) && (!expiresAt || expiresAt > now);
    });

    if (activeNow.length === 0) {
      log.info('mixpost_cron_skip', { type: 'new_promotions', reason: 'no_active_promotions' });
      return;
    }

    const accounts = getAccountIds(env);
    if (accounts.length === 0) {
      log.info('mixpost_cron_skip', { type: 'new_promotions', reason: 'no_accounts' });
      return;
    }

    const mixpost = createMixpostClient(env.MIXPOST_API_URL, env.MIXPOST_API_TOKEN);

    for (const promo of activeNow) {
      const data = promoToPostContent(promo);
      await mixpost.createPost({ accounts, content: data.content });
      log.info('mixpost_cron_done', { type: 'new_promotions', code: promo.code });
    }
  } catch (e) {
    log.error('mixpost_cron_failed', { type: 'new_promotions', error: e.message });
  }
}

/**
 * Auto-post weekly product highlights to Mixpost.
 *
 * Picks 5 random available products, generates a "best seller" style
 * post content with numbered ranking, and pushes to Mixpost.
 *
 * Never throws — logs errors and returns silently.
 *
 * @param {Object} env — CF Worker env (AURA_DB, MIXPOST_API_URL, MIXPOST_API_TOKEN, MIXPOST_ACCOUNTS)
 */
export async function autoPostWeeklyHighlights(env) {
  if (!env.MIXPOST_API_URL || !env.MIXPOST_API_TOKEN) {
    log.info('mixpost_cron_skip', { type: 'weekly_highlights', reason: 'not_configured' });
    return;
  }

  try {
    const db = env.AURA_DB;
    const { results: products } = await db.prepare(
      'SELECT name, price, image_url FROM products WHERE is_available = 1 ORDER BY RANDOM() LIMIT 5'
    ).all();

    if (!products || products.length === 0) {
      log.info('mixpost_cron_skip', { type: 'weekly_highlights', reason: 'no_products' });
      return;
    }

    const data = weeklyHighlightsToPostContent(products);
    const accounts = getAccountIds(env);
    if (accounts.length === 0) {
      log.info('mixpost_cron_skip', { type: 'weekly_highlights', reason: 'no_accounts' });
      return;
    }

    const mixpost = createMixpostClient(env.MIXPOST_API_URL, env.MIXPOST_API_TOKEN);

    await mixpost.createPost({ accounts, content: data.content });
    log.info('mixpost_cron_done', { type: 'weekly_highlights', products: products.length });
  } catch (e) {
    log.error('mixpost_cron_failed', { type: 'weekly_highlights', error: e.message });
  }
}
