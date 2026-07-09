import { createMixpostClient } from '../../lib/mixpost-client';
import { createLogger } from '../../utils/logger.js';
import { resolveTemplate } from './template-resolver';
import type { MixpostEnv, MixpostPostInput, AutoPostTemplate } from './types';

const log = createLogger({ route: 'mixpost' });

function getMixpostClient(env: MixpostEnv) {
  if (!env.MIXPOST_API_URL || !env.MIXPOST_API_TOKEN) {
    return null;
  }
  return createMixpostClient(env.MIXPOST_API_URL, env.MIXPOST_API_TOKEN);
}

export async function handleMixpostRequest(request: Request, env: MixpostEnv): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname.replace('/api/mixpost', '');
  const method = request.method;

  const json = (data: unknown, status = 200): Response =>
    new Response(JSON.stringify(data), {
      status,
      headers: { 'Content-Type': 'application/json' }
    });

  const client = getMixpostClient(env);

  // POST /api/mixpost/publish
  if (method === 'POST' && path === '/publish') {
    if (!client) {
      return json({ success: false, error: 'Mixpost not configured' }, 503);
    }

    const body = await request.json() as MixpostPostInput;
    if (!body.content) {
      return json({ success: false, error: 'content required' }, 400);
    }

    try {
      const result = await client.createPost({
        content: body.content,
        accounts: body.accounts || [],
        mediaIds: body.mediaUrls,
        scheduledAt: body.scheduledAt
      });

      if (env.AURA_DB) {
        await env.AURA_DB.prepare(
          'INSERT INTO mixpost_posts (content, status, platforms, media_urls, scheduled_at, published_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
        ).bind(
          body.content, 'published',
          JSON.stringify(body.accounts || []),
          JSON.stringify(body.mediaUrls || []),
          body.scheduledAt || null,
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
    if (!client) {
      return json({ success: false, error: 'Mixpost not configured' }, 503);
    }
    if (!env.AURA_DB) {
      return json({ success: false, error: 'Database not available' }, 503);
    }

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

          if (!matchDay || !matchHour) {
            continue;
          }

          const content = await resolveTemplate(template.content_template, env);

          const result = await client.createPost({
            content,
            accounts: template.accounts ? JSON.parse(template.accounts) : []
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
    if (!env.AURA_DB) {
      return json({ success: true, data: [] });
    }

    const limit = parseInt(url.searchParams.get('limit') || '20', 10);
    const { results } = await env.AURA_DB.prepare(
      'SELECT * FROM mixpost_posts ORDER BY created_at DESC LIMIT ?'
    ).bind(limit).all();

    return json({ success: true, data: results || [] });
  }

  // GET /api/mixpost/accounts
  if (method === 'GET' && path === '/accounts') {
    if (!client) {
      return json({ success: false, error: 'Mixpost not configured' }, 503);
    }

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
