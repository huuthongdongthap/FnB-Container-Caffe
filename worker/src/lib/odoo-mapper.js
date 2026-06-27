/**
 * Odoo Accounting Mapper — Phase 1 (E-invoicing)
 * Transforms order data to Odoo 16 account.move format and VAT API payloads
 *
 * Full implementation for Vietnam e-invoicing compliance
 */

/**
 * Default company configuration for Odoo accounting
 * Override with actual values from Odoo setup
 */
export function getDefaultAccountConfig() {
  return {
    name: 'AURA CAFE',
    taxCode: '0107645889',
    address: '123 Lê Lợi, Quận 1, TP.HCM',
    phone: '0909123456',
    email: 'billing@aura.cafe',
    currency: 'VND',
    journalId: 1,
    incomeAccountId: 101,
    taxAccountId: 201,
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
 * Map customer to Odoo res.partner values
 * Handles both business and individual customers
 *
 * @param {Object|null} customer - Customer from D1
 * @param {Object} companyConfig - Company configuration
 * @returns {Object} res.partner values for Odoo
 */
export function mapCustomerForInvoice(customer) {
  // Handle null/undefined customer
  if (customer === null || customer === undefined) {
    return {
      name: 'Walk-in Customer',
      phone: '',
      email: '',
      x_aura_customer_id: null,
      x_tax_code: undefined,
      x_buyer_address: '',
      x_buyer_type: 'individual',
      company_type: 'person',
      is_company: false,
      customer_rank: 1,
    };
  }

  // Handle empty object
  if (typeof customer === 'object' && Object.keys(customer).length === 0) {
    return {
      name: 'Unknown Customer',
      phone: '',
      email: '',
      x_aura_customer_id: null,
      x_tax_code: undefined,
      x_buyer_address: '',
      x_buyer_type: 'individual',
      company_type: 'person',
      is_company: false,
      customer_rank: 1,
    };
  }

  const hasTaxCode = customer.tax_code && customer.tax_code.trim() !== '';
  const hasAddress = customer.address && customer.address.trim() !== '';
  const hasCompanyName = customer.company_name && customer.company_name.trim() !== '';

  // Determine name and buyer type
  let name = customer.full_name || customer.name || customer.phone || 'Unknown Customer';
  let buyerType = 'individual';
  let companyType = 'person';
  let isCompany = false;

  if (hasCompanyName) {
    name = customer.company_name;
    buyerType = 'business';
    companyType = 'company';
    isCompany = true;
  } else if (hasTaxCode) {
    buyerType = 'business';
    companyType = 'company';
    isCompany = true;
  }

  // Fallback to phone if name is empty
  if (!name && customer.phone) {
    name = customer.phone;
  }

  return {
    name: name.trim().substring(0, 128),
    phone: customer.phone || '',
    email: customer.email || '',
    x_aura_customer_id: customer.id || null,
    // Vietnamese tax info for e-invoicing
    ...(hasTaxCode && { x_tax_code: customer.tax_code.trim() }),
    ...(hasAddress && { x_buyer_address: customer.address.trim().substring(0, 256) }),
    x_buyer_type: buyerType,
    // Odoo standard fields
    company_type: companyType,
    is_company: isCompany,
    customer_rank: 1,
    // Optional: street for Odoo address
    ...(hasAddress && { street: customer.address.trim().substring(0, 128) }),
  };
}

/**
 * Map single invoice line item
 *
 * @param {Object} item - Order item
 * @param {Object} companyConfig - Company configuration
 * @returns {Array} Odoo command format [0, 0, { ... }]
 */
export function mapInvoiceLine(item, companyConfig = getDefaultAccountConfig()) {
  if (!item) {
    return [
      0,
      0,
      {
        name: 'Unknown Item',
        quantity: 1,
        price_unit: 0,
        price_subtotal: 0,
        tax_ids: [[6, false, []]],
        account_id: companyConfig.incomeAccountId,
      },
    ];
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

  const priceSubtotal = quantity * unitPrice;

  return [
    0,
    0,
    {
      name: name.substring(0, 128),
      quantity,
      price_unit: unitPrice,
      price_subtotal: priceSubtotal,
      tax_ids: [[6, false, []]],
      account_id: companyConfig.incomeAccountId,
      product_id: item.product_id || null,
    },
  ];
}

/**
 * Map tax line for order tax amount
 *
 * @param {Object} order - Order with tax field
 * @param {Object} companyConfig - Company configuration
 * @returns {Array} Odoo command format [0, 0, { ... }]
 */
export function mapTaxLine(order, companyConfig = getDefaultAccountConfig()) {
  const taxAmount = order.tax ? parseFloat(order.tax) : 0;
  const taxAmountNum = isNaN(taxAmount) ? 0 : taxAmount;

  return [
    0,
    0,
    {
      account_id: companyConfig.taxAccountId,
      name: 'Tax',
      quantity: 1,
      price_unit: taxAmountNum,
      price_subtotal: taxAmountNum,
      tax_ids: [[6, false, []]],
    },
  ];
}

/**
 * Map order to Odoo account.move values (Invoice)
 * Odoo 16 account.move schema for customer invoices
 *
 * @param {Object} order - Order from D1
 * @param {Array} items - Order items array
 * @param {Object|null} customer - Customer object or null
 * @param {Object} companyConfig - Company configuration
 * @returns {Object} account.move values for Odoo create
 */
export function mapOrderToInvoice(order, items, customer, companyConfig = getDefaultAccountConfig()) {
  if (!order) {
    throw new Error('Invalid order: order is required');
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
    invoiceLines.push([
      0,
      0,
      {
        name: 'Miscellaneous',
        quantity: 1,
        price_unit: 0,
        price_subtotal: 0,
        tax_ids: [[6, false, []]],
        account_id: companyConfig.incomeAccountId,
      },
    ]);
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

  return {
    // Core Odoo fields
    move_type: 'out_invoice',
    partner_id: customer?.id || null,
    invoice_date: invoiceDate,
    journal_id: companyConfig.journalId,
    currency_id: companyConfig.currency === 'VND' ? 1 : companyConfig.currency,
    name: invoiceName,
    ref: `AURA-${order.id}`,
    // Lines
    invoice_line_ids: invoiceLines,
    // Amounts (rounded to 2 decimal places)
    amount_untaxed: Math.round(subtotal * 100) / 100,
    amount_tax: Math.round(taxAmountNum * 100) / 100,
    amount_total: Math.round(totalAmount * 100) / 100,
    // State
    state: 'draft',
    // Vietnam e-invoicing custom fields
    x_aura_order_id: order.id,
    x_vat_invoice_type: companyConfig.vatInvoiceType || '01',
    x_vat_invoice_pattern: companyConfig.vatInvoicePattern || '002',
    x_tax_code: companyConfig.taxCode,
    x_signatory_name: companyConfig.signingAuthority?.name,
    x_signatory_title: companyConfig.signingAuthority?.title,
    // Include order notes as comment if present
    ...(order.notes && { narration: order.notes.trim().substring(0, 1024) }),
  };
}

/**
 * Generate Odoo invoice name/reference
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
 * Map Odoo invoice to Vietnam VAT e-invoice API payload
 * VNInvoice API format for e-invoice submission
 *
 * @param {Object} odooInvoice - Odoo account.move record (from mapOrderToInvoice)
 * @param {Object|null} customer - Customer data for VAT buyer info
 * @param {Object} companyConfig - Company configuration
 * @returns {Object} VNInvoice API payload
 */
export function mapInvoiceForVAT(odooInvoice, customer, companyConfig = getDefaultAccountConfig()) {
  if (!odooInvoice) {
    throw new Error('Invalid invoice: odooInvoice is required');
  }

  // Use amounts directly from Odoo invoice (already calculated)
  const subtotal = odooInvoice.amount_untaxed ?? 0;
  const taxAmount = odooInvoice.amount_tax ?? 0;
  const totalAmount = odooInvoice.amount_total ?? subtotal + taxAmount;

  // Build buyer info
  const buyerInfo = {
    name: extractBuyerName(customer, odooInvoice),
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
  const invoiceItems = extractInvoiceItems(odooInvoice);

  return {
    // VAT invoice metadata
    templateCode: 'V01',
    transactionType: 'SALE',
    invoiceReference: odooInvoice.ref || odooInvoice.name,
    invoiceNumber: odooInvoice.name,
    invoiceDate: odooInvoice.invoice_date,
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
  if (invoice?.partner_id && typeof invoice.partner_id === 'object') {
    return invoice.partner_id.name || 'Unknown Customer';
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
function extractInvoiceItems(odooInvoice) {
  const items = [];
  const lines = Array.isArray(odooInvoice.invoice_line_ids) ? odooInvoice.invoice_line_ids : [];

  for (const line of lines) {
    // Odoo command format: [command, unused, values]
    // command: 0 = create, 1 = update, 2 = remove, 3 = unlink, 4 = link, 5 = clear, 6 = set
    // We expect [0, 0, { ...values }] or [1, 0, { ... }]
    let lineValues;
    if (Array.isArray(line) && line.length >= 3) {
      lineValues = line[2];
    } else if (typeof line === 'object' && line !== null) {
      lineValues = line;
    } else {
      continue; // Skip malformed lines
    }

    // Skip pure tax/accounting lines (no product_id, tax account, "Tax" name)
    if (!lineValues.product_id) {
      const isTaxAccount = lineValues.account_id && (lineValues.account_id === 201 || lineValues.account_id === '201');
      const isTaxName = lineValues.name && lineValues.name.toLowerCase().includes('tax');
      if (isTaxAccount || isTaxName) {
        continue;
      }
    }

    const quantity = lineValues.quantity ?? 1;
    const unitPrice = lineValues.price_unit ?? 0;
    const priceSubtotal = lineValues.price_subtotal ?? (quantity * unitPrice);

    if (quantity > 0 && unitPrice >= 0) {
      items.push({
        itemName: lineValues.name || 'Unknown Item',
        itemCode: lineValues.product_id || null,
        quantity,
        unitPrice,
        unit: 'cái',
        priceSubtotal,
        taxRate: lineValues.tax_ids && Array.isArray(lineValues.tax_ids) && lineValues.tax_ids.length > 0 ? 10 : 0,
        taxAmount: priceSubtotal * 0.1,
      });
    }
  }

  // Ensure at least one item
  if (items.length === 0) {
    items.push({
      itemName: 'Miscellaneous',
      itemCode: null,
      quantity: 1,
      unitPrice: odooInvoice.amount_untaxed || odooInvoice.amount_total || 0,
      unit: 'cái',
      priceSubtotal: odooInvoice.amount_untaxed || odooInvoice.amount_total || 0,
      taxRate: 0,
      taxAmount: 0,
    });
  }

  return items;
}

/**
 * Validate invoice data before Odoo submission
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
  if (!invoice.move_type) {
    errors.push('Missing required field: move_type');
  }

  if (!invoice.partner_id) {
    errors.push('Missing required field: partner_id');
  }

  if (!invoice.invoice_date) {
    errors.push('Missing required field: invoice_date');
  }

  if (!invoice.amount_total && invoice.amount_total !== 0) {
    errors.push('Missing required field: amount_total');
  }

  // Invoice lines validation
  if (!invoice.invoice_line_ids || !Array.isArray(invoice.invoice_line_ids)) {
    errors.push('Invoice must have invoice_line_ids array');
  } else if (invoice.invoice_line_ids.length === 0) {
    errors.push('Invoice must have at least one line');
  }

  // Validate line structure
  for (let i = 0; i < invoice.invoice_line_ids.length; i++) {
    const line = invoice.invoice_line_ids[i];
    if (!Array.isArray(line) || line.length < 3) {
      errors.push(`Invalid invoice line format at index ${i}: expected [command, unused, values]`);
    }
  }

  // Amount validation
  if (invoice.amount_total !== undefined && invoice.amount_total < 0) {
    errors.push('Total amount cannot be negative');
  }

  if (invoice.amount_untaxed !== undefined && invoice.amount_untaxed < 0) {
    errors.push('Untaxed amount cannot be negative');
  }

  // VAT custom fields validation (Vietnam requirement)
  if (!invoice.x_vat_invoice_type) {
    errors.push('Missing VAT invoice type (x_vat_invoice_type)');
  }

  if (!invoice.x_aura_order_id) {
    errors.push('Missing AURA order reference (x_aura_order_id)');
  }

  return errors;
}

/**
 * Check if a mapping result indicates success
 * @param {Object} result - Mapping result
 * @returns {boolean}
 */
export function isMappingSuccess(result) {
  return !!(result && result.success && result.odooInvoiceId);
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
