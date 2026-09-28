/**
 * ERPNext Mapper — Public Barrel Interface
 */

export * from './types';
export * from './customers-crm';
export * from './items-menu';
export * from './orders-sales-invoices';

import { getDefaultAccountConfig, mapCustomerForInvoice, isMappingSuccess, getMappingStatus } from './customers-crm';
import { mapInvoiceLine, mapTaxLine } from './items-menu';
import { mapOrderToInvoice, mapInvoiceForVAT, validateInvoiceData } from './orders-sales-invoices';

export default {
  mapOrderToInvoice,
  mapCustomerForInvoice,
  mapInvoiceForVAT,
  mapInvoiceLine,
  mapTaxLine,
  getDefaultAccountConfig,
  validateInvoiceData,
  isMappingSuccess,
  getMappingStatus
};