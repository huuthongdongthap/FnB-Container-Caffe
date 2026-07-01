/**
 * Mixpost Routes — /api/mixpost
 * Social media publishing + cron auto-post functions.
 *
 * Endpoints:
 *   POST /publish     — Publish a post to social media
 *   POST /auto-post   — Cron-triggered auto-posting
 *   GET  /posts       — List recent posts
 *   GET  /accounts    — List connected social accounts
 */

import { createMixpostClient, MixpostClient } from '../lib/mixpost-client';
import { createLogger } from '../utils/logger.js';

interface MixpostEnv {
  AURA_DB?: D1Database;
  MIXPOST_API_URL?: string;
  MIXPOST_API_TOKEN?: string;
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

// ── Route handlers (plain exports for non-Hono routes) ──

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

      // Log to DB if available
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

  // POST /api/mixpost/auto-post — cron-triggered auto-posting
  if (method === 'POST' && path === '/auto-post') {
    if (!client) return json({ success: false, error: 'Mixpost not configured' }, 503);
    if (!env.AURA_DB) return json({ success: false, error: 'Database not available' }, 503);

    try {
      const now = new Date();
      const dayOfWeek = now.getDay();
      const hour = now.getHours();

      // Find templates matching current schedule
      const { results: templates } = await env.AURA_DB.prepare(
        'SELECT * FROM mixpost_templates WHERE is_active = 1'
      ).all<AutoPostTemplate>();

      let posted = 0;
      const errors: string[] = [];

      for (const template of templates || []) {
        try {
          // Simple schedule check: cron-like pattern (day hour)
          const [cronDay, cronHour] = template.schedule_cron.split(' ');
          const matchDay = cronDay === '*' || parseInt(cronDay) === dayOfWeek;
          const matchHour = cronHour === '*' || parseInt(cronHour) === hour;

          if (!matchDay || !matchHour) continue;

          // Resolve template content with dynamic data
          const content = await resolveTemplate(template.content_template, env);

          const result = await client.createPost({
            content,
            accounts: template.accounts ? JSON.parse(template.accounts) : [],
          });

          // Log auto-post
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

  // GET /api/mixpost/posts — list recent posts
  if (method === 'GET' && path === '/posts') {
    if (!env.AURA_DB) return json({ success: true, data: [] });

    const limit = parseInt(url.searchParams.get('limit') || '20', 10);
    const { results } = await env.AURA_DB.prepare(
      'SELECT * FROM mixpost_posts ORDER BY created_at DESC LIMIT ?'
    ).bind(limit).all<PostRecord>();

    return json({ success: true, data: results || [] });
  }

  // GET /api/mixpost/accounts — list connected accounts
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

// ── Cron auto-post stubs ──

export async function autoPostDailySpecials(_env: Record<string, unknown>): Promise<{ posted: number }> {
  try {
    const { handleMixpostRequest } = await import('./mixpost');
    // Trigger auto-post via internal handler
    return { posted: 0 };
  } catch {
    return { posted: 0 };
  }
}

export async function autoPostNewPromotions(_env: Record<string, unknown>): Promise<{ posted: number }> {
  return { posted: 0 };
}

export async function autoPostWeeklyHighlights(_env: Record<string, unknown>): Promise<{ posted: number }> {
  return { posted: 0 };
}

async function resolveTemplate(template: string, env: MixpostEnv): Promise<string> {
  let content = template;

  // Replace dynamic placeholders
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
