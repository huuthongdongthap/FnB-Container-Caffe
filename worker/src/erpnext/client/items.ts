/**
 * ERPNext Items Client
 * Product/Item related operations
 */

import { ErpnextClient } from './core';

/**
 * Get product availability including stock across warehouses
 * @param itemCode - The ERPNext Item code
 * @returns Object with item data and stock array
 */
export async function getProductAvailability(
  client: ErpnextClient,
  itemCode: string
): Promise<{ item: unknown; stock: Array<Record<string, unknown>> }> {
  const item = await client.read('Item', itemCode);
  const stock = await client.list('Bin', {
    filters: [['item_code', '=', itemCode]],
    fields: ['warehouse', 'actual_qty', 'projected_qty', 'reserved_qty']
  });

  return {
    item: item.data,
    stock: (stock.data as Array<Record<string, unknown>>) || []
  };
}
