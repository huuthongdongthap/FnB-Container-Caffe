import { z } from '@hono/zod-openapi';
import { PaginationMetaSchema, DateTimeSchema, ReferenceSchema } from '../common';

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
  payload: z.record(z.string(), z.unknown()).optional(),
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
  metadata: z.record(z.string(), z.unknown()).optional(),
}).openapi('CronJobCreate');

export const CronJobUpdateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  schedule: CronJobScheduleSchema.optional(),
  payload: CronJobPayloadSchema.optional(),
  isActive: z.boolean().optional(),
  locationIds: z.array(z.string().uuid()).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
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
  metadata: z.record(z.string(), z.unknown()).nullable(),
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
  metadata: z.record(z.string(), z.unknown()).nullable(),
}).openapi('CronJobRun');

export const CronJobRunListResponseSchema = z.object({
  runs: z.array(CronJobRunSchema),
  meta: PaginationMetaSchema,
}).openapi('CronJobRunListResponse');

export const CronJobTriggerSchema = z.object({
  payload: z.record(z.string(), z.unknown()).optional(),
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
