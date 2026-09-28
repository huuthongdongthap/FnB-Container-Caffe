/**
 * ERPNext Orders & Sales Invoice Mapping
 * Order-to-Invoice mapping, VAT e-invoice mapping, and validation
 */

import type {
  AccountConfig,
  CustomerRecord,
  OrderItem,
  OrderRecord,
  SalesInvoice,
  InvoiceLineItem,
  TaxLineItem,
  VatInvoicePayload,
  MappingResult
} from './types';
import { getDefaultAccountConfig } from './customers-crm';
import { mapInvoiceLine, mapTaxLine } from './items-menu';

function generateInvoiceName(order: OrderRecord, invoiceDate: string): string {
  const dateParts = invoiceDate.split('-');
  if (dateParts.length === 3) {
    const [year, month] = dateParts;
    const orderNum = order.id?.replace(/\D/g, '').padStart(3, '0') || '001';
    return `INV/${year}/${month}/${orderNum}`;
  }
  return `AURA-${order.id}`;
}

function extractBuyerName(customer: CustomerRecord | null, _invoice: SalesInvoice): string {
  if (customer?.full_name) {
    return customer.full_name.trim();
  }
  if (customer?.company_name) {
    return customer.company_name.trim();
  }
  if (customer?.name) {
    return customer.name.trim();
  }
  if (customer?.customer_name) {
    return customer.customer_name.trim();
  }
  return 'Walk-in Customer';
}

function extractBuyerTaxCode(customer: CustomerRecord | null): string | null {
  if (customer?.tax_code && customer.tax_code.trim() !== '') {
    return customer.tax_code.trim();
  }
  return null;
}

function extractBuyerAddress(customer: CustomerRecord | null): string {
  if (customer?.address && customer.address.trim() !== '') {
    return customer.address.trim().substring(0, 256);
  }
  if (customer?.street) {
    return customer.street.substring(0, 256);
  }
  return '';
}

function determineBuyerType(customer: CustomerRecord | null): string {
  if (!customer) {
    return 'individual';
  }
  if (customer.tax_code && customer.tax_code.trim() !== '') {
    return 'business';
  }
  if (customer.company_name || customer.is_company) {
    return 'business';
  }
  return 'individual';
}

function extractInvoiceItems(erpnextInvoice: SalesInvoice): Array<Record<string, unknown>> {
  const items: Array<Record<string, unknown>> = [];
  const lines = Array.isArray(erpnextInvoice.items) ? erpnextInvoice.items : [];

  for (const line of lines) {
    const itemLine = line as InvoiceLineItem;
    if (!itemLine.item_code) {
      const isTaxAccount = itemLine.income_account && itemLine.income_account.includes('Tax');
      const isTaxName = itemLine.item_name && itemLine.item_name.toLowerCase().includes('tax');
      if (isTaxAccount || isTaxName) {
        continue;
      }
    }

    const quantity = itemLine.qty ?? 1;
    const unitPrice = itemLine.rate ?? 0;
    const amount = itemLine.amount ?? (quantity * unitPrice);

    if (quantity > 0 && unitPrice >= 0) {
      items.push({
        itemName: itemLine.item_name || 'Unknown Item',
        itemCode: itemLine.item_code || null,
        quantity,
        unitPrice,
        unit: 'cái',
        priceSubtotal: amount,
        taxRate: 10,
        taxAmount: amount * 0.1
      });
    }
  }

  if (items.length === 0) {
    items.push({
      itemName: 'Miscellaneous',
      itemCode: null,
      quantity: 1,
      unitPrice: erpnextInvoice.total || erpnextInvoice.grand_total || 0,
      unit: 'cái',
      priceSubtotal: erpnextInvoice.total || erpnextInvoice.grand_total || 0,
      taxRate: 0,
      taxAmount: 0
    });
  }

  return items;
}

export function mapOrderToInvoice(
  order: OrderRecord,
  items: OrderItem[],
  customer: CustomerRecord | null,
  companyConfig: AccountConfig = getDefaultAccountConfig()
): SalesInvoice {
  if (!order) {
    throw new Error('Invalid order: order is required');
  }
  if (!customer || !customer.customer_name) {
    throw new Error('Invalid customer: customer is required for ERPNext Sales Invoice');
  }

  let invoiceDate: string;
  if (order.created_at) {
    try {
      const date = new Date(order.created_at);
      if (!isNaN(date.getTime())) {
        invoiceDate = date.toISOString().split('T')[0];
      } else {
        invoiceDate = new Date().toISOString().split('T')[0];
      }
    } catch {
      invoiceDate = new Date().toISOString().split('T')[0];
    }
  } else {
    invoiceDate = new Date().toISOString().split('T')[0];
  }

  const invoiceLines: Array<InvoiceLineItem | TaxLineItem> = [];
  const validItems = Array.isArray(items) ? items.filter(Boolean) : [];
  for (const item of validItems) {
    invoiceLines.push(mapInvoiceLine(item, companyConfig));
  }

  const taxAmount = order.tax ? parseFloat(String(order.tax)) : 0;
  if (taxAmount > 0) {
    invoiceLines.push(mapTaxLine(order, companyConfig));
  }

  if (invoiceLines.length === 0) {
    invoiceLines.push({
      item_name: 'Miscellaneous',
      qty: 1,
      rate: 0,
      amount: 0,
      income_account: companyConfig.incomeAccount,
      cost_center: companyConfig.costCenter
    });
  }

  let subtotal = order.subtotal !== undefined ? parseFloat(String(order.subtotal)) : 0;
  if (subtotal === 0) {
    subtotal = validItems.reduce((sum, item) => {
      const qty = (item as OrderItem).quantity ?? (item as OrderItem).qty ?? 1;
      const itemSubtotal = (item as OrderItem).subtotal;
      if (itemSubtotal !== undefined) {
        return sum + parseFloat(String(itemSubtotal));
      }
      const price = (item as OrderItem).price_unit ?? 0;
      return sum + (parseFloat(String(price)) * (typeof qty === 'number' ? qty : parseFloat(String(qty))));
    }, 0);
  }
  if (isNaN(subtotal)) {
    subtotal = 0;
  }

  let taxAmountNum = 0;
  if (order.tax !== undefined && order.tax !== null) {
    taxAmountNum = parseFloat(String(order.tax));
    if (isNaN(taxAmountNum)) {
      taxAmountNum = 0;
    }
  } else {
    taxAmountNum = Math.round(subtotal * 0.1);
  }

  let totalAmount = order.total_amount !== undefined ? parseFloat(String(order.total_amount)) : subtotal + taxAmountNum;
  if (isNaN(totalAmount)) {
    totalAmount = subtotal + taxAmountNum;
  }

  const invoiceName = generateInvoiceName(order, invoiceDate);
  const taxes: TaxLineItem[] = [];
  if (taxAmountNum > 0) {
    taxes.push({
      charge_type: 'Actual',
      account_head: companyConfig.taxAccount,
      description: 'VAT Tax',
      tax_amount: taxAmountNum,
      cost_center: companyConfig.costCenter
    });
  }

  return {
    doctype: 'Sales Invoice',
    customer: customer.customer_name,
    posting_date: invoiceDate,
    due_date: invoiceDate,
    company: companyConfig.company,
    currency: companyConfig.currency || 'VND',
    name: invoiceName,
    custom_aura_order_ref: `AURA-${order.id}`,
    items: invoiceLines,
    taxes,
    total: Math.round(subtotal * 100) / 100,
    base_total: Math.round(subtotal * 100) / 100,
    total_taxes_and_charges: Math.round(taxAmountNum * 100) / 100,
    grand_total: Math.round(totalAmount * 100) / 100,
    outstanding_amount: Math.round(totalAmount * 100) / 100,
    base_grand_total: Math.round(totalAmount * 100) / 100,
    docstatus: 1,
    custom_aura_order_id: order.id,
    custom_vat_invoice_type: companyConfig.vatInvoiceType || '01',
    custom_vat_invoice_pattern: companyConfig.vatInvoicePattern || '002',
    custom_tax_code: companyConfig.taxCode,
    custom_signatory_name: companyConfig.signingAuthority?.name,
    custom_signatory_title: companyConfig.signingAuthority?.title,
    ...(order.notes && { custom_notes: order.notes.trim().substring(0, 1024) })
  };
}

export function mapInvoiceForVAT(
  erpnextInvoice: SalesInvoice,
  customer: CustomerRecord | null,
  companyConfig: AccountConfig = getDefaultAccountConfig()
): VatInvoicePayload {
  if (!erpnextInvoice) {
    throw new Error('Invalid invoice: erpnextInvoice is required');
  }

  const subtotal = erpnextInvoice.total ?? 0;
  const taxAmount = erpnextInvoice.total_taxes_and_charges ?? 0;
  const totalAmount = erpnextInvoice.grand_total ?? subtotal + taxAmount;

  const buyerInfo = {
    name: extractBuyerName(customer, erpnextInvoice),
    taxCode: extractBuyerTaxCode(customer),
    address: extractBuyerAddress(customer),
    phone: customer?.phone || '',
    email: customer?.email || '',
    buyerType: determineBuyerType(customer)
  };

  const sellerInfo = {
    name: companyConfig.name,
    taxCode: companyConfig.taxCode,
    address: companyConfig.address,
    phone: companyConfig.phone,
    email: companyConfig.email
  };

  const invoiceItems = extractInvoiceItems(erpnextInvoice);

  return {
    templateCode: 'V01',
    transactionType: 'SALE',
    invoiceReference: erpnextInvoice.custom_aura_order_ref || erpnextInvoice.name,
    invoiceNumber: erpnextInvoice.name,
    invoiceDate: erpnextInvoice.posting_date,
    currency: companyConfig.currency || 'VND',
    buyerInfo,
    sellerInfo,
    invoiceItems,
    subtotal: Math.round(subtotal),
    taxAmount: Math.round(taxAmount),
    totalAmount: Math.round(totalAmount),
    signatureInfo: {
      signatoryName: companyConfig.signingAuthority?.name,
      signatoryTitle: companyConfig.signingAuthority?.title,
      idNumber: companyConfig.signingAuthority?.idNumber,
      idDate: companyConfig.signingAuthority?.idDate
    },
    paymentMethod: 'CASH',
    paymentStatus: 'UNPAID'
  };
}

export function validateInvoiceData(invoice: SalesInvoice | null | undefined): string[] {
  const errors: string[] = [];

  if (!invoice) {
    errors.push('Invoice data is required');
    return errors;
  }

  if (!invoice.doctype) {
    errors.push('Missing required field: doctype');
  }
  if (!invoice.customer) {
    errors.push('Missing required field: customer');
  }
  if (!invoice.posting_date) {
    errors.push('Missing required field: posting_date');
  }
  if (!invoice.grand_total && invoice.grand_total !== 0) {
    errors.push('Missing required field: grand_total');
  }

  if (!invoice.items || !Array.isArray(invoice.items)) {
    errors.push('Invoice must have items array');
  } else if (invoice.items.length === 0) {
    errors.push('Invoice must have at least one item');
  }

  for (let i = 0; i < (invoice.items || []).length; i++) {
    const line = invoice.items![i];
    if (!line || typeof line !== 'object') {
      errors.push(`Invalid invoice item at index ${i}: expected an object`);
    }
  }

  if (invoice.grand_total !== undefined && invoice.grand_total < 0) {
    errors.push('Grand total cannot be negative');
  }
  if (invoice.total !== undefined && invoice.total < 0) {
    errors.push('Total cannot be negative');
  }
  if (!invoice.custom_vat_invoice_type) {
    errors.push('Missing VAT invoice type (custom_vat_invoice_type)');
  }
  if (!invoice.custom_aura_order_id) {
    errors.push('Missing AURA order reference (custom_aura_order_id)');
  }

  return errors;
}
