import type { OpenAPIHono } from '@hono/zod-openapi';
import type { Env } from '../../types/env';
import { CronRoutes } from '../../schemas/cron';
import { getDatabase } from '../../lib/db';

export function registerSummaryHandlers(app: OpenAPIHono<{ Bindings: Env }>) {
  // GET /api/cron/summary - Get cron summary
  app.openapi(CronRoutes.summary as any, async (c: any) => {
    const db = getDatabase(c);
    const query = c.req.valid('query');
    const { locationId, dateFrom, dateTo } = query;

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

    // Total jobs
    const totalJobs = await db.prepare(
      `SELECT COUNT(*) as total FROM cron_jobs ${whereClause}`
    ).bind(...params).first();

    // Active jobs
    const activeJobs = await db.prepare(
      `SELECT COUNT(*) as total FROM cron_jobs ${whereClause} AND is_active = 1`
    ).bind(...params).first();

    // Jobs by status
    const jobsByStatus = await db.prepare(
      `SELECT status, COUNT(*) as count FROM cron_jobs ${whereClause} GROUP BY status`
    ).bind(...params).all();

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
    ).bind(...runParams).first();

    // Recent failures
    const recentFailures = await db.prepare(
      `SELECT cr.id, cr.job_id, cr.error, cr.started_at, cj.name as job_name
       FROM cron_runs cr
       JOIN cron_jobs cj ON cr.job_id = cj.id
       ${runWhere} AND cr.status IN ('failed', 'timeout')
       ORDER BY cr.started_at DESC
       LIMIT 10`
    ).bind(...runParams).all();

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
