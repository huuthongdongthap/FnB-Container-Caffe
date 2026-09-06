import { z } from 'zod';
import { openapi } from '@hono/zod-openapi';
import {
  PaginationQuerySchema,
  PaginationMetaSchema,
  SuccessResponseSchema,
  ErrorResponseSchema,
  IdParamsSchema,
  LocaleEnum,
  DateTimeSchema,
  ReferenceSchema,
} from './common';

/**
 * Cron job / Scheduled task schemas
 */

export const CronJobScheduleSchema = z.object({
  cronExpression: z.string().regex(/^(@(annually|yearly|monthly|weekly|daily|hourly)|(\*|(\d+,?)+) (\*|(\d+,?)+) (\*|(\d+,?)+) (\*|(\d+,?)+) (\*|(\d+,?)+))$/),
  timezone: z.string().default('Asia/Ho_Chi_Minh'),
  startAt: z.string().datetime().optional(),
  endAt: z.string().datetime().optional(),
});

export const CronJobPayloadSchema = z.object({
  taskType: z.enum([
    'sync_inventory',
    'process_orders',
    'send_notifications',
    'generate_reports',
    'cleanup_sessions',
    'expire_promotions',
    'process_loyalty',
    'sync_payments',
    'backup_database',
    'custom',
  ]),
  payload: z.record(z.unknown()).optional(),
  priority: z.enum(['low', 'normal', 'high', 'critical']).default('normal'),
  retries: z.number().int().min(0).max(10).default(3),
  timeoutSeconds: z.number().int().positive().max(3600).default(300),
});

export const CronJobCreateSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  schedule: CronJobScheduleSchema,
  payload: CronJobPayloadSchema,
  isActive: z.boolean().default(true),
  locationIds: z.array(z.string().uuid()).optional(),
  metadata: z.record(z.unknown()).optional(),
}).openapi('CronJobCreate');

export const CronJobUpdateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  schedule: CronJobScheduleSchema.optional(),
  payload: CronJobPayloadSchema.optional(),
  isActive: z.boolean().optional(),
  locationIds: z.array(z.string().uuid()).optional(),
  metadata: z.record(z.unknown()).optional(),
}).openapi('CronJobUpdate');

export const CronJobResponseSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  schedule: CronJobScheduleSchema,
  payload: CronJobPayloadSchema,
  isActive: z.boolean(),
  locationIds: z.array(z.string().uuid()),
  locations: z.array(ReferenceSchema).optional(),
  metadata: z.record(z.unknown()).nullable(),
  lastRunAt: DateTimeSchema.nullable(),
  nextRunAt: DateTimeSchema.nullable(),
  runCount: z.number().int().nonnegative().default(0),
  successCount: z.number().int().nonnegative().default(0),
  failureCount: z.number().int().nonnegative().default(0),
  lastStatus: z.enum(['pending', 'running', 'success', 'failed', 'timeout']).nullable(),
  lastError: z.string().nullable(),
  createdAt: DateTimeSchema,
  updatedAt: DateTimeSchema,
}).openapi('CronJob');

export const CronJobListResponseSchema = z.object({
  jobs: z.array(CronJobResponseSchema),
  meta: PaginationMetaSchema,
}).openapi('CronJobListResponse');

export const CronJobRunSchema = z.object({
  id: z.string().uuid(),
  cronJobId: z.string().uuid(),
  cronJob: ReferenceSchema.nullable().optional(),
  status: z.enum(['pending', 'running', 'success', 'failed', 'timeout']),
  startedAt: DateTimeSchema,
  completedAt: DateTimeSchema.nullable(),
  durationMs: z.number().int().nonnegative().nullable(),
  output: z.string().nullable(),
  error: z.string().nullable(),
  retryCount: z.number().int().nonnegative().default(0),
  payload: CronJobPayloadSchema,
  metadata: z.record(z.unknown()).nullable(),
}).openapi('CronJobRun');

export const CronJobRunListResponseSchema = z.object({
  runs: z.array(CronJobRunSchema),
  meta: PaginationMetaSchema,
}).openapi('CronJobRunListResponse');

export const CronJobTriggerSchema = z.object({
  payload: z.record(z.unknown()).optional(),
  idempotencyKey: z.string().uuid().optional(),
}).openapi('CronJobTrigger');

export const CronJobSummarySchema = z.object({
  totalJobs: z.number().int().nonnegative(),
  activeJobs: z.number().int().nonnegative(),
  totalRuns: z.number().int().nonnegative(),
  successfulRuns: z.number().int().nonnegative(),
  failedRuns: z.number().int().nonnegative(),
  avgDurationMs: z.number().nonnegative(),
  byStatus: z.record(
    z.enum(['pending', 'running', 'success', 'failed', 'timeout']),
    z.number().int().nonnegative()
  ),
  byTaskType: z.record(
    z.enum([
      'sync_inventory',
      'process_orders',
      'send_notifications',
      'generate_reports',
      'cleanup_sessions',
      'expire_promotions',
      'process_loyalty',
      'sync_payments',
      'backup_database',
      'custom',
    ]),
    z.object({
      count: z.number().int().nonnegative(),
      successRate: z.number().min(0).max(100),
    })
  ),
  recentFailures: z.array(
    z.object({
      id: z.string().uuid(),
      name: z.string(),
      error: z.string(),
      failedAt: DateTimeSchema,
    })
  ),
}).openapi('CronJobSummary');

// Export types
export type CronJobSchedule = z.infer<typeof CronJobScheduleSchema>;
export type CronJobPayload = z.infer<typeof CronJobPayloadSchema>;
export type CronJobCreate = z.infer<typeof CronJobCreateSchema>;
export type CronJobUpdate = z.infer<typeof CronJobUpdateSchema>;
export type CronJobResponse = z.infer<typeof CronJobResponseSchema>;
export type CronJobListResponse = z.infer<typeof CronJobListResponseSchema>;
export type CronJobRun = z.infer<typeof CronJobRunSchema>;
export type CronJobRunListResponse = z.infer<typeof CronJobRunListResponseSchema>;
export type CronJobTrigger = z.infer<typeof CronJobTriggerSchema>;
export type CronJobSummary = z.infer<typeof CronJobSummarySchema>;

// OpenAPI route definitions
export const CronRoutes = {
  list: {
    method: 'get',
    path: '/api/cron/jobs',
    summary: 'List cron jobs with pagination and filtering',
    tags: ['Cron'],
    security: [{ BearerAuth: [] }],
    request: {
      query: PaginationQuerySchema.extend({
        isActive: z.coerce.boolean().optional(),
        taskType: z.enum([
          'sync_inventory',
          'process_orders',
          'send_notifications',
          'generate_reports',
          'cleanup_sessions',
          'expire_promotions',
          'process_loyalty',
          'sync_payments',
          'backup_database',
          'custom',
        ]).optional(),
        locationId: z.string().uuid().optional(),
      }),
    },
    responses: {
      200: {
        description: 'Cron job list',
        content: {
          'application/json': { schema: SuccessResponseSchema(CronJobListResponseSchema) },
        },
      },
      400: {
        description: 'Invalid query',
        content: { 'application/json': { schema: ErrorResponseSchema } },
      },
    },
  },
  get: {
    method: 'get',
    path: '/api/cron/jobs/{id}',
    summary: 'Get cron job by ID',
    tags: ['Cron'],
    security: [{ BearerAuth: [] }],
    request: { params: IdParamsSchema },
    responses: {
      200: {
        description: 'Cron job details',
        content: {
          'application/json': { schema: SuccessResponseSchema(CronJobResponseSchema) },
        },
      },
      404: {
        description: 'Not found',
        content: { 'application/json': { schema: ErrorResponseSchema } },
      },
    },
  },
  create: {
    method: 'post',
    path: '/api/cron/jobs',
    summary: 'Create new cron job',
    tags: ['Cron'],
    security: [{ BearerAuth: [] }],
    request: { body: { content: { 'application/json': { schema: CronJobCreateSchema } } } },
    responses: {
      201: {
        description: 'Created',
        content: {
          'application/json': { schema: SuccessResponseSchema(CronJobResponseSchema) },
        },
      },
      400: {
        description: 'Validation error',
        content: { 'application/json': { schema: ErrorResponseSchema } },
      },
    },
  },
  update: {
    method: 'patch',
    path: '/api/cron/jobs/{id}',
    summary: 'Update cron job',
    tags: ['Cron'],
    security: [{ BearerAuth: [] }],
    request: {
      params: IdParamsSchema,
      body: { content: { 'application/json': { schema: CronJobUpdateSchema } } },
    },
    responses: {
      200: {
        description: 'Updated',
        content: {
          'application/json': { schema: SuccessResponseSchema(CronJobResponseSchema) },
        },
      },
      404: {
        description: 'Not found',
        content: { 'application/json': { schema: ErrorResponseSchema } },
      },
    },
  },
  delete: {
    method: 'delete',
    path: '/api/cron/jobs/{id}',
    summary: 'Delete cron job',
    tags: ['Cron'],
    security: [{ BearerAuth: [] }],
    request: { params: IdParamsSchema },
    responses: {
      200: {
        description: 'Deleted',
        content: {
          'application/json': { schema: SuccessResponseSchema(z.object({ success: z.literal(true) })) },
        },
      },
      404: {
        description: 'Not found',
        content: { 'application/json': { schema: ErrorResponseSchema } },
      },
    },
  },
  trigger: {
    method: 'post',
    path: '/api/cron/jobs/{id}/trigger',
    summary: 'Manually trigger cron job',
    tags: ['Cron'],
    security: [{ BearerAuth: [] }],
    request: {
      params: IdParamsSchema,
      body: { content: { 'application/json': { schema: CronJobTriggerSchema } } },
    },
    responses: {
      200: {
        description: 'Triggered',
        content: {
          'application/json': { schema: SuccessResponseSchema(CronJobRunSchema) },
        },
      },
      404: {
        description: 'Not found',
        content: { 'application/json': { schema: ErrorResponseSchema } },
      },
      409: {
        description: 'Job already running',
        content: { 'application/json': { schema: ErrorResponseSchema } },
      },
    },
  },
  runs: {
    list: {
      method: 'get',
      path: '/api/cron/jobs/{id}/runs',
      summary: 'List cron job runs',
      tags: ['Cron'],
      security: [{ BearerAuth: [] }],
      request: {
        params: IdParamsSchema,
        query: PaginationQuerySchema.extend({
          status: z.enum(['pending', 'running', 'success', 'failed', 'timeout']).optional(),
          dateFrom: z.string().date().optional(),
          dateTo: z.string().date().optional(),
        }),
      },
      responses: {
        200: {
          description: 'Run history',
          content: {
            'application/json': { schema: SuccessResponseSchema(CronJobRunListResponseSchema) },
          },
        },
        404: {
          description: 'Not found',
          content: { 'application/json': { schema: ErrorResponseSchema } },
        },
      },
    },
    get: {
      method: 'get',
      path: '/api/cron/runs/{runId}',
      summary: 'Get cron job run by ID',
      tags: ['Cron'],
      security: [{ BearerAuth: [] }],
      request: { params: z.object({ runId: z.string().uuid() }) },
      responses: {
        200: {
          description: 'Run details',
          content: {
            'application/json': { schema: SuccessResponseSchema(CronJobRunSchema) },
          },
        },
        404: {
          description: 'Not found',
          content: { 'application/json': { schema: ErrorResponseSchema } },
        },
      },
    },
    retry: {
      method: 'post',
      path: '/api/cron/runs/{runId}/retry',
      summary: 'Retry failed cron job run',
      tags: ['Cron'],
      security: [{ BearerAuth: [] }],
      request: { params: z.object({ runId: z.string().uuid() }) },
      responses: {
        200: {
          description: 'Retry started',
          content: {
            'application/json': { schema: SuccessResponseSchema(CronJobRunSchema) },
          },
        },
        404: {
          description: 'Not found',
          content: { 'application/json': { schema: ErrorResponseSchema } },
        },
        409: {
          description: 'Run not in failed state',
          content: { 'application/json': { schema: ErrorResponseSchema } },
        },
      },
    },
  },
  summary: {
    method: 'get',
    path: '/api/cron/summary',
    summary: 'Get cron job summary statistics',
    tags: ['Cron'],
    security: [{ BearerAuth: [] }],
    request: {
      query: z.object({
        locationId: z.string().uuid().optional(),
        dateFrom: z.string().date().optional(),
        dateTo: z.string().date().optional(),
      }),
    },
    responses: {
      200: {
        description: 'Cron summary',
        content: {
          'application/json': { schema: SuccessResponseSchema(CronJobSummarySchema) },
        },
      },
    },
  },
};
