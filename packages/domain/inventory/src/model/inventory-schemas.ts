import { z } from 'zod';

export const inventoryItemSchema = z.object({
  id: z.string().min(1).optional(),
  sku: z.string().min(1, 'Mã SKU không được để trống / SKU is required').max(50),
  name: z.string().min(1, 'Tên nguyên liệu không được để trống / Name is required').max(200),
  name_en: z.string().max(200).optional(),
  category: z.enum(['raw_materials', 'consumables', 'packaging', 'equipment', 'other']),
  unit: z.string().max(20).default('pcs'),
  current_stock: z.number().nonnegative().default(0),
  min_stock: z.number().nonnegative().default(0),
  max_stock: z.number().positive().default(1000),
  cost_per_unit: z.number().nonnegative().default(0),
  supplier: z.string().max(200).optional(),
  active: z.boolean().default(true),
});

export type InventoryItemInput = z.infer<typeof inventoryItemSchema>;

export const inventoryTransactionSchema = z.object({
  id: z.string().min(1).optional(),
  item_id: z.string().min(1, 'ID nguyên liệu không hợp lệ / Invalid item ID'),
  type: z.enum(['in', 'out', 'adjust', 'waste', 'reserve', 'release']),
  quantity: z.number().refine((v) => v !== 0, { message: 'Quantity cannot be zero' }),
  reference_id: z.string().min(1).optional(),
  reference_type: z.enum(['order', 'purchase', 'adjustment', 'waste_report', 'sync']).optional(),
  notes: z.string().max(500).optional(),
}).superRefine((data, ctx) => {
  if (data.type !== 'adjust' && data.quantity <= 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['quantity'],
      message: 'Quantity must be positive',
    });
  }
});

export type InventoryTransactionInput = z.infer<typeof inventoryTransactionSchema>;
