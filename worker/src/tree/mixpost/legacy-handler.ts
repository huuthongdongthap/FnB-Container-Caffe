import { createMixpostClient } from '../../lib/mixpost-client';
import { createLogger } from '../../utils/logger.js';
import { resolveTemplate } from './template-resolver';
import type { MixpostEnv, MixpostPostInput, AutoPostTemplate } from './types';

const log = createLogger({ route: 'mixpost' });

function matchesTenantRow(row: Record<string, unknown>, tenantId: string): boolean {
  if (tenantId === '*') return true;
  if ('tenant_id' in row && row.tenant_id !== undefined && row.tenant_id !== null && String(row.tenant_id).trim() !== '') {
    return String(row.tenant_id).trim() === tenantId;
  }
  return tenantId === 'default';
}

function getMixpostClient(env: MixpostEnv) {
  if (!env.MIXPOST_API_URL || !env.MIXPOST_API_TOKEN) {
    return null;
  }
  return createMixpostClient(env.MIXPOST_API_URL, env.MIXPOST_API_TOKEN);
}

export async function handleMixpostRequest(request: Request, env: MixpostEnv, resolvedTenantId?: string): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname.replace('/api/mixpost', '');
  const method = request.method;
  const tenantId = resolvedTenantId || 'default';

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
        const effectiveTenant = tenantId === '*' ? 'default' : tenantId;
        const now = new Date().toISOString();
        try {
          await env.AURA_DB.prepare(
            'INSERT INTO mixpost_posts (content, status, platforms, media_urls, scheduled_at, published_at, created_at, tenant_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
          ).bind(
            body.content, 'published',
            JSON.stringify(body.accounts || []),
            JSON.stringify(body.mediaUrls || []),
            body.scheduledAt || null,
            now,
            now,
            effectiveTenant
          ).run();
        } catch {
          await env.AURA_DB.prepare(
            'INSERT INTO mixpost_posts (content, status, platforms, media_urls, scheduled_at, published_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
          ).bind(
            body.content, 'published',
            JSON.stringify(body.accounts || []),
            JSON.stringify(body.mediaUrls || []),
            body.scheduledAt || null,
            now,
            now
          ).run();
        }
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

      const { results: rawTemplates } = await env.AURA_DB.prepare(
        'SELECT * FROM mixpost_templates WHERE is_active = 1'
      ).all<AutoPostTemplate>();
      const templates = (rawTemplates || []).filter((t) =>
        matchesTenantRow(t as unknown as Record<string, unknown>, tenantId)
      );

      let posted = 0;
      const errors: string[] = [];

      for (const template of templates) {
        try {
          const [cronDay, cronHour] = template.schedule_cron.split(' ');
          const matchDay = cronDay === '*' || parseInt(cronDay) === dayOfWeek;
          const matchHour = cronHour === '*' || parseInt(cronHour) === hour;

          if (!matchDay || !matchHour) {
            continue;
          }

          const content = await resolveTemplate(template.content_template, env, tenantId);

          const _result = await client.createPost({
            content,
            accounts: template.accounts ? JSON.parse(template.accounts) : []
          });

          const effectiveTenant = tenantId === '*' ? 'default' : tenantId;
          const nowIso = new Date().toISOString();
          try {
            await env.AURA_DB.prepare(
              'INSERT INTO mixpost_posts (content, status, platforms, source, created_at, tenant_id) VALUES (?, ?, ?, ?, ?, ?)'
            ).bind(content, 'published', template.accounts, 'auto', nowIso, effectiveTenant).run();
          } catch {
            await env.AURA_DB.prepare(
              'INSERT INTO mixpost_posts (content, status, platforms, source, created_at) VALUES (?, ?, ?, ?, ?)'
            ).bind(content, 'published', template.accounts, 'auto', nowIso).run();
          }

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

    const rawLimit = parseInt(url.searchParams.get('limit') || '20', 10);
    const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 100) : 20;
    const { results } = await env.AURA_DB.prepare(
      'SELECT * FROM mixpost_posts ORDER BY created_at DESC LIMIT ?'
    ).bind(Math.max(limit, 200)).all<Record<string, unknown>>();
    const filtered = (results || []).filter((r) => matchesTenantRow(r, tenantId)).slice(0, limit);

    return json({ success: true, data: filtered });
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
