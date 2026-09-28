/**
 * ERPNext Customers & Leads Client
 * Customer, Lead, and Sales Order related operations
 */

import {
  ErpnextClient,
  type ErpnextApiResponse,
  type LeadPayload,
  type SalesOrderItem
} from './core';

/**
 * Create a Sales Order in ERPNext
 */
export function createSalesOrder(
  client: ErpnextClient,
  customer: Record<string, unknown>,
  items: SalesOrderItem[]
): Promise<ErpnextApiResponse> {
  return client.createSalesOrder(customer, items);
}

/**
 * Create a Lead in ERPNext
 */
export function createLead(
  client: ErpnextClient,
  payload: LeadPayload
): Promise<ErpnextApiResponse> {
  return client.createLead(payload);
}