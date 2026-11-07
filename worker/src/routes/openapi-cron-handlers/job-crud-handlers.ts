import type { OpenAPIHono } from '@hono/zod-openapi';
import type { Env } from '../../types/env';
import { CronRoutes } from '../../schemas/cron';
import {
  formatJob,
  checkCronJobTenant,
  isAllowedCronLocationForTenant,
  hasExplicitCronTenantId,
  resolveCronEntityTenant,
} from './helpers';
import { getDatabase } from '../../lib/db';
import { getTenantId, isHQSuperAdmin } from '../../middleware/tenant';

function extractRequestedCronTenant(c: any): string {
  const candidates = [
    c.req?.query?.('tenant_id'),
    c.req?.query?.('tenantId'),
    c.req?.query?.('store_id'),
    c.req?.query?.('storeId'),
    c.req?.header?.('X-Tenant-ID'),
    c.req?.header?.('x-tenant-id'),
    c.req?.header?.('X-Store-ID'),
    c.req?.header?.('x-store-id'),
  ]
    .map((v) => (typeof v === 'string' ? v.trim() : ''))
    .filter(Boolean);
  if (new Set(candidates).size > 1) {
    return '__CONFLICT__';
  }
  return candidates[0] || '';
}

function hasCrossTenantCronOverride(c: any): boolean {
  const user = c.get?.('user') as { id?: string; role?: string; tenantId?: string; tenant_id?: string } | undefined;
  const headerOrQueryTenant = extractRequestedCronTenant(c);
  if (headerOrQueryTenant === '__CONFLICT__') return true;
  if (!user) return false;
  const userTenant = (user.tenantId ?? user.tenant_id ?? '').trim();
  const isHq = isHQSuperAdmin(user);
  if (isHq) return false;
  if (userTenant === '*' || userTenant.toLowerCase() === 'hq') return true;
  if (!headerOrQueryTenant) return false;
  if (headerOrQueryTenant === '*' || headerOrQueryTenant.toLowerCase() === 'hq') return true;
  const boundTenant = userTenant || 'default';
  return headerOrQueryTenant !== boundTenant;
}

function resolveOpenApiCronTenant(c: any): string {
  const user = c.get?.('user') as { id?: string; role?: string; tenantId?: string; tenant_id?: string } | undefined;
  const isHq = isHQSuperAdmin(user);
  const requested = extractRequestedCronTenant(c);
  const rawCtx = getTenantId(c).trim();
  if (isHq) {
    const chosen = requested && requested !== '__CONFLICT__' ? requested : (rawCtx || '*');
    return chosen.toLowerCase() === 'hq' || chosen === '*' ? '*' : chosen;
  }
  const userTenant = (user?.tenantId ?? user?.tenant_id ?? '').trim();
  const resolved = userTenant || rawCtx || 'default';
  return resolved.toLowerCase() === 'hq' ? '*' : resolved;
}

async function writeCronJobAuditLog(
  db: any,
  userId: string,
  action: string,
  entityId: string,
  metadata: string,
  now: string,
  tenantId = 'default'
): Promise<void> {
  const effectiveTenant = !tenantId || tenantId === '*' ? 'default' : tenantId;
  try {
    await db.prepare(
      `INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, metadata, tenant_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(`audit_${crypto.randomUUID()}`, userId, action, 'cron_job', entityId, metadata, effectiveTenant, now).run();
  } catch {
    try {
      await db.prepare(
        `INSERT INTO audit_logs (actor_id, actor_name, user_id, action, resource_type, resource_id, entity_type, entity_id, details, metadata, tenant_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(userId, userId, userId, action, 'cron_job', entityId, 'cron_job', entityId, metadata, metadata, effectiveTenant, now).run();
    } catch {
      try {
        await db.prepare(
          `INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, metadata, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        ).bind(`audit_${crypto.randomUUID()}`, userId, action, 'cron_job', entityId, metadata, now).run();
      } catch {
        try {
          await db.prepare(
            `INSERT INTO audit_logs (actor_id, actor_name, user_id, action, resource_type, resource_id, entity_type, entity_id, details, metadata, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          ).bind(userId, userId, userId, action, 'cron_job', entityId, 'cron_job', entityId, metadata, metadata, now).run();
        } catch {
          try {
            await db.prepare(
              `INSERT INTO audit_logs (actor_id, actor_name, action, resource_type, resource_id, details, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`
            ).bind(userId, userId, action, 'cron_job', entityId, metadata, now).run().catch(() => {});
          } catch {
            // Ignore audit log error
          }
        }
      }
      await db.prepare(
        'UPDATE audit_logs SET tenant_id = ? WHERE (entity_id = ? OR resource_id = ?) AND action = ? AND created_at = ?'
      ).bind(effectiveTenant, entityId, entityId, action, now).run().catch(() => {});
    }
  }
}

export function registerJobCrudHandlers(app: OpenAPIHono<{ Bindings: Env }>) {
  // GET /api/cron/jobs - List cron jobs
  app.openapi(CronRoutes.list as any, async (c: any) => {
    if (hasCrossTenantCronOverride(c)) {
      return c.json({ success: false, error: 'Cross-tenant access denied' }, 403);
    }
    const db = getDatabase(c);
    const query = c.req.valid('query');
    const { page = 1, limit = 20, sort = 'created_at', order = 'desc', status, locationId, isActive } = query;

    let whereClause = 'WHERE 1=1';
    const params: (string | number)[] = [];

    if (status) {
      whereClause += ' AND status = ?';
      params.push(status);
    }
    if (locationId) {
      whereClause += ' AND location_id = ?';
      params.push(locationId);
    }
    if (isActive !== undefined) {
      whereClause += ' AND is_active = ?';
      params.push(isActive ? 1 : 0);
    }

    let total = 0;
    let jobs: any[] = [];
    const tenantId = resolveOpenApiCronTenant(c);
    try {
      const offset = (page - 1) * limit;
      const allowedSorts: Record<string, string> = {
        name: 'name',
        next_run_at: 'next_run_at',
        nextRunAt: 'next_run_at',
        last_run_at: 'last_run_at',
        lastRunAt: 'last_run_at',
        created_at: 'created_at',
        createdAt: 'created_at',
        status: 'status',
      };
      const sortCol = allowedSorts[sort] || 'created_at';
      const sortDir = String(order).toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
      const orderClause = `${sortCol} ${sortDir}`;

      if (tenantId === '*') {
        const countResult = (await db.prepare(
          `SELECT COUNT(*) as total FROM cron_jobs ${whereClause}`
        ).bind(...params).first()) as { total: number } | null;
        total = countResult?.total || 0;

        const rows = (await db.prepare(
          `SELECT * FROM cron_jobs ${whereClause} ORDER BY ${orderClause} LIMIT ? OFFSET ?`
        ).bind(...params, limit, offset).all()) as { results: any[] };

        jobs = (rows.results || []).map(formatJob);
      } else {
        let rawList: any[] = [];
        try {
          const scopedRows = (await db.prepare(
            `SELECT * FROM cron_jobs ${whereClause} AND (COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ? OR location_id = ?) ORDER BY ${orderClause} LIMIT ? OFFSET ?`
          ).bind(...params, tenantId, tenantId, 1000, 0).all()) as { results: any[] };
          rawList = scopedRows.results || [];
          if (rawList.length === 0 && tenantId === 'default') {
            const fallbackRows = (await db.prepare(
              `SELECT * FROM cron_jobs ${whereClause} ORDER BY ${orderClause} LIMIT ? OFFSET ?`
            ).bind(...params, 1000, 0).all().catch(() => ({ results: [] }))) as { results: any[] };
            rawList = fallbackRows.results || [];
          }
        } catch {
          if (tenantId === 'default') {
            const rows = (await db.prepare(
              `SELECT * FROM cron_jobs ${whereClause} ORDER BY ${orderClause} LIMIT ? OFFSET ?`
            ).bind(...params, 1000, 0).all()) as { results: any[] };
            rawList = rows.results || [];
          } else {
            const locRows = (await db.prepare(
              `SELECT * FROM cron_jobs ${whereClause} AND location_id = ? ORDER BY ${orderClause} LIMIT ? OFFSET ?`
            ).bind(...params, tenantId, 1000, 0).all().catch(() => ({ results: [] }))) as { results: any[] };
            rawList = locRows.results || [];
          }
        }
        const scoped: any[] = [];
        for (const r of rawList) {
          if (await checkCronJobTenant(db, r, tenantId)) {
            scoped.push(r);
          }
        }
        total = scoped.length;
        jobs = scoped.slice(offset, offset + limit).map(formatJob);
      }
    } catch {
      total = 0;
      jobs = [];
    }

    return c.json({
      success: true,
      data: { jobs, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } },
    });
  });

  // GET /api/cron/jobs/:id - Get cron job by ID
  app.openapi(CronRoutes.get as any, async (c: any) => {
    if (hasCrossTenantCronOverride(c)) {
      return c.json({ success: false, error: 'Cross-tenant access denied' }, 403);
    }
    const db = getDatabase(c);
    const { id } = c.req.valid('param');
    const tenantId = resolveOpenApiCronTenant(c);

    let job: any = null;
    try {
      job = await db.prepare('SELECT * FROM cron_jobs WHERE id = ?').bind(id).first();
    } catch {
      job = null;
    }

    if (!job || !(await checkCronJobTenant(db, job, tenantId))) {
      return c.json({ success: false, error: 'Cron job not found' }, 404);
    }

    return c.json({
      success: true,
      data: formatJob(job),
    });
  });

  // POST /api/cron/jobs - Create cron job
  app.openapi(CronRoutes.create as any, async (c: any) => {
    if (hasCrossTenantCronOverride(c)) {
      return c.json({ success: false, error: 'Cross-tenant access denied' }, 403);
    }
    const db = getDatabase(c);
    const body = c.req.valid('json');
    const user = c.get('user');
    const tenantId = resolveOpenApiCronTenant(c);
    const effectiveTenant = tenantId === '*' ? 'default' : tenantId;
    const now = new Date().toISOString();

    const cronExpression = body.cronExpression || body.schedule?.cronExpression || '';
    const handler = body.handler || (body.payload as any)?.taskType || 'custom';

    // Validate cron expression format (basic check)
    const cronParts = cronExpression.trim().split(/\s+/);
    if (cronParts.length !== 5 && !cronExpression.startsWith('@')) {
      return c.json({ success: false, error: 'Invalid cron expression format (must have 5 parts)' }, 400);
    }

    const requestedLocationId = body.locationId || body.locationIds?.[0] || null;
    if (requestedLocationId && !(await isAllowedCronLocationForTenant(db, requestedLocationId, tenantId))) {
      return c.json({ success: false, error: 'Invalid location for tenant' }, 403);
    }

    const id = crypto.randomUUID();
    const rawPayloadObj =
      body.payload && typeof body.payload === 'object' && !Array.isArray(body.payload)
        ? { ...(body.payload as Record<string, unknown>) }
        : {};
    if (tenantId !== '*') {
      delete rawPayloadObj.tenantId;
      rawPayloadObj.tenant_id = tenantId;
    }
    const serializedPayload =
      body.payload !== undefined || tenantId !== '*' ? JSON.stringify(rawPayloadObj) : null;

    try {
      await db.prepare(
        `INSERT INTO cron_jobs (
          id, name, description, cron_expression, handler, payload,
          timeout_seconds, max_retries, retry_delay_seconds,
          is_active, status, location_id, created_by, tenant_id, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        id,
        body.name,
        body.description || null,
        cronExpression,
        handler,
        serializedPayload,
        body.timeoutSeconds || (body.payload as any)?.timeoutSeconds || 300,
        body.maxRetries || (body.payload as any)?.retries || 3,
        body.retryDelaySeconds || 60,
        body.isActive !== false ? 1 : 0,
        'pending',
        body.locationId || body.locationIds?.[0] || null,
        user.id,
        effectiveTenant,
        now,
        now
      ).run();
    } catch {
      if (tenantId === 'default') {
        await db.prepare(
          `INSERT INTO cron_jobs (
            id, name, description, cron_expression, handler, payload,
            timeout_seconds, max_retries, retry_delay_seconds,
            is_active, status, location_id, created_by, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
          id,
          body.name,
          body.description || null,
          cronExpression,
          handler,
          serializedPayload,
          body.timeoutSeconds || (body.payload as any)?.timeoutSeconds || 300,
          body.maxRetries || (body.payload as any)?.retries || 3,
          body.retryDelaySeconds || 60,
          body.isActive !== false ? 1 : 0,
          'pending',
          body.locationId || body.locationIds?.[0] || null,
          user.id,
          now,
          now
        ).run();
      } else {
        await db.prepare("ALTER TABLE cron_jobs ADD COLUMN tenant_id TEXT DEFAULT 'default'").run().catch(() => {});
        await db.prepare(
          `INSERT INTO cron_jobs (
            id, name, description, cron_expression, handler, payload,
            timeout_seconds, max_retries, retry_delay_seconds,
            is_active, status, location_id, created_by, tenant_id, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
          id,
          body.name,
          body.description || null,
          cronExpression,
          handler,
          serializedPayload,
          body.timeoutSeconds || (body.payload as any)?.timeoutSeconds || 300,
          body.maxRetries || (body.payload as any)?.retries || 3,
          body.retryDelaySeconds || 60,
          body.isActive !== false ? 1 : 0,
          'pending',
          body.locationId || body.locationIds?.[0] || null,
          user.id,
          effectiveTenant,
          now,
          now
        ).run();
      }
    }

    // Audit log
    await writeCronJobAuditLog(
      db,
      user.id,
      'cron_job_create',
      id,
      JSON.stringify({ ...body, tenant_id: effectiveTenant }),
      now,
      effectiveTenant
    );

    const job = await db.prepare('SELECT * FROM cron_jobs WHERE id = ?').bind(id).first();

    return c.json({
      success: true,
      data: formatJob(job!),
    }, 201);
  });

  // PUT /api/cron/jobs/:id - Update cron job
  app.openapi(CronRoutes.update as any, async (c: any) => {
    if (hasCrossTenantCronOverride(c)) {
      return c.json({ success: false, error: 'Cross-tenant access denied' }, 403);
    }
    const db = getDatabase(c);
    const { id } = c.req.valid('param');
    const body = c.req.valid('json');
    const user = c.get('user');
    const tenantId = resolveOpenApiCronTenant(c);
    const now = new Date().toISOString();

    const existing = await db.prepare('SELECT * FROM cron_jobs WHERE id = ?').bind(id).first().catch(() => null);
    if (!existing || !(await checkCronJobTenant(db, existing as any, tenantId))) {
      return c.json({ success: false, error: 'Cron job not found' }, 404);
    }

    // Validate cron expression if provided
    if (body.cronExpression) {
      const cronParts = body.cronExpression.split(' ');
      if (cronParts.length !== 5) {
        return c.json({ success: false, error: 'Invalid cron expression format (must have 5 parts)' }, 400);
      }
    }

    if (body.locationId !== undefined && body.locationId !== null && !(await isAllowedCronLocationForTenant(db, body.locationId, tenantId))) {
      return c.json({ success: false, error: 'Invalid location for tenant' }, 403);
    }

    const updates: string[] = [];
    const params: (string | number | null)[] = [];

    const fields: Array<{ key: string; db: string; transform?: (v: any) => any }> = [
      { key: 'name', db: 'name' },
      { key: 'description', db: 'description' },
      { key: 'cronExpression', db: 'cron_expression' },
      { key: 'handler', db: 'handler' },
      {
        key: 'payload',
        db: 'payload',
        transform: (v: any) => {
          if (tenantId !== '*' && v && typeof v === 'object' && !Array.isArray(v)) {
            const copy = { ...(v as Record<string, unknown>) };
            delete copy.tenantId;
            copy.tenant_id = tenantId;
            return JSON.stringify(copy);
          }
          return JSON.stringify(v);
        },
      },
      { key: 'timeoutSeconds', db: 'timeout_seconds' },
      { key: 'maxRetries', db: 'max_retries' },
      { key: 'retryDelaySeconds', db: 'retry_delay_seconds' },
      { key: 'isActive', db: 'is_active', transform: (v: any) => v ? 1 : 0 },
      { key: 'status', db: 'status' },
      { key: 'locationId', db: 'location_id' },
    ];

    for (const field of fields) {
      const value = body[field.key as keyof typeof body];
      if (value !== undefined) {
        updates.push(`${field.db} = ?`);
        params.push(field.transform ? field.transform(value) : value);
      }
    }

    updates.push('updated_at = ?');
    params.push(now);
    params.push(id);

    const effectiveTenant = tenantId === '*' ? (resolveCronEntityTenant(existing as any) || 'default') : tenantId;
    if (tenantId !== '*') {
      try {
        const upd = await db.prepare(
          `UPDATE cron_jobs SET ${updates.join(', ')} WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?`
        ).bind(...params, tenantId).run();
        if (
          tenantId === 'default' &&
          upd?.meta &&
          typeof upd.meta.changes === 'number' &&
          upd.meta.changes === 0 &&
          !hasExplicitCronTenantId(existing as any)
        ) {
          await db.prepare(
            `UPDATE cron_jobs SET ${updates.join(', ')} WHERE id = ? AND (tenant_id IS NULL OR TRIM(tenant_id) = '')`
          ).bind(...params).run();
        }
      } catch {
        if (tenantId === 'default' && !hasExplicitCronTenantId(existing as any)) {
          await db.prepare(`UPDATE cron_jobs SET ${updates.join(', ')} WHERE id = ?`).bind(...params).run();
        }
      }
    } else {
      try {
        const upd = await db.prepare(
          `UPDATE cron_jobs SET ${updates.join(', ')} WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?`
        ).bind(...params, effectiveTenant).run();
        if (
          effectiveTenant === 'default' &&
          upd?.meta &&
          typeof upd.meta.changes === 'number' &&
          upd.meta.changes === 0 &&
          !hasExplicitCronTenantId(existing as any)
        ) {
          await db.prepare(`UPDATE cron_jobs SET ${updates.join(', ')} WHERE id = ?`).bind(...params).run();
        }
      } catch {
        if (effectiveTenant === 'default' && !hasExplicitCronTenantId(existing as any)) {
          await db.prepare(`UPDATE cron_jobs SET ${updates.join(', ')} WHERE id = ?`).bind(...params).run();
        }
      }
    }

    // Audit log
    await writeCronJobAuditLog(db, user.id, 'cron_job_update', id, JSON.stringify({ ...body, tenant_id: effectiveTenant }), now, effectiveTenant);

    const job = await db.prepare('SELECT * FROM cron_jobs WHERE id = ?').bind(id).first();

    return c.json({
      success: true,
      data: formatJob(job!),
    });
  });

  // DELETE /api/cron/jobs/:id - Delete cron job
  app.openapi(CronRoutes.delete as any, async (c: any) => {
    if (hasCrossTenantCronOverride(c)) {
      return c.json({ success: false, error: 'Cross-tenant access denied' }, 403);
    }
    const db = getDatabase(c);
    const { id } = c.req.valid('param');
    const user = c.get('user');
    const tenantId = resolveOpenApiCronTenant(c);
    const now = new Date().toISOString();

    const existing = (await db.prepare('SELECT * FROM cron_jobs WHERE id = ?').bind(id).first().catch(() => null)) as any;
    if (!existing || !(await checkCronJobTenant(db, existing, tenantId))) {
      return c.json({ success: false, error: 'Cron job not found' }, 404);
    }

    const effectiveTenant = tenantId === '*' ? (resolveCronEntityTenant(existing as any) || 'default') : tenantId;
    if (tenantId !== '*') {
      try {
        const delRuns = await db.prepare(
          "DELETE FROM cron_runs WHERE job_id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
        ).bind(id, tenantId).run();
        if (tenantId === 'default' && delRuns?.meta && typeof delRuns.meta.changes === 'number' && delRuns.meta.changes === 0) {
          await db.prepare(
            "DELETE FROM cron_runs WHERE job_id = ? AND (tenant_id IS NULL OR TRIM(tenant_id) = '')"
          ).bind(id).run().catch(() => {
            if (tenantId === 'default' && !hasExplicitCronTenantId(existing)) {
              return db.prepare('DELETE FROM cron_runs WHERE job_id = ?').bind(id).run().catch(() => {});
            }
          });
        }
      } catch {
        if (tenantId === 'default' && !hasExplicitCronTenantId(existing)) {
          await db.prepare('DELETE FROM cron_runs WHERE job_id = ?').bind(id).run().catch(() => {});
        }
      }
      try {
        const delJob = await db.prepare(
          "DELETE FROM cron_jobs WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
        ).bind(id, tenantId).run();
        if (
          tenantId === 'default' &&
          delJob?.meta &&
          typeof delJob.meta.changes === 'number' &&
          delJob.meta.changes === 0 &&
          !hasExplicitCronTenantId(existing)
        ) {
          await db.prepare(
            "DELETE FROM cron_jobs WHERE id = ? AND (tenant_id IS NULL OR TRIM(tenant_id) = '')"
          ).bind(id).run();
        }
      } catch {
        if (tenantId === 'default' && !hasExplicitCronTenantId(existing)) {
          await db.prepare('DELETE FROM cron_jobs WHERE id = ?').bind(id).run();
        }
      }
    } else {
      await db.prepare(
        "DELETE FROM cron_runs WHERE job_id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
      ).bind(id, effectiveTenant).run().catch(async () => {
        if (effectiveTenant === 'default') {
          await db.prepare('DELETE FROM cron_runs WHERE job_id = ?').bind(id).run().catch(() => {});
        }
      });
      await db.prepare(
        "DELETE FROM cron_jobs WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
      ).bind(id, effectiveTenant).run().catch(async () => {
        if (effectiveTenant === 'default') {
          await db.prepare('DELETE FROM cron_jobs WHERE id = ?').bind(id).run();
        }
      });
    }

    // Audit log
    await writeCronJobAuditLog(db, user.id, 'cron_job_delete', id, JSON.stringify({ name: existing.name, tenant_id: effectiveTenant }), now, effectiveTenant);

    return c.json({ success: true, data: { deleted: true } });
  });
}
