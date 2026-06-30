/**
 * ERPNext Accounting Mapper — Phase 1 (E-invoicing)
 * Transforms order data to ERPNext Sales Invoice format and VAT API payloads
 *
 * Full implementation for Vietnam e-invoicing compliance
 */

/**
 * Default company configuration for ERPNext accounting
 * Override with actual values from ERPNext setup
 */
export function getDefaultAccountConfig() {
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
    vatInvoiceType: '01', // Sales invoice type for Vietnam
    vatInvoicePattern: '002', // VAT invoice pattern code
  };
}

/**
 * Map customer to ERPNext Customer values
 * Handles both business and individual customers
 *
 * @param {Object|null} customer - Customer from D1
 * @returns {Object} Customer values for ERPNext
 */
export function mapCustomerForInvoice(customer) {
  // Handle null/undefined customer
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

  // Handle empty object
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

  // Determine name and buyer type
  let customerName = customer.full_name || customer.name || customer.phone || 'Unknown Customer';
  let buyerType = 'Individual';
  let customerType = 'Individual';
  let customerGroup = 'Individual';

  if (hasCompanyName) {
    customerName = customer.company_name;
    buyerType = 'Business';
    customerType = 'Company';
    customerGroup = 'Commercial';
  } else if (hasTaxCode) {
    buyerType = 'Business';
    customerType = 'Company';
    customerGroup = 'Commercial';
  }

  // Fallback to phone if name is empty
  if (!customerName && customer.phone) {
    customerName = customer.phone;
  }

  return {
    customer_name: customerName.trim().substring(0, 128),
    phone: customer.phone || '',
    email: customer.email || '',
    custom_aura_customer_id: customer.id || null,
    // Vietnamese tax info for e-invoicing
    ...(hasTaxCode && { custom_tax_code: customer.tax_code.trim() }),
    ...(hasAddress && { custom_buyer_address: customer.address.trim().substring(0, 256) }),
    custom_buyer_type: buyerType,
    // ERPNext standard fields
    customer_type: customerType,
    customer_group: customerGroup,
    territory: 'Vietnam',
    // Optional: address for ERPNext
    ...(hasAddress && { customer_primary_address: customer.address.trim().substring(0, 128) }),
  };
}

/**
 * Map single invoice line item
 *
 * @param {Object} item - Order item
 * @param {Object} companyConfig - Company configuration
 * @returns {Object} ERPNext Sales Invoice Item row
 */
export function mapInvoiceLine(item, companyConfig = getDefaultAccountConfig()) {
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

  // Parse quantity with default fallback - handle string numbers
  const rawQty = item.quantity ?? item.qty ?? 1;
  let quantity = typeof rawQty === 'number' ? rawQty : parseFloat(rawQty);
  if (isNaN(quantity) || quantity <= 0) {
    quantity = 1;
  }

  // Get unit price from subtotal/quantity (subtotal already includes modifiers)
  let unitPrice = 0;
  if (item.subtotal) {
    unitPrice = parseFloat(item.subtotal) / quantity;
  } else if (item.price_unit !== undefined) {
    unitPrice = typeof item.price_unit === 'number' ? item.price_unit : parseFloat(item.price_unit) || 0;
  }

  // Build item name with modifiers (only for display)
  let name = item.product_name || item.name || 'Unknown Product';
  name = name.trim();

  if (name && name !== 'Unknown Product' && item.modifiers) {
    try {
      const mods = typeof item.modifiers === 'string' ? JSON.parse(item.modifiers) : item.modifiers;
      if (Array.isArray(mods) && mods.length > 0) {
        const modNames = mods.map(m => m.name || m.title || '').filter(Boolean);
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
    amount: amount,
    income_account: companyConfig.incomeAccount,
    cost_center: companyConfig.costCenter,
    item_code: item.product_id ? String(item.product_id) : null,
  };
}

/**
 * Map tax line for order tax amount
 *
 * @param {Object} order - Order with tax field
 * @param {Object} companyConfig - Company configuration
 * @returns {Object} ERPNext Sales Taxes and Charges row
 */
export function mapTaxLine(order, companyConfig = getDefaultAccountConfig()) {
  const taxAmount = order.tax ? parseFloat(order.tax) : 0;
  const taxAmountNum = isNaN(taxAmount) ? 0 : taxAmount;

  return {
    charge_type: 'Actual',
    account_head: companyConfig.taxAccount,
    description: 'VAT Tax',
    tax_amount: taxAmountNum,
    cost_center: companyConfig.costCenter,
  };
}

/**
 * Map order to ERPNext Sales Invoice values
 * ERPNext Sales Invoice schema for customer invoices
 *
 * @param {Object} order - Order from D1
 * @param {Array} items - Order items array
 * @param {Object|null} customer - Customer object or null
 * @param {Object} companyConfig - Company configuration
 * @returns {Object} Sales Invoice values for ERPNext create
 */
export function mapOrderToInvoice(order, items, customer, companyConfig = getDefaultAccountConfig()) {
  if (!order) {
    throw new Error('Invalid order: order is required');
  }

  if (!customer || !customer.customer_name) {
    throw new Error('Invalid customer: customer is required for ERPNext Sales Invoice');
  }

  // Generate invoice date from order created_at
  let invoiceDate;
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

  // Build invoice lines
  const invoiceLines = [];

  // Add product lines
  const validItems = Array.isArray(items) ? items.filter(Boolean) : [];
  for (const item of validItems) {
    invoiceLines.push(mapInvoiceLine(item, companyConfig));
  }

  // Add tax line if tax exists
  const taxAmount = order.tax ? parseFloat(order.tax) : 0;
  if (taxAmount > 0) {
    invoiceLines.push(mapTaxLine(order, companyConfig));
  }

  // Ensure at least one line
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

  // Calculate amounts - use order totals as source of truth, fallback to item calculations
  let subtotal = order.subtotal !== undefined ? parseFloat(order.subtotal) : 0;
  if (subtotal === 0) {
    subtotal = validItems.reduce((sum, item) => {
      const qty = item.quantity ?? item.qty ?? 1;
      const itemSubtotal = item.subtotal;
      if (itemSubtotal !== undefined) {
        return sum + parseFloat(itemSubtotal);
      }
      const price = item.price_unit ?? 0;
      return sum + (parseFloat(price) * qty);
    }, 0);
  }

  if (isNaN(subtotal)) {subtotal = 0;}

  // Use order.tax if provided (including 0), otherwise compute from subtotal (default 10% VAT)
  let taxAmountNum = 0;
  if (order.tax !== undefined && order.tax !== null) {
    taxAmountNum = parseFloat(order.tax);
    if (isNaN(taxAmountNum)) {taxAmountNum = 0;}
  } else {
    // Default 10% VAT on subtotal if no tax specified
    taxAmountNum = Math.round(subtotal * 0.1);
  }

  let totalAmount = order.total_amount !== undefined ? parseFloat(order.total_amount) : subtotal + taxAmountNum;
  if (isNaN(totalAmount)) {totalAmount = subtotal + taxAmountNum;}

  // Generate invoice name (reference number)
  const invoiceName = generateInvoiceName(order, invoiceDate);

  // Build taxes child table (separate from items in ERPNext)
  const taxes = [];
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
    // Core ERPNext fields
    doctype: 'Sales Invoice',
    customer: customer.customer_name,
    posting_date: invoiceDate,
    due_date: invoiceDate,
    company: companyConfig.company,
    currency: companyConfig.currency || 'VND',
    name: invoiceName,
    // Reference
    custom_aura_order_ref: `AURA-${order.id}`,
    // Lines (items child table)
    items: invoiceLines,
    // Taxes child table
    taxes: taxes,
    // Amounts (rounded to 2 decimal places)
    total: Math.round(subtotal * 100) / 100,
    base_total: Math.round(subtotal * 100) / 100,
    total_taxes_and_charges: Math.round(taxAmountNum * 100) / 100,
    grand_total: Math.round(totalAmount * 100) / 100,
    outstanding_amount: Math.round(totalAmount * 100) / 100,
    base_grand_total: Math.round(totalAmount * 100) / 100,
    // Status
    docstatus: 1, // Submitted
    // Vietnam e-invoicing custom fields
    custom_aura_order_id: order.id,
    custom_vat_invoice_type: companyConfig.vatInvoiceType || '01',
    custom_vat_invoice_pattern: companyConfig.vatInvoicePattern || '002',
    custom_tax_code: companyConfig.taxCode,
    custom_signatory_name: companyConfig.signingAuthority?.name,
    custom_signatory_title: companyConfig.signingAuthority?.title,
    // Include order notes as comment if present
    ...(order.notes && { custom_notes: order.notes.trim().substring(0, 1024) }),
  };
}

/**
 * Generate ERPNext invoice name/reference
 * Format: INV/YYYY/MM/XXX or fallback to AURA-{order_id}
 *
 * @param {Object} order - Order object
 * @param {string} invoiceDate - Invoice date in YYYY-MM-DD
 * @returns {string} Invoice name
 */
function generateInvoiceName(order, invoiceDate) {
  const dateParts = invoiceDate.split('-');
  if (dateParts.length === 3) {
    const [year, month] = dateParts;
    // Use order ID suffix as sequence (extract numeric part)
    const orderNum = order.id?.replace(/\D/g, '').padStart(3, '0') || '001';
    return `INV/${year}/${month}/${orderNum}`;
  }
  return `AURA-${order.id}`;
}

/**
 * Map ERPNext Sales Invoice to Vietnam VAT e-invoice API payload
 * VNInvoice API format for e-invoice submission
 *
 * @param {Object} erpnextInvoice - ERPNext Sales Invoice record (from mapOrderToInvoice)
 * @param {Object|null} customer - Customer data for VAT buyer info
 * @param {Object} companyConfig - Company configuration
 * @returns {Object} VNInvoice API payload
 */
export function mapInvoiceForVAT(erpnextInvoice, customer, companyConfig = getDefaultAccountConfig()) {
  if (!erpnextInvoice) {
    throw new Error('Invalid invoice: erpnextInvoice is required');
  }

  // Use amounts directly from ERPNext invoice (already calculated)
  const subtotal = erpnextInvoice.total ?? 0;
  const taxAmount = erpnextInvoice.total_taxes_and_charges ?? 0;
  const totalAmount = erpnextInvoice.grand_total ?? subtotal + taxAmount;

  // Build buyer info
  const buyerInfo = {
    name: extractBuyerName(customer, erpnextInvoice),
    taxCode: extractBuyerTaxCode(customer),
    address: extractBuyerAddress(customer),
    phone: customer?.phone || '',
    email: customer?.email || '',
    buyerType: determineBuyerType(customer),
  };

  // Build seller info (company)
  const sellerInfo = {
    name: companyConfig.name,
    taxCode: companyConfig.taxCode,
    address: companyConfig.address,
    phone: companyConfig.phone,
    email: companyConfig.email,
  };

  // Build invoice items from lines (excluding tax line)
  const invoiceItems = extractInvoiceItems(erpnextInvoice);

  return {
    // VAT invoice metadata
    templateCode: 'V01',
    transactionType: 'SALE',
    invoiceReference: erpnextInvoice.custom_aura_order_ref || erpnextInvoice.name,
    invoiceNumber: erpnextInvoice.name,
    invoiceDate: erpnextInvoice.posting_date,
    currency: companyConfig.currency || 'VND',
    // Buyer and seller
    buyerInfo,
    sellerInfo,
    // Items
    invoiceItems,
    // Totals
    subtotal: Math.round(subtotal),
    taxAmount: Math.round(taxAmount),
    totalAmount: Math.round(totalAmount),
    // Signature info for Vietnam
    signatureInfo: {
      signatoryName: companyConfig.signingAuthority?.name,
      signatoryTitle: companyConfig.signingAuthority?.title,
      idNumber: companyConfig.signingAuthority?.idNumber,
      idDate: companyConfig.signingAuthority?.idDate,
    },
    // Payment info (placeholder)
    paymentMethod: 'CASH',
    paymentStatus: 'UNPAID',
  };
}

/**
 * Extract buyer name from customer
 */
function extractBuyerName(customer, invoice) {
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

/**
 * Extract buyer tax code
 */
function extractBuyerTaxCode(customer) {
  if (customer?.tax_code && customer.tax_code.trim() !== '') {
    return customer.tax_code.trim();
  }
  return null;
}

/**
 * Extract buyer address
 */
function extractBuyerAddress(customer) {
  if (customer?.address && customer.address.trim() !== '') {
    return customer.address.trim().substring(0, 256);
  }
  if (customer?.street) {
    return customer.street.substring(0, 256);
  }
  return '';
}

/**
 * Determine buyer type for VAT
 */
function determineBuyerType(customer) {
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

/**
 * Extract invoice items for VAT (excluding pure tax lines)
 */
function extractInvoiceItems(erpnextInvoice) {
  const items = [];
  const lines = Array.isArray(erpnextInvoice.items) ? erpnextInvoice.items : [];

  for (const line of lines) {
    // Skip pure tax/accounting lines
    if (!line.item_code) {
      const isTaxAccount = line.income_account && line.income_account.includes('Tax');
      const isTaxName = line.item_name && line.item_name.toLowerCase().includes('tax');
      if (isTaxAccount || isTaxName) {
        continue;
      }
    }

    const quantity = line.qty ?? 1;
    const unitPrice = line.rate ?? 0;
    const amount = line.amount ?? (quantity * unitPrice);

    if (quantity > 0 && unitPrice >= 0) {
      items.push({
        itemName: line.item_name || 'Unknown Item',
        itemCode: line.item_code || null,
        quantity,
        unitPrice,
        unit: 'cái',
        priceSubtotal: amount,
        taxRate: 10,
        taxAmount: amount * 0.1,
      });
    }
  }

  // Ensure at least one item
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

/**
 * Validate invoice data before ERPNext submission
 *
 * @param {Object} invoice - Invoice values
 * @returns {string[]} Array of validation errors, empty if valid
 */
export function validateInvoiceData(invoice) {
  const errors = [];

  if (!invoice) {
    errors.push('Invoice data is required');
    return errors;
  }

  // Required fields
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

  // Invoice items validation
  if (!invoice.items || !Array.isArray(invoice.items)) {
    errors.push('Invoice must have items array');
  } else if (invoice.items.length === 0) {
    errors.push('Invoice must have at least one item');
  }

  // Validate item structure
  for (let i = 0; i < invoice.items.length; i++) {
    const line = invoice.items[i];
    if (!line || typeof line !== 'object') {
      errors.push(`Invalid invoice item at index ${i}: expected an object`);
    }
  }

  // Amount validation
  if (invoice.grand_total !== undefined && invoice.grand_total < 0) {
    errors.push('Grand total cannot be negative');
  }

  if (invoice.total !== undefined && invoice.total < 0) {
    errors.push('Total cannot be negative');
  }

  // VAT custom fields validation (Vietnam requirement)
  if (!invoice.custom_vat_invoice_type) {
    errors.push('Missing VAT invoice type (custom_vat_invoice_type)');
  }

  if (!invoice.custom_aura_order_id) {
    errors.push('Missing AURA order reference (custom_aura_order_id)');
  }

  return errors;
}

/**
 * Check if a mapping result indicates success
 * @param {Object} result - Mapping result
 * @returns {boolean}
 */
export function isMappingSuccess(result) {
  return !!(result && result.success && result.erpnextInvoiceId);
}

/**
 * Get mapping status for logging
 * @param {Object} result - Mapping result
 * @returns {string}
 */
export function getMappingStatus(result) {
  if (result?.fromCache) {
    return 'CACHED';
  }
  if (result?.success) {
    return 'SYNCED';
  }
  if (result?.error) {
    return 'FAILED';
  }
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
