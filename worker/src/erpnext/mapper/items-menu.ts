/**
 * ERPNext Items & Menu Mapping
 * Line items and tax line mappings for ERPNext Sales Invoice
 */

import type { AccountConfig, OrderItem, OrderRecord, InvoiceLineItem, TaxLineItem } from './types';
import { getDefaultAccountConfig } from './customers-crm';

export function mapInvoiceLine(
  item: OrderItem | null | undefined,
  companyConfig: AccountConfig = getDefaultAccountConfig()
): InvoiceLineItem {
  if (!item) {
    return {
      item_name: 'Unknown Item',
      qty: 1,
      rate: 0,
      amount: 0,
      income_account: companyConfig.incomeAccount,
      cost_center: companyConfig.costCenter
    };
  }

  const rawQty = item.quantity ?? item.qty ?? 1;
  let quantity = typeof rawQty === 'number' ? rawQty : parseFloat(String(rawQty));
  if (isNaN(quantity) || quantity <= 0) {
    quantity = 1;
  }

  let unitPrice = 0;
  if (item.subtotal) {
    unitPrice = parseFloat(String(item.subtotal)) / quantity;
  } else if (item.price_unit !== undefined) {
    unitPrice = typeof item.price_unit === 'number' ? item.price_unit : parseFloat(String(item.price_unit)) || 0;
  }

  let name = item.product_name || item.name || 'Unknown Product';
  name = name.trim();

  if (name && name !== 'Unknown Product' && item.modifiers) {
    try {
      const mods = typeof item.modifiers === 'string' ? JSON.parse(item.modifiers) : item.modifiers;
      if (Array.isArray(mods) && mods.length > 0) {
        const modNames = mods.map((m: { name?: string; title?: string }) => m.name || m.title || '').filter(Boolean);
        if (modNames.length > 0) {
          name += ` (${modNames.join(', ')})`;
        }
      }
    } catch {
      // Ignore modifier parsing errors
    }
  }

  if (!name) {
    name = 'Unknown Product';
  }

  const amount = quantity * unitPrice;

  return {
    item_name: name.substring(0, 128),
    qty: quantity,
    rate: unitPrice,
    amount,
    income_account: companyConfig.incomeAccount,
    cost_center: companyConfig.costCenter,
    item_code: item.product_id ? String(item.product_id) : null
  };
}

export function mapTaxLine(
  order: OrderRecord,
  companyConfig: AccountConfig = getDefaultAccountConfig()
): TaxLineItem {
  const taxAmount = order.tax ? parseFloat(String(order.tax)) : 0;
  const taxAmountNum = isNaN(taxAmount) ? 0 : taxAmount;

  return {
    charge_type: 'Actual',
    account_head: companyConfig.taxAccount,
    description: 'VAT Tax',
    tax_amount: taxAmountNum,
    cost_center: companyConfig.costCenter
  };
}