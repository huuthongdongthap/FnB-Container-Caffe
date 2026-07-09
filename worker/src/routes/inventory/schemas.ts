import { z } from 'zod';

export const inventoryItemSchema = z.object({
  id: z.string().uuid().optional(),
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
  active: z.boolean().default(true)
});

export type InventoryItemInput = z.infer<typeof inventoryItemSchema>;

export const inventoryTransactionSchema = z.object({
  id: z.string().uuid().optional(),
  item_id: z.string().uuid('ID nguyên liệu không hợp lệ / Invalid item ID'),
  type: z.enum(['in', 'out', 'adjust', 'waste', 'reserve', 'release']),
  quantity: z.number().positive('Số lượng phải lớn hơn 0 / Quantity must be positive'),
  reference_id: z.string().uuid().optional(),
  reference_type: z.enum(['order', 'purchase', 'adjustment', 'waste_report', 'sync']).optional(),
  notes: z.string().max(500).optional()
});

export type InventoryTransactionInput = z.infer<typeof inventoryTransactionSchema>;
