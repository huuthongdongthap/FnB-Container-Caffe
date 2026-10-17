import { z } from '@hono/zod-openapi';
import {
  PaginationQuerySchema,
  PaginationMetaSchema,
  SuccessResponseSchema,
  ErrorResponseSchema,
  MoneySchema,
  DateTimeSchema,
  DateSchema,
  InventoryMovementTypeEnum,
} from '../common';

export const IdParamsSchema = z.object({
  id: z.string().min(1).openapi({
    example: 'ing_1234567890',
    description: 'Unique entity identifier (UUID or prefixed slug/id)',
  }),
});

export {
  PaginationQuerySchema,
  PaginationMetaSchema,
  SuccessResponseSchema,
  ErrorResponseSchema,
  MoneySchema,
  DateTimeSchema,
  DateSchema,
  InventoryMovementTypeEnum,
};

export type InventoryIdParams = z.infer<typeof IdParamsSchema>;
