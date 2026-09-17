import type { OpenAPIHono } from '@hono/zod-openapi';
import type { Context } from 'hono';
import type { Env } from '../../types/env';
import { CronRoutes } from '../../schemas/cron';

export function registerSummaryHandlers(app: OpenAPIHono<{ Bindings: Env }>) {
  // GET /api/cron/summary - Get cron summary
  app.openapi(CronRoutes.summary, async (c: Context<{ Bindings: Env }>) => {
    const db = c.env.AURA_DB;
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

    return c.json({
      success: true,
      data: {
        totalJobs: totalJobs?.total || 0,
        activeJobs: activeJobs?.total || 0,
        jobsByStatus: jobsByStatus.results.reduce((acc, row) => {
          acc[row.status] = row.count;
          return acc;
        }, {} as Record<string, number>),
        totalRuns: totalRuns?.total || 0,
        successfulRuns: totalRuns?.successful || 0,
        failedRuns: totalRuns?.failed || 0,
        timeoutRuns: totalRuns?.timeout || 0,
        avgDurationMs: totalRuns?.avg_duration_ms || 0,
        recentFailures: recentFailures.results.map(r => ({
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
