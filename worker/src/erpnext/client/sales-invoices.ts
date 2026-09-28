/**
 * ERPNext Sales Invoices Client
 * Sales Invoice related operations
 */

import { ErpnextClient, type ErpnextApiResponse } from './core';

/**
 * Create a Sales Invoice in ERPNext
 * @param client - ErpnextClient instance
 * @param orderData - Sales Invoice data
 * @returns ERPNext API response
 */
export async function createInvoice(
  client: ErpnextClient,
  orderData: Record<string, unknown>
): Promise<ErpnextApiResponse> {
  return client.create('Sales Invoice', orderData);
}