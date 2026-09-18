import { z } from '@hono/zod-openapi';
import {
  SuccessResponseSchema,
  ErrorResponseSchema,
} from 'worker/src/schemas/common';

/**
 * Customer Menu schemas (M4-B Customer-Safe DTO Projection)
 */
export const CustomerMenuItemSchema = z.object({
  id: z.string().openapi({ example: 'prod_cafe_den' }),
  name: z.string().openapi({ example: 'Cà phê đen đá' }),
  description: z.string().nullable().optional().openapi({ example: 'Cà phê Robusta đậm đà truyền thống' }),
  priceCents: z.number().int().nonnegative().openapi({ example: 25000, description: 'Price in integer VND cents' }),
  category: z.string().openapi({ example: 'Cà phê truyền thống' }),
  imageUrl: z.string().nullable().optional().openapi({ example: 'https://cdn.auraspace.vn/menu/cafe-den.webp' }),
  tags: z.array(z.string()).openapi({ example: ['cold', 'signature'] }),
  available: z.boolean().openapi({ example: true, description: 'Sellability status computed server-side' }),
}).openapi('CustomerMenuItem');

export const CustomerMenuCategorySchema = z.object({
  name: z.string().openapi({ example: 'Cà phê truyền thống' }),
  items: z.array(CustomerMenuItemSchema),
}).openapi('CustomerMenuCategory');

export const CustomerMenuResponseSchema = z.object({
  categories: z.array(CustomerMenuCategorySchema),
  totalItems: z.number().int().nonnegative().openapi({ example: 42 }),
}).openapi('CustomerMenuResponse');

export const MenuRoutes = {
  customerMenu: {
    method: 'get' as const,
    path: '/api/menu',
    summary: 'Get customer-facing digital menu projection',
    description: 'Returns customer-safe categories and menu items with sensitive internal fields stripped.',
    tags: ['Menu'],
    request: {
      query: z.object({
        category: z.string().optional().openapi({ description: 'Filter by category name' }),
        include_unavailable: z.enum(['true', 'false']).optional().openapi({ description: 'Include out-of-stock items' }),
        locale: z.string().optional().openapi({ example: 'vi-VN', description: 'Target locale (defaults to vi-VN)' }),
      }),
    },
    responses: {
      200: {
        description: 'Customer digital menu',
        content: {
          'application/json': {
            schema: z.object({
              success: z.boolean().openapi({ example: true }),
              data: CustomerMenuResponseSchema,
              meta: z.object({
                locale: z.string().openapi({ example: 'vi-VN' }),
              }),
            }),
          },
        },
      },
    },
  },
  customerMenuItem: {
    method: 'get' as const,
    path: '/api/menu/{id}',
    summary: 'Get single customer menu item by ID',
    description: 'Returns customer-safe menu item projection without internal procurement fields.',
    tags: ['Menu'],
    request: {
      params: z.object({
        id: z.string().openapi({ example: 'prod_cafe_den' }),
      }),
    },
    responses: {
      200: {
        description: 'Customer menu item',
        content: {
          'application/json': {
            schema: SuccessResponseSchema(CustomerMenuItemSchema),
          },
        },
      },
      404: {
        description: 'Menu item not found',
        content: {
          'application/json': {
            schema: ErrorResponseSchema,
          },
        },
      },
    },
  },
};
