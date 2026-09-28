import { z } from '@hono/zod-openapi';
import {
  PaginationQuerySchema,
  SuccessResponseSchema,
  ErrorResponseSchema,
  IdParamsSchema,
} from '../common';
import {
  PromotionListResponseSchema,
  PromotionResponseSchema,
  PromotionCreateSchema,
  PromotionUpdateSchema,
  ValidatePromotionSchema,
  ValidatePromotionResponseSchema,
  PromotionUsageSchema,
  PromotionUsageListResponseSchema,
  PromotionSummarySchema,
  PromotionUseRequestSchema,
  SlugSchema,
} from './models';

const PromotionRoutes = {
  list: {
    method: 'get' as const,
    path: '/api/promotions',
    summary: 'List promotions with pagination and filtering',
    tags: ['Promotions'],
    security: [{ BearerAuth: [] }],
    request: {
      query: PaginationQuerySchema.extend({
        type: z.enum(['code', 'auto', 'loyalty', 'referral']).optional(),
        status: z.enum(['draft', 'scheduled', 'active', 'paused', 'expired']).optional(),
        locationId: z.string().uuid().optional(),
        search: z.string().optional(),
        dateFrom: z.string().date().optional(),
        dateTo: z.string().date().optional(),
      }),
    },
    responses: {
      200: {
        description: 'Promotion list',
        content: {
          'application/json': { schema: SuccessResponseSchema(PromotionListResponseSchema) },
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
    path: '/api/promotions/{id}',
    summary: 'Get promotion by ID',
    tags: ['Promotions'],
    security: [{ BearerAuth: [] }],
    request: { params: IdParamsSchema },
    responses: {
      200: {
        description: 'Promotion details',
        content: {
          'application/json': { schema: SuccessResponseSchema(PromotionResponseSchema) },
        },
      },
      404: {
        description: 'Not found',
        content: { 'application/json': { schema: ErrorResponseSchema } },
      },
    },
  },
  getBySlug: {
    method: 'get' as const,
    path: '/api/promotions/slug/{slug}',
    summary: 'Get promotion by slug',
    tags: ['Promotions'],
    security: [{ BearerAuth: [] }],
    request: { params: z.object({ slug: SlugSchema }) },
    responses: {
      200: {
        description: 'Promotion details',
        content: {
          'application/json': { schema: SuccessResponseSchema(PromotionResponseSchema) },
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
    path: '/api/promotions',
    summary: 'Create new promotion',
    tags: ['Promotions'],
    security: [{ BearerAuth: [] }],
    request: { body: { content: { 'application/json': { schema: PromotionCreateSchema } } } },
    responses: {
      201: {
        description: 'Created',
        content: {
          'application/json': { schema: SuccessResponseSchema(PromotionResponseSchema) },
        },
      },
      400: {
        description: 'Validation error',
        content: { 'application/json': { schema: ErrorResponseSchema } },
      },
      409: {
        description: 'Slug or code already exists',
        content: { 'application/json': { schema: ErrorResponseSchema } },
      },
    },
  },
  update: {
    method: 'patch' as const,
    path: '/api/promotions/{id}',
    summary: 'Update promotion',
    tags: ['Promotions'],
    security: [{ BearerAuth: [] }],
    request: {
      params: IdParamsSchema,
      body: { content: { 'application/json': { schema: PromotionUpdateSchema } } },
    },
    responses: {
      200: {
        description: 'Updated',
        content: {
          'application/json': { schema: SuccessResponseSchema(PromotionResponseSchema) },
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
    path: '/api/promotions/{id}',
    summary: 'Delete promotion',
    tags: ['Promotions'],
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
  validate: {
    method: 'post' as const,
    path: '/api/promotions/validate',
    summary: 'Validate promotion code for an order',
    tags: ['Promotions'],
    security: [{ BearerAuth: [] }],
    request: { body: { content: { 'application/json': { schema: ValidatePromotionSchema } } } },
    responses: {
      200: {
        description: 'Validation result',
        content: {
          'application/json': { schema: SuccessResponseSchema(ValidatePromotionResponseSchema) },
        },
      },
      400: {
        description: 'Validation error',
        content: { 'application/json': { schema: ErrorResponseSchema } },
      },
    },
  },
  use: {
    method: 'post' as const,
    path: '/api/promotions/use',
    summary: 'Record promotion usage',
    tags: ['Promotions'],
    security: [{ BearerAuth: [] }],
    request: {
      body: {
        content: {
          'application/json': {
            schema: PromotionUseRequestSchema,
          },
        },
      },
    },
    responses: {
      200: {
        description: 'Usage recorded',
        content: {
          'application/json': { schema: SuccessResponseSchema(PromotionUsageSchema) },
        },
      },
      400: {
        description: 'Validation error or usage limit reached',
        content: { 'application/json': { schema: ErrorResponseSchema } },
      },
      404: {
        description: 'Promotion not found',
        content: { 'application/json': { schema: ErrorResponseSchema } },
      },
    },
  },
  usage: {
    list: {
      method: 'get' as const,
      path: '/api/promotions/{id}/usage',
      summary: 'List promotion usage',
      tags: ['Promotions'],
      security: [{ BearerAuth: [] }],
      request: {
        params: IdParamsSchema,
        query: PaginationQuerySchema.extend({
          customerId: z.string().uuid().optional(),
          dateFrom: z.string().date().optional(),
          dateTo: z.string().date().optional(),
        }),
      },
      responses: {
        200: {
          description: 'Usage list',
          content: {
            'application/json': { schema: SuccessResponseSchema(PromotionUsageListResponseSchema) },
          },
        },
        404: {
          description: 'Not found',
          content: { 'application/json': { schema: ErrorResponseSchema } },
        },
      },
    },
  },
  summary: {
    method: 'get' as const,
    path: '/api/promotions/summary',
    summary: 'Get promotion summary statistics',
    tags: ['Promotions'],
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
        description: 'Promotion summary',
        content: {
          'application/json': { schema: SuccessResponseSchema(PromotionSummarySchema) },
        },
      },
    },
  },
};

export { PromotionRoutes };