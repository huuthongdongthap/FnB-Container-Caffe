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
import { createMixpostClient, MixpostClient, MixpostApiError } from '../lib/mixpost-client';
import { createLogger } from '../utils/logger.js';

interface MixpostEnv {
  AURA_DB?: D1Database;
  MIXPOST_API_URL?: string;
  MIXPOST_API_TOKEN?: string;
  MIXPOST_ACCOUNTS?: string;
  [key: string]: unknown;
}

interface MixpostPostInput {
  content: string;
  accounts?: number[];
  media_urls?: string[];
  scheduled_at?: string;
}

interface PostRecord {
  id: string;
  content: string;
  status: string;
  platforms: string;
  media_urls: string;
  scheduled_at: string | null;
  published_at: string | null;
  error_message: string | null;
  created_at: string;
}

interface AutoPostTemplate {
  id: string;
  content_template: string;
  schedule_cron: string;
  accounts: string;
  is_active: number;
}

const log = createLogger({ route: 'mixpost' });

function getMixpostClient(env: MixpostEnv): MixpostClient | null {
  if (!env.MIXPOST_API_URL || !env.MIXPOST_API_TOKEN) return null;
  return createMixpostClient(env.MIXPOST_API_URL, env.MIXPOST_API_TOKEN);
}

// ── Hono Router ──
export const mixpostRouter = new Hono();

// POST /posts — create and publish a post
mixpostRouter.post('/posts', async (c) => {
  const env = c.env as unknown as MixpostEnv;
  const client = getMixpostClient(env);
  if (!client) return c.json({ success: false, error: 'Mixpost not configured' }, 503);

  let body: any;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ success: false, error: 'Invalid JSON' }, 400);
  }

  if (!body.content) return c.json({ success: false, error: 'content required' }, 400);
  if (!body.accounts || body.accounts.length === 0) return c.json({ success: false, error: 'accounts required' }, 400);

  try {
    let mediaIds: Array<string | number> = [];
    // Upload media from URLs if provided
    if (body.mediaUrls && body.mediaUrls.length > 0) {
      for (const url of body.mediaUrls) {
        try {
          const media = await client.uploadMediaFromUrl(url);
          if (media.id) mediaIds.push(media.id as string | number);
        } catch {
          // media upload fails silently
        }
      }
    }

    const result = await client.createPost({
      content: body.content,
      accounts: body.accounts,
      scheduledAt: body.scheduledAt,
      mediaIds,
    } as any);

    return c.json({ success: true, postId: result.id });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    log.error('mixpost_publish_failed', { error: msg });
    return c.json({ success: false, error: 'Failed to publish post' }, 500);
  }
});

// POST /generate — generate social content from source
mixpostRouter.post('/generate', async (c) => {
  const env = c.env as unknown as MixpostEnv;
  const db = env.AURA_DB;

  let body: any;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ success: false, error: 'Invalid JSON' }, 400);
  }

  const source = body.source as string;
  if (!source || !['promotion', 'menu'].includes(source)) {
    return c.json({ success: false, error: 'Unknown source type' }, 400);
  }

  if (source === 'promotion') {
    if (!db) return c.json({ success: false, error: 'Database not available' }, 503);

    const promoId = body.id as string;
    const { results } = await db.prepare(
      'SELECT * FROM promotions WHERE code = ?'
    ).bind(promoId).all();

    const promos = results as any[] || [];
    if (promos.length === 0) {
      return c.json({ success: false, error: 'Promotion not found' }, 404);
    }

    const promo = promos[0];
    const content = `🔥 ${promo.code}: Giảm ${promo.percent}% — Aura Cafe\n#AuraCafe #KhuyenMai`;
    return c.json({
      success: true,
      data: { content, hashtags: ['AuraCafe', 'KhuyenMai'] },
    });
  }

  if (source === 'menu') {
    if (!db) return c.json({ success: false, error: 'Database not available' }, 503);

    const categoryId = body.category as number | undefined;
    let query = 'SELECT * FROM products WHERE is_available = 1';
    const params: unknown[] = [];
    if (categoryId) {
      query += ' AND category_id = ?';
      params.push(categoryId);
    }
    query += ' LIMIT 5';

    const { results } = await db.prepare(query).bind(...params).all();
    const products = results as any[] || [];

    if (products.length === 0) {
      const content = `☕ Aura Cafe — Hien chua co mon nao hom nay\n#AuraCafe #MenuHangNgay`;
      return c.json({
        success: true,
        data: { content, hashtags: ['AuraCafe', 'MenuHangNgay'] },
      });
    }

    const names = products.map((p: any) => p.name).join(', ');
    const content = `☕ Aura Cafe Menu Hom Nay: ${names}\n#AuraCafe #MenuHangNgay`;
    return c.json({
      success: true,
      data: { content, hashtags: ['AuraCafe', 'MenuHangNgay'] },
    });
  }

  return c.json({ success: false, error: 'Unknown source' }, 400);
});

// GET /posts — list recent posts
mixpostRouter.get('/posts', async (c) => {
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
mixpostRouter.get('/accounts', async (c) => {
  const env = c.env as unknown as MixpostEnv;
  const client = getMixpostClient(env);
  if (!client) return c.json({ success: false, error: 'Mixpost not configured' }, 503);

  try {
    const accounts = await client.listAccounts();
    return c.json({ success: true, data: accounts });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return c.json({ success: false, error: 'Failed to fetch accounts' }, 500);
  }
});

// ── Cron auto-post functions ──

export async function autoPostDailySpecials(env: Record<string, unknown>): Promise<{ posted: number }> {
  const apiUrl = env.MIXPOST_API_URL as string | undefined;
  const apiToken = env.MIXPOST_API_TOKEN as string | undefined;
  const accountsStr = env.MIXPOST_ACCOUNTS as string | undefined;
  const db = env.AURA_DB as any;

  if (!apiUrl || !apiToken) return { posted: 0 };
  if (!accountsStr) return { posted: 0 };
  if (!db) return { posted: 0 };

  const accounts = accountsStr.split(',').map(Number).filter(n => n > 0);

  const { results } = await db.prepare(
    'SELECT * FROM products WHERE is_available = 1 LIMIT 5'
  ).all();
  const products = results as any[] || [];
  if (products.length === 0) return { posted: 0 };

  const names = products.map((p: any) => p.name).join(', ');
  const content = `☕ Menu Hang Ngay — Aura Cafe: ${names}\n📞 1900 1234\n#AuraCafe #MenuHangNgay`;

  const client = createMixpostClient(apiUrl, apiToken);
  await client.createPost({ accounts, content } as any);
  return { posted: 1 };
}

export async function autoPostNewPromotions(env: Record<string, unknown>): Promise<{ posted: number }> {
  const apiUrl = env.MIXPOST_API_URL as string | undefined;
  const apiToken = env.MIXPOST_API_TOKEN as string | undefined;
  const accountsStr = env.MIXPOST_ACCOUNTS as string | undefined;
  const db = env.AURA_DB as any;

  if (!apiUrl || !apiToken) return { posted: 0 };
  if (!accountsStr) return { posted: 0 };
  if (!db) return { posted: 0 };

  const accounts = accountsStr.split(',').map(Number).filter(n => n > 0);

  const { results } = await db.prepare(
    'SELECT * FROM promotions WHERE is_active = 1'
  ).all();
  const promotions = results as any[] || [];
  if (promotions.length === 0) return { posted: 0 };

  let posted = 0;
  const client = createMixpostClient(apiUrl, apiToken);

  for (const promo of promotions) {
    try {
      const content = `🔥 Khuyen Mai ${promo.code}: Giam ${promo.percent}% — Aura Cafe\n#AuraCafe #KhuyenMai`;
      await client.createPost({ accounts, content } as any);
      posted++;
    } catch {
      // skip failed posts
    }
  }

  return { posted };
}

export async function autoPostWeeklyHighlights(env: Record<string, unknown>): Promise<{ posted: number }> {
  const apiUrl = env.MIXPOST_API_URL as string | undefined;
  const apiToken = env.MIXPOST_API_TOKEN as string | undefined;
  const accountsStr = env.MIXPOST_ACCOUNTS as string | undefined;
  const db = env.AURA_DB as any;

  if (!apiUrl || !apiToken) return { posted: 0 };
  if (!accountsStr) return { posted: 0 };
  if (!db) return { posted: 0 };

  const accounts = accountsStr.split(',').map(Number).filter(n => n > 0);

  const { results } = await db.prepare(
    'SELECT * FROM products WHERE is_available = 1 LIMIT 5'
  ).all();
  const products = results as any[] || [];
  if (products.length === 0) return { posted: 0 };

  const ranking = products.map((p: any, i: number) => `${i + 1}. ${p.name} — ${p.price}đ`).join('\n');
  const content = `🏆 Best Seller Tuan Nay — Aura Cafe:\n${ranking}\n#AuraCafe #BestSeller`;

  const client = createMixpostClient(apiUrl, apiToken);
  await client.createPost({ accounts, content } as any);
  return { posted: 1 };
}

// ── Legacy: handleMixpostRequest (plain handler for non-Hono routing) ──
export async function handleMixpostRequest(request: Request, env: MixpostEnv): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname.replace('/api/mixpost', '');
  const method = request.method;

  const json = (data: unknown, status = 200): Response =>
    new Response(JSON.stringify(data), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });

  const client = getMixpostClient(env);

  // POST /api/mixpost/publish
  if (method === 'POST' && path === '/publish') {
    if (!client) return json({ success: false, error: 'Mixpost not configured' }, 503);

    const body = await request.json() as MixpostPostInput;
    if (!body.content) return json({ success: false, error: 'content required' }, 400);

    try {
      const result = await client.createPost({
        content: body.content,
        accounts: body.accounts || [],
        mediaIds: body.media_urls,
        scheduledAt: body.scheduled_at,
      } as any);

      if (env.AURA_DB) {
        await env.AURA_DB.prepare(
          'INSERT INTO mixpost_posts (content, status, platforms, media_urls, scheduled_at, published_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
        ).bind(
          body.content,
          'published',
          JSON.stringify(body.accounts || []),
          JSON.stringify(body.media_urls || []),
          body.scheduled_at || null,
          new Date().toISOString(),
          new Date().toISOString()
        ).run();
      }

      return json({ success: true, data: result });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      log.error('mixpost_publish_failed', { error: msg });
      return json({ success: false, error: msg }, 500);
    }
  }

  // POST /api/mixpost/auto-post
  if (method === 'POST' && path === '/auto-post') {
    if (!client) return json({ success: false, error: 'Mixpost not configured' }, 503);
    if (!env.AURA_DB) return json({ success: false, error: 'Database not available' }, 503);

    try {
      const now = new Date();
      const dayOfWeek = now.getDay();
      const hour = now.getHours();

      const { results: templates } = await env.AURA_DB.prepare(
        'SELECT * FROM mixpost_templates WHERE is_active = 1'
      ).all<AutoPostTemplate>();

      let posted = 0;
      const errors: string[] = [];

      for (const template of templates || []) {
        try {
          const [cronDay, cronHour] = template.schedule_cron.split(' ');
          const matchDay = cronDay === '*' || parseInt(cronDay) === dayOfWeek;
          const matchHour = cronHour === '*' || parseInt(cronHour) === hour;

          if (!matchDay || !matchHour) continue;

          const content = await resolveTemplate(template.content_template, env);

          const result = await client.createPost({
            content,
            accounts: template.accounts ? JSON.parse(template.accounts) : [],
          });

          await env.AURA_DB.prepare(
            'INSERT INTO mixpost_posts (content, status, platforms, source, created_at) VALUES (?, ?, ?, ?, ?)'
          ).bind(content, 'published', template.accounts, 'auto', new Date().toISOString()).run();

          posted++;
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : String(e);
          errors.push(`Template ${template.id}: ${msg}`);
        }
      }

      return json({ success: true, data: { posted, errors } });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      log.error('mixpost_auto_post_failed', { error: msg });
      return json({ success: false, error: msg }, 500);
    }
  }

  // GET /api/mixpost/posts
  if (method === 'GET' && path === '/posts') {
    if (!env.AURA_DB) return json({ success: true, data: [] });

    const limit = parseInt(url.searchParams.get('limit') || '20', 10);
    const { results } = await env.AURA_DB.prepare(
      'SELECT * FROM mixpost_posts ORDER BY created_at DESC LIMIT ?'
    ).bind(limit).all<PostRecord>();

    return json({ success: true, data: results || [] });
  }

  // GET /api/mixpost/accounts
  if (method === 'GET' && path === '/accounts') {
    if (!client) return json({ success: false, error: 'Mixpost not configured' }, 503);

    try {
      const accounts = await client.listAccounts();
      return json({ success: true, data: accounts });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      return json({ success: false, error: msg }, 500);
    }
  }

  return json({ success: false, error: 'Not found' }, 404);
}

async function resolveTemplate(template: string, env: MixpostEnv): Promise<string> {
  let content = template;

  if (content.includes('{{total_customers}}') && env.AURA_DB) {
    const { count } = await env.AURA_DB.prepare('SELECT COUNT(*) as count FROM customers').first<{ count: number }>() || { count: 0 };
    content = content.replace('{{total_customers}}', String(count));
  }

  if (content.includes('{{today_orders}}') && env.AURA_DB) {
    const today = new Date().toISOString().slice(0, 10);
    const { count } = await env.AURA_DB.prepare(
      "SELECT COUNT(*) as count FROM orders WHERE DATE(created_at) = ? AND status != 'cancelled'"
    ).bind(today).first<{ count: number }>() || { count: 0 };
    content = content.replace('{{today_orders}}', String(count));
  }

  return content;
}
