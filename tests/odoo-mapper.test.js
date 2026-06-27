/**
 * Odoo Accounting Mapper — Phase 1 Unit Tests
 * Tests for order → invoice mapping and VAT payload generation
 *
 * @jest-test-type unit
 */

import {
  mapOrderToInvoice,
  mapCustomerForInvoice,
  mapInvoiceForVAT,
  mapInvoiceLine,
  mapTaxLine,
  getDefaultAccountConfig,
  validateInvoiceData,
  isMappingSuccess,
  getMappingStatus,
} from '../worker/src/lib/odoo-mapper.js';

describe('Odoo Accounting Mapper — Phase 1 (E-invoicing)', () => {
  const mockCompanyConfig = {
    name: 'AURA CAFE',
    taxCode: '0306781234',
    address: '123 Industrial St, Sa Dec, Vietnam',
    phone: '0901234567',
    email: 'hello@auracafe.vn',
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
    vatInvoiceType: '01',
    vatInvoicePattern: '002',
  };

  const mockCustomer = {
    id: 'cust_001',
    full_name: 'Tran Thi B',
    phone: '0912345678',
    email: 'tranb@example.com',
    tax_code: '0109876543',
    address: '456 Business Ave, Ho Chi Minh City',
  };

  const mockOrder = {
    id: 'ord_001',
    customer_name: 'Tran Thi B',
    phone: '0912345678',
    table_id: 'table_5',
    subtotal: 150000,
    tax: 15000,
    total_amount: 165000,
    status: 'completed',
    notes: 'Less sugar please',
    created_at: '2026-06-26T10:30:00Z',
    updated_at: '2026-06-26T10:45:00Z',
  };

  const mockItems = [
    {
      id: 'item_1',
      order_id: 'ord_001',
      product_id: 'prod_espresso',
      product_name: 'Espresso',
      quantity: 2,
      subtotal: 70000,  // 2 * 35000 unit price with Large modifier
      modifiers: JSON.stringify([{ name: 'Large', price: 10000 }]),
    },
    {
      id: 'item_2',
      order_id: 'ord_001',
      product_id: 'prod_croissant',
      product_name: 'Croissant',
      quantity: 1,
      subtotal: 30000,
      modifiers: null,
    },
  ];

  describe('mapCustomerForInvoice', () => {
    test('should map business customer with tax code', () => {
      const result = mapCustomerForInvoice(mockCustomer, mockCompanyConfig);

      expect(result).toEqual({
        name: mockCustomer.full_name,
        phone: mockCustomer.phone,
        email: mockCustomer.email,
        x_aura_customer_id: mockCustomer.id,
        x_tax_code: mockCustomer.tax_code,
        x_buyer_address: mockCustomer.address,
        x_buyer_type: 'business',
        company_type: 'company',
        is_company: true,
        customer_rank: 1,
        street: mockCustomer.address,
      });
    });

    test('should map individual customer without tax code', () => {
      const individualCustomer = {
        ...mockCustomer,
        tax_code: null,
        address: null,
        company_name: '',
      };

      const result = mapCustomerForInvoice(individualCustomer, mockCompanyConfig);

      expect(result.name).toBe(individualCustomer.full_name);
      expect(result.x_tax_code).toBeUndefined();
      expect(result.x_buyer_type).toBe('individual');
      expect(result.company_type).toBe('person');
      expect(result.is_company).toBe(false);
    });

    test('should handle missing customer name with phone fallback', () => {
      const customerWithNoName = {
        ...mockCustomer,
        full_name: '',
        name: '',
      };

      const result = mapCustomerForInvoice(customerWithNoName, mockCompanyConfig);

      expect(result.name).toBe(mockCustomer.phone);
    });

    test('should handle null customer gracefully', () => {
      const result = mapCustomerForInvoice(null, mockCompanyConfig);

      expect(result.name).toBe('Walk-in Customer');
      expect(result.x_buyer_type).toBe('individual');
      expect(result.company_type).toBe('person');
      expect(result.is_company).toBe(false);
      expect(result.phone).toBe('');
      expect(result.email).toBe('');
    });

    test('should handle empty object customer', () => {
      const result = mapCustomerForInvoice({}, mockCompanyConfig);

      expect(result.name).toBe('Unknown Customer');
      expect(result.x_buyer_type).toBe('individual');
    });

    test('should include company info for business customers', () => {
      const businessCustomer = {
        ...mockCustomer,
        company_name: 'ABC Corporation',
      };

      const result = mapCustomerForInvoice(businessCustomer, mockCompanyConfig);

      expect(result.name).toBe('ABC Corporation');
      expect(result.is_company).toBe(true);
      expect(result.x_buyer_type).toBe('business');
    });

    test('should truncate long names', () => {
      const longNameCustomer = {
        ...mockCustomer,
        full_name: 'A'.repeat(200),
      };

      const result = mapCustomerForInvoice(longNameCustomer, mockCompanyConfig);

      expect(result.name.length).toBeLessThanOrEqual(128);
    });

    test('should handle special characters in name', () => {
      const customerSpecial = {
        ...mockCustomer,
        full_name: "Nguyễn Văn Ân' Test\" <script>",
      };
      const result = mapCustomerForInvoice(customerSpecial, mockCompanyConfig);

      expect(result.name).toContain('Nguyễn Văn Ân');
      expect(result.name).toContain('Test');
    });
  });

  describe('mapInvoiceLine', () => {
    test('should map product item to Odoo invoice line', () => {
      const result = mapInvoiceLine(mockItems[0], mockCompanyConfig);

      expect(result).toEqual([
        0,
        0,
        expect.objectContaining({
          product_id: mockItems[0].product_id,
          name: 'Espresso (Large)',
          quantity: mockItems[0].quantity,
          price_unit: 35000,
          price_subtotal: mockItems[0].subtotal,
          tax_ids: [[6, false, []]],
          account_id: mockCompanyConfig.incomeAccountId,
        }),
      ]);
    });

    test('should map item without modifiers', () => {
      const result = mapInvoiceLine(mockItems[1], mockCompanyConfig);

      expect(result[2].name).toBe('Croissant');
      expect(result[2].price_unit).toBe(30000);
      expect(result[2].quantity).toBe(1);
    });

    test('should handle null/undefined quantity', () => {
      const itemWithNullQty = { ...mockItems[0], quantity: null };
      const result = mapInvoiceLine(itemWithNullQty, mockCompanyConfig);

      expect(result[2].quantity).toBe(1);
    });

    test('should handle undefined quantity', () => {
      const itemUndefinedQty = { ...mockItems[0] };
      delete itemUndefinedQty.quantity;
      const result = mapInvoiceLine(itemUndefinedQty, mockCompanyConfig);

      expect(result[2].quantity).toBe(1);
    });

    test('should calculate price_unit from subtotal', () => {
      const item = {
        quantity: 3,
        subtotal: 90000,
      };

      const result = mapInvoiceLine(item, mockCompanyConfig);

      expect(result[2].price_unit).toBe(30000);
      expect(result[2].price_subtotal).toBe(90000);
    });

    test('should handle null item', () => {
      const result = mapInvoiceLine(null, mockCompanyConfig);

      expect(result[2].name).toBe('Unknown Item');
      expect(result[2].quantity).toBe(1);
      expect(result[2].price_unit).toBe(0);
    });

    test('should parse modifiers from JSON string', () => {
      const itemWithModifiers = {
        ...mockItems[0],
        modifiers: '[{"name": "Extra Shot", "price": 5000}, {"name": "Oat Milk", "price": 3000}]',
      };
      const result = mapInvoiceLine(itemWithModifiers, mockCompanyConfig);

      expect(result[2].name).toContain('Extra Shot');
      expect(result[2].name).toContain('Oat Milk');
    });

    test('should handle invalid modifiers JSON gracefully', () => {
      const itemBadModifiers = {
        ...mockItems[0],
        modifiers: 'not valid json{{{',
      };
      const result = mapInvoiceLine(itemBadModifiers, mockCompanyConfig);

      expect(result[2].name).toBe('Espresso'); // Should still have base name
    });

    test('should handle price_unit directly', () => {
      const itemWithPriceUnit = {
        quantity: 2,
        price_unit: 25000,
      };
      const result = mapInvoiceLine(itemWithPriceUnit, mockCompanyConfig);

      expect(result[2].price_unit).toBe(25000);
      expect(result[2].price_subtotal).toBe(50000);
    });

    test('should handle zero quantity as 1', () => {
      const itemZeroQty = { ...mockItems[0], quantity: 0 };
      const result = mapInvoiceLine(itemZeroQty, mockCompanyConfig);

      expect(result[2].quantity).toBe(1);
    });

    test('should handle negative quantity as 1', () => {
      const itemNegQty = { ...mockItems[0], quantity: -2 };
      const result = mapInvoiceLine(itemNegQty, mockCompanyConfig);

      expect(result[2].quantity).toBe(1);
    });

    test('should handle decimal quantities', () => {
      const itemDecimal = { ...mockItems[0], quantity: 1.5, subtotal: 52500 };
      const result = mapInvoiceLine(itemDecimal, mockCompanyConfig);

      expect(result[2].quantity).toBe(1.5);
      expect(result[2].price_unit).toBeCloseTo(35000, 0);
      expect(result[2].price_subtotal).toBeCloseTo(52500, 0);
    });

    test('should use default income account from config', () => {
      const result = mapInvoiceLine(mockItems[0], mockCompanyConfig);

      expect(result[2].account_id).toBe(mockCompanyConfig.incomeAccountId);
    });
  });

  describe('mapTaxLine', () => {
    test('should map tax amount to Odoo tax line', () => {
      const result = mapTaxLine(mockOrder, mockCompanyConfig);

      expect(result).toEqual([
        0,
        0,
        expect.objectContaining({
          account_id: mockCompanyConfig.taxAccountId,
          name: 'Tax',
          quantity: 1,
          price_unit: mockOrder.tax,
          price_subtotal: mockOrder.tax,
          tax_ids: [[6, false, []]],
        }),
      ]);
    });

    test('should handle zero tax', () => {
      const orderNoTax = { ...mockOrder, tax: 0 };
      const result = mapTaxLine(orderNoTax, mockCompanyConfig);

      expect(result[2].price_unit).toBe(0);
      expect(result[2].price_subtotal).toBe(0);
    });

    test('should handle null tax', () => {
      const orderNullTax = { ...mockOrder, tax: null };
      const result = mapTaxLine(orderNullTax, mockCompanyConfig);

      expect(result[2].price_unit).toBe(0);
    });

    test('should handle undefined tax', () => {
      const orderUndefinedTax = { ...mockOrder };
      delete orderUndefinedTax.tax;
      const result = mapTaxLine(orderUndefinedTax, mockCompanyConfig);

      expect(result[2].price_unit).toBe(0);
    });

    test('should handle string tax value', () => {
      const orderStringTax = { ...mockOrder, tax: '15000' };
      const result = mapTaxLine(orderStringTax, mockCompanyConfig);

      expect(result[2].price_unit).toBe(15000);
    });

    test('should handle invalid tax as 0', () => {
      const orderInvalidTax = { ...mockOrder, tax: 'invalid' };
      const result = mapTaxLine(orderInvalidTax, mockCompanyConfig);

      expect(result[2].price_unit).toBe(0);
    });
  });

  describe('mapOrderToInvoice', () => {
    test('should map order to Odoo account.move values', () => {
      const result = mapOrderToInvoice(mockOrder, mockItems, mockCustomer, mockCompanyConfig);

      // Core Odoo fields
      expect(result.move_type).toBe('out_invoice');
      expect(result.partner_id).toBe(mockCustomer.id);
      expect(result.invoice_date).toBe('2026-06-26');
      expect(result.journal_id).toBe(mockCompanyConfig.journalId);
      expect(result.currency_id).toBe(1);

      // Invoice lines should have 3 entries (2 products + 1 tax)
      expect(result.invoice_line_ids).toHaveLength(3);
      expect(result.invoice_line_ids[0][2].product_id).toBe('prod_espresso');
      expect(result.invoice_line_ids[1][2].product_id).toBe('prod_croissant');
      expect(result.invoice_line_ids[2][2].account_id).toBe(mockCompanyConfig.taxAccountId);

      // Amounts
      expect(result.amount_total).toBe(mockOrder.total_amount);
      expect(result.amount_untaxed).toBe(mockOrder.subtotal);
      expect(result.amount_tax).toBe(mockOrder.tax);

      // Custom fields
      expect(result.x_aura_order_id).toBe(mockOrder.id);
      expect(result.x_vat_invoice_type).toBe(mockCompanyConfig.vatInvoiceType);
      expect(result.x_vat_invoice_pattern).toBe(mockCompanyConfig.vatInvoicePattern);
      expect(result.x_tax_code).toBe(mockCompanyConfig.taxCode);
      expect(result.x_signatory_name).toBe(mockCompanyConfig.signingAuthority.name);
      expect(result.x_signatory_title).toBe(mockCompanyConfig.signingAuthority.title);

      // Ref field
      expect(result.ref).toBe(`AURA-${mockOrder.id}`);

      // State
      expect(result.state).toBe('draft');
    });

    test('should include VAT invoice type code', () => {
      const result = mapOrderToInvoice(mockOrder, mockItems, mockCustomer, mockCompanyConfig);

      expect(result.x_vat_invoice_type).toBe('01');
      expect(result.x_vat_invoice_pattern).toBe('002');
    });

    test('should handle order with null items', () => {
      const result = mapOrderToInvoice(mockOrder, null, mockCustomer, mockCompanyConfig);

      expect(result.invoice_line_ids).toHaveLength(1); // Only tax line
    });

    test('should handle empty items array', () => {
      const result = mapOrderToInvoice(mockOrder, [], mockCustomer, mockCompanyConfig);

      expect(result.invoice_line_ids).toHaveLength(1);
      expect(result.amount_total).toBe(mockOrder.total_amount);
    });

    test('should add notes from order as narration', () => {
      const result = mapOrderToInvoice(mockOrder, mockItems, mockCustomer, mockCompanyConfig);

      expect(result.narration).toContain('Less sugar');
    });

    test('should generate invoice name in correct format', () => {
      const result = mapOrderToInvoice(mockOrder, mockItems, mockCustomer, mockCompanyConfig);

      expect(result.name).toMatch(/^INV\/\d{4}\/\d{2}\/\d{3}$/);
    });

    test('should handle order with custom date format', () => {
      const orderCustomDate = {
        ...mockOrder,
        created_at: '2025-12-25T14:00:00Z',
      };
      const result = mapOrderToInvoice(orderCustomDate, mockItems, mockCustomer, mockCompanyConfig);

      expect(result.invoice_date).toBe('2025-12-25');
      expect(result.name).toMatch(/^INV\/2025\/12\/\d{3}$/);
    });

    test('should handle order without tax', () => {
      const orderNoTax = {
        ...mockOrder,
        tax: 0,
        total_amount: mockOrder.subtotal,
      };
      const result = mapOrderToInvoice(orderNoTax, mockItems, mockCustomer, mockCompanyConfig);

      expect(result.amount_tax).toBe(0);
      expect(result.invoice_line_ids).toHaveLength(2); // Only product lines
    });

    test('should use fallback total when total_amount missing', () => {
      const orderNoTotal = {
        ...mockOrder,
        total_amount: null,
      };
      const result = mapOrderToInvoice(orderNoTotal, mockItems, mockCustomer, mockCompanyConfig);

      expect(result.amount_total).toBe(mockOrder.subtotal + mockOrder.tax);
    });

    test('should throw error for null order', () => {
      expect(() => mapOrderToInvoice(null, mockItems, mockCustomer, mockCompanyConfig)).toThrow(
        'Invalid order: order is required'
      );
    });

    test('should handle null customer with default config', () => {
      const result = mapOrderToInvoice(mockOrder, mockItems, null, mockCompanyConfig);

      expect(result.partner_id).toBeNull();
      // Still should have valid invoice
      expect(result.invoice_line_ids.length).toBeGreaterThan(0);
    });

    test('should round amounts to 2 decimal places', () => {
      const orderDecimals = {
        ...mockOrder,
        subtotal: 150000.123,
        tax: 15000.456,
        total_amount: 165000.579,
      };
      const result = mapOrderToInvoice(orderDecimals, mockItems, mockCustomer, mockCompanyConfig);

      expect(result.amount_untaxed).toBe(150000.12);
      expect(result.amount_tax).toBe(15000.46);
      expect(result.amount_total).toBe(165000.58);
    });
  });

  describe('mapInvoiceForVAT', () => {
    test('should map invoice to VNPT/VNInvoice API payload', () => {
      const odooInvoice = mapOrderToInvoice(mockOrder, mockItems, mockCustomer, mockCompanyConfig);
      const result = mapInvoiceForVAT(odooInvoice, mockCustomer, mockCompanyConfig);

      expect(result).toHaveProperty('buyerInfo');
      expect(result).toHaveProperty('sellerInfo');
      expect(result).toHaveProperty('invoiceItems');
      expect(result).toHaveProperty('signatureInfo');
      expect(result).toHaveProperty('subtotal');
      expect(result).toHaveProperty('taxAmount');
      expect(result).toHaveProperty('totalAmount');

      // Buyer info
      expect(result.buyerInfo.name).toBe(mockCustomer.full_name);
      expect(result.buyerInfo.taxCode).toBe(mockCustomer.tax_code);
      expect(result.buyerInfo.address).toBe(mockCustomer.address);
      expect(result.buyerInfo.phone).toBe(mockCustomer.phone);
      expect(result.buyerInfo.buyerType).toBe('business');

      // Seller info
      expect(result.sellerInfo.name).toBe(mockCompanyConfig.name);
      expect(result.sellerInfo.taxCode).toBe(mockCompanyConfig.taxCode);
      expect(result.sellerInfo.address).toBe(mockCompanyConfig.address);
      expect(result.sellerInfo.phone).toBe(mockCompanyConfig.phone);

      // Signature
      expect(result.signatureInfo.signatoryName).toBe(mockCompanyConfig.signingAuthority.name);
      expect(result.signatureInfo.signatoryTitle).toBe(mockCompanyConfig.signingAuthority.title);
      expect(result.signatureInfo.idNumber).toBe(mockCompanyConfig.signingAuthority.idNumber);

      // Invoice items (should exclude tax line)
      expect(result.invoiceItems).toHaveLength(2);
      expect(result.invoiceItems[0].itemName).toBe('Espresso (Large)');
      expect(result.invoiceItems[0].quantity).toBe(2);
      expect(result.invoiceItems[0].unitPrice).toBe(35000);
    });

    test('should use correct VAT invoice template', () => {
      const odooInvoice = mapOrderToInvoice(mockOrder, mockItems, mockCustomer, mockCompanyConfig);
      const result = mapInvoiceForVAT(odooInvoice, mockCustomer, mockCompanyConfig);

      expect(result.templateCode).toBe('V01');
      expect(result.transactionType).toBe('SALE');
      expect(result.currency).toBe('VND');
    });

    test('should handle individual customer without tax code', () => {
      const individualCustomer = {
        ...mockCustomer,
        tax_code: null,
        address: null,
      };
      const odooInvoice = mapOrderToInvoice(mockOrder, mockItems, mockCustomer, mockCompanyConfig);
      const result = mapInvoiceForVAT(odooInvoice, individualCustomer, mockCompanyConfig);

      expect(result.buyerInfo.taxCode).toBeNull();
      expect(result.buyerInfo.buyerType).toBe('individual');
    });

    test('should include totals', () => {
      const odooInvoice = mapOrderToInvoice(mockOrder, mockItems, mockCustomer, mockCompanyConfig);
      const result = mapInvoiceForVAT(odooInvoice, mockCustomer, mockCompanyConfig);

      expect(result.subtotal).toBe(mockOrder.subtotal);
      expect(result.taxAmount).toBe(mockOrder.tax);
      expect(result.totalAmount).toBe(mockOrder.total_amount);
    });

    test('should include invoice reference', () => {
      const odooInvoice = mapOrderToInvoice(mockOrder, mockItems, mockCustomer, mockCompanyConfig);
      const result = mapInvoiceForVAT(odooInvoice, mockCustomer, mockCompanyConfig);

      expect(result.invoiceReference).toBe(odooInvoice.ref);
      expect(result.invoiceNumber).toBe(odooInvoice.name);
      expect(result.invoiceDate).toBe(odooInvoice.invoice_date);
    });

    test('should throw error for null invoice', () => {
      expect(() => mapInvoiceForVAT(null, mockCustomer, mockCompanyConfig)).toThrow(
        'Invalid invoice: odooInvoice is required'
      );
    });

    test('should handle null customer with walk-in defaults', () => {
      const odooInvoice = mapOrderToInvoice(mockOrder, mockItems, null, mockCompanyConfig);
      const result = mapInvoiceForVAT(odooInvoice, null, mockCompanyConfig);

      expect(result.buyerInfo.name).toBe('Walk-in Customer');
      expect(result.buyerInfo.buyerType).toBe('individual');
    });

    test('should round totals correctly', () => {
      const orderDecimals = {
        ...mockOrder,
        subtotal: 150000.123,
        tax: 15000.456,
        total_amount: 165000.579,
      };
      const odooInvoice = mapOrderToInvoice(orderDecimals, mockItems, mockCustomer, mockCompanyConfig);
      const result = mapInvoiceForVAT(odooInvoice, mockCustomer, mockCompanyConfig);

      expect(result.subtotal).toBe(150000);
      expect(result.taxAmount).toBe(15000);
      expect(result.totalAmount).toBe(165001); // Rounded
    });

    test('should include payment method placeholder', () => {
      const odooInvoice = mapOrderToInvoice(mockOrder, mockItems, mockCustomer, mockCompanyConfig);
      const result = mapInvoiceForVAT(odooInvoice, mockCustomer, mockCompanyConfig);

      expect(result.paymentMethod).toBe('CASH');
      expect(result.paymentStatus).toBe('UNPAID');
    });
  });

  describe('validateInvoiceData', () => {
    test('should validate complete invoice data', () => {
      const invoice = mapOrderToInvoice(mockOrder, mockItems, mockCustomer, mockCompanyConfig);
      const errors = validateInvoiceData(invoice);

      expect(errors).toHaveLength(0);
    });

    test('should reject invoice without partner', () => {
      const invoice = {
        ...mapOrderToInvoice(mockOrder, mockItems, mockCustomer, mockCompanyConfig),
        partner_id: null,
      };
      const errors = validateInvoiceData(invoice);

      expect(errors).toContain('Missing required field: partner_id');
    });

    test('should reject invoice without lines', () => {
      const invoice = {
        ...mapOrderToInvoice(mockOrder, mockItems, mockCustomer, mockCompanyConfig),
        invoice_line_ids: [],
      };
      const errors = validateInvoiceData(invoice);

      expect(errors).toContain('Invoice must have at least one line');
    });

    test('should reject invoice with negative total', () => {
      const invoice = {
        ...mapOrderToInvoice(mockOrder, mockItems, mockCustomer, mockCompanyConfig),
        amount_total: -1000,
      };
      const errors = validateInvoiceData(invoice);

      expect(errors).toContain('Total amount cannot be negative');
    });

    test('should warn about missing VAT invoice type', () => {
      const invoice = {
        ...mapOrderToInvoice(mockOrder, mockItems, mockCustomer, mockCompanyConfig),
        x_vat_invoice_type: null,
      };
      const errors = validateInvoiceData(invoice);

      expect(errors.some((e) => e.includes('VAT invoice type'))).toBe(true);
    });

    test('should reject invoice without move_type', () => {
      const invoice = {
        ...mapOrderToInvoice(mockOrder, mockItems, mockCustomer, mockCompanyConfig),
        move_type: undefined,
      };
      const errors = validateInvoiceData(invoice);

      expect(errors).toContain('Missing required field: move_type');
    });

    test('should reject invoice without invoice_date', () => {
      const invoice = {
        ...mapOrderToInvoice(mockOrder, mockItems, mockCustomer, mockCompanyConfig),
        invoice_date: undefined,
      };
      const errors = validateInvoiceData(invoice);

      expect(errors).toContain('Missing required field: invoice_date');
    });

    test('should validate line format structure', () => {
      const invoice = {
        ...mapOrderToInvoice(mockOrder, mockItems, mockCustomer, mockCompanyConfig),
        invoice_line_ids: [[0, 0]], // Invalid format
      };
      const errors = validateInvoiceData(invoice);

      expect(errors.some((e) => e.includes('Invalid invoice line format'))).toBe(true);
    });

    test('should reject null invoice', () => {
      const errors = validateInvoiceData(null);

      expect(errors).toContain('Invoice data is required');
    });

    test('should validate missing AURA order reference', () => {
      const invoice = {
        ...mapOrderToInvoice(mockOrder, mockItems, mockCustomer, mockCompanyConfig),
        x_aura_order_id: undefined,
      };
      const errors = validateInvoiceData(invoice);

      expect(errors).toContain('Missing AURA order reference (x_aura_order_id)');
    });

    test('should accept zero total as valid', () => {
      const invoice = {
        ...mapOrderToInvoice(mockOrder, mockItems, mockCustomer, mockCompanyConfig),
        amount_total: 0,
      };
      const errors = validateInvoiceData(invoice);

      expect(errors).not.toContain('Total amount cannot be negative');
    });
  });

  describe('Edge Cases', () => {
    test('should handle customer with special characters in name', () => {
      const customerSpecial = {
        id: 'cust_002',
        full_name: "Nguyễn Văn Ân' Test\"",
        phone: '0911111111',
        email: 'test@example.com',
      };
      const result = mapCustomerForInvoice(customerSpecial, mockCompanyConfig);

      expect(result.name).toBe("Nguyễn Văn Ân' Test\"");
    });

    test('should handle high-value order amounts', () => {
      const highValueOrder = {
        ...mockOrder,
        subtotal: 10000000,
        tax: 1000000,
        total_amount: 11000000,
      };
      const result = mapOrderToInvoice(highValueOrder, mockItems, mockCustomer, mockCompanyConfig);

      expect(result.amount_total).toBe(11000000);
      expect(result.amount_untaxed).toBe(10000000);
    });

    test('should handle item with missing product_id', () => {
      const itemNoProduct = { ...mockItems[0], product_id: null };
      const result = mapInvoiceLine(itemNoProduct, mockCompanyConfig);

      expect(result[2].product_id).toBeNull();
      expect(result[2].name).toContain('Espresso');
    });

    test('should handle item with empty name fallback', () => {
      const itemNoName = {
        ...mockItems[0],
        product_name: '',
        name: '',
      };
      const result = mapInvoiceLine(itemNoName, mockCompanyConfig);

      expect(result[2].name).toBe('Unknown Product');
    });

    test('should handle decimal quantities', () => {
      const itemDecimal = { ...mockItems[0], quantity: 1.5, subtotal: 52500 };
      const result = mapInvoiceLine(itemDecimal, mockCompanyConfig);

      expect(result[2].quantity).toBe(1.5);
      expect(result[2].price_unit).toBeCloseTo(35000, 0);
    });

    test('should handle very long modifier names', () => {
      const longModifier = { name: 'A'.repeat(200) };
      const itemLongMod = {
        ...mockItems[0],
        modifiers: JSON.stringify([longModifier]),
      };
      const result = mapInvoiceLine(itemLongMod, mockCompanyConfig);

      expect(result[2].name.length).toBeLessThanOrEqual(128);
    });

    test('should handle string quantity values', () => {
      const itemStringQty = { ...mockItems[0], quantity: '2' };
      const result = mapInvoiceLine(itemStringQty, mockCompanyConfig);

      expect(result[2].quantity).toBe(2);
    });

    test('should handle string subtotal values', () => {
      const itemStringSubtotal = { ...mockItems[0], subtotal: '60000' };
      const result = mapInvoiceLine(itemStringSubtotal, mockCompanyConfig);

      expect(result[2].price_unit).toBe(30000);
    });

    test('should handle order with future date', () => {
      const futureDate = '2027-01-01T00:00:00Z';
      const futureOrder = { ...mockOrder, created_at: futureDate };
      const result = mapOrderToInvoice(futureOrder, mockItems, mockCustomer, mockCompanyConfig);

      expect(result.invoice_date).toBe('2027-01-01');
      expect(result.name).toMatch(/^INV\/2027\/01\/\d{3}$/);
    });

    test('should handle order with invalid date fallback', () => {
      const invalidDateOrder = { ...mockOrder, created_at: 'invalid-date' };
      const result = mapOrderToInvoice(invalidDateOrder, mockItems, mockCustomer, mockCompanyConfig);

      // Should use current date fallback
      expect(result.invoice_date).toBeDefined();
    });

    test('should merge multiple modifiers correctly', () => {
      const multiModItem = {
        ...mockItems[0],
        modifiers: JSON.stringify([
          { name: 'Large' },
          { name: 'Extra Shot' },
          { name: 'Oat Milk' },
        ]),
      };
      const result = mapInvoiceLine(multiModItem, mockCompanyConfig);

      expect(result[2].name).toContain('Large');
      expect(result[2].name).toContain('Extra Shot');
      expect(result[2].name).toContain('Oat Milk');
    });
  });

  describe('getDefaultAccountConfig', () => {
    test('should return default config with required fields', () => {
      const config = getDefaultAccountConfig();

      expect(config).toHaveProperty('name');
      expect(config).toHaveProperty('taxCode');
      expect(config).toHaveProperty('address');
      expect(config).toHaveProperty('phone');
      expect(config).toHaveProperty('email');
      expect(config).toHaveProperty('currency');
      expect(config).toHaveProperty('journalId');
      expect(config).toHaveProperty('incomeAccountId');
      expect(config).toHaveProperty('taxAccountId');
      expect(config).toHaveProperty('signingAuthority');
      expect(config).toHaveProperty('vatInvoiceType');
      expect(config).toHaveProperty('vatInvoicePattern');
    });

    test('should return VND as default currency', () => {
      const config = getDefaultAccountConfig();
      expect(config.currency).toBe('VND');
    });

    test('should return correct VAT invoice codes', () => {
      const config = getDefaultAccountConfig();
      expect(config.vatInvoiceType).toBe('01');
      expect(config.vatInvoicePattern).toBe('002');
    });
  });

  describe('isMappingSuccess', () => {
    test('should return true for successful mapping', () => {
      const result = { success: true, odooInvoiceId: 123 };
      expect(isMappingSuccess(result)).toBe(true);
    });

    test('should return false for cached result', () => {
      const result = { success: true, fromCache: true, odooInvoiceId: null };
      expect(isMappingSuccess(result)).toBe(false);
    });

    test('should return false for failed mapping', () => {
      const result = { success: false, error: 'Connection error' };
      expect(isMappingSuccess(result)).toBe(false);
    });

    test('should return false for null result', () => {
      expect(isMappingSuccess(null)).toBe(false);
      expect(isMappingSuccess(undefined)).toBe(false);
    });

    test('should return false for result without odooInvoiceId', () => {
      const result = { success: true };
      expect(isMappingSuccess(result)).toBe(false);
    });
  });

  describe('getMappingStatus', () => {
    test('should return CACHED for cached results', () => {
      const result = { success: true, fromCache: true };
      expect(getMappingStatus(result)).toBe('CACHED');
    });

    test('should return SYNCED for successful new sync', () => {
      const result = { success: true };
      expect(getMappingStatus(result)).toBe('SYNCED');
    });

    test('should return FAILED for failed mappings', () => {
      const result = { success: false, error: 'Error message' };
      expect(getMappingStatus(result)).toBe('FAILED');
    });

    test('should return UNKNOWN for unrecognized status', () => {
      expect(getMappingStatus({})).toBe('UNKNOWN');
      expect(getMappingStatus(null)).toBe('UNKNOWN');
    });
  });
});
