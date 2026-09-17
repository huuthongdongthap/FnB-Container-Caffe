import type { OpenAPIHono } from '@hono/zod-openapi';
import type { Context } from 'hono';
import type { Env } from '../../types/env';
import { CronRoutes } from '../../schemas/cron';
import { formatRun } from './helpers';

export function registerRunHandlers(app: OpenAPIHono<{ Bindings: Env }>) {
  // POST /api/cron/jobs/:id/trigger - Manually trigger cron job
  app.openapi(CronRoutes.trigger, async (c: Context<{ Bindings: Env }>) => {
    const db = c.env.AURA_DB;
    const { id } = c.req.valid('param');
    const body = c.req.valid('json');
    const user = c.get('user');
    const now = new Date().toISOString();

    const job = await db.prepare('SELECT * FROM cron_jobs WHERE id = ?').bind(id).first();
    if (!job) {
      return c.json({ success: false, error: 'Cron job not found' }, 404);
    }

    if (!job.is_active) {
      return c.json({ success: false, error: 'Cannot trigger inactive cron job' }, 400);
    }

    // Create run record
    const runId = crypto.randomUUID();
    await db.prepare(
      `INSERT INTO cron_runs (id, job_id, status, payload, started_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).bind(runId, id, 'running', body.payload ? JSON.stringify(body.payload) : job.payload, now, now).run();

    // Update job last_run_at and next_run_at
    await db.prepare(
      'UPDATE cron_jobs SET last_run_at = ?, last_status = \'running\', updated_at = ? WHERE id = ?'
    ).bind(now, now, id).run();

    // Audit log
    await db.prepare(
      `INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, metadata, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(`audit_${Date.now()}`, user.id, 'cron_job_trigger', 'cron_run', runId, JSON.stringify({ jobId: id, manual: true }), now).run();

    const run = await db.prepare('SELECT * FROM cron_runs WHERE id = ?').bind(runId).first();

    return c.json({
      success: true,
      data: formatRun(run!),
    });
  });

  // POST /api/cron/runs/:id/retry - Retry failed cron run
  app.openapi(CronRoutes.runs.retry, async (c: Context<{ Bindings: Env }>) => {
    const db = c.env.AURA_DB;
    const { id } = c.req.valid('param');
    const user = c.get('user');
    const now = new Date().toISOString();

    const run = await db.prepare('SELECT * FROM cron_runs WHERE id = ?').bind(id).first();
    if (!run) {
      return c.json({ success: false, error: 'Cron run not found' }, 404);
    }

    if (run.status !== 'failed' && run.status !== 'timeout') {
      return c.json({ success: false, error: 'Run not in failed state' }, 400);
    }

    // Create new run record as retry
    const newRunId = crypto.randomUUID();
    await db.prepare(
      `INSERT INTO cron_runs (id, job_id, status, payload, started_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).bind(newRunId, run.job_id, 'running', run.payload, now, now).run();

    // Update original run
    await db.prepare(
      'UPDATE cron_runs SET status = \'retried\', completed_at = ? WHERE id = ?'
    ).bind(now, id).run();

    // Update job status
    await db.prepare(
      'UPDATE cron_jobs SET last_run_at = ?, last_status = \'running\', updated_at = ? WHERE id = ?'
    ).bind(now, now, run.job_id).run();

    // Audit log
    await db.prepare(
      `INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, metadata, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(`audit_${Date.now()}`, user.id, 'cron_run_retry', 'cron_run', newRunId, JSON.stringify({ originalRunId: id, jobId: run.job_id }), now).run();

    const newRun = await db.prepare('SELECT * FROM cron_runs WHERE id = ?').bind(newRunId).first();

    return c.json({
      success: true,
      data: formatRun(newRun!),
    });
  });

  // GET /api/cron/jobs/:id/runs - List runs for a job
  app.openapi(CronRoutes.runs.list, async (c: Context<{ Bindings: Env }>) => {
    const db = c.env.AURA_DB;
    const { id } = c.req.valid('param');
    const query = c.req.valid('query');
    const { page = 1, limit = 20, sort = 'started_at', order = 'desc', status } = query;

    const job = await db.prepare('SELECT * FROM cron_jobs WHERE id = ?').bind(id).first();
    if (!job) {
      return c.json({ success: false, error: 'Cron job not found' }, 404);
    }

    let whereClause = 'WHERE job_id = ?';
    const params: (string | number)[] = [id];

    if (status) {
      whereClause += ' AND status = ?';
      params.push(status);
    }

    const countResult = await db.prepare(
      `SELECT COUNT(*) as total FROM cron_runs ${whereClause}`
    ).bind(...params).first();
    const total = countResult?.total || 0;

    const offset = (page - 1) * limit;
    const orderClause = `${sort} ${order.toUpperCase()}`;
    const rows = await db.prepare(
      `SELECT * FROM cron_runs ${whereClause} ORDER BY ${orderClause} LIMIT ? OFFSET ?`
    ).bind(...params, limit, offset).all();

    const runs = rows.results.map(formatRun);

    return c.json({
      success: true,
      data: { runs, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } },
    });
  });

  // GET /api/cron/runs/:id - Get cron run by ID
  app.openapi(CronRoutes.runs.get, async (c: Context<{ Bindings: Env }>) => {
    const db = c.env.AURA_DB;
    const { id } = c.req.valid('param');

    const run = await db.prepare('SELECT * FROM cron_runs WHERE id = ?').bind(id).first();

    if (!run) {
      return c.json({ success: false, error: 'Cron run not found' }, 404);
    }

    return c.json({
      success: true,
      data: formatRun(run),
    });
  });
}
