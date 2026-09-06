import { OpenAPIHono } from "@hono/zod-openapi";
import type { Context } from "hono";
import { requireAuth } from "../middleware/auth";
import type { Env } from "../types/env";
import {
  CronRoutes,
  CronJobSchema,
  CronJobCreateSchema,
  CronJobUpdateSchema,
  CronRunSchema,
  CronJobListQuerySchema,
  CronRunListQuerySchema,
  CronTriggerSchema,
  CronRetrySchema,
} from "../schemas/cron";
import {
  SuccessResponseSchema,
  ErrorResponseSchema,
} from "../schemas/common";

export const openApiCronRouter = new OpenAPIHono<{ Bindings: Env }>();

// Apply auth middleware to all routes (owner/manager only for cron management)
openApiCronRouter.use("*", requireAuth(["owner", "manager"]));

// GET /api/cron/jobs - List cron jobs
openApiCronRouter.openapi(CronRoutes.list, async (c: Context<{ Bindings: Env }>) => {
  const db = c.env.AURA_DB;
  const query = c.req.valid("query");
  const { page = 1, limit = 20, sort = "created_at", order = "desc", status, locationId, isActive } = query;

  let whereClause = "WHERE 1=1";
  const params: (string | number)[] = [];

  if (status) {
    whereClause += ` AND status = ?`;
    params.push(status);
  }
  if (locationId) {
    whereClause += ` AND location_id = ?`;
    params.push(locationId);
  }
  if (isActive !== undefined) {
    whereClause += ` AND is_active = ?`;
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

  const jobs = rows.results.map(j => ({
    ...j,
    cronExpression: j.cron_expression,
    timeoutSeconds: j.timeout_seconds,
    maxRetries: j.max_retries,
    retryDelaySeconds: j.retry_delay_seconds,
    isActive: j.is_active,
    lastRunAt: j.last_run_at,
    nextRunAt: j.next_run_at,
    successCount: j.success_count,
    failureCount: j.failure_count,
    lastStatus: j.last_status,
    lastError: j.last_error,
    createdAt: j.created_at,
    updatedAt: j.updated_at,
  }));

  return c.json({
    success: true,
    data: { jobs, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } },
  });
});

// GET /api/cron/jobs/:id - Get cron job by ID
openApiCronRouter.openapi(CronRoutes.get, async (c: Context<{ Bindings: Env }>) => {
  const db = c.env.AURA_DB;
  const { id } = c.req.valid("param");

  const job = await db.prepare("SELECT * FROM cron_jobs WHERE id = ?").bind(id).first();

  if (!job) {
    return c.json({ success: false, error: "Cron job not found" }, 404);
  }

  return c.json({
    success: true,
    data: {
      ...job,
      cronExpression: job.cron_expression,
      timeoutSeconds: job.timeout_seconds,
      maxRetries: job.max_retries,
      retryDelaySeconds: job.retry_delay_seconds,
      isActive: job.is_active,
      lastRunAt: job.last_run_at,
      nextRunAt: job.next_run_at,
      successCount: job.success_count,
      failureCount: job.failure_count,
      lastStatus: job.last_status,
      lastError: job.last_error,
      createdAt: job.created_at,
      updatedAt: job.updated_at,
    },
  });
});

// POST /api/cron/jobs - Create cron job
openApiCronRouter.openapi(CronRoutes.create, async (c: Context<{ Bindings: Env }>) => {
  const db = c.env.AURA_DB;
  const body = c.req.valid("json");
  const user = c.get("user");
  const now = new Date().toISOString();

  // Validate cron expression format (basic check)
  const cronParts = body.cronExpression.split(" ");
  if (cronParts.length !== 5) {
    return c.json({ success: false, error: "Invalid cron expression format (must have 5 parts)" }, 400);
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
    "pending",
    body.locationId || null,
    user.id,
    now,
    now
  ).run();

  // Audit log
  await db.prepare(
    `INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, metadata, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(`audit_${Date.now()}`, user.id, "cron_job_create", "cron_job", id, JSON.stringify(body), now).run();

  const job = await db.prepare("SELECT * FROM cron_jobs WHERE id = ?").bind(id).first();

  return c.json({
    success: true,
    data: {
      ...job!,
      cronExpression: job!.cron_expression,
      timeoutSeconds: job!.timeout_seconds,
      maxRetries: job!.max_retries,
      retryDelaySeconds: job!.retry_delay_seconds,
      isActive: job!.is_active,
      lastRunAt: job!.last_run_at,
      nextRunAt: job!.next_run_at,
      successCount: job!.success_count,
      failureCount: job!.failure_count,
      lastStatus: job!.last_status,
      lastError: job!.last_error,
      createdAt: job!.created_at,
      updatedAt: job!.updated_at,
    },
  }, 201);
});

// PUT /api/cron/jobs/:id - Update cron job
openApiCronRouter.openapi(CronRoutes.update, async (c: Context<{ Bindings: Env }>) => {
  const db = c.env.AURA_DB;
  const { id } = c.req.valid("param");
  const body = c.req.valid("json");
  const user = c.get("user");
  const now = new Date().toISOString();

  const existing = await db.prepare("SELECT * FROM cron_jobs WHERE id = ?").bind(id).first();
  if (!existing) {
    return c.json({ success: false, error: "Cron job not found" }, 404);
  }

  // Validate cron expression if provided
  if (body.cronExpression) {
    const cronParts = body.cronExpression.split(" ");
    if (cronParts.length !== 5) {
      return c.json({ success: false, error: "Invalid cron expression format (must have 5 parts)" }, 400);
    }
  }

  const updates: string[] = [];
  const params: (string | number | null)[] = [];

  const fields = [
    { key: "name", db: "name" },
    { key: "description", db: "description" },
    { key: "cronExpression", db: "cron_expression" },
    { key: "handler", db: "handler" },
    { key: "payload", db: "payload", transform: (v: object) => JSON.stringify(v) },
    { key: "timeoutSeconds", db: "timeout_seconds" },
    { key: "maxRetries", db: "max_retries" },
    { key: "retryDelaySeconds", db: "retry_delay_seconds" },
    { key: "isActive", db: "is_active", transform: (v: boolean) => v ? 1 : 0 },
    { key: "status", db: "status" },
    { key: "locationId", db: "location_id" },
  ];

  for (const field of fields) {
    const value = body[field.key as keyof typeof body];
    if (value !== undefined) {
      updates.push(`${field.db} = ?`);
      params.push(field.transform ? field.transform(value) : value);
    }
  }

  updates.push("updated_at = ?");
  params.push(now);
  params.push(id);

  await db.prepare(`UPDATE cron_jobs SET ${updates.join(", ")} WHERE id = ?`).bind(...params).run();

  // Audit log
  await db.prepare(
    `INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, metadata, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(`audit_${Date.now()}`, user.id, "cron_job_update", "cron_job", id, JSON.stringify(body), now).run();

  const job = await db.prepare("SELECT * FROM cron_jobs WHERE id = ?").bind(id).first();

  return c.json({
    success: true,
    data: {
      ...job!,
      cronExpression: job!.cron_expression,
      timeoutSeconds: job!.timeout_seconds,
      maxRetries: job!.max_retries,
      retryDelaySeconds: job!.retry_delay_seconds,
      isActive: job!.is_active,
      lastRunAt: job!.last_run_at,
      nextRunAt: job!.next_run_at,
      successCount: job!.success_count,
      failureCount: job!.failure_count,
      lastStatus: job!.last_status,
      lastError: job!.last_error,
      createdAt: job!.created_at,
      updatedAt: job!.updated_at,
    },
  });
});

// DELETE /api/cron/jobs/:id - Delete cron job
openApiCronRouter.openapi(CronRoutes.delete, async (c: Context<{ Bindings: Env }>) => {
  const db = c.env.AURA_DB;
  const { id } = c.req.valid("param");
  const user = c.get("user");
  const now = new Date().toISOString();

  const existing = await db.prepare("SELECT * FROM cron_jobs WHERE id = ?").bind(id).first();
  if (!existing) {
    return c.json({ success: false, error: "Cron job not found" }, 404);
  }

  await db.prepare("DELETE FROM cron_jobs WHERE id = ?").bind(id).run();

  // Audit log
  await db.prepare(
    `INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, metadata, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(`audit_${Date.now()}`, user.id, "cron_job_delete", "cron_job", id, JSON.stringify({ name: existing.name }), now).run();

  return c.json({ success: true, data: { deleted: true } });
});

// POST /api/cron/jobs/:id/trigger - Manually trigger cron job
openApiCronRouter.openapi(CronRoutes.trigger, async (c: Context<{ Bindings: Env }>) => {
  const db = c.env.AURA_DB;
  const { id } = c.req.valid("param");
  const body = c.req.valid("json");
  const user = c.get("user");
  const now = new Date().toISOString();

  const job = await db.prepare("SELECT * FROM cron_jobs WHERE id = ?").bind(id).first();
  if (!job) {
    return c.json({ success: false, error: "Cron job not found" }, 404);
  }

  if (!job.is_active) {
    return c.json({ success: false, error: "Cannot trigger inactive cron job" }, 400);
  }

  // Create run record
  const runId = crypto.randomUUID();
  await db.prepare(
    `INSERT INTO cron_runs (id, job_id, status, payload, started_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).bind(runId, id, "running", body.payload ? JSON.stringify(body.payload) : job.payload, now, now).run();

  // Update job last_run_at and next_run_at
  await db.prepare(
    "UPDATE cron_jobs SET last_run_at = ?, last_status = 'running', updated_at = ? WHERE id = ?"
  ).bind(now, now, id).run();

  // Audit log
  await db.prepare(
    `INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, metadata, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(`audit_${Date.now()}`, user.id, "cron_job_trigger", "cron_run", runId, JSON.stringify({ jobId: id, manual: true }), now).run();

  // TODO: Actually execute the job handler here (async)
  // For now, we just create the run record and return

  const run = await db.prepare("SELECT * FROM cron_runs WHERE id = ?").bind(runId).first();

  return c.json({
    success: true,
    data: {
      ...run!,
      jobId: run!.job_id,
      startedAt: run!.started_at,
      completedAt: run!.completed_at,
      createdAt: run!.created_at,
    },
  });
});

// POST /api/cron/runs/:id/retry - Retry failed cron run
openApiCronRouter.openapi(CronRoutes.runs.retry, async (c: Context<{ Bindings: Env }>) => {
  const db = c.env.AURA_DB;
  const { id } = c.req.valid("param");
  const user = c.get("user");
  const now = new Date().toISOString();

  const run = await db.prepare("SELECT * FROM cron_runs WHERE id = ?").bind(id).first();
  if (!run) {
    return c.json({ success: false, error: "Cron run not found" }, 404);
  }

  if (run.status !== "failed" && run.status !== "timeout") {
    return c.json({ success: false, error: "Run not in failed state" }, 400);
  }

  // Create new run record as retry
  const newRunId = crypto.randomUUID();
  await db.prepare(
    `INSERT INTO cron_runs (id, job_id, status, payload, started_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).bind(newRunId, run.job_id, "running", run.payload, now, now).run();

  // Update original run
  await db.prepare(
    "UPDATE cron_runs SET status = 'retried', completed_at = ? WHERE id = ?"
  ).bind(now, id).run();

  // Update job status
  await db.prepare(
    "UPDATE cron_jobs SET last_run_at = ?, last_status = 'running', updated_at = ? WHERE id = ?"
  ).bind(now, now, run.job_id).run();

  // Audit log
  await db.prepare(
    `INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, metadata, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(`audit_${Date.now()}`, user.id, "cron_run_retry", "cron_run", newRunId, JSON.stringify({ originalRunId: id, jobId: run.job_id }), now).run();

  const newRun = await db.prepare("SELECT * FROM cron_runs WHERE id = ?").bind(newRunId).first();

  return c.json({
    success: true,
    data: {
      ...newRun!,
      jobId: newRun!.job_id,
      startedAt: newRun!.started_at,
      completedAt: newRun!.completed_at,
      createdAt: newRun!.created_at,
    },
  });
});

// GET /api/cron/jobs/:id/runs - List runs for a job
openApiCronRouter.openapi(CronRoutes.runs.list, async (c: Context<{ Bindings: Env }>) => {
  const db = c.env.AURA_DB;
  const { id } = c.req.valid("param");
  const query = c.req.valid("query");
  const { page = 1, limit = 20, sort = "started_at", order = "desc", status } = query;

  const job = await db.prepare("SELECT * FROM cron_jobs WHERE id = ?").bind(id).first();
  if (!job) {
    return c.json({ success: false, error: "Cron job not found" }, 404);
  }

  let whereClause = "WHERE job_id = ?";
  const params: (string | number)[] = [id];

  if (status) {
    whereClause += ` AND status = ?`;
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

  const runs = rows.results.map(r => ({
    ...r,
    jobId: r.job_id,
    startedAt: r.started_at,
    completedAt: r.completed_at,
    durationMs: r.duration_ms,
    createdAt: r.created_at,
  }));

  return c.json({
    success: true,
    data: { runs, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } },
  });
});

// GET /api/cron/runs/:id - Get cron run by ID
openApiCronRouter.openapi(CronRoutes.runs.get, async (c: Context<{ Bindings: Env }>) => {
  const db = c.env.AURA_DB;
  const { id } = c.req.valid("param");

  const run = await db.prepare("SELECT * FROM cron_runs WHERE id = ?").bind(id).first();

  if (!run) {
    return c.json({ success: false, error: "Cron run not found" }, 404);
  }

  return c.json({
    success: true,
    data: {
      ...run,
      jobId: run.job_id,
      startedAt: run.started_at,
      completedAt: run.completed_at,
      durationMs: run.duration_ms,
      createdAt: run.created_at,
    },
  });
});

// GET /api/cron/summary - Get cron summary
openApiCronRouter.openapi(CronRoutes.summary, async (c: Context<{ Bindings: Env }>) => {
  const db = c.env.AURA_DB;
  const query = c.req.valid("query");
  const { locationId, dateFrom, dateTo } = query;

  let whereClause = "WHERE 1=1";
  const params: (string | number)[] = [];

  if (locationId) {
    whereClause += ` AND location_id = ?`;
    params.push(locationId);
  }
  if (dateFrom) {
    whereClause += ` AND date(created_at) >= ?`;
    params.push(dateFrom);
  }
  if (dateTo) {
    whereClause += ` AND date(created_at) <= ?`;
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
  let runWhere = "WHERE 1=1";
  const runParams: (string | number)[] = [];
  if (locationId) {
    // Need to join with cron_jobs to filter by location
    runWhere += ` AND job_id IN (SELECT id FROM cron_jobs WHERE location_id = ?)`;
    runParams.push(locationId);
  }
  if (dateFrom) {
    runWhere += ` AND date(started_at) >= ?`;
    runParams.push(dateFrom);
  }
  if (dateTo) {
    runWhere += ` AND date(started_at) <= ?`;
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

export default openApiCronRouter;