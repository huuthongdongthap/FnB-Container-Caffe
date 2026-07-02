/**
 * ERPNext Accounting Mapper — Phase 1 (E-invoicing)
 * Transforms order data to ERPNext Sales Invoice format and VAT API payloads
 *
 * Full implementation for Vietnam e-invoicing compliance
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AccountConfig {
  name: string;
  taxCode: string;
  address: string;
  phone: string;
  email: string;
  currency: string;
  incomeAccount: string;
  taxAccount: string;
  costCenter: string;
  company: string;
  signingAuthority: {
    name: string;
    title: string;
    idNumber: string;
    idDate: string;
  };
  vatInvoiceType: string;
  vatInvoicePattern: string;
}

export interface CustomerRecord {
  id?: string | number;
  full_name?: string;
  name?: string;
  phone?: string;
  email?: string;
  tax_code?: string;
  address?: string;
  company_name?: string;
  street?: string;
  is_company?: boolean;
  customer_name?: string;
}

export interface OrderItem {
  quantity?: number | string;
  qty?: number;
  product_name?: string;
  name?: string;
  subtotal?: number | string;
  price_unit?: number | string;
  product_id?: string | number;
  modifiers?: string | Array<{ name?: string; title?: string }>;
}

export interface OrderRecord {
  id: string;
  created_at?: string;
  tax?: string | number;
  subtotal?: string | number;
  total_amount?: string | number;
  notes?: string;
}

export interface InvoiceLineItem {
  item_name: string;
  qty: number;
  rate: number;
  amount: number;
  income_account: string;
  cost_center: string;
  item_code?: string | null;
}

export interface TaxLineItem {
  charge_type: string;
  account_head: string;
  description: string;
  tax_amount: number;
  cost_center: string;
}

export interface SalesInvoice {
  doctype: string;
  customer: string;
  posting_date: string;
  due_date: string;
  company: string;
  currency: string;
  name: string;
  custom_aura_order_ref: string;
  items: Array<InvoiceLineItem | TaxLineItem>;
  taxes: TaxLineItem[];
  total: number;
  base_total: number;
  total_taxes_and_charges: number;
  grand_total: number;
  outstanding_amount: number;
  base_grand_total: number;
  docstatus: number;
  custom_aura_order_id: string;
  custom_vat_invoice_type: string;
  custom_vat_invoice_pattern: string;
  custom_tax_code: string;
  custom_signatory_name?: string;
  custom_signatory_title?: string;
  custom_notes?: string;
}

export interface CustomerInvoiceFields {
  customer_name: string;
  phone: string;
  email: string;
  custom_aura_customer_id: string | number | null;
  custom_tax_code?: string;
  custom_buyer_address?: string;
  custom_buyer_type: string;
  customer_type: string;
  customer_group: string;
  territory: string;
  customer_primary_address?: string;
}

export interface VatInvoicePayload {
  templateCode: string;
  transactionType: string;
  invoiceReference: string;
  invoiceNumber: string;
  invoiceDate: string;
  currency: string;
  buyerInfo: Record<string, unknown>;
  sellerInfo: Record<string, unknown>;
  invoiceItems: Array<Record<string, unknown>>;
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  signatureInfo: Record<string, unknown>;
  paymentMethod: string;
  paymentStatus: string;
}

export interface MappingResult {
  success?: boolean;
  erpnextInvoiceId?: string;
  fromCache?: boolean;
  error?: string;
}

// ---------------------------------------------------------------------------
// Default config
// ---------------------------------------------------------------------------

export function getDefaultAccountConfig(): AccountConfig {
  return {
    name: 'AURA CAFE',
    taxCode: '0107645889',
    address: '123 Lê Lợi, Quận 1, TP.HCM',
    phone: '0909123456',
    email: 'billing@aura.cafe',
    currency: 'VND',
    incomeAccount: 'Income Account - AURA',
    taxAccount: 'Output Tax GST - AURA',
    costCenter: 'Main - AURA',
    company: 'AURA CAFE',
    signingAuthority: {
      name: 'Nguyen Van A',
      title: 'Director',
      idNumber: '123456789',
      idDate: '2020-01-15',
    },
    vatInvoiceType: '01',
    vatInvoicePattern: '002',
  };
}

// ---------------------------------------------------------------------------
// Customer mapping
// ---------------------------------------------------------------------------

export function mapCustomerForInvoice(customer: CustomerRecord | null | undefined): CustomerInvoiceFields {
  if (customer === null || customer === undefined) {
    return {
      customer_name: 'Walk-in Customer',
      phone: '',
      email: '',
      custom_aura_customer_id: null,
      custom_tax_code: undefined,
      custom_buyer_address: '',
      custom_buyer_type: 'Individual',
      customer_type: 'Individual',
      customer_group: 'Individual',
      territory: 'Vietnam',
    };
  }

  if (typeof customer === 'object' && Object.keys(customer).length === 0) {
    return {
      customer_name: 'Unknown Customer',
      phone: '',
      email: '',
      custom_aura_customer_id: null,
      custom_tax_code: undefined,
      custom_buyer_address: '',
      custom_buyer_type: 'Individual',
      customer_type: 'Individual',
      customer_group: 'Individual',
      territory: 'Vietnam',
    };
  }

  const hasTaxCode = customer.tax_code && customer.tax_code.trim() !== '';
  const hasAddress = customer.address && customer.address.trim() !== '';
  const hasCompanyName = customer.company_name && customer.company_name.trim() !== '';

  let customerName = customer.full_name || customer.name || customer.phone || 'Unknown Customer';
  let buyerType = 'Individual';
  let customerType = 'Individual';
  let customerGroup = 'Individual';

  if (hasCompanyName) {
    customerName = customer.company_name!;
    buyerType = 'Business';
    customerType = 'Company';
    customerGroup = 'Commercial';
  } else if (hasTaxCode) {
    buyerType = 'Business';
    customerType = 'Company';
    customerGroup = 'Commercial';
  }

  if (!customerName && customer.phone) {
    customerName = customer.phone;
  }

  return {
    customer_name: customerName.trim().substring(0, 128),
    phone: customer.phone || '',
    email: customer.email || '',
    custom_aura_customer_id: customer.id || null,
    ...(hasTaxCode && { custom_tax_code: customer.tax_code!.trim() }),
    ...(hasAddress && { custom_buyer_address: customer.address?.trim().substring(0, 256) ?? '' }),
    custom_buyer_type: buyerType,
    customer_type: customerType,
    customer_group: customerGroup,
    territory: 'Vietnam',
    ...(hasAddress && { customer_primary_address: customer.address!.trim().substring(0, 128) }),
  };
}

// ---------------------------------------------------------------------------
// Line item mapping
// ---------------------------------------------------------------------------

export function mapInvoiceLine(item: OrderItem | null | undefined, companyConfig: AccountConfig = getDefaultAccountConfig()): InvoiceLineItem {
  if (!item) {
    return {
      item_name: 'Unknown Item',
      qty: 1,
      rate: 0,
      amount: 0,
      income_account: companyConfig.incomeAccount,
      cost_center: companyConfig.costCenter,
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
    item_code: item.product_id ? String(item.product_id) : null,
  };
}

export function mapTaxLine(order: OrderRecord, companyConfig: AccountConfig = getDefaultAccountConfig()): TaxLineItem {
  const taxAmount = order.tax ? parseFloat(String(order.tax)) : 0;
  const taxAmountNum = isNaN(taxAmount) ? 0 : taxAmount;

  return {
    charge_type: 'Actual',
    account_head: companyConfig.taxAccount,
    description: 'VAT Tax',
    tax_amount: taxAmountNum,
    cost_center: companyConfig.costCenter,
  };
}

// ---------------------------------------------------------------------------
// Order → Invoice
// ---------------------------------------------------------------------------

function generateInvoiceName(order: OrderRecord, invoiceDate: string): string {
  const dateParts = invoiceDate.split('-');
  if (dateParts.length === 3) {
    const [year, month] = dateParts;
    const orderNum = order.id?.replace(/\D/g, '').padStart(3, '0') || '001';
    return `INV/${year}/${month}/${orderNum}`;
  }
  return `AURA-${order.id}`;
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
      cost_center: companyConfig.costCenter,
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

  if (isNaN(subtotal)) { subtotal = 0; }

  let taxAmountNum = 0;
  if (order.tax !== undefined && order.tax !== null) {
    taxAmountNum = parseFloat(String(order.tax));
    if (isNaN(taxAmountNum)) { taxAmountNum = 0; }
  } else {
    taxAmountNum = Math.round(subtotal * 0.1);
  }

  let totalAmount = order.total_amount !== undefined ? parseFloat(String(order.total_amount)) : subtotal + taxAmountNum;
  if (isNaN(totalAmount)) { totalAmount = subtotal + taxAmountNum; }

  const invoiceName = generateInvoiceName(order, invoiceDate);

  const taxes: TaxLineItem[] = [];
  if (taxAmountNum > 0) {
    taxes.push({
      charge_type: 'Actual',
      account_head: companyConfig.taxAccount,
      description: 'VAT Tax',
      tax_amount: taxAmountNum,
      cost_center: companyConfig.costCenter,
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
    ...(order.notes && { custom_notes: order.notes.trim().substring(0, 1024) }),
  };
}

// ---------------------------------------------------------------------------
// VAT e-invoice mappers
// ---------------------------------------------------------------------------

function extractBuyerName(customer: CustomerRecord | null, _invoice: SalesInvoice): string {
  if (customer?.full_name) return customer.full_name.trim();
  if (customer?.company_name) return customer.company_name.trim();
  if (customer?.name) return customer.name.trim();
  if (customer?.customer_name) return customer.customer_name.trim();
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
  if (!customer) return 'individual';
  if (customer.tax_code && customer.tax_code.trim() !== '') return 'business';
  if (customer.company_name || customer.is_company) return 'business';
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
      if (isTaxAccount || isTaxName) continue;
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
        taxAmount: amount * 0.1,
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
      taxAmount: 0,
    });
  }

  return items;
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
    buyerType: determineBuyerType(customer),
  };

  const sellerInfo = {
    name: companyConfig.name,
    taxCode: companyConfig.taxCode,
    address: companyConfig.address,
    phone: companyConfig.phone,
    email: companyConfig.email,
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
      idDate: companyConfig.signingAuthority?.idDate,
    },
    paymentMethod: 'CASH',
    paymentStatus: 'UNPAID',
  };
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export function validateInvoiceData(invoice: SalesInvoice | null | undefined): string[] {
  const errors: string[] = [];

  if (!invoice) {
    errors.push('Invoice data is required');
    return errors;
  }

  if (!invoice.doctype) errors.push('Missing required field: doctype');
  if (!invoice.customer) errors.push('Missing required field: customer');
  if (!invoice.posting_date) errors.push('Missing required field: posting_date');
  if (!invoice.grand_total && invoice.grand_total !== 0) errors.push('Missing required field: grand_total');

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

  if (invoice.grand_total !== undefined && invoice.grand_total < 0) errors.push('Grand total cannot be negative');
  if (invoice.total !== undefined && invoice.total < 0) errors.push('Total cannot be negative');
  if (!invoice.custom_vat_invoice_type) errors.push('Missing VAT invoice type (custom_vat_invoice_type)');
  if (!invoice.custom_aura_order_id) errors.push('Missing AURA order reference (custom_aura_order_id)');

  return errors;
}

export function isMappingSuccess(result: MappingResult | null | undefined): boolean {
  return !!(result && result.success && result.erpnextInvoiceId);
}

export function getMappingStatus(result: MappingResult | null | undefined): string {
  if (result?.fromCache) return 'CACHED';
  if (result?.success) return 'SYNCED';
  if (result?.error) return 'FAILED';
  return 'UNKNOWN';
}

export default {
  mapOrderToInvoice,
  mapCustomerForInvoice,
  mapInvoiceForVAT,
  mapInvoiceLine,
  mapTaxLine,
  getDefaultAccountConfig,
  validateInvoiceData,
  isMappingSuccess,
  getMappingStatus,
};
