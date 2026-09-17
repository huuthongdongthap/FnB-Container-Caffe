import type { OpenAPIHono } from '@hono/zod-openapi';
import type { Context } from 'hono';
import type { Env } from '../../types/env';
import { CronRoutes } from '../../schemas/cron';
import { formatJob } from './helpers';

export function registerJobCrudHandlers(app: OpenAPIHono<{ Bindings: Env }>) {
  // GET /api/cron/jobs - List cron jobs
  app.openapi(CronRoutes.list, async (c: Context<{ Bindings: Env }>) => {
    const db = c.env.AURA_DB;
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

    const countResult = await db.prepare(
      `SELECT COUNT(*) as total FROM cron_jobs ${whereClause}`
    ).bind(...params).first();
    const total = countResult?.total || 0;

    const offset = (page - 1) * limit;
    const orderClause = `${sort} ${order.toUpperCase()}`;
    const rows = await db.prepare(
      `SELECT * FROM cron_jobs ${whereClause} ORDER BY ${orderClause} LIMIT ? OFFSET ?`
    ).bind(...params, limit, offset).all();

    const jobs = rows.results.map(formatJob);

    return c.json({
      success: true,
      data: { jobs, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } },
    });
  });

  // GET /api/cron/jobs/:id - Get cron job by ID
  app.openapi(CronRoutes.get, async (c: Context<{ Bindings: Env }>) => {
    const db = c.env.AURA_DB;
    const { id } = c.req.valid('param');

    const job = await db.prepare('SELECT * FROM cron_jobs WHERE id = ?').bind(id).first();

    if (!job) {
      return c.json({ success: false, error: 'Cron job not found' }, 404);
    }

    return c.json({
      success: true,
      data: formatJob(job),
    });
  });

  // POST /api/cron/jobs - Create cron job
  app.openapi(CronRoutes.create, async (c: Context<{ Bindings: Env }>) => {
    const db = c.env.AURA_DB;
    const body = c.req.valid('json');
    const user = c.get('user');
    const now = new Date().toISOString();

    // Validate cron expression format (basic check)
    const cronParts = body.cronExpression.split(' ');
    if (cronParts.length !== 5) {
      return c.json({ success: false, error: 'Invalid cron expression format (must have 5 parts)' }, 400);
    }

    const id = crypto.randomUUID();

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
      body.cronExpression,
      body.handler,
      body.payload ? JSON.stringify(body.payload) : null,
      body.timeoutSeconds || 300,
      body.maxRetries || 3,
      body.retryDelaySeconds || 60,
      body.isActive !== false ? 1 : 0,
      'pending',
      body.locationId || null,
      user.id,
      now,
      now
    ).run();

    // Audit log
    await db.prepare(
      `INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, metadata, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(`audit_${Date.now()}`, user.id, 'cron_job_create', 'cron_job', id, JSON.stringify(body), now).run();

    const job = await db.prepare('SELECT * FROM cron_jobs WHERE id = ?').bind(id).first();

    return c.json({
      success: true,
      data: formatJob(job!),
    }, 201);
  });

  // PUT /api/cron/jobs/:id - Update cron job
  app.openapi(CronRoutes.update, async (c: Context<{ Bindings: Env }>) => {
    const db = c.env.AURA_DB;
    const { id } = c.req.valid('param');
    const body = c.req.valid('json');
    const user = c.get('user');
    const now = new Date().toISOString();

    const existing = await db.prepare('SELECT * FROM cron_jobs WHERE id = ?').bind(id).first();
    if (!existing) {
      return c.json({ success: false, error: 'Cron job not found' }, 404);
    }

    // Validate cron expression if provided
    if (body.cronExpression) {
      const cronParts = body.cronExpression.split(' ');
      if (cronParts.length !== 5) {
        return c.json({ success: false, error: 'Invalid cron expression format (must have 5 parts)' }, 400);
      }
    }

    const updates: string[] = [];
    const params: (string | number | null)[] = [];

    const fields = [
      { key: 'name', db: 'name' },
      { key: 'description', db: 'description' },
      { key: 'cronExpression', db: 'cron_expression' },
      { key: 'handler', db: 'handler' },
      { key: 'payload', db: 'payload', transform: (v: object) => JSON.stringify(v) },
      { key: 'timeoutSeconds', db: 'timeout_seconds' },
      { key: 'maxRetries', db: 'max_retries' },
      { key: 'retryDelaySeconds', db: 'retry_delay_seconds' },
      { key: 'isActive', db: 'is_active', transform: (v: boolean) => v ? 1 : 0 },
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

    await db.prepare(`UPDATE cron_jobs SET ${updates.join(', ')} WHERE id = ?`).bind(...params).run();

    // Audit log
    await db.prepare(
      `INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, metadata, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(`audit_${Date.now()}`, user.id, 'cron_job_update', 'cron_job', id, JSON.stringify(body), now).run();

    const job = await db.prepare('SELECT * FROM cron_jobs WHERE id = ?').bind(id).first();

    return c.json({
      success: true,
      data: formatJob(job!),
    });
  });

  // DELETE /api/cron/jobs/:id - Delete cron job
  app.openapi(CronRoutes.delete, async (c: Context<{ Bindings: Env }>) => {
    const db = c.env.AURA_DB;
    const { id } = c.req.valid('param');
    const user = c.get('user');
    const now = new Date().toISOString();

    const existing = await db.prepare('SELECT * FROM cron_jobs WHERE id = ?').bind(id).first();
    if (!existing) {
      return c.json({ success: false, error: 'Cron job not found' }, 404);
    }

    await db.prepare('DELETE FROM cron_jobs WHERE id = ?').bind(id).run();

    // Audit log
    await db.prepare(
      `INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, metadata, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(`audit_${Date.now()}`, user.id, 'cron_job_delete', 'cron_job', id, JSON.stringify({ name: existing.name }), now).run();

    return c.json({ success: true, data: { deleted: true } });
  });
}
