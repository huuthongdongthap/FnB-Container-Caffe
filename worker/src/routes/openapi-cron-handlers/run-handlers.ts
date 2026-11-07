import type { OpenAPIHono } from '@hono/zod-openapi';
import type { Env } from '../../types/env';
import { CronRoutes } from '../../schemas/cron';
import {
  formatRun,
  checkCronJobTenant,
  ensureCronPayloadTenant,
  hasExplicitCronTenantId,
  matchesCronRunTenant,
  resolveCronEntityTenant,
} from './helpers';
import { getDatabase, matchesTenantRow } from '../../lib/db';
import { getTenantId, isHQSuperAdmin } from '../../middleware/tenant';

const ALLOWED_RUN_SORTS: Record<string, string> = {
  started_at: 'started_at', startedAt: 'started_at',
  completed_at: 'completed_at', completedAt: 'completed_at',
  duration_ms: 'duration_ms', durationMs: 'duration_ms', status: 'status',
};

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

async function writeCronRunAudit(
  db: any,
  userId: string,
  action: string,
  runId: string,
  metaStr: string,
  now: string,
  tenantId = 'default'
) {
  const effectiveTenant = !tenantId || tenantId === '*' ? 'default' : tenantId;
  try {
    await db.prepare(
      'INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, metadata, tenant_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind(`audit_${crypto.randomUUID()}`, userId, action, 'cron_run', runId, metaStr, effectiveTenant, now).run();
  } catch {
    try {
      await db.prepare(
        'INSERT INTO audit_logs (actor_id, actor_name, user_id, action, resource_type, resource_id, entity_type, entity_id, details, metadata, tenant_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
      ).bind(userId, userId, userId, action, 'cron_run', runId, 'cron_run', runId, metaStr, metaStr, effectiveTenant, now).run();
    } catch {
      try {
        await db.prepare(
          'INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, metadata, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
        ).bind(`audit_${crypto.randomUUID()}`, userId, action, 'cron_run', runId, metaStr, now).run();
      } catch {
        try {
          await db.prepare(
            'INSERT INTO audit_logs (actor_id, actor_name, user_id, action, resource_type, resource_id, entity_type, entity_id, details, metadata, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
          ).bind(userId, userId, userId, action, 'cron_run', runId, 'cron_run', runId, metaStr, metaStr, now).run();
        } catch {
          await db.prepare(
            'INSERT INTO audit_logs (actor_id, actor_name, action, resource_type, resource_id, details, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
          ).bind(userId, userId, action, 'cron_run', runId, metaStr, now).run().catch(() => {});
        }
      }
      await db.prepare(
        'UPDATE audit_logs SET tenant_id = ? WHERE (entity_id = ? OR resource_id = ?) AND action = ? AND created_at = ?'
      ).bind(effectiveTenant, runId, runId, action, now).run().catch(() => {});
    }
  }
}

export function registerRunHandlers(app: OpenAPIHono<{ Bindings: Env }>) {
  // POST /api/cron/jobs/:id/trigger - Manually trigger cron job
  app.openapi(CronRoutes.trigger as any, async (c: any) => {
    if (hasCrossTenantCronOverride(c)) {
      return c.json({ success: false, error: 'Cross-tenant access denied' }, 403);
    }
    const db = getDatabase(c);
    const { id } = c.req.valid('param');
    const body = c.req.valid('json');
    const user = c.get('user');
    const tenantId = resolveOpenApiCronTenant(c);
    const now = new Date().toISOString();

    const job = await db.prepare('SELECT * FROM cron_jobs WHERE id = ?').bind(id).first();
    if (!job || !(await checkCronJobTenant(db, job as any, tenantId))) {
      return c.json({ success: false, error: 'Cron job not found' }, 404);
    }
    if (!job.is_active) {
      return c.json({ success: false, error: 'Cannot trigger inactive cron job' }, 400);
    }

    const runId = crypto.randomUUID();
    const writeTenant = tenantId === '*' ? (resolveCronEntityTenant(job as any) || 'default') : tenantId;
    const runPayload: string | null = ensureCronPayloadTenant(
      body.payload !== undefined ? body.payload : (job.payload as string | null) ?? null,
      writeTenant
    );
    let usedMinimalCronRunSchema = false;
    try {
      await db.prepare(
        'INSERT INTO cron_runs (id, job_id, status, payload, tenant_id, started_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
      ).bind(runId, id, 'running', runPayload, writeTenant, now, now).run();
    } catch {
      try {
        await db.prepare(
          'INSERT INTO cron_runs (id, job_id, status, tenant_id, started_at) VALUES (?, ?, ?, ?, ?)'
        ).bind(runId, id, 'running', writeTenant, now).run();
        usedMinimalCronRunSchema = true;
      } catch {
        if (tenantId === 'default') {
          await db.prepare(
            'INSERT INTO cron_runs (id, job_id, status, payload, started_at, created_at) VALUES (?, ?, ?, ?, ?, ?)'
          ).bind(runId, id, 'running', runPayload, now, now).run().catch(async () => {
            await db.prepare(
              'INSERT INTO cron_runs (id, job_id, status, started_at) VALUES (?, ?, ?, ?)'
            ).bind(runId, id, 'running', now).run();
          });
        } else {
          await db.prepare("ALTER TABLE cron_runs ADD COLUMN tenant_id TEXT DEFAULT 'default'").run().catch(() => {});
          await db.prepare(
            'INSERT INTO cron_runs (id, job_id, status, payload, tenant_id, started_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
          ).bind(runId, id, 'running', runPayload, writeTenant, now, now).run().catch(async () => {
            await db.prepare(
              'INSERT INTO cron_runs (id, job_id, status, tenant_id, started_at) VALUES (?, ?, ?, ?, ?)'
            ).bind(runId, id, 'running', writeTenant, now).run();
          });
        }
      }
    }

    if (tenantId !== '*') {
      try {
        const updJob = await db.prepare(
          "UPDATE cron_jobs SET last_run_at = ?, last_status = 'running', updated_at = ? WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
        ).bind(now, now, id, tenantId).run();
        if (
          tenantId === 'default' &&
          updJob?.meta &&
          typeof updJob.meta.changes === 'number' &&
          updJob.meta.changes === 0 &&
          !hasExplicitCronTenantId(job as any)
        ) {
          await db.prepare(
            "UPDATE cron_jobs SET last_run_at = ?, last_status = 'running', updated_at = ? WHERE id = ? AND (tenant_id IS NULL OR TRIM(tenant_id) = '')"
          ).bind(now, now, id).run();
        }
      } catch {
        if (tenantId === 'default' && !hasExplicitCronTenantId(job as any)) {
          await db.prepare(
            "UPDATE cron_jobs SET last_run_at = ?, last_status = 'running', updated_at = ? WHERE id = ?"
          ).bind(now, now, id).run();
        }
      }
    } else {
      try {
        const updJob = await db.prepare(
          "UPDATE cron_jobs SET last_run_at = ?, last_status = 'running', updated_at = ? WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
        ).bind(now, now, id, writeTenant).run();
        if (
          writeTenant === 'default' &&
          updJob?.meta &&
          typeof updJob.meta.changes === 'number' &&
          updJob.meta.changes === 0 &&
          !hasExplicitCronTenantId(job as any)
        ) {
          await db.prepare(
            "UPDATE cron_jobs SET last_run_at = ?, last_status = 'running', updated_at = ? WHERE id = ?"
          ).bind(now, now, id).run();
        }
      } catch {
        if (writeTenant === 'default' && !hasExplicitCronTenantId(job as any)) {
          await db.prepare(
            "UPDATE cron_jobs SET last_run_at = ?, last_status = 'running', updated_at = ? WHERE id = ?"
          ).bind(now, now, id).run();
        }
      }
    }

    await writeCronRunAudit(
      db,
      user.id,
      'cron_job_trigger',
      runId,
      JSON.stringify({ jobId: id, manual: true, tenant_id: writeTenant }),
      now,
      writeTenant
    );

    const run = await db.prepare('SELECT * FROM cron_runs WHERE id = ?').bind(runId).first();
    return c.json({ success: true, data: formatRun(run!) }, usedMinimalCronRunSchema ? 201 : 200);
  });

  // POST /api/cron/runs/:id/retry - Retry failed cron run
  app.openapi(CronRoutes.runs.retry as any, async (c: any) => {
    if (hasCrossTenantCronOverride(c)) {
      return c.json({ success: false, error: 'Cross-tenant access denied' }, 403);
    }
    const db = getDatabase(c);
    const param = c.req.valid('param') as { id?: string; runId?: string };
    const id = param.id ?? param.runId ?? c.req.param('id') ?? c.req.param('runId');
    const user = c.get('user');
    const tenantId = resolveOpenApiCronTenant(c);
    const now = new Date().toISOString();

    const run = await db.prepare('SELECT * FROM cron_runs WHERE id = ?').bind(id).first();
    if (!run) return c.json({ success: false, error: 'Cron run not found' }, 404);

    let parentJob: Record<string, any> | null = null;
    if (tenantId !== '*') {
      if (!matchesCronRunTenant(run as any, tenantId)) {
        return c.json({ success: false, error: 'Cron run not found' }, 404);
      }
      parentJob = (await db.prepare('SELECT * FROM cron_jobs WHERE id = ?').bind(run.job_id).first().catch(() => null)) as Record<string, any> | null;
      const allowed = parentJob
        ? await checkCronJobTenant(db, parentJob as any, tenantId)
        : await checkCronJobTenant(db, run as any, tenantId);
      if (!allowed) {
        return c.json({ success: false, error: 'Cron run not found' }, 404);
      }
    }

    if (run.status !== 'failed' && run.status !== 'timeout') {
      return c.json({ success: false, error: 'Run not in failed state' }, 400);
    }

    if (!parentJob && run.job_id) {
      parentJob = (await db.prepare('SELECT * FROM cron_jobs WHERE id = ?').bind(run.job_id).first().catch(() => null)) as Record<string, any> | null;
    }
    const newRunId = crypto.randomUUID();
    const writeTenant = tenantId === '*' ? (resolveCronEntityTenant(run as any, parentJob) || 'default') : tenantId;
    const retryPayload = ensureCronPayloadTenant(run.payload, writeTenant);
    try {
      await db.prepare(
        'INSERT INTO cron_runs (id, job_id, status, payload, tenant_id, started_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
      ).bind(newRunId, run.job_id, 'running', retryPayload, writeTenant, now, now).run();
    } catch {
      if (tenantId === 'default') {
        await db.prepare(
          'INSERT INTO cron_runs (id, job_id, status, payload, started_at, created_at) VALUES (?, ?, ?, ?, ?, ?)'
        ).bind(newRunId, run.job_id, 'running', retryPayload, now, now).run();
      } else {
        await db.prepare("ALTER TABLE cron_runs ADD COLUMN tenant_id TEXT DEFAULT 'default'").run().catch(() => {});
        await db.prepare(
          'INSERT INTO cron_runs (id, job_id, status, payload, tenant_id, started_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
        ).bind(newRunId, run.job_id, 'running', retryPayload, writeTenant, now, now).run();
      }
    }

    if (tenantId !== '*') {
      try {
        const updRun = await db.prepare(
          "UPDATE cron_runs SET status = 'retried', completed_at = ? WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
        ).bind(now, id, tenantId).run();
        if (
          tenantId === 'default' &&
          updRun?.meta &&
          typeof updRun.meta.changes === 'number' &&
          updRun.meta.changes === 0 &&
          !hasExplicitCronTenantId(run as any)
        ) {
          await db.prepare(
            "UPDATE cron_runs SET status = 'retried', completed_at = ? WHERE id = ? AND (tenant_id IS NULL OR TRIM(tenant_id) = '')"
          ).bind(now, id).run();
        }
      } catch {
        if (tenantId === 'default' && !hasExplicitCronTenantId(run as any)) {
          await db.prepare("UPDATE cron_runs SET status = 'retried', completed_at = ? WHERE id = ?").bind(now, id).run();
        }
      }
      try {
        const updJob = await db.prepare(
          "UPDATE cron_jobs SET last_run_at = ?, last_status = 'running', updated_at = ? WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
        ).bind(now, now, run.job_id, tenantId).run();
        if (
          tenantId === 'default' &&
          updJob?.meta &&
          typeof updJob.meta.changes === 'number' &&
          updJob.meta.changes === 0 &&
          !hasExplicitCronTenantId(parentJob)
        ) {
          await db.prepare(
            "UPDATE cron_jobs SET last_run_at = ?, last_status = 'running', updated_at = ? WHERE id = ? AND (tenant_id IS NULL OR TRIM(tenant_id) = '')"
          ).bind(now, now, run.job_id).run();
        }
      } catch {
        if (tenantId === 'default' && !hasExplicitCronTenantId(parentJob)) {
          await db.prepare(
            "UPDATE cron_jobs SET last_run_at = ?, last_status = 'running', updated_at = ? WHERE id = ?"
          ).bind(now, now, run.job_id).run();
        }
      }
    } else {
      try {
        const updRun = await db.prepare(
          "UPDATE cron_runs SET status = 'retried', completed_at = ? WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
        ).bind(now, id, writeTenant).run();
        if (
          writeTenant === 'default' &&
          updRun?.meta &&
          typeof updRun.meta.changes === 'number' &&
          updRun.meta.changes === 0 &&
          !hasExplicitCronTenantId(run as any)
        ) {
          await db.prepare("UPDATE cron_runs SET status = 'retried', completed_at = ? WHERE id = ?").bind(now, id).run();
        }
      } catch {
        if (writeTenant === 'default' && !hasExplicitCronTenantId(run as any)) {
          await db.prepare("UPDATE cron_runs SET status = 'retried', completed_at = ? WHERE id = ?").bind(now, id).run();
        }
      }
      try {
        const updJob = await db.prepare(
          "UPDATE cron_jobs SET last_run_at = ?, last_status = 'running', updated_at = ? WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
        ).bind(now, now, run.job_id, writeTenant).run();
        if (
          writeTenant === 'default' &&
          updJob?.meta &&
          typeof updJob.meta.changes === 'number' &&
          updJob.meta.changes === 0 &&
          !hasExplicitCronTenantId(parentJob)
        ) {
          await db.prepare(
            "UPDATE cron_jobs SET last_run_at = ?, last_status = 'running', updated_at = ? WHERE id = ?"
          ).bind(now, now, run.job_id).run();
        }
      } catch {
        if (writeTenant === 'default' && !hasExplicitCronTenantId(parentJob)) {
          await db.prepare(
            "UPDATE cron_jobs SET last_run_at = ?, last_status = 'running', updated_at = ? WHERE id = ?"
          ).bind(now, now, run.job_id).run();
        }
      }
    }

    await writeCronRunAudit(
      db,
      user.id,
      'cron_run_retry',
      newRunId,
      JSON.stringify({ originalRunId: id, jobId: run.job_id, tenant_id: writeTenant }),
      now,
      writeTenant
    );

    const newRun = await db.prepare('SELECT * FROM cron_runs WHERE id = ?').bind(newRunId).first();
    return c.json({ success: true, data: formatRun(newRun!) });
  });

  // GET /api/cron/jobs/:id/runs - List runs for a job
  app.openapi(CronRoutes.runs.list as any, async (c: any) => {
    if (hasCrossTenantCronOverride(c)) {
      return c.json({ success: false, error: 'Cross-tenant access denied' }, 403);
    }
    const db = getDatabase(c);
    const { id } = c.req.valid('param');
    const query = c.req.valid('query');
    const { page = 1, limit = 20, sort = 'started_at', order = 'desc', status } = query;
    const tenantId = resolveOpenApiCronTenant(c);

    const job = await db.prepare('SELECT * FROM cron_jobs WHERE id = ?').bind(id).first().catch(() => null);
    if (!job || !(await checkCronJobTenant(db, job as any, tenantId))) {
      return c.json({ success: false, error: 'Cron job not found' }, 404);
    }

    let whereClause = 'WHERE job_id = ?';
    const params: (string | number)[] = [id];
    if (status) { whereClause += ' AND status = ?'; params.push(status); }

    let total = 0;
    let runs: any[] = [];
    try {
      const offset = (page - 1) * limit;
      const sortCol = ALLOWED_RUN_SORTS[sort] || 'started_at';
      const sortDir = String(order).toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

      let rowsList: any[] = [];
      let usedScopedQuery = false;
      if (tenantId !== '*') {
        try {
          const scopedCount = (await db.prepare(
            `SELECT COUNT(*) as total FROM cron_runs ${whereClause} AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?`
          ).bind(...params, tenantId).first()) as { total: number } | null;
          const scopedRows = (await db.prepare(
            `SELECT * FROM cron_runs ${whereClause} AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ? ORDER BY ${sortCol} ${sortDir} LIMIT ? OFFSET ?`
          ).bind(...params, tenantId, limit, offset).all()) as { results: any[] };
          const rawScoped = scopedRows.results || [];
          const filteredScoped = rawScoped
            .filter((r: any) => matchesTenantRow(r, tenantId))
            .filter((r: any) => matchesCronRunTenant(r, tenantId, id));
          total = filteredScoped.length !== rawScoped.length ? filteredScoped.length : (scopedCount?.total || filteredScoped.length);
          rowsList = filteredScoped;
          usedScopedQuery = true;
        } catch {
          rowsList = [];
        }
      }

      if (tenantId === '*' || (tenantId === 'default' && (!usedScopedQuery || (rowsList.length === 0 && total === 0)))) {
        const countResult = (await db.prepare(`SELECT COUNT(*) as total FROM cron_runs ${whereClause}`).bind(...params).first()) as { total: number } | null;
        total = countResult?.total || 0;
        const rows = (await db.prepare(
          `SELECT * FROM cron_runs ${whereClause} ORDER BY ${sortCol} ${sortDir} LIMIT ? OFFSET ?`
        ).bind(...params, limit, offset).all()) as { results: any[] };
        rowsList = rows.results || [];
        if (tenantId !== '*') {
          rowsList = rowsList
            .filter((r: any) => matchesTenantRow(r, tenantId))
            .filter((r: any) => matchesCronRunTenant(r, tenantId, id));
          total = rowsList.length;
        }
      }

      runs = rowsList.map(formatRun);
    } catch {
      total = 0;
      runs = [];
    }

    return c.json({
      success: true,
      data: { runs, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } },
    });
  });

  // GET /api/cron/runs/:id - Get cron run by ID
  app.openapi(CronRoutes.runs.get as any, async (c: any) => {
    if (hasCrossTenantCronOverride(c)) {
      return c.json({ success: false, error: 'Cross-tenant access denied' }, 403);
    }
    const db = getDatabase(c);
    const param = c.req.valid('param') as { id?: string; runId?: string };
    const id = param.id ?? param.runId ?? c.req.param('id') ?? c.req.param('runId');
    const tenantId = resolveOpenApiCronTenant(c);

    const run = await db.prepare('SELECT * FROM cron_runs WHERE id = ?').bind(id).first().catch(() => null);
    if (!run) return c.json({ success: false, error: 'Cron run not found' }, 404);

    if (tenantId !== '*') {
      if (!matchesCronRunTenant(run as any, tenantId)) {
        return c.json({ success: false, error: 'Cron run not found' }, 404);
      }
      const parentJob = await db.prepare('SELECT * FROM cron_jobs WHERE id = ?').bind((run as any).job_id).first().catch(() => null);
      const allowed = parentJob
        ? await checkCronJobTenant(db, parentJob as any, tenantId)
        : await checkCronJobTenant(db, run as any, tenantId);
      if (!allowed) {
        return c.json({ success: false, error: 'Cron run not found' }, 404);
      }
    }

    return c.json({ success: true, data: formatRun(run) });
  });
}
