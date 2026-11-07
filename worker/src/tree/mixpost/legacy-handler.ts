import { matchesTenantRow } from '../../lib/db';
import { createMixpostClient } from '../../lib/mixpost-client';
import { isSafeMixpostMediaUrl } from '../../lib/validators/mixpost';
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

export async function handleMixpostRequest(request: Request, env: MixpostEnv, resolvedTenantId?: string): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname.replace('/api/mixpost', '');
  const method = request.method;
  const rawHeaderTenant = (
    request.headers.get('X-Tenant-ID') ||
    request.headers.get('x-tenant-id') ||
    url.searchParams.get('tenant_id') ||
    url.searchParams.get('tenantId') ||
    ''
  ).trim();
  const safeHeaderTenant = rawHeaderTenant && rawHeaderTenant !== '*' ? rawHeaderTenant : '';
  const tenantId = (resolvedTenantId && resolvedTenantId.trim())
    ? resolvedTenantId.trim()
    : (safeHeaderTenant || 'default');

  const json = (data: unknown, status = 200): Response =>
    new Response(JSON.stringify(data), {
      status,
      headers: { 'Content-Type': 'application/json' }
    });

  if (
    resolvedTenantId &&
    resolvedTenantId.trim() &&
    resolvedTenantId.trim() !== '*' &&
    rawHeaderTenant &&
    (rawHeaderTenant === '*' || rawHeaderTenant !== resolvedTenantId.trim())
  ) {
    return json({ success: false, error: 'Cross-tenant access denied' }, 403);
  }

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
    if (Array.isArray(body.mediaUrls) && body.mediaUrls.some((u) => typeof u !== 'string' || !isSafeMixpostMediaUrl(u))) {
      return json({ success: false, error: 'Invalid or unsafe media URL' }, 400);
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
        } catch (insertErr) {
          if (effectiveTenant !== 'default') {
            throw insertErr;
          }
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

      let rawTemplates: AutoPostTemplate[] | undefined;
      let scopedTemplatesOk = false;
      if (tenantId !== '*') {
        try {
          const stmt = env.AURA_DB.prepare(
            "SELECT * FROM mixpost_templates WHERE is_active = 1 AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ? LIMIT 50"
          );
          const bound = typeof (stmt as unknown as { bind?: (...args: unknown[]) => typeof stmt }).bind === 'function'
            ? stmt.bind(tenantId)
            : stmt;
          const res = await bound.all<AutoPostTemplate>();
          rawTemplates = res.results;
          scopedTemplatesOk = true;
        } catch {
          scopedTemplatesOk = false;
        }
      }
      if (!scopedTemplatesOk && (tenantId === 'default' || tenantId === '*')) {
        const res = await env.AURA_DB.prepare(
          'SELECT * FROM mixpost_templates WHERE is_active = 1'
        ).all<AutoPostTemplate>();
        rawTemplates = res.results;
      }
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

          const rawTplTenant = typeof (template as unknown as Record<string, unknown>).tenant_id === 'string' &&
            ((template as unknown as Record<string, unknown>).tenant_id as string).trim() &&
            ((template as unknown as Record<string, unknown>).tenant_id as string).trim() !== '*'
            ? ((template as unknown as Record<string, unknown>).tenant_id as string).trim()
            : 'default';
          const effectiveTenant = tenantId === '*' ? rawTplTenant : tenantId;
          const content = await resolveTemplate(template.content_template, env, effectiveTenant);

          const _result = await client.createPost({
            content,
            accounts: template.accounts ? JSON.parse(template.accounts) : []
          });

          const nowIso = new Date().toISOString();
          try {
            await env.AURA_DB.prepare(
              'INSERT INTO mixpost_posts (content, status, platforms, source, created_at, tenant_id) VALUES (?, ?, ?, ?, ?, ?)'
            ).bind(content, 'published', template.accounts, 'auto', nowIso, effectiveTenant).run();
          } catch (insertErr) {
            if (effectiveTenant !== 'default') {
              throw insertErr;
            }
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
    let results: Record<string, unknown>[] | undefined;
    let scopedPostsOk = false;
    if (tenantId !== '*') {
      try {
        const res = await env.AURA_DB.prepare(
          "SELECT * FROM mixpost_posts WHERE COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ? ORDER BY created_at DESC LIMIT ?"
        ).bind(tenantId, Math.max(limit, 200)).all<Record<string, unknown>>();
        results = res.results;
        scopedPostsOk = true;
      } catch {
        scopedPostsOk = false;
      }
    }
    if (!scopedPostsOk && (tenantId === 'default' || tenantId === '*')) {
      const res = await env.AURA_DB.prepare(
        'SELECT * FROM mixpost_posts ORDER BY created_at DESC LIMIT ?'
      ).bind(Math.max(limit, 200)).all<Record<string, unknown>>();
      results = res.results;
    }
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
