import type { OpenAPIHono } from '@hono/zod-openapi';
import type { Env } from '../../types/env';
import { CronRoutes } from '../../schemas/cron';
import { getDatabase, matchesTenantRow } from '../../lib/db';
import { getTenantId, isHQSuperAdmin } from '../../middleware/tenant';
import { checkCronJobTenant } from './helpers';

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

export function registerSummaryHandlers(app: OpenAPIHono<{ Bindings: Env }>) {
  // GET /api/cron/summary - Get cron summary
  app.openapi(CronRoutes.summary as any, async (c: any) => {
    if (hasCrossTenantCronOverride(c)) {
      return c.json({ success: false, error: 'Cross-tenant access denied' }, 403);
    }
    const db = getDatabase(c);
    const query = c.req.valid('query');
    const { locationId, dateFrom, dateTo } = query;
    const tenantId = resolveOpenApiCronTenant(c);

    let whereClause = 'WHERE 1=1';
    const params: (string | number)[] = [];

    if (locationId) {
      whereClause += ' AND location_id = ?';
      params.push(locationId);
    }
    if (dateFrom) {
      whereClause += ' AND date(created_at) >= ?';
      params.push(dateFrom);
    }
    if (dateTo) {
      whereClause += ' AND date(created_at) <= ?';
      params.push(dateTo);
    }

    if (tenantId !== '*') {
      let rawJobs: Record<string, any>[] = [];
      try {
        const scopedJobsRes = await db.prepare(
          `SELECT * FROM cron_jobs ${whereClause} AND (COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ? OR location_id = ?) LIMIT 1000`
        ).bind(...params, tenantId, tenantId).all();
        rawJobs = ((scopedJobsRes as any)?.results || []) as Record<string, any>[];
        if (rawJobs.length === 0 && tenantId === 'default') {
          const allJobsRes = await db.prepare(
            `SELECT * FROM cron_jobs ${whereClause} LIMIT 1000`
          ).bind(...params).all().catch(() => ({ results: [] }));
          rawJobs = ((allJobsRes as any)?.results || []) as Record<string, any>[];
        }
      } catch {
        if (tenantId === 'default') {
          const allJobsRes = await db.prepare(
            `SELECT * FROM cron_jobs ${whereClause} LIMIT 1000`
          ).bind(...params).all().catch(() => ({ results: [] }));
          rawJobs = ((allJobsRes as any)?.results || []) as Record<string, any>[];
        } else {
          const locJobsRes = await db.prepare(
            `SELECT * FROM cron_jobs ${whereClause} AND location_id = ? LIMIT 1000`
          ).bind(...params, tenantId).all().catch(() => ({ results: [] }));
          rawJobs = ((locJobsRes as any)?.results || []) as Record<string, any>[];
        }
      }

      if (tenantId !== '*') {
        const tenantJobs: Record<string, any>[] = [];
        for (const j of rawJobs) {
          if (await checkCronJobTenant(db, j, tenantId)) {
            tenantJobs.push(j);
          }
        }
        const allowedJobIds = new Set(tenantJobs.map((j) => j.id));
        const jobsByStatus: Record<string, number> = {};
        let activeCount = 0;
        for (const j of tenantJobs) {
          if (j.is_active) activeCount += 1;
          const st = String(j.status || 'pending');
          jobsByStatus[st] = (jobsByStatus[st] || 0) + 1;
        }

        let runWhere = 'WHERE 1=1';
        const runParams: (string | number)[] = [];
        if (dateFrom) {
          runWhere += ' AND date(started_at) >= ?';
          runParams.push(dateFrom);
        }
        if (dateTo) {
          runWhere += ' AND date(started_at) <= ?';
          runParams.push(dateTo);
        }
        const matchesAllowedJobRun = (r: Record<string, any>): boolean => {
          if (!allowedJobIds.has(r.job_id)) return false;
          const runTenant = typeof r.tenant_id === 'string' ? r.tenant_id.trim() : '';
          return !runTenant || matchesTenantRow(r, tenantId);
        };
        let rawRuns: Record<string, any>[] = [];
        try {
          const scopedRunsRes = await db.prepare(
            `SELECT * FROM cron_runs ${runWhere} AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ? ORDER BY started_at DESC LIMIT 1000`
          ).bind(...runParams, tenantId).all();
          rawRuns = (((scopedRunsRes as any)?.results || []) as Record<string, any>[]).filter(matchesAllowedJobRun);
          if (rawRuns.length === 0 && allowedJobIds.size > 0) {
            const byJobRunsRes = await db.prepare(
              `SELECT * FROM cron_runs ${runWhere} AND job_id IN (SELECT id FROM cron_jobs WHERE COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ? OR location_id = ?) ORDER BY started_at DESC LIMIT 1000`
            ).bind(...runParams, tenantId, tenantId).all();
            rawRuns = (((byJobRunsRes as any)?.results || []) as Record<string, any>[]).filter(matchesAllowedJobRun);
          }
        } catch {
          if (tenantId === 'default' || allowedJobIds.size > 0) {
            const allRunsRes = await db.prepare(
              `SELECT * FROM cron_runs ${runWhere} ORDER BY started_at DESC LIMIT 1000`
            ).bind(...runParams).all().catch(() => ({ results: [] }));
            rawRuns = (((allRunsRes as any)?.results || []) as Record<string, any>[]).filter(matchesAllowedJobRun);
          } else {
            rawRuns = [];
          }
        }
        if (rawRuns.length === 0 && allowedJobIds.size > 0) {
          const allRunsRes = await db.prepare(
            `SELECT * FROM cron_runs ${runWhere} ORDER BY started_at DESC LIMIT 1000`
          ).bind(...runParams).all().catch(() => ({ results: [] }));
          rawRuns = (((allRunsRes as any)?.results || []) as Record<string, any>[]).filter(matchesAllowedJobRun);
        }

        let successfulRuns = 0;
        let failedRuns = 0;
        let timeoutRuns = 0;
        let durationSum = 0;
        let durationCount = 0;
        for (const r of rawRuns) {
          if (r.status === 'success') successfulRuns += 1;
          else if (r.status === 'failed') failedRuns += 1;
          else if (r.status === 'timeout') timeoutRuns += 1;
          if (typeof r.duration_ms === 'number') {
            durationSum += r.duration_ms;
            durationCount += 1;
          }
        }

        const jobNameById = new Map(tenantJobs.map((j) => [j.id, j.name]));
        const recentFailures = rawRuns
          .filter((r) => r.status === 'failed' || r.status === 'timeout')
          .slice(0, 10)
          .map((r) => ({
            id: r.id,
            jobId: r.job_id,
            jobName: jobNameById.get(r.job_id) || '',
            error: r.error,
            failedAt: r.started_at,
          }));

        return c.json({
          success: true,
          data: {
            totalJobs: tenantJobs.length,
            activeJobs: activeCount,
            jobsByStatus,
            totalRuns: rawRuns.length,
            successfulRuns,
            failedRuns,
            timeoutRuns,
            avgDurationMs: durationCount > 0 ? durationSum / durationCount : 0,
            recentFailures,
          },
        });
      }
    }

    // Total jobs
    const totalJobs = await db.prepare(
      `SELECT COUNT(*) as total FROM cron_jobs ${whereClause}`
    ).bind(...params).first().catch(() => ({ total: 0 }));

    // Active jobs
    const activeJobs = await db.prepare(
      `SELECT COUNT(*) as total FROM cron_jobs ${whereClause} AND is_active = 1`
    ).bind(...params).first().catch(() => ({ total: 0 }));

    // Jobs by status
    const jobsByStatus = await db.prepare(
      `SELECT status, COUNT(*) as count FROM cron_jobs ${whereClause} GROUP BY status`
    ).bind(...params).all().catch(() => ({ results: [] }));

    // Total runs
    let runWhere = 'WHERE 1=1';
    const runParams: (string | number)[] = [];
    if (locationId) {
      // Need to join with cron_jobs to filter by location
      runWhere += ' AND job_id IN (SELECT id FROM cron_jobs WHERE location_id = ?)';
      runParams.push(locationId);
    }
    if (dateFrom) {
      runWhere += ' AND date(started_at) >= ?';
      runParams.push(dateFrom);
    }
    if (dateTo) {
      runWhere += ' AND date(started_at) <= ?';
      runParams.push(dateTo);
    }

    const totalRuns = await db.prepare(
      `SELECT COUNT(*) as total,
              SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as successful,
              SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
              SUM(CASE WHEN status = 'timeout' THEN 1 ELSE 0 END) as timeout,
              AVG(duration_ms) as avg_duration_ms
       FROM cron_runs ${runWhere}`
    ).bind(...runParams).first().catch(() => ({ total: 0, successful: 0, failed: 0, timeout: 0, avg_duration_ms: 0 }));

    // Recent failures
    const recentFailures = await db.prepare(
      `SELECT cr.id, cr.job_id, cr.error, cr.started_at, cj.name as job_name
       FROM cron_runs cr
       JOIN cron_jobs cj ON cr.job_id = cj.id
       ${runWhere} AND cr.status IN ('failed', 'timeout')
       ORDER BY cr.started_at DESC
       LIMIT 10`
    ).bind(...runParams).all().catch(() => ({ results: [] }));

    const tJobs = totalJobs as any;
    const aJobs = activeJobs as any;
    const tRuns = totalRuns as any;
    const statResults = (jobsByStatus as any)?.results || [];
    const failResults = (recentFailures as any)?.results || [];

    return c.json({
      success: true,
      data: {
        totalJobs: tJobs?.total || 0,
        activeJobs: aJobs?.total || 0,
        jobsByStatus: statResults.reduce((acc: Record<string, number>, row: any) => {
          acc[row.status] = row.count;
          return acc;
        }, {} as Record<string, number>),
        totalRuns: tRuns?.total || 0,
        successfulRuns: tRuns?.successful || 0,
        failedRuns: tRuns?.failed || 0,
        timeoutRuns: tRuns?.timeout || 0,
        avgDurationMs: tRuns?.avg_duration_ms || 0,
        recentFailures: failResults.map((r: any) => ({
          id: r.id,
          jobId: r.job_id,
          jobName: r.job_name,
          error: r.error,
          failedAt: r.started_at,
        })),
      },
    });
  });
}

export const registerSummaryRoutes = registerSummaryHandlers;

