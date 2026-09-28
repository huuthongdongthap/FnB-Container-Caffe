import { z } from '@hono/zod-openapi';
import {
  PaginationQuerySchema,
  SuccessResponseSchema,
  ErrorResponseSchema,
  IdParamsSchema,
} from '../common';
import {
  CronJobListResponseSchema,
  CronJobResponseSchema,
  CronJobCreateSchema,
  CronJobUpdateSchema,
  CronJobTriggerSchema,
  CronJobRunSchema,
  CronJobRunListResponseSchema,
  CronJobSummarySchema,
} from './models';

export const CronRoutes = {
  list: {
    method: 'get' as const,
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
    method: 'get' as const,
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
    method: 'post' as const,
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
    method: 'patch' as const,
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
    method: 'delete' as const,
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
    method: 'post' as const,
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
      method: 'get' as const,
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
      method: 'get' as const,
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
      method: 'post' as const,
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
    method: 'get' as const,
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
