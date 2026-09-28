/**
 * ERPNext Customer & CRM Mapping
 */

import type {
  AccountConfig,
  CustomerRecord,
  CustomerInvoiceFields,
  MappingResult
} from './types';

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
      idDate: '2020-01-15'
    },
    vatInvoiceType: '01',
    vatInvoicePattern: '002'
  };
}

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
      territory: 'Vietnam'
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
      territory: 'Vietnam'
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
    ...(hasAddress && { customer_primary_address: customer.address!.trim().substring(0, 128) })
  };
}

export function isMappingSuccess(result: MappingResult | null | undefined): boolean {
  return !!(result && result.success && result.erpnextInvoiceId);
}

export function getMappingStatus(result: MappingResult | null | undefined): string {
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
