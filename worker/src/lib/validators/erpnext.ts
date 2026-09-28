/**
 * ERPNext integration request validators
 */

import { z } from 'zod';

export const erpnextLeadSchema = z.object({
  id: z.string().optional(),
  name: z.string().optional(),
  full_name: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
  phone_number: z.string().optional(),
  consent_marketing: z.boolean().optional(),
  consent_erpnext_sync: z.boolean().optional()
});

export const erpnextTagSchema = z.object({
  tag: z.string().min(1, 'tag là bắt buộc')
});

export const erpnextProductSyncSchema = z.object({
  product_ids: z.array(z.string()).optional()
});

export const erpnextSalesOrderSchema = z.object({
  customer_name: z.string().optional(),
  customer_phone: z.string().optional(),
  items: z.array(
    z.object({
      item_code: z.string().min(1),
      item_name: z.string().optional(),
      qty: z.number().positive(),
      rate: z.number().positive(),
      amount: z.number().optional()
    })
  ).min(1, 'Phải có ít nhất 1 sản phẩm'),
  table_id: z.string().optional(),
  notes: z.string().optional()
});

export const erpnextPosWebhookSchema = z.object({
  doctype: z.string().optional(),
  docname: z.string().optional(),
  action: z.string().optional()
}).passthrough();

export const erpnextConfigureSchema = z.object({
  url: z.string().url('URL không hợp lệ'),
  api_key: z.string().min(1, 'api_key là bắt buộc'),
  api_secret: z.string().min(1, 'api_secret là bắt buộc')
});

// Schema for PUT /api/erpnext/customer/:id
export const erpnextUpdateCustomerSchema = z.object({
  customer_name: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  customer_primary_address: z.string().optional(),
  custom_notes: z.string().optional()
}).passthrough();

// ══════════════════════════════════════════════
// ERPNext VAT invoice update
// ══════════════════════════════════════════════

export const erpnextVatUpdateSchema = z.object({
  success: z.boolean(),
  invoice_number: z.string().optional()
});

// Shared body types for routes file
export type ErpnextConfigureBody = z.infer<typeof erpnextConfigureSchema>;
export type ErpnextVatUpdateBody = z.infer<typeof erpnextVatUpdateSchema>;