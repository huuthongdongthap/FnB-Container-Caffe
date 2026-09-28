/**
 * ERPNext Mapper — Type Definitions
 * Shared types for ERPNext Accounting and E-invoicing mappings
 */

export interface AccountConfig {
  name?: string;
  taxCode?: string;
  address?: string;
  phone?: string;
  email?: string;
  website?: string;
  bankName?: string;
  bankAccount?: string;
  defaultIncomeAccount?: string;
  defaultCostCenter?: string;
  defaultWarehouse?: string;
  defaultTaxTemplate?: string;
  vatRate?: number;
  currency?: string;
  incomeAccount?: string;
  taxAccount?: string;
  costCenter?: string;
  company?: string;
  signingAuthority?: {
    name?: string;
    title?: string;
    idNumber?: string;
    idDate?: string;
  };
  vatInvoiceType?: string;
  vatInvoicePattern?: string;
}

export interface CustomerRecord {
  id?: string;
  name?: string;
  full_name?: string;
  customer_name?: string;
  phone?: string;
  email?: string;
  tax_code?: string;
  address?: string;
  street?: string;
  company_name?: string;
  is_company?: boolean;
}

export interface OrderItem {
  id?: string;
  product_id?: string | number;
  product_name?: string;
  name?: string;
  quantity?: number;
  qty?: number;
  unit_price?: number;
  price_unit?: number;
  price?: number;
  rate?: number;
  subtotal?: number;
  amount?: number;
  notes?: string;
  modifiers?: string | Array<{ name?: string; title?: string; price?: number }>;
}

export interface OrderRecord {
  id: string;
  order_number?: string;
  created_at?: string;
  date?: string;
  payment_method?: string;
  subtotal?: number;
  tax_amount?: number;
  tax?: number;
  discount_amount?: number;
  discount?: number;
  total_amount?: number;
  grand_total?: number;
  notes?: string;
  channel?: string;
  table_id?: string;
  delivery_address?: string;
  customer_id?: string;
  custom_fields?: Record<string, unknown>;
}

export interface InvoiceLineItem {
  item_code?: string | null;
  item_name: string;
  description?: string;
  qty: number;
  rate: number;
  amount: number;
  income_account?: string;
  cost_center?: string;
  warehouse?: string;
  expense_account?: string;
  custom_aura_item_id?: string;
  custom_modifiers?: string;
}

export interface TaxLineItem {
  charge_type: string;
  account_head?: string;
  description: string;
  rate?: number;
  tax_amount: number;
  total?: number;
  cost_center?: string;
}

export interface SalesInvoice {
  doctype: 'Sales Invoice';
  title?: string;
  naming_series?: string;
  customer: string;
  customer_name?: string;
  posting_date: string;
  posting_time?: string;
  due_date?: string;
  company?: string;
  is_pos?: 0 | 1;
  is_return?: 0 | 1;
  update_stock?: 0 | 1;
  currency?: string;
  conversion_rate?: number;
  selling_price_list?: string;
  price_list_currency?: string;
  plc_conversion_rate?: number;
  items: Array<InvoiceLineItem | TaxLineItem>;
  taxes?: TaxLineItem[];
  taxes_and_charges?: string;
  total: number;
  base_total?: number;
  net_total?: number;
  total_taxes_and_charges?: number;
  grand_total: number;
  outstanding_amount?: number;
  base_grand_total?: number;
  rounded_total?: number;
  rounding_adjustment?: number;
  discount_amount?: number;
  additional_discount_percentage?: number;
  apply_discount_on?: string;
  payment_schedule?: unknown[];
  payments?: unknown[];
  remarks?: string;
  status?: string;
  docstatus?: number;
  name?: string;
  custom_aura_order_ref?: string;
  custom_aura_order_id?: string;
  custom_aura_order_number?: string;
  custom_sales_channel?: string;
  custom_table_number?: string;
  custom_payment_method?: string;
  custom_vat_invoice_type?: string;
  custom_vat_invoice_pattern?: string;
  custom_vat_submission_status?: string;
  custom_tax_code?: string;
  custom_signatory_name?: string;
  custom_signatory_title?: string;
  custom_buyer_tax_code?: string;
  custom_buyer_address?: string;
  custom_buyer_phone?: string;
  custom_buyer_email?: string;
  custom_buyer_company?: string;
  custom_notes?: string;
}

export interface CustomerInvoiceFields {
  customer_name: string;
  phone: string;
  email: string;
  custom_aura_customer_id: string | null;
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
  invoiceReference?: string;
  invoiceNumber?: string;
  invoiceDate: string;
  currency: string;
  buyerInfo: {
    name: string;
    taxCode: string | null;
    address: string;
    phone: string;
    email: string;
    buyerType: string;
  };
  sellerInfo: {
    name?: string;
    taxCode?: string;
    address?: string;
    phone?: string;
    email?: string;
  };
  invoiceItems: Array<Record<string, unknown>>;
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  signatureInfo: {
    signatoryName?: string;
    signatoryTitle?: string;
    idNumber?: string;
    idDate?: string;
  };
  paymentMethod: string;
  paymentStatus: string;
  customFields?: Record<string, unknown>;
}

export interface MappingResult {
  success: boolean;
  erpnextInvoiceId?: string;
  fromCache?: boolean;
  invoice?: SalesInvoice;
  vatPayload?: VatInvoicePayload;
  errors?: string[];
  warnings?: string[];
  orderId?: string;
  error?: string;
}
